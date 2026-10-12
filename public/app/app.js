"use strict";

// /app/?cid=<cid>: runs a stored program as an app, the way an executable
// made by pg0gen.exe runs a program. The server (app_server.js) answers the
// program compiled: the parse trees the interpreter runs, of the program, of
// the scripts it imports and of the library .pg0 files, and the names of the
// JavaScript libraries to load. There is no editor and no source here.
//
// A program without a screen shows a console, with the start and the end of
// the run as the editor shows them. A program that uses the screen library
// shows the screen only while it runs; when it ends (or stops with an error)
// the screen goes and the console takes its place, so that what it printed
// and its error can be read and copied.

// The libraries read these as in the editor (pg0.js): whether a run is on,
// the console, and the program's identity. pg0_app tells lib/screen.js that
// it draws for the app page.
const pg0_app = true;
let run = false;
let cv = null;
let ev = {currentContent: {cid: '', name: '', hash: '', modify: false}, getText: function() { return ''; }};

function stop() {
	run = false;
}

document.addEventListener('DOMContentLoaded', async function() {
	cv = new consoleView(document.getElementById('console'));

	const param = pg0_string.searchParams(location.search);
	const cid = param.cid || '';
	if (!/^[a-zA-Z0-9\-]+$/.test(cid)) {
		cv.error(pg0_string.escapeHTML(resource.APP_NO_CID));
		return;
	}
	let prog;
	try {
		const res = await fetch(`${apiServer}/api/app/${cid}`);
		if (res.status === 404) {
			cv.error(pg0_string.escapeHTML(resource.ONLINE_ERROR_NOT_FOUND));
			return;
		}
		if (!res.ok) {
			cv.error(pg0_string.escapeHTML(`${res.statusText} (${res.status})`));
			return;
		}
		prog = await res.json();
	} catch (e) {
		console.error(e);
		cv.error(pg0_string.escapeHTML(resource.ONLINE_ERROR_CONNECTION));
		return;
	}
	if (prog.name) {
		document.title = prog.name;
	}
	// (the hash is what the relay of lib/net.pg0 compares with the saved program)
	ev.currentContent = {cid: prog.cid || cid, name: prog.name || '', hash: prog.hash || '', modify: false};
	// (the screen library draws over the page; the console is shown again when the run is over)
	if (prog.screen) {
		document.body.classList.add('screen');
	}
	await execProgram(prog);
}, false);

// IO functions, as the editor provides them
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
	cv.error(pg0_string.escapeHTML(str));
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

function loadScript(file) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.classList.add('lib');
		script.src = file;
		script.onload = () => resolve(script);
		script.onerror = () => reject(new Error('Script load error'));
		document.head.appendChild(script);
	});
}

// An error as the console shows it: the part it is in, the message and the
// line (there is no source to show).
function errorText(part, msg, line) {
	let text = 'Error: ';
	if (part) {
		text += `[${part}] `;
	}
	text += msg;
	if (typeof line === 'number' && line >= 0) {
		text += ` (${line + 1})`;
	}
	return text;
}

// Runs the compiled program: the imported parts first, in the order the
// editor would run them, then the program (pg0.js, _exec).
async function execProgram(prog) {
	function showError(part, msg, line) {
		cv.error(pg0_string.escapeHTML(errorText(part, msg, line)));
	}

	run = true;
	cv.info(resource.CONSOLE_START);
	let value = null;
	if (prog.errors) {
		// The program does not compile: the errors as the parser gives them
		// (the message keys are those of errMsg, in the language of this page).
		prog.errors.forEach(function(e) {
			showError(e.part, errMsg[e.key] || e.key, e.line);
		});
	} else {
		let ok = true;
		for (const lib of (prog.libraries || [])) {
			try {
				await loadScript(lib);
			} catch (e) {
				console.error(e);
				showError(lib, errMsg.ERR_SCRIPT, -1);
				ok = false;
				break;
			}
		}
		if (ok) {
			value = await execScripts(prog, showError);
		}
	}
	run = false;

	cv.info(resource.CONSOLE_END);
	if (value) {
		if (value.type === TYPE_INTEGER || value.type === TYPE_FLOAT) {
			cv.info(resource.CONSOLE_RESULT, pg0_string.escapeHTML(ScriptExec.getValueString(value)));
		} else if (value.type === TYPE_STRING) {
			cv.info(resource.CONSOLE_RESULT, `"${pg0_string.escapeHTML(ScriptExec.getValueString(value))}"`);
		} else if (value.type === TYPE_ARRAY) {
			cv.info(resource.CONSOLE_RESULT, `{${pg0_string.escapeHTML(pg0_string.arrayToString(value.array))}}`);
		}
	}
	// (lib/screen.js takes the screen away now that the run is over)
	document.body.classList.remove('screen');
}

// Returns the value the program ended with (exit), or null.
async function execScripts(prog, showError) {
	// The seeded random sequence of the previous run does not carry over
	delete ScriptExec.lib['$random'];
	const scis = prog.scripts.map(function(s) {
		return {name: s.name, src: '', ei: null, extension: !!s.extension, strict_val: !!s.strict};
	});
	let value = null;
	for (const i of prog.exec) {
		const sci = scis[i];
		const imp = (i !== 0);
		const part = imp ? sci.name : '';
		const se = new ScriptExec(scis, sci);
		let ok = true;
		let line = -1;
		try {
			let syncCnt = 0;
			await se.exec(prog.scripts[i].token, {}, {
				callback: async function(ei) {
					if (!run) {
						return 1;
					}
					const tk = ei.token[ei.index];
					if (tk && tk.line >= 0) {
						line = tk.line;
					}
					// (the page draws and answers input between the steps)
					syncCnt++;
					if (syncCnt > 1000) {
						await new Promise(resolve => setTimeout(resolve, 0));
						syncCnt = 0;
					}
					return run ? 0 : 1;
				},
				success: async function(v) {
					if (!imp) {
						value = v;
					}
				},
				error: async function(error) {
					ok = false;
					showError(part, error.msg, error.line);
				}
			});
		} catch (e) {
			console.error(e);
			ok = false;
			showError(part, e.message, line);
		}
		if (sci.ei && imp) {
			sci.ei.imp = true;
		}
		if (!ok) {
			return null;
		}
	}
	return value;
}
