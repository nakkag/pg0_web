"use strict";

const listCount = 30;

function tagLabel(id) {
	return (resource.ONLINE_TAGS && resource.ONLINE_TAGS[id]) || id;
}

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
			options.listFilter = op.listFilter || '';
			options.listSort = op.listSort || 'popular';
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
			} else if (document.activeElement.classList.contains('tag-chip')) {
				document.activeElement.click();
			}
		}
		if (e.key === ' ' && document.activeElement.classList.contains('tag-chip')) {
			e.preventDefault();
			document.activeElement.click();
		}
	};
	me.openEvent = async function(e) {
		if (e.target.closest('.file-menu')) {
			me.showMenu(e.target);
			return;
		}
		const chip = e.target.closest('#online-open-filter .tag-chip');
		if (chip) {
			me.setFilter(chip.dataset.filter);
			return;
		}
		// A badge of the genre already chosen selects the item like the rest of it.
		const badge = e.target.closest('.file-tag');
		if (badge && badge.dataset.tag !== me.filter()) {
			me.setFilter(badge.dataset.tag);
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
	me.filter = function() {
		return options.listFilter || '';
	};
	me.sort = function() {
		return options.listSort === 'new' ? 'new' : 'popular';
	};
	me.renderFilter = function() {
		document.querySelectorAll('#online-open-filter .tag-chip').forEach((chip) => {
			chip.classList.toggle('active', chip.dataset.filter === me.filter());
		});
		document.getElementById('online-open-sort').value = me.sort();
		document.getElementById('online-open-sort').disabled = (me.filter() === 'mine');
		const active = document.querySelector('#online-open-filter .tag-chip.active');
		if (active) {
			me.scrollChipIntoView(active);
		}
		me.updateScrollButtons();
	};
	// The arrows on both ends of the chip row show only while more chips lie that way.
	me.updateScrollButtons = function() {
		const filter = document.getElementById('online-open-filter');
		const max = filter.scrollWidth - filter.clientWidth;
		document.getElementById('online-open-filter-prev').hidden = (filter.scrollLeft <= 1);
		document.getElementById('online-open-filter-next').hidden = (filter.scrollLeft >= max - 1);
	};
	// Scrolls the chip row (not the dialog) so the chip is clear of the arrows.
	me.scrollChipIntoView = function(chip) {
		const filter = document.getElementById('online-open-filter');
		const frame = filter.getBoundingClientRect();
		const rect = chip.getBoundingClientRect();
		// The width of the arrow (or of the fade on touch screens), also while it is hidden.
		const margin = parseFloat(getComputedStyle(document.getElementById('online-open-filter-next')).width) || 36;
		if (rect.left < frame.left + margin) {
			filter.scrollLeft -= frame.left + margin - rect.left;
		} else if (rect.right > frame.right - margin) {
			filter.scrollLeft += rect.right - (frame.right - margin);
		}
	};
	me.reload = function() {
		document.getElementById('online-open-list').innerHTML = '<img src="image/load.svg" id="loading" />';
		me.skip = 0;
		me.getList();
	};
	me.setFilter = function(filter) {
		options.listFilter = filter;
		settingView.save();
		me.renderFilter();
		me.reload();
	};
	me.getList = async function() {
		try {
			const id = me.id = Math.random().toString(36).slice(-8);
			const keyword = document.getElementById('online-open-search-text').value;
			const params = new URLSearchParams({count: listCount, skip: me.skip, uuid: options.uuid, sort: me.sort()});
			if (me.filter() === 'mine') {
				params.set('mine', '1');
			} else if (me.filter()) {
				params.set('tag', me.filter());
			}
			const scripts = await (await fetch(`${apiServer}/api/script/${encodeURIComponent(keyword)}?${params}`)).json();
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
					const tags = (Array.isArray(script.tags) ? script.tags : []).map((tag) => {
						return '<span class="file-tag' + (tag === me.filter() ? ' current' : '') + '" data-tag="' + pg0_string.escapeHTML(tag) + '">' + pg0_string.escapeHTML(tagLabel(tag)) + '</span>';
					}).join('');
					nameNode.innerHTML = '<div><span class="file-name ' + ((script.private) ? 'file-private' : '') + '">' + pg0_string.escapeHTML(script.name || '') + '</span></div>' +
						'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(script.author || '') + '</span>' + tags + '</div><img src="image/kebob_menu.svg" class="file-menu" tabindex="0"></img>';
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
				ev.setText(script.code || '', script.name || '');
				ev.currentContent.cid = cid;
				ev.currentContent.author = script.author || '';
				ev.currentContent.private = script.private;
				ev.currentContent.tags = Array.isArray(script.tags) ? script.tags : [];
				ev.saveState();
				vv.clear();
				cv.clear();

				options.execMode = script.type;
				options.execSpeed = script.speed;
				settingView.save();

				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				history.replaceState('', '', `${location.pathname}?cid=${cid}`);

				if (window.parent && window.parent.postMessage) {
					window.parent.postMessage({type: 'pg0', event: 'read', content: ev.currentContent}, '*');
				}
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
		me.renderFilter();
		document.addEventListener('keydown', me.keyEvent, false);
		document.addEventListener('click', me.openEvent, false);

		me.reload();
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
		document.getElementById('online-open-copy').parentNode.hidden = false;
		document.getElementById('online-open-copy-autorun').parentNode.hidden = false;
		document.getElementById('online-open-history').parentNode.hidden = false;
		document.getElementById('online-open-remove-div').hidden = false;
		document.getElementById('online-open-diff').parentNode.hidden = true;
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
		document.getElementById('online-open-diff').textContent = resource.ONLINE_HISTORY_DIFF;

		const chips = [['', resource.ONLINE_OPEN_FILTER_ALL], ['mine', resource.ONLINE_OPEN_FILTER_MINE]];
		for (let key in resource.ONLINE_TAGS) {
			chips.push([key, resource.ONLINE_TAGS[key]]);
		}
		chips.forEach(([filter, label]) => {
			const chip = document.createElement('span');
			chip.classList.add('tag-chip');
			chip.dataset.filter = filter;
			chip.tabIndex = 0;
			chip.setAttribute('role', 'button');
			chip.textContent = label;
			document.getElementById('online-open-filter').appendChild(chip);
		});

		const filter = document.getElementById('online-open-filter');
		filter.addEventListener('scroll', me.updateScrollButtons, false);
		// A chip reached with the keyboard is kept clear of the arrows.
		filter.addEventListener('focusin', function(e) {
			if (!e.target.classList.contains('tag-chip')) {
				return;
			}
			let visible = true;
			try {
				visible = e.target.matches(':focus-visible');
			} catch (err) {
			}
			if (visible) {
				me.scrollChipIntoView(e.target);
			}
		}, false);
		window.addEventListener('resize', function() {
			if (document.getElementById('online-open').style.display === 'block') {
				me.updateScrollButtons();
			}
		}, false);
		// An arrow hides at the end of the row; a quick extra click must not select the chip under it.
		let arrowTime = 0;
		document.getElementById('online-open-filter-prev').addEventListener('click', function(e) {
			arrowTime = Date.now();
			filter.scrollBy({left: -filter.clientWidth * 0.7, behavior: 'smooth'});
		}, false);
		document.getElementById('online-open-filter-next').addEventListener('click', function(e) {
			arrowTime = Date.now();
			filter.scrollBy({left: filter.clientWidth * 0.7, behavior: 'smooth'});
		}, false);
		// A vertical mouse wheel over the row or its arrows scrolls the chips sideways.
		document.getElementById('online-open-filter-wrap').addEventListener('wheel', function(e) {
			if (e.ctrlKey || filter.scrollWidth <= filter.clientWidth) {
				return;
			}
			let delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY)) ? e.deltaX : e.deltaY;
			if (e.deltaMode === 1) {
				delta *= 16;
			} else if (e.deltaMode === 2) {
				delta *= filter.clientWidth;
			}
			e.preventDefault();
			filter.scrollLeft += delta;
		}, {passive: false});
		// Dragging with the mouse scrolls the chip row; the click that ends a drag selects nothing.
		// Touch keeps the browser's own swipe scrolling.
		let drag = null;
		let dragged = false;
		filter.addEventListener('pointerdown', function(e) {
			dragged = false;
			drag = null;
			filter.classList.remove('dragging');
			if (e.pointerType !== 'mouse' || e.button !== 0) {
				return;
			}
			drag = {id: e.pointerId, x: e.clientX, left: filter.scrollLeft, moved: false};
		}, false);
		filter.addEventListener('pointermove', function(e) {
			if (!drag || e.pointerId !== drag.id) {
				return;
			}
			if (!(e.buttons & 1)) {
				// The button was released outside the row.
				filter.classList.remove('dragging');
				drag = null;
				return;
			}
			const dx = e.clientX - drag.x;
			if (!drag.moved) {
				if (Math.abs(dx) <= 5) {
					return;
				}
				drag.moved = true;
				filter.setPointerCapture(e.pointerId);
				filter.classList.add('dragging');
			}
			filter.scrollLeft = drag.left - dx;
		}, false);
		// A press that leaves the row before it turns into a drag is dropped, so a later drag
		// that enters the row with the button held does not pick it up.
		filter.addEventListener('pointerleave', function(e) {
			if (drag && !drag.moved && e.pointerId === drag.id) {
				drag = null;
			}
		}, false);
		const endDrag = function(e) {
			if (!drag || e.pointerId !== drag.id) {
				return;
			}
			if (drag.moved) {
				filter.classList.remove('dragging');
				if (e.type === 'pointerup') {
					// The click, if any, follows in the same task.
					dragged = true;
					setTimeout(function() {
						dragged = false;
					}, 0);
				}
			}
			drag = null;
		};
		filter.addEventListener('pointerup', endDrag, false);
		filter.addEventListener('pointercancel', endDrag, false);
		filter.addEventListener('click', function(e) {
			if (dragged || Date.now() - arrowTime < 500) {
				dragged = false;
				e.stopPropagation();
				e.preventDefault();
			}
		}, true);
		filter.addEventListener('dragstart', function(e) {
			e.preventDefault();
		}, false);
		for (let key in resource.ONLINE_OPEN_SORT) {
			const op = document.createElement('option');
			op.value = key;
			op.textContent = resource.ONLINE_OPEN_SORT[key];
			document.getElementById('online-open-sort').append(op);
		}
		document.getElementById('online-open-sort').addEventListener('change', function(e) {
			options.listSort = e.target.value;
			settingView.save();
			me.reload();
		}, false);

		document.querySelector('#online-open .close').addEventListener('click', function(e) {
			me.close();
		}, false);
		document.getElementById('online-open-search-button').addEventListener('click', async function(e) {
			try {
				const keyword = document.getElementById('online-open-search-text').value;
				options.keyword = keyword;
				settingView.save();
				me.reload();
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
		if (!document.getElementById('modal-overlay') || onlineDiffView.isOpen()) {
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
		if (onlineDiffView.isOpen()) {
			return;
		}
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
		if (e.target.id === 'online-open-diff') {
			me.closeMenu();
			await me.showDiff(me.menuItem);
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
			// One more than is shown tells whether older versions remain.
			const res = await fetch(`${apiServer}/api/script/history/${me.cid}?count=${listCount + 1}&skip=${me.skip}`);
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
					const more = (scripts.length > listCount);
					const shown = scripts.slice(0, listCount);
					shown.forEach((script, index) => {
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
						const isCurrent = (document.getElementById('online-history-list').childElementCount === 0);
						let current = '';
						if (isCurrent) {
							current = '<span class="file-current">' + resource.ONLINE_HISTORY_CURRENT + '</span>';
						}
						// The first version has nothing to compare with, so its menu would be empty unless it is also the current one.
						const isFirst = (!more && index === shown.length - 1);
						let menu = '';
						if (isCurrent || !isFirst) {
							menu = '<img src="image/kebob_menu.svg" class="file-menu" tabindex="0"></img>';
						}
						nameNode.innerHTML = '<div><span class="file-name">' + pg0_string.escapeHTML(script.name) + '</span>' + current + '</div>' + memo +
							'<div><span class="file-time">' + time + '</span><span class="file-author">' + pg0_string.escapeHTML(script.author || '') + '</span></div>' + menu;
						document.getElementById('online-history-list').appendChild(nameNode);
					});
					if (more) {
						me.skip += shown.length;
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
				ev.currentContent.tags = Array.isArray(script.tags) ? script.tags : [];
				ev.saveState();
				vv.clear();
				cv.clear();

				options.execMode = script.type;
				options.execSpeed = script.speed;
				settingView.save();

				// Notify main event
				document.dispatchEvent(new CustomEvent('setting_change'));
				history.replaceState('', '', `${location.pathname}?cid=${me.cid}`);

				if (window.parent && window.parent.postMessage) {
					window.parent.postMessage({type: 'pg0', event: 'read', content: ev.currentContent}, '*');
				}
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

	// The time of the version saved just before the item's, or null when the item is the first version.
	me.previousTime = async function(item) {
		const next = item.nextElementSibling;
		if (next && next.classList.contains('file-item')) {
			return next.getAttribute('time');
		}
		if (!next || !next.classList.contains('read-item')) {
			return null;
		}
		// The item is the last one read so far.
		const index = Array.prototype.indexOf.call(document.querySelectorAll('#online-history-list .file-item'), item);
		const res = await fetch(`${apiServer}/api/script/history/${me.cid}?count=1&skip=${index + 1}`);
		if (res.status !== 200) {
			throw res;
		}
		const scripts = await res.json();
		return (scripts.length > 0) ? String(scripts[0].updateTime) : null;
	};
	me.getCode = async function(time) {
		const res = await fetch(`${apiServer}/api/script/item/${me.cid}/${time}`);
		if (res.status !== 200) {
			throw res;
		}
		const script = await res.json();
		return script.code || '';
	};
	me.showDiff = async function(item) {
		const id = onlineDiffView.show(item.querySelector('.file-menu'));
		try {
			const [prevCode, code] = await Promise.all([
				me.previousTime(item).then((time) => (time === null) ? null : me.getCode(time)),
				me.getCode(item.getAttribute('time'))
			]);
			onlineDiffView.render(id, prevCode, code);
		} catch(e) {
			if (!onlineDiffView.isCurrent(id)) {
				return;
			}
			if (!(e instanceof Response)) {
				console.error(e);
				alert(resource.ONLINE_ERROR_CONNECTION);
			} else if (e.status === 404) {
				alert(resource.ONLINE_ERROR_NOT_FOUND);
			} else {
				alert(e.statusText + '(' + e.status + ')');
			}
			onlineDiffView.close();
		}
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

		me.menuItem = elm.parentNode;
		// The URLs open the current version, so only its item offers them.
		const current = (me.menuItem === document.querySelector('#online-history-list .file-item'));
		const menu = document.getElementById('online-open-menu');
		menu.setAttribute('cid', elm.parentNode.id);
		document.getElementById('online-open-copy').parentNode.hidden = !current;
		document.getElementById('online-open-copy-autorun').parentNode.hidden = !current;
		document.getElementById('online-open-history').parentNode.hidden = true;
		document.getElementById('online-open-remove-div').hidden = true;
		// Only the first version has no item after it.
		document.getElementById('online-open-diff').parentNode.hidden = !me.menuItem.nextElementSibling;
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

const onlineDiffView = (function () {
	const me = {};

	// Unchanged lines kept in view next to each change; the rest of them fold away.
	const CONTEXT = 3;

	me.id = null;

	me.isOpen = function() {
		return !!document.getElementById('diff-overlay');
	};
	me.isCurrent = function(id) {
		return me.isOpen() && id === me.id;
	};

	me.keyEvent = function(e) {
		if (e.key === 'Escape') {
			me.close();
		} else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('diff-fold')) {
			e.preventDefault();
			me.toggleFold(document.activeElement);
		} else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
			// Select all takes the lines of the diff, not the whole page.
			e.preventDefault();
			window.getSelection().selectAllChildren(document.getElementById('online-diff-view'));
		}
	};
	// Copies only the code of the selected lines: line numbers, marks and folded lines are left out.
	me.copyEvent = function(e) {
		const view = document.getElementById('online-diff-view');
		const selection = window.getSelection();
		const lines = [];
		let inView = false;
		for (let i = 0; i < selection.rangeCount; i++) {
			const range = selection.getRangeAt(i);
			if (range.collapsed || !range.intersectsNode(view)) {
				continue;
			}
			inView = true;
			const codes = Array.from(range.cloneContents().querySelectorAll('.diff-code')).filter((code) => !code.closest('.diff-fold-body[hidden]'));
			if (codes.length > 0) {
				codes.forEach((code) => lines.push(code.textContent));
			} else {
				// The selection lies within one line.
				lines.push(range.toString());
			}
		}
		if (!inView) {
			return;
		}
		e.clipboardData.setData('text/plain', lines.join('\n'));
		e.preventDefault();
	};

	// Opens the dialog while the versions are read; focus goes back to returnFocus when it closes.
	me.show = function(returnFocus) {
		const modal = document.createElement('div');
		modal.setAttribute('id', 'diff-overlay');
		modal.addEventListener('click', function(e) {
			me.close();
		}, false);
		document.body.append(modal);
		document.getElementById('online-diff-view').innerHTML = '<img src="image/load.svg" class="diff-loading" />';
		document.getElementById('online-diff').style.display = 'block';
		document.getElementById('online-diff').focus();
		document.addEventListener('keydown', me.keyEvent, false);
		document.addEventListener('copy', me.copyEvent, false);
		me.returnFocus = returnFocus;
		me.id = Math.random().toString(36).slice(-8);
		return me.id;
	};
	me.close = function() {
		if (!me.isOpen()) {
			return;
		}
		document.getElementById('diff-overlay').remove();
		document.getElementById('online-diff').style.display = 'none';
		document.getElementById('online-diff-view').textContent = '';
		document.removeEventListener('keydown', me.keyEvent, false);
		document.removeEventListener('copy', me.copyEvent, false);
		me.id = null;
		if (me.returnFocus && me.returnFocus.isConnected) {
			me.returnFocus.focus();
		}
	};

	// Shows the changes from oldText to newText; a null oldText shows every line as added.
	me.render = function(id, oldText, newText) {
		if (!me.isCurrent(id)) {
			return;
		}
		const rows = text_diff.compare(oldText, newText);
		const view = document.getElementById('online-diff-view');
		view.classList.toggle('no-linenum', !options.showLineNum);
		let last = 1;
		rows.forEach((row) => {
			last = Math.max(last, row.oldNum, row.newNum);
		});
		view.style.setProperty('--diff-digits', String(last).length);

		const keep = new Array(rows.length).fill(false);
		rows.forEach((row, i) => {
			if (row.type !== 'equal') {
				for (let c = Math.max(0, i - CONTEXT); c <= Math.min(rows.length - 1, i + CONTEXT); c++) {
					keep[c] = true;
				}
			}
		});
		const body = document.createElement('div');
		body.classList.add('diff-body');
		for (let i = 0; i < rows.length;) {
			let end = i;
			while (end < rows.length && !keep[end]) {
				end++;
			}
			if (end - i >= 2) {
				body.append(me.foldNode(rows.slice(i, end)));
				const foldBody = document.createElement('div');
				foldBody.classList.add('diff-fold-body');
				foldBody.hidden = true;
				body.append(foldBody);
				i = end;
			} else {
				body.append(me.lineNode(rows[i]));
				i++;
			}
		}
		view.textContent = '';
		view.append(body);
		view.scrollTop = 0;
		view.scrollLeft = 0;
	};
	me.lineNode = function(row) {
		const line = document.createElement('div');
		line.classList.add('diff-line', 'diff-' + row.type);
		// Numbers and marks are drawn by CSS from the attributes, so they are never selected or copied.
		const gutter = document.createElement('span');
		gutter.classList.add('diff-gutter');
		[row.oldNum, row.newNum].forEach((num) => {
			const numNode = document.createElement('span');
			numNode.classList.add('diff-num');
			if (num) {
				numNode.dataset.num = num;
			}
			gutter.append(numNode);
		});
		const mark = document.createElement('span');
		mark.classList.add('diff-mark');
		gutter.append(mark);
		const code = document.createElement('span');
		code.classList.add('diff-code');
		if (row.parts) {
			row.parts.forEach((part) => {
				if (part.changed) {
					const word = document.createElement('span');
					word.classList.add('diff-word');
					word.textContent = part.text;
					code.append(word);
				} else {
					code.append(part.text);
				}
			});
		} else {
			code.textContent = row.text;
		}
		line.append(gutter, code);
		return line;
	};
	// The bar that stands for a run of unchanged lines; they are added to the page when first unfolded.
	me.foldNode = function(rows) {
		const fold = document.createElement('div');
		fold.classList.add('diff-fold');
		fold.tabIndex = 0;
		fold.setAttribute('role', 'button');
		fold.setAttribute('aria-expanded', 'false');
		const label = resource.ONLINE_DIFF_FOLD.replace('{n}', rows.length);
		fold.setAttribute('aria-label', label);
		const labelNode = document.createElement('span');
		labelNode.classList.add('diff-fold-label');
		labelNode.dataset.label = label;
		fold.append(labelNode);
		fold.rows = rows;
		return fold;
	};
	me.toggleFold = function(fold) {
		const foldBody = fold.nextElementSibling;
		if (fold.rows) {
			fold.rows.forEach((row) => foldBody.append(me.lineNode(row)));
			fold.rows = null;
		}
		foldBody.hidden = !foldBody.hidden;
		fold.classList.toggle('open', !foldBody.hidden);
		fold.setAttribute('aria-expanded', String(!foldBody.hidden));
	};

	document.addEventListener('DOMContentLoaded', function() {
		document.querySelector('#online-diff .close').addEventListener('click', function(e) {
			me.close();
		}, false);
		document.getElementById('online-diff-view').addEventListener('click', function(e) {
			const fold = e.target.closest('.diff-fold');
			if (fold) {
				me.toggleFold(fold);
			}
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
		const tagSelect = document.getElementById('online-save-tags');
		tagSelect.value = (ev.currentContent.tags || [])[0] || 'other';
		if (tagSelect.selectedIndex < 0) {
			tagSelect.value = 'other';
		}
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
		document.getElementById('online-save-tags-title').textContent = resource.ONLINE_SAVE_TAGS_TITLE;
		for (let key in resource.ONLINE_TAGS) {
			const op = document.createElement('option');
			op.value = key;
			op.textContent = resource.ONLINE_TAGS[key];
			document.getElementById('online-save-tags').append(op);
		}
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
			const tags = [document.getElementById('online-save-tags').value];
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
				private: privateMode,
				tags: tags
			};
			let method = 'POST';
			let url = `${apiServer}/api/script`;
			if (ev.currentContent.cid && !document.getElementById('online-save-new').checked) {
				method = 'PUT';
				url = `${apiServer}/api/script/${ev.currentContent.cid}`;
			}
			document.getElementById('online-save-button').disabled = true;
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
					ev.currentContent.tags = tags;
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
			document.getElementById('online-save-button').disabled = false;
		}, false);
	}, false);

	return me;
})();
