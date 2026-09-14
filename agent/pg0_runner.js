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
// Returns {entries} or {error} describing the first invalid entry.
function normalizeTimeline(list, kind, field) {
	if (list === undefined || list === null) {
		return {entries: []};
	}
	if (!Array.isArray(list)) {
		return {error: `"${field}" must be an array of timeline entries`};
	}
	const out = [];
	for (let idx = 0; idx < list.length; idx++) {
		const e = list[idx];
		const where = `"${field}[${idx}]"`;
		if (!e || typeof e !== 'object' || Array.isArray(e)) {
			return {error: `${where} must be an object`};
		}
		const entry = {};
		const hasMs = e.ms !== undefined && e.ms !== null;
		const hasFrame = e.frame !== undefined && e.frame !== null;
		if (hasMs === hasFrame) {
			return {error: `${where} needs exactly one of "ms" (virtual milliseconds) or "frame" (frame index)`};
		}
		if (hasFrame) {
			const frame = Number(e.frame);
			if (!Number.isInteger(frame) || frame < 0) {
				return {error: `${where}.frame must be a non-negative integer`};
			}
			entry.frame = frame;
		} else {
			const ms = Number(e.ms);
			if (!isFinite(ms) || ms < 0) {
				return {error: `${where}.ms must be a non-negative number`};
			}
			entry.ms = ms;
		}
		const hasTap = e.tap !== undefined && e.tap !== null;
		const hasHold = e.hold !== undefined && e.hold !== null;
		if (hasTap && hasHold) {
			return {error: `${where} may have "tap" or "hold", not both`};
		}
		const pulse = hasTap || hasHold;
		if (pulse) {
			const frames = e.frames === undefined ? 1 : Number(e.frames);
			if (!Number.isInteger(frames) || frames < 1) {
				return {error: `${where}.frames must be a positive integer`};
			}
			entry.frames = frames;
			if (e.gap !== undefined && e.gap !== null) {
				const gap = Number(e.gap);
				if (!Number.isInteger(gap) || gap < 0) {
					return {error: `${where}.gap must be a non-negative integer`};
				}
				entry.gap = gap;
			}
		} else if (e.frames !== undefined) {
			return {error: `${where}.frames is only valid together with "tap" or "hold"`};
		}
		if (kind === 'touch') {
			if (hasHold) {
				return {error: `${where}: touch entries use "tap", not "hold"`};
			}
			const src = (hasTap && typeof e.tap === 'object') ? e.tap : e;
			if (hasTap && typeof e.tap !== 'object') {
				return {error: `${where}.tap must be {"x": number, "y": number}`};
			}
			if (src.x === undefined || src.y === undefined || !isFinite(Number(src.x)) || !isFinite(Number(src.y))) {
				return {error: `${where} needs numeric "x" and "y"`};
			}
			entry.x = Number(src.x);
			entry.y = Number(src.y);
			entry.button = Number(e.button) || 0;
			if (!pulse) {
				entry.touch = (e.touch === undefined ? 1 : (e.touch ? 1 : 0));
			}
		} else {
			if (pulse) {
				entry.keys = toKeyList(hasTap ? e.tap : e.hold);
				if (entry.keys.length === 0) {
					return {error: `${where}: "tap"/"hold" needs a key name or an array of key names`};
				}
			} else if (e.keys !== undefined || e.key !== undefined) {
				if (e.keys !== undefined && !Array.isArray(e.keys)) {
					return {error: `${where}.keys must be an array of key names`};
				}
				entry.keys = e.keys !== undefined ? e.keys.map(String) : toKeyList(e.key);
			} else {
				return {error: `${where} needs "keys" (held keys), "tap" or "hold"`};
			}
		}
		out.push(entry);
	}
	return {entries: out};
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

// Returns an error message for invalid screen options, or null.
function validateScreen(screen, settings) {
	if (screen === undefined || screen === null) {
		return null;
	}
	if (typeof screen !== 'object' || Array.isArray(screen)) {
		return '"screen" must be an object ({"touch": [...], "keys": [...], "record": true})';
	}
	for (const [field, kind] of [['touch', 'touch'], ['keys', 'keys']]) {
		const r = normalizeTimeline(screen[field], kind, 'screen.' + field);
		if (r.error) {
			return r.error;
		}
		if (r.entries.length > settings.maxTimelineEvents) {
			return `"screen.${field}" has more than ${settings.maxTimelineEvents} entries`;
		}
	}
	if (screen.record_frames !== undefined && screen.record_frames !== null && (typeof screen.record_frames !== 'object' || Array.isArray(screen.record_frames))) {
		return '"screen.record_frames" must be {"from": n, "to": m}';
	}
	if (screen.record_functions !== undefined && screen.record_functions !== null && !Array.isArray(screen.record_functions)) {
		return '"screen.record_functions" must be an array of function names';
	}
	if (screen.record_exclude_functions !== undefined && screen.record_exclude_functions !== null && !Array.isArray(screen.record_exclude_functions)) {
		return '"screen.record_exclude_functions" must be an array of function names';
	}
	return null;
}

function normalizeScreen(screen, settings) {
	screen = (screen && typeof screen === 'object') ? screen : {};
	return {
		touch: (normalizeTimeline(screen.touch, 'touch', 'screen.touch').entries || []).slice(0, settings.maxTimelineEvents),
		keys: (normalizeTimeline(screen.keys, 'keys', 'screen.keys').entries || []).slice(0, settings.maxTimelineEvents),
		record: !!screen.record,
		max_calls: optionalInt(screen.max_calls, 1, settings.maxRecordedCalls) || settings.defaultRecordedCalls,
		record_frames: normalizeRecordFrames(screen.record_frames),
		record_functions: Array.isArray(screen.record_functions) && screen.record_functions.length ? screen.record_functions.map(String) : null,
		record_image_frames: !!screen.record_image_frames,
		record_last_drawn: !!screen.record_last_drawn,
		record_exclude_functions: Array.isArray(screen.record_exclude_functions) && screen.record_exclude_functions.length ? screen.record_exclude_functions.map(String) : null,
		frame_steps: !!screen.frame_steps
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
			globals: normalizeJsonObject(params.globals),
			globalsAt: params.globals_at === 'first_sleep' ? 'first_sleep' : 'start',
			profile: !!params.profile,
			imports: (params.imports && typeof params.imports === 'object') ? params.imports : {}
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

module.exports = {createRunner: createRunner, normalizeMode: normalizeMode, validateScreen: validateScreen};
