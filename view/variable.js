"use strict";

const variableView = (function () {
	const me = {};

	me.set = function(ei) {
		if (!ei) {
			return;
		}
		me.set(ei.parent);
		let buf = '';
		for (let key in ei.vi) {
			const v = ei.vi[key];
			buf += pg0_string.escapeHTML(key) + ': ';
			if (v.type === TYPE_ARRAY) {
				buf += '{' + pg0_string.escapeHTML(pg0_string.arrayToString(v.array)) + '}'
			} else if (v.type === TYPE_STRING) {
				buf += '"' + pg0_string.escapeHTML(ScriptExec.getValueString(v)) + '"'
			} else {
				buf += pg0_string.escapeHTML(ScriptExec.getValueString(v));
			}
			buf += '<br />';
		}
		document.getElementById('variable').innerHTML += buf;
	};

	return me;
})();
