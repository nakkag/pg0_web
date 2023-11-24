
const pg0_string = (function () {
	const me = {};

	me.escapeHTML = function(str) {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	};

	me.arrayToString = function(array) {
		let ret = '';
		array.forEach(function(a) {
			if (ret) {
				ret = ret + ', ';
			}
			if (a.name) {
				ret += '"' + a.name + '": ';
			}
			if (a.v.type === TYPE_ARRAY) {
				ret += '{' + me.arrayToString(a.v.array) + '}';
			} else if (a.v.type === TYPE_STRING) {
				ret += '"' + ScriptExec.getValueString(a.v) + '"';
			} else {
				ret += ScriptExec.getValueString(a.v);
			}
		});
		return ret;
	};

	return me;
})();
