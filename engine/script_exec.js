"use strict";

ScriptExec.noop = function() {};

function ScriptExec(options) {
	options = options || {};
	const that = this;

	this.getValueInt = function(v) {
		if (v.type === TYPE_FLOAT) {
			return parseInt(v.num);
		}
		if (v.type !== TYPE_INTEGER) {
			return 0;
		}
		return v.num;
	}

	this.getValueString = function(v) {
		let buf;
		switch (v.type) {
		case TYPE_ARRAY:
			buf = '';
			break;
		case TYPE_STRING:
			buf = v.str;
			break;
		default:
			buf = '' + v.num;
			break;
		}
		return buf;
	}

	this.getValueFloat = function(v) {
		if (v.type === TYPE_INTEGER) {
			return parseFloat(v.num);
		}
		if (v.type !== TYPE_FLOAT) {
			return 0.0;
		}
		return v.num;
	}

	this.getValueBoolean = function(v) {
		switch (v.type) {
		case TYPE_STRING:
			if (!v.str) {
				return 0;
			}
			break;
		case TYPE_FLOAT:
			if (v.num == 0.0) {
				return 0;
			}
			break;
		default:
			if (v.num == 0) {
				return 0;
			}
			break;
		}
		return 1;
	}

	function setValue(to_v, from_v) {
		let type = from_v.type;
		switch (from_v.type) {
		case TYPE_ARRAY:
			to_v.array = JSON.parse(JSON.stringify(from_v.array));
			delete to_v.num;
			delete to_v.str;
			break;
		case TYPE_STRING:
			to_v.str = from_v.str;
			delete to_v.num;
			delete to_v.array;
			break;
		default:
			to_v.num = from_v.num;
			if (to_v.num === parseInt(to_v.num)) {
				type = TYPE_INTEGER;
			}
			delete to_v.str;
			delete to_v.array;
			break;
		}
		to_v.type = type;
	}

	function indexToArray(ei, pvi, index) {
		if (index < 0) {
			ei.err = {msg: errMsg.ERR_INDEX, line: ei.token[ei.index].line};
			return null;
		}
		if (!pvi.v.array || pvi.v.type !== TYPE_ARRAY) {
			pvi.v.array = [];
		}
		pvi.v.type = TYPE_ARRAY;
		delete pvi.v.num;
		delete pvi.v.str;
		for (let i = pvi.v.array.length; i <= index; i++) {
			pvi.v.array[i] = {name: '', v: {type: TYPE_INTEGER, num: 0}};
		}
		return pvi.v.array[index];
	}

	function getArrayValue(ei, pvi, keyv) {
		if (keyv.type !== TYPE_STRING) {
			return indexToArray(ei, pvi, that.getValueInt(keyv));
		}
		const key = keyv.str;
		if (pvi.v.type !== TYPE_ARRAY) {
			pvi.v.type = TYPE_ARRAY;
			delete pvi.v.num;
			delete pvi.v.str;
			pvi.v.array = [];
			const vi = {name: key, v: {type: TYPE_INTEGER, num: 0}};
			pvi.v.array.push(vi);
			return vi;
		}
		const tmp_key = key.toLowerCase();
		let vi = pvi.v.array.find(function(v) {
			return v.name !== '' && tmp_key === v.name.toLowerCase();
		});
		if (!vi) {
			vi = {name: key, v: {type: TYPE_INTEGER, num: 0}};
			pvi.v.array.push(vi);
		}
		return vi;
	}

	function getVariable(ei, name) {
		for (; ei; ei = ei.parent) {
			if (name in ei.vi) {
				return ei.vi[name];
			}
		}
		return null;
	}

	function declVariable(ei, name) {
		if (name in ei.vi) {
			ei.err = {msg: errMsg.ERR_DECLARE, line: ei.token[ei.index].line};
			return null;
		}
		ei.vi[name] = {type: TYPE_INTEGER, num: 0};
		return {name: name, v: ei.vi[name]};
	}

	function findCase(ei, v1) {
		const token = ei.token[ei.index].target;
		for (let i = 0; i < token.length; i++) {
			if (token[i].type !== SYM_CASE) {
				continue;
			}
			const cei = {parent: ei, vi: {}, token: token, index: i + 1, to_tk: SYM_LABELEND, stack: [], inc_vi: [], dec_vi: []};
			const ret = execSentense(cei);
			if (ret === RET_ERROR) {
				ei.err = cei.err;
				return -1;
			}
			if (cei.stack.length === 0) {
				return -1;
			}
			const v2 = cei.stack.pop();
			const vi = calcValue(ei, v2, v1, SYM_EQEQ);
			if (!vi) {
				return -1;
			}
			if (that.getValueBoolean(vi.v)) {
				return i;
			}
		}
		for (let i = ei.index; i < token.length; i++) {
			if (token[i].type === SYM_DEFAULT) {
				return i;
			}
		}
		return -1;
	}

	function unaryCalcValue(ei, vi, type) {
		let i = vi.v.num;
		switch (type) {
		case SYM_NOT:
			i = !i;
			break;
		case SYM_PLUS:
			i = +i;
			break;
		case SYM_MINS:
			i = -i;
			break;
		case SYM_BITNOT:
			i = ~parseInt(i);
			break;
		case SYM_INC:
			i++;
			vi.v.num = i;
			break;
		case SYM_DEC:
			i--;
			vi.v.num = i;
			break;
		case SYM_BINC:
		case SYM_BDEC:
			switch (type) {
			case SYM_BINC:
				ei.inc_vi.push(vi);
				break;
			case SYM_BDEC:
				ei.dec_vi.push(vi);
				break;
			}
			return vi;
		}
		if (typeof i === 'boolean') {
			i = i ? 1 : 0;
		}
		let vret = {name: '', v: {type: TYPE_INTEGER, num: i}};
		if (options.extension && i !== parseInt(i)) {
			vret.v.type = TYPE_FLOAT;
		}
		return vret;
	}

	function unaryCalcString(ei, vi, type) {
		let i = 0;
		switch (type) {
		case SYM_NOT:
			if (vi.v.str === '') {
				i = 1;
			} else {
				i = 0;
			}
			break;
		}
		return {name: '', v: {type: TYPE_INTEGER, num: i}};
	}

	function integerCalcValue(ei, v1, v2, type) {
		let i = v1.v.num;
		let j = v2.v.num;
		switch (type) {
		case SYM_DIV:
		case SYM_MOD:
			if (j == 0) {
				ei.err = {msg: errMsg.ERR_DIVZERO, line: ei.token[ei.index].line};
				return null;
			}
			if (type == SYM_DIV) {
				i /= j;
			} else {
				i %= j;
			}
			break;
		case SYM_MULTI: i *= j; break;
		case SYM_ADD: i += j; break;
		case SYM_SUB: i -= j; break;
		case SYM_EQEQ: i = i == j; break;
		case SYM_NTEQ: i = i != j; break;
		case SYM_LEFTEQ: i = i <= j; break;
		case SYM_LEFT: i = i < j; break;
		case SYM_RIGHTEQ: i = i >= j; break;
		case SYM_RIGHT: i = i > j; break;
		case SYM_AND: i &= j; break;
		case SYM_OR: i |= j; break;
		case SYM_XOR: i ^= j; break;
		case SYM_LEFTSHIFT: i = i << j; break;
		case SYM_RIGHTSHIFT: i = i >> j; break;
		case SYM_LEFTSHIFT_LOGICAL: i = (i << j) >>> 0; break;
		case SYM_RIGHTSHIFT_LOGICAL: i = i >>> j; break;
		default:
			ei.err = {msg: errMsg.ERR_OPERATOR, line: ei.token[ei.index].line};
			return null;
		}
		if (typeof i === 'boolean') {
			i = i ? 1 : 0;
		}
		if (options.extension && i !== parseInt(i)) {
			return {name: '', v: {type: TYPE_FLOAT, num: i}};
		}
		return {name: '', v: {type: TYPE_INTEGER, num: parseInt(i)}};
	}

	function stringCalcValue(ei, v1, v2, type) {
		let p1, p2;
		if (v1.v.type === TYPE_INTEGER || v1.v.type === TYPE_FLOAT) {
			p1 = '' + v1.v.num;
		} else {
			p1 = v1.v.str;
		}
		if (v2.v.type === TYPE_INTEGER || v2.v.type === TYPE_FLOAT) {
			p2 = '' + v2.v.num;
		} else {
			p2 = v2.v.str;
		}
		let i;
		switch (type) {
		case SYM_ADD:
			return {name: '', v: {type: TYPE_STRING, str: p1 + p2}};
		case SYM_EQEQ:
			i = (p1 === p2) ? 1 : 0;
			break;
		case SYM_NTEQ:
			i = (p1 === p2) ? 0 : 1;
			break;
		default:
			ei.err = {msg: errMsg.ERR_OPERATOR, line: ei.token[ei.index].line};
			return null;
		}
		return {name: '', v: {type: TYPE_INTEGER, num: i}};
	}

	function arrayCalcValue(ei, v1, v2, type) {
		let result = 0;
		switch (type) {
		case SYM_ADD:
			const vret = {name: '', v: {type: TYPE_ARRAY, array: []}};
			if (v1.v.type === TYPE_ARRAY) {
				vret.v.array = JSON.parse(JSON.stringify(v1.v.array));
				if (v2.v.type === TYPE_ARRAY) {
					vret.v.array = vret.v.array.concat(v2.v.array);
				}
			} else {
				vret.v.array = JSON.parse(JSON.stringify(v2.v.array));
			}
			return vret;
		case SYM_EQEQ:
		case SYM_NTEQ:
			if (v1.v.type === TYPE_ARRAY && v2.v.type === TYPE_ARRAY && v1.v.type.length === v2.v.type.length) {
				result = 1;
				for (let i = 0; i < v1.v.type.length; i++) {
					const vi = calcValue(ei, v1, v2, SYM_EQEQ);
					if (!getValueBoolean(vi.v)) {
						result = 0;
						break;
					}
				}
			}
			if (type === SYM_NTEQ) {
				result = result ? 0 : 1;
			}
			break;
		default:
			ei.err = {msg: errMsg.ERR_ARRAYOPERATOR, line: ei.token[ei.index].line};
			return null;
		}
		return {name: '', v: {type: TYPE_INTEGER, num: result}};
	}

	function calcValue(ei, v1, v2, type) {
		if (v1.v.type === TYPE_ARRAY || v2.v.type === TYPE_ARRAY) {
			return arrayCalcValue(ei, v1, v2, type);
		} else if (v1.v.type === TYPE_STRING || v2.v.type === TYPE_STRING) {
			return stringCalcValue(ei, v1, v2, type);
		}
		return integerCalcValue(ei, v1, v2, type);
	}

	function postfixValue(ei) {
		ei.inc_vi.forEach(function(vi) {
			vi.v.num++;
		});
		ei.inc_vi = [];
		ei.dec_vi.forEach(function(vi) {
			vi.v.num--;
		});
		ei.dec_vi = [];
	}

	function execSentense(ei) {
		let cei;
		let ret = RET_SUCCESS;
		let retSt;
		let vi, v1, v2;
		let stack = [];
		let cp;

		while (ei.index < ei.token.length && ei.token[ei.index].type != ei.to_tk) {
			console.log('token=' + ei.token[ei.index].type + ', stack=' + JSON.stringify(stack) + ', vi=' + JSON.stringify(ei.vi));
			const token = ei.token[ei.index];
			switch (token.type) {
			case SYM_BOPEN:
			case SYM_BOPEN_PRIMARY:
				postfixValue(ei);
				cei = {parent: ei, vi: {}, token: token.target, index: 0, to_tk: -1, stack: [], inc_vi: [], dec_vi: []};
				ret = execSentense(cei);
				if (ret === RET_ERROR || ret === RET_BREAK || ret === RET_CONTINUE) {
					ei.err = cei.err;
				}
				stack.push({name: '', v: {type: TYPE_ARRAY, array: cei.stack}});
				break;
			case SYM_BCLOSE:
			case SYM_DAMMY:
				break;
			case SYM_LINEEND:
				postfixValue(ei);
				stack = [];
				break;
			case SYM_LINESEP:
				postfixValue(ei);
				stack = [];
				break;
			case SYM_WORDEND:
				if (ei.index >= ei.token.length && ei.token[ei.index + 1].type === SYM_WORDEND) {
					stack.push({name: '', v: {type: TYPE_INTEGER, num: 0}});
				}
				break;
			case SYM_JUMP:
				ei.index = token.link;
				break;
			case SYM_JZE:
			case SYM_JNZ:
				if (stack.length === 0) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				vi = stack.pop();
				cp = that.getValueBoolean(vi.v);
				if ((token.type === SYM_JZE && !cp) ||
					(token.type === SYM_JNZ && cp)) {
					stack.push({name: '', v: {type: TYPE_INTEGER, num: cp}});
					ei.index = token.link;
				} else {
					stack.push(vi);
				}
				break;
			case SYM_RETURN:
			case SYM_EXIT:
				if (token.type === SYM_EXIT) {
					ret = RET_EXIT;
				} else {
					ret = RET_RETURN;
				}
				break;
			case SYM_BREAK:
				ret = RET_BREAK;
				break;
			case SYM_CONTINUE:
				ret = RET_CONTINUE;
				break;
			case SYM_CASE:
			case SYM_DEFAULT:
				for (; ei.index < ei.token.length && ei.token[ei.index].type !== SYM_LABELEND; ei.index++);
				break;
			case SYM_CMP:
				if (stack.length === 0) {
					ei.index++;
					break;
				}
				vi = stack.pop();
				if (that.getValueBoolean(vi.v)) {
					ei.index++;
				}
				break;
			case SYM_CMPSTART:
			case SYM_ELSE:
			case SYM_CMPEND:
				break;
			case SYM_SWITCH:
				if (stack.length === 0) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				vi = stack.pop();
				ei.index++;
				const tmp_tk = findCase(ei, vi);
				if (tmp_tk < 0) {
					if (ei.err) {
						ret = RET_ERROR;
					}
					break;
				}
				cei = {parent: ei, vi: {}, token: ei.token[ei.index].target, index: tmp_tk, to_tk: -1, stack: [], inc_vi: [], dec_vi: []};
				ret = execSentense(cei);
				if (ret !== RET_SUCCESS && ret !== RET_BREAK) {
					ei.err = cei.err;
					break;
				}
				ret = RET_SUCCESS;
				break;
			case SYM_LOOP:
				if (stack.length > 0) {
					vi = stack.pop();
					if (!that.getValueBoolean(vi.v)) {
						break;
					}
				}
				const _tk = ei.token;
				const _tk_index = ei.index;
				ei.token = token.target;
				ei.index = 0;
				ret = execSentense(ei);
				ei.token = _tk;
				ei.index = _tk_index;
				if (ret !== RET_SUCCESS && ret !== RET_BREAK && ret !== RET_CONTINUE) {
					break;
				}
				if (ret === RET_BREAK) {
					for (; ei.index < ei.token.length && ei.token[ei.index].type !== SYM_LOOPEND; ei.index++);
					ret = RET_SUCCESS;
					break;
				}
				ei.index++;
				ret = RET_SUCCESS;
				break;
			case SYM_LOOPEND:
			case SYM_LOOPSTART:
				break;
			case SYM_ARGSTART:
				// TODO:
				break;
			case SYM_FUNC:
				// TODO:
				break;
			case SYM_DECLVARIABLE:
				vi = declVariable(ei, token.buf);
				if (!vi) {
					ret = RET_ERROR;
					break;
				}
				stack.push(vi);
				break;
			case SYM_VARIABLE:
				vi = getVariable(ei, token.buf);
				if (!vi) {
					if (options.strict_val) {
						ei.err = {msg: token.buf + errMsg.ERR_NOTDECLARE, line: ei.token[ei.index].line};
						ret = RET_ERROR;
						break;
					}
					vi = declVariable(ei, token.buf);
					if (!vi) {
						ret = RET_ERROR;
						break;
					}
				} else {
					vi = {name: token.buf, v: vi};
				}
				stack.push(vi);
				break;
			case SYM_ARRAY:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				vi = getArrayValue(ei, v2, v1.v);
				if (!vi) {
					ret = RET_ERROR;
					break;
				}
				stack.push(vi);
				break;
			case SYM_CONST_INT:
				stack.push({name: '', v: {type: TYPE_INTEGER, num: token.num}});
				break;
			case SYM_CONST_FLOAT:
				stack.push({name: '', v: {type: TYPE_FLOAT, num: token.num}});
				break;
			case SYM_CONST_STRING:
				stack.push({name: '', v: {type: TYPE_STRING, str: token.buf}});
				break;
			case SYM_NOT:
				if (stack.length === 0) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				vi = stack.pop();
				if (vi.v.type === TYPE_INTEGER || vi.v.type === TYPE_FLOAT) {
					vi = unaryCalcValue(ei, vi, token.type);
				} else if (vi.v.type === TYPE_STRING) {
					vi = unaryCalcString(ei, vi, token.type);
				} else {
					ei.err = {msg: errMsg.ERR_OPERATOR, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				stack.push(vi);
				break;
			case SYM_BITNOT:
			case SYM_PLUS:
			case SYM_MINS:
			case SYM_INC:
			case SYM_DEC:
			case SYM_BINC:
			case SYM_BDEC:
				if (stack.length === 0) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				vi = stack.pop();
				if (vi.v.type === TYPE_INTEGER || vi.v.type === TYPE_FLOAT) {
					vi = unaryCalcValue(ei, vi, token.type);
				} else {
					ei.err = {msg: errMsg.ERR_OPERATOR, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				stack.push(vi);
				break;
			case SYM_EQ:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				setValue(v2.v, v1.v);
				stack.push(v2);
				break;
			case SYM_COMP_EQ:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				stack.push(v2);
				stack.push(v2);
				stack.push(v1);
				break;
			case SYM_LABELEND:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				if (v2.v.type === TYPE_STRING && v2.v.str !== '') {
					v1.name = v2.v.str;
				}
				stack.push(v1);
				break;
			case SYM_CPAND:
			case SYM_CPOR:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				if (token.type === SYM_CPAND) {
					cp = that.getValueBoolean(v1.v) && that.getValueBoolean(v2.v);
				} else {
					cp = that.getValueBoolean(v1.v) || that.getValueBoolean(v2.v);
				}
				stack.push({name: '', v: {type: TYPE_INTEGER, num: (cp ? 1 : 0)}});
				break;
			default:
				if (stack.length < 2) {
					ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
					ret = RET_ERROR;
					break;
				}
				v1 = stack.pop();
				v2 = stack.pop();
				vi = calcValue(ei, v2, v1, token.type);
				if (!vi) {
					ret = RET_ERROR;
					break;
				}
				stack.push(vi);
				break;
			}
			if (ret !== RET_SUCCESS) {
				break;
			}
			ei.index++;
		}
		postfixValue(ei);
		ei.stack = stack;
		return ret;
	}

	this.exec = function(token, vi, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == 'function') ? callbacks.success : ScriptExec.noop;
		callbacks.error = (typeof callbacks.error == 'function') ? callbacks.error : ScriptExec.noop;

		const ei = {vi: vi, token: token, index: 0, to_tk: -1, stack: [], inc_vi: [], dec_vi: []};
		let ret = execSentense(ei);
		if (ret === RET_BREAK || ret === RET_CONTINUE) {
			ei.err = {msg: errMsg.ERR_SENTENCE, line: ei.token[ei.index].line};
			ret = RET_ERROR;
		}
		if (ret === RET_ERROR) {
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

