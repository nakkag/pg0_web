"use strict";

function getId() {
	if (ev.currentContent.cid) {
		return 'cid_' + ev.currentContent.cid;
	} else if (ev.currentContent.name) {
		return 'name_' + ev.currentContent.cid;
	}
	return 'global';
}

ScriptExec.lib['save'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	let value = '';
	if (param[1].v.type === TYPE_ARRAY) {
		value = '{' + pg0_string.arrayToString(param[1].v.array) + '}'
	} else {
		value = ScriptExec.getValueString(param[1].v);
	}
	localStorage.setItem('pg0_' + getId() +  '_' + key, value);
	return 0;
};

ScriptExec.lib['load'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	ret.v.str = localStorage.getItem('pg0_' + getId() +  '_' + key);
	ret.v.type = TYPE_STRING;
	return 0;
};

ScriptExec.lib['valuetostring'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	ret.v.str = JSON.stringify(param[0].v);
	ret.v.type = TYPE_STRING;
	return 0;
};

ScriptExec.lib['stringtovalue'] = function(ei, param, ret) {
	if (param.length < 1 || param[0].v.type !== TYPE_STRING) {
		return -2;
	}
	ret.v = JSON.parse(param[0].v.str);
	return 0;
};
