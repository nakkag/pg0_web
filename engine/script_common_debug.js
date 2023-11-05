"use strict";

const Script = {};
Script.noop = function() {};
Script.initScriptInfo = function(options) {
	return {name: '', ei: null, extension: (options.extension ? true : false), strict_val: (options.strict_val ? true : false)};
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
const SYM_NONE = 'SYM_NONE';
const SYM_EOF = 'SYM_EOF';
const SYM_COMMENT = 'SYM_COMMENT';
const SYM_PREP = 'SYM_PREP';
const SYM_LINEEND = 'SYM_LINEEND';
const SYM_LINESEP = 'SYM_LINESEP';
const SYM_WORDEND = 'SYM_WORDEND';

const SYM_BOPEN = 'SYM_BOPEN';
const SYM_BOPEN_PRIMARY = 'SYM_BOPEN_PRIMARY';
const SYM_BCLOSE = 'SYM_BCLOSE';

const SYM_OPEN = 'SYM_OPEN';
const SYM_CLOSE = 'SYM_CLOSE';

const SYM_ARRAYOPEN = 'SYM_ARRAYOPEN';
const SYM_ARRAYCLOSE = 'SYM_ARRAYCLOSE';

const SYM_EQ = 'SYM_EQ';

const SYM_CPAND = 'SYM_CPAND';
const SYM_CPOR = 'SYM_CPOR';

const SYM_LEFT = 'SYM_LEFT';
const SYM_LEFTEQ = 'SYM_LEFTEQ';

const SYM_RIGHT = 'SYM_RIGHT';
const SYM_RIGHTEQ = 'SYM_RIGHTEQ';

const SYM_EQEQ = 'SYM_EQEQ';
const SYM_NTEQ = 'SYM_NTEQ';

const SYM_ADD = 'SYM_ADD';
const SYM_SUB = 'SYM_SUB';

const SYM_MULTI = 'SYM_MULTI';
const SYM_DIV = 'SYM_DIV';
const SYM_MOD = 'SYM_MOD';

const SYM_NOT = 'SYM_NOT';
const SYM_PLUS = 'SYM_PLUS';
const SYM_MINS = 'SYM_MINS';

const SYM_CONST_INT = 'SYM_CONST_INT';
const SYM_DECLVARIABLE = 'SYM_DECLVARIABLE';
const SYM_VARIABLE = 'SYM_VARIABLE';
const SYM_ARRAY = 'SYM_ARRAY';

// Reserved word symbol
const SYM_VAR = 'SYM_VAR';
const SYM_IF = 'SYM_IF';
const SYM_ELSE = 'SYM_ELSE';
const SYM_WHILE = 'SYM_WHILE';
const SYM_EXIT = 'SYM_EXIT';

const SYM_JUMP = 'SYM_JUMP';
const SYM_JZE = 'SYM_JZE';
const SYM_JNZ = 'SYM_JNZ';

const SYM_CMP = 'SYM_CMP';
const SYM_CMPSTART = 'SYM_CMPSTART';
const SYM_CMPEND = 'SYM_CMPEND';
const SYM_LOOP = 'SYM_LOOP';
const SYM_LOOPSTART = 'SYM_LOOPSTART';
const SYM_LOOPEND = 'SYM_LOOPEND';

// Extension symbol
const SYM_LABELEND = 'SYM_LABELEND';
const SYM_AND = 'SYM_AND';
const SYM_OR = 'SYM_OR';
const SYM_XOR = 'SYM_XOR';
const SYM_LEFTSHIFT = 'SYM_LEFTSHIFT';
const SYM_RIGHTSHIFT = 'SYM_RIGHTSHIFT';
const SYM_LEFTSHIFT_LOGICAL = 'SYM_LEFTSHIFT_LOGICAL';
const SYM_RIGHTSHIFT_LOGICAL = 'SYM_RIGHTSHIFT_LOGICAL';
const SYM_BITNOT = 'SYM_BITNOT';

const SYM_COMP_EQ = 'SYM_COMP_EQ';

const SYM_INC = 'SYM_INC';
const SYM_DEC = 'SYM_DEC';
const SYM_BINC = 'SYM_BINC';
const SYM_BDEC = 'SYM_BDEC';

const SYM_CONST_FLOAT = 'SYM_CONST_FLOAT';
const SYM_CONST_STRING = 'SYM_CONST_STRING';

const SYM_FOR = 'SYM_FOR';
const SYM_DO = 'SYM_DO';
const SYM_BREAK = 'SYM_BREAK';
const SYM_CONTINUE = 'SYM_CONTINUE';
const SYM_SWITCH = 'SYM_SWITCH';
const SYM_CASE = 'SYM_CASE';
const SYM_DEFAULT = 'SYM_DEFAULT';
const SYM_DAMMY = 'SYM_DAMMY';

const SYM_FUNCSTART = 'SYM_FUNCSTART';
const SYM_FUNCEND = 'SYM_FUNCEND';
const SYM_FUNC = 'SYM_FUNC';
const SYM_ARGSTART = 'SYM_ARGSTART';
const SYM_RETURN = 'SYM_RETURN';
