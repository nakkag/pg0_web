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
	'lib/screen.js': 'unavailable'
};

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
const __ioStore = {};
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

	const sandbox = {
		navigator: {language: opt.lang === 'ja' ? 'ja' : 'en'},
		console: {log: function() {}, error: function() {}, warn: function() {}},
		__host: host
	};
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
			return 0;
		}
		if (kind === 'server-io') {
			runSource(context, SERVER_IO_SOURCE, 'server_io.js');
			return 0;
		}
		if (kind === 'unavailable') {
			importErrors.push(`#import("${file}"): the screen library (lib/screen.pg0) is not available in the API; it needs a web browser`);
			return -1;
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
				await se.exec(token, {}, {
					callback: async function(ei) {
						steps++;
						if (!imported) {
							const tk = ei.token[ei.index];
							if (tk && tk.line >= 0) {
								lastLine = tk.line;
							}
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
		stats: {
			steps: steps,
			elapsed_ms: Date.now() - startTime,
			input_lines_used: inputUsed
		}
	});
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
		stats: {steps: 0, elapsed_ms: 0, input_lines_used: 0}
	});
});
