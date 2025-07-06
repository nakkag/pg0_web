"use strict";

const listCount = 30;

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
			options.password = op.password || '';
			options.keyword = op.keyword || '';
			options.uuid = op.uuid || crypto.randomUUID();
			return true;
		}
		return false;
	};
	me.save = function() {
		localStorage.setItem(me.storageKey, JSON.stringify(options));
	};

	me.keyEvent = function(e) {
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
		document.addEventListener('keydown', me.keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('setting').style.display = 'none';
		document.removeEventListener('keydown', me.keyEvent, false);
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

	me.keyEvent = function(e) {
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
		document.addEventListener('keydown', me.keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('message').style.display = 'none';
		document.removeEventListener('keydown', me.keyEvent, false);
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

	me.keyEvent = function(e) {
		if (!document.getElementById('modal-overlay')) {
			return;
		}
		if (e.key === 'Escape') {
			if (document.getElementById('menu-overlay')) {
				me.closeMenu();
			} else {
				me.close();
			}
		}
		if (e.key === 'Enter') {
			if (document.activeElement.id === 'online-open-search-text') {
				document.getElementById('online-open-search-button').click();
			} else if (document.activeElement.classList.contains('file-item')) {
				document.activeElement.click();
			} else if (document.activeElement.classList.contains('file-menu')) {
				me.showMenu(e.target);
			}
		}
	};
	me.openEvent = async function(e) {
		if (e.target.closest('.file-menu')) {
			me.showMenu(e.target);
			return;
		}
		if (e.target.id === 'online-open-copy') {
			me.closeMenu();
			const cid = e.target.closest('#online-open-menu').getAttribute('cid');
			if (navigator.clipboard) {
				navigator.clipboard.writeText(`${location.origin}${location.pathname}?cid=${cid}`);
			}
			return;
		}
		if (e.target.id === 'online-open-copy-autorun') {
			me.closeMenu();
			const cid = e.target.closest('#online-open-menu').getAttribute('cid');
			if (navigator.clipboard) {
				navigator.clipboard.writeText(`${location.origin}${location.pathname}?cid=${cid}&run=1`);
			}
			return;
		}
		if (e.target.id === 'online-open-history') {
			me.closeMenu();
			me.close();
			await onlineHistoryView.show(e.target.closest('#online-open-menu').getAttribute('cid'));
			return;
		}
		if (e.target.id === 'online-open-remove') {
			me.closeMenu();
			const password = window.prompt(resource.ONLINE_OPEN_REMOVE_PASSWORD);
			if (password === null) {
				return;
			}
			const cid = e.target.closest('#online-open-menu').getAttribute('cid');
			try {
				const res = await fetch(`${apiServer}/api/script/${cid}`, {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						password: pg0_string.crc32(password),
					}),
				});
				switch (res.status) {
				case 200:
					document.getElementById(cid).remove();
					break;
				case 401:
					alert(resource.ONLINE_ERROR_UNAUTHORIZED);
					break;
				case 404:
					alert(resource.ONLINE_ERROR_NOT_FOUND);
					break;
				default:
					alert(res.statusText + '(' + res.status + ')');
					break;
				}
			} catch(e) {
				console.error(e);
				alert(resource.ONLINE_ERROR_CONNECTION);
			}
			return;
		}
		if (e.target.closest('.read-item')) {
			me.getList();
			return;
		}
		const item = e.target.closest('.file-item');
		if (item) {
			if (await me.getScript(item.id, false)) {
				me.close();
				document.getElementById('editor').blur();
			}
		}
	};
	me.getList = async function() {
		try {
			const id = me.id = Math.random().toString(36).slice(-8);
			const keyword = document.getElementById('online-open-search-text').value;
			const scripts = await (await fetch(`${apiServer}/api/script/${encodeURIComponent(keyword)}?count=${listCount}&skip=${me.skip}&uuid=${options.uuid}`)).json();
			if (id !== me.id) {
				return;
			}
			if (scripts) {
				if (document.getElementById('loading')) {
					document.getElementById('loading').remove();
				}
				if (document.querySelector('.read-item')) {
					document.querySelector('.read-item').remove();
				}
				scripts.forEach((script) => {
					const nameNode = document.createElement('div');
					nameNode.id = script.cid;
					nameNode.classList.add('file-item');
					nameNode.tabIndex = 0;
					let time = '';
					if (script.updateTime) {
						const date = new Date(script.updateTime);
						time = '(' + date_format.formatDate(date, navigator.language) + ' ' + date_format.formatTimeSec(date, navigator.language) + ')';
					}
					nameNode.innerHTML = '<div><span class="file-name ' + ((script.private) ? 'file-private' : '') + '">' + pg0_string.escapeHTML(script.name) + '</span></div>' +
						'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(script.author || '') + '</span></div><img src="image/kebob_menu.svg" class="file-menu" tabindex="0"></img>';
					document.getElementById('online-open-list').appendChild(nameNode);
				});
				if (scripts.length >= listCount) {
					me.skip += scripts.length;
					const readNode = document.createElement('div');
					readNode.classList.add('read-item');
					readNode.tabIndex = 0;
					readNode.innerHTML = resource.ONLINE_OPEN_READ_TITLE;
					document.getElementById('online-open-list').appendChild(readNode);
				}
			}
		} catch(e) {
			console.error(e);
			alert(resource.ONLINE_ERROR_CONNECTION);
		}
	};
	
	me.getScript = async function(cid, ignoreError) {
		let ret = true;
		try {
			const res = await fetch(`${apiServer}/api/script/item/${cid}`);
			switch (res.status) {
			case 200:
				const script = await res.json();
				ev.setText(script.code, script.name);
				ev.currentContent.cid = cid;
				ev.currentContent.author = script.author;
				ev.currentContent.private = script.private;
				ev.saveState();
				vv.clear();
				cv.clear();

				options.execMode = script.type;
				options.execSpeed = script.speed;
				settingView.save();

				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				history.replaceState('', '', `${location.pathname}?cid=${cid}`);
				break;
			case 404:
				if (!ignoreError) {
					alert(resource.ONLINE_ERROR_NOT_FOUND);
				}
				ret = false;
				break;
			default:
				if (!ignoreError) {
					alert(res.statusText + '(' + res.status + ')');
				}
				ret = false;
				break;
			}
		} catch(e) {
			console.error(e);
			if (!ignoreError) {
				alert(resource.ONLINE_ERROR_CONNECTION);
			}
			ret = false;
		}
		return ret;
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
		document.addEventListener('keydown', me.keyEvent, false);
		document.addEventListener('click', me.openEvent, false);

		document.getElementById('online-open-list').innerHTML = '<img src="image/load.svg" id="loading" />';
		me.skip = 0;
		me.getList();
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-open').style.display = 'none';
		document.removeEventListener('keydown', me.keyEvent, false);
		document.removeEventListener('click', me.openEvent, false);
	};

	me.showMenu = async function(elm) {
		if (document.getElementById('menu-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'menu-overlay');
		modal.addEventListener('click', function(e) {
			me.closeMenu();
		}, false);
		document.body.append(modal);

		const menu = document.getElementById('online-open-menu');
		menu.setAttribute('cid', elm.parentNode.id);
		menu.style.display = 'block';
		const bound = elm.getBoundingClientRect();
		let x = bound.left;
		if (x + menu.offsetWidth > window.innerWidth) {
			x = window.innerWidth - menu.offsetWidth;
		}
		let y = bound.top + bound.height;
		if (y + menu.offsetHeight > window.innerHeight) {
			y = window.innerHeight - menu.offsetHeight;
		}
		menu.style.left = x + 'px';
		menu.style.top = y + 'px';

		document.getElementById('online-open-history').parentNode.style.display = 'block';
		document.getElementById('online-open-remove-div').style.display = 'block';
		menu.focus();
	};
	me.closeMenu = function() {
		document.getElementById('menu-overlay').remove();
		document.getElementById('online-open-menu').style.display = 'none';
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('online-open-copy').textContent = resource.ONLINE_OPEN_COPY;
		document.getElementById('online-open-copy-autorun').textContent = resource.ONLINE_OPEN_COPY_AUTORUN;
		document.getElementById('online-open-history').textContent = resource.ONLINE_OPEN_HISTORY;
		document.getElementById('online-open-remove').textContent = resource.ONLINE_OPEN_REMOVE;

		document.querySelector('#online-open .close').addEventListener('click', function(e) {
			me.close();
		}, false);
		document.getElementById('online-open-search-button').addEventListener('click', async function(e) {
			document.getElementById('online-open-list').innerHTML = '<img src="image/load.svg" id="loading" />';
			try {
				const keyword = document.getElementById('online-open-search-text').value;
				options.keyword = keyword;
				settingView.save();
				me.skip = 0;
				me.getList();
			} catch(e) {
				console.error(e);
			}
		}, false);
	}, false);

	return me;
})();

const onlineHistoryView = (function () {
	const me = {};

	me.keyEvent = function(e) {
		if (!document.getElementById('modal-overlay')) {
			return;
		}
		if (e.key === 'Escape') {
			if (document.getElementById('menu-overlay')) {
				me.closeMenu();
			} else {
				me.close();
			}
		}
		if (e.key === 'Enter') {
			if (document.activeElement.classList.contains('file-item')) {
				document.activeElement.click();
			} else if (document.activeElement.classList.contains('file-menu')) {
				me.showMenu(e.target);
			}
		}
	};
	me.openEvent = async function(e) {
		if (e.target.closest('.file-menu')) {
			me.showMenu(e.target);
			return;
		}
		if (e.target.id === 'online-open-copy') {
			me.closeMenu();
			const cid = e.target.closest('#online-open-menu').getAttribute('cid');
			if (navigator.clipboard) {
				navigator.clipboard.writeText(`${location.origin}${location.pathname}?cid=${cid}`);
			}
			return;
		}
		if (e.target.id === 'online-open-copy-autorun') {
			me.closeMenu();
			const cid = e.target.closest('#online-open-menu').getAttribute('cid');
			if (navigator.clipboard) {
				navigator.clipboard.writeText(`${location.origin}${location.pathname}?cid=${cid}&run=1`);
			}
			return;
		}
		if (e.target.closest('.read-item')) {
			me.getList();
			return;
		}
		const item = e.target.closest('.file-item');
		if (item) {
			if (await me.getHistory(item.getAttribute('time'))) {
				me.close();
				document.getElementById('editor').blur();
			}
		}
	};
	me.getList = async function() {
		try {
			const id = me.id = Math.random().toString(36).slice(-8);
			const res = await fetch(`${apiServer}/api/script/history/${me.cid}?count=${listCount}&skip=${me.skip}`);
			if (id !== me.id) {
				return;
			}
			switch (res.status) {
			case 200:
				const scripts = await res.json();
				if (scripts) {
					if (document.getElementById('loading')) {
						document.getElementById('loading').remove();
					}
					if (document.querySelector('.read-item')) {
						document.querySelector('.read-item').remove();
					}
					scripts.forEach((script) => {
						const nameNode = document.createElement('div');
						nameNode.id = script.cid;
						nameNode.classList.add('file-item');
						nameNode.tabIndex = 0;
						nameNode.setAttribute('time', script.updateTime);
						let time = '';
						if (script.updateTime) {
							const date = new Date(script.updateTime);
							time = '(' + date_format.formatDate(date, navigator.language) + ' ' + date_format.formatTimeSec(date, navigator.language) + ')';
						}
						let memo = '';
						if (script.memo) {
							memo = '<div class="file-memo">' + pg0_string.escapeHTML(script.memo) + '</div>'
						}
						if (document.getElementById('online-history-list').childElementCount === 0) {
							nameNode.innerHTML = '<div><span class="file-name">' + pg0_string.escapeHTML(script.name) + '</span><span class="file-current">' + resource.ONLINE_HISTORY_CURRENT + '</span></div>' + memo +
								'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(script.author || '') + '</span></div><img src="image/kebob_menu.svg" class="file-menu" tabindex="0"></img>';
						} else {
							nameNode.innerHTML = '<div><span class="file-name">' + pg0_string.escapeHTML(script.name) + '</span></div>' + memo +
								'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(script.author || '') + '</span></div>';
						}
						document.getElementById('online-history-list').appendChild(nameNode);
					});
					if (scripts.length >= listCount) {
						me.skip += scripts.length;
						const readNode = document.createElement('div');
						readNode.classList.add('read-item');
						readNode.tabIndex = 0;
						readNode.innerHTML = resource.ONLINE_OPEN_READ_TITLE;
						document.getElementById('online-history-list').appendChild(readNode);
					}
				}
				break;
			case 404:
				alert(resource.ONLINE_ERROR_NOT_FOUND);
				me.close();
				break;
			default:
				alert(res.statusText + '(' + res.status + ')');
				me.close();
				break;
			}
		} catch(e) {
			console.error(e);
			alert(resource.ONLINE_ERROR_CONNECTION);
			me.close();
		}
	};
	
	me.getHistory = async function(time) {
		let ret = true;
		try {
			const res = await fetch(`${apiServer}/api/script/item/${me.cid}/${time}`);
			switch (res.status) {
			case 200:
				const script = await res.json();
				ev.setText(script.code, script.name);
				ev.currentContent.cid = me.cid;
				ev.currentContent.author = script.author;
				ev.currentContent.private = script.private;
				ev.saveState();
				vv.clear();
				cv.clear();

				options.execMode = script.type;
				options.execSpeed = script.speed;
				settingView.save();

				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				history.replaceState('', '', `${location.pathname}?cid=${me.cid}`);
				break;
			case 404:
				alert(resource.ONLINE_ERROR_NOT_FOUND);
				ret = false;
				break;
			default:
				alert(res.statusText + '(' + res.status + ')');
				ret = false;
				break;
			}
		} catch(e) {
			console.error(e);
			alert(resource.ONLINE_ERROR_CONNECTION);
			ret = false;
		}
		return ret;
	};

	me.show = async function(cid) {
		me.cid = cid;
		if (document.getElementById('modal-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'modal-overlay');
		modal.addEventListener('click', function(e) {
			me.close();
		}, false);
		document.body.append(modal);
		document.getElementById('online-history').style.display = 'block';
		document.getElementById('online-history').focus();
		document.addEventListener('keydown', me.keyEvent, false);
		document.addEventListener('click', me.openEvent, false);

		document.getElementById('online-history-list').innerHTML = '<img src="image/load.svg" id="loading" />';
		me.skip = 0;
		me.getList();
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-history').style.display = 'none';
		document.removeEventListener('keydown', me.keyEvent, false);
		document.removeEventListener('click', me.openEvent, false);
	};

	me.showMenu = async function(elm) {
		if (document.getElementById('menu-overlay')) {
			return;
		}
		const modal = document.createElement('div');
		modal.setAttribute('id', 'menu-overlay');
		modal.addEventListener('click', function(e) {
			me.closeMenu();
		}, false);
		document.body.append(modal);

		const menu = document.getElementById('online-open-menu');
		menu.setAttribute('cid', elm.parentNode.id);
		menu.style.display = 'block';
		const bound = elm.getBoundingClientRect();
		let x = bound.left;
		if (x + menu.offsetWidth > window.innerWidth) {
			x = window.innerWidth - menu.offsetWidth;
		}
		let y = bound.top + bound.height;
		if (y + menu.offsetHeight > window.innerHeight) {
			y = window.innerHeight - menu.offsetHeight;
		}
		menu.style.left = x + 'px';
		menu.style.top = y + 'px';

		document.getElementById('online-open-history').parentNode.style.display = 'none';
		document.getElementById('online-open-remove-div').style.display = 'none';
		menu.focus();
	};
	me.closeMenu = function() {
		document.getElementById('menu-overlay').remove();
		document.getElementById('online-open-menu').style.display = 'none';
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('online-history-title').textContent = resource.ONLINE_OPEN_HISTORY;

		document.querySelector('#online-history .close').addEventListener('click', function(e) {
			me.close();
		}, false);
	}, false);

	return me;
})();

const onlineSaveView = (function () {
	const me = {};

	me.keyEvent = function(e) {
		if (!document.getElementById('modal-overlay')) {
			return;
		}
		if (e.key === 'Escape') {
			me.close();
		}
		if (e.key === 'Enter') {
			document.querySelector('#online-save-button').click();
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
		document.getElementById('online-save-password').value = options.password || '';
		document.getElementById('online-save-memo').value = '';
		if (ev.currentContent.cid) {
			document.getElementById('online-save-new').checked = false;
			document.getElementById('online-save-new').parentElement.style.display = 'block';
		} else {
			document.getElementById('online-save-new').parentElement.style.display = 'none';
		}
		document.getElementById('online-save-private').checked = ev.currentContent.private;
		document.addEventListener('keydown', me.keyEvent, false);
	};
	me.close = function() {
		document.getElementById('modal-overlay').remove();
		document.getElementById('online-save').style.display = 'none';
		document.removeEventListener('keydown', me.keyEvent, false);
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('online-save-file-title').textContent = resource.ONLINE_SAVE_FILE_TITLE;
		document.getElementById('online-save-author-title').textContent = resource.ONLINE_SAVE_AUTHOR_TITLE;
		document.getElementById('online-save-password-title').textContent = resource.ONLINE_SAVE_PASSWORD_TITLE;
		document.getElementById('online-save-memo-title').textContent = resource.ONLINE_SAVE_MEMO_TITLE;
		document.getElementById('online-save-new-title').textContent = resource.ONLINE_SAVE_NEW_TITLE;
		document.getElementById('online-save-private-title').textContent = resource.ONLINE_SAVE_PRIVATE_TITLE;
		document.getElementById('online-save-button').value = resource.ONLINE_SAVE_BUTTON;

		document.getElementById('online-save-private').addEventListener('click', function(e) {
			if (document.getElementById('online-save-private').checked) {
				alert(resource.ONLINE_CONFIRM_PRIVATE);
			}
		}, false);

		document.querySelector('#online-save .close').addEventListener('click', function(e) {
			me.close();
		}, false);

		document.getElementById('online-save-button').addEventListener('click', async function(e) {
			const filename = document.getElementById('online-save-file').value.trim();
			const author = document.getElementById('online-save-author').value.trim();
			const password = document.getElementById('online-save-password').value;
			const memo = document.getElementById('online-save-memo').value;
			const privateMode = document.getElementById('online-save-private').checked ? 1 : 0;
			if (!filename) {
				alert(resource.ONLINE_ERROR_NAME_NOT_ENTERED);
				return;
			}
			if (!author) {
				alert(resource.ONLINE_ERROR_AUTHOR_NOT_ENTERED);
				return;
			}
			if (!password) {
				alert(resource.ONLINE_ERROR_PASSWORD_NOT_ENTERED);
				return;
			}
			const script = {
				name: filename,
				type: options.execMode,
				author: author,
				password: pg0_string.crc32(password),
				memo: memo,
				uuid: options.uuid,
				code: ev.getText(),
				speed: options.execSpeed,
				private: privateMode
			};
			let method = 'POST';
			let url = `${apiServer}/api/script`;
			if (ev.currentContent.cid && !document.getElementById('online-save-new').checked) {
				method = 'PUT';
				url = `${apiServer}/api/script/${ev.currentContent.cid}`;
			}
			try {
				const res = await fetch(url, {
					method: method,
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(script),
				});
				switch (res.status) {
				case 200:
					ev.currentContent.modify = false;
					ev.currentContent.name = filename;
					ev.currentContent.author = author;
					ev.currentContent.password = password;
					ev.currentContent.private = privateMode;
					if (method === 'POST') {
						const data = await res.json();
						ev.currentContent.cid = data.cid;
						history.replaceState('', '', `${location.pathname}?cid=${data.cid}`);
					}
					ev.saveState();

					options.author = author;
					options.password = password;
					settingView.save();

					// Notify main event
					document.dispatchEvent(new CustomEvent('setting_change'));
					me.close();
					break;
				case 401:
					alert(resource.ONLINE_ERROR_UNAUTHORIZED);
					break;
				case 404:
					alert(resource.ONLINE_ERROR_NOT_FOUND);
					break;
				case 409:
					alert(resource.ONLINE_ERROR_CONFLICT);
					break;
				case 413:
					const errbody = await res.json();
					if (errbody.type === 'name') {
						alert(resource.ONLINE_ERROR_NAME_TOO_LONG);
					} else if (errbody.type === 'author') {
						alert(resource.ONLINE_ERROR_AUTHOR_TOO_LONG);
					} else {
						alert(res.statusText + '(' + res.status + ')');
					}
					break;
				default:
					alert(res.statusText + '(' + res.status + ')');
					break;
				}
			} catch(e) {
				console.error(e);
				alert(resource.ONLINE_ERROR_CONNECTION);
			}
		}, false);
	}, false);

	return me;
})();
