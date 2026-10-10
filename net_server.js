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
//   {"t": "rooms", "cid": "..."}   the rooms of a script, in or out of a room
// Server -> client:
//   {"t": "joined", "id": n, "room": "name", "max": m, "players": [ids], "limits": {"bytes": n, "rate": n}}
//   {"t": "enter", "id": n} / {"t": "exit", "id": n}
//   {"t": "msg", "from": n, "d": <value>}
//   {"t": "rooms", "rooms": [{"room": "name", "count": n, "max": m, "closed": 0 | 1}, ...]}
//   {"t": "rooms", "error": "cid" | "rate"}
//   {"t": "error", "code": "cid" | "full" | "closed" | "busy" | "size" | "rate" | "join"}
//   (joins count against the same rate as messages: "rate" refuses a join too)
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
	// what a player may leave unread (bytes): over it nothing more is sent to
	// the player, and the player is disconnected when it stays so
	maxBufferedBytes: 1048576,
	// where the client address comes from: false: the connection itself,
	// 'loopback': X-Forwarded-For when the connection is from a proxy on this
	// machine, true: X-Forwarded-For from any connection (a proxy elsewhere)
	trustProxy: 'loopback',
	// a line for each connection, room entry and exit and refusal
	log: true,
	// a summary line this often (0: none)
	statsSeconds: 300,
};
const PATH = '/api/net';
const CID = /^[a-zA-Z0-9\-]{1,64}$/;
const ROOM_LENGTH = 32;
// rooms listed in one answer to "rooms"
const LIST_ROOMS = 500;
// nesting of a value that is passed on (the players' own limit is 32 levels of
// arrays, about 100 levels here; JSON.stringify runs out of stack far above)
const VALUE_DEPTH = 128;
// a connection that names this many scripts that do not exist is closed
const CID_REFUSALS = 20;

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
	// the rooms of each cid, oldest first (what joining and listing look through)
	const roomsByCid = new Map();
	const perIp = new Map();
	const cids = new Map();
	let connections = 0;
	let connectionCount = 0;
	let warnedLoopback = false;
	// what happened since the last summary line
	let counts = newCounts();

	function newCounts() {
		return {connects: 0, joins: 0, refused: 0, messages: 0, bytes: 0, dropped: 0, lists: 0};
	}
	// One line per event, "net <event> key=value ...". What a client chose (a
	// room name, an origin) is quoted, so that it cannot start a line of its own.
	function field(v) {
		const s = String(v);
		return (s === '' || /[\s"=\\]/.test(s) || /[^\x21-\x7e]/.test(s)) ? JSON.stringify(s) : s;
	}
	function event(level, name, fields) {
		if (!conf.log) {
			return;
		}
		const text = Object.keys(fields).filter(function(k) {
			return fields[k] !== undefined && fields[k] !== null;
		}).map(function(k) {
			return k + '=' + field(fields[k]);
		}).join(' ');
		logger[level]('net ' + name + (text ? ' ' + text : ''));
	}
	function secondsSince(t) {
		return Math.round((Date.now() - t) / 1000);
	}

	// IPv4 clients of a dual-stack socket read as ::ffff:1.2.3.4.
	function plainAddress(a) {
		a = String(a || '').trim().substring(0, 64);
		return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(a) ? a.substring(7) : a;
	}
	function isLoopback(a) {
		return a === '::1' || /^127\./.test(a);
	}
	// The address the proxy saw the client connect from: the last entry of
	// X-Forwarded-For that is not a proxy on this machine (the entries before
	// it are as the client sent them), or X-Real-IP.
	function forwardedAddress(req) {
		const list = String(req.headers['x-forwarded-for'] || '').split(',').map(plainAddress).filter(Boolean);
		while (list.length > 1 && isLoopback(list[list.length - 1])) {
			list.pop();
		}
		return list.pop() || plainAddress(req.headers['x-real-ip']);
	}
	function addressOf(req) {
		const peer = plainAddress(req.socket && req.socket.remoteAddress);
		const trusted = conf.trustProxy === true || (conf.trustProxy === 'loopback' && isLoopback(peer));
		return (trusted && forwardedAddress(req)) || peer;
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
	function refuse(socket, status, text, req, reason) {
		counts.refused++;
		event('warn', 'refused', {status: status, reason: reason, ip: addressOf(req), origin: String(req.headers.origin || '').substring(0, 200)});
		// (the http server has let go of the socket: an error of the write
		// would have nobody to go to)
		socket.on('error', function() {});
		socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
		socket.destroy();
	}

	servers.forEach(function(server) {
		server.on('upgrade', function(req, socket, head) {
			// nothing in a request may throw out of here
			try {
				upgrade(req, socket, head);
			} catch (e) {
				logger.error(e);
				socket.destroy();
			}
		});
	});
	function upgrade(req, socket, head) {
		let path = '';
		try {
			path = new URL(req.url, 'http://localhost').pathname;
		} catch (e) {
		}
		if (path !== PATH) {
			return refuse(socket, 404, 'Not Found', req, 'path');
		}
		if (!originAllowed(req)) {
			return refuse(socket, 403, 'Forbidden', req, 'origin');
		}
		const ip = addressOf(req);
		if (connections >= conf.maxConnections) {
			return refuse(socket, 429, 'Too Many Requests', req, 'connections');
		}
		// A proxy on this machine that does not say who the client is
		// brings every player under its own address, so that address has
		// no limit of its own.
		if (isLoopback(ip)) {
			if (!warnedLoopback) {
				warnedLoopback = true;
				event('warn', 'no_client_address', {ip: ip});
			}
		} else if ((perIp.get(ip) || 0) >= conf.connectionsPerIp) {
			return refuse(socket, 429, 'Too Many Requests', req, 'connections_per_ip');
		}
		wss.handleUpgrade(req, socket, head, function(ws) {
			wss.emit('connection', ws, ip, String(req.headers.origin || '').substring(0, 200));
		});
	}

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

	// (to a player that does not read, nothing more is queued: see deliver)
	function send(ws, value) {
		if (ws.readyState === ws.OPEN && ws.bufferedAmount <= conf.maxBufferedBytes) {
			ws.send(JSON.stringify(value));
		}
	}
	function playersOf(room) {
		return Array.from(room.players.keys()).sort(function(a, b) { return a - b; });
	}
	// reason: leave (netLeave), rejoin (netJoin again) or disconnect.
	function leave(ws, reason) {
		const p = ws.pg0;
		const room = p.room;
		const id = p.id;
		if (!room) {
			return;
		}
		room.players.delete(id);
		p.room = null;
		p.id = 0;
		event('info', 'leave', {conn: p.conn, cid: room.cid, room: room.name, id: id, players: room.players.size + '/' + room.max, reason: reason, secs: secondsSince(p.joined)});
		if (room.players.size === 0) {
			rooms.delete(room.key);
			const ofCid = roomsByCid.get(room.cid);
			ofCid.delete(room.key);
			if (ofCid.size === 0) {
				roomsByCid.delete(room.cid);
			}
			event('info', 'room_end', {cid: room.cid, room: room.name, peak: room.peak + '/' + room.max, closed: room.closed ? 1 : 0, messages: room.messages, secs: secondsSince(room.created)});
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
		(roomsByCid.get(cid) || new Map()).forEach(function(room) {
			if (room.auto && room.max === max && !room.started && !room.closed && room.players.size < max) {
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
		const refused = function(code) {
			counts.refused++;
			event('warn', 'join_refused', {conn: p.conn, ip: p.ip, cid: cid.substring(0, 64), room: name, reason: code});
			send(ws, {t: 'error', code: code});
		};
		if (ws.readyState !== ws.OPEN) {
			return;
		}
		// a join is a lookup of the cid and a search of the rooms: it counts
		// against the same rate as sending (told once a second)
		if (!allowed(p)) {
			counts.refused++;
			if (Date.now() - p.warned > 1000) {
				p.warned = Date.now();
				refused('rate');
			}
			return;
		}
		leave(ws, 'rejoin');
		if (!CID.test(cid) || !await cidExists(cid)) {
			refused('cid');
			return unknownCid(ws);
		}
		if (ws.readyState !== ws.OPEN) {
			return;
		}
		let room = name ? rooms.get(cid + '\n' + name) : findAutoRoom(cid, max);
		if (room && room.closed) {
			return refused('closed');
		}
		if (room && room.players.size >= room.max) {
			return refused('full');
		}
		let created = false;
		if (!room) {
			if (rooms.size >= conf.maxRooms) {
				return refused('busy');
			}
			let roomName = name;
			while (!roomName || (!name && rooms.has(cid + '\n' + roomName))) {
				roomName = 'auto-' + crypto.randomBytes(4).toString('hex');
			}
			room = {key: cid + '\n' + roomName, cid: cid, name: roomName, auto: !name, max: max, players: new Map(), started: false, closed: false,
				created: Date.now(), peak: 0, messages: 0};
			rooms.set(room.key, room);
			if (!roomsByCid.has(cid)) {
				roomsByCid.set(cid, new Map());
			}
			roomsByCid.get(cid).set(room.key, room);
			created = true;
		}
		let id = 1;
		while (room.players.has(id)) {
			id++;
		}
		room.players.forEach(function(other) {
			send(other, {t: 'enter', id: id});
		});
		room.players.set(id, ws);
		room.peak = Math.max(room.peak, room.players.size);
		if (room.players.size >= room.max) {
			room.started = true;
		}
		p.room = room;
		p.id = id;
		p.joined = Date.now();
		counts.joins++;
		event('info', 'join', {conn: p.conn, ip: p.ip, cid: cid, room: room.name, id: id, players: room.players.size + '/' + room.max, auto: room.auto ? 1 : 0, created: created ? 1 : 0});
		send(ws, {t: 'joined', id: id, room: room.name, max: room.max, players: playersOf(room),
			limits: {bytes: conf.maxMessageBytes, rate: conf.messagesPerSecond}});
	}
	// The rooms of a script, oldest first: what a lobby shows so that a player
	// can pick one. Asking counts against the same rate as sending.
	async function listRooms(ws, msg) {
		const p = ws.pg0;
		const cid = String(msg.cid || '');
		if (ws.readyState !== ws.OPEN) {
			return;
		}
		if (!allowed(p)) {
			return send(ws, {t: 'rooms', error: 'rate'});
		}
		if (!CID.test(cid) || !await cidExists(cid)) {
			send(ws, {t: 'rooms', error: 'cid'});
			return unknownCid(ws);
		}
		counts.lists++;
		const list = [];
		(roomsByCid.get(cid) || new Map()).forEach(function(room) {
			if (list.length < LIST_ROOMS) {
				list.push({room: room.name, count: room.players.size, max: room.max, closed: room.closed ? 1 : 0});
			}
		});
		send(ws, {t: 'rooms', rooms: list});
	}
	// Scripts that do not exist cost a database lookup each (unknown cids are
	// remembered for a minute): a connection that keeps naming them is closed.
	function unknownCid(ws) {
		if (++ws.pg0.badCids >= CID_REFUSALS) {
			ws.pg0.end = 'cid';
			ws.close(1008, 'cid');
		}
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
	// A message that was not passed on. The first of each kind is a line of
	// its own; the totals come with the disconnect line.
	function dropped(p, reason) {
		counts.dropped++;
		p.dropped[reason] = (p.dropped[reason] || 0) + 1;
		if (p.dropped[reason] === 1) {
			event('warn', 'drop', {conn: p.conn, ip: p.ip, cid: p.room.cid, room: p.room.name, id: p.id, reason: reason});
		}
	}
	// Whether a value is nested deeper than VALUE_DEPTH, counted without
	// recursion.
	function tooDeep(value) {
		const stack = [[value, 1]];
		while (stack.length) {
			const item = stack.pop();
			const v = item[0];
			if (!v || typeof v !== 'object') {
				continue;
			}
			if (item[1] > VALUE_DEPTH) {
				return true;
			}
			const children = Array.isArray(v) ? v : Object.values(v);
			for (let i = 0; i < children.length; i++) {
				if (children[i] && typeof children[i] === 'object') {
					stack.push([children[i], item[1] + 1]);
				}
			}
		}
		return false;
	}
	// To a player that does not read what is sent (what waits for it is over
	// the limit) nothing more is sent until it does; the timer closes it when
	// it stays so.
	function deliver(other, out) {
		if (other.readyState !== other.OPEN) {
			return;
		}
		if (other.bufferedAmount > conf.maxBufferedBytes) {
			dropped(other.pg0, 'slow');
			return;
		}
		other.send(out);
	}
	// bytes: the message as it came, in UTF-8 (what the limit counts).
	function relay(ws, bytes, msg) {
		const p = ws.pg0;
		if (!p.room) {
			return;
		}
		if (bytes > conf.maxMessageBytes) {
			dropped(p, 'size');
			return send(ws, {t: 'error', code: 'size'});
		}
		if (!allowed(p)) {
			dropped(p, 'rate');
			// one warning a second is enough
			if (Date.now() - p.warned > 1000) {
				p.warned = Date.now();
				send(ws, {t: 'error', code: 'rate'});
			}
			return;
		}
		if (tooDeep(msg.d)) {
			dropped(p, 'size');
			return send(ws, {t: 'error', code: 'size'});
		}
		let out;
		try {
			out = JSON.stringify({t: 'msg', from: p.id, d: msg.d === undefined ? 0 : msg.d});
		} catch (e) {
			dropped(p, 'size');
			return send(ws, {t: 'error', code: 'size'});
		}
		p.sent++;
		p.room.messages++;
		counts.messages++;
		counts.bytes += bytes;
		const to = Math.floor(Number(msg.to));
		if (msg.to !== undefined && msg.to !== null && Number.isFinite(to) && to > 0) {
			const other = p.room.players.get(to);
			if (other && other !== ws) {
				deliver(other, out);
			}
			return;
		}
		p.room.players.forEach(function(other) {
			if (other !== ws) {
				deliver(other, out);
			}
		});
	}
	// One message from a player. Nothing a player sends may throw out of here:
	// the relay shares its process with the whole site.
	function received(ws, data, isBinary) {
		const p = ws.pg0;
		p.active = Date.now();
		if (isBinary) {
			return;
		}
		let msg;
		try {
			msg = JSON.parse(data.toString('utf8'));
		} catch (e) {
			return;
		}
		if (!msg || typeof msg !== 'object') {
			return;
		}
		switch (msg.t) {
		case 'join':
			p.pending = p.pending.then(function() {
				return join(ws, msg);
			}).catch(function(e) {
				logger.error(e);
				send(ws, {t: 'error', code: 'join'});
			});
			break;
		case 'send':
			relay(ws, data.length, msg);
			break;
		case 'rooms':
			p.pending = p.pending.then(function() {
				return listRooms(ws, msg);
			}).catch(function(e) {
				logger.error(e);
				send(ws, {t: 'rooms', error: 'cid'});
			});
			break;
		case 'close':
			// Any player of the room may close it, for good: a seat that is
			// left is not offered again.
			if (p.room && !p.room.closed) {
				p.room.closed = true;
				event('info', 'close', {conn: p.conn, cid: p.room.cid, room: p.room.name, id: p.id, players: p.room.players.size + '/' + p.room.max});
			}
			break;
		case 'leave':
			leave(ws, 'leave');
			break;
		}
	}

	wss.on('connection', function(ws, ip, origin) {
		connections++;
		perIp.set(ip, (perIp.get(ip) || 0) + 1);
		// pending: joins and listings of one connection are handled one at a time
		ws.pg0 = {conn: ++connectionCount, ip: ip, room: null, id: 0, tokens: conf.messagesPerSecond, refilled: Date.now(), warned: 0, active: Date.now(), alive: true,
			opened: Date.now(), joined: 0, sent: 0, dropped: {}, badCids: 0, end: '', pending: Promise.resolve()};
		counts.connects++;
		event('info', 'connect', {conn: ws.pg0.conn, ip: ip, origin: origin});
		ws.on('pong', function() {
			ws.pg0.alive = true;
		});
		ws.on('message', function(data, isBinary) {
			try {
				received(ws, data, isBinary);
			} catch (e) {
				logger.error(e);
			}
		});
		ws.on('close', function(code) {
			leave(ws, 'disconnect');
			const p = ws.pg0;
			event('info', 'disconnect', {conn: p.conn, ip: ip, secs: secondsSince(p.opened), sent: p.sent,
				dropped_rate: p.dropped.rate, dropped_size: p.dropped.size, dropped_slow: p.dropped.slow, reason: p.end || 'close', code: code});
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

	// Connections that stopped answering, went quiet or do not read what is
	// sent to them are closed.
	const timer = setInterval(function() {
		const now = Date.now();
		wss.clients.forEach(function(ws) {
			const p = ws.pg0;
			if (!p.alive || now - p.active > conf.idleSeconds * 1000 || ws.bufferedAmount > conf.maxBufferedBytes) {
				p.end = !p.alive ? 'no_response' : (now - p.active > conf.idleSeconds * 1000 ? 'idle' : 'slow');
				ws.terminate();
				return;
			}
			p.alive = false;
			ws.ping();
		});
	}, 30000);
	timer.unref();

	// The summary line: the connections and rooms now, and what happened
	// since the last line. Nothing is written while nothing goes on.
	function stats() {
		const c = counts;
		counts = newCounts();
		if (!connections && !rooms.size && !c.connects && !c.refused) {
			return;
		}
		let players = 0;
		rooms.forEach(function(room) {
			players += room.players.size;
		});
		event('info', 'stats', {connections: connections, rooms: rooms.size, players: players, connects: c.connects, joins: c.joins,
			lists: c.lists, messages: c.messages, bytes: c.bytes, dropped: c.dropped, refused: c.refused, secs: conf.statsSeconds});
	}
	const statsTimer = conf.statsSeconds > 0 ? setInterval(stats, conf.statsSeconds * 1000) : null;
	if (statsTimer) {
		statsTimer.unref();
	}

	return {wss: wss, rooms: rooms, stats: stats, close: function() { clearInterval(timer); clearInterval(statsTimer); wss.close(); }};
};
