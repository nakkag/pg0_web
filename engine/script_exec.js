"use strict";

function ScriptExec(options) {
	options = options || {};
	const that = this;

	function declVariable(ei, name) {
		if (name in ei.vi) {
			ei.err = {msg: errMsg.ERR_DECLARE, line: ei.token[ei.index].line};
			return null;
		}
		ei.vi[name] = {type: 'TYPE_INTEGER', num: 0};
		return {name: name, v: ei.vi[name]};
	}

	function integerCalcValue(ei, v1, v2, type) {
		let i = v1.v.num;
		let j = v2.v.num;
		switch (type) {
		case 'SYM_DIV':
		case 'SYM_MOD':
			if (j == 0) {
				ei.err = {msg: errMsg.ERR_DIVZERO, line: ei.token[ei.index].line};
				return null;
			}
			if (type == 'SYM_DIV') {
				i /= j;
			} else {
				i %= j;
			}
			break;
		case 'SYM_MULTI': i *= j; break;
		case 'SYM_ADD': i += j; break;
		case 'SYM_SUB': i -= j; break;
		case 'SYM_EQEQ': i = i == j; break;
		case 'SYM_NTEQ': i = i != j; break;
		case 'SYM_LEFTEQ': i = i <= j; break;
		case 'SYM_LEFT': i = i < j; break;
		case 'SYM_RIGHTEQ': i = i >= j; break;
		case 'SYM_RIGHT': i = i > j; break;
		case 'SYM_AND': i &= j; break;
		case 'SYM_OR': i |= j; break;
		case 'SYM_XOR': i ^= j; break;
		case 'SYM_LEFTSHIFT': i = i << j; break;
		case 'SYM_RIGHTSHIFT': i = i >> j; break;
		case 'SYM_LEFTSHIFT_LOGICAL': i = (i << j) >>> 0; break;
		case 'SYM_RIGHTSHIFT_LOGICAL': i = i >>> j; break;
		default:
			ei.err = {msg: errMsg.ERR_OPERATOR, line: ei.token[ei.index].line};
			return null;
		}
		if (options.extension && i !== parseInt(i)) {
			return {name: '', v: {type: 'TYPE_FLOAT', num: i}};
		}
		return {name: '', v: {type: 'TYPE_INTEGER', num: parseInt(i)}};
	}

	function calcValue(ei, v1, v2, type) {
		if (v1.v.type === 'TYPE_ARRAY' || v2.v.type === 'TYPE_ARRAY') {
			// TODO:
		} else if (v1.v.type === 'TYPE_STRING' || v2.v.type === 'TYPE_STRING') {
			// TODO:
		}
		return integerCalcValue(ei, v1, v2, type);
	}

	function execSentense(ei) {
		let ret = 0;
		let vi, v1, v2;
		let stack = [];

		while (ei.index < ei.token.length) {
			const token = ei.token[ei.index];
			switch (token.type) {
			case 'SYM_BOPEN':
			case 'SYM_BOPEN_PRIMARY':
				// TODO:
				break;
			case 'SYM_BCLOSE':
			case 'SYM_DAMMY':
				break;
			case 'SYM_LINEEND':
				// TODO:
				stack = [];
				break;
			case 'SYM_LINESEP':
				// TODO:
				stack = [];
				break;
			case 'SYM_WORDEND':
				if (ei.index >= ei.token.length && ei.token[ei.index + 1].type === 'SYM_WORDEND') {
					stack.push({name: '', v: {type: 'TYPE_INTEGER', num: 0}});
				}
				break;
			case 'SYM_JUMP':
				// TODO:
				break;
			case 'SYM_JZE':
			case 'SYM_JNZ':
				// TODO:
				break;
			case 'SYM_RETURN':
			case 'SYM_EXIT':
				if (token.type === 'SYM_EXIT') {
					ret = 1;
				} else {
					ret = 2;
				}
				break;
			case 'SYM_BREAK':
				// TODO:
				break;
			case 'SYM_CONTINUE':
				// TODO:
				break;
			case 'SYM_CASE':
			case 'SYM_DEFAULT':
				// TODO:
				break;
			case 'SYM_CMP':
				// TODO:
				break;
			case 'SYM_CMPSTART':
			case 'SYM_ELSE':
			case 'SYM_CMPEND':
				break;
			case 'SYM_SWITCH':
				// TODO:
				break;
			case 'SYM_LOOP':
				// TODO:
				break;
			case 'SYM_LOOPEND':
			case 'SYM_LOOPSTART':
				break;
			case 'SYM_ARGSTART':
				// TODO:
				break;
			case 'SYM_FUNC':
				// TODO:
				break;
			case 'SYM_DECLVARIABLE':
				vi = declVariable(ei, token.buf);
				if (!vi) {
					ret = -1;
					break;
				}
				stack.push(vi);
				break;
			case 'SYM_VARIABLE':
				if (!(token.buf in ei.vi)) {
					if (options.strict_val) {
						ei.err = {msg: token.buf + errMsg.ERR_NOTDECLARE, line: ei.token[ei.index].line};
						ret = -1;
						break;
					}
					vi = declVariable(ei, token.buf);
					if (!vi) {
						ret = -1;
						break;
					}
				} else {
					vi = {name: token.buf, v: ei.vi[token.buf]};
				}
				stack.push(vi);
				break;
			case 'SYM_ARRAY':
				// TODO:
				break;
			case 'SYM_CONST_INT':
				vi = {name: '', v: {type: 'TYPE_INTEGER', num: token.num}};
				stack.push(vi);
				break;
			case 'SYM_CONST_FLOAT':
				vi = {name: '', v: {type: 'TYPE_FLOAT', num: token.num}};
				stack.push(vi);
				break;
			case 'SYM_CONST_STRING':
				vi = {name: '', v: {type: 'TYPE_STRING', str: token.buf}};
				stack.push(vi);
				break;
			case 'SYM_NOT':
				// TODO:
				break;
			case 'SYM_BITNOT':
			case 'SYM_PLUS':
			case 'SYM_MINS':
			case 'SYM_INC':
			case 'SYM_DEC':
			case 'SYM_BINC':
			case 'SYM_BDEC':
				// TODO:
				break;
			case 'SYM_EQ':
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = -1;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				ei.vi[v2.name] = v1.v;
				stack.push({name: v2.name, v: ei.vi[v2.name]});
				break;
			case 'SYM_COMP_EQ':
				// TODO:
				break;
			case 'SYM_LABELEND':
				// TODO:
				break;
			case 'SYM_CPAND':
			case 'SYM_CPOR':
				// TODO:
				break;
			default:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = -1;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				vi = calcValue(ei, v2, v1, token.type);
				if (!vi) {
					ret = -1;
					break;
				}
				stack.push(vi);
				break;
			}
			if (ret !== 0) {
				break;
			}
			ei.index++;
		}
		ei.stack = stack;
		return ret;
	}

	this.exec = function(token, vi, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == 'function') ? callbacks.success : ScriptParse.noop;
		callbacks.error = (typeof callbacks.error == 'function') ? callbacks.error : ScriptParse.noop;

		const ei = {vi: vi, token: token, index: 0, stack: []};
		if (execSentense(ei) < 0) {
			callbacks.error(ei.err);
			return;
		}
		if (ei.stack.length > 0) {
			callbacks.success(ei.stack.pop().v);
			return;
		}
		callbacks.success();
	};
}

