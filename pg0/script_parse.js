"use strict";

function ScriptParse(sci) {
	const that = this;
	this.import = Script.noop;
	this.library = Script.noop;

	this.keyword = {
		'var': SYM_VAR,
		'if': SYM_IF,
		'else': SYM_ELSE,
		'while': SYM_WHILE,
		'exit': SYM_EXIT,
	};

	this.extensionKeyword = {
		'for': SYM_FOR,
		'do': SYM_DO,
		'break': SYM_BREAK,
		'continue': SYM_CONTINUE,
		'switch': SYM_SWITCH,
		'case': SYM_CASE,
		'default': SYM_DEFAULT,
		'return': SYM_RETURN,
		'function': SYM_FUNCSTART
	};

	function getExtensionToken(pi, p) {
		switch(p) {
		case ':':
			pi.type = SYM_LABELEND;
			pi.concat = true;
			break;
		case "'":
		case '"':
			if (!pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_CONST_STRING;
			let re;
			if (p === "'") {
				re = /'((?:[^\\']+|\\.)*)'/;
			} else {
				re = /"((?:[^\\"]+|\\.)*)"/;
			}
			const m = pi.buf.match(re);
			if (!m) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENC, pi.line);
				return;
			}
			pi.str = m[1];
			pi.concat = false;
			pi.buf = pi.buf.substring(m[0].length - 1);
			break;
		case '<':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '<') {
				if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '<') {
					pi.type = SYM_LEFTSHIFT_LOGICAL;
					pi.buf = pi.buf.substring(2);
					if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '=') {
						pi.cType = pi.type;
						pi.type = SYM_COMP_EQ;
						pi.buf = pi.buf.substring(1);
					}
				} else {
					pi.type = SYM_LEFTSHIFT;
					pi.buf = pi.buf.substring(1);
					if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '=') {
						pi.cType = pi.type;
						pi.type = SYM_COMP_EQ;
						pi.buf = pi.buf.substring(1);
					}
				}
				pi.concat = true;
			}
			break;
		case '>':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '>') {
				if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '>') {
					pi.type = SYM_RIGHTSHIFT_LOGICAL;
					pi.buf = pi.buf.substring(2);
					if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '=') {
						pi.cType = pi.type;
						pi.type = SYM_COMP_EQ;
						pi.buf = pi.buf.substring(1);
					}
				} else {
					pi.type = SYM_RIGHTSHIFT;
					pi.buf = pi.buf.substring(1);
					if (pi.buf.length > 2 && pi.buf.substring(2, 3) === '=') {
						pi.cType = pi.type;
						pi.type = SYM_COMP_EQ;
						pi.buf = pi.buf.substring(1);
					}
				}
				pi.concat = true;
			}
			break;
		case '&':
			if (pi.concat) {
				if (sci.extension) {
					break;
				}
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) !== '&') {
				pi.type = SYM_AND;
				pi.concat = true;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.cType = pi.type;
				pi.type = SYM_COMP_EQ;
				pi.buf = pi.buf.substring(1);
			}
			break;
		case '|':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) !== '|') {
				pi.type = SYM_OR;
				pi.concat = true;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.cType = pi.type;
				pi.type = SYM_COMP_EQ;
				pi.buf = pi.buf.substring(1);
			}
			break;
		case '^':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_XOR;
			pi.concat = true;
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.cType = pi.type;
				pi.type = SYM_COMP_EQ;
				pi.buf = pi.buf.substring(1);
			}
			break;
		case '~':
			if (!pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_BITNOT;
			break;
		case '+':
			if (pi.concat) {
				if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '+') {
					pi.type = SYM_INC;
					pi.buf = pi.buf.substring(1);
				}
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '+') {
				pi.type = SYM_BINC;
				pi.buf = pi.buf.substring(1);
				pi.concat = false;
			} else if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_COMP_EQ;
				pi.cType = SYM_ADD;
				pi.buf = pi.buf.substring(1);
				pi.concat = true;
			}
			break;
		case '-':
			if (pi.concat) {
				if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '-') {
					pi.type = SYM_DEC;
					pi.buf = pi.buf.substring(1);
				}
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '-') {
				pi.type = SYM_BDEC;
				pi.buf = pi.buf.substring(1);
				pi.concat = false;
			} else if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_COMP_EQ;
				pi.cType = SYM_SUB;
				pi.buf = pi.buf.substring(1);
				pi.concat = true;
			}
			break;
		case '*':
			if (pi.concat) {
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_COMP_EQ;
				pi.cType = SYM_MULTI;
				pi.buf = pi.buf.substring(1);
				pi.concat = true;
			}
			break;
		case '/':
			if (pi.concat) {
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_COMP_EQ;
				pi.cType = SYM_DIV;
				pi.buf = pi.buf.substring(1);
				pi.concat = true;
			}
			break;
		case '%':
			if (pi.concat) {
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_COMP_EQ;
				pi.cType = SYM_MOD;
				pi.buf = pi.buf.substring(1);
				pi.concat = true;
			}
			break;
		}
	}

	function getToken(pi) {
		const prevType = pi.type;
		
		pi.buf = pi.buf.replace(/^[ \t\r　]+/, '');
		if (!pi.buf) {
			pi.type = SYM_EOF;
			return;
		}
		let p = pi.buf.substring(0, 1);
		pi.type = '';

		if (sci.extension) {
			getExtensionToken(pi, p);
			if (pi.type) {
				pi.buf = pi.buf.substring(1);
				return;
			}
		}

		switch(p) {
		case '#':
			pi.type = SYM_PREP;
			pi.concat = true;
			break;
		case "\n":
			pi.line++;
			if (!pi.concat ||
				prevType === SYM_EXIT || prevType === SYM_RETURN ||
				prevType === SYM_BREAK || prevType === SYM_CONTINUE) {
				pi.type = SYM_LINEEND;
				pi.concat = true;
			} else {
				pi.buf = pi.buf.substring(1);
				getToken(pi);
				return;
			}
			break;
		case ';':
			pi.type = SYM_LINESEP;
			pi.concat = true;
			break;
		case ',':
			pi.type = SYM_WORDEND;
			pi.concat = true;
			break;
		case '{':
			if (!pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE_PREV, pi.line);
				return;
			}
			pi.type = SYM_BOPEN;
			pi.concat = true;
			break;
		case '}':
			pi.type = SYM_BCLOSE;
			pi.concat = false;
			break;
		case '(':
			if (!pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE_PREV, pi.line);
				return;
			}
			pi.type = SYM_OPEN;
			pi.concat = true;
			break;
		case ')':
			pi.type = SYM_CLOSE;
			pi.concat = false;
			break;
		case '[':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_ARRAYOPEN;
			pi.concat = true;
			break;
		case ']':
			pi.type = SYM_ARRAYCLOSE;
			pi.concat = false;
			break;
		case '=':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_EQEQ;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.type = SYM_EQ;
			}
			pi.concat = true;
			break;
		case '!':
			if (pi.concat) {
				pi.type = SYM_NOT;
				break;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_NTEQ;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.concat = true;
			break;
		case '<':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_LEFTEQ;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.type = SYM_LEFT;
			}
			pi.concat = true;
			break;
		case '>':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '=') {
				pi.type = SYM_RIGHTEQ;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.type = SYM_RIGHT;
			}
			pi.concat = true;
			break;
		case '&':
			if (pi.concat) {
				if (sci.extension) {
					break;
				}
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '&') {
				pi.type = SYM_CPAND;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.concat = true;
			break;
		case '|':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '|') {
				pi.type = SYM_CPOR;
				pi.buf = pi.buf.substring(1);
			} else {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.concat = true;
			break;
		case '*':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_MULTI;
			pi.concat = true;
			break;
		case '/':
			if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '/') {
				pi.buf = pi.buf.replace(/^\/\/.*(\n|$)/, "\n");
				getToken(pi);
				return;
			}
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_DIV;
			pi.concat = true;
			break;
		case '%':
			if (pi.concat) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			pi.type = SYM_MOD;
			pi.concat = true;
			break;
		case '+':
			if (pi.concat) {
				if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '+') {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.type = SYM_PLUS;
				break;
			}
			pi.type = SYM_ADD;
			pi.concat = true;
			break;
		case '-':
			if (pi.concat) {
				if (pi.buf.length > 1 && pi.buf.substring(1, 2) === '-') {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.type = SYM_MINS;
				break;
			}
			pi.type = SYM_SUB;
			pi.concat = true;
			break;
		}
		if (pi.type) {
			pi.buf = pi.buf.substring(1);
			return;
		}
		if (!pi.concat) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE_PREV, pi.line);
			return;
		}
		pi.concat = false;
		if (/^[0-9\.]/.test(p)) {
			pi.type = SYM_CONST_INT;
			if (sci.extension && /^0x/i.test(pi.buf)) {
				const m = pi.buf.match(/0x[0-9a-f]+/i);
				if (!m) {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substring(m[0].length);
			} else if (sci.extension && /^0[0-9]/i.test(pi.buf)) {
				const m = pi.buf.match(/[0-9]+/);
				if (!m) {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substring(m[0].length);
			} else if (sci.extension && /(^[0-9]+\.[0-9]*)|(^[0-9]*\.[0-9]+)/.test(pi.buf)) {
				pi.type = SYM_CONST_FLOAT;
				const m = pi.buf.match(/(^[0-9]+\.[0-9]*)|(^[0-9]*\.[0-9]+)/);
				if (!m) {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substring(m[0].length);
			} else {
				const m = pi.buf.match(/[0-9]+/);
				if (!m) {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substring(m[0].length);
			}
			return;
		}

		let m;
		if (sci.extension) {
			m = pi.buf.match(/(&[a-z0-9_]+)|([a-z0-9_]+)/i);
		} else {
			m = pi.buf.match(/[a-z0-9_]+/i);
		}
		if (!m) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		pi.str = m[0];
		pi.buf = pi.buf.substring(m[0].length);
		pi.buf = pi.buf.replace(/^[ \t\r　]+/, '');

		pi.type = that.keyword[pi.str];
		if (sci.extension && !pi.type) {
			pi.type = that.extensionKeyword[pi.str];
		}
		if (pi.type) {
			pi.concat = true;
			return;
		}

		if (sci.extension && /^\(/i.test(pi.buf)) {
			pi.type = SYM_FUNC;
			pi.concat = true;
		} else {
			pi.type = SYM_VARIABLE;
		}
	}

	function createToken(type, line) {
		return {type: type, line: line};
	}

	function primary(pi) {
		let token;
		switch (pi.type) {
		case SYM_BOPEN:
			token = createToken(SYM_BOPEN_PRIMARY, pi.line);
			pi.token.push(token);
			getToken(pi);
			if (pi.err) {
				return;
			}
			const tk = pi.token;
			pi.token = [];
			expression(pi);
			tk[tk.length - 1].target = pi.token;
			pi.token = tk;
			if (pi.err) {
				return;
			}
			if (pi.type !== SYM_BCLOSE) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			getToken(pi);
			break;
		case SYM_OPEN:
			getToken(pi);
			if (pi.err) {
				return;
			}
			arrayKey(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== SYM_CLOSE) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			getToken(pi);
			break;
		case SYM_FUNC:
			if (pi.str.substring(1, 2) === '&') {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			token = createToken(SYM_ARGSTART, -1);
			pi.token.push(token);
			token = createToken(pi.type, pi.line);
			token.buf = pi.str.toLowerCase();
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== SYM_OPEN) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			getToken(pi);
			if (pi.err) {
				return;
			}
			expression(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== SYM_CLOSE) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			getToken(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
			break;
		case SYM_VARIABLE:
			if (pi.decl) {
				token = createToken(SYM_DECLVARIABLE, pi.line);
			} else {
				token = createToken(pi.type, pi.line);
			}
			token.buf = pi.str;
			pi.token.push(token);
			getToken(pi);
			break;
		case SYM_CONST_INT:
			token = createToken(pi.type, pi.line);
			if (/^0x/i.test(pi.str)) {
				token.num = parseInt(pi.str, 16) | 0;
			} else if (/^0/i.test(pi.str)) {
				token.num = parseInt(pi.str, 8) | 0;
			} else {
				token.num = parseInt(pi.str, 10);
				if (token.num > 0x7FFFFFFF) {
					token.num = 0x7FFFFFFF | 0;
				} else {
					token.num = token.num | 0;
				}
			}
			pi.token.push(token);
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.decl || pi.type === SYM_EQ || pi.type === SYM_COMP_EQ) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			break;
		case SYM_CONST_FLOAT:
			token = createToken(pi.type, pi.line);
			token.num = parseFloat(pi.str);
			pi.token.push(token);
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.decl || pi.type === SYM_EQ || pi.type === SYM_COMP_EQ) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			break;
		case SYM_CONST_STRING:
			token = createToken(pi.type, pi.line);
			token.buf = pi.str;
			pi.token.push(token);
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.decl || pi.type === SYM_EQ || pi.type === SYM_COMP_EQ) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			break;
		}
	}

	function array(pi) {
		primary(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_ARRAYOPEN) {
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== SYM_ARRAYCLOSE) {
				logicalOR(pi);
				if (pi.err) {
					return;
				}
				if (pi.type !== SYM_ARRAYCLOSE) {
					pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
					return;
				}
				const token = createToken(SYM_ARRAY, pi.line);
				pi.token.push(token);
			}
			getToken(pi);
			if (pi.err) {
				return;
			}
			primary(pi);
			if (pi.err) {
				return;
			}
		}
	}

	function unaryOperator(pi) {
		array(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_NOT || pi.type === SYM_BITNOT ||
			pi.type === SYM_PLUS || pi.type === SYM_MINS ||
			pi.type === SYM_INC || pi.type === SYM_DEC ||
			pi.type === SYM_BINC || pi.type === SYM_BDEC) {
			const token = createToken(pi.type, pi.line);
			if (pi.err) {
				return;
			}
			if (pi.type === SYM_BINC || pi.type === SYM_BDEC) {
				pi.token.push(token);
				getToken(pi);
				if (pi.err) {
					return;
				}
				unaryOperator(pi);
				if (pi.err) {
					return;
				}
			} else {
				getToken(pi);
				if (pi.err) {
					return;
				}
				unaryOperator(pi);
				if (pi.err) {
					return;
				}
				pi.token.push(token);
			}
		}
	}

	function multiplicative(pi) {
		unaryOperator(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_MULTI || pi.type === SYM_DIV || pi.type === SYM_MOD) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			unaryOperator(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function additive(pi) {
		multiplicative(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_ADD || pi.type === SYM_SUB) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			multiplicative(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function shift(pi) {
		additive(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_LEFTSHIFT || pi.type === SYM_RIGHTSHIFT ||
			pi.type === SYM_LEFTSHIFT_LOGICAL || pi.type === SYM_RIGHTSHIFT_LOGICAL) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			additive(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function relational(pi) {
		shift(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_LEFT || pi.type === SYM_LEFTEQ ||
			pi.type === SYM_RIGHT || pi.type === SYM_RIGHTEQ) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			shift(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function equality(pi) {
		relational(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_EQEQ || pi.type === SYM_NTEQ) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			relational(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function and(pi) {
		equality(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_AND) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			equality(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function exclusiveOr(pi) {
		and(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_XOR) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			and(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function or(pi) {
		exclusiveOr(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_OR) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			exclusiveOr(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function logicalAND(pi) {
		or(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_CPAND) {
			let token = createToken(SYM_JZE, -1);
			pi.token.push(token);
			const jmp_tk = token;
			token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			or(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
			token = createToken(SYM_DAMMY, -1);
			pi.token.push(token);
			jmp_tk.link = pi.token.length - 1;
		}
	}

	function logicalOR(pi) {
		logicalAND(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_CPOR) {
			let token = createToken(SYM_JNZ, -1);
			pi.token.push(token);
			const jmp_tk = token;
			token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			logicalAND(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
			token = createToken(SYM_DAMMY, -1);
			pi.token.push(token);
			jmp_tk.link = pi.token.length - 1;
		}
	}

	function arrayKey(pi) {
		logicalOR(pi);
		if (pi.case_end) {
			return;
		}
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_LABELEND) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			logicalOR(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function compoundAssignment(pi) {
		arrayKey(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_COMP_EQ) {
			const compEqTk = createToken(pi.type, pi.line);
			const compTk = createToken(pi.cType, pi.line);
			const eqTk = createToken(SYM_EQ, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			arrayKey(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(compEqTk);
			pi.token.push(compTk);
			pi.token.push(eqTk);
		}
	}

	function assignment(pi) {
		if (pi.condition) {
			arrayKey(pi);
			return;
		}
		compoundAssignment(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_EQ) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			assignment(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function expression(pi) {
		assignment(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === SYM_WORDEND) {
			const token = createToken(pi.type, pi.line);
			getToken(pi);
			if (pi.err) {
				return;
			}
			assignment(pi);
			if (pi.err) {
				return;
			}
			pi.token.push(token);
		}
	}

	function expressionStatement(pi) {
		expression(pi);
		if (pi.err) {
			return;
		}
		if (pi.type === SYM_EOF || pi.type === SYM_BCLOSE) {
			return;
		}
		if (pi.type !== SYM_LINEEND && pi.type !== SYM_LINESEP) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		const token = createToken(pi.type, pi.line - ((pi.type === SYM_LINEEND) ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function condition(pi, isDo) {
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (pi.type !== SYM_OPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (pi.type === SYM_CLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		pi.condition = true;
		arrayKey(pi);
		pi.condition = false;
		if (pi.err) {
			return;
		}
		if (pi.type !== SYM_CLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		pi.concat = !isDo;
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (!isDo && pi.type !== SYM_BOPEN) {
			pi.err = Script.error(sci, errMsg.ERR_BLOCK, pi.line);
			return;
		}
	}

	function ifStatement(pi) {
		let token = createToken(SYM_CMPSTART, pi.line);
		pi.token.push(token);
		condition(pi, false);
		if (pi.err) {
			return;
		}
		token = createToken(SYM_CMP, -1);
		pi.token.push(token);
		const else_tk = token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		statementList(pi);
		if (pi.err) {
			return;
		}
		const line = pi.line;
		const end_tk = token = createToken(SYM_JUMP, -1);
		pi.token.push(token);

		token = createToken(SYM_ELSE, line);
		pi.token.push(token);
		else_tk.link = pi.token.length - 1;
		if (pi.type === SYM_ELSE) {
			pi.concat = true;
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (sci.extension && pi.type === SYM_IF) {
				ifStatement(pi);
			} else {
				if (pi.type !== SYM_BOPEN) {
					pi.err = Script.error(sci, errMsg.ERR_BLOCK, pi.line);
					return;
				}
				statementList(pi);
				if (pi.err) {
					return;
				}
			}
		}
		token = createToken(SYM_CMPEND, -1);
		pi.token.push(token);
		end_tk.link = pi.token.length - 1;
	}

	function switchStatement(pi) {
		const line = pi.line;
		condition(pi, false);
		if (pi.err) {
			return;
		}
		const token = createToken(SYM_SWITCH, line);
		pi.token.push(token);
		if (pi.type !== SYM_BOPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		statementList(pi);
	}

	function whileStatement(pi) {
		let token = createToken(SYM_LOOPSTART, pi.line);
		pi.token.push(token);
		const st_index = pi.token.length - 1;
		condition(pi, false);
		if (pi.err) {
			return;
		}
		token = createToken(SYM_LOOP, -1);
		pi.token.push(token);

		const tk = pi.token;
		pi.token = [];
		statementList(pi);
		if (pi.err) {
			return;
		}
		tk[tk.length - 1].target = pi.token;
		pi.token = tk;

		const end_tk = token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		token.link = st_index;
		token = createToken(SYM_LOOPEND, -1);
		pi.token.push(token);
		end_tk.link = pi.token.length - 1;
	}

	function doWhileStatement(pi) {
		let token = createToken(SYM_LOOPSTART, pi.line);
		pi.token.push(token);
		const st_index = pi.token.length - 1;
		token = createToken(SYM_LOOP, -1);
		pi.token.push(token);
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (pi.type !== SYM_BOPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}

		const tk = pi.token;
		pi.token = [];
		statementList(pi);
		if (pi.err) {
			return;
		}
		tk[tk.length - 1].target = pi.token;
		pi.token = tk;

		token = createToken(SYM_DAMMY, -1);
		pi.token.push(token);
		if (pi.type !== SYM_WHILE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		condition(pi, true);
		if (pi.err) {
			return;
		}
		token = createToken(SYM_CMP, -1);
		pi.token.push(token);
		if (pi.type !== SYM_LINEEND && pi.type !== SYM_LINESEP && pi.type !== SYM_EOF && pi.type !== SYM_BCLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		const end_tk = token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		token.link = st_index;
		token = createToken(SYM_LOOPEND, -1);
		pi.token.push(token);
		end_tk.link = pi.token.length - 1;
	}

	function forStatement(pi) {
		const line = pi.line;
		getToken(pi);
		if (pi.err) {
			return;
		}
		// (
		if (pi.type !== SYM_OPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Initialisation
		if (pi.type === SYM_VAR) {
			getToken(pi);
			if (pi.err) {
				return;
			}
			varDeclList(pi);
		} else {
			expression(pi);
		}
		if (pi.err) {
			return;
		}
		// ;
		if (pi.type !== SYM_LINESEP) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		let token = createToken(pi.type, pi.line);
		pi.token.push(token);
		// Loop start
		token = createToken(SYM_LOOPSTART, line);
		pi.token.push(token);
		const st_index = pi.token.length - 1;
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Condition
		pi.condition = true;
		arrayKey(pi);
		pi.condition = false;
		if (pi.err) {
			return;
		}
		// ;
		if (pi.type !== SYM_LINESEP) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Reinitialization
		let tk = pi.token;
		pi.token = [];
		expression(pi);
		if (pi.err) {
			return;
		}
		const ret_tk = pi.token;
		pi.token = tk;
		// )
		if (pi.type !== SYM_CLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		// Loop
		token = createToken(SYM_LOOP, -1);
		pi.token.push(token);
		pi.concat = true;
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Proccess
		tk = pi.token;
		pi.token = [];
		statementList(pi);
		if (pi.err) {
			return;
		}
		tk[tk.length - 1].target = pi.token;
		pi.token = tk;
		// Jump to loop end
		const end_tk = token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		// Add reinitialization
		pi.token = pi.token.concat(ret_tk);
		token = createToken(SYM_LINESEP, -1);
		pi.token.push(token);
		// Jump to loop start
		token = createToken(SYM_JUMP, -1);
		pi.token.push(token);
		token.link = st_index;
		// Loop end
		token = createToken(SYM_LOOPEND, -1);
		pi.token.push(token);
		end_tk.link = pi.token.length - 1;
	}

	function jumpStatement(pi) {
		const type = pi.type;
		let token = createToken(pi.type, pi.line);
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (type === SYM_EXIT || type === SYM_RETURN) {
			pi.condition = true;
			arrayKey(pi);
			pi.condition = false;
			if (pi.err) {
				return;
			}
		}
		pi.token.push(token);
		if (pi.type === SYM_EOF || pi.type === SYM_BCLOSE) {
			return;
		}
		if (pi.type !== SYM_LINEEND && pi.type !== SYM_LINESEP) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		token = createToken(pi.type, pi.line - ((pi.type === SYM_LINEEND) ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function caseStatement(pi) {
		const type = pi.type;
		let token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
		if (pi.err) {
			return;
		}
		if (type === SYM_CASE) {
			pi.case_end = true;
			pi.condition = true;
			arrayKey(pi);
			pi.case_end = false;
			pi.condition = false;
			if (pi.err) {
				return;
			}
		}
		if (pi.type !== SYM_LABELEND) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
	}

	function varDeclList(pi) {
		while (1) {
			pi.decl = true;
			array(pi);
			pi.decl = false;
			if (pi.type === SYM_EQ) {
				assignment(pi);
				if (pi.err) {
					return;
				}
			}
			if (pi.type !== SYM_WORDEND) {
				break;
			}
			const token = createToken(pi.type, pi.line);
			pi.token.push(token);
			getToken(pi);
			if (pi.err) {
				return;
			}
		}
	}

	function varDecl(pi) {
		getToken(pi);
		if (pi.err) {
			return;
		}
		varDeclList(pi);
		if (pi.err) {
			return;
		}
		if (pi.type === SYM_EOF || pi.type === SYM_BCLOSE) {
			return;
		}
		if (pi.type !== SYM_LINEEND && pi.type !== SYM_LINESEP) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		const token = createToken(pi.type, pi.line - ((pi.type === SYM_LINEEND) ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function funcDecl(pi) {
		// Jump to function end
		let token = createToken(SYM_JUMP, -1);
		const end_tk = token;
		pi.token.push(token);
		// Function
		token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Function name
		if (pi.type !== SYM_FUNC) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		token.buf = pi.str.toLowerCase();
		token = createToken(pi.type, pi.line);
		getToken(pi);
		if (pi.err) {
			return;
		}
		// (
		if (pi.type !== SYM_OPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Arguments
		varDeclList(pi);
		if (pi.err) {
			return;
		}
		// )
		if (pi.type !== SYM_CLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		pi.concat = true;
		getToken(pi);
		if (pi.err) {
			return;
		}
		// Function name
		pi.token.push(token);
		// Function body
		if (pi.type !== SYM_BOPEN) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		compoundStatement(pi);
		if (pi.err) {
			return;
		}
		// Function end
		token = createToken(SYM_FUNCEND, -1);
		pi.token.push(token);
		end_tk.link = pi.token.length - 1;
	}

	function compoundStatement(pi) {
		getToken(pi);
		if (pi.err) {
			return;
		}
		const tk = pi.token;
		pi.token = [];
		while (pi.type !== SYM_EOF && pi.type !== SYM_BCLOSE) {
			statementList(pi);
			if (pi.err) {
				return;
			}
		}
		tk[tk.length - 1].target = pi.token;
		pi.token = tk;
		
		if (pi.type !== SYM_BCLOSE) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		pi.concat = true;
		
		const token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
	}

	function getContent(buf) {
		let m = buf.match(/^ *\( *"(.+)" *\) *$/);
		if (!m || m.length < 2) {
			m = buf.match(/^ *\( *'(.+)' *\) *$/);
			if (!m || m.length < 2) {
				m = buf.match(/^ *\( *(.+) *\) *$/);
				if (!m || m.length < 2) {
					return null;
				}
			}
		}
		return m[1];
	}

	async function preprocessor(pi, buf) {
		const c = buf.match(/^[^\(]+/);
		if (!c) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		const cmd = c[0].trim().toLowerCase();
		let content = getContent(buf.replace(/^[^\(]+/, ''));
		if (!content) {
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			return;
		}
		switch(cmd) {
		case 'import':
			if (await that.import(content)) {
				pi.err = Script.error(sci, errMsg.ERR_SCRIPT, pi.line);
				return;
			}
			break;
		case 'option':
			content = content.toLowerCase();
			if (content === 'pg0.5') {
				sci.extension = true;
			} else if (content === 'strict') {
				sci.strict_val = true;
			} else {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			}
			break;
		default:
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			break;
		}
	}

	async function statementList(pi) {
		pi.level++;
		switch (pi.type) {
		case SYM_EOF:
			break;
		case SYM_PREP:
			const m = pi.buf.match(/^.+(\n|$)/);
			if (!m) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			await preprocessor(pi, m[0].replace(/\n/, ''));
			if (pi.err) {
				return;
			}
			pi.buf = pi.buf.replace(/^.*(\n|$)/, "\n");
			getToken(pi);
			if (pi.err) {
				return;
			}
			break;
		case SYM_BOPEN:
			const token = createToken(pi.type, pi.line);
			pi.token.push(token);
			compoundStatement(pi);
			break;
		case SYM_IF:
			ifStatement(pi);
			break;
		case SYM_WHILE:
			whileStatement(pi);
			break;
		case SYM_SWITCH:
			switchStatement(pi);
			break;
		case SYM_DO:
			doWhileStatement(pi);
			break;
		case SYM_FOR:
			forStatement(pi);
			break;
		case SYM_BREAK:
		case SYM_CONTINUE:
		case SYM_RETURN:
			jumpStatement(pi);
			break;
		case SYM_CASE:
		case SYM_DEFAULT:
			caseStatement(pi);
			break;
		case SYM_FUNCSTART:
			if (pi.level > 1) {
				pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
				return;
			}
			funcDecl(pi);
			break;
		case SYM_EXIT:
			jumpStatement(pi);
			break;
		case SYM_VAR:
			varDecl(pi);
			break;
		case SYM_VARIABLE:
		case SYM_CONST_INT:
		case SYM_CONST_FLOAT:
		case SYM_OPEN:
		case SYM_NOT:
		case SYM_PLUS:
		case SYM_MINS:
		case SYM_WORDEND:
		case SYM_LINEEND:
		case SYM_LINESEP:
		case SYM_FUNC:
		case SYM_BITNOT:
		case SYM_INC:
		case SYM_DEC:
			expressionStatement(pi);
			break;
		default:
			pi.err = Script.error(sci, errMsg.ERR_SENTENCE, pi.line);
			break;
		}
		pi.level--;
	}

	this.parse = async function(buf, callbacks) {
		callbacks = callbacks || {};
		that.import = (typeof callbacks.import === 'function') ? callbacks.import : Script.noop;
		that.library = (typeof callbacks.library === 'function') ? callbacks.library : Script.noop;
		callbacks.success = (typeof callbacks.success === 'function') ? callbacks.success : Script.noop;
		callbacks.error = (typeof callbacks.error === 'function') ? callbacks.error : Script.noop;

		let pi = {
			src: buf,
			buf: buf,
			type: '',
			cType: '',
			concat: true,
			decl: false,
			case_end: false,
			condition: false,
			level: 0,
			line: 0,
			err: null
		};

		getToken(pi);
		if (pi.err) {
			await callbacks.error(pi.err);
			return;
		}
		pi.token = [];
		while (!pi.err && pi.type !== SYM_EOF) {
			await statementList(pi);
		}
		if (pi.err) {
			await callbacks.error(pi.err);
			return;
		}
		await callbacks.success(pi.token);
	};
}
