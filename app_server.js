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
//
// A private script can be imported only by a private program with the same
// edit password; to any other program it is as if it did not exist.
//
// The names of the variables and of the functions the program declares are
// made short (a, b, ... and _a, _b, ...) as pg0gen.exe does: the compiled
// program is smaller, and reads like nothing. Only what the names stand for
// is kept (see minify).
//
// The page is app/index.html, sent with the program's name in its title and
// its og: tags; its script and style are static files under public/app/.
//
// The parse trees go in the compact form of public/app/pack.js ("format": 2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const pack = require('./public/app/pack.js');

const DEV_DIR = path.join(__dirname, 'public', 'dev');
const PAGE_FILE = path.join(__dirname, 'app', 'index.html');
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
	h.update(fs.readFileSync(path.join(__dirname, 'public', 'app', 'pack.js')));
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
	return vm.runInContext('({Script: Script, ScriptParse: ScriptParse, SYM: {BOPEN_PRIMARY: SYM_BOPEN_PRIMARY, ' +
		'DECLVARIABLE: SYM_DECLVARIABLE, VARIABLE: SYM_VARIABLE, FUNCSTART: SYM_FUNCSTART, FUNC: SYM_FUNC}})', context);
}

// Short names: a letter or _ first, then letters, digits or _ (lower case,
// since the parser folds the case of half-width letters): a, b, ..., z, _,
// aa, ba, ... The n-th one (from 0).
const NAME_FIRST = 'abcdefghijklmnopqrstuvwxyz_';
const NAME_REST = 'abcdefghijklmnopqrstuvwxyz0123456789_';
const KEYWORDS = ['var', 'if', 'else', 'while', 'exit', 'for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function'];
function shortName(n) {
	let s = NAME_FIRST[n % NAME_FIRST.length];
	n = Math.floor(n / NAME_FIRST.length);
	while (n > 0) {
		n--;
		s += NAME_REST[n % NAME_REST.length];
		n = Math.floor(n / NAME_REST.length);
	}
	return s;
}

// Every token of a list and of the blocks under it; inBrace is true under a
// {...} that makes an array.
function walkTokens(tokens, SYM, fn, inBrace) {
	for (const t of tokens) {
		fn(t, inBrace);
		if (t.target) {
			walkTokens(t.target, SYM, fn, inBrace || t.type === SYM.BOPEN_PRIMARY);
		}
	}
}

// Gives the variables and the functions the program declares short names.
// The functions are one set for the whole program (a part calls the functions
// of another); a name that no part declares is a library function and stays.
// A variable is its own in each part. A variable named inside a {...} that
// makes an array keeps its name: the name becomes the key of the element
// ({x, y} is {"x": ..., "y": ...}). argv and argc stay for the executable,
// which hands the command line to the program under these names.
function minify(scripts, parser) {
	const SYM = parser.SYM;
	const fold = parser.Script.foldName;
	const funcs = new Map();
	scripts.forEach(function(s) {
		walkTokens(s.token, SYM, function(t) {
			if (t.type === SYM.FUNCSTART && !funcs.has(t.buf)) {
				funcs.set(t.buf, '_' + shortName(funcs.size));
			}
		}, false);
	});
	scripts.forEach(function(s) {
		const keep = new Set(['argv', 'argc']);
		walkTokens(s.token, SYM, function(t, inBrace) {
			if (inBrace && (t.type === SYM.VARIABLE || t.type === SYM.DECLVARIABLE)) {
				keep.add(fold(t.buf.replace(/^&/, '')));
			}
		}, false);
		const vars = new Map();
		let n = 0;
		function nextName() {
			let name;
			do {
				name = shortName(n++);
			} while (KEYWORDS.includes(name) || keep.has(name));
			return name;
		}
		walkTokens(s.token, SYM, function(t) {
			if (t.type === SYM.FUNCSTART || t.type === SYM.FUNC) {
				if (funcs.has(t.buf)) {
					t.buf = funcs.get(t.buf);
				}
			} else if (t.type === SYM.VARIABLE || t.type === SYM.DECLVARIABLE) {
				const ref = (t.buf.substring(0, 1) === '&') ? '&' : '';
				const name = ref ? t.buf.substring(1) : t.buf;
				if (keep.has(fold(name))) {
					return;
				}
				if (!vars.has(name)) {
					vars.set(name, nextName());
				}
				t.buf = ref + vars.get(name);
			}
		}, false);
	});
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
	if (!failed) {
		minify(scripts, parser);
	}
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
			const part = await db.collection('script').findOne({cid: cid}, {projection: {code: 1, updateTime: 1, private: 1, password: 1}});
			if (part && part.private && !(doc.private && String(doc.password) === String(part.password))) {
				return null;
			}
			return part;
		});
		const data = JSON.stringify({
			format: 2,
			cid: doc.cid,
			name: doc.name || '',
			type: doc.type || '',
			hash: programHash(doc.code),
			compiled: now,
			libraries: result.libraries,
			screen: result.screen,
			scripts: result.scripts ? result.scripts.map(pack.packScript) : null,
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

	// The page itself, with the program's name in it.
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
		// (the template is read each time: a new one is served without a restart)
		let template;
		try {
			template = fs.readFileSync(PAGE_FILE, 'utf8');
		} catch (error) {
			logger.error(error);
			return res.status(500).send('Internal Server Error.');
		}
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
