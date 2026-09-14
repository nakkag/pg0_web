"use strict";
// Machine readable list of functions available to programs run through the agent API.
// Types: int = integer, float = real number, str = string, arr = array, num = int or float, any = any type.

module.exports = {
	notes: [
		'Function names are case-insensitive (isType, istype and ISTYPE are the same function).',
		'PG0 mode has integers only and no functions; everything below needs PG0.5 mode (the default).',
		'Library functions become available after the matching #import line is placed in the program.',
		'The screen library (lib/screen.pg0) needs a web browser and cannot be imported through the API.'
	],
	builtin: {
		import: null,
		description: 'Always available without #import',
		functions: [
			{name: 'print', signature: 'print(value: any) -> int', summary: 'Writes value to the output without a trailing newline. Arrays are written as {1, 2, "key": 3}.'},
			{name: 'error', signature: 'error(value: any) -> int', summary: 'Writes value to the error output (returned as error_output). Execution continues.'},
			{name: 'input', signature: 'input() -> str | int', summary: 'Reads the next line of the "input" request field. Returns integer 0 when no input line is left.'},
			{name: 'isType', signature: 'isType(value: any) -> int', summary: 'Type of value: 0 integer, 1 float, 2 string, 3 array.'},
			{name: 'length', signature: 'length(value: arr | str) -> int', summary: 'Number of elements of an array or characters of a string (numbers are converted to strings).'},
			{name: 'array', signature: 'array(text: str) -> arr', summary: 'Splits a string into an array with one character per element.'},
			{name: 'string', signature: 'string(list: arr) -> str', summary: 'Joins the elements of an array into one string.'},
			{name: 'number', signature: 'number(text: str) -> num', summary: 'Converts a string to an integer or float.'},
			{name: 'int', signature: 'int(text: str | num) -> int', summary: 'Converts to a 32-bit integer (truncates).'},
			{name: 'code', signature: 'code(text: str, index: int = 0) -> int', summary: 'Character code at index; 0 when index is out of range.'},
			{name: 'char', signature: 'char(code: int) -> str', summary: 'One character string for a character code.'},
			{name: 'getKey', signature: 'getKey(list: arr, n: int) -> str', summary: 'Key name of the n-th element of an associative array.'},
			{name: 'setKey', signature: 'setKey(list: arr, n: int, key: str) -> int', summary: 'Sets the key name of the n-th element of an array.'}
		]
	},
	libraries: [
		{
			id: 'math',
			import: '#import("lib/math.pg0")',
			available: true,
			functions: [
				{name: 'abs', signature: 'abs(n: num) -> num', summary: 'Absolute value.'},
				{name: 'atan', signature: 'atan(n: num) -> float', summary: 'Arc tangent in radians.'},
				{name: 'cos', signature: 'cos(n: num) -> float', summary: 'Cosine (radians).'},
				{name: 'exp', signature: 'exp(n: num) -> float', summary: 'e raised to n.'},
				{name: 'log', signature: 'log(n: num) -> float', summary: 'Natural logarithm. Runtime error for 0 or negative values.'},
				{name: 'random', signature: 'random() -> float', summary: 'Random number, 0 <= x < 1.'},
				{name: 'sign', signature: 'sign(n: num) -> int', summary: '1 for positive, -1 for negative, 0 for zero.'},
				{name: 'sin', signature: 'sin(n: num) -> float', summary: 'Sine (radians).'},
				{name: 'sqrt', signature: 'sqrt(n: num) -> float', summary: 'Square root. Runtime error for negative values.'},
				{name: 'tan', signature: 'tan(n: num) -> float', summary: 'Tangent (radians).'},
				{name: 'pow', signature: 'pow(base: num, exponent: num) -> num', summary: 'base raised to exponent.'}
			]
		},
		{
			id: 'string',
			import: '#import("lib/string.pg0")',
			available: true,
			functions: [
				{name: 'trim', signature: 'trim(text: str) -> str', summary: 'Removes leading and trailing spaces and tabs.'},
				{name: 'to_lower', signature: 'to_lower(text: str) -> str', summary: 'Lower case.'},
				{name: 'to_upper', signature: 'to_upper(text: str) -> str', summary: 'Upper case.'},
				{name: 'str_match', signature: 'str_match(pattern: str, text: str) -> int', summary: 'Wildcard match (* any characters, ? one character), case-insensitive. 1 on match.'},
				{name: 'substring', signature: 'substring(text: str, begin: int, length: int = -1) -> str', summary: 'Substring; negative begin counts from the end, negative length means to the end.'},
				{name: 'in_string', signature: 'in_string(text: str, search: str, from: int = 0) -> int', summary: 'Index of search in text, or -1.'},
				{name: 'split', signature: 'split(text: str, separator: str) -> arr', summary: 'Splits text at separator into an array of strings.'}
			]
		},
		{
			id: 'io',
			import: '#import("lib/io.pg0")',
			available: true,
			functions: [
				{name: 'println', signature: 'println(value: any) -> int', summary: 'Writes value followed by a newline.'},
				{name: 'saveValue', signature: 'saveValue(key: str, value: any) -> int', summary: 'Stores a value under key. In the API the store lives only for the current run.'},
				{name: 'loadValue', signature: 'loadValue(key: str) -> any', summary: 'Reads a stored value; integer 0 when the key does not exist.'},
				{name: 'removeValue', signature: 'removeValue(key: str) -> int', summary: 'Removes a stored value.'},
				{name: 'get_clipboard', signature: 'get_clipboard() -> str', summary: 'Returns the text set by set_clipboard during this run (empty string initially).'},
				{name: 'set_clipboard', signature: 'set_clipboard(text: str) -> int', summary: 'Stores text in the run-local clipboard. Returns 1.'}
			]
		},
		{
			id: 'screen',
			import: '#import("lib/screen.pg0")',
			available: false,
			reason: 'Needs a web browser (canvas, keyboard, mouse, sound). Importing it through the API fails with "Read error in script or library". Programs that use it can still be stored with POST /api/agent/v1/scripts (set "speed": 0, no wait, so drawing is not slowed down) and run in the web editor.',
			functions: [
				'startScreen', 'sleep', 'time', 'timeString', 'startOffscreen', 'endOffscreen', 'startMask', 'endMask', 'clearRect',
				'drawLine', 'drawRect', 'drawCircle', 'drawPolyline', 'drawFill', 'drawScroll', 'createImage', 'drawImage', 'drawText',
				'measureText', 'rgbToPoint', 'rgbToHex', 'hexToRgb', 'inTouch', 'inKey', 'playSound', 'playMusic', 'stopSound'
			].map(function(n) { return {name: n}; })
		}
	]
};
