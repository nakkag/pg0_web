"use strict";

ScriptExec.lib['abs'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.abs(param[0].v.num);
	ret.v.type = param[0].v.type;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['atan'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.atan(param[0].v.num);
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['cos'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.cos(param[0].v.num);
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['exp'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.exp(param[0].v.num);
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['log'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.log(param[0].v.num);
	if (ret.v.num === -Infinity) {
		throw new Error('-Infinity');
	}
	if (isNaN(ret.v.num)) {
		throw new Error('Not a Number');
	}
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

// random(seed) seeds a reproducible generator (mulberry32) and returns its first value;
// random() without a seed continues that sequence, or uses Math.random() when never seeded.
function _mathSeededRandom(seed) {
	let a = 0;
	const str = String(seed);
	for (let i = 0; i < str.length; i++) {
		a = (Math.imul(a, 31) + str.charCodeAt(i)) | 0;
	}
	return function() {
		a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

ScriptExec.lib['random'] = function(ei, param, ret) {
	if (param.length >= 1) {
		let seed;
		if (param[0].v.type === TYPE_STRING) {
			seed = param[0].v.str;
		} else if (param[0].v.type === TYPE_ARRAY) {
			seed = ScriptExec.arrayToString(param[0].v.array);
		} else {
			seed = param[0].v.num;
		}
		ScriptExec.lib['$random'] = _mathSeededRandom(seed);
	}
	ret.v.type = TYPE_FLOAT;
	ret.v.num = ScriptExec.lib['$random'] ? ScriptExec.lib['$random']() : Math.random();
	return 0;
};

ScriptExec.lib['sign'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.sign(param[0].v.num);
	ret.v.type = TYPE_INTEGER;
	return 0;
};

ScriptExec.lib['sin'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.sin(param[0].v.num);
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['sqrt'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.sqrt(param[0].v.num);
	if (isNaN(ret.v.num)) {
		throw new Error('Not a Number');
	}
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['tan'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = Math.tan(param[0].v.num);
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

ScriptExec.lib['pow'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	ret.v.num = Math.pow(param[0].v.num, param[1].v.num);
	if (isNaN(ret.v.num)) {
		throw new Error('Not a Number');
	}
	ret.v.type = TYPE_FLOAT;
	if (ScriptExec.checkInt(ret.v.num)) {
		ret.v.type = TYPE_INTEGER;
	}
	return 0;
};

function _mathNumbers(param) {
	const values = [];
	param.forEach(function(p) {
		if (p.v.type === TYPE_ARRAY) {
			p.v.array.forEach(function(a) {
				if (a.v.type === TYPE_INTEGER || a.v.type === TYPE_FLOAT) {
					values.push(a.v.num);
				} else if (a.v.type === TYPE_STRING) {
					values.push(ScriptExec.stringToNumber(a.v.str));
				}
			});
		} else if (p.v.type === TYPE_STRING) {
			values.push(ScriptExec.stringToNumber(p.v.str));
		} else {
			values.push(p.v.num);
		}
	});
	return values;
}

ScriptExec.lib['max'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	const values = _mathNumbers(param);
	ret.v.num = values.length ? Math.max.apply(null, values) : 0;
	ret.v.type = ScriptExec.checkInt(ret.v.num) ? TYPE_INTEGER : TYPE_FLOAT;
	return 0;
};

ScriptExec.lib['min'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	const values = _mathNumbers(param);
	ret.v.num = values.length ? Math.min.apply(null, values) : 0;
	ret.v.type = ScriptExec.checkInt(ret.v.num) ? TYPE_INTEGER : TYPE_FLOAT;
	return 0;
};

function _mathNumber(p) {
	if (p.v.type === TYPE_STRING) {
		return ScriptExec.stringToNumber(p.v.str);
	}
	if (p.v.type === TYPE_ARRAY) {
		return ScriptExec.stringToNumber(ScriptExec.arrayToString(p.v.array));
	}
	return p.v.num;
}

function _mathResult(ret, num, floatResult) {
	if (isNaN(num)) {
		throw new Error('Not a Number');
	}
	ret.v.num = num;
	ret.v.type = (!floatResult || ScriptExec.checkInt(num)) ? TYPE_INTEGER : TYPE_FLOAT;
	return 0;
}

ScriptExec.lib['floor'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	return _mathResult(ret, Math.floor(_mathNumber(param[0])), false);
};

ScriptExec.lib['ceil'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	return _mathResult(ret, Math.ceil(_mathNumber(param[0])), false);
};

ScriptExec.lib['round'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	return _mathResult(ret, Math.round(_mathNumber(param[0])), false);
};

ScriptExec.lib['hypot'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	return _mathResult(ret, Math.hypot(_mathNumber(param[0]), _mathNumber(param[1])), true);
};

ScriptExec.lib['atan2'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	return _mathResult(ret, Math.atan2(_mathNumber(param[0]), _mathNumber(param[1])), true);
};
