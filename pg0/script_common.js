"use strict";

const Script = {};
Script.noop = function() {};
Script.initScriptInfo = function(src, options) {
	return {
		name: '',
		src: src,
		ei: null,
		extension: options.extension || false,
		strict_val: options.strict_val || false
	};
};
Script.error = function(sci, msg, line) {
	let src = '';
	try {
		src = sci.src.split(/\r\n|\r|\n/)[line];
	} catch(e) {
	}
	return {msg: msg, line: line, src: src};
};

// Error message
let errMsg = {
	ERR_SENTENCE: 'Syntax error',
	ERR_SENTENCE_PREV: 'Operators are required',
	ERR_NOTDECLARE: ' :Undefined variable',
	ERR_DECLARE: ' :Duplicate variable declaration',
	ERR_INDEX: 'Array index is negative value',
	ERR_PARENTHESES: 'Unbalanced parentheses',
	ERR_BLOCK: 'Block{...} expected',
	ERR_DIVZERO: 'Division by zero',
	ERR_OPERATOR: 'Illegal operator',
	ERR_ARRAYOPERATOR: 'Illegal operator to array',
	ERR_ALLOC: 'Alloc failed',
	ERR_ARGUMENTCNT: 'Too few arguments',
	ERR_FILEOPEN: 'File open error',
	ERR_SCRIPT: 'Read error in script or library',
	ERR_FUNCTION: 'Function not Found',
	ERR_FUNCTION_EXEC: 'Function error'
};

let _lang = 'en';
if (navigator.browserLanguage) {
    _lang = navigator.browserLanguage;
} else if (navigator.language) {
    _lang = navigator.language;
}
if (_lang.length > 2) {
	_lang = _lang.substr(0, 2);
}
if (_lang === 'ja') {
	errMsg = {
		ERR_SENTENCE: '構文エラー',
		ERR_SENTENCE_PREV: '演算子が必要です',
		ERR_NOTDECLARE: ' :変数が定義されていませんe',
		ERR_DECLARE: ' :変数の宣言が重複しています',
		ERR_INDEX: '配列のインデックスが負の値になっています',
		ERR_PARENTHESES: '対応する括弧がありません',
		ERR_BLOCK: 'ブロック「{～}」がありません',
		ERR_DIVZERO: '0 で除算をしました',
		ERR_OPERATOR: '不正な演算子です',
		ERR_ARRAYOPERATOR: '配列に使えない演算子です',
		ERR_ALLOC: 'メモリの確保に失敗しました',
		ERR_ARGUMENTCNT: '引数が少なすぎます',
		ERR_FILEOPEN: 'ファイルオープンに失敗しました',
		ERR_SCRIPT: 'スクリプトまたはライブラリの読み込みに失敗しました',
		ERR_FUNCTION: '関数が見つかりません',
		ERR_FUNCTION_EXEC: '関数実行中にエラーが発生しました'
	};
}

// Return value
const RET_RETURN = -3;
const RET_EXIT = -2;
const RET_ERROR = -1;
const RET_SUCCESS = 0;
const RET_BREAK = 1;
const RET_CONTINUE = 2;

// Variable type
const TYPE_INTEGER = 0;
const TYPE_FLOAT = 1;
const TYPE_STRING = 2;
const TYPE_ARRAY = 3;

// Symbol
const SYM_NONE = 0;
const SYM_EOF = 1;
const SYM_COMMENT = 2;
const SYM_PREP = 3;
const SYM_LINEEND = 4;
const SYM_LINESEP = 5;
const SYM_WORDEND = 6;

const SYM_BOPEN = 7;
const SYM_BOPEN_PRIMARY = 8;
const SYM_BCLOSE = 9;

const SYM_OPEN = 10;
const SYM_CLOSE = 11;

const SYM_ARRAYOPEN = 12;
const SYM_ARRAYCLOSE = 13;

const SYM_EQ = 14;

const SYM_CPAND = 15;
const SYM_CPOR = 16;

const SYM_LEFT = 17;
const SYM_LEFTEQ = 18;

const SYM_RIGHT = 19;
const SYM_RIGHTEQ = 20;

const SYM_EQEQ = 21;
const SYM_NTEQ = 22;

const SYM_ADD = 23;
const SYM_SUB = 24;

const SYM_MULTI = 25;
const SYM_DIV = 26;
const SYM_MOD = 27;

const SYM_NOT = 28;
const SYM_PLUS = 29;
const SYM_MINS = 30;

const SYM_CONST_INT = 31;
const SYM_DECLVARIABLE = 32;
const SYM_VARIABLE = 33;
const SYM_ARRAY = 34;

// Reserved word symbol
const SYM_VAR = 35;
const SYM_IF = 36;
const SYM_ELSE = 37;
const SYM_WHILE = 38;
const SYM_EXIT = 39;

const SYM_JUMP = 40;
const SYM_JZE = 41;
const SYM_JNZ = 42;

const SYM_CMP = 43;
const SYM_CMPSTART = 44;
const SYM_CMPEND = 45;
const SYM_LOOP = 46;
const SYM_LOOPSTART = 47;
const SYM_LOOPEND = 48;

// Extension symbol
const SYM_LABELEND = 49;
const SYM_AND = 50;
const SYM_OR = 51;
const SYM_XOR = 52;
const SYM_LEFTSHIFT = 53;
const SYM_RIGHTSHIFT = 54;
const SYM_LEFTSHIFT_LOGICAL = 55;
const SYM_RIGHTSHIFT_LOGICAL = 56;
const SYM_BITNOT = 57;

const SYM_COMP_EQ = 58;

const SYM_INC = 59;
const SYM_DEC = 60;
const SYM_BINC = 61;
const SYM_BDEC = 62;

const SYM_CONST_FLOAT = 63;
const SYM_CONST_STRING = 64;

const SYM_FOR = 65;
const SYM_DO = 66;
const SYM_BREAK = 67;
const SYM_CONTINUE = 68;
const SYM_SWITCH = 69;
const SYM_CASE = 70;
const SYM_DEFAULT = 71;
const SYM_DAMMY = 72;

const SYM_FUNCSTART = 73;
const SYM_FUNCEND = 74;
const SYM_FUNC = 75;
const SYM_ARGSTART = 76;
const SYM_RETURN = 77;
