"use strict";

const settingView = (function () {
	const me = {};

	me.storageKey = 'pg0_option';

	me.load = function() {
		const str = localStorage.getItem(me.storageKey);
		if (str) {
			const op = JSON.parse(str);
			options.execMode = (op.execMode !== undefined) ? op.execMode : options.execMode;
			options.execSpeed = (op.execSpeed !== undefined) ? op.execSpeed : options.execSpeed;
			options.fontSize = (op.fontSize !== undefined) ? op.fontSize : options.fontSize;
			options.showLineNum = (op.showLineNum !== undefined) ? op.showLineNum : options.showLineNum;
			options.boundary = (op.boundary !== undefined) ? op.boundary : options.boundary;
			return true;
		}
		return false;
	};
	me.save = function() {
		localStorage.setItem(me.storageKey, JSON.stringify(options));
	};

	const keyEvent = function(e) {
		if (e.key === 'Escape' && document.getElementById('modal-overlay')) {
			me.close();
		}
	};
	me.show = function() {
		if (document.getElementById('modal-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'modal-overlay');
		modal.addEventListener('click', function(e) {
			me.close();
		}, false);
		document.body.append(modal);
		document.getElementById('setting').style.display = 'block';

		document.getElementById('setting-mode').value = options.execMode;
		document.getElementById('setting-font').value = options.fontSize;
		document.getElementById('setting-linenum').checked = options.showLineNum;
		document.addEventListener('keydown', keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('setting').style.display = 'none';
		document.removeEventListener('keydown', keyEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('setting-mode-title').textContent = resource.SETTING_MODE_TITLE;
		for (let key in resource.SETTING_MODE) {
			const op = document.createElement('option');
			op.value = key;
			op.textContent = resource.SETTING_MODE[key];
			document.getElementById('setting-mode').append(op);
		}
		document.getElementById('setting-font-title').textContent = resource.SETTING_FONT_SIZE_TITLE;
		for (let key in resource.SETTING_FONT_SIZE) {
			const op = document.createElement('option');
			op.value = key;
			op.textContent = resource.SETTING_FONT_SIZE[key];
			document.getElementById('setting-font').append(op);
		}
		document.getElementById('setting-linenum-title').textContent = resource.SETTING_LINENUM_TITLE;

		document.querySelector('#setting .close').addEventListener('click', function(e) {
			me.close();
		}, false);

		document.getElementById('setting').addEventListener('change', function(e) {
			options.execMode = document.getElementById('setting-mode').value;
			options.fontSize = document.getElementById('setting-font').value;
			options.showLineNum = document.getElementById('setting-linenum').checked;
			me.save();
			// Notify main event
			document.dispatchEvent(new CustomEvent('setting_change'));
		}, false);
	}, false);

	return me;
})();

const messageView = (function () {
	const me = {};

	me.callback = null;

	const keyEvent = function(e) {
		if (e.key === 'Escape' && document.getElementById('modal-overlay')) {
			me.close();
		}
	};
	me.show = function(msg) {
		if (document.getElementById('modal-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'modal-overlay');
		document.body.append(modal);
		document.getElementById('message-text').innerHTML = msg;
		document.querySelector('#message #yes').value = resource.DIALOG_YES;
		document.querySelector('#message #no').value = resource.DIALOG_NO;
		document.getElementById('message').style.display = 'block';
		document.addEventListener('keydown', keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('message').style.display = 'none';
		document.removeEventListener('keydown', keyEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.querySelector('#message #yes').addEventListener('click', function(e) {
			if (me.callback) {
				me.callback();
			}
			me.close();
		}, false);
		document.querySelector('#message #no').addEventListener('click', function(e) {
			me.close();
		}, false);
	}, false);

	return me;
})();

const onlineOpenView = (function () {
	const me = {};

	const keyEvent = function(e) {
		if (e.key === 'Escape' && document.getElementById('modal-overlay')) {
			me.close();
		}
	};
	me.show = function() {
		if (document.getElementById('modal-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'modal-overlay');
		modal.addEventListener('click', function(e) {
			me.close();
		}, false);
		document.body.append(modal);
		document.getElementById('online-open').style.display = 'block';
		document.addEventListener('keydown', keyEvent, false);

		document.getElementById('online-open-list').innerHTML = '';
		for (let i = 0; i < 30; i++) {
			const nameNode = document.createElement('div');
			nameNode.classList.add('file-item');
			nameNode.tabIndex = 0;
			nameNode.innerHTML = '<span class="file-name">' + 'test ' + i + '</span>';
			document.getElementById('online-open-list').appendChild(nameNode);
		}
		document.addEventListener('click', function(e) {
			if (e.target.classList.contains('file-item')) {
				const filename = e.target.querySelector('.file-name').textContent;
				ev.setText("cnt = 0\ni = 1\nwhile (i <= 100) {\n\tcnt = cnt + i\n\ti = i + 1\n}\nexit cnt", filename);
				ev.currentContent.onlineId = 'oldId';
				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				me.close();
			}
		}, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-open').style.display = 'none';
		document.removeEventListener('keydown', keyEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.querySelector('#online-open .close').addEventListener('click', function(e) {
			me.close();
		}, false);
	}, false);

	return me;
})();

const onlineSaveView = (function () {
	const me = {};

	const keyEvent = function(e) {
		if (e.key === 'Escape' && document.getElementById('modal-overlay')) {
			me.close();
		}
	};
	me.show = function() {
		if (document.getElementById('modal-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'modal-overlay');
		modal.addEventListener('click', function(e) {
			me.close();
		}, false);
		document.body.append(modal);
		document.getElementById('online-save').style.display = 'block';
		document.getElementById('online-save-file').value = ev.currentContent.name || 'script.pg0';
		if (ev.currentContent.password) {
			document.getElementById('online-save-password').value = ev.currentContent.password;
		}
		if (ev.currentContent.onlineId) {
			document.getElementById('online-save-overwrite').checked = true;
			document.getElementById('online-save-overwrite').parentElement.style.display = 'block';
		} else {
			document.getElementById('online-save-overwrite').checked = false;
			document.getElementById('online-save-overwrite').parentElement.style.display = 'none';
		}
		document.addEventListener('keydown', keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-save').style.display = 'none';
		document.removeEventListener('keydown', keyEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('online-save-file-title').textContent = resource.ONLINE_SAVE_FILE_TITLE;
		document.getElementById('online-save-password-title').textContent = resource.ONLINE_SAVE_PASSWORD_TITLE;
		document.getElementById('online-save-overwrite-title').textContent = resource.ONLINE_SAVE_OVERWRITE_TITLE;
		document.getElementById('online-save-button').value = resource.ONLINE_SAVE_BUTTON;

		document.querySelector('#online-save .close').addEventListener('click', function(e) {
			me.close();
		}, false);

		document.querySelector('#online-save-button').addEventListener('click', function(e) {
			const filename = document.getElementById('online-save-file').value;
			const password = document.getElementById('online-save-password').value;
			if (!filename || !password) {
				return;
			}
			ev.currentContent.name = filename;
			ev.currentContent.password = password;
			if (!ev.currentContent.onlineId || !document.getElementById('online-save-overwrite').checked) {
				ev.currentContent.onlineId = 'newId';
			}
			//ev.getText()
			// Notify main event
			document.dispatchEvent(new CustomEvent('setting_change'));
			me.close();
		}, false);
	}, false);

	return me;
})();
