"use strict";
// Runs PG0 / PG0.5 programs in isolated worker threads with time, step and memory limits.

const path = require('path');
const {Worker} = require('worker_threads');

const WORKER_FILE = path.join(__dirname, 'pg0_worker.js');

function clampInt(value, def, min, max) {
	let n = parseInt(value, 10);
	if (isNaN(n)) {
		n = def;
	}
	if (n < min) {
		n = min;
	}
	if (n > max) {
		n = max;
	}
	return n;
}

function normalizeInput(input) {
	if (input === undefined || input === null) {
		return [];
	}
	if (Array.isArray(input)) {
		return input.map(function(v) { return (v === null || v === undefined) ? '' : String(v); });
	}
	return String(input).replace(/\r\n/g, '\n').split('\n');
}

function optionalInt(value, min, max) {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	const n = parseInt(value, 10);
	if (isNaN(n)) {
		return null;
	}
	return Math.min(Math.max(n, min), max);
}

function toKeyList(v) {
	if (Array.isArray(v)) {
		return v.map(String);
	}
	if (v === undefined || v === null) {
		return [];
	}
	return [String(v)];
}

// Timeline entries: {ms | frame, ...}. Key entries hold "keys" (state) or "tap"/"hold" (pulse for
// "frames" frames, default 1). Touch entries hold x/y/touch/button (state) or "tap" (pulse).
function normalizeTimeline(list, kind) {
	if (!Array.isArray(list)) {
		return [];
	}
	const out = [];
	list.forEach(function(e) {
		if (!e || typeof e !== 'object') {
			return;
		}
		const entry = {};
		if (e.frame !== undefined && e.frame !== null) {
			const frame = parseInt(e.frame, 10);
			if (isNaN(frame) || frame < 0) {
				return;
			}
			entry.frame = frame;
		} else {
			const ms = Number(e.ms);
			if (!isFinite(ms) || ms < 0) {
				return;
			}
			entry.ms = ms;
		}
		const pulse = (e.tap !== undefined && e.tap !== null) || (e.hold !== undefined && e.hold !== null);
		if (pulse) {
			let frames = parseInt(e.frames, 10);
			if (isNaN(frames) || frames < 1) {
				frames = 1;
			}
			entry.frames = frames;
		}
		if (kind === 'touch') {
			const tap = (e.tap && typeof e.tap === 'object') ? e.tap : e;
			entry.x = Number(tap.x) || 0;
			entry.y = Number(tap.y) || 0;
			entry.button = Number(e.button) || 0;
			if (!pulse) {
				entry.touch = (e.touch === undefined ? 1 : (e.touch ? 1 : 0));
			}
		} else {
			entry.keys = pulse ? toKeyList(e.tap !== undefined && e.tap !== null ? e.tap : e.hold) : (Array.isArray(e.keys) ? e.keys.map(String) : toKeyList(e.key));
		}
		out.push(entry);
	});
	return out;
}

function normalizeRecordFrames(v) {
	if (!v || typeof v !== 'object') {
		return null;
	}
	const from = parseInt(v.from, 10);
	const to = parseInt(v.to, 10);
	return {from: isNaN(from) ? 0 : Math.max(from, 0), to: isNaN(to) ? Number.MAX_SAFE_INTEGER : to};
}

function normalizeJsonObject(v) {
	return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
}

function normalizeScreen(screen, settings) {
	screen = (screen && typeof screen === 'object') ? screen : {};
	return {
		touch: normalizeTimeline(screen.touch, 'touch').slice(0, settings.maxTimelineEvents),
		keys: normalizeTimeline(screen.keys, 'keys').slice(0, settings.maxTimelineEvents),
		record: !!screen.record,
		max_calls: optionalInt(screen.max_calls, 1, settings.maxRecordedCalls) || settings.defaultRecordedCalls,
		record_frames: normalizeRecordFrames(screen.record_frames),
		record_functions: Array.isArray(screen.record_functions) && screen.record_functions.length ? screen.record_functions.map(String) : null
	};
}

function normalizeMode(mode) {
	if (typeof mode !== 'string') {
		return 'PG0.5';
	}
	const m = mode.trim().toUpperCase().replace(/_/g, '.');
	return m === 'PG0' ? 'PG0' : 'PG0.5';
}

function createRunner(settings) {
	let active = 0;

	function run(params) {
		const opt = {
			code: String(params.code || ''),
			input: normalizeInput(params.input),
			mode: normalizeMode(params.mode),
			lang: params.lang === 'ja' ? 'ja' : 'en',
			timeoutMs: clampInt(params.timeout_ms, settings.defaultTimeoutMs, 100, settings.maxTimeoutMs),
			maxSteps: clampInt(params.max_steps, settings.defaultMaxSteps, 1, settings.maxMaxSteps),
			maxOutputLength: settings.maxOutputLength,
			variables: params.variables !== false && params.variables !== 0 && params.variables !== 'false',
			maxFrames: optionalInt(params.max_frames, 1, settings.maxMaxFrames) !== null ? optionalInt(params.max_frames, 1, settings.maxMaxFrames) : settings.defaultMaxFrames,
			maxVirtualMs: optionalInt(params.max_virtual_ms, 1, settings.maxMaxVirtualMs),
			screen: normalizeScreen(params.screen, settings),
			seed: (params.seed === undefined || params.seed === null || params.seed === '') ? null : String(params.seed),
			storage: normalizeJsonObject(params.storage),
			globals: normalizeJsonObject(params.globals)
		};

		return new Promise(function(resolve) {
			active++;
			let finished = false;
			let flushed = '';
			const worker = new Worker(WORKER_FILE, {
				workerData: opt,
				resourceLimits: {maxOldGenerationSizeMb: settings.workerMemoryMb}
			});

			function finish(result) {
				if (finished) {
					return;
				}
				finished = true;
				active--;
				clearTimeout(timer);
				worker.terminate().catch(function() {});
				result.mode = opt.mode;
				resolve(result);
			}

			function abnormal(status, message) {
				finish({
					status: status,
					output: flushed,
					output_truncated: false,
					error_output: '',
					result: null,
					result_type: null,
					error: {message: message, line: null, source: null, phase: 'runtime'},
					variables: null,
					screen: null,
					storage: null,
					stats: {steps: null, elapsed_ms: opt.timeoutMs, input_lines_used: null, steps_per_frame: null}
				});
			}

			const timer = setTimeout(function() {
				abnormal('timeout', 'Execution timed out (hard limit)');
			}, opt.timeoutMs + 1000);

			worker.on('message', function(msg) {
				if (msg.type === 'output') {
					flushed += msg.text;
				} else if (msg.type === 'done') {
					delete msg.type;
					finish(msg);
				}
			});
			worker.on('error', function(err) {
				if (err && err.code === 'ERR_WORKER_OUT_OF_MEMORY') {
					abnormal('memory_limit', 'Memory limit exceeded');
				} else {
					abnormal('error', (err && err.message) ? err.message : String(err));
				}
			});
			worker.on('exit', function(code) {
				if (!finished) {
					abnormal('error', 'Worker exited unexpectedly (code ' + code + ')');
				}
			});
		});
	}

	return {
		run: run,
		activeCount: function() { return active; },
		normalizeMode: normalizeMode
	};
}

module.exports = {createRunner: createRunner, normalizeMode: normalizeMode};
