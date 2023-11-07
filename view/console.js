const consoleView = (function () {
	const me = {};

	me.put = function(msg) {
		const consoleObj = document.getElementById('console');
		const wrapper = document.getElementById('console_wrapper');
		const toBottom = wrapper.scrollTop + wrapper.clientHeight >= consoleObj.offsetHeight;
		consoleObj.innerHTML += msg;
		if (toBottom) {
			wrapper.scrollTop = wrapper.scrollHeight - wrapper.clientHeight;
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
