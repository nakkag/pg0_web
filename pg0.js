"use strict";

function escapeHTML(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
	document.getElementById('result').innerHTML += '<p class="error">' + escapeHTML(str) + '</p>';
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
	document.getElementById('result').innerHTML += escapeHTML(str).replace(/\\n/, '<br />');
	return 0;
};

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
			ret += '"' + a.v.str + '"';
		} else {
			ret += a.v.num;
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
			buf += '"' + escapeHTML(v.str) + '"'
		} else {
			buf += v.num;
		}
		buf += '<br />';
	}
	document.getElementById('variable').innerHTML += buf;
}

let run = false;
let step = false;
let execLine = -1;
let nextStep = true;

async function exec() {
	if (run && step) {
		step = false;
		nextStep = true;
		return;
	}
	run = true;
	step = false;
	execLine = -1;
	nextStep = false;
	document.getElementById('variable').innerHTML = '';
	const elm = document.getElementsByClassName('lib');
	if (0 < elm.length) {
		Array.from(elm).forEach(function(v) {
			return v.remove();
		});
	}
	const buf = document.getElementById('src').value;
	const sci = Script.initScriptInfo({extension: true});
	const scis = [sci];
	await _exec(scis, sci, buf, false);
	document.getElementById('result').innerHTML += '<hr />';
	run = false;
}

async function stepExec() {
	if (run) {
		nextStep = true;
		return;
	}
	run = true;
	step = true;
	execLine = -1;
	nextStep = false;
	document.getElementById('variable').innerHTML = '';
	const elm = document.getElementsByClassName('lib');
	if (0 < elm.length) {
		Array.from(elm).forEach(function(v) {
			return v.remove();
		});
	}
	const buf = document.getElementById('src').value;
	const sci = Script.initScriptInfo({extension: true});
	const scis = [sci];
	await _exec(scis, sci, buf, false);
	document.getElementById('result').innerHTML += '<hr />';
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

async function _exec(scis, sci, buf, imp) {
	const sp = new ScriptParse(sci);
	try {
		await sp.parse(buf, {
			import: async function(file) {
				const _buf = document.getElementById(file).value;
				const _sci = Script.initScriptInfo({extension: true});
				scis.push(_sci);
				await _exec(scis, _sci, _buf, false, true);
			},
			library: async function(file) {
				await loadScript(file);
			},
			success: async function(token) {
				//console.log(token);
				const se = new ScriptExec(scis, sci);
				try {
					let syncCnt = 0;
					await se.exec(token, {}, {
						callback: async function(ei) {
							//console.log('line=' + ei.token[ei.index].line + ', token=' + ei.token[ei.index].type + ', vi=' + JSON.stringify(ei.vi));
							if (step) {
								if (ei.token[ei.index].line >= 0 && execLine !== ei.token[ei.index].line) {
									execLine = ei.token[ei.index].line;
									document.getElementById('variable').innerHTML = '';
									showVariable(ei);
									while (!nextStep && run) {
										await new Promise(resolve => setTimeout(resolve, 100));
									}
									nextStep = false;
								}
							} else {
								syncCnt++;
								if (syncCnt > 1000) {
									await new Promise(resolve => setTimeout(resolve, 0));
									syncCnt = 0;
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
							if (value.type === TYPE_INTEGER || value.type === TYPE_FLOAT) {
								document.getElementById('result').innerHTML += '<p>Result: ' + value.num + '</p>';
							} else if (value.type === TYPE_STRING) {
								document.getElementById('result').innerHTML += '<p>Result: ' + escapeHTML(value.str) + '</p>';
							} else if (value.type === TYPE_ARRAY) {
								document.getElementById('result').innerHTML += '<p>Result: {' + escapeHTML(arrayToString(value.array)) + '}</p>';
							}
							document.getElementById('variable').innerHTML = '';
							showVariable(sci.ei);
						},
						error: async function(error) {
							document.getElementById('result').innerHTML += '<p class="error">Exec Error: ' + error.msg + ' (' + (error.line + 1) + ')</p>';
						}
					});
				} catch(e) {
					document.getElementById('result').innerHTML += '<p class="error">Exec Error: ' + e + '</p>';
				}
			},
			error: async function(error) {
				document.getElementById('result').innerHTML += '<p class="error">Parse Error: ' + error.msg + ' (' + (error.line + 1) + ')</p>';
			}
		});
	} catch(e) {
		document.getElementById('result').innerHTML += '<p class="error">Parse Error: ' + e + '</p>';
	}
}

function stop() {
	run = false;
}

function clearResult() {
	document.getElementById('variable').innerHTML = '';
	document.getElementById('result').innerHTML = '';
}
