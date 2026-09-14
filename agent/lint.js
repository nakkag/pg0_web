"use strict";
// Best-effort static warnings for PG0 / PG0.5 source (used by POST /check).
// Warnings never fail a check; they point at typical mistakes that the interpreter accepts.

const KEYWORDS = ['var', 'if', 'else', 'while', 'exit', 'for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function'];
const OPERATORS = ['<<<=', '>>>=', '<<=', '>>=', '<<<', '>>>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>'];
const COMPOUND = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '<<<=', '>>>='];
// Identifiers: ASCII letters, digits, underscore and any non-ASCII character (full-width names are allowed).
const IDENT_START = /[A-Za-z_-￿]/;
const IDENT_CHAR = /[A-Za-z0-9_-￿]/;

const MESSAGES = {
	en: {
		block_local_variable: function(name, declLine) {
			return `Variable "${name}" was first used inside a block at line ${declLine}, so it is local to that block; here it is a different variable that starts at 0. Create it before the block (for example "${name} = 0" at the top level).`;
		},
		split_variable: function(name, writeLine) {
			return `Variable "${name}" is never created at the top level, so each block that uses it gets its own copy: the assignment at line ${writeLine} and this read refer to different variables (this one stays 0). Create it before both blocks (for example "${name} = 0" at the top level).`;
		},
		unused_variable: function(name) {
			return `Variable "${name}" is assigned but never read.`;
		},
		keyed_initializer: function(name) {
			return `In an array initializer a bare variable such as "${name}" becomes a keyed element ("${name}": value), not a plain list element. Write "${name} + 0" (or "" + ${name} for strings) if you want a list.`;
		},
		undeclared_variable: function(name) {
			return `#option("strict") is set but "${name}" is not declared with var in this scope or an enclosing one; the program will stop with "Undefined variable" when this line runs.`;
		}
	},
	ja: {
		block_local_variable: function(name, declLine) {
			return `変数 "${name}" は ${declLine} 行目のブロック内で初めて使われたためそのブロックのローカル変数です。ここでは別の変数（初期値 0）になります。ブロックの前に作ってください（例: 最上位で "${name} = 0"）。`;
		},
		split_variable: function(name, writeLine) {
			return `変数 "${name}" は最上位で作られていないため、使っているブロックごとに別の変数になります。${writeLine} 行目の代入とここでの読み取りは別の変数を指しています（ここでは 0 のまま）。両方のブロックより前に作ってください（例: 最上位で "${name} = 0"）。`;
		},
		unused_variable: function(name) {
			return `変数 "${name}" は代入されていますが一度も読まれていません。`;
		},
		keyed_initializer: function(name) {
			return `配列の初期化子に裸の変数 "${name}" を書くと、リストの要素ではなくキー付きの要素（"${name}": 値）になります。リストにしたい場合は "${name} + 0"（文字列なら "" + ${name}）と書いてください。`;
		},
		undeclared_variable: function(name) {
			return `#option("strict") が指定されていますが、"${name}" はこのスコープにも外側のスコープにも var で宣言されていません。この行の実行時に「変数が定義されていません」で停止します。`;
		}
	}
};

function tokenize(src) {
	const tokens = [];
	const lines = src.split(/\r\n|\r|\n/);
	for (let ln = 0; ln < lines.length; ln++) {
		const line = lines[ln];
		let i = 0;
		if (/^\s*#/.test(line)) {
			tokens.push({t: 'nl', line: ln});
			continue;
		}
		while (i < line.length) {
			const ch = line[i];
			if (ch === ' ' || ch === '\t') {
				i++;
				continue;
			}
			if (ch === '/' && line[i + 1] === '/') {
				break;
			}
			if (ch === '"' || ch === "'") {
				let j = i + 1;
				while (j < line.length && line[j] !== ch) {
					if (line[j] === '\\') {
						j++;
					}
					j++;
				}
				tokens.push({t: 'str', line: ln});
				i = j + 1;
				continue;
			}
			if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] || ''))) {
				let j = i + 1;
				while (j < line.length && /[0-9A-Za-z_.]/.test(line[j])) {
					j++;
				}
				tokens.push({t: 'num', line: ln});
				i = j;
				continue;
			}
			if (IDENT_START.test(ch)) {
				let j = i + 1;
				while (j < line.length && IDENT_CHAR.test(line[j])) {
					j++;
				}
				const word = line.substring(i, j);
				tokens.push({t: KEYWORDS.indexOf(word) >= 0 ? 'kw' : 'id', v: word, line: ln});
				i = j;
				continue;
			}
			let op = null;
			for (const o of OPERATORS) {
				if (line.startsWith(o, i)) {
					op = o;
					break;
				}
			}
			if (!op) {
				op = ch;
			}
			tokens.push({t: 'op', v: op, line: ln});
			i += op.length;
		}
		tokens.push({t: 'nl', line: ln});
	}
	return tokens;
}

// A "{" opens a block when it follows ")", ";", "}", "else", "do", a line start, or another block brace.
function isBlockBrace(tokens, i) {
	let j = i - 1;
	while (j >= 0 && tokens[j].t === 'nl') {
		j--;
	}
	if (j < 0) {
		return true;
	}
	const p = tokens[j];
	if (p.t === 'op' && (p.v === ')' || p.v === ';' || p.v === '}')) {
		return true;
	}
	if (p.t === 'kw' && (p.v === 'else' || p.v === 'do')) {
		return true;
	}
	if (p.t === 'op' && p.v === '{') {
		return isBlockBrace(tokens, j);
	}
	return false;
}

function isCall(tokens, i) {
	return tokens[i + 1] && tokens[i + 1].t === 'op' && tokens[i + 1].v === '(';
}

function lint(src, lang) {
	const msg = MESSAGES[lang === 'ja' ? 'ja' : 'en'];
	const strict = /^\s*#\s*option\s*\(\s*["']strict["']\s*\)/im.test(src);
	const tokens = tokenize(src);
	const warnings = [];
	const warned = {};

	function warn(code, line, name, text) {
		const key = code + ':' + name + ':' + line;
		if (warned[key]) {
			return;
		}
		warned[key] = true;
		warnings.push({code: code, line: line + 1, name: name, message: text});
	}

	// Pass 1: token index of the first top-level (outside blocks and functions) reference of each name.
	const firstTopRef = {};
	{
		let depth = 0;
		const kinds = [];
		for (let i = 0; i < tokens.length; i++) {
			const tk = tokens[i];
			if (tk.t === 'op' && tk.v === '{') {
				const block = isBlockBrace(tokens, i);
				kinds.push(block);
				if (block) {
					depth++;
				}
			} else if (tk.t === 'op' && tk.v === '}') {
				if (kinds.pop()) {
					depth--;
				}
			} else if (tk.t === 'id' && depth === 0 && !isCall(tokens, i) && !(tokens[i - 1] && tokens[i - 1].t === 'kw' && tokens[i - 1].v === 'function')) {
				if (firstTopRef[tk.v] === undefined) {
					firstTopRef[tk.v] = i;
				}
			}
		}
	}

	// Pass 2: resolve every reference against the scope chain, like the interpreter does.
	const globalScope = {vars: {}, block: false, parent: null};
	const scopes = [globalScope];
	const braceKinds = [];
	const closed = {};
	const pendingClose = {};
	let inFunction = false;

	function current() {
		return scopes[scopes.length - 1];
	}
	function lookup(name) {
		for (let s = current(); s; s = s.parent) {
			if (s.vars[name]) {
				return s.vars[name];
			}
		}
		return null;
	}
	const declsByName = {};
	function declare(scope, name, line) {
		const v = {name: name, line: line, reads: 0, writes: 0, param: false, scope: scope};
		scope.vars[name] = v;
		(declsByName[name] || (declsByName[name] = [])).push(v);
		return v;
	}
	function closeScope() {
		const s = scopes.pop();
		Object.keys(s.vars).forEach(function(name) {
			const v = s.vars[name];
			if (v.writes > 0 && v.reads === 0 && !v.param) {
				warn('unused_variable', v.line, name, msg.unused_variable(name));
			}
			if (s.block) {
				closed[name] = v;
			}
		});
	}

	for (let i = 0; i < tokens.length; i++) {
		const tk = tokens[i];
		if (tk.t === 'kw' && tk.v === 'function') {
			let j = i + 1;
			if (tokens[j] && tokens[j].t === 'id') {
				j++;
			}
			const fnScope = {vars: {}, block: false, parent: globalScope};
			if (tokens[j] && tokens[j].t === 'op' && tokens[j].v === '(') {
				let depthP = 1;
				let expectName = true;
				for (j++; j < tokens.length && depthP > 0; j++) {
					const p = tokens[j];
					if (p.t === 'op' && p.v === '(') {
						depthP++;
					} else if (p.t === 'op' && p.v === ')') {
						depthP--;
					} else if (p.t === 'op' && p.v === ',' && depthP === 1) {
						expectName = true;
					} else if (p.t === 'id' && expectName && depthP === 1) {
						const pv = declare(fnScope, p.v, p.line);
						pv.param = true;
						pv.declared = true;
						expectName = false;
					}
				}
			}
			while (j < tokens.length && !(tokens[j].t === 'op' && tokens[j].v === '{')) {
				j++;
			}
			scopes.push(fnScope);
			braceKinds.push('fn');
			inFunction = true;
			i = j;
			continue;
		}
		if (tk.t === 'op' && tk.v === '{') {
			if (isBlockBrace(tokens, i)) {
				scopes.push({vars: {}, block: true, parent: current()});
				const p = tokens[i - 1];
				braceKinds.push((p && p.t === 'kw' && p.v === 'do') ? 'doblock' : 'block');
			} else {
				braceKinds.push('init');
			}
			continue;
		}
		if (tk.t === 'op' && tk.v === '}') {
			const kind = braceKinds.pop();
			if (kind === 'doblock') {
				// The condition of do { } while (cond) is evaluated inside the block scope.
				let j = i + 1;
				while (tokens[j] && tokens[j].t === 'nl') {
					j++;
				}
				let closeAt = i;
				if (tokens[j] && tokens[j].t === 'kw' && tokens[j].v === 'while' && tokens[j + 1] && tokens[j + 1].t === 'op' && tokens[j + 1].v === '(') {
					let d = 0;
					for (let m = j + 1; m < tokens.length; m++) {
						if (tokens[m].t === 'op' && tokens[m].v === '(') {
							d++;
						} else if (tokens[m].t === 'op' && tokens[m].v === ')') {
							d--;
							if (d === 0) {
								closeAt = m;
								break;
							}
						}
					}
				}
				if (closeAt === i) {
					closeScope();
				} else {
					pendingClose[closeAt] = (pendingClose[closeAt] || 0) + 1;
				}
			} else if (kind === 'block') {
				closeScope();
			} else if (kind === 'fn') {
				closeScope();
				inFunction = false;
			}
			continue;
		}
		if (pendingClose[i]) {
			for (let n = 0; n < pendingClose[i]; n++) {
				closeScope();
			}
			delete pendingClose[i];
			continue;
		}
		if (tk.t === 'kw' && tk.v === 'var') {
			let expectName = true;
			let depthAny = 0;
			for (let j = i + 1; j < tokens.length; j++) {
				const p = tokens[j];
				if ((p.t === 'nl' || (p.t === 'op' && p.v === ';')) && depthAny === 0) {
					break;
				}
				if (p.t === 'op' && (p.v === '(' || p.v === '[' || p.v === '{')) {
					depthAny++;
				} else if (p.t === 'op' && (p.v === ')' || p.v === ']' || p.v === '}')) {
					depthAny--;
				} else if (p.t === 'op' && p.v === ',' && depthAny === 0) {
					expectName = true;
				} else if (p.t === 'id' && expectName && depthAny === 0) {
					const v = declare(current(), p.v, p.line);
					v.declared = true;
					expectName = false;
					if (tokens[j + 1] && tokens[j + 1].t === 'op' && tokens[j + 1].v === '=') {
						v.writes++;
					}
					p.declared = true;
				}
			}
			continue;
		}
		if (tk.t !== 'id' || tk.declared || isCall(tokens, i)) {
			continue;
		}
		const prev = tokens[i - 1];
		// {a, b} inside an initializer: bare variables become keyed elements
		if (braceKinds[braceKinds.length - 1] === 'init' && prev && prev.t === 'op' && (prev.v === '{' || prev.v === ',')) {
			const nx = tokens[i + 1];
			if (nx && nx.t === 'op' && (nx.v === ',' || nx.v === '}')) {
				warn('keyed_initializer', tk.line, tk.v, msg.keyed_initializer(tk.v));
			}
		}
		if (prev && prev.t === 'op' && prev.v === '&') {
			continue;
		}
		// skip index expressions to find the operator that follows the variable
		let k = i + 1;
		while (tokens[k] && tokens[k].t === 'op' && tokens[k].v === '[') {
			let d = 0;
			for (; k < tokens.length; k++) {
				if (tokens[k].t === 'op' && tokens[k].v === '[') {
					d++;
				} else if (tokens[k].t === 'op' && tokens[k].v === ']') {
					d--;
					if (d === 0) {
						k++;
						break;
					}
				}
			}
		}
		const after = tokens[k];
		let write = false;
		let read = true;
		if (after && after.t === 'op') {
			if (after.v === '=') {
				write = true;
				read = false;
			} else if (COMPOUND.indexOf(after.v) >= 0 || after.v === '++' || after.v === '--') {
				write = true;
			}
		}
		if (prev && prev.t === 'op' && (prev.v === '++' || prev.v === '--')) {
			write = true;
		}
		const name = tk.v;
		let v = lookup(name);
		if (strict && (!v || !v.declared) && !(v && globalScope.vars[name] === v && v.declared)) {
			// In strict mode every variable must come from a var declaration (or be a parameter).
			if (!v || !v.declared) {
				warn('undeclared_variable', tk.line, name, msg.undeclared_variable(name));
			}
		}
		if (!v) {
			const cur = current();
			// A name referenced at top level before this point (or anywhere, inside a function body) resolves to the global.
			const globalExists = firstTopRef[name] !== undefined && (inFunction || firstTopRef[name] < i);
			if (cur !== globalScope && globalExists) {
				v = globalScope.vars[name] || declare(globalScope, name, tk.line);
			} else {
				// Reading a name that only existed inside an already closed block is the typical scope mistake.
				if (closed[name] && read) {
					warn('block_local_variable', tk.line, name, msg.block_local_variable(name, closed[name].line + 1));
				}
				v = declare(cur, name, tk.line);
			}
		}
		if (write) {
			v.writes++;
		}
		if (read) {
			v.reads++;
		}
	}
	while (scopes.length > 1) {
		closeScope();
	}
	// A name that only exists inside blocks/functions, written in one and read in another, is split
	// into unrelated variables whatever the textual order of the blocks.
	Object.keys(declsByName).forEach(function(name) {
		if (globalScope.vars[name]) {
			return;
		}
		const decls = declsByName[name].filter(function(v) { return !v.param && !v.declared; });
		const writer = decls.find(function(v) { return v.writes > 0; });
		if (!writer) {
			return;
		}
		decls.forEach(function(v) {
			if (v !== writer && v.reads > 0 && v.writes === 0) {
				warn('split_variable', v.line, name, msg.split_variable(name, writer.line + 1));
			}
		});
	});
	// An "unused" write inside a block that is later read outside is already covered by the scope warnings.
	const scopeWarned = {};
	warnings.forEach(function(w) {
		if (w.code === 'block_local_variable' || w.code === 'split_variable') {
			scopeWarned[w.name] = true;
		}
	});
	return warnings.filter(function(w) {
		return !(w.code === 'unused_variable' && scopeWarned[w.name]);
	}).sort(function(a, b) {
		return a.line - b.line;
	});
}

module.exports = {lint: lint};
