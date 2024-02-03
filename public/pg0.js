"use strict";

const options = {
	execMode: 'PG0',
	execSpeed: 250,
	fontSize: 18,
	showLineNum: true,
	boundary: {
		verX: 400,
		verY: 150,
		consoleY: 150,
		variable: 200
	}
};

let ev, vv, cv;
let baseTitle = document.title;

document.addEventListener('DOMContentLoaded', async function() {
	if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register('/pg0/serviceworker.js', {scope: '/pg0/'}).then(function (registration) {
			registration.onupdatefound = function() {
				registration.update();
			}
		}).catch(function (error) {
			console.error('serviceWorker error:', error);
		});
	}

	// Width of resize area
	const _rw = window.getComputedStyle(document.body).getPropertyValue('--resize-with');
	let rw = parseInt(_rw.replace(/[^0-9]/g, ''));
	const ua = user_agent.get();
	if (ua.isiOS || ua.isAndroid) {
		rw = 20;
		document.body.style.setProperty('--resize-with', rw + 'px');
	}

	// Initializing the view
	ev = new editorView(document.getElementById('editor'), document.getElementById('line-number'));
	setTimeout(function() {
		if (!ev.loadState()) {
			ev.setText("cnt = 0\ni = 1\nwhile (i <= 10) {\n\tcnt = cnt + i\n\ti = i + 1\n}\nexit cnt", '');
			settingView.save();
		}
		if (ev.currentContent.name) {
			document.title = baseTitle + ' - ' + ev.currentContent.name;
		}
	}, 0);
	vv = new variableView(document.getElementById('variable'), function(x) {
		options.boundary.variable = x;
		settingView.save();
	});
	cv = new consoleView(document.getElementById('console'));

	document.getElementById('exec-button').setAttribute('title', resource.CTRL_EXEC);
	document.getElementById('step-button').setAttribute('title', resource.CTRL_STEP_EXEC);
	document.getElementById('stop-button').setAttribute('title', resource.CTRL_STOP);
	document.getElementById('exec-speed').setAttribute('title', resource.CTRL_EXEC_SPEED);
	for (let key in resource.EXEC_SPEED) {
		const op = document.createElement('option');
		op.value = key;
		op.textContent = resource.EXEC_SPEED[key];
		document.getElementById('exec-speed').append(op);
	}
	document.getElementById('menu-new').textContent = resource.MENU_NEW;
	document.getElementById('menu-online-open').textContent = resource.MENU_ONLINE_OPEN;
	document.getElementById('menu-online-save').textContent = resource.MENU_ONLINE_SAVE;
	document.getElementById('menu-local-open').textContent = resource.MENU_LOCAL_OPEN;
	document.getElementById('menu-local-save').textContent = resource.MENU_LOCAL_SAVE;
	document.getElementById('menu-exec-to-cursor').textContent = resource.MENU_EXEC_TO_CURSOR;
	document.getElementById('menu-clear').textContent = resource.MENU_CLEAR;
	document.getElementById('menu-setting').textContent = resource.MENU_SETTING;
	document.getElementById('menu-tutorial').textContent = resource.MENU_TUTORIAL;

	// Load settings
	if (!settingView.load()) {
		settingView.save();
		setTimeout(function() {
			messageView.callback = function() {
				if (!window.open(resource.TUTORIAL_URL, '_blank')) {
					location.href = resource.TUTORIAL_URL;
				}
			};
			messageView.show(resource.MSG_TUTORIAL);
		}, 100);
	}
	document.getElementById('exec-speed').value = options.execSpeed;
	vv.setBoundary(options.boundary.variable);

	document.addEventListener('setting_change', function(e) {
		document.getElementById('exec-speed').value = options.execSpeed;
		document.getElementById('line-container').style.display = (options.showLineNum) ? 'block' : 'none';
		document.body.style.setProperty('--font-size', options.fontSize + 'px');
		let ex;
		if (options.execMode === 'PG0') {
			baseTitle = 'PG0(Web)';
			ex = false;
		} else {
			baseTitle = 'PG0.5(Web)';
			ex = true;
		}
		if (ev.extension !== ex) {
			ev.extension = ex;
			ev.loadState();
		}
		if (ev && ev.currentContent.name) {
			document.title = baseTitle + ' - ' + ev.currentContent.name;
		} else {
			document.title = baseTitle;
		}
	}, false);
	document.dispatchEvent(new CustomEvent('setting_change'));

	document.addEventListener('keydown', async function(e) {
		switch (e.key) {
		case 'F5':
			e.preventDefault();
			if (e.shiftKey) {
				stop();
			} else {
				await exec(false);
			}
			break;
		case 'F10':
			e.preventDefault();
			if (e.ctrlKey) {
				await execToCursor(true);
			} else {
				await exec(true);
			}
			break;
		case 'o':
			if (e.ctrlKey) {
				e.preventDefault();
				await fileOpen();
			}
			break;
		case 's':
			if (e.ctrlKey) {
				e.preventDefault();
				await fileSave();
			}
			break;
		case 'Escape':
			const menuToggle = document.getElementById('menu-toggle');
			if (menuToggle.checked) {
				document.getElementById('menu-toggle').checked = false;
			}
			break;
		}
	}, false);

	let touchstart = 'mousedown';
	let touchmove = 'mousemove';
	let touchend = ['mouseup', 'mouseleave'];
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
		touchmove = 'touchmove';
		touchend = ['touchend'];
	}
	let resizeFunc = null;

	// Resize of the container
	document.getElementById('var-resizer-x').addEventListener(touchstart, function(e) {
		if (e.cancelable) {
			e.preventDefault();
		}
		if (resizeFunc) {
			return;
		}
		let x = e.x ? e.x : e.touches[0].clientX;
		resizeFunc = function(e) {
			const ex = e.x ? e.x : e.touches[0].clientX;
			options.boundary.verX += x - ex;
			if (options.boundary.verX < 4) {
				options.boundary.verX = 4;
			} else if (options.boundary.verX > window.innerWidth - 100) {
				options.boundary.verX = window.innerWidth - 100;
			} else {
				x = ex;
			}
			setGridTemplate();
			settingView.save();
		};
		document.addEventListener(touchmove, resizeFunc, false);
	}, false);

	document.getElementById('var-resizer-y').addEventListener(touchstart, function(e) {
		if (e.cancelable) {
			e.preventDefault();
		}
		if (resizeFunc) {
			return;
		}
		let y = e.y ? e.y : e.touches[0].clientY;
		resizeFunc = function(e) {
			const ey = e.y ? e.y : e.touches[0].clientY;
			options.boundary.verY += y - ey;
			if (options.boundary.verY < 4) {
				options.boundary.verY = 4;
			} else if (options.boundary.verY > window.innerHeight - 100) {
				options.boundary.verY = window.innerHeight - 100;
			} else {
				y = ey;
			}
			setGridTemplate();
			settingView.save();
		}
		document.addEventListener(touchmove, resizeFunc, false);
	}, false);

	document.getElementById('console-resizer').addEventListener(touchstart, function(e) {
		if (e.cancelable) {
			e.preventDefault();
		}
		if (resizeFunc) {
			return;
		}
		let y = e.y ? e.y : e.touches[0].clientY;
		resizeFunc = function(e) {
			const ey = e.y ? e.y : e.touches[0].clientY;
			if (checkOrientation() === 0) {
				const wk = options.boundary.consoleY;
				options.boundary.consoleY += y - ey;
				if (options.boundary.consoleY >= 0 && options.boundary.consoleY <= window.innerHeight - 100) {
					options.boundary.verY = options.boundary.verY - (options.boundary.consoleY - wk);
				}
			} else {
				options.boundary.consoleY += y - ey;
			}
			if (options.boundary.consoleY < 4) {
				options.boundary.consoleY = 4;
			} else if (options.boundary.consoleY > window.innerHeight - 100) {
				options.boundary.consoleY = window.innerHeight - 100;
			} else {
				y = ey;
			}
			cv.fixBottom(function() {
				setGridTemplate();
			});
			settingView.save();
		}
		document.addEventListener(touchmove, resizeFunc, false);
	}, false);

	touchend.forEach(function(event) {
		document.addEventListener(event, function() {
			if (resizeFunc) {
				document.removeEventListener(touchmove, resizeFunc, false);
				resizeFunc = null;
			}
		}, false);
	});

	// Screen resize events
	let prev_orientation;
	window.addEventListener('resize', function(e) {
		const orientation = checkOrientation();
		if (orientation !== prev_orientation) {
			prev_orientation = orientation;
			setGridTemplate();
			setTimeout(function() {
				cv.toBottom();
			}, 1);
		}
	}, false);

	function checkOrientation() {
		const o = window.getComputedStyle(document.body, '::before').getPropertyValue('content');
		if (/portrait/i.test(o)) {
			return 0;
		}
		return 1;
	}

	const container = document.getElementById('container');
	const editorContainer = document.getElementById('editor-container');
	if (ua.isiOS || ua.isAndroid) {
		container.classList.add('mobile');
	}

	let editFocus = false;
	function setGridTemplate() {
		if (editFocus) {
			container.style.height = `calc(${window.visualViewport.height}px - env(safe-area-inset-top))`;
		} else {
			container.style.height = 'calc(100dvh - env(safe-area-inset-top))';
			if (checkOrientation() === 0) {
				if (container.classList.contains('mobile')) {
					container.style.gridTemplateRows = `1fr ${rw}px ${options.boundary.verY}px ${rw}px ${options.boundary.consoleY}px max-content 0`;
				} else {
					container.style.gridTemplateRows = `max-content 1fr ${rw}px ${options.boundary.verY}px ${rw}px ${options.boundary.consoleY}px 0`;
				}
				container.style.gridTemplateColumns = 'max-content 1fr';
			} else {
				container.style.gridTemplateRows = `max-content 1fr ${rw}px ${options.boundary.consoleY}px 0`;
				container.style.gridTemplateColumns = `max-content 1fr ${rw}px ${options.boundary.verX}px`;
			}
		}
	}
	setGridTemplate();

	if (ua.isiOS || ua.isAndroid) {
		let scrollTop = 0;
		document.getElementById('editor').addEventListener('focus', function(e) {
			if (document.getElementById('editor').getAttribute('contenteditable') === 'false') {
				return;
			}
			editFocus = true;
			scrollTop = editorContainer.scrollTop;
			container.classList.add('full');
			setGridTemplate();
		}, false);
		document.getElementById('editor').addEventListener('blur', function(e) {
			if (editFocus) {
				editFocus = false;
				container.classList.remove('full');
				setGridTemplate();
				const node = ev.getLineNode(ev.getCaretLineIndex());
				if (node) {
					node.scrollIntoView({behavior: 'instant', block: 'nearest'});
				}
			}
		}, false);
		window.visualViewport.addEventListener('resize', function() {
			if (editFocus) {
				container.style.height = `calc(${window.visualViewport.height}px - env(safe-area-inset-top))`;
				editorContainer.scrollTop = scrollTop;
				ev.showCaret();
			}
		});
	} else {
		editorContainer.focus();
	}
	
	window.addEventListener('scroll', function(e) {
		e.preventDefault();
		window.scrollTo(0, 0);
	}, false);

	// Control events
	document.getElementById('exec-speed').addEventListener('change', function(e) {
		options.execSpeed = parseInt(this.value)
		settingView.save();
	}, false);

	document.getElementById('ctrl-container').addEventListener(touchstart, function(e) {
		const x = (touchstart === 'mousedown') ? e.x : e.touches[0].clientX;
		const y = (touchstart === 'mousedown') ? e.y : e.touches[0].clientY;
		const element = document.elementFromPoint(x, y);
		if (element === this) {
			e.preventDefault();
		}
	}, false);

	// Key events for mobile
	document.getElementById('key-container').addEventListener(touchstart, function(e) {
		const x = (touchstart === 'mousedown') ? e.x : e.touches[0].clientX;
		const y = (touchstart === 'mousedown') ? e.y : e.touches[0].clientY;
		const element = document.elementFromPoint(x, y);
		if (element === this) {
			e.preventDefault();
		}
	}, false);

	document.getElementById('key-undo').addEventListener(touchstart, function(e) {
		e.preventDefault();
		ev.undo();
	}, false);
	document.getElementById('key-redo').addEventListener(touchstart, function(e) {
		e.preventDefault();
		ev.redo();
	}, false);

	let repeat = null;
	function keyRepeat(move, time) {
		repeat = setTimeout(function() {
			ev.moveCaret(move);
			keyRepeat(move, 50);
		}, time);
	}
	document.getElementById('key-left').addEventListener(touchstart, function(e) {
		e.preventDefault();
		if (repeat) {
			return;
		}
		ev.moveCaret(-1);
		keyRepeat(-1, 500);
	}, false);
	document.getElementById('key-left').addEventListener(touchend[0], function(e) {
		if (repeat) {
			clearTimeout(repeat);
			repeat = null;
		}
	}, false);
	document.getElementById('key-right').addEventListener(touchstart, function(e) {
		e.preventDefault();
		if (repeat) {
			return;
		}
		ev.moveCaret(1);
		keyRepeat(1, 500);
	}, false);
	document.getElementById('key-right').addEventListener(touchend[0], function(e) {
		if (repeat) {
			clearTimeout(repeat);
			repeat = null;
		}
	}, false);

	document.getElementById('key-paste').addEventListener('mousedown', function(e) {
		e.preventDefault();
		document.getElementById('editor').focus();
	}, false);
	document.getElementById('key-paste').addEventListener('click', function(e) {
		e.preventDefault();
		document.getElementById('editor').focus();
		ev.restoreSelect();
		navigator.clipboard.readText().then(function(str) {
			ev.deleteSelect();
			ev.insertText(str.replace(/\r/g, ''));
		}).catch(function(err) {
			document.execCommand('paste');
		});
	}, false);

	document.getElementById('key-tab').addEventListener(touchstart, function(e) {
		e.preventDefault();
		ev.inputTab(e.shiftKey);
	}, false);

	document.getElementById('key-close').addEventListener(touchstart, function(e) {
		e.preventDefault();
		document.getElementById('editor').blur();
	}, false);

	// Menu events
	document.querySelector('.menu-btn').addEventListener('keydown', function(e) {
		if (e.key === 'Enter') {
			const menuToggle = document.getElementById('menu-toggle');
			menuToggle.checked = !menuToggle.checked;
		}
	}, false);
	document.addEventListener('click', function(e) {
		const menuToggle = document.getElementById('menu-toggle');
		if (!menuToggle.checked) {
			return;
		}
		if (e.target.closest('.menu, .menu-btn, .menu-toggle')) {
			return;
		}
		menuToggle.checked = false;
	}, false);
	document.querySelectorAll('.menu ul li a').forEach(async function(item) {
		item.addEventListener('click', async function(e) {
			const menuToggle = document.getElementById('menu-toggle');
			if (!menuToggle.checked) {
				return;
			}
			switch (e.target.id) {
			case 'menu-new':
				if (ev.currentContent.modify && !window.confirm(resource.MSG_NEW)) {
					break;
				}
				ev.setText('', '');
				document.title = baseTitle;
				history.replaceState('', '', location.pathname);
				break;
			case 'menu-online-open':
				if (ev.currentContent.modify && !window.confirm(resource.MSG_NEW)) {
					break;
				}
				await onlineOpenView.show();
				break;
			case 'menu-online-save':
				await onlineSaveView.show();
				break;
			case 'menu-local-open':
				await fileOpen();
				break;
			case 'menu-local-save':
				await fileSave();
				break;
			case 'menu-exec-to-cursor':
				document.getElementById('menu-toggle').checked = false;
				await execToCursor();
				break;
			case 'menu-clear':
				vv.clear();
				cv.clear();
				break;
			case 'menu-setting':
				settingView.show();
				break;
			case 'menu-tutorial':
				if (!window.open(resource.TUTORIAL_URL, '_blank')) {
					location.href = resource.TUTORIAL_URL;
				}
				break;
			}
			document.getElementById('menu-toggle').checked = false;
		}, false);
	});

	async function fileOpen() {
		if (ev.currentContent.modify && !window.confirm(resource.MSG_NEW)) {
			return;
		}
		if (window.showSaveFilePicker) {
			let handle;
			try {
				handle = await window.showOpenFilePicker({
					types: [{description: 'PG0 File', accept: {'text/pg0': ['.pg0']}}],
					multiple: false
				});
			} catch(err) {
				return;
			}
			try {
				const file = await handle[0].getFile();
				const text = await file.text();
				ev.setText(text, file.name);
				document.title = baseTitle + ' - ' + file.name;
				editorContainer.scrollTop = 0;
				editorContainer.scrollLeft = 0;
				history.replaceState('', '', location.pathname);
			} catch(err) {
				console.error(err);
				alert(err);
			}
		} else {
			const fileInput = document.getElementById('file-input');
			fileInput.value = '';
			await fileInput.click();
		}
	}
	document.getElementById('file-input').addEventListener('change', function(e) {
		const file = e.target.files[0];
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = function(le) {
			ev.setText(le.target.result, file.name);
			document.title = baseTitle + ' - ' + file.name;
		};
		reader.onerror = function(err) {
			console.error(err);
			alert(err);
		};
		reader.readAsText(file);
		history.replaceState('', '', location.pathname);
	}, false);

	async function fileSave() {
		if (window.showSaveFilePicker) {
			let handle;
			try {
				handle = await window.showSaveFilePicker({
					suggestedName: ev.currentContent.name || 'script.pg0',
					types: [{description: 'PG0 File', accept: {'text/pg0': ['.pg0']}}]
				});
			} catch(err) {
				return;
			}
			try {
				const stream = await handle.createWritable();
				const blob = new Blob([ev.getText().replace(/\n/g, "\r\n")], {type: 'text/pg0; charset=UTF-8'});
				await stream.write(blob);
				await stream.close();
				ev.currentContent.modify = false;
				ev.currentContent.name = handle.name;
				ev.saveState();
				document.title = baseTitle + ' - ' + handle.name;
			} catch(err) {
				console.error(err);
				alert(err);
			}
		} else {
			const fileName = window.prompt(resource.MSG_SAVE, ev.currentContent.name || 'script.pg0');
			if (!fileName) {
				return;
			}
			const blob = new Blob([ev.getText().replace(/\n/g, "\r\n")], {type: 'text/pg0; charset=UTF-8'});
			const url = (window.URL || window.webkitURL).createObjectURL(blob);
			const a = document.createElement('a');
			a.download = fileName;
			a.href = url;
			document.body.appendChild(a);
			setTimeout(function() {
				a.click();
				document.body.removeChild(a);
				ev.currentContent.modify = false;
				ev.currentContent.name = fileName;
				ev.saveState();
				document.title = baseTitle + ' - ' + fileName;
			}, 0);
		}
	}

	function getUrlParam() {
		var arg = new Object;
		var pair = location.search.substring(1).split('&');
		for(var i = 0; pair[i]; i++) {
			var kv = pair[i].split('=');
			arg[kv[0]] = decodeURIComponent(kv[1]);
		}
		return arg;
	}
	setTimeout(async function() {
		const param = getUrlParam();
		if (param.cid && ev.currentContent.cid !== param.cid &&
			(!ev.currentContent.modify || window.confirm(resource.MSG_NEW))) {
			await onlineOpenView.getScript(param.cid);
		}
	}, 100);

}, false);

// IO functions
ScriptExec.lib['error'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	cv.error(`${pg0_string.escapeHTML(str)}`);
	return 0;
};

ScriptExec.lib['print'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	cv.put(pg0_string.escapeHTML(str));
	return 0;
};

ScriptExec.lib['input'] = async function(ei, param, ret) {
	const str = window.prompt('input');
	if (str !== null) {
		ret.v.str = str;
		ret.v.type = TYPE_STRING;
	}
	return 0;
};

// Exec script
let run = false;
let step = false;
let execLine = -1;
let nextStep = true;
let stopStep = -1;

async function execToCursor() {
	stopStep = ev.getCaretLineIndex();
	await exec(true);
}

async function exec(_step) {
	if (run) {
		if (_step) {
			step = true;
		} else if (step) {
			step = false;
		}
		nextStep = true;
		return;
	}
	const buf = ev.getText();
	if (!buf) {
		return;
	}
	run = true;
	step = _step;
	execLine = -1;
	nextStep = false;
	document.getElementById('editor').setAttribute('contenteditable', 'false');
	if (document.getElementById('console').childElementCount > 0) {
		cv.put('<hr />');
	}
	cv.info(resource.CONSOLE_START);
	document.getElementById('stop-button').removeAttribute('disabled');
	vv.clear();
	const elm = document.getElementsByClassName('lib');
	if (0 < elm.length) {
		Array.from(elm).forEach(function(v) {
			return v.remove();
		});
	}
	const extension = options.execMode === 'PG0' ? false : true;
	const sci = Script.initScriptInfo(buf, {extension: extension});
	const scis = [sci];
	await _exec(scis, sci, false);
	document.getElementById('stop-button').setAttribute('disabled', true);
	document.getElementById('editor').setAttribute('contenteditable', 'true');
	stopStep = -1;
	run = false;

	const ua = user_agent.get();
	if (!ua.isiOS && !ua.isAndroid) {
		document.getElementById('editor').focus();
	}
}

async function loadScript(file) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.classList.add('lib');
		script.src = file;
		script.onload = () => resolve(script);
		script.onerror = () => reject(new Error('Script load error'));
		document.head.appendChild(script);
	});
}

async function _exec(scis, sci, imp) {
	const sp = new ScriptParse(sci);
	try {
		await sp.parse(sci.src, {
			import: async function(file) {
				if (/\.pg0$/i.test(file)) {
					let res;
					let buf;
					try {
						const url = (/(^https:\/\/)|(^http:\/\/)/i.test(file)) ? apiServer + '/import/?url=' + file : file;
						res = await fetch(url);
						if (!res.ok) {
							return -1;
						}
						buf = await res.text();
					} catch(e) {
						console.error(e);
						return -1;
					}
					const _sci = Script.initScriptInfo(buf, {extension: true});
					scis.push(_sci);
					await _exec(scis, _sci, true);
					if (_sci.ei) {
						_sci.ei.imp = true;
					}
				} else {
					try {
						await loadScript(file);
					} catch(e) {
						console.error(e);
						return -1;
					}
				}
				return 0;
			},
			success: async function(token) {
				const se = new ScriptExec(scis, sci);
				try {
					let syncCnt = 0;
					let sameCnt = 0;
					await se.exec(token, {}, {
						callback: async function(ei) {
							let wk = ei;
							for (; wk.parent; wk = wk.parent);
							if (imp || wk.imp) {
								syncCnt++;
								if (syncCnt > 1000) {
									await new Promise(resolve => setTimeout(resolve, 0));
									syncCnt = 0;
								}
								return 0;
							}
							if (ei.token[ei.index].line >= 0 && execLine !== ei.token[ei.index].line) {
								sameCnt = 0;
								execLine = ei.token[ei.index].line;
								if (step && (stopStep === -1 || stopStep === execLine)) {
									stopStep = -1;
									ev.setHighlight(execLine, '#00ffff');
									vv.set(ei);
									while (!nextStep && run) {
										await new Promise(resolve => setTimeout(resolve, 100));
									}
									nextStep = false;
								} else {
									const speed = options.execSpeed;
									if (speed === 0 || stopStep !== -1) {
										syncCnt++;
										if (syncCnt > 1000) {
											await new Promise(resolve => setTimeout(resolve, 0));
											syncCnt = 0;
										}
									} else {
										ev.setHighlight(execLine, '#00ffff');
										vv.set(ei);
										await new Promise(resolve => setTimeout(resolve, speed));
									}
								}
							} else if (execLine === ei.token[ei.index].line) {
								sameCnt++;
								if (sameCnt > 100) {
									await new Promise(resolve => setTimeout(resolve, 0));
									sameCnt = 0;
								}
							}
							if (!run) {
								return 1;
							}
							return 0;
						},
						success: async function(value) {
							if (imp) {
								return;
							}
							if (run) {
								cv.info(resource.CONSOLE_END);
							} else {
								cv.info(resource.CONSOLE_STOP);
							}
							if (value) {
								if (value.type === TYPE_INTEGER || value.type === TYPE_FLOAT) {
									cv.info(resource.CONSOLE_RESULT, pg0_string.escapeHTML(ScriptExec.getValueString(value)));
								} else if (value.type === TYPE_STRING) {
									cv.info(resource.CONSOLE_RESULT, `"${pg0_string.escapeHTML(ScriptExec.getValueString(value))}"`);
								} else if (value.type === TYPE_ARRAY) {
									cv.info(resource.CONSOLE_RESULT, `{${pg0_string.escapeHTML(pg0_string.arrayToString(value.array))}}`);
								}
							}
							if (run) {
								vv.set(sci.ei);
							}
							ev.unsetHighlight();
						},
						error: async function(error) {
							ev.setHighlight(error.line, '#ffb6c1');
							cv.error(`Error: ${error.msg} (${error.line + 1}): ${pg0_string.escapeHTML(error.src)}`);
							cv.info(resource.CONSOLE_END);
						}
					});
				} catch(e) {
					cv.error(`Error: ${e.message}`);
					cv.info(resource.CONSOLE_END);
				}
			},
			error: async function(error) {
				ev.setHighlight(error.line, '#ffb6c1');
				cv.error(`Error: ${error.msg} (${error.line + 1}): ${pg0_string.escapeHTML(error.src)}`);
				cv.info(resource.CONSOLE_END);
			}
		});
	} catch(e) {
		cv.error(`Error: ${e.message}`);
		cv.info(resource.CONSOLE_END);
	}
}

function stop() {
	run = false;
}
