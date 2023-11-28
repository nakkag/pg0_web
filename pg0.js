"use strict";

let ev, vv, cv;

const baseTitle = document.title;

document.addEventListener('DOMContentLoaded', function() {
	const _rw = window.getComputedStyle(document.body).getPropertyValue('--resize-with');
	let rw = parseInt(_rw.replace(/[^0-9]/g, ''));
	const ua = user_agent.get();
	if (ua.isiOS || ua.isAndroid) {
		rw = 20;
		document.body.style.setProperty('--resize-with', rw + 'px');
	}

	ev = new editorView(document.getElementById('editor'), document.getElementById('line-number'));
	setTimeout(function() {
		ev.loadState();
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
	document.getElementById('exec_speed').setAttribute('title', resource.CTRL_EXEC_SPEED);
	for (let key in resource.EXEC_SPEED) {
		const op = document.createElement('option');
		op.value = key;
		op.textContent = resource.EXEC_SPEED[key];
		document.getElementById('exec_speed').append(op);
	}

	settingView.load();
	document.getElementById('exec_speed').value = options.execSpeed;
	vv.setBoundary(options.boundary.variable);

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
				document.getElementById('menu-toggle').checked = true;
				document.getElementById('menu_open').click();
			}
			break;
		case 's':
			if (e.ctrlKey) {
				e.preventDefault();
				document.getElementById('menu-toggle').checked = true;
				document.getElementById('menu_save').click();
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

	document.getElementById('var-resizer-x').addEventListener(touchstart, function(e) {
		if (e.cancelable) {
			e.preventDefault();
		}
		let x = e.x ? e.x : e.touches[0].clientX;
		resizeFunc = function(e) {
			const ex = e.x ? e.x : e.touches[0].clientX;
			options.boundary.verX += x - ex;
			if (options.boundary.verX < 0) {
				options.boundary.verX = 0;
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
		let y = e.y ? e.y : e.touches[0].clientY;
		resizeFunc = function(e) {
			const ey = e.y ? e.y : e.touches[0].clientY;
			options.boundary.verY += y - ey;
			if (options.boundary.verY < 0) {
				options.boundary.verY = 0;
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
			if (options.boundary.consoleY < 0) {
				options.boundary.consoleY = 0;
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

	touchend.forEach(function(e) {
		document.addEventListener(e, function() {
			if (resizeFunc) {
				document.removeEventListener(touchmove, resizeFunc, false);
				resizeFunc = null;
			}
		}, false);
	});

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

	let editFocus = false;
	function setGridTemplate() {
		if (editFocus) {
			document.getElementById('container').style.height = window.visualViewport.height + 'px';
			if (checkOrientation() === 0) {
				document.getElementById('container').style.gridTemplateRows = '58px 1fr 0px 0px 0px 0px max-content';
				document.getElementById('container').style.gridTemplateColumns = 'max-content 1fr';
			} else {
				document.getElementById('container').style.gridTemplateRows = '42px 1fr 0px 0px';
				document.getElementById('container').style.gridTemplateColumns = 'max-content 1fr 0px 0px max-content';
			}
		} else {
			document.getElementById('container').style.height = '100dvh';
			if (checkOrientation() === 0) {
				document.getElementById('container').style.gridTemplateRows = `58px 1fr ${rw}px ${options.boundary.verY}px ${rw}px ${options.boundary.consoleY}px 0`;
				document.getElementById('container').style.gridTemplateColumns = 'max-content 1fr';
			} else {
				document.getElementById('container').style.gridTemplateRows = `42px 1fr ${rw}px ${options.boundary.consoleY}px 0`;
				document.getElementById('container').style.gridTemplateColumns = `max-content 1fr ${rw}px ${options.boundary.verX}px`;
			}
		}
	}
	setGridTemplate();

	if (ua.isiOS || ua.isAndroid) {
		document.getElementById('editor').addEventListener('focus', function(e) {
			if (document.getElementById('editor').getAttribute('contenteditable') === 'false') {
				return;
			}
			editFocus = true;
			document.getElementById('container').classList.add('full');
			document.getElementById('editor-container').classList.add('full');
			document.getElementById('variable-container').classList.add('full');
			document.getElementById('console-container').classList.add('full');
			document.getElementById('key-container').classList.add('full');
			setGridTemplate();
		}, false);
		document.getElementById('editor').addEventListener('blur', function(e) {
			if (editFocus) {
				editFocus = false;
				document.getElementById('container').classList.remove('full');
				document.getElementById('editor-container').classList.remove('full');
				document.getElementById('variable-container').classList.remove('full');
				document.getElementById('console-container').classList.remove('full');
				document.getElementById('key-container').classList.remove('full');
				setGridTemplate();
				const node = ev.getLineNode(ev.getCaretLineIndex());
				if (node) {
					node.scrollIntoView({behavior: 'instant', block: 'nearest'});
				}
			}
		}, false);
		window.visualViewport.addEventListener('resize', function() {
			if (editFocus) {
				document.getElementById('container').style.height = window.visualViewport.height + 'px';
				ev.showCaret();
			} else {
				document.getElementById('container').style.height = '100dvh';
			}
		});
	} else {
		document.getElementById('editor-container').focus();
	}
	
	window.addEventListener('scroll', function(e) {
		e.preventDefault();
		window.scrollTo(0, 0);
	}, false);

	document.getElementById('exec_speed').addEventListener('change', function(e) {
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
		ev.deleteSelect();
		ev.insertText("\t");
	}, false);

	document.getElementById('key-close').addEventListener(touchstart, function(e) {
		e.preventDefault();
		document.getElementById('editor').blur();
	}, false);

	document.getElementById('menu-new').textContent = resource.MENU_NEW;
	document.getElementById('menu-open').textContent = resource.MENU_OPEN;
	document.getElementById('menu-save').textContent = resource.MENU_SAVE;
	document.getElementById('menu-run-to-cursor').textContent = resource.MENU_RUN_TO_CURSOR;
	document.getElementById('menu-clear').textContent = resource.MENU_CLEAR;
	document.getElementById('menu-setting').textContent = resource.MENU_SETTING;
	document.getElementById('menu-tutorial').textContent = resource.MENU_TUTORIAL;

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
				break;
			case 'menu-open':
				if (ev.currentContent.modify && !window.confirm(resource.MSG_NEW)) {
					break;
				}
				const fileInput = document.getElementById('file-input');
				fileInput.value = '';
				await fileInput.click();
				break;
			case 'menu-save':
				const fileName = window.prompt(resource.MSG_SAVE, ev.currentContent.name || 'script.pg0');
				if (!fileName) {
					document.getElementById('menu-toggle').checked = false;
					break;
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
					document.getElementById('menu-toggle').checked = false;
					ev.currentContent.modify = false;
					ev.currentContent.name = fileName;
					ev.saveState();
					document.title = baseTitle + ' - ' + fileName;
				}, 0);
				break;
			case 'menu-run-to-cursor':
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
			}
			if (e.target.id !== 'menu-save' && e.target.id !== 'menu-run-to-cursor') {
				document.getElementById('menu-toggle').checked = false;
			}
		}, false);
	});

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
	}, false);
}, false);

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
				if (!document.getElementById(file)) {
					return -1;
				}
				const _buf = document.getElementById(file).value;
				if (!_buf) {
					return 0;
				}
				const _sci = Script.initScriptInfo(_buf, {extension: true});
				scis.push(_sci);
				await _exec(scis, _sci, false, true);
				return 0;
			},
			library: async function(file) {
				try {
					await loadScript(file);
				} catch(e) {
					return -1;
				}
				return 0;
			},
			success: async function(token) {
				const se = new ScriptExec(scis, sci);
				try {
					let syncCnt = 0;
					await se.exec(token, {}, {
						callback: async function(ei) {
							if (ei.token[ei.index].line >= 0 && execLine !== ei.token[ei.index].line) {
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
