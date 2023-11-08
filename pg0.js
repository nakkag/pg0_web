"use strict";

let verX = 400;
let verY = 150;
let consoleY = 150;

window.onload = function() {
	const resizeWith = document.body.style.getPropertyValue('--rezie-with') || '10px';

	document.getElementById('var_resizer_x').addEventListener('mousedown', function(e) {
		e.preventDefault();
		function resize(e) {
			verX = window.innerWidth - e.x - 2;
			document.getElementById('container').style.gridTemplateColumns = `1fr ${resizeWith} ${verX}px`;
		}
		document.addEventListener('mousemove', resize, false);
		['mouseup', 'mouseleave'].forEach(function(e) {
			document.addEventListener(e, function() {
				document.removeEventListener('mousemove', resize, false);
			}, false);
		});
	}, false);

	document.getElementById('var_resizer_y').addEventListener('mousedown', function(e) {
		e.preventDefault();
		function resize(e) {
			verY = (window.innerHeight - consoleY) - e.y - 2;
			document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${verY}px ${resizeWith} ${consoleY}px`;
		}
		document.addEventListener('mousemove', resize, false);
		['mouseup', 'mouseleave'].forEach(function(e) {
			document.addEventListener(e, function() {
				document.removeEventListener('mousemove', resize, false);
			}, false);
		});
	}, false);

	document.getElementById('var_resizer_y').addEventListener('touchstart', function(e) {
		e.preventDefault();
		console.log('touchstart');
		function resize(e) {
			verY = (window.innerHeight - consoleY) - e.touches[0].pageY - 2;
			document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${verY}px ${resizeWith} ${consoleY}px`;
		}
		document.addEventListener('touchmove', resize, false);
		['touchend'].forEach(function(e) {
			document.addEventListener(e, function() {
				document.removeEventListener('touchmove', resize, false);
			}, false);
		});
	}, false);

	document.getElementById('console_resizer').addEventListener('mousedown', function(e) {
		e.preventDefault();
		function resize(e) {
			if (window.innerWidth <= 480) {
				const tmp = consoleY;
				consoleY = window.innerHeight - e.y - 2;
				verY = verY - (consoleY - tmp);
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${verY}px ${resizeWith} ${consoleY}px`;
			} else {
				consoleY = window.innerHeight - e.y - 2;
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${consoleY}px`;
			}
		}
		document.addEventListener('mousemove', resize, false);
		['mouseup', 'mouseleave'].forEach(function(e) {
			document.addEventListener(e, function() {
				document.removeEventListener('mousemove', resize, false);
			}, false);
		});
	}, false);

	document.getElementById('console_resizer').addEventListener('touchstart', function(e) {
		e.preventDefault();
		console.log('touchstart');
		function resize(e) {
			if (window.innerWidth <= 480) {
				const tmp = consoleY;
				consoleY = window.innerHeight - e.touches[0].pageY - 2;
				verY = verY - (consoleY - tmp);
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${verY}px ${resizeWith} ${consoleY}px`;
			} else {
				consoleY = window.innerHeight - e.touches[0].pageY - 2;
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${consoleY}px`;
			}
		}
		document.addEventListener('touchmove', resize, false);
		['touchend'].forEach(function(e) {
			document.addEventListener(e, function() {
				document.removeEventListener('touchmove', resize, false);
			}, false);
		});
	}, false);

	let prev_orientation;
	window.addEventListener("resize", function(e) {
		if (window.orientation !== prev_orientation) {
			prev_orientation = window.orientation;
			if (window.orientation === 0) {
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${verY}px ${resizeWith} ${consoleY}px`;
			} else {
				document.getElementById('container').style.gridTemplateRows = `${getCtrlHeight()}px 1fr ${resizeWith} ${consoleY}px`;
			}
		}
	}, false);
}

function getCtrlHeight() {
	return document.getElementById('ctrl_container').offsetHeight;
}

ScriptExec.lib['error'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	consoleView.error(`${escapeHTML(str)}`);
	return 0;
};

ScriptExec.lib['print'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	consoleView.put(escapeHTML(str).replace(/\\n/, '<br />'));
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

function escapeHTML(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function arrayToString(array) {
	let ret = '';
	array.forEach(function(a) {
		if (ret) {
			ret = ret + ', ';
		}
		if (a.name) {
			ret += '"' + a.name + '": ';
		}
		if (a.v.type === TYPE_ARRAY) {
			ret += '{' + arrayToString(a.v.array) + '}';
		} else if (a.v.type === TYPE_STRING) {
			ret += '"' + ScriptExec.getValueString(a.v) + '"';
		} else {
			ret += ScriptExec.getValueString(a.v);
		}
	});
	return ret;
}

function showVariable(ei) {
	if (!ei) {
		return;
	}
	showVariable(ei.parent);
	
	let buf = '';
	for (let key in ei.vi) {
		const v = ei.vi[key];
		buf += escapeHTML(key) + ': ';
		if (v.type === TYPE_ARRAY) {
			buf += '{' + escapeHTML(arrayToString(v.array)) + '}'
		} else if (v.type === TYPE_STRING) {
			buf += '"' + escapeHTML(ScriptExec.getValueString(v)) + '"'
		} else {
			buf += escapeHTML(ScriptExec.getValueString(v));
		}
		buf += '<br />';
	}
	document.getElementById('variable').innerHTML += buf;
}

let run = false;
let step = false;
let execLine = -1;
let nextStep = true;

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
	const buf = document.getElementById('src').value;
	if (!buf) {
		return;
	}
	run = true;
	step = _step;
	execLine = -1;
	nextStep = false;
	if (document.getElementById('console').childElementCount > 0) {
		consoleView.put('<hr />');
	}
	consoleView.info(runMsg.CONSOLE_START);
	document.getElementById('stop_button').removeAttribute('disabled');
	document.getElementById('variable').innerHTML = '';
	const elm = document.getElementsByClassName('lib');
	if (0 < elm.length) {
		Array.from(elm).forEach(function(v) {
			return v.remove();
		});
	}
	const extension = document.getElementById('kind').value === 'PG0' ? false : true;
	const sci = Script.initScriptInfo(buf, {extension: extension});
	const scis = [sci];
	await _exec(scis, sci, false);
	document.getElementById('stop_button').setAttribute('disabled', true);
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
				//console.log(token);
				const se = new ScriptExec(scis, sci);
				try {
					let syncCnt = 0;
					await se.exec(token, {}, {
						callback: async function(ei) {
							//console.log(`line=${ei.token[ei.index].line}, token=${ei.token[ei.index].type}, vi=${JSON.stringify(ei.vi)}`);
							if (ei.token[ei.index].line >= 0 && execLine !== ei.token[ei.index].line) {
								execLine = ei.token[ei.index].line;
								if (step) {
									document.getElementById('variable').innerHTML = '';
									showVariable(ei);
									while (!nextStep && run) {
										await new Promise(resolve => setTimeout(resolve, 100));
									}
									nextStep = false;
								} else {
									const speed = parseInt(document.getElementById('speed').value);
									if (speed === 0) {
										syncCnt++;
										if (syncCnt > 1000) {
											await new Promise(resolve => setTimeout(resolve, 0));
											syncCnt = 0;
										}
									} else {
										document.getElementById('variable').innerHTML = '';
										showVariable(ei);
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
								consoleView.info(runMsg.CONSOLE_END);
							} else {
								consoleView.info(runMsg.CONSOLE_STOP);
							}
							if (value) {
								if (value.type === TYPE_INTEGER || value.type === TYPE_FLOAT) {
									consoleView.info(runMsg.CONSOLE_RESULT, escapeHTML(ScriptExec.getValueString(value)));
								} else if (value.type === TYPE_STRING) {
									consoleView.info(runMsg.CONSOLE_RESULT, `"${escapeHTML(ScriptExec.getValueString(value))}"`);
								} else if (value.type === TYPE_ARRAY) {
									consoleView.info(runMsg.CONSOLE_RESULT, `{${escapeHTML(arrayToString(value.array))}}`);
								}
							}
							if (run) {
								document.getElementById('variable').innerHTML = '';
								showVariable(sci.ei);
							}
						},
						error: async function(error) {
							consoleView.error(`Error: ${error.msg} (${error.line + 1}): ${error.src}`);
							consoleView.info(runMsg.CONSOLE_END);
						}
					});
				} catch(e) {
					consoleView.error(`Error: ${e.message}`);
					consoleView.info(runMsg.CONSOLE_END);
				}
			},
			error: async function(error) {
				consoleView.error(`Error: ${error.msg} (${error.line + 1}): ${error.src}`);
				consoleView.info(runMsg.CONSOLE_END);
			}
		});
	} catch(e) {
		consoleView.error(`Error: ${e.message}`);
		consoleView.info(runMsg.CONSOLE_END);
	}
}

function stop() {
	run = false;
}

function clearConsole() {
	document.getElementById('variable').innerHTML = '';
	document.getElementById('console').innerHTML = '';
}
