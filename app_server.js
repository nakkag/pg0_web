"use strict";
// /app/: a stored script run as an app, the way pg0gen.exe turns a program
// into an executable. GET /api/app/:cid answers the program compiled: the
// parse tree (the tokens the interpreter runs) of the script, of the scripts
// it imports and of the library .pg0 files, with the names of the JavaScript
// libraries to load. The page public/app/ runs it and never sees the source.
//
// Compiled programs are kept in the app_cache collection, without expiry: a
// program is compiled again when the script, a script it imports or the
// compiler (this file, the parser, the library .pg0 files) changed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DEV_DIR = path.join(__dirname, 'public', 'dev');
const PAGE_FILE = path.join(__dirname, 'public', 'app', 'index.html');
const PARSER_FILES = ['pg0/script_common.js', 'pg0/script_parse.js'];
const CID = /^[a-zA-Z0-9\-]+$/;
// The library files, as the editor finds them under /dev/.
const LIB_FILE = /^\/dev\/lib\/([a-z0-9_]+)\.(pg0|js)$/i;
const SCREEN_LIB = /^lib\/screen\.js(\?|$)/;

// What a program is when it is saved: SHA-256 of the code in UTF-8, without
// CR and without the line breaks at the end (the editors hash the same way).
// The relay (net_server.js) lets a program into a room only with this hash;
// the app carries it, as the executable does, since it has no source.
function programHash(code) {
	return crypto.createHash('sha256').update(String(code == null ? '' : code).replace(/\r/g, '').replace(/\n+$/, ''), 'utf8').digest('hex');
}

// What a compiled program depends on besides the script: a change of any of
// these makes every cached program stale.
function toolchainKey() {
	const h = crypto.createHash('sha256');
	h.update(fs.readFileSync(__filename));
	PARSER_FILES.forEach(function(f) {
		h.update(fs.readFileSync(path.join(DEV_DIR, f)));
	});
	fs.readdirSync(path.join(DEV_DIR, 'lib')).filter(function(f) {
		return /\.pg0$/i.test(f);
	}).sort().forEach(function(f) {
		h.update(f);
		h.update(fs.readFileSync(path.join(DEV_DIR, 'lib', f)));
	});
	return h.digest('hex');
}

// The browser parser, loaded unchanged into a context of its own (as the
// agent API's runner does). Errors carry the key of their message
// (ERR_SENTENCE, ...) instead of a text: the page shows it in its language.
function createParser() {
	const context = vm.createContext({
		navigator: {language: 'en'},
		console: {log: function() {}, error: function() {}, warn: function() {}}
	});
	PARSER_FILES.forEach(function(f) {
		new vm.Script(fs.readFileSync(path.join(DEV_DIR, f), 'utf8'), {filename: f}).runInContext(context);
	});
	vm.runInContext('Object.keys(errMsg).forEach(function(k) { errMsg[k] = k; })', context);
	return vm.runInContext('({Script: Script, ScriptParse: ScriptParse})', context);
}

// Compiles a program as the editor would run it (pg0.js, _exec): the program
// is parsed, and every #import is parsed in turn, a stored script
// (#import("cid:...")) through loadScript(cid), which answers
// {code, updateTime} or null, a library .pg0 file from public/dev/lib, and a
// library .js file is only noted for the page to load.
// Returns {libraries, screen, scripts, exec, errors, imports}:
//   scripts: the program (first) and the parts it imports, in the order they
//            were met, each {name, extension, strict, token}
//   exec:    indexes of scripts in the order they run (an imported part runs
//            before the one that imports it; the program last)
//   errors:  null, or the errors [{key, line, part}] when the program does not
//            compile (part names an imported part, '' is the program)
//   imports: the stored scripts that were asked for, [{cid, updateTime}]
//            (updateTime null when there is no such script)
async function compile(parser, code, extension, loadScript) {
	const Script = parser.Script;
	const ScriptParse = parser.ScriptParse;
	const scripts = [];
	const exec = [];
	const libraries = [];
	const imports = [];
	const errors = [];
	// 'loading' while a part is being compiled (importing it again is a
	// circular import), 'done' afterwards (a part is compiled once).
	const state = new Map();

	async function part(src, name, ext) {
		const sci = Script.initScriptInfo(src, {extension: ext});
		const entry = {name: name, sci: sci, token: null};
		const index = scripts.length;
		scripts.push(entry);
		const sp = new ScriptParse(sci);
		let ok = true;
		await sp.parse(src, {
			import: importFile,
			success: async function(token) {
				entry.token = token;
				exec.push(index);
			},
			error: async function(err) {
				ok = false;
				errors.push({key: String(err.msg), line: err.line, part: index ? name : ''});
			}
		});
		return ok;
	}

	async function importFile(file) {
		const cid = /^cid:/i.test(file) ? file.slice(4).trim() : null;
		let key;
		let lib = null;
		let search = '';
		if (cid !== null) {
			if (!CID.test(cid)) {
				return -1;
			}
			key = 'cid:' + cid;
		} else {
			// As the editor resolves it: against /dev/ on this host. Only the
			// library files are compiled in; any other file is an error, as a
			// file that is not found is in the editor.
			let url;
			try {
				url = new URL(String(file), 'http://pg0/dev/');
			} catch (e) {
				return -1;
			}
			const m = url.pathname.match(LIB_FILE);
			if (!m) {
				return -1;
			}
			lib = 'lib/' + m[1] + '.' + m[2].toLowerCase();
			search = url.search;
			key = url.pathname + url.search;
		}
		if (state.get(key) === 'loading') {
			return 'ERR_IMPORT_CIRCULAR';
		}
		if (state.get(key) === 'done') {
			return 0;
		}
		if (cid !== null) {
			const doc = await loadScript(cid);
			imports.push({cid: cid, updateTime: doc ? doc.updateTime : null});
			if (!doc) {
				return -1;
			}
			state.set(key, 'loading');
			if (!await part(String(doc.code || ''), key, true)) {
				state.delete(key);
				return -1;
			}
		} else if (/\.pg0$/.test(lib)) {
			let src;
			try {
				src = fs.readFileSync(path.join(DEV_DIR, lib), 'utf8');
			} catch (e) {
				return -1;
			}
			state.set(key, 'loading');
			if (!await part(src, String(file), true)) {
				state.delete(key);
				return -1;
			}
		} else {
			if (!fs.existsSync(path.join(DEV_DIR, lib))) {
				return -1;
			}
			libraries.push(lib + search);
		}
		state.set(key, 'done');
		return 0;
	}

	try {
		await part(String(code == null ? '' : code), '', extension);
	} catch (e) {
		// (such as a program nested too deeply for the parser)
		errors.push({key: String((e && e.message) || e), line: -1, part: ''});
	}
	const failed = errors.length > 0;
	return {
		libraries: libraries,
		screen: libraries.some(function(l) {
			return SCREEN_LIB.test(l);
		}),
		scripts: failed ? null : scripts.map(function(s) {
			return {name: s.name, extension: !!s.sci.extension, strict: !!s.sci.strict_val, token: s.token};
		}),
		exec: failed ? null : exec,
		errors: failed ? errors : null,
		imports: imports
	};
}

function escapeHtml(s) {
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The page with the name of the program as its title (and in the tags the
// sites that show a link read), since they do not run the page's script.
function pageOf(template, doc, url) {
	const title = (doc && doc.name) ? String(doc.name) : '';
	// (the memo of a script is a note on its revision, not a description)
	const description = title ? title + ' - PG0' : '';
	let page = template;
	if (title) {
		page = page.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtml(title) + '</title>')
			.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + escapeHtml(title) + '$2');
	}
	if (description) {
		page = page.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + escapeHtml(description) + '$2')
			.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + escapeHtml(description) + '$2');
	}
	return page.replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + escapeHtml(url) + '$2');
}

// deps: getDB, logger, countShow(db, doc, req).
module.exports = function(app, deps) {
	const logger = deps.logger;
	const parser = createParser();
	const toolchain = toolchainKey();
	const template = fs.readFileSync(PAGE_FILE, 'utf8');
	// cid -> promise of the compile under way, shared by requests that arrive meanwhile
	const compiling = new Map();
	let indexed = false;

	async function cache(db) {
		const col = db.collection('app_cache');
		if (!indexed) {
			indexed = true;
			try {
				await col.createIndex({cid: 1}, {unique: true});
			} catch (e) {
				logger.error(e);
			}
		}
		return col;
	}

	// Whether the stored scripts a compiled program imported are as they were.
	async function importsUnchanged(db, list) {
		for (const i of (Array.isArray(list) ? list : [])) {
			const doc = await db.collection('script').findOne({cid: i.cid}, {projection: {updateTime: 1}});
			if ((doc ? doc.updateTime : null) !== i.updateTime) {
				return false;
			}
		}
		return true;
	}

	async function compileScript(db, doc) {
		const now = Date.now();
		const result = await compile(parser, doc.code, doc.type !== 'PG0', async function(cid) {
			return await db.collection('script').findOne({cid: cid}, {projection: {code: 1, updateTime: 1}});
		});
		const data = JSON.stringify({
			cid: doc.cid,
			name: doc.name || '',
			type: doc.type || '',
			hash: programHash(doc.code),
			compiled: now,
			libraries: result.libraries,
			screen: result.screen,
			scripts: result.scripts,
			exec: result.exec,
			errors: result.errors
		});
		try {
			await (await cache(db)).updateOne({cid: doc.cid}, {$set: {
				updateTime: doc.updateTime,
				toolchain: toolchain,
				imports: result.imports,
				compiledTime: now,
				data: data
			}}, {upsert: true});
		} catch (e) {
			// (the program still runs; it is compiled again next time)
			logger.error(e);
		}
		return data;
	}

	// The compiled program of a stored script, as JSON text: the cached one
	// while it is current, else compiled now.
	async function compiled(db, doc) {
		const c = await (await cache(db)).findOne({cid: doc.cid});
		if (c && c.updateTime === doc.updateTime && c.toolchain === toolchain &&
			typeof c.data === 'string' && await importsUnchanged(db, c.imports)) {
			return c.data;
		}
		if (compiling.has(doc.cid)) {
			return await compiling.get(doc.cid);
		}
		const p = compileScript(db, doc);
		compiling.set(doc.cid, p);
		try {
			return await p;
		} finally {
			compiling.delete(doc.cid);
		}
	}

	// The page itself, with the program's name in it (mounted before the
	// static files, which would answer the file as it is).
	app.get(['/app', '/app/', '/app/index.html'], async (req, res) => {
		if (req.path === '/app') {
			const q = req.originalUrl.indexOf('?');
			return res.redirect(301, '/app/' + (q >= 0 ? req.originalUrl.substring(q) : ''));
		}
		const cid = String(req.query.cid || '');
		let doc = null;
		if (CID.test(cid)) {
			try {
				doc = await (await deps.getDB()).collection('script').findOne({cid: cid}, {projection: {name: 1}});
			} catch (error) {
				// (the page still loads; its script tells what went wrong)
				logger.error(error);
			}
		}
		const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
		const url = (host ? 'https://' + host : '') + '/app/' + (doc ? '?cid=' + encodeURIComponent(cid) : '');
		res.set('Cache-Control', 'no-cache');
		res.type('html').send(pageOf(template, doc, url));
	});

	app.get('/api/app/:cid', async (req, res) => {
		if (!CID.test(req.params.cid)) {
			return res.status(404).send('Not found.');
		}
		try {
			const db = await deps.getDB();
			const doc = await db.collection('script').findOne({cid: req.params.cid});
			if (!doc) {
				return res.status(404).send('Not found.');
			}
			const data = await compiled(db, doc);
			await deps.countShow(db, doc, req);
			// (the browser asks again each time; the ETag answers 304 while nothing changed)
			res.set('Cache-Control', 'no-cache');
			res.type('application/json').send(data);
		} catch (error) {
			logger.error(error);
			return res.status(500).send('Internal Server Error.');
		}
	});
};

module.exports.programHash = programHash;
module.exports.compile = compile;
module.exports.createParser = createParser;
module.exports.toolchainKey = toolchainKey;
