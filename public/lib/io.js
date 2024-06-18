"use strict";

function _getIoId() {
	if (ev.currentContent.cid) {
		return 'cid_' + ev.currentContent.cid;
	} else if (ev.currentContent.name) {
		return 'name_' + ev.currentContent.cid;
	}
	return 'common';
}

ScriptExec.lib['savevalue'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	localStorage.setItem('pg0_' + _getIoId() +  '_' + key, JSON.stringify(param[1].v));
	return 0;
};

ScriptExec.lib['loadvalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	const str = localStorage.getItem('pg0_' + _getIoId() +  '_' + key);
	if (str) {
		ret.v = JSON.parse(str);
	}
	return 0;
};

ScriptExec.lib['removevalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	localStorage.removeItem('pg0_' + _getIoId() +  '_' + key);
	return 0;
};

ScriptExec.lib['get_clipboard'] = async function(ei, param, ret) {
	if (navigator.clipboard) {
		ret.v.str = await navigator.clipboard.readText();
		ret.v.type = TYPE_STRING;
		delete ret.v.num;
	}
	return 0;
};

ScriptExec.lib['set_clipboard'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = 0;
	ret.v.type = TYPE_INTEGER;

	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[0].v.array).toUpperCase();
	} else {
		str = ScriptExec.getValueString(param[0].v).toUpperCase();
	}
	if (navigator.clipboard) {
		navigator.clipboard.writeText(str);
		ret.v.num = 1;
	}
	return 0;
};
