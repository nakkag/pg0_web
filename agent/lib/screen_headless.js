"use strict";
// Headless implementation of lib/screen.pg0 for the agent API.
// Loaded into the interpreter sandbox instead of public/dev/lib/screen.js.
// Drawing calls are recorded (optionally) instead of drawn, sleep() advances a
// virtual clock without waiting, and inTouch()/inKey() answer from timelines
// supplied in the run request. Argument handling mirrors screen.js.

function __screenOpt(param, index, key, type) {
	if (param.length <= index || param[index].v.type !== TYPE_ARRAY) {
		return undefined;
	}
	const tmp_key = key.toLowerCase();
	const vi = param[index].v.array.find(function(v) {
		return v.name !== '' && tmp_key === v.name.toLowerCase();
	});
	if (!vi) {
		return undefined;
	}
	if (type === 'num') {
		return (vi.v.type === TYPE_INTEGER || vi.v.type === TYPE_FLOAT) ? vi.v.num : undefined;
	}
	if (type === 'str') {
		return vi.v.type === TYPE_STRING ? vi.v.str : undefined;
	}
	return vi;
}

function __screenToJson(v, depth) {
	depth = depth || 0;
	if (!v || depth > 16) {
		return null;
	}
	switch (v.type) {
	case TYPE_INTEGER:
	case TYPE_FLOAT:
		return (typeof v.num === 'number' && isFinite(v.num)) ? v.num : 0;
	case TYPE_STRING:
		return v.str || '';
	case TYPE_ARRAY: {
		const arr = v.array || [];
		if (arr.some(function(a) { return a && a.name; })) {
			const obj = Object.create(null);
			arr.forEach(function(a, i) {
				obj[(a && a.name) ? a.name : String(i)] = __screenToJson(a && a.v, depth + 1);
			});
			return obj;
		}
		return arr.map(function(a) { return __screenToJson(a && a.v, depth + 1); });
	}
	}
	return null;
}

function __screenRecord(name, param) {
	__host.screen.record(name, param.map(function(p) { return __screenToJson(p.v); }));
}

function __screenNumber(p) {
	switch (p.v.type) {
	case TYPE_ARRAY:
		return parseInt(ScriptExec.stringToNumber(ScriptExec.arrayToString(p.v.array)));
	case TYPE_STRING:
		return parseInt(ScriptExec.stringToNumber(p.v.str));
	default:
		return parseInt(p.v.num);
	}
}

function __screenInt(name, value) {
	const vi = ScriptExec.initValueInfo();
	vi.name = name;
	vi.v.type = TYPE_INTEGER;
	vi.v.num = value;
	return vi;
}

ScriptExec.lib['startscreen'] = async function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	const w = param[0].v.num > 0 ? param[0].v.num : 1;
	const h = param[1].v.num > 0 ? param[1].v.num : 1;
	const color = __screenOpt(param, 2, 'color', 'str');
	const fit = __screenOpt(param, 2, 'fit', 'num');
	__host.screen.start(w, h, color === undefined ? null : color, fit === undefined ? 1 : fit);
	__screenRecord('startScreen', param);
	return 0;
};

ScriptExec.lib['sleep'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let time = __screenNumber(param[0]);
	if (isNaN(time) || time < 0) {
		time = 0;
	}
	__host.screen.sleep(time);
	return 0;
};

ScriptExec.lib['time'] = function(ei, param, ret) {
	ret.v.type = TYPE_FLOAT;
	ret.v.num = __host.screen.time();
	return 0;
};

ScriptExec.lib['timestring'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let time = __screenNumber(param[0]);
	if (isNaN(time)) {
		time = 0;
	}
	const date = new Date(time);
	if (param.length === 1) {
		ret.v.type = TYPE_STRING;
		ret.v.str = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
		return 0;
	}
	let format = ScriptExec.getValueString(param[1].v);
	format = format.replace(/YYYY/g, date.getFullYear());
	format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
	format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
	format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
	format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
	format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
	format = format.replace(/M/g, date.getMonth() + 1);
	format = format.replace(/D/g, date.getDate());
	format = format.replace(/h/g, date.getHours());
	format = format.replace(/m/g, date.getMinutes());
	format = format.replace(/s/g, date.getSeconds());
	ret.v.type = TYPE_STRING;
	ret.v.str = format;
	return 0;
};

ScriptExec.lib['startoffscreen'] = async function(ei, param, ret) {
	__host.screen.offscreen(1);
	__screenRecord('startOffscreen', param);
	return 0;
};

ScriptExec.lib['endoffscreen'] = async function(ei, param, ret) {
	__host.screen.offscreen(0);
	__screenRecord('endOffscreen', param);
	return 0;
};

ScriptExec.lib['startmask'] = async function(ei, param, ret) {
	__screenRecord('startMask', param);
	return 0;
};

ScriptExec.lib['endmask'] = async function(ei, param, ret) {
	__screenRecord('endMask', param);
	return 0;
};

ScriptExec.lib['clearrect'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	__screenRecord('clearRect', param);
	return 0;
};

ScriptExec.lib['drawline'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	__screenRecord('drawLine', param);
	return 0;
};

ScriptExec.lib['drawrect'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	__screenRecord('drawRect', param);
	return 0;
};

ScriptExec.lib['drawcircle'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	__screenRecord('drawCircle', param);
	return 0;
};

ScriptExec.lib['drawpolyline'] = async function(ei, param, ret) {
	if (param.length < 1 || param[0].v.type !== TYPE_ARRAY) {
		return -2;
	}
	__screenRecord('drawPolyline', param);
	return 0;
};

ScriptExec.lib['drawfill'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	__screenRecord('drawFill', param);
	return 0;
};

ScriptExec.lib['drawscroll'] = async function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	__screenRecord('drawScroll', param);
	return 0;
};

ScriptExec.lib['createimage'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	const w = param[2].v.num;
	const h = param[3].v.num;
	const id = __screenOpt(param, 4, 'id', 'num');
	ret.v.type = TYPE_INTEGER;
	ret.v.num = __host.screen.createImage(w, h, id === undefined ? -1 : parseInt(id));
	__screenRecord('createImage', param);
	return 0;
};

ScriptExec.lib['drawimage'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	const index = parseInt(param[0].v.num);
	if (!__host.screen.hasImage(index)) {
		return 0;
	}
	__screenRecord('drawImage', param);
	return 0;
};

ScriptExec.lib['drawtext'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	__screenRecord('drawText', param);
	return 0;
};

function __screenTextSize(text, fontSize, fontFace) {
	// Approximation of the browser's ink bounding box: leading and trailing spaces have no ink,
	// so they are not counted, and text without ink measures 0 x 0. Inner characters count
	// 0.55 (0.6 for monospace) of the font size per ASCII character, full width otherwise.
	const inked = String(text).replace(/^[ \t]+|[ \t]+$/g, '');
	if (inked === '') {
		return {width: 0, height: 0};
	}
	const narrow = /monospace|courier|consolas|menlo|monaco/i.test(fontFace || '') ? 0.6 : 0.55;
	let width = 0;
	for (const ch of inked) {
		width += (ch.codePointAt(0) < 0x2e80) ? fontSize * narrow : fontSize;
	}
	return {width: Math.round(width), height: Math.round(fontSize)};
}

ScriptExec.lib['measuretext'] = async function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let text = '';
	if (param[0].v.type === TYPE_ARRAY) {
		text = '{' + pg0_string.arrayToString(param[0].v.array) + '}';
	} else {
		text = ScriptExec.getValueString(param[0].v);
	}
	let fontSize = __screenOpt(param, 1, 'fontsize', 'num');
	if (fontSize === undefined) {
		fontSize = 30;
	}
	const size = __screenTextSize(text, fontSize, __screenOpt(param, 1, 'fontface', 'str'));
	ret.v.array = [__screenInt('width', size.width), __screenInt('height', size.height)];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['rgbtopoint'] = async function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	const rgb = __host.screen.pixel();
	ret.v.array = [__screenInt('r', rgb[0]), __screenInt('g', rgb[1]), __screenInt('b', rgb[2])];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['rgbtohex'] = async function(ei, param, ret) {
	if (param.length === 0 || param[0].v.type !== TYPE_ARRAY || param[0].v.array.length < 3) {
		return -2;
	}
	let r = 0, g = 0, b = 0;
	if (!param[0].v.array[0].name) {
		r = param[0].v.array[0].v.num;
		g = param[0].v.array[1].v.num;
		b = param[0].v.array[2].v.num;
	} else {
		r = __screenOpt(param, 0, 'r', 'num') || 0;
		g = __screenOpt(param, 0, 'g', 'num') || 0;
		b = __screenOpt(param, 0, 'b', 'num') || 0;
	}
	ret.v.type = TYPE_STRING;
	ret.v.str = '#' + [r, g, b].map(function(value) {
		return ('0' + parseInt(value).toString(16)).slice(-2);
	}).join('');
	return 0;
};

ScriptExec.lib['hextorgb'] = async function(ei, param, ret) {
	if (param.length === 0 || param[0].v.type !== TYPE_STRING) {
		return -2;
	}
	let hex = param[0].v.str;
	if (hex[0] === '#') {
		hex = hex.slice(1);
	}
	let rr, gg, bb;
	if (hex.length === 3) {
		rr = hex[0] + hex[0];
		gg = hex[1] + hex[1];
		bb = hex[2] + hex[2];
	} else {
		rr = hex[0] + hex[1];
		gg = hex[2] + hex[3];
		bb = hex[4] + hex[5];
	}
	const conv = function(s) {
		const n = parseInt(s, 16);
		return isNaN(n) ? 0 : n;
	};
	ret.v.array = [__screenInt('r', conv(rr)), __screenInt('g', conv(gg)), __screenInt('b', conv(bb))];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['intouch'] = async function(ei, param, ret) {
	const t = __host.screen.touch();
	const pos = ScriptExec.initValueInfo();
	pos.name = 'pos';
	pos.v.type = TYPE_ARRAY;
	pos.v.array = [];
	delete pos.v.num;
	t.pos.forEach(function(p) {
		const mm = ScriptExec.initValueInfo();
		mm.v.type = TYPE_ARRAY;
		mm.v.array = [__screenInt('x', p.x), __screenInt('y', p.y)];
		delete mm.v.num;
		pos.v.array.push(mm);
	});
	ret.v.array = [__screenInt('x', t.x), __screenInt('y', t.y), __screenInt('touch', t.touch), __screenInt('button', t.button), pos];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['inkey'] = async function(ei, param, ret) {
	const keys = __host.screen.keys();
	if (param.length === 0) {
		ret.v.array = [];
		ret.v.type = TYPE_ARRAY;
		keys.forEach(function(key) {
			const vi = ScriptExec.initValueInfo();
			vi.v.type = TYPE_STRING;
			vi.v.str = key;
			delete vi.v.num;
			ret.v.array.push(vi);
		});
		return 0;
	}
	if (param[0].v.type === TYPE_ARRAY) {
		// Same as the browser library: names given in an array must already be lower case.
		const missing = param[0].v.array.some(function(a) {
			const text = ScriptExec.getValueString(a.v);
			return !keys.some(function(key) { return key.toLowerCase() === text; });
		});
		ret.v.type = TYPE_INTEGER;
		ret.v.num = missing ? 0 : 1;
	} else {
		const text = ScriptExec.getValueString(param[0].v).toLowerCase();
		ret.v.type = TYPE_INTEGER;
		ret.v.num = keys.some(function(key) { return key.toLowerCase() === text; }) ? 1 : 0;
	}
	return 0;
};

ScriptExec.lib['playsound'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	__screenRecord('playSound', param);
	return 0;
};

ScriptExec.lib['playmusic'] = async function(ei, param, ret) {
	if (param.length < 1 || param[0].v.type !== TYPE_ARRAY) {
		return -2;
	}
	__screenRecord('playMusic', param);
	return 0;
};

ScriptExec.lib['stopsound'] = async function(ei, param, ret) {
	__screenRecord('stopSound', param);
	return 0;
};

ScriptExec.lib['bgm'] = async function(ei, param, ret) {
	__screenRecord('bgm', param);
	return 0;
};
