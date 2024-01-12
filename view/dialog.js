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
			options.author = op.author || '';
			options.keyword = op.keyword || '';
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
		if (!document.getElementById('modal-overlay')) {
			return;
		}
		if (e.key === 'Escape') {
			me.close();
		}
		if (e.key === 'Enter') {
			if (document.activeElement.id === 'online-open-search-text') {
				document.getElementById('online-open-search-button').click();
			} else if (document.activeElement.classList.contains('file-item')) {
				document.activeElement.click();
			}
		}
	};
	const openEvent = async function(e) {
		const item = e.target.closest('.file-item');
		if (item) {
			const id = item.getAttribute('id');
			try {
				const code = await (await fetch(apiServer + '/api/codes/item/' + id)).json();
				ev.setText(code.code, code.name);
				ev.currentContent.onlineId = id;
				ev.currentContent.author = code.author;
				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				me.close();
			} catch(e) {
				console.error(e);
			}
		}
	};
	me.show = async function() {
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
		document.getElementById('online-open').focus();
		document.getElementById('online-open-search-text').value = options.keyword || '';
		document.addEventListener('keydown', keyEvent, false);
		document.addEventListener('click', openEvent, false);

		document.getElementById('online-open-list').innerHTML = '';
		try {
			const keyword = document.getElementById('online-open-search-text').value;
			const codes = await (await fetch(apiServer + '/api/codes/' + encodeURIComponent(keyword))).json();
			if (codes) {
				codes.forEach((code) => {
					const nameNode = document.createElement('div');
					nameNode.classList.add('file-item');
					nameNode.tabIndex = 0;
					nameNode.setAttribute('id', code.id);
					let time = '';
					if (code.updateTime) {
						const date = new Date(code.updateTime);
						time = '(' + date_format.formatDate(date, navigator.language) + ' ' + date_format.formatTimeSec(date, navigator.language) + ')';
					}
					nameNode.innerHTML = '<div><span class="file-name">' + pg0_string.escapeHTML(code.name) + '</span></div>' +
						'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(code.author || '') + '</span></div>';
					document.getElementById('online-open-list').appendChild(nameNode);
				});
			}
		} catch(e) {
			console.error(e);
		}
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-open').style.display = 'none';
		document.removeEventListener('keydown', keyEvent, false);
		document.removeEventListener('click', openEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.querySelector('#online-open .close').addEventListener('click', function(e) {
			me.close();
		}, false);
		document.getElementById('online-open-search-button').addEventListener('click', async function(e) {
			document.getElementById('online-open-list').innerHTML = '';
			try {
				const keyword = document.getElementById('online-open-search-text').value;
				options.keyword = keyword;
				settingView.save();

				const codes = await (await fetch(apiServer + '/api/codes/' + encodeURIComponent(keyword))).json();
				if (codes) {
					codes.forEach((code) => {
						const nameNode = document.createElement('div');
						nameNode.classList.add('file-item');
						nameNode.tabIndex = 0;
						nameNode.setAttribute('id', code.id);
						let time = '';
						if (code.updateTime) {
							const date = new Date(code.updateTime);
							time = '(' + date_format.formatDate(date, navigator.language) + ' ' + date_format.formatTimeSec(date, navigator.language) + ')';
						}
						nameNode.innerHTML = '<div><span class="file-name">' + pg0_string.escapeHTML(code.name) + '</span></div>' +
							'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(code.author || '') + '</span></div>';
						document.getElementById('online-open-list').appendChild(nameNode);
					});
				}
			} catch(e) {
				console.error(e);
			}
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
		document.getElementById('online-save').focus();
		document.getElementById('online-save-file').value = ev.currentContent.name || '';
		document.getElementById('online-save-author').value = options.author || '';
		document.getElementById('online-save-password').value = ev.currentContent.password || '';
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
		document.getElementById('online-save-author-title').textContent = resource.ONLINE_SAVE_AUTHOR_TITLE;
		document.getElementById('online-save-password-title').textContent = resource.ONLINE_SAVE_PASSWORD_TITLE;
		document.getElementById('online-save-overwrite-title').textContent = resource.ONLINE_SAVE_OVERWRITE_TITLE;
		document.getElementById('online-save-button').value = resource.ONLINE_SAVE_BUTTON;

		document.querySelector('#online-save .close').addEventListener('click', function(e) {
			me.close();
		}, false);

		document.querySelector('#online-save-button').addEventListener('click', async function(e) {
			const filename = document.getElementById('online-save-file').value;
			const author = document.getElementById('online-save-author').value;
			const password = document.getElementById('online-save-password').value;
			if (!filename || !author || !password) {
				return;
			}
			const code = {
				name: filename,
				author: author,
				password: pg0_string.crc32(password),
				code: ev.getText(),
			};
			let method = 'POST';
			let url = apiServer + '/api/codes';
			if (ev.currentContent.onlineId && document.getElementById('online-save-overwrite').checked) {
				method = 'PUT';
				url = apiServer + '/api/codes/' + ev.currentContent.onlineId;
			}
			try {
				const res = await fetch(url, {
					method: method,
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(code),
				});
				switch (res.status) {
				case 200:
					ev.currentContent.modify = false;
					ev.currentContent.name = filename;
					ev.currentContent.author = author;
					ev.currentContent.password = password;
					if (method === 'POST') {
						const data = await res.json();
						ev.currentContent.onlineId = data.id;
					}
					ev.saveState();

					options.author = author;
					settingView.save();

					// Notify main event
					document.dispatchEvent(new CustomEvent('setting_change'));
					me.close();
					break;
				case 401:
					alert(res.statusText);
					break;
				case 404:
					alert(res.statusText);
					break;
				}
			} catch(e) {
				console.error(e);
			}
		}, false);
	}, false);

	return me;
})();
