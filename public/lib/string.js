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
	ret.v.num = str_match(ptn, str, 0, 0) ? 1 : 0;
	ret.v.type = TYPE_INTEGER;
	return 0;
};

function str_match(ptn, str, ip, is) {
	if (ptn.length <= ip) {
		return (str.length <= is);
	}
	switch (ptn.slice(ip, ip + 1)) {
	case '*':
		if (ptn.length <= ip + 1) {
			return true;
		}
		if (str_match(ptn, str, ip + 1, is)) {
			return true;
		}
		while (str.length > is) {
			is++;
			if (str_match(ptn, str, ip + 1, is)) {
				return true;
			}
		}
		return false;
	case '?':
		return (str.length > is) && str_match(ptn, str, ip + 1, is + 1);
	default:
		while (ptn.slice(ip, ip + 1).toLowerCase() === str.slice(is, is + 1).toLowerCase()) {
			if (ptn.length <= ip) {
				return true;
			}
			ip++;
			is++;
			if (ptn.slice(ip, ip + 1) === '*' || ptn.slice(ip, ip + 1) === '?') {
				return str_match(ptn, str, ip, is);
			}
		}
		return false;
	}
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
	let begin = param[1].v.num;
	if (begin < 0) {
		begin = str.length + begin;
	}
	let length = -1;
	if (param.length >= 3) {
		length = param[2].v.num;
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
		from = param[2].v.num;
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
