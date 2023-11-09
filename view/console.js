const consoleView = (function () {
	const me = {};

	me.toBottom = function() {
		const containerObj = document.getElementById('console_container');
		containerObj.scrollTop = containerObj.scrollHeight - containerObj.clientHeight;
	};

	me.fixBottom = function(callback) {
		const consoleObj = document.getElementById('console');
		const containerObj = document.getElementById('console_container');
		const _toBottom = containerObj.scrollTop + containerObj.clientHeight >= consoleObj.offsetHeight;
		callback();
		if (_toBottom) {
			me.toBottom();
		}
	};
	
	me.put = function(msg) {
		me.fixBottom(function() {
			document.getElementById('console').innerHTML += msg;
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
		me.put(msg);
	};

	return me;
})();
