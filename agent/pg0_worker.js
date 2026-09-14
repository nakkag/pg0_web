"use strict";
// Worker thread that runs one PG0 / PG0.5 program inside a vm sandbox.
// The browser interpreter (public/dev/pg0/*.js) is loaded unchanged into
// an isolated context; print/error/input and the io library are provided
// by host hooks so that everything is captured and returned as JSON.

const {parentPort, workerData} = require('worker_threads');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const DEV_DIR = path.join(__dirname, '..', 'public', 'dev');

const INTERPRETER_FILES = [
	'pg0/script_common.js',
	'pg0/script_parse.js',
	'pg0/script_exec.js',
	'utils/pg0_string.js'
];

const ALLOWED_JS_LIBS = {
	'lib/math.js': 'file',
	'lib/string.js': 'file',
	'lib/io.js': 'server-io',
	'lib/screen.js': 'headless-screen'
};

const HEADLESS_SCREEN_FILE = path.join(__dirname, 'lib', 'screen_headless.js');

// print / error / input are always available (defined by the editor in the browser).
const BASE_LIB_SOURCE = `
ScriptExec.lib['error'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}';
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	__host.error(str);
	return 0;
};
ScriptExec.lib['print'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}';
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	__host.print(str);
	return 0;
};
ScriptExec.lib['input'] = async function(ei, param, ret) {
	const str = __host.input();
	if (str !== null) {
		ret.v.str = str;
		ret.v.type = TYPE_STRING;
		delete ret.v.num;
	}
	return 0;
};
`;

// Server side implementation of lib/io.js (no browser storage or clipboard).
const SERVER_IO_SOURCE = `
ScriptExec.lib['println'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}';
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	__host.print(str + '\\n');
	return 0;
};
const __ioStore = __host.storage;
function __ioKey(param) {
	if (param[0].v.type === TYPE_ARRAY) {
		return '{' + pg0_string.arrayToString(param[0].v.array) + '}';
	}
	return ScriptExec.getValueString(param[0].v);
}
ScriptExec.lib['savevalue'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	__ioStore[__ioKey(param)] = JSON.stringify(param[1].v);
	return 0;
};
ScriptExec.lib['loadvalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	const str = __ioStore[__ioKey(param)];
	if (str) {
		ret.v = JSON.parse(str);
	}
	return 0;
};
ScriptExec.lib['removevalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	delete __ioStore[__ioKey(param)];
	return 0;
};
let __clipboard = '';
ScriptExec.lib['get_clipboard'] = async function(ei, param, ret) {
	ret.v.str = __clipboard;
	ret.v.type = TYPE_STRING;
	delete ret.v.num;
	return 0;
};
ScriptExec.lib['set_clipboard'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	if (param[0].v.type === TYPE_ARRAY) {
		__clipboard = ScriptExec.arrayToString(param[0].v.array);
	} else {
		__clipboard = ScriptExec.getValueString(param[0].v);
	}
	ret.v.num = 1;
	ret.v.type = TYPE_INTEGER;
	return 0;
};
`;

function readDevFile(rel) {
	return fs.readFileSync(path.join(DEV_DIR, rel), 'utf8');
}

function runSource(context, source, filename) {
	new vm.Script(source, {filename: filename}).runInContext(context);
}

// Converts an interpreter value into plain JSON.
// Arrays with any named element become objects; unnamed elements use their index as key.
function valueToJson(v, depth) {
	if (!v) {
		return null;
	}
	depth = depth || 0;
	if (depth > 64) {
		return null;
	}
	switch (v.type) {
	case 0:
	case 1:
		return (typeof v.num === 'number' && isFinite(v.num)) ? v.num : (v.num === null ? null : String(v.num));
	case 2:
		return v.str || '';
	case 3: {
		const arr = v.array || [];
		const hasKey = arr.some(function(a) { return a && a.name; });
		if (hasKey) {
			const obj = {};
			arr.forEach(function(a, i) {
				obj[(a && a.name) ? a.name : String(i)] = valueToJson(a && a.v, depth + 1);
			});
			return obj;
		}
		return arr.map(function(a) { return valueToJson(a && a.v, depth + 1); });
	}
	}
	return null;
}

// Converts plain JSON into an interpreter value ({type, num|str|array}).
function jsonToValue(j) {
	if (j === null || j === undefined || typeof j === 'boolean') {
		return {type: 0, num: j ? 1 : 0};
	}
	if (typeof j === 'number') {
		return Number.isInteger(j) ? {type: 0, num: j | 0} : {type: 1, num: j};
	}
	if (typeof j === 'string') {
		return {type: 2, str: j};
	}
	if (Array.isArray(j)) {
		return {type: 3, array: j.map(function(e) { return {name: '', v: jsonToValue(e)}; })};
	}
	if (typeof j === 'object') {
		return {type: 3, array: Object.keys(j).map(function(k) { return {name: k, v: jsonToValue(j[k])}; })};
	}
	return {type: 0, num: 0};
}

function typeName(v) {
	if (!v) {
		return null;
	}
	return ['integer', 'float', 'string', 'array'][v.type] || null;
}

async function main() {
	const opt = workerData;
	const startTime = Date.now();
	const deadline = startTime + opt.timeoutMs;
	const maxSteps = opt.maxSteps;
	const maxOutput = opt.maxOutputLength;

	let output = '';
	let pending = '';
	let outputLength = 0;
	let outputTruncated = false;
	let errorOutput = '';
	let steps = 0;
	let stopReason = null;
	const inputLines = opt.input.slice();
	let inputUsed = 0;
	const importErrors = [];

	function flush(force) {
		if (pending && (force || pending.length > 8192)) {
			parentPort.postMessage({type: 'output', text: pending});
			pending = '';
		}
	}

	const host = {
		print: function(str) {
			if (outputLength + str.length > maxOutput) {
				str = str.substring(0, Math.max(0, maxOutput - outputLength));
				outputTruncated = true;
			}
			if (str) {
				output += str;
				pending += str;
				outputLength += str.length;
				flush(false);
			}
		},
		error: function(str) {
			if (errorOutput.length < maxOutput) {
				errorOutput += str + '\n';
			}
		},
		input: function() {
			if (inputUsed < inputLines.length) {
				return inputLines[inputUsed++];
			}
			return null;
		}
	};

	// Headless screen: virtual clock, input timelines and optional call recording.
	const screenOpt = opt.screen || {};
	const touchTimeline = (screenOpt.touch || []).slice();
	const keyTimeline = (screenOpt.keys || []).slice();
	const recordCalls = !!screenOpt.record;
	const maxCalls = screenOpt.max_calls;
	const recordFrames = screenOpt.record_frames || null;
	const recordFunctions = screenOpt.record_functions ? screenOpt.record_functions.map(function(f) { return String(f).toLowerCase(); }) : null;
	const recordImageFrames = !!screenOpt.record_image_frames;
	let frameSteps = 0;
	let maxFrameSteps = 0;
	const storage = {};
	Object.keys(opt.storage || {}).forEach(function(k) {
		storage[k] = JSON.stringify(jsonToValue(opt.storage[k]));
	});
	let ioLoaded = false;
	const screen = {
		loaded: false,
		started: false,
		width: 0,
		height: 0,
		background: null,
		fit: 1,
		offscreen: 0,
		frames: 0,
		virtualMs: 0,
		baseTime: Date.now(),
		calls: 0,
		images: [],
		record: [],
		recordTruncated: false,
		currentFrame: null
	};
	let pendingStop = null;

	// Timeline entries are evaluated in the given order; an entry applies from its
	// virtual time (ms) or frame index on. Pulse entries (tap/hold) are active for a
	// number of frames starting at the first frame in which they became due.
	// Virtual time at which each frame started, to compare frame-based and ms-based entries.
	const frameStart = [0];
	function entryDue(e) {
		return (e.frame !== undefined) ? screen.frames >= e.frame : screen.virtualMs >= e.ms;
	}
	function dueTime(e) {
		return (e.frame !== undefined) ? frameStart[e.frame] : e.ms;
	}
	function activatePulses(list) {
		list.forEach(function(e) {
			if (e.frames !== undefined && e.startFrame === undefined && entryDue(e)) {
				e.startFrame = screen.frames;
			}
		});
	}
	function pulseActive(e) {
		return e.frames !== undefined && e.startFrame !== undefined && screen.frames < e.startFrame + e.frames;
	}
	// The state entry that became due last wins, whatever the order in the request.
	function timelineState(list) {
		let cur = null;
		let curTime = -1;
		list.forEach(function(e) {
			if (e.frames === undefined && entryDue(e) && dueTime(e) >= curTime) {
				cur = e;
				curTime = dueTime(e);
			}
		});
		return cur;
	}

	const screenHost = {
		start: function(w, h, color, fit) {
			screen.started = true;
			screen.width = w;
			screen.height = h;
			screen.background = color;
			screen.fit = fit;
			screen.images = [];
		},
		sleep: function(ms) {
			screen.virtualMs += ms;
			screen.frames++;
			frameStart[screen.frames] = screen.virtualMs;
			screen.currentFrame = null;
			screen.pendingCalls = [];
			screen.frameForced = false;
			if (frameSteps > maxFrameSteps) {
				maxFrameSteps = frameSteps;
			}
			frameSteps = 0;
			activatePulses(touchTimeline);
			activatePulses(keyTimeline);
			if (opt.maxFrames !== null && screen.frames >= opt.maxFrames) {
				pendingStop = 'frame_limit';
			}
			if (opt.maxVirtualMs !== null && screen.virtualMs >= opt.maxVirtualMs) {
				pendingStop = 'virtual_time_limit';
			}
		},
		time: function() {
			// Advances by one millisecond per call so that busy-wait loops on time() terminate.
			screen.virtualMs += 1;
			if (opt.maxVirtualMs !== null && screen.virtualMs >= opt.maxVirtualMs) {
				pendingStop = 'virtual_time_limit';
			}
			return screen.baseTime + screen.virtualMs;
		},
		offscreen: function(flag) {
			screen.offscreen = flag;
		},
		createImage: function(w, h, id) {
			if (id >= 0 && id < screen.images.length) {
				screen.images[id] = {width: w, height: h};
				return id;
			}
			screen.images.push({width: w, height: h});
			return screen.images.length - 1;
		},
		hasImage: function(id) {
			return id >= 0 && id < screen.images.length;
		},
		pixel: function() {
			return [0, 0, 0];
		},
		touch: function() {
			activatePulses(touchTimeline);
			let t = null;
			touchTimeline.forEach(function(e) {
				if (pulseActive(e)) {
					t = e;
				}
			});
			if (t) {
				return {x: t.x, y: t.y, touch: 1, button: t.button || 0, pos: [{x: t.x, y: t.y}]};
			}
			t = timelineState(touchTimeline);
			if (!t) {
				return {x: 0, y: 0, touch: 0, button: 0, pos: []};
			}
			const touching = t.touch ? 1 : 0;
			return {x: t.x, y: t.y, touch: touching, button: touching ? (t.button || 0) : 0, pos: touching ? [{x: t.x, y: t.y}] : []};
		},
		keys: function() {
			activatePulses(keyTimeline);
			const k = timelineState(keyTimeline);
			const held = k ? k.keys.slice() : [];
			keyTimeline.forEach(function(e) {
				if (pulseActive(e)) {
					e.keys.forEach(function(key) {
						if (held.indexOf(key) < 0) {
							held.push(key);
						}
					});
				}
			});
			return held;
		},
		record: function(name, args) {
			screen.calls++;
			if (!recordCalls) {
				return;
			}
			const call = {fn: name, args: args};
			const inRange = !recordFrames || (screen.frames >= recordFrames.from && screen.frames <= recordFrames.to);
			const fnOk = !recordFunctions || recordFunctions.indexOf(name.toLowerCase()) >= 0;
			// A frame that creates an image is recorded completely (with the calls before createImage)
			// so that the image can be reproduced even outside record_frames / record_functions.
			if (recordImageFrames && name.toLowerCase() === 'createimage' && !screen.frameForced) {
				screen.frameForced = true;
				(screen.pendingCalls || []).forEach(function(c) { push(c); });
				screen.pendingCalls = [];
			}
			if (screen.frameForced || (inRange && fnOk)) {
				push(call);
			} else if (recordImageFrames) {
				screen.pendingCalls = screen.pendingCalls || [];
				screen.pendingCalls.push(call);
			}
			function push(c) {
				screen.recorded = (screen.recorded || 0) + 1;
				if (screen.recorded > maxCalls) {
					screen.recordTruncated = true;
					return;
				}
				if (!screen.currentFrame) {
					screen.currentFrame = {frame: screen.frames, ms: screen.virtualMs, calls: []};
					screen.record.push(screen.currentFrame);
				}
				screen.currentFrame.calls.push(c);
			}
		}
	};

	const sandbox = {
		navigator: {language: opt.lang === 'ja' ? 'ja' : 'en'},
		console: {log: function() {}, error: function() {}, warn: function() {}},
		__host: host
	};
	host.screen = screenHost;
	host.storage = storage;
	const context = vm.createContext(sandbox);
	INTERPRETER_FILES.forEach(function(f) {
		runSource(context, readDevFile(f), f);
	});
	runSource(context, BASE_LIB_SOURCE, 'base_lib.js');

	// Top-level const/function declarations live in the context's script scope,
	// so they are fetched with an expression instead of as global properties.
	const {Script, ScriptParse, ScriptExec} = vm.runInContext('({Script, ScriptParse, ScriptExec})', context);

	const scis = [];

	function normalizeImport(file) {
		let f = String(file).trim().replace(/\\/g, '/');
		f = f.replace(/[?#].*$/, '');
		f = f.replace(/^(\.\/)+/, '');
		f = f.replace(/^\/?dev\//, '');
		return f.toLowerCase();
	}

	async function importFile(file) {
		const f = normalizeImport(file);
		if (/\.pg0$/.test(f)) {
			if (!/^lib\/[a-z0-9_]+\.pg0$/.test(f)) {
				importErrors.push(`#import("${file}"): only library files under lib/ can be imported by the API`);
				return -1;
			}
			let buf;
			try {
				buf = readDevFile(f);
			} catch (e) {
				importErrors.push(`#import("${file}"): library not found`);
				return -1;
			}
			const _sci = Script.initScriptInfo(buf, {extension: true});
			scis.push(_sci);
			const ok = await execScript(_sci, true);
			if (_sci.ei) {
				_sci.ei.imp = true;
			}
			return ok ? 0 : -1;
		}
		const kind = ALLOWED_JS_LIBS[f];
		if (kind === 'file') {
			runSource(context, readDevFile(f), f);
			if (f === 'lib/math.js' && opt.seed !== null) {
				// Same as calling random(seed) once before the program starts (its value is discarded).
				ScriptExec.lib['random'](null, [{name: '', v: {type: 2, str: opt.seed}}], ScriptExec.initValueInfo());
			}
			return 0;
		}
		if (kind === 'server-io') {
			runSource(context, SERVER_IO_SOURCE, 'server_io.js');
			ioLoaded = true;
			return 0;
		}
		if (kind === 'headless-screen') {
			runSource(context, fs.readFileSync(HEADLESS_SCREEN_FILE, 'utf8'), 'screen_headless.js');
			screen.loaded = true;
			return 0;
		}
		importErrors.push(`#import("${file}"): unknown library; available: lib/math.pg0, lib/string.pg0, lib/io.pg0`);
		return -1;
	}

	let lastLine = -1;
	let parseError = null;
	let execError = null;
	let resultValue = null;
	let hasResult = false;

	// Parses and executes one script info; returns true on success.
	async function execScript(sci, imported) {
		let ok = true;
		const sp = new ScriptParse(sci);
		await sp.parse(sci.src, {
			import: importFile,
			success: async function(token) {
				const se = new ScriptExec(scis, sci);
				const initialVars = {};
				if (!imported && opt.globals) {
					Object.keys(opt.globals).forEach(function(name) {
						initialVars[name] = jsonToValue(opt.globals[name]);
					});
				}
				await se.exec(token, initialVars, {
					callback: async function(ei) {
						steps++;
						frameSteps++;
						if (!imported) {
							const tk = ei.token[ei.index];
							if (tk && tk.line >= 0) {
								lastLine = tk.line;
							}
						}
						if (pendingStop) {
							stopReason = pendingStop;
							return 1;
						}
						if (steps > maxSteps) {
							stopReason = 'step_limit';
							return 1;
						}
						if ((steps & 1023) === 0 && Date.now() > deadline) {
							stopReason = 'timeout';
							return 1;
						}
						return 0;
					},
					success: async function(value) {
						if (!imported) {
							hasResult = true;
							resultValue = value;
						}
					},
					error: async function(error) {
						ok = false;
						if (imported) {
							importErrors.push(`library error: ${error.msg} (${error.src})`);
						} else if (!execError) {
							execError = error;
						}
					}
				});
			},
			error: async function(error) {
				ok = false;
				if (imported) {
					if (!/^#import/i.test(error.src || '')) {
						importErrors.push(`library error: ${error.msg} (${error.src})`);
					}
				} else if (!parseError) {
					parseError = error;
				}
			}
		});
		return ok;
	}

	function formatError(err, fallbackLine) {
		if (!err) {
			return null;
		}
		const line = (typeof err.line === 'number' && err.line >= 0) ? err.line : fallbackLine;
		return {
			message: err.msg || err.message || String(err),
			line: (typeof line === 'number' && line >= 0) ? line + 1 : null,
			source: (err.src !== undefined) ? err.src : null
		};
	}

	const mainSci = Script.initScriptInfo(opt.code, {extension: opt.mode !== 'PG0'});
	scis.push(mainSci);

	let status = 'ok';
	let error = null;
	try {
		await execScript(mainSci, false);
		if (parseError) {
			status = 'error';
			error = formatError(parseError, -1);
			error.phase = 'parse';
		} else if (execError) {
			status = 'error';
			error = formatError(execError, lastLine);
			error.phase = 'runtime';
		} else if (stopReason === 'frame_limit' || stopReason === 'virtual_time_limit') {
			// Expected stop of an endless game loop; not reported as an error.
			status = stopReason;
		} else if (stopReason) {
			status = stopReason;
			error = {
				message: stopReason === 'timeout' ? 'Execution timed out' : 'Step limit exceeded',
				line: lastLine >= 0 ? lastLine + 1 : null,
				source: null,
				phase: 'runtime'
			};
		}
		if (importErrors.length && error) {
			error.message += ' - ' + importErrors.join('; ');
		}
	} catch (e) {
		status = 'error';
		error = {
			message: (e && e.message) ? e.message : String(e),
			line: lastLine >= 0 ? lastLine + 1 : null,
			source: null,
			phase: 'runtime'
		};
	}

	let variables = null;
	if (opt.variables && mainSci.ei && mainSci.ei.vi) {
		variables = {};
		Object.keys(mainSci.ei.vi).forEach(function(name) {
			variables[name] = valueToJson(mainSci.ei.vi[name]);
		});
	}

	flush(true);
	parentPort.postMessage({
		type: 'done',
		status: status,
		output: output,
		output_truncated: outputTruncated,
		error_output: errorOutput,
		result: (status === 'ok' && hasResult && resultValue) ? valueToJson(resultValue) : null,
		result_type: (status === 'ok' && hasResult && resultValue) ? typeName(resultValue) : null,
		error: error,
		variables: variables,
		screen: screen.loaded ? {
			started: screen.started,
			width: screen.width,
			height: screen.height,
			background: screen.background,
			fit: screen.fit,
			frames: screen.frames,
			virtual_ms: screen.virtualMs,
			calls: screen.calls,
			images: screen.images.length,
			record: recordCalls ? screen.record : null,
			record_truncated: screen.recordTruncated
		} : null,
		storage: ioLoaded ? storageToJson() : null,
		stats: {
			steps: steps,
			elapsed_ms: Date.now() - startTime,
			input_lines_used: inputUsed,
			steps_per_frame: screen.frames > 0 ? {avg: Math.round(steps / screen.frames), max: Math.max(maxFrameSteps, frameSteps)} : null
		}
	});

	function storageToJson() {
		const out = {};
		Object.keys(storage).forEach(function(k) {
			try {
				out[k] = valueToJson(JSON.parse(storage[k]));
			} catch (e) {
				out[k] = null;
			}
		});
		return out;
	}
}

main().catch(function(e) {
	parentPort.postMessage({
		type: 'done',
		status: 'error',
		output: '',
		output_truncated: false,
		error_output: '',
		result: null,
		result_type: null,
		error: {message: (e && e.message) ? e.message : String(e), line: null, source: null, phase: 'internal'},
		variables: null,
		screen: null,
		storage: null,
		stats: {steps: 0, elapsed_ms: 0, input_lines_used: 0, steps_per_frame: null}
	});
});
