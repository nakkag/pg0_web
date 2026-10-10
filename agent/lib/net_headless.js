"use strict";

// lib/net.pg0 for runs through the API: there is no network, so a program
// runs as if the server could not be reached (netJoin returns 0).

function _netInt(ret, n) {
	ret.v = {type: TYPE_INTEGER, num: n};
}

ScriptExec.lib['netjoin'] = function(ei, param, ret) {
	__host.error('netJoin: runs through the API have no network; it returns 0 as if the server could not be reached.');
	_netInt(ret, 0);
	return 0;
};
ScriptExec.lib['netleave'] = function(ei, param, ret) {
	_netInt(ret, 0);
	return 0;
};
ScriptExec.lib['netid'] = ScriptExec.lib['netleave'];
ScriptExec.lib['netclose'] = ScriptExec.lib['netleave'];
ScriptExec.lib['netcount'] = ScriptExec.lib['netleave'];
ScriptExec.lib['netavailable'] = ScriptExec.lib['netleave'];
ScriptExec.lib['netreceive'] = ScriptExec.lib['netleave'];
ScriptExec.lib['netroom'] = function(ei, param, ret) {
	ret.v = {type: TYPE_STRING, str: ''};
	return 0;
};
ScriptExec.lib['netplayers'] = function(ei, param, ret) {
	ret.v = {type: TYPE_ARRAY, array: []};
	return 0;
};
ScriptExec.lib['netsend'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	_netInt(ret, 0);
	return 0;
};
ScriptExec.lib['netlast'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	_netInt(ret, 0);
	return 0;
};
