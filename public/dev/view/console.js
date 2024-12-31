"use strict";

function consoleView(console) {
	const that = this;
	const consoleContainer = console.parentNode;

	this.toBottom = function() {
		consoleContainer.scrollTop = consoleContainer.scrollHeight - consoleContainer.clientHeight;
	};

	this.fixBottom = function(callback) {
		const _toBottom = consoleContainer.scrollTop + consoleContainer.clientHeight >= console.offsetHeight;
		callback();
		if (_toBottom) {
			that.toBottom();
		}
	};

	this.put = function(msg) {
		that.fixBottom(function() {
			let str = msg.replace(/\\n/g, '<br />');
			str = str.replace(/\\r/g, '');
			str = str.replace(/\\t/g, '\t');
			str = str.replace(/\\b/g, '\b');
			console.innerHTML += str;
		});
	};

	this.info = function(msg, detail) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="info">${msg}</span>`;
		if (detail) {
			msg += ' ' + detail;
		}
		msg += '</div>';
		that.put(msg);
	};

	this.error = function(msg) {
		const time = date_format.formatTime(new Date(), navigator.language);
		msg = `<div><span class="time">${time}</span> <span class="error">${msg}</span></div>`;
		that.fixBottom(function() {
			console.innerHTML += msg;
		});
	};

	this.clear = function() {
		console.innerHTML = '';
	};
}