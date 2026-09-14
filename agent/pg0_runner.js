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
			variables: params.variables !== false && params.variables !== 0 && params.variables !== 'false'
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
					stats: {steps: null, elapsed_ms: opt.timeoutMs, input_lines_used: null}
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
