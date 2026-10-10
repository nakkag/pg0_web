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

function _netUrl() {
	const base = new URL((typeof apiServer === 'string' && apiServer) ? apiServer : location.href, location.href);
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

function _netSetInt(ret, n) {
	ret.v = _netInt(n);
}

// One connection to the relay and what it has received.
function _netConnection() {
	const me = {ws: null, result: '', id: 0, room: '', max: 0, players: [], queue: [], last: {}, limits: {bytes: 16384, rate: 60}, warned: {}, timer: null};
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
			c.ws.send(JSON.stringify({t: 'join', cid: cid, room: room, max: max}));
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
				full: ['NET_ERROR_FULL', 'netJoin: room "{room}" is full.'],
				busy: ['NET_ERROR_BUSY', 'netJoin: the server is busy. Try again later.'],
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
	if (c.limits.bytes && text.length > c.limits.bytes) {
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
