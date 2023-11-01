"use strict";

ScriptParse.noop = function() {};

function ScriptParse(options) {
	options = options || {};
	const that = this;

	this.extension = options.extension || false;
	this.strict_val = options.strict_val || false;

	this.keyword = {
		'var': 'SYM_VAR',
		'if': 'SYM_IF',
		'else': 'SYM_ELSE',
		'while': 'SYM_WHILE',
		'exit': 'SYM_EXIT',
	};

	this.extensionKeyword = {
		'for': 'SYM_FOR',
		'do': 'SYM_DO',
		'break': 'SYM_BREAK',
		'continue': 'SYM_CONTINUE',
		'switch': 'SYM_SWITCH',
		'case': 'SYM_CASE',
		'default': 'SYM_DEFAULT',
		'return': 'SYM_RETURN',
		'function': 'SYM_FUNCSTART'
	};

	function getExtensionToken(pi, p) {
		switch(p) {
		case ':':
			pi.type = 'SYM_LABELEND';
			pi.concat = true;
			break;
		case "'":
		case '"':
			if (!pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
				return;
			}
			pi.type = 'SYM_CONST_STRING';
			let re;
			if (p === "'") {
				re = /'((?:[^\\']+|\\.)*)'/;
			} else {
				re = /"((?:[^\\"]+|\\.)*)"/;
			}
			const m = pi.buf.match(re);
			if (!m) {
				pi.err = {msg: errMsg.ERR_SENTENC, line: pi.lineE};
				return;
			}
			pi.str = m[1];
			pi.concat = false;
			pi.buf = pi.buf.substr(m[0].length - 1);
			break;
		case '<':
			// TODO:
			break;
		case '>':
			// TODO:
			break;
		case '&':
			// TODO:
			break;
		case '|':
			// TODO:
			break;
		case '^':
			// TODO:
			break;
		case '~':
			// TODO:
			break;
		case '+':
			// TODO:
			break;
		case '-':
			// TODO:
			break;
		case '*':
			// TODO:
			break;
		case '/':
			// TODO:
			break;
		case '%':
			// TODO:
			break;
		}
	}

	function getToken(pi) {
		const prevType = pi.type;
		
		pi.buf = pi.buf.replace(/^[ \t　]+/, '');
		if (!pi.buf) {
			pi.type = 'SYM_EOF';
			return;
		}
		let p = pi.buf.substr(0, 1);
		pi.type = '';

		if (that.extension) {
			getExtensionToken(pi, p);
			if (pi.type) {
				pi.buf = pi.buf.substr(1);
				return;
			}
		}

		switch(p) {
		case '#':
			pi.type = 'SYM_PREP';
			pi.concat = true;
			break;
		case "\n":
			pi.line++;
			if (!pi.concat ||
				prevType === 'SYM_EXIT' || prevType === 'SYM_RETURN' ||
				prevType === 'SYM_BREAK' || prevType === 'SYM_CONTINUE') {
				pi.type = 'SYM_LINEEND';
				pi.concat = true;
			} else {
				pi.buf = pi.buf.substr(1);
				getToken(pi);
				return;
			}
			break;
		case ';':
			pi.type = 'SYM_LINESEP';
			pi.concat = true;
			break;
		case ',':
			pi.type = 'SYM_WORDEND';
			pi.concat = true;
			break;
		case '{':
			if (!pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE_PREV, line: pi.line};
				return;
			}
			pi.type = 'SYM_BOPEN';
			pi.concat = true;
			break;
		case '}':
			pi.type = 'SYM_BCLOSE';
			pi.concat = false;
			break;
		case '(':
			if (!pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE_PREV, line: pi.line};
				return;
			}
			pi.type = 'SYM_OPEN';
			pi.concat = true;
			break;
		case ')':
			pi.type = 'SYM_CLOSE';
			pi.concat = false;
			break;
		case '[':
			// TODO:
			break;
		case ']':
			// TODO:
			break;
		case '=':
			if (pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
				return;
			}
			if (/^==/.test(pi.buf)) {
				pi.type = 'SYM_EQEQ';
			} else {
				pi.type = 'SYM_EQ';
			}
			pi.concat = true;
			break;
		case '!':
			// TODO:
			break;
		case '<':
			// TODO:
			break;
		case '>':
			// TODO:
			break;
		case '&':
			// TODO:
			break;
		case '|':
			// TODO:
			break;
		case '*':
			if (pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
				return;
			}
			pi.type = 'SYM_MULTI';
			pi.concat = true;
			break;
		case '/':
			if (/^\/\//.test(pi.buf)) {
				pi.buf = pi.buf.replace(/^\/\/.*\n/, '');
				getToken(pi);
				return;
			}
			if (pi.concat) {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
				return;
			}
			pi.type = 'SYM_DIV';
			pi.concat = true;
			break;
		case '%':
			// TODO:
			break;
		case '+':
			if (pi.concat) {
				if (/^\+\+/.test(pi.buf)) {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
					return;
				}
				pi.type = 'SYM_PLUS';
				break;
			}
			pi.type = 'SYM_ADD';
			pi.concat = true;
			break;
		case '-':
			if (pi.concat) {
				if (/^--/.test(pi.buf)) {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
					return;
				}
				pi.type = 'SYM_MINS';
				break;
			}
			pi.type = 'SYM_SUB';
			pi.concat = true;
			break;
		}
		if (pi.type) {
			pi.buf = pi.buf.substr(1);
			return;
		}
		if (!pi.concat) {
			pi.err = {msg: errMsg.ERR_SENTENCE_PREV, line: pi.line};
			return;
		}
		pi.concat = false;
		if (/^[0-9\.]/.test(p)) {
			pi.type = 'SYM_CONST_INT';
			if (/^0x/i.test(pi.buf)) {
				const m = pi.buf.match(/0x[0-9a-f]+/i);
				if (!m) {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substr(m[0].length);
			} else if (/^0\./.test(pi.buf)) {
				pi.type = 'SYM_CONST_FLOAT';
				const m = pi.buf.match(/0\.[0-9]+/);
				if (!m) {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substr(m[0].length);
			} else {
				const m = pi.buf.match(/[0-9]+/);
				if (!m) {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
					return;
				}
				pi.str = m[0];
				pi.buf = pi.buf.substr(m[0].length);
			}
			return;
		}

		let re;
		if (that.extension) {
			re = /(&[a-z0-9_]+)|([a-z0-9_]+)/i;
		} else {
			re = /[a-z0-9_]+/i;
		}
		const m = pi.buf.match(re);
		if (!m) {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			return;
		}
		pi.str = m[0];
		pi.buf = pi.buf.substr(m[0].length);
		pi.buf = pi.buf.replace(/^[ \t　]+/, '');

		pi.type = that.keyword[pi.str];
		if (that.extension && !pi.type) {
			pi.type = that.extensionKeyword[pi.str];
		}
		if (pi.type) {
			pi.concat = true;
			return;
		}

		if (that.extension && /^\(/i.test(pi.buf)) {
			pi.type = 'SYM_FUNC';
			pi.concat = true;
		} else {
			pi.type = 'SYM_VARIABLE';
		}
	}

	function createToken(type, line) {
		return {type: type, line: line};
	}

	function primary(pi) {
		let token;
		switch (pi.type) {
		case 'SYM_BOPEN':
			token = createToken('SYM_BOPEN_PRIMARY', pi.line);
			pi.token.push(token);
			getToken(pi);
			const tk = pi.token;
			pi.token = [];
			expression(pi);
			tk[tk.length - 1].target = pi.token;
			pi.token = tk;
			if (pi.err) {
				return;
			}
			if (pi.type !== 'SYM_BCLOSE') {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			}
			getToken(pi);
			break;
		case 'SYM_OPEN':
			getToken(pi);
			arrayKey(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== 'SYM_CLOSE') {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			}
			getToken(pi);
			break;
		case 'SYM_FUNC':
			// TODO:
			break;
		case 'SYM_VARIABLE':
			if (pi.decl) {
				token = createToken('SYM_DECLVARIABLE', pi.line);
			} else {
				token = createToken(pi.type, pi.line);
			}
			token.buf = pi.str;
			pi.token.push(token);
			getToken(pi);
			break;
		case 'SYM_CONST_INT':
			token = createToken(pi.type, pi.line);
			if (/^0x/i.test(pi.str)) {
				token.num = parseInt(pi.str, 16);
			} else if (/^0/i.test(pi.str)) {
				token.num = parseInt(pi.str, 8);
			} else {
				token.num = parseInt(pi.str, 10);
			}
			pi.token.push(token);
			getToken(pi);
			if (pi.decl || pi.type === 'SYM_EQ' || pi.type === 'SYM_COMP_EQ') {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			}
			break;
		case 'SYM_CONST_FLOAT':
			token = createToken(pi.type, pi.line);
			token.num = parseFloat(pi.str);
			pi.token.push(token);
			getToken(pi);
			if (pi.decl || pi.type === 'SYM_EQ' || pi.type === 'SYM_COMP_EQ') {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			}
			break;
		case 'SYM_CONST_STRING':
			token = createToken(pi.type, pi.line);
			token.buf = pi.str;
			pi.token.push(token);
			getToken(pi);
			if (pi.decl || pi.type === 'SYM_EQ' || pi.type === 'SYM_COMP_EQ') {
				pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			}
			break;
		}
	}

	function array(pi) {
		primary(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === 'SYM_ARRAYOPEN') {
			getToken(pi);
			if (pi.err) {
				return;
			}
			if (pi.type !== 'SYM_ARRAYCLOSE') {
				logicalOR(pi);
				if (pi.err) {
					return;
				}
				if (pi.type !== 'SYM_ARRAYCLOSE') {
					pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
				}
				const token = createToken('SYM_ARRAY', pi.line);
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
		// TODO:
	}

	function multiplicative(pi) {
		unaryOperator(pi);
		if (pi.err) {
			return;
		}
		while (pi.type === 'SYM_MULTI' || pi.type === 'SYM_DIV' || pi.type === 'SYM_MOD') {
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
		while (pi.type === 'SYM_ADD' || pi.type === 'SYM_SUB') {
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
		// TODO:
	}

	function relational(pi) {
		shift(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function equality(pi) {
		relational(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function and(pi) {
		equality(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function exclusiveOr(pi) {
		and(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function or(pi) {
		exclusiveOr(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function logicalAND(pi) {
		or(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function logicalOR(pi) {
		logicalAND(pi);
		if (pi.err) {
			return;
		}
		// TODO:
	}

	function arrayKey(pi) {
		logicalOR(pi);
		if (pi.case_end) {
			return;
		}
		if (pi.err) {
			return;
		}
		while (pi.type === 'SYM_LABELEND') {
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
		// TODO:
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
		while (pi.type === 'SYM_EQ') {
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
		while (pi.type === 'SYM_WORDEND') {
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
		if (pi.type === 'SYM_EOF' || pi.type === 'SYM_BCLOSE') {
			return;
		}
		if (pi.type !== 'SYM_LINEEND' && pi.type !== 'SYM_LINESEP') {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			return;
		}
		const token = createToken(pi.type, pi.line - ((pi.type === 'SYM_LINEEND') ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function condition(pi) {
	}

	function ifStatement(pi) {
	}

	function switchStatement(pi) {
	}

	function whileStatement(pi) {
	}

	function doWhileStatement(pi) {
	}

	function forStatement(pi) {
	}

	function jumpStatement(pi) {
		const type = pi.type;
		let token = createToken(pi.type, pi.line);
		getToken(pi);
		if (type === 'SYM_EXIT' || type === 'SYM_RETURN') {
			pi.condition = true;
			arrayKey(pi);
			pi.condition = false;
			if (pi.err) {
				return;
			}
		}
		pi.token.push(token);
		if (pi.type === 'SYM_EOF' || pi.type === 'SYM_BCLOSE') {
			return;
		}
		if (pi.type !== 'SYM_LINEEND' && pi.type !== 'SYM_LINESEP') {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			return;
		}
		token = createToken(pi.type, pi.line - ((pi.type === 'SYM_LINEEND') ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function caseStatement(pi) {
		const type = pi.type;
		let token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
		if (type === 'SYM_CASE') {
			pi.case_end = true;
			pi.condition = true;
			arrayKey(pi);
			pi.case_end = false;
			pi.condition = false;
			if (pi.err) {
				return;
			}
		}
		if (pi.type !== 'SYM_LABELEND') {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
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
			if (pi.type === 'SYM_EQ') {
				assignment(pi);
				if (pi.err) {
					return;
				}
			}
			if (pi.type !== 'SYM_WORDEND') {
				break;
			}
			const token = createToken(pi.type, pi.line);
			pi.token.push(token);
			getToken(pi);
		}
	}

	function varDecl(pi) {
		getToken(pi);
		varDeclList(pi);
		if (pi.err) {
			return;
		}
		if (pi.type === 'SYM_EOF' || pi.type === 'SYM_BCLOSE') {
			return;
		}
		if (pi.type !== 'SYM_LINEEND' && pi.type !== 'SYM_LINESEP') {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			return;
		}
		const token = createToken(pi.type, pi.line - ((pi.type === 'SYM_LINEEND') ? 1 : 0));
		pi.token.push(token);
		getToken(pi);
	}

	function funcDecl(pi) {
	}

	function compoundStatement(pi) {
		getToken(pi);
		const tk = pi.token;
		pi.token = [];
		while (pi && !pi.err && pi.type !== 'SYM_EOF' && pi.type !== 'SYM_BCLOSE') {
			statementList(pi);
		}
		if (!pi) {
			return;
		}
		tk[tk.length - 1].target = pi.token;
		pi.token = tk;
		if (pi.err) {
			return;
		}
		
		if (pi.type !== 'SYM_BCLOSE') {
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			return;
		}
		pi.concat = true;
		
		const token = createToken(pi.type, pi.line);
		pi.token.push(token);
		getToken(pi);
	}

	function statementList(pi) {
		pi.lv++;
		switch (pi.type) {
		case 'SYM_EOF':
			break;
		case 'SYM_PREP':
			// TODO:
			break;
		case 'SYM_BOPEN':
			const token = createToken(pi.type, pi.line);
			pi.token.push(token);
			compoundStatement(pi);
			break;
		case 'SYM_IF':
			ifStatement(pi);
			break;
		case 'SYM_WHILE':
			whileStatement(pi);
			break;
		case 'SYM_SWITCH':
			switchStatement(pi);
			break;
		case 'SYM_DO':
			doWhileStatement(pi);
			break;
		case 'SYM_FOR':
			forStatement(pi);
			break;
		case 'SYM_BREAK':
		case 'SYM_CONTINUE':
		case 'SYM_RETURN':
			jumpStatement(pi);
			break;
		case 'SYM_CASE':
		case 'SYM_DEFAULT':
			caseStatement(pi);
			break;
		case 'SYM_FUNCSTART':
			funcDecl(pi);
			break;
		case 'SYM_EXIT':
			jumpStatement(pi);
			break;
		case 'SYM_VAR':
			varDecl(pi);
			break;
		case 'SYM_VARIABLE':
		case 'SYM_CONST_INT':
		case 'SYM_CONST_FLOAT':
		case 'SYM_OPEN':
		case 'SYM_NOT':
		case 'SYM_PLUS':
		case 'SYM_MINS':
		case 'SYM_WORDEND':
		case 'SYM_LINEEND':
		case 'SYM_LINESEP':
		case 'SYM_FUNC':
		case 'SYM_BITNOT':
		case 'SYM_INC':
		case 'SYM_DEC':
			expressionStatement(pi);
			break;
		default:
			pi.err = {msg: errMsg.ERR_SENTENCE, line: pi.line};
			break;
		}
		pi.lv--;
	}

	this.parse = function(buf, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == 'function') ? callbacks.success : ScriptParse.noop;
		callbacks.error = (typeof callbacks.error == 'function') ? callbacks.error : ScriptParse.noop;

		let pi = {
			buf: buf,
			concat: true,
			line: 0,
			lv: 0,
			err: null
		};

		getToken(pi);
		if (pi.err) {
			callbacks.error(pi.err);
			return;
		}
		pi.token = [];
		while (!pi.err && pi.type !== 'SYM_EOF') {
			statementList(pi);
		}
		if (pi.err) {
			callbacks.error(pi.err);
			return;
		}
		callbacks.success(pi.token);
	};
}
