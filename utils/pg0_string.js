"use strict";

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

	me.makeCRCTable = function() {
		var c;
		var crcTable = [];
		for(var n = 0; n < 256; n++){
			c = n;
			for(var k = 0; k < 8; k++){
				c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			crcTable[n] = c;
		}
		return crcTable;
	};

	var crcTable = null;
	me.crc32 = function(str) {
		if (!str) {
			return 0;
		}
		str = str.trim().toLowerCase();
		var crcTable = crcTable || (crcTable = me.makeCRCTable());
		var crc = 0 ^ (-1);
		for (var i = 0; i < str.length; i++ ) {
			crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
		}
		return (crc ^ (-1)) >>> 0;
	};

	return me;
})();
