"use strict";

ScriptExec.lib['trim'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	if (param[0].v.type === TYPE_ARRAY) {
		ret.v.str = ScriptExec.arrayToString(param[0].v.array).trim();
	} else {
		ret.v.str = ScriptExec.getValueString(param[0].v).trim();
	}
	ret.v.type = TYPE_STRING;
	delete ret.v.num;
	return 0;
};

ScriptExec.lib['to_lower'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	if (param[0].v.type === TYPE_ARRAY) {
		ret.v.str = ScriptExec.arrayToString(param[0].v.array).toLowerCase();
	} else {
		ret.v.str = ScriptExec.getValueString(param[0].v).toLowerCase();
	}
	ret.v.type = TYPE_STRING;
	delete ret.v.num;
	return 0;
};

ScriptExec.lib['to_upper'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	if (param[0].v.type === TYPE_ARRAY) {
		ret.v.str = ScriptExec.arrayToString(param[0].v.array).toUpperCase();
	} else {
		ret.v.str = ScriptExec.getValueString(param[0].v).toUpperCase();
	}
	ret.v.type = TYPE_STRING;
	delete ret.v.num;
	return 0;
};

ScriptExec.lib['str_match'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let ptn = '';
	if (param[0].v.type === TYPE_ARRAY) {
		ptn = ScriptExec.arrayToString(param[0].v.array);
	} else {
		ptn = ScriptExec.getValueString(param[0].v);
	}
	let str = '';
	if (param[1].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[1].v.array);
	} else {
		str = ScriptExec.getValueString(param[1].v);
	}
	ret.v.num = str_match(ptn, str) ? 1 : 0;
	ret.v.type = TYPE_INTEGER;
	return 0;
};

// Wild card match ("*" any string, "?" any character). After a mismatch it goes
// back to the last "*" only, which then takes one more character.
function str_match(ptn, str) {
	let ip = 0;
	let is = 0;
	let star = -1;
	let mark = 0;
	while (is < str.length) {
		if (ip < ptn.length && ptn[ip] === '*') {
			star = ip++;
			mark = is;
		} else if (ip < ptn.length && (ptn[ip] === '?' || ptn[ip].toLowerCase() === str[is].toLowerCase())) {
			ip++;
			is++;
		} else if (star >= 0) {
			ip = star + 1;
			is = ++mark;
		} else {
			return false;
		}
	}
	while (ip < ptn.length && ptn[ip] === '*') {
		ip++;
	}
	return ptn.length <= ip;
}

ScriptExec.lib['substring'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[0].v.array);
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	let begin = _stringInt(param[1]);
	if (begin < 0) {
		begin = str.length + begin;
	}
	let length = -1;
	if (param.length >= 3) {
		length = _stringInt(param[2]);
	}
	if (length < 0) {
		ret.v.str = str.substring(begin);
	} else {
		ret.v.str = str.substring(begin, begin + length);
	}
	ret.v.type = TYPE_STRING;
	return 0;
};

ScriptExec.lib['in_string'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[0].v.array);
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	let search = '';
	if (param[1].v.type === TYPE_ARRAY) {
		search = ScriptExec.arrayToString(param[1].v.array);
	} else {
		search = ScriptExec.getValueString(param[1].v);
	}
	let from = 0;
	if (param.length >= 3) {
		from = _stringInt(param[2]);
	}
	ret.v.num = str.indexOf(search, from);
	ret.v.type = TYPE_INTEGER;
	return 0;
};

ScriptExec.lib['split'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[0].v.array);
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	let search = '';
	if (param[1].v.type === TYPE_ARRAY) {
		search = ScriptExec.arrayToString(param[1].v.array);
	} else {
		search = ScriptExec.getValueString(param[1].v);
	}
	ret.v.array = [];
	let i = 0;
	str.split(search).forEach(function(s) {
		const vi = ScriptExec.initValueInfo();
		vi.v.type = TYPE_STRING;
		vi.v.str = s;
		delete vi.v.num;
		ret.v.array[i++] = vi;
	});
	ret.v.type = TYPE_ARRAY;
	delete ret.v.num;
	return 0;
};

// Integer value of a parameter (strings and arrays are converted like numbers)
function _stringInt(p) {
	let n = p.v.num;
	if (p.v.type === TYPE_STRING) {
		n = ScriptExec.stringToNumber(p.v.str);
	} else if (p.v.type === TYPE_ARRAY) {
		n = ScriptExec.stringToNumber(ScriptExec.arrayToString(p.v.array));
	}
	return Math.trunc(n) || 0;
}
