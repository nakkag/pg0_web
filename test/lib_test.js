
ScriptExec.lib['debug'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	document.getElementById('result').innerHTML += '<p style="color:#808080;">' + escapeHTML(str) + '</p>';
	return 0;
}
