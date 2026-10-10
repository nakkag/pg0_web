'use strict';
// Relay of lib/net.pg0: programs opened from the same stored script (cid) meet
// in rooms and pass values to each other over a WebSocket at /api/net.
// Nothing is stored; a value one player sends is forwarded to the others in
// the room as it is.
//
// Client -> server (JSON text frames):
//   {"t": "join", "cid": "...", "room": "name" | "", "max": 2}
//   {"t": "send", "d": <value>, "to": <player number, optional>}
//   {"t": "close"}   nobody else may enter the room
//   {"t": "leave"}
// Server -> client:
//   {"t": "joined", "id": n, "room": "name", "max": m, "players": [ids], "limits": {"bytes": n, "rate": n}}
//   {"t": "enter", "id": n} / {"t": "exit", "id": n}
//   {"t": "msg", "from": n, "d": <value>}
//   {"t": "error", "code": "cid" | "full" | "closed" | "busy" | "size" | "rate" | "join"}
const {WebSocketServer} = require('ws');
const crypto = require('crypto');

const DEFAULTS = {
	enabled: true,
	// the largest room a program may ask for
	maxPlayers: 8,
	// one message as the client sends it
	maxMessageBytes: 16384,
	// messages one player may send in a second; more are dropped
	messagesPerSecond: 60,
	connectionsPerIp: 16,
	maxConnections: 2000,
	maxRooms: 5000,
	// a player that sends nothing for this long is disconnected
	idleSeconds: 1800,
	// the client address is taken from X-Forwarded-For (behind a proxy only)
	trustProxy: false,
};
const PATH = '/api/net';
const CID = /^[a-zA-Z0-9\-]{1,64}$/;
const ROOM_LENGTH = 32;

module.exports = function(servers, deps) {
	const conf = Object.assign({}, DEFAULTS, deps.settings || {});
	const logger = deps.logger || console;
	if (!conf.enabled) {
		return null;
	}
	// The site's own allowOrigins, and origins that may use the relay only.
	const allowOrigins = [].concat(Array.isArray(deps.allowOrigins) ? deps.allowOrigins : [], Array.isArray(conf.allowOrigins) ? conf.allowOrigins : []);
	const wss = new WebSocketServer({noServer: true, maxPayload: conf.maxMessageBytes + 1024});
	const rooms = new Map();
	const perIp = new Map();
	const cids = new Map();
	let connections = 0;

	function addressOf(req) {
		const forwarded = conf.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
		return forwarded || (req.socket && req.socket.remoteAddress) || '';
	}
	// Pages of this site (and the origins allowed in the settings) only.
	function originAllowed(req) {
		const origin = req.headers.origin;
		if (!origin) {
			return false;
		}
		if (allowOrigins.includes(origin)) {
			return true;
		}
		try {
			return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
		} catch (e) {
			return false;
		}
	}
	function refuse(socket, status, text) {
		socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
		socket.destroy();
	}

	servers.forEach(function(server) {
		server.on('upgrade', function(req, socket, head) {
			let path = '';
			try {
				path = new URL(req.url, 'http://localhost').pathname;
			} catch (e) {
			}
			if (path !== PATH) {
				return refuse(socket, 404, 'Not Found');
			}
			if (!originAllowed(req)) {
				return refuse(socket, 403, 'Forbidden');
			}
			const ip = addressOf(req);
			if (connections >= conf.maxConnections || (perIp.get(ip) || 0) >= conf.connectionsPerIp) {
				return refuse(socket, 429, 'Too Many Requests');
			}
			wss.handleUpgrade(req, socket, head, function(ws) {
				wss.emit('connection', ws, ip);
			});
		});
	});

	// Whether a stored script has this cid. Answers are kept for a while so
	// that joining does not ask the database every time.
	async function cidExists(cid) {
		const now = Date.now();
		const known = cids.get(cid);
		if (known && now - known.at < (known.ok ? 600000 : 60000)) {
			return known.ok;
		}
		let ok = false;
		try {
			const db = await deps.getDB();
			ok = !!(await db.collection('script').findOne({cid: cid}, {projection: {cid: 1}}));
		} catch (e) {
			logger.error(e);
			return false;
		}
		if (cids.size > 10000) {
			cids.clear();
		}
		cids.set(cid, {ok: ok, at: now});
		return ok;
	}

	function send(ws, value) {
		if (ws.readyState === ws.OPEN) {
			ws.send(JSON.stringify(value));
		}
	}
	function playersOf(room) {
		return Array.from(room.players.keys()).sort(function(a, b) { return a - b; });
	}
	function leave(ws) {
		const p = ws.pg0;
		const room = p.room;
		const id = p.id;
		if (!room) {
			return;
		}
		room.players.delete(id);
		p.room = null;
		p.id = 0;
		if (room.players.size === 0) {
			rooms.delete(room.key);
			return;
		}
		room.players.forEach(function(other) {
			send(other, {t: 'exit', id: id});
		});
	}
	// A room left without a name is one of the automatic ones of the script:
	// the fullest one that still has a seat and has never been full, so that
	// nobody is dropped into a game that already started.
	function findAutoRoom(cid, max) {
		let best = null;
		rooms.forEach(function(room) {
			if (room.auto && room.cid === cid && room.max === max && !room.started && !room.closed && room.players.size < max) {
				if (!best || room.players.size > best.players.size) {
					best = room;
				}
			}
		});
		return best;
	}
	async function join(ws, msg) {
		const p = ws.pg0;
		const cid = String(msg.cid || '');
		const name = String(msg.room == null ? '' : msg.room).trim().substring(0, ROOM_LENGTH);
		let max = Math.floor(Number(msg.max));
		if (!Number.isFinite(max) || max < 2) {
			max = 2;
		}
		max = Math.min(max, conf.maxPlayers);
		leave(ws);
		if (!CID.test(cid) || !await cidExists(cid)) {
			return send(ws, {t: 'error', code: 'cid'});
		}
		if (ws.readyState !== ws.OPEN) {
			return;
		}
		let room = name ? rooms.get(cid + '\n' + name) : findAutoRoom(cid, max);
		if (room && room.closed) {
			return send(ws, {t: 'error', code: 'closed'});
		}
		if (room && room.players.size >= room.max) {
			return send(ws, {t: 'error', code: 'full'});
		}
		if (!room) {
			if (rooms.size >= conf.maxRooms) {
				return send(ws, {t: 'error', code: 'busy'});
			}
			let roomName = name;
			while (!roomName || (!name && rooms.has(cid + '\n' + roomName))) {
				roomName = 'auto-' + crypto.randomBytes(4).toString('hex');
			}
			room = {key: cid + '\n' + roomName, cid: cid, name: roomName, auto: !name, max: max, players: new Map(), started: false, closed: false};
			rooms.set(room.key, room);
		}
		let id = 1;
		while (room.players.has(id)) {
			id++;
		}
		room.players.forEach(function(other) {
			send(other, {t: 'enter', id: id});
		});
		room.players.set(id, ws);
		if (room.players.size >= room.max) {
			room.started = true;
		}
		p.room = room;
		p.id = id;
		send(ws, {t: 'joined', id: id, room: room.name, max: room.max, players: playersOf(room),
			limits: {bytes: conf.maxMessageBytes, rate: conf.messagesPerSecond}});
	}
	// Up to messagesPerSecond, refilled continuously.
	function allowed(p) {
		const now = Date.now();
		p.tokens = Math.min(conf.messagesPerSecond, p.tokens + (now - p.refilled) * conf.messagesPerSecond / 1000);
		p.refilled = now;
		if (p.tokens < 1) {
			return false;
		}
		p.tokens--;
		return true;
	}
	function relay(ws, raw, msg) {
		const p = ws.pg0;
		if (!p.room) {
			return;
		}
		if (raw.length > conf.maxMessageBytes) {
			return send(ws, {t: 'error', code: 'size'});
		}
		if (!allowed(p)) {
			// one warning a second is enough
			if (Date.now() - p.warned > 1000) {
				p.warned = Date.now();
				send(ws, {t: 'error', code: 'rate'});
			}
			return;
		}
		const out = JSON.stringify({t: 'msg', from: p.id, d: msg.d === undefined ? 0 : msg.d});
		const to = Math.floor(Number(msg.to));
		if (msg.to !== undefined && msg.to !== null && Number.isFinite(to) && to > 0) {
			const other = p.room.players.get(to);
			if (other && other !== ws && other.readyState === other.OPEN) {
				other.send(out);
			}
			return;
		}
		p.room.players.forEach(function(other) {
			if (other !== ws && other.readyState === other.OPEN) {
				other.send(out);
			}
		});
	}

	wss.on('connection', function(ws, ip) {
		connections++;
		perIp.set(ip, (perIp.get(ip) || 0) + 1);
		ws.pg0 = {ip: ip, room: null, id: 0, tokens: conf.messagesPerSecond, refilled: Date.now(), warned: 0, active: Date.now(), alive: true};
		// joins of one connection are handled one at a time
		let pending = Promise.resolve();
		ws.on('pong', function() {
			ws.pg0.alive = true;
		});
		ws.on('message', function(data, isBinary) {
			ws.pg0.active = Date.now();
			if (isBinary) {
				return;
			}
			const raw = data.toString('utf8');
			let msg;
			try {
				msg = JSON.parse(raw);
			} catch (e) {
				return;
			}
			if (!msg || typeof msg !== 'object') {
				return;
			}
			switch (msg.t) {
			case 'join':
				pending = pending.then(function() {
					return join(ws, msg);
				}).catch(function(e) {
					logger.error(e);
					send(ws, {t: 'error', code: 'join'});
				});
				break;
			case 'send':
				relay(ws, raw, msg);
				break;
			case 'close':
				// Any player of the room may close it, for good: a seat that is
				// left is not offered again.
				if (ws.pg0.room) {
					ws.pg0.room.closed = true;
				}
				break;
			case 'leave':
				leave(ws);
				break;
			}
		});
		ws.on('close', function() {
			leave(ws);
			connections--;
			const n = (perIp.get(ip) || 1) - 1;
			if (n > 0) {
				perIp.set(ip, n);
			} else {
				perIp.delete(ip);
			}
		});
		ws.on('error', function(e) {
			logger.warn('net: ' + e.message);
		});
	});

	// Connections that stopped answering or went quiet are closed.
	const timer = setInterval(function() {
		const now = Date.now();
		wss.clients.forEach(function(ws) {
			const p = ws.pg0;
			if (!p.alive || now - p.active > conf.idleSeconds * 1000) {
				ws.terminate();
				return;
			}
			p.alive = false;
			ws.ping();
		});
	}, 30000);
	timer.unref();

	return {wss: wss, rooms: rooms, close: function() { clearInterval(timer); wss.close(); }};
};
