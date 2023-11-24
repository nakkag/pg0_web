"use strict";

const consoleView = (function () {
	const me = {};

	me.toBottom = function() {
		const container = document.getElementById('console_container');
		container.scrollTop = container.scrollHeight - container.clientHeight;
	};

	me.fixBottom = function(callback) {
		const console = document.getElementById('console');
		const container = document.getElementById('console_container');
		const _toBottom = container.scrollTop + container.clientHeight >= console.offsetHeight;
		callback();
		if (_toBottom) {
			me.toBottom();
		}
	};
	
	me.put = function(msg) {
		me.fixBottom(function() {
			let str = msg.replace(/\\n/g, '<br />');
			str = str.replace(/\\r/g, '');
			str = str.replace(/\\t/g, '\t');
			str = str.replace(/\\b/g, '\b');
			document.getElementById('console').innerHTML += str;
		});
	};

	me.info = function(msg, detail) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="info">${msg}</span>`;
		if (detail) {
			msg += ' ' + detail;
		}
		msg += '</div>';
		me.put(msg);
	};

	me.error = function(msg) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="error">${msg}</span></div>`;
		me.fixBottom(function() {
			document.getElementById('console').innerHTML += msg;
		});
	};

	return me;
})();
