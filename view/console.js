const consoleView = (function () {
	const me = {};

	me.put = function(msg) {
		const consoleObj = document.getElementById('console');
		const containerObj = document.getElementById('console_container');
		const toBottom = containerObj.scrollTop + containerObj.clientHeight >= consoleObj.offsetHeight;
		consoleObj.innerHTML += msg;
		if (toBottom) {
			containerObj.scrollTop = containerObj.scrollHeight - containerObj.clientHeight;
		}
	}

	me.info = function(msg, detail) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="info">${msg}</span>`;
		if (detail) {
			msg += ' ' + detail;
		}
		msg += '</div>';
		me.put(msg);
	}

	me.error = function(msg) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="error">${msg}</span></div>`;
		me.put(msg);
	}

	return me;
})();
