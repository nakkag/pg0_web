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

ScriptExec.lib['random'] = function(ei, param, ret) {
	ret.v.type = TYPE_FLOAT;
	ret.v.num = Math.random();
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
