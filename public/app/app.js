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
//
// The page works offline: its service worker (serviceworker.js) keeps the
// page and the files it loads, and the compiled program is kept here, under
// a cache of its own, and asked for again with its ETag: the server answers
// 304 while the program has not changed, and with no network the copy kept
// is run. A program's manifest (/api/app/<cid>/manifest.json) lets it be
// added to a home screen as an app of its own.

// The libraries read these as in the editor (pg0.js): whether a run is on,
// the console, and the program's identity. pg0_app tells lib/screen.js that
// it draws for the app page.
const pg0_app = true;
let run = false;
let cv = null;
let ev = {currentContent: {cid: '', name: '', hash: '', modify: false}, getText: function() { return ''; }};

// the cache of the compiled programs (not the service worker's: it outlives its versions)
const PROGRAM_CACHE = 'pg0-app-programs';

function stop() {
	run = false;
}

document.addEventListener('DOMContentLoaded', async function() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('serviceworker.js', {scope: './'}).then(function (registration) {
			registration.onupdatefound = function() {
				registration.update();
			}
		}).catch(function (error) {
			console.error('serviceWorker error:', error);
		});
	}
	cv = new consoleView(document.getElementById('console'));

	const param = pg0_string.searchParams(location.search);
	const cid = param.cid || '';
	if (!/^[a-zA-Z0-9\-]+$/.test(cid)) {
		cv.error(pg0_string.escapeHTML(resource.APP_NO_CID));
		return;
	}
	// (the page served with no network is the one cached without a program: it gets the manifest of this one)
	if (!document.querySelector('link[rel="manifest"]')) {
		const link = document.createElement('link');
		link.rel = 'manifest';
		link.href = `${apiServer}/api/app/${encodeURIComponent(cid)}/manifest.json`;
		document.head.appendChild(link);
	}
	let prog;
	try {
		const res = await fetchProgram(`${apiServer}/api/app/${cid}`);
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
	// The parse trees come in the compact form of pack.js (loaded here when
	// the page did not: a page cached from before pack.js existed).
	if (prog.scripts && prog.format === 2) {
		if (typeof pg0_pack === 'undefined') {
			try {
				await loadScript('pack.js?v=1');
			} catch (e) {
				console.error(e);
				cv.error(pg0_string.escapeHTML(resource.ONLINE_ERROR_CONNECTION));
				return;
			}
		}
		prog.scripts = prog.scripts.map(pg0_pack.unpackScript);
	}
	// (the hash is what the relay of lib/net.pg0 compares with the saved program)
	ev.currentContent = {cid: prog.cid || cid, name: prog.name || '', hash: prog.hash || '', modify: false};
	// (the screen library draws over the page; the console is shown again when the run is over)
	if (prog.screen) {
		document.body.classList.add('screen');
	}
	await execProgram(prog);
}, false);

// The compiled program: from the server when it has changed (or was never
// had), else the copy kept in PROGRAM_CACHE, which also serves when the
// server cannot be reached. Returns the response to read the program from.
async function fetchProgram(url) {
	let store = null;
	let cached = null;
	if (typeof caches !== 'undefined') {
		try {
			store = await caches.open(PROGRAM_CACHE);
			cached = await store.match(url, {ignoreVary: true});
		} catch (e) {
			console.error(e);
			store = null;
		}
	}
	const headers = {};
	if (cached && cached.headers.get('ETag')) {
		headers['If-None-Match'] = cached.headers.get('ETag');
	}
	let res;
	try {
		// (no-store: the browser's own cache is not asked, the server is, with the ETag above)
		res = await fetch(url, {headers: headers, cache: 'no-store'});
	} catch (e) {
		if (cached) {
			return cached;
		}
		throw e;
	}
	if (cached && (res.status === 304 || res.status >= 500)) {
		return cached;
	}
	if (store) {
		try {
			if (res.ok) {
				await store.put(url, res.clone());
			} else if (res.status === 404) {
				await store.delete(url);
			}
		} catch (e) {
			console.error(e);
		}
	}
	return res;
}

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
		// (the libraries are the editor's, under /dev/)
		for (const lib of (prog.libraries || [])) {
			try {
				await loadScript('/dev/' + lib);
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
			// The run gives the page a turn (to draw, and to take input) as the
			// editor does with no wait between statements: after 1000 steps in
			// an imported part, else after 1000 new lines, or after 100 steps on
			// one line (a loop in a single line). Each turn costs a few
			// milliseconds (the browser clamps chained timers), so a turn at
			// every thousand steps would slow a drawing loop many times over.
			let syncCnt = 0;
			let sameCnt = 0;
			await se.exec(prog.scripts[i].token, {}, {
				callback: async function(ei) {
					if (!run) {
						return 1;
					}
					const tk = ei.token[ei.index];
					const l = tk ? tk.line : -1;
					if (imp) {
						syncCnt++;
						if (syncCnt > 1000) {
							await new Promise(resolve => setTimeout(resolve, 0));
							syncCnt = 0;
						}
					} else if (l >= 0 && line !== l) {
						sameCnt = 0;
						line = l;
						syncCnt++;
						if (syncCnt > 1000) {
							await new Promise(resolve => setTimeout(resolve, 0));
							syncCnt = 0;
						}
					} else if (line === l) {
						sameCnt++;
						if (sameCnt > 100) {
							await new Promise(resolve => setTimeout(resolve, 0));
							sameCnt = 0;
						}
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
