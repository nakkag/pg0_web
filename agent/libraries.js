"use strict";
// Machine readable list of functions available to programs run through the agent API.
// Types: int = integer, float = real number, str = string, arr = array, num = int or float, any = any type.

module.exports = {
	notes: [
		'Function names are case-insensitive (isType, istype and ISTYPE are the same function).',
		'PG0 mode has integers only and no functions; everything below needs PG0.5 mode (the default).',
		'Library functions become available after the matching #import line is placed in the program.',
		'Stored scripts can be imported too: #import("https://pg0.jp/dev/?cid=<cid>") makes their functions available (their variables stay private to the part). See section 3.12 of the manual.',
		'The screen library (lib/screen.pg0) runs headless through the API: see its notes for the virtual clock, input timelines and frame limits.'
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
				{name: 'atan2', signature: 'atan2(y: num, x: num) -> float', summary: 'Angle of point (x, y) from the positive x axis in radians (-pi..pi); clockwise on screen.'},
				{name: 'floor', signature: 'floor(n: num) -> int', summary: 'Rounds down.'},
				{name: 'ceil', signature: 'ceil(n: num) -> int', summary: 'Rounds up.'},
				{name: 'round', signature: 'round(n: num) -> int', summary: 'Rounds to the nearest integer (round(-2.5) is -2).'},
				{name: 'hypot', signature: 'hypot(x: num, y: num) -> num', summary: 'sqrt(x*x + y*y).'},
				{name: 'cos', signature: 'cos(n: num) -> float', summary: 'Cosine (radians).'},
				{name: 'exp', signature: 'exp(n: num) -> float', summary: 'e raised to n.'},
				{name: 'log', signature: 'log(n: num) -> float', summary: 'Natural logarithm. Runtime error for 0 or negative values.'},
				{name: 'random', signature: 'random(seed: num | str = none) -> float', summary: 'Random number, 0 <= x < 1. With seed: restarts a reproducible sequence and returns its first value; later random() calls continue it. Never seeded: true random. The /run field "seed" seeds it before the program starts.'},
				{name: 'max', signature: 'max(a: num, b: num, ...) -> num', summary: 'Largest argument; an array argument contributes its elements.'},
				{name: 'min', signature: 'min(a: num, b: num, ...) -> num', summary: 'Smallest argument; an array argument contributes its elements.'},
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
			available: true,
			mode: 'headless',
			notes: [
				'Through the API the library runs headless: nothing is drawn, drawing calls are counted (and recorded when "screen": {"record": true} is sent), sleep() advances a virtual clock without waiting, time() returns the virtual clock, inTouch()/inKey() answer from the "screen".touch / "screen".keys timelines of the request.',
				'The run stops with status "frame_limit" after max_frames calls of sleep() (default 10000) or "virtual_time_limit" when the virtual clock reaches max_virtual_ms; variables are still returned.',
				'Coordinates: origin top-left, x to the right, y downwards, in screen pixels of startScreen(width, height). Touch coordinates are always in these units, also with "fit" scaling.',
				'Angles (drawCircle start/end/rotation, drawImage angle) are radians. Colors are CSS color strings, usually "#rrggbb".',
				'Store screen programs with "speed": 0 (no wait) so that the web editor does not pause after every statement.'
			],
			functions: [
				{name: 'startScreen', signature: 'startScreen(width: int, height: int, option: arr = {}) -> int', summary: 'Opens the screen. option: {"color": background color string, "fit": 1 (default) scales the screen to the browser window, 0 shows it at 1:1}.'},
				{name: 'sleep', signature: 'sleep(ms: num) -> int', summary: 'Waits ms milliseconds (browser). Headless: advances the virtual clock and counts one frame. Call it once per game-loop iteration.'},
				{name: 'time', signature: 'time() -> float', summary: 'Milliseconds since 1970-01-01 UTC (returned as float). Headless: virtual clock, advanced by 1 ms per call.'},
				{name: 'timeString', signature: 'timeString(ms: num, format: str = "") -> str', summary: 'Formats a time; format uses YYYY MM DD hh mm ss (or M D h m s without zero padding). Without format: locale date and time.'},
				{name: 'startOffscreen', signature: 'startOffscreen() -> int', summary: 'Following drawing goes to an offscreen buffer (double buffering).'},
				{name: 'endOffscreen', signature: 'endOffscreen() -> int', summary: 'Copies the offscreen buffer to the screen.'},
				{name: 'startMask', signature: 'startMask(option: arr = {}) -> int', summary: 'Starts mask mode: only drawn areas stay visible. {"destination": "out"} makes drawn areas transparent instead.'},
				{name: 'endMask', signature: 'endMask() -> int', summary: 'Ends mask mode.'},
				{name: 'clearRect', signature: 'clearRect(x: num, y: num, width: num, height: num) -> int', summary: 'Makes the rectangle transparent (shows the background color).'},
				{name: 'drawLine', signature: 'drawLine(x1: num, y1: num, x2: num, y2: num, option: arr = {}) -> int', summary: 'Line. option: {"width": 1, "color": "#000"}.'},
				{name: 'drawRect', signature: 'drawRect(x: num, y: num, width: num, height: num, option: arr = {}) -> int', summary: 'Rectangle with top-left (x, y). option: {"width": 1, "color": "#000", "fill": 0}. fill 1 fills with color, otherwise outlines.'},
				{name: 'drawCircle', signature: 'drawCircle(x: num, y: num, radiusX: num, option: arr = {}) -> int', summary: 'Circle/ellipse/arc with center (x, y). option: {"radius_y": radiusX, "rotation": 0, "start": 0, "end": 2*pi, "color": "#000", "width": 1, "fill": 0, "close": 0}. start/end/rotation in radians, clockwise from the positive x axis. close 1 joins the arc ends when outlining.'},
				{name: 'drawPolyline', signature: 'drawPolyline(points: arr, option: arr = {}) -> int', summary: 'Connected lines through {{x, y}, {x, y}, ...}. option: {"width": 1, "color": "#000", "fill": 0, "close": 0}.'},
				{name: 'drawFill', signature: 'drawFill(x: num, y: num, color: str) -> int', summary: 'Flood fill starting at (x, y). Headless: recorded only.'},
				{name: 'drawScroll', signature: 'drawScroll(dx: num, dy: num) -> int', summary: 'Scrolls the whole screen; pixels leaving one edge reappear at the opposite edge.'},
				{name: 'createImage', signature: 'createImage(x: num, y: num, width: num, height: num, option: arr = {}) -> int', summary: 'Copies a region of the current drawing target (the offscreen buffer between startOffscreen/endOffscreen, otherwise the visible screen) into an image and returns its id (0, 1, 2, ...). {"id": n} replaces image n and returns n. Images exist only during the current run; they are not carried over by globals/storage.'},
				{name: 'drawImage', signature: 'drawImage(id: int, x: num, y: num, option: arr = {}) -> int', summary: 'Draws image id with top-left (x, y). option: {"width", "height" (give both or neither), "angle": radians, rotates about the image center, "alpha": 0.0..1.0}. Unknown ids are ignored.'},
				{name: 'drawText', signature: 'drawText(text: str, x: num, y: num, option: arr = {}) -> int', summary: 'Text with (x, y) = top-left of the text box: the baseline is drawn at y + fontsize. option: {"color": "#000", "fontsize": 30, "fontface": "sans-serif", "fontstyle": "normal"|"bold"|"italic"|"oblique", "fill": 1, "width": 1}. fill 0 draws outlined text with line width "width". Numbers and arrays are converted to text.'},
				{name: 'measureText', signature: 'measureText(text: str, option: arr = {}) -> arr', summary: 'Returns {"width": w, "height": h} in pixels. option: {"fontsize": 30, "fontface", "fontstyle"}. Browser: ink bounding box (leading/trailing spaces not counted, space-only text is 0 x 0, height = glyph height); advance width = measureText("|" + s + "|").width - measureText("||").width. Headless: same space handling, 0.55 * fontsize per ASCII character (0.6 for monospace faces), 1 * fontsize otherwise, height = fontsize.'},
				{name: 'rgbToPoint', signature: 'rgbToPoint(x: num, y: num) -> arr', summary: 'Color of the pixel at (x, y) as {"r": 0..255, "g": 0..255, "b": 0..255}. Headless: always {0, 0, 0}.'},
				{name: 'rgbToHex', signature: 'rgbToHex(rgb: arr) -> str', summary: '{"r", "g", "b"} (or {r, g, b} positional) to "#rrggbb".'},
				{name: 'hexToRgb', signature: 'hexToRgb(hex: str) -> arr', summary: '"#rrggbb" or "#rgb" to {"r", "g", "b"}.'},
				{name: 'inTouch', signature: 'inTouch() -> arr', summary: 'Current pointer state {"x", "y", "touch": 0|1, "button": 0 left|1 middle|2 right, "pos": {{x, y}, ...}}. When touch is 0, x/y hold the last position. Headless: from the "screen".touch timeline (pos has one entry while touching).'},
				{name: 'inKey', signature: 'inKey(key: str | arr = none) -> arr | int', summary: 'No argument: array of held key names (KeyboardEvent.key values such as "ArrowLeft", "a", " ", "Enter"). String: 1 if that key is held (case-insensitive). Array: 1 only if all listed keys are held; names in the array must be written in lower case ("arrowleft"). Browser: the held list is cleared 1 second after the last keydown event; keys held down keep repeating keydown through the OS key repeat, so ordinary keys stay listed (modifier keys do not repeat and read as released after 1 s). Headless: from the "screen".keys timeline.'},
				{name: 'playSound', signature: 'playSound(note: num | str, start: num, duration: num, volume: num = 1) -> int', summary: 'Square wave tone. note: frequency in Hz or a name like "C4", "F#5". start: delay in ms before the tone, duration: length in ms. Headless: recorded only.'},
				{name: 'playMusic', signature: 'playMusic(notes: arr, option: arr = {}) -> int', summary: 'Plays {{note, length_ms, volume?}, ...} in sequence. {"start": ms} resets the position (for chords), {"volume": v} sets the volume for following notes. option: {"repeat": 1}. Does not stop sounds already playing (they overlap). Headless: recorded only.'},
				{name: 'bgm', signature: 'bgm(notes: arr = none, option: arr = {"repeat": 1}) -> int', summary: 'Background music track: stops the previous bgm only, then loops notes ({"repeat": 0} plays once). bgm() stops the music. Sound effects keep playing. Browsers block audio until the first tap/key on the page. Headless: recorded only.'},
				{name: 'stopSound', signature: 'stopSound() -> int', summary: 'Stops all sounds, bgm included.'}
			]
		}
	]
};
