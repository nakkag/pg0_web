"use strict";

// lib/net.pg0: online play between programs opened from the same stored
// script (cid). Players meet in a room on the server (net_server.js) and pass
// values to each other; the server keeps nothing.

// What a run leaves open is closed when the next run imports the library.
if (ScriptExec.lib['$net']) {
	ScriptExec.lib['$net'].close();
	ScriptExec.lib['$net'] = null;
}

// var: the script is loaded again on every run, and const could not be declared twice.
var _NET_QUEUE = 1000;
var _NET_DEPTH = 32;

// The relay is the API server's, unless pg0_settings.js names another one
// (netServer, such as the admin pages joining the rooms of the public site).
function _netUrl() {
	const server = (typeof netServer === 'string' && netServer) ? netServer : ((typeof apiServer === 'string' && apiServer) ? apiServer : location.href);
	const base = new URL(server, location.href);
	return (base.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + base.host + '/api/net';
}

function _netNotice(msg) {
	if (typeof cv !== 'undefined' && cv) {
		cv.error(pg0_string.escapeHTML(msg));
	}
}

function _netText(key, fallback, values) {
	let s = (typeof resource !== 'undefined' && resource[key]) ? resource[key] : fallback;
	Object.keys(values || {}).forEach(function(k) {
		s = s.replace('{' + k + '}', values[k]);
	});
	return s;
}

// A value as the interpreter keeps it ({type, num | str | array}), rebuilt
// from whatever arrived: anything else becomes 0, and nesting is bounded.
function _netValue(j, depth) {
	if (!j || typeof j !== 'object' || depth > _NET_DEPTH) {
		return {type: TYPE_INTEGER, num: 0};
	}
	switch (j.type) {
	case TYPE_INTEGER:
		return {type: TYPE_INTEGER, num: (typeof j.num === 'number' && isFinite(j.num)) ? (j.num | 0) : 0};
	case TYPE_FLOAT:
		return {type: TYPE_FLOAT, num: (typeof j.num === 'number' && isFinite(j.num)) ? j.num : 0};
	case TYPE_STRING:
		return {type: TYPE_STRING, str: (typeof j.str === 'string') ? j.str : ''};
	case TYPE_ARRAY:
		return {type: TYPE_ARRAY, array: (Array.isArray(j.array) ? j.array : []).map(function(e) {
			return {name: (e && typeof e.name === 'string') ? e.name : '', v: _netValue(e && e.v, depth + 1)};
		})};
	}
	return {type: TYPE_INTEGER, num: 0};
}

function _netInt(n) {
	return {type: TYPE_INTEGER, num: n | 0};
}

// The size of a message as it is sent (UTF-8), which the server's limit counts.
function _netBytes(text) {
	return _netUtf8(text).length;
}

function _netUtf8(text) {
	if (typeof TextEncoder !== 'undefined') {
		return new TextEncoder().encode(text);
	}
	const s = unescape(encodeURIComponent(text));
	const bytes = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) {
		bytes[i] = s.charCodeAt(i);
	}
	return bytes;
}

// SHA-256 of a string (in UTF-8) as hex: what the server compares the saved
// program with.
function _netSha256(text) {
	const K = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
	const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
	const rotr = function(x, n) {
		return (x >>> n) | (x << (32 - n));
	};
	const bytes = _netUtf8(text);
	const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
	padded.set(bytes);
	padded[bytes.length] = 0x80;
	const view = new DataView(padded.buffer);
	view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
	view.setUint32(padded.length - 4, (bytes.length << 3) >>> 0);
	const w = new Uint32Array(64);
	for (let i = 0; i < padded.length; i += 64) {
		for (let t = 0; t < 16; t++) {
			w[t] = view.getUint32(i + t * 4);
		}
		for (let t = 16; t < 64; t++) {
			const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
			const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
			w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
		}
		let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
		for (let t = 0; t < 64; t++) {
			const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
			const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
			h = g;
			g = f;
			f = e;
			e = (d + t1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (t1 + t2) >>> 0;
		}
		H[0] = (H[0] + a) >>> 0;
		H[1] = (H[1] + b) >>> 0;
		H[2] = (H[2] + c) >>> 0;
		H[3] = (H[3] + d) >>> 0;
		H[4] = (H[4] + e) >>> 0;
		H[5] = (H[5] + f) >>> 0;
		H[6] = (H[6] + g) >>> 0;
		H[7] = (H[7] + h) >>> 0;
	}
	return H.map(function(x) {
		return ('0000000' + x.toString(16)).slice(-8);
	}).join('');
}

// The program as the editor has it, hashed as the server hashes the saved
// one: without CR and without the line breaks at the end.
function _netProgramHash() {
	const text = (typeof ev !== 'undefined' && ev && typeof ev.getText === 'function') ? ev.getText() : '';
	return _netSha256(String(text).replace(/\r/g, '').replace(/\n+$/, ''));
}

function _netSetInt(ret, n) {
	ret.v = _netInt(n);
}

// One connection to the relay and what it has received.
function _netConnection() {
	const me = {ws: null, result: '', id: 0, room: '', max: 0, players: [], queue: [], last: {}, limits: {bytes: 16384, rate: 60}, warned: {}, timer: null,
		rooms: null, roomsDone: false};
	me.close = function() {
		if (me.timer) {
			clearInterval(me.timer);
			me.timer = null;
		}
		if (me.ws) {
			me.ws.onclose = null;
			me.ws.onmessage = null;
			try {
				me.ws.close();
			} catch (e) {
			}
			me.ws = null;
		}
		me.id = 0;
		me.players = [];
	};
	// The same warning at most once a second.
	me.warn = function(key, text) {
		const now = Date.now();
		if (!me.warned[key] || now - me.warned[key] > 1000) {
			me.warned[key] = now;
			_netNotice(text);
		}
	};
	me.receive = function(data) {
		let msg;
		try {
			msg = JSON.parse(data);
		} catch (e) {
			return;
		}
		if (!msg || typeof msg !== 'object') {
			return;
		}
		switch (msg.t) {
		case 'joined':
			me.id = msg.id | 0;
			me.room = String(msg.room || '');
			me.max = msg.max | 0;
			me.players = Array.isArray(msg.players) ? msg.players.map(function(n) { return n | 0; }) : [me.id];
			if (msg.limits) {
				me.limits = {bytes: msg.limits.bytes | 0, rate: msg.limits.rate | 0};
			}
			me.result = 'joined';
			break;
		case 'enter':
			if (!me.players.includes(msg.id | 0)) {
				me.players.push(msg.id | 0);
				me.players.sort(function(a, b) { return a - b; });
			}
			break;
		case 'exit':
			me.players = me.players.filter(function(n) { return n !== (msg.id | 0); });
			delete me.last[msg.id | 0];
			break;
		case 'msg': {
			const from = msg.from | 0;
			const v = _netValue(msg.d, 0);
			me.last[from] = v;
			me.queue.push({from: from, v: v});
			if (me.queue.length > _NET_QUEUE) {
				me.queue.shift();
			}
			break;
		}
		case 'rooms':
			me.rooms = Array.isArray(msg.rooms) ? msg.rooms : null;
			me.roomsDone = true;
			break;
		case 'error':
			if (!me.result) {
				me.result = String(msg.code || 'join');
			} else if (msg.code === 'size') {
				me.warn('size', _netText('NET_ERROR_SIZE', 'netSend: the value is too large to send (up to {bytes} bytes).', {bytes: me.limits.bytes}));
			} else if (msg.code === 'rate') {
				me.warn('rate', _netText('NET_ERROR_RATE', 'netSend: too many values were sent, so some were not ({rate} a second at most).', {rate: me.limits.rate}));
			}
			break;
		}
	};
	return me;
}

function _netCurrent() {
	const c = ScriptExec.lib['$net'];
	return (c && c.ws && c.id) ? c : null;
}

// netJoin(room = "", players = 2): enters a room of this script and returns
// the player number (1, 2, ...), or 0 when it could not.
ScriptExec.lib['netjoin'] = async function(ei, param, ret) {
	_netSetInt(ret, 0);
	if (ScriptExec.lib['$net']) {
		ScriptExec.lib['$net'].close();
	}
	// A run that must not meet anybody (such as the AI agent's trial run, which
	// sets this to the notice to show) gets 0, as when the server cannot be
	// reached. It is a notice, not an error.
	const offline = ScriptExec.lib['$netOffline'];
	if (offline) {
		if (typeof cv !== 'undefined' && cv) {
			cv.info(pg0_string.escapeHTML(String(offline)));
		}
		return 0;
	}
	let room = '';
	if (param.length > 0 && param[0].v.type !== TYPE_ARRAY) {
		room = ScriptExec.getValueString(param[0].v).trim();
	}
	let max = 2;
	if (param.length > 1) {
		max = parseInt(param[1].v.type === TYPE_STRING ? ScriptExec.stringToNumber(param[1].v.str) : param[1].v.num);
		if (isNaN(max)) {
			max = 2;
		}
	}
	const cid = (typeof ev !== 'undefined' && ev.currentContent) ? (ev.currentContent.cid || '') : '';
	if (!cid) {
		_netNotice(_netText('NET_ERROR_CID', 'netJoin: works only in a program saved online (saving gives it a cid).'));
		return 0;
	}
	// (the program must be the one saved under the cid)
	const hash = _netProgramHash();
	const c = _netConnection();
	ScriptExec.lib['$net'] = c;
	try {
		c.ws = new WebSocket(_netUrl());
	} catch (e) {
		console.error(e);
		c.result = 'connect';
	}
	if (c.ws) {
		c.ws.onopen = function() {
			c.ws.send(JSON.stringify({t: 'join', cid: cid, room: room, max: max, hash: hash}));
		};
		c.ws.onmessage = function(e) {
			c.receive(e.data);
		};
		c.ws.onclose = function() {
			c.ws = null;
			c.id = 0;
			c.players = [];
			if (!c.result) {
				c.result = 'connect';
			}
		};
	}
	const start = Date.now();
	while (!c.result && run && Date.now() - start < 10000) {
		await new Promise(resolve => setTimeout(resolve, 10));
	}
	if (c.result !== 'joined') {
		if (run) {
			const reasons = {
				cid: ['NET_ERROR_CID', 'netJoin: works only in a program saved online (saving gives it a cid).'],
				modified: ['NET_ERROR_MODIFIED', 'netJoin: the program differs from the one saved online. Save it, then run it.'],
				full: ['NET_ERROR_FULL', 'netJoin: room "{room}" is full.'],
				closed: ['NET_ERROR_CLOSED', 'netJoin: room "{room}" is closed: the game has started.'],
				busy: ['NET_ERROR_BUSY', 'netJoin: the server is busy. Try again later.'],
				rate: ['NET_ERROR_BUSY', 'netJoin: the server is busy. Try again later.'],
			};
			const r = reasons[c.result] || ['NET_ERROR_CONNECT', 'netJoin: could not connect to the server.'];
			_netNotice(_netText(r[0], r[1], {room: room}));
		}
		c.close();
		return 0;
	}
	// The connection lasts as long as the run.
	c.timer = setInterval(function() {
		if (!run) {
			c.close();
		}
	}, 200);
	ret.v.num = c.id;
	return 0;
};

// The rooms of the script as the program sees them: {"room", "count", "max",
// "closed"} for each, rebuilt from what arrived.
function _netRoomList(list) {
	return {type: TYPE_ARRAY, array: list.filter(function(r) {
		return r && typeof r === 'object';
	}).map(function(r) {
		return {name: '', v: {type: TYPE_ARRAY, array: [
			{name: 'room', v: {type: TYPE_STRING, str: String(r.room == null ? '' : r.room).substring(0, 32)}},
			{name: 'count', v: _netInt(r.count)},
			{name: 'max', v: _netInt(r.max)},
			{name: 'closed', v: _netInt(r.closed ? 1 : 0)},
		]}};
	})};
}

// netRooms(): the rooms of this script, oldest first, as
// {{"room": name, "count": players, "max": seats, "closed": 0 | 1}, ...},
// or 0 when the server cannot be reached. It can be called in a room or out
// of one; out of a room it keeps a connection that only asks for the list.
ScriptExec.lib['netrooms'] = async function(ei, param, ret) {
	_netSetInt(ret, 0);
	if (ScriptExec.lib['$netOffline']) {
		return 0;
	}
	const cid = (typeof ev !== 'undefined' && ev.currentContent) ? (ev.currentContent.cid || '') : '';
	if (!cid) {
		const c = ScriptExec.lib['$net'];
		if (c) {
			c.warn('cid', _netText('NET_ERROR_CID', 'netJoin: works only in a program saved online (saving gives it a cid).'));
		} else {
			_netNotice(_netText('NET_ERROR_CID', 'netJoin: works only in a program saved online (saving gives it a cid).'));
		}
		return 0;
	}
	let c = ScriptExec.lib['$net'];
	if (!c || !c.ws || c.ws.readyState > WebSocket.OPEN) {
		if (c) {
			c.close();
		}
		c = _netConnection();
		ScriptExec.lib['$net'] = c;
		try {
			c.ws = new WebSocket(_netUrl());
		} catch (e) {
			console.error(e);
			c.ws = null;
		}
		if (!c.ws) {
			return 0;
		}
		c.ws.onmessage = function(e) {
			c.receive(e.data);
		};
		c.ws.onclose = function() {
			c.ws = null;
			c.id = 0;
			c.players = [];
		};
		c.timer = setInterval(function() {
			if (!run) {
				c.close();
			}
		}, 200);
	}
	const start = Date.now();
	while (c.ws && c.ws.readyState === WebSocket.CONNECTING && run && Date.now() - start < 10000) {
		await new Promise(resolve => setTimeout(resolve, 10));
	}
	if (!c.ws || c.ws.readyState !== WebSocket.OPEN) {
		return 0;
	}
	c.rooms = null;
	c.roomsDone = false;
	c.ws.send(JSON.stringify({t: 'rooms', cid: cid}));
	while (!c.roomsDone && c.ws && run && Date.now() - start < 10000) {
		await new Promise(resolve => setTimeout(resolve, 10));
	}
	if (!c.roomsDone || !c.rooms) {
		return 0;
	}
	ret.v = _netRoomList(c.rooms);
	return 0;
};

// netClose(): nobody else may enter the room, even when a seat is free or
// becomes free. Returns 1 when it was done.
ScriptExec.lib['netclose'] = function(ei, param, ret) {
	_netSetInt(ret, 0);
	const c = _netCurrent();
	if (!c || c.ws.readyState !== WebSocket.OPEN) {
		return 0;
	}
	c.ws.send(JSON.stringify({t: 'close'}));
	ret.v.num = 1;
	return 0;
};

// netLeave(): leaves the room.
ScriptExec.lib['netleave'] = function(ei, param, ret) {
	_netSetInt(ret, 0);
	if (ScriptExec.lib['$net']) {
		ScriptExec.lib['$net'].close();
	}
	return 0;
};

// netId(): this player's number, 0 when not in a room.
ScriptExec.lib['netid'] = function(ei, param, ret) {
	const c = _netCurrent();
	_netSetInt(ret, c ? c.id : 0);
	return 0;
};

// netRoom(): the name of the room ("" when not in one).
ScriptExec.lib['netroom'] = function(ei, param, ret) {
	const c = _netCurrent();
	ret.v = {type: TYPE_STRING, str: c ? c.room : ''};
	return 0;
};

// netCount(): how many players are in the room, this one included.
ScriptExec.lib['netcount'] = function(ei, param, ret) {
	const c = _netCurrent();
	_netSetInt(ret, c ? c.players.length : 0);
	return 0;
};

// netPlayers(): the numbers of the players in the room, in order.
ScriptExec.lib['netplayers'] = function(ei, param, ret) {
	const c = _netCurrent();
	ret.v = {type: TYPE_ARRAY, array: (c ? c.players : []).map(function(n) {
		return {name: '', v: _netInt(n)};
	})};
	return 0;
};

// netSend(value, to = all): sends value to the other players (or to player
// to only). Returns 1 when it was sent.
ScriptExec.lib['netsend'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	_netSetInt(ret, 0);
	const c = _netCurrent();
	if (!c || c.ws.readyState !== WebSocket.OPEN) {
		return 0;
	}
	const msg = {t: 'send', d: _netValue(param[0].v, 0)};
	if (param.length > 1) {
		msg.to = parseInt(param[1].v.type === TYPE_STRING ? ScriptExec.stringToNumber(param[1].v.str) : param[1].v.num) || 0;
	}
	const text = JSON.stringify(msg);
	if (c.limits.bytes && _netBytes(text) > c.limits.bytes) {
		c.warn('size', _netText('NET_ERROR_SIZE', 'netSend: the value is too large to send (up to {bytes} bytes).', {bytes: c.limits.bytes}));
		return 0;
	}
	c.ws.send(text);
	ret.v.num = 1;
	return 0;
};

// netAvailable(): how many received values are waiting for netReceive().
ScriptExec.lib['netavailable'] = function(ei, param, ret) {
	const c = ScriptExec.lib['$net'];
	_netSetInt(ret, c ? c.queue.length : 0);
	return 0;
};

// netReceive(): the oldest received value as {"from": player, "data": value},
// or 0 when nothing is waiting.
ScriptExec.lib['netreceive'] = function(ei, param, ret) {
	const c = ScriptExec.lib['$net'];
	const m = c ? c.queue.shift() : null;
	if (!m) {
		_netSetInt(ret, 0);
		return 0;
	}
	ret.v = {type: TYPE_ARRAY, array: [
		{name: 'from', v: _netInt(m.from)},
		{name: 'data', v: _netValue(m.v, 0)},
	]};
	return 0;
};

// netLast(player): the last value received from that player (0 when none),
// whether or not it was taken with netReceive().
ScriptExec.lib['netlast'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	const c = ScriptExec.lib['$net'];
	const from = parseInt(param[0].v.type === TYPE_STRING ? ScriptExec.stringToNumber(param[0].v.str) : param[0].v.num) || 0;
	ret.v = (c && c.last[from]) ? _netValue(c.last[from], 0) : _netInt(0);
	return 0;
};
