"use strict";
// AI agent API for PG0 / PG0.5.
// Mounted from server.js:  require('./agent_api.js')(app, {getDB, addHistory, logger});
// Endpoints live under /api/agent/v1 and are documented in agent/manual/*.md (served at /api/agent/v1/manual).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const settings = require('./agent_settings.js');
const {createRunner, normalizeMode, validateScreen} = require('./agent/pg0_runner.js');
const libraries = require('./agent/libraries.js');
const {lint} = require('./agent/lint.js');

const MANUAL_DIR = path.join(__dirname, 'agent', 'manual');
const OPENAPI_FILE = path.join(__dirname, 'agent', 'openapi.json');

// Same hash the web editor applies to passwords (pg0_string.crc32), so scripts
// created here can be edited in the editor with the same password and vice versa.
let crcTable = null;
function crc32(str) {
	if (!str) {
		return 0;
	}
	str = str.trim().toLowerCase();
	if (!crcTable) {
		crcTable = [];
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) {
				c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			crcTable[n] = c;
		}
	}
	let crc = 0 ^ (-1);
	for (let i = 0; i < str.length; i++) {
		crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
	}
	return (crc ^ (-1)) >>> 0;
}

// Execution speed values offered by the web editor (milliseconds of wait per statement).
const SPEED_VALUES = [0, 1, 250, 500];

function normalizeSpeed(value) {
	const n = (typeof value === 'string' && value.trim() !== '') ? Number(value) : value;
	return SPEED_VALUES.indexOf(n) >= 0 ? n : null;
}

function clampInt(value, def, min, max) {
	let n = parseInt(value, 10);
	if (isNaN(n)) {
		n = def;
	}
	return Math.min(Math.max(n, min), max);
}

function pickLang(req) {
	const q = (req.query.lang || '').toString().toLowerCase();
	if (q === 'ja' || q === 'en') {
		return q;
	}
	const al = (req.headers['accept-language'] || '').toString().toLowerCase();
	return al.startsWith('ja') ? 'ja' : 'en';
}

function baseUrl(req) {
	if (settings.publicUrl) {
		return settings.publicUrl.replace(/\/$/, '');
	}
	const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0];
	const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().split(',')[0].trim();
	return `${proto}://${host}`;
}

function scriptUrl(req, cid) {
	return `${baseUrl(req)}/dev/?cid=${encodeURIComponent(cid)}`;
}

function summarizeScript(req, doc) {
	return {
		cid: doc.cid,
		name: doc.name,
		author: doc.author,
		mode: normalizeMode(doc.type),
		private: doc.private ? 1 : 0,
		speed: normalizeSpeed(doc.speed) !== null ? normalizeSpeed(doc.speed) : settings.defaultSpeed,
		createTime: doc.createTime || null,
		updateTime: doc.updateTime,
		url: scriptUrl(req, doc.cid),
		run_url: scriptUrl(req, doc.cid) + '&run=1'
	};
}

function detailScript(req, doc) {
	const s = summarizeScript(req, doc);
	s.memo = doc.memo || '';
	s.code = doc.code || '';
	return s;
}

function apiError(res, status, code, message, extra) {
	const body = {error: Object.assign({code: code, message: message}, extra || {})};
	return res.status(status).json(body);
}

function clientAddress(req) {
	return (req.headers['x-forwarded-for'] ||
		(req.connection && req.connection.remoteAddress) ||
		(req.socket && req.socket.remoteAddress));
}

module.exports = function(app, deps) {
	deps = deps || {};
	const logger = deps.logger || console;
	const getDB = deps.getDB;
	const addHistory = deps.addHistory;
	const runner = createRunner(settings);
	const router = express.Router();

	function requireDB(res) {
		if (typeof getDB !== 'function') {
			apiError(res, 503, 'storage_unavailable', 'Script storage is not available on this server');
			return false;
		}
		return true;
	}

	// ---- authentication -------------------------------------------------
	router.use(function(req, res, next) {
		if (!settings.apiKey) {
			return next();
		}
		let key = '';
		const auth = req.headers['authorization'];
		if (auth && /^Bearer\s+/i.test(auth)) {
			key = auth.replace(/^Bearer\s+/i, '').trim();
		} else if (req.headers['x-api-key']) {
			key = String(req.headers['x-api-key']).trim();
		}
		if (key !== settings.apiKey) {
			return apiError(res, 401, 'unauthorized', 'A valid API key is required (Authorization: Bearer <key>)');
		}
		next();
	});

	// ---- discovery ------------------------------------------------------
	router.get('/', function(req, res) {
		const b = baseUrl(req) + req.baseUrl;
		res.json({
			name: 'PG0 agent API',
			version: 1,
			description: 'Write, check, run and store programs written in PG0 / PG0.5 (a small language for learning programming).',
			base_url: b,
			manual: {
				ja: `${b}/manual?lang=ja`,
				en: `${b}/manual?lang=en`
			},
			openapi: `${b}/openapi.json`,
			libraries: `${b}/libraries`,
			endpoints: [
				{method: 'GET', path: '/manual', description: 'Full manual (Markdown): API usage, language specification, library reference'},
				{method: 'GET', path: '/openapi.json', description: 'OpenAPI 3 description of this API'},
				{method: 'GET', path: '/libraries', description: 'Machine readable list of built-in functions and libraries'},
				{method: 'POST', path: '/check', description: 'Syntax check a program without running it'},
				{method: 'POST', path: '/run', description: 'Run a program and get its output, result and variables'},
				{method: 'GET', path: '/scripts', description: 'List / search stored scripts'},
				{method: 'POST', path: '/scripts', description: 'Store a new script (opens in the web editor); "memo" is the revision note'},
				{method: 'GET', path: '/scripts/{cid}', description: 'Get a stored script including its code'},
				{method: 'PUT', path: '/scripts/{cid}', description: 'Update a stored script (password required); write what changed in "memo"'},
				{method: 'DELETE', path: '/scripts/{cid}', description: 'Delete a stored script (password required)'},
				{method: 'POST', path: '/scripts/{cid}/run', description: 'Run a stored script'},
				{method: 'GET', path: '/scripts/{cid}/history', description: 'Revision history: current and previous versions with their memo (change note)'},
				{method: 'GET', path: '/scripts/{cid}/history/{time}', description: 'Get a previous version of a stored script'}
			],
			limits: {
				default_timeout_ms: settings.defaultTimeoutMs,
				max_timeout_ms: settings.maxTimeoutMs,
				default_max_steps: settings.defaultMaxSteps,
				max_max_steps: settings.maxMaxSteps,
				max_code_length: settings.maxCodeLength,
				max_input_length: settings.maxInputLength,
				max_output_length: settings.maxOutputLength,
				max_concurrent_runs: settings.maxConcurrentRuns,
				default_max_frames: settings.defaultMaxFrames,
				max_max_frames: settings.maxMaxFrames,
				max_max_virtual_ms: settings.maxMaxVirtualMs,
				default_recorded_calls: settings.defaultRecordedCalls,
				max_recorded_calls: settings.maxRecordedCalls
			}
		});
	});

	router.get('/manual', function(req, res) {
		const lang = pickLang(req);
		const file = path.join(MANUAL_DIR, `manual.${lang}.md`);
		fs.readFile(file, 'utf8', function(err, text) {
			if (err) {
				logger.error(err);
				return apiError(res, 500, 'internal_error', 'Manual not found');
			}
			res.type('text/markdown; charset=utf-8').send(text);
		});
	});

	router.get('/openapi.json', function(req, res) {
		fs.readFile(OPENAPI_FILE, 'utf8', function(err, text) {
			if (err) {
				logger.error(err);
				return apiError(res, 500, 'internal_error', 'OpenAPI document not found');
			}
			let doc;
			try {
				doc = JSON.parse(text);
			} catch (e) {
				logger.error(e);
				return apiError(res, 500, 'internal_error', 'OpenAPI document is invalid');
			}
			doc.servers = [{url: `${baseUrl(req)}${req.baseUrl}`}];
			res.json(doc);
		});
	});

	router.get('/libraries', function(req, res) {
		res.json(libraries);
	});

	// ---- program execution ---------------------------------------------
	function validateCode(req, res) {
		const body = req.body || {};
		if (typeof body.code !== 'string') {
			apiError(res, 400, 'invalid_request', '"code" (string) is required');
			return null;
		}
		if (body.code.length > settings.maxCodeLength) {
			apiError(res, 413, 'code_too_large', `"code" exceeds ${settings.maxCodeLength} characters`);
			return null;
		}
		const screenError = validateScreen(body.screen, settings);
		if (screenError) {
			apiError(res, 400, 'invalid_request', screenError);
			return null;
		}
		for (const key of ['storage', 'globals']) {
			if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'object' || Array.isArray(body[key]))) {
				apiError(res, 400, 'invalid_request', `"${key}" must be an object of {"name": value}`);
				return null;
			}
		}
		if (body.globals_at !== undefined && body.globals_at !== null && body.globals_at !== 'start' && body.globals_at !== 'first_sleep') {
			apiError(res, 400, 'invalid_request', '"globals_at" must be "start" or "first_sleep"');
			return null;
		}
		if (body.seed !== undefined && body.seed !== null && typeof body.seed !== 'number' && typeof body.seed !== 'string') {
			apiError(res, 400, 'invalid_request', '"seed" must be a number or a string');
			return null;
		}
		if (body.input !== undefined && body.input !== null) {
			const len = Array.isArray(body.input) ? body.input.join('\n').length : String(body.input).length;
			if (len > settings.maxInputLength) {
				apiError(res, 413, 'input_too_large', `"input" exceeds ${settings.maxInputLength} characters`);
				return null;
			}
		}
		return body;
	}

	async function runProgram(req, res, params) {
		if (runner.activeCount() >= settings.maxConcurrentRuns) {
			res.set('Retry-After', '1');
			return apiError(res, 429, 'too_many_runs', 'Too many programs are running; retry shortly', {retry_after_ms: 1000});
		}
		try {
			const result = await runner.run(params);
			res.json(result);
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	}

	router.post('/check', async function(req, res) {
		const body = validateCode(req, res);
		if (!body) {
			return;
		}
		if (runner.activeCount() >= settings.maxConcurrentRuns) {
			res.set('Retry-After', '1');
			return apiError(res, 429, 'too_many_runs', 'Too many programs are running; retry shortly', {retry_after_ms: 1000});
		}
		try {
			// A step limit of 1 stops execution right after parsing.
			const result = await runner.run({code: body.code, mode: body.mode, lang: body.lang, max_steps: 1, timeout_ms: 2000, variables: false});
			if (result.status === 'error' && result.error && result.error.phase === 'parse') {
				return res.json({ok: false, mode: result.mode, error: result.error, warnings: []});
			}
			let warnings = [];
			try {
				warnings = lint(body.code, body.lang);
			} catch (e) {
				logger.error(e);
			}
			res.json({ok: true, mode: result.mode, error: null, warnings: warnings});
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.post('/run', async function(req, res) {
		const body = validateCode(req, res);
		if (!body) {
			return;
		}
		await runProgram(req, res, {
			code: body.code,
			input: body.input,
			mode: body.mode,
			lang: body.lang,
			timeout_ms: body.timeout_ms,
			max_steps: body.max_steps,
			max_frames: body.max_frames,
			max_virtual_ms: body.max_virtual_ms,
			screen: body.screen,
			seed: body.seed,
			storage: body.storage,
			globals: body.globals,
			globals_at: body.globals_at,
			profile: body.profile,
			variables: body.variables
		});
	});

	// ---- stored scripts -------------------------------------------------
	router.get('/scripts', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const skip = clampInt(req.query.skip, 0, 0, 1000000);
		const count = clampInt(req.query.count, 30, 1, 100);
		const uuid = req.query.uuid ? String(req.query.uuid) : null;
		const q = (req.query.q || '').toString().trim();
		try {
			const db = await getDB();
			const cond = {};
			if (q) {
				cond.$and = q.split(/\s+/).map(function(d) {
					return {keyword: new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')};
				});
			}
			const ret = [];
			if (uuid) {
				const mine = db.collection('script').find(Object.assign({uuid: uuid}, cond)).sort({updateTime: -1}).limit(count).skip(skip);
				for await (const doc of mine) {
					ret.push(summarizeScript(req, doc));
				}
			}
			const pub = Object.assign({private: {$ne: 1}}, cond);
			if (uuid) {
				pub.uuid = {$ne: uuid};
			}
			const cursor = db.collection('script').find(pub).sort({showCount: -1, updateTime: -1}).limit(count).skip(skip);
			for await (const doc of cursor) {
				ret.push(summarizeScript(req, doc));
			}
			res.json({scripts: ret, skip: skip, count: count});
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	function validateScriptBody(req, res, creating) {
		const body = req.body || {};
		if (creating || body.name !== undefined) {
			if (typeof body.name !== 'string' || !body.name.trim()) {
				apiError(res, 400, 'invalid_request', '"name" (string) is required');
				return null;
			}
			if (body.name.length > 100) {
				apiError(res, 413, 'name_too_long', '"name" exceeds 100 characters');
				return null;
			}
		}
		if (creating || body.code !== undefined) {
			if (typeof body.code !== 'string') {
				apiError(res, 400, 'invalid_request', '"code" (string) is required');
				return null;
			}
			if (body.code.length > settings.maxCodeLength) {
				apiError(res, 413, 'code_too_large', `"code" exceeds ${settings.maxCodeLength} characters`);
				return null;
			}
		}
		if (typeof body.password !== 'string' || !body.password) {
			apiError(res, 400, 'invalid_request', '"password" (string) is required');
			return null;
		}
		if (body.author !== undefined && body.author !== null && String(body.author).length > 100) {
			apiError(res, 413, 'author_too_long', '"author" exceeds 100 characters');
			return null;
		}
		if (body.memo !== undefined && body.memo !== null && typeof body.memo !== 'string') {
			apiError(res, 400, 'invalid_request', '"memo" must be a string');
			return null;
		}
		if (body.speed !== undefined && body.speed !== null && normalizeSpeed(body.speed) === null) {
			apiError(res, 400, 'invalid_request', '"speed" must be one of ' + SPEED_VALUES.join(', ') + ' (0 = no wait, 1 = fast, 250 = normal, 500 = slow)');
			return null;
		}
		return body;
	}

	// With "check": true a script is parsed before it is stored; a syntax error rejects the save.
	async function checkBeforeSave(body, res) {
		if (!body.check || typeof body.code !== 'string') {
			return true;
		}
		if (runner.activeCount() >= settings.maxConcurrentRuns) {
			res.set('Retry-After', '1');
			apiError(res, 429, 'too_many_runs', 'Too many programs are running; retry shortly', {retry_after_ms: 1000});
			return false;
		}
		const result = await runner.run({code: body.code, mode: body.mode, lang: body.lang, max_steps: 1, timeout_ms: 2000, variables: false});
		if (result.status === 'error' && result.error && result.error.phase === 'parse') {
			apiError(res, 422, 'syntax_error', 'The script has a syntax error and was not saved', {detail: result.error});
			return false;
		}
		return true;
	}

	router.post('/scripts', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const body = validateScriptBody(req, res, true);
		if (!body) {
			return;
		}
		if (!await checkBeforeSave(body, res)) {
			return;
		}
		const name = body.name.trim();
		const author = (body.author && String(body.author).trim()) || settings.defaultAuthor;
		const isPrivate = body.private ? 1 : 0;
		const time = Date.now();
		try {
			const db = await getDB();
			if (!isPrivate) {
				const dup = await db.collection('script').findOne({name: name, private: {$ne: 1}});
				if (dup) {
					return apiError(res, 409, 'name_conflict', 'A public script with this name already exists; choose another name or set "private": 1');
				}
			}
			let cid = crypto.randomUUID();
			while (await db.collection('script').findOne({cid: cid})) {
				cid = crypto.randomUUID();
			}
			const doc = {
				cid: cid,
				name: name,
				type: normalizeMode(body.mode),
				author: author,
				password: crc32(body.password),
				memo: body.memo || '',
				uuid: body.uuid ? String(body.uuid) : '',
				private: isPrivate,
				code: body.code,
				speed: (body.speed !== undefined && body.speed !== null) ? normalizeSpeed(body.speed) : settings.defaultSpeed,
				keyword: name + ' ' + author,
				createTime: time,
				updateTime: time,
				showCount: 0,
				ipaddr: clientAddress(req)
			};
			await db.collection('script').insertOne(doc);
			res.status(201).json(detailScript(req, doc));
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.get('/scripts/:cid', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		try {
			const db = await getDB();
			const doc = await db.collection('script').findOne({cid: req.params.cid});
			if (!doc) {
				return apiError(res, 404, 'not_found', 'Script not found');
			}
			res.json(detailScript(req, doc));
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.put('/scripts/:cid', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const body = validateScriptBody(req, res, false);
		if (!body) {
			return;
		}
		if (!await checkBeforeSave(body, res)) {
			return;
		}
		try {
			const db = await getDB();
			const doc = await db.collection('script').findOne({cid: req.params.cid});
			if (!doc) {
				return apiError(res, 404, 'not_found', 'Script not found');
			}
			if (doc.password !== crc32(body.password)) {
				return apiError(res, 401, 'wrong_password', 'Password does not match');
			}
			const name = body.name !== undefined ? body.name.trim() : doc.name;
			const author = body.author !== undefined ? ((body.author && String(body.author).trim()) || settings.defaultAuthor) : doc.author;
			const isPrivate = body.private !== undefined ? (body.private ? 1 : 0) : (doc.private ? 1 : 0);
			if (!isPrivate) {
				const dup = await db.collection('script').findOne({cid: {$ne: doc.cid}, name: name, private: {$ne: 1}});
				if (dup) {
					return apiError(res, 409, 'name_conflict', 'A public script with this name already exists');
				}
			}
			if (typeof addHistory === 'function') {
				await addHistory(doc.cid);
			}
			const update = {
				name: name,
				type: body.mode !== undefined ? normalizeMode(body.mode) : (doc.type || 'PG0.5'),
				author: author,
				memo: body.memo !== undefined ? (body.memo || '') : (doc.memo || ''),
				uuid: body.uuid !== undefined ? String(body.uuid || '') : (doc.uuid || ''),
				private: isPrivate,
				code: body.code !== undefined ? body.code : doc.code,
				speed: (body.speed !== undefined && body.speed !== null) ? normalizeSpeed(body.speed) : (normalizeSpeed(doc.speed) !== null ? normalizeSpeed(doc.speed) : settings.defaultSpeed),
				keyword: name + ' ' + author,
				updateTime: Date.now(),
				ipaddr: clientAddress(req)
			};
			await db.collection('script').updateOne({cid: doc.cid}, {$set: update});
			res.json(detailScript(req, Object.assign({}, doc, update)));
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.delete('/scripts/:cid', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const password = (req.body && req.body.password) || req.query.password;
		if (typeof password !== 'string' || !password) {
			return apiError(res, 400, 'invalid_request', '"password" (string) is required');
		}
		try {
			const db = await getDB();
			const doc = await db.collection('script').findOne({cid: req.params.cid});
			if (!doc) {
				return apiError(res, 404, 'not_found', 'Script not found');
			}
			if (doc.password !== crc32(password)) {
				return apiError(res, 401, 'wrong_password', 'Password does not match');
			}
			if (typeof addHistory === 'function') {
				await addHistory(doc.cid);
			}
			await db.collection('script').deleteOne({cid: doc.cid});
			res.json({deleted: true, cid: doc.cid});
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.post('/scripts/:cid/run', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const body = req.body || {};
		const screenError = validateScreen(body.screen, settings);
		if (screenError) {
			return apiError(res, 400, 'invalid_request', screenError);
		}
		try {
			const db = await getDB();
			const doc = await db.collection('script').findOne({cid: req.params.cid});
			if (!doc) {
				return apiError(res, 404, 'not_found', 'Script not found');
			}
			await runProgram(req, res, {
				code: doc.code || '',
				input: body.input,
				mode: body.mode !== undefined ? body.mode : doc.type,
				lang: body.lang,
				timeout_ms: body.timeout_ms,
				max_steps: body.max_steps,
				max_frames: body.max_frames,
				max_virtual_ms: body.max_virtual_ms,
				screen: body.screen,
				seed: body.seed,
				storage: body.storage,
				globals: body.globals,
				globals_at: body.globals_at,
				profile: body.profile,
				variables: body.variables
			});
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.get('/scripts/:cid/history', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const skip = clampInt(req.query.skip, 0, 0, 1000000);
		const count = clampInt(req.query.count, 30, 1, 100);
		try {
			const db = await getDB();
			const ret = [];
			// Like the editor's revision history: the current version first, then older versions.
			if (skip === 0) {
				const cur = await db.collection('script').findOne({cid: req.params.cid});
				if (cur) {
					const s = summarizeScript(req, cur);
					s.memo = cur.memo || '';
					s.current = 1;
					ret.push(s);
				}
			}
			const cursor = db.collection('script_history').find({cid: req.params.cid}).sort({updateTime: -1}).limit(count).skip(skip);
			for await (const doc of cursor) {
				const s = summarizeScript(req, doc);
				s.memo = doc.memo || '';
				s.current = 0;
				ret.push(s);
			}
			if (ret.length === 0) {
				return apiError(res, 404, 'not_found', 'Script not found');
			}
			res.json({history: ret, skip: skip, count: count});
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.get('/scripts/:cid/history/:time', async function(req, res) {
		if (!requireDB(res)) {
			return;
		}
		const time = parseInt(req.params.time, 10);
		if (isNaN(time)) {
			return apiError(res, 400, 'invalid_request', '"time" must be a number');
		}
		try {
			const db = await getDB();
			let doc = await db.collection('script_history').findOne({cid: req.params.cid, updateTime: time});
			if (!doc) {
				doc = await db.collection('script').findOne({cid: req.params.cid, updateTime: time});
			}
			if (!doc) {
				return apiError(res, 404, 'not_found', 'Script version not found');
			}
			res.json(detailScript(req, doc));
		} catch (error) {
			logger.error(error);
			apiError(res, 500, 'internal_error', 'Internal Server Error');
		}
	});

	router.use(function(req, res) {
		apiError(res, 404, 'not_found', `Unknown endpoint ${req.method} ${req.originalUrl}; see ${req.baseUrl}`);
	});

	// JSON errors for malformed bodies and unexpected failures inside this router.
	router.use(function(err, req, res, next) {
		if (err && err.type === 'entity.parse.failed') {
			return apiError(res, 400, 'invalid_json', 'Request body is not valid JSON');
		}
		if (err && err.type === 'entity.too.large') {
			return apiError(res, 413, 'request_too_large', 'Request body is too large');
		}
		logger.error(err);
		apiError(res, 500, 'internal_error', 'Internal Server Error');
	});

	app.use('/api/agent/v1', router);
	// express.json() runs before this router, so its parse errors are caught here at app level.
	app.use('/api/agent', function(err, req, res, next) {
		if (err && err.type === 'entity.parse.failed') {
			return apiError(res, 400, 'invalid_json', 'Request body is not valid JSON');
		}
		if (err && err.type === 'entity.too.large') {
			return apiError(res, 413, 'request_too_large', 'Request body is too large');
		}
		next(err);
	});
	app.get('/api/agent', function(req, res) {
		res.redirect('/api/agent/v1');
	});

	logger.info('Agent API mounted at /api/agent/v1');
	return router;
};
