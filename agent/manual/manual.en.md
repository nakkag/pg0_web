# PG0 Agent API Manual

This manual is written for AI agents (and people) that want to write, check, run and store programs in **PG0** and **PG0.5** through the HTTP API of the PG0 web service. It is self-contained: it covers the API, the full language specification and the library reference. The Japanese version is at `GET /agent/v1/manual?lang=ja`.

- API index (JSON): `GET /agent/v1`
- OpenAPI 3 document: `GET /agent/v1/openapi.json`
- Machine readable function list: `GET /agent/v1/libraries`
- Original HTML documentation: `/doc/pg0_eng.html`, `/doc/pg0.5_eng.html`, `/doc/pg0.5_lib_eng.html`

## 1. Quick start

1. Write a program. Use **PG0.5** (the default) unless a task explicitly asks for PG0.
2. `POST /agent/v1/run` with `{"code": "..."}`.
3. Read `status`, `output`, `result`, `variables` and `error` in the response. Fix the program and run again.
4. Optionally store the program with `POST /agent/v1/scripts`; the response contains a URL that opens it in the web editor.

```http
POST /agent/v1/run
Content-Type: application/json

{"code": "#import(\"lib/io.pg0\")\nfunction fact(n) {\n  if (n <= 1) { return 1 }\n  return n * fact(n - 1)\n}\nprintln(fact(5))\nexit fact(6)"}
```

```json
{
  "status": "ok",
  "mode": "PG0.5",
  "output": "120\n",
  "output_truncated": false,
  "error_output": "",
  "result": 720,
  "result_type": "integer",
  "error": null,
  "variables": {},
  "stats": {"steps": 42, "elapsed_ms": 4, "input_lines_used": 0}
}
```

## 2. API reference

### 2.1 General

- Base path: `/agent/v1` on the same host as the web editor.
- Request and response bodies are JSON (`Content-Type: application/json`, UTF-8). Request bodies are limited to 1 MB.
- Authentication: none by default. If the server operator configured an API key, send `Authorization: Bearer <key>` (or `X-API-Key: <key>`); otherwise the API answers `401`.
- Errors of the API itself (not of your program) use HTTP status codes 4xx/5xx and the body `{"error": {"code": "...", "message": "..."}}`. Program failures are reported with HTTP `200` and `status` other than `"ok"` (see 2.3).
- Limits are listed in `GET /agent/v1`; typical values: 5 s default timeout (30 s max), 10,000,000 statements, 200,000 characters of code, 1,000,000 characters of output, 4 concurrent runs (`429 too_many_runs` beyond that, retry after a second).

### 2.2 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/agent/v1` | Index: endpoints, manual URLs, limits |
| GET | `/agent/v1/manual?lang=en\|ja` | This manual (Markdown) |
| GET | `/agent/v1/openapi.json` | OpenAPI 3 description |
| GET | `/agent/v1/libraries` | Function list as JSON |
| POST | `/agent/v1/check` | Syntax check only |
| POST | `/agent/v1/run` | Run a program |
| GET | `/agent/v1/scripts` | List / search stored scripts |
| POST | `/agent/v1/scripts` | Store a new script |
| GET | `/agent/v1/scripts/{cid}` | Get a stored script with its code |
| PUT | `/agent/v1/scripts/{cid}` | Update a stored script |
| DELETE | `/agent/v1/scripts/{cid}` | Delete a stored script |
| POST | `/agent/v1/scripts/{cid}/run` | Run a stored script |
| GET | `/agent/v1/scripts/{cid}/history` | Previous versions of a stored script |
| GET | `/agent/v1/scripts/{cid}/history/{time}` | One previous version |

#### POST /agent/v1/check

Parses the program without executing it.

Request: `{"code": string, "mode": "PG0.5" | "PG0" (default PG0.5), "lang": "en" | "ja" (default en)}`

Response: `{"ok": true, "mode": "PG0.5", "error": null}` or `{"ok": false, "mode": "PG0.5", "error": {"message": "Syntax error", "line": 3, "source": "if a > 1 {", "phase": "parse"}}`

#### POST /agent/v1/run

Request fields:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `code` | string | required | Program source. Separate lines with `\n`. |
| `input` | string or array of strings | none | Lines returned by `input()`, one per call. A string is split at newlines. |
| `mode` | `"PG0.5"` or `"PG0"` | `"PG0.5"` | Language mode (see 3.1). |
| `lang` | `"en"` or `"ja"` | `"en"` | Language of error messages. |
| `timeout_ms` | integer | 5000 | Time limit; capped by the server (30000). |
| `max_steps` | integer | 10000000 | Maximum executed statements; capped by the server. |
| `variables` | boolean | true | Include final global variables in the response. |

Response fields are described in 2.3.

#### Stored scripts

Stored scripts are the same documents the web editor uses, so an agent can hand a program to a human (the response `url` opens it in the editor) and a human can edit it there with the same password.

`POST /agent/v1/scripts` request:

| Field | Type | Notes |
|---|---|---|
| `name` | string, required, max 100 | Must be unique among public scripts (`409 name_conflict` otherwise). |
| `code` | string, required | Program source. |
| `password` | string, required | Needed for update/delete. Compared case-insensitively after trimming, exactly as in the editor. |
| `author` | string, max 100 | Default `"AI agent"`. |
| `memo` | string | Description shown in the editor. |
| `private` | 0 or 1 | 1 hides the script from lists (still reachable by `cid`, and the name need not be unique). |
| `mode` | `"PG0.5"` or `"PG0"` | Mode used by the editor and by `/scripts/{cid}/run`. |
| `uuid` | string | Optional owner id; `GET /scripts?uuid=` lists these first, private ones included. |

Response `201`: `{"cid", "name", "author", "mode", "private", "createTime", "updateTime", "url", "memo", "code"}`. Times are milliseconds since 1970-01-01 UTC.

`PUT /agent/v1/scripts/{cid}`: body `{"password": "...", ...any of name, code, author, memo, private, mode, uuid}`; only given fields change. The previous version is kept in the history. `401 wrong_password`, `404 not_found`, `409 name_conflict`.

`DELETE /agent/v1/scripts/{cid}`: body `{"password": "..."}`. Response `{"deleted": true, "cid": "..."}`.

`GET /agent/v1/scripts?q=words&uuid=owner&skip=0&count=30`: `{"scripts": [summary...], "skip", "count"}`. `q` words are matched against name and author.

`POST /agent/v1/scripts/{cid}/run`: same body as `/run` without `code`; `mode` defaults to the stored mode.

`GET /agent/v1/scripts/{cid}/history`: `{"history": [summary with memo...]}`, newest first. `GET /agent/v1/scripts/{cid}/history/{updateTime}` returns that version with its code.

### 2.3 Run result

| Field | Meaning |
|---|---|
| `status` | `"ok"`: finished. `"error"`: parse or runtime error (see `error`). `"timeout"`: time limit reached. `"step_limit"`: statement limit reached. `"memory_limit"`: memory limit reached. Output produced before a limit is still returned. |
| `mode` | Mode actually used. |
| `output` | Everything written by `print()` / `println()`, in order. `print` adds no newline. |
| `output_truncated` | `true` when the output limit cut the text. |
| `error_output` | Text written by `error()`, one line per call. `error()` does not stop the program. |
| `result` | Value of `exit value` (or a top-level `return value`), converted to JSON; `null` if the program ended without one. |
| `result_type` | `"integer"`, `"float"`, `"string"`, `"array"` or `null`. |
| `error` | `null` or `{"message", "line", "source", "phase"}`. `line` is 1-based and refers to `code`; `phase` is `"parse"` or `"runtime"`. |
| `variables` | Final values of the global variables (`{"name": value}`), converted to JSON. Variables local to blocks and functions are not included. This is the only way to observe values in PG0 mode, which has no `print`. |
| `stats` | `steps` (statements executed), `elapsed_ms`, `input_lines_used`. |

Value conversion to JSON: integers and floats become numbers, strings become strings. An array whose elements all have no key becomes a JSON array; an array with at least one keyed element becomes a JSON object, unkeyed elements using their index as the key (for example `{"x": 1, 7}` becomes `{"x": 1, "1": 7}`).

## 3. Language specification

PG0 is a tiny language made for learning programming. Its syntax looks like C/JavaScript, but it is much smaller and stricter. Read the pitfalls in 3.11 before writing code.

### 3.1 Modes: PG0 and PG0.5

| | PG0 | PG0.5 (default) |
|---|---|---|
| Types | 32-bit integer only | integer, float, string, array |
| Statements | assignment, `if`/`else`, `while`, `exit` | plus `else if`, `for`, `do..while`, `switch`, `break`, `continue`, `return` |
| Functions | none (not even `print`/`input`) | user functions, built-in functions, libraries via `#import` |
| Operators | `+ - * / %`, `+a -a !a`, comparisons, `&& \|\|`, `=` | plus `++ --`, bit operators, compound assignment (`+=` ...) |
| Integer division | `7 / 2` is `3` | `7 / 2` is `3.5` (float) |
| Output | none: read `variables` / `result` from the run response | `print`, `println`, `error`, `exit value` |

A program written for PG0 mode runs unchanged in PG0.5 mode except that `/` may produce a float. `#option("pg0.5")` or `#import(...)` inside the code switches the program to PG0.5 regardless of the `mode` field.

### 3.2 Program structure

- One statement per line, or several on one line separated by `;`.
- Comments: `//` to the end of the line. There is no block comment.
- Blocks are `{ ... }`. The bodies of `if`, `else`, `while`, `for`, `do`, `switch` and `function` **must** be blocks; a single statement without braces is a syntax error.
- A statement continues on the next line only if the line ends with an operator:

```
a = 1 +
    2        // a = 3
```

- Keywords (`if`, `else`, `while`, `for`, `do`, `switch`, `case`, `default`, `break`, `continue`, `return`, `function`, `var`, `exit`) are lower case only.
- Statements are executed top to bottom; functions may be defined before or after their use.

### 3.3 Types and literals

**Integer**: 32-bit signed (-2,147,483,648 to 2,147,483,647). Arithmetic wraps around (`2147483647 + 1` is `-2147483648`); literals outside the range are clamped. Literals: `1234`, `-123`, `0123` (octal, PG0.5), `0x12` (hex, PG0.5). Exponent notation (`1e3`) is not supported.

**Float** (PG0.5): 64-bit double. Literals: `0.5`, `.5`, `2.0`. A float result that has no fractional part is converted back to integer (`2.5 - 0.5` is the integer `2`, `6 / 3` is `2`). Floats are printed with 16 digits after the decimal point: `print(7 / 2)` gives `3.5000000000000000`. Use `int(x)` or arithmetic to produce integer output when formatting matters.

**String** (PG0.5): `"text"` or `'text'`, internally UTF-16. Escapes: `\n \r \t \b \\ \" \' \ooo` (octal) `\xhh` (hex). Strings support only `+` (concatenation), `==` and `!=`. `-`, `*`, `<`, `>` on strings are runtime errors ("Illegal operator"). Mixing a number with a string in `+` converts the number to a string: `"abc" + 1` is `"abc1"`, `1 + 2 + "abc"` is `"3abc"`, `"" + 1 + 2` is `"12"`.

**Array** (PG0.5; in PG0 arrays of integers): see 3.5.

**Truthiness**: `0`, `0.0` and `""` are false; everything else is true. Comparisons and logical operators return `1` or `0`.

**Type inspection**: `isType(v)` returns 0 integer, 1 float, 2 string, 3 array.

### 3.4 Variables

- Variables are created automatically when first used and start as integer `0`. Reading an unknown variable therefore gives `0`, not an error.
- `var a, b = 5` declares explicitly (several names separated by `,`). Declaring the same name twice in the same block is an error. `#option("strict")` makes `var` mandatory (using an undeclared name is an error).
- **Scope is the block where the variable is created.** A variable first used (or declared with `var`) inside a block (`{}`), including `if`, loop and function bodies, exists only in that block and is discarded when the block ends. Assigning to a name that already exists in an enclosing block modifies that variable. Therefore initialize every variable you need after a block at the top level first:

```
total = 0                          // create at top level
for (i = 1; i <= 3; i++) { total += i }
print(total)                       // 6
for (i = 1; i <= 3; i++) { other += i }
print(other)                       // 0: "other" inside the loop was a different, block-local variable
```

  The loop variable of `for (i = 0; ...)` is created outside the block and stays available.
- Functions can read and assign global variables (variables of the top level).
- Names: letters, digits, `_` and non-ASCII (full-width) characters; may not start with a digit. In this implementation variable names are **case-sensitive** (`A` and `a` are different variables); function names are case-insensitive.
- A variable holds one value of any type; assigning changes its type (`a = 1` then `a = "x"` is fine).

### 3.5 Arrays

An array is an ordered list whose elements may also carry a string key, so it works as a vector, an associative array, or both.

```
a[0] = 10            // index access, index starts at 0
a[5] = 1             // the array grows automatically; a[1]..a[4] become 0
b["name"] = "pg0"    // key access (keys are case-insensitive: b["NAME"] is the same element)
m[1][0] = 3          // multi-dimensional
a[] = {1, 2, 3}      // initialize (equivalent to a[0] = 1; a[1] = 2; a[2] = 3)
c[] = {"x": 1, "y": 2, 7}   // keyed and unkeyed elements can be mixed
n[] = {1, {2, 3}, {"k": "v"}}  // nested
d = {"A", "B", "C"}[1]      // "B": any value can be indexed
```

- `a[]` (empty brackets) denotes the whole array: `a[] = b[]` copies (arrays are copied on assignment, not shared), `a[] = b[] + c[]` concatenates. `a = b[]` and `a[] = b[]` are equivalent; assigning a non-array to `a[]` makes `a` that scalar.
- Arrays compare only with `==` and `!=` (element-wise).
- `length(a)` is the number of elements; iterate with `for (i = 0; i < length(a); i++)`. Keyed elements are also reachable by index, and `getKey(a, i)` returns the key of element `i` (`""` for unkeyed elements). `setKey(a, i, "name")` sets it.
- A missing index or key is created on read (with value `0`), so reading `a[100]` grows the array to 101 elements.
- The key in an initializer may be an expression: `{name: 1}` uses the value of variable `name` as the key.
- A bare variable inside an initializer is stored **with the variable name as its key**: after `x = 1; y = 2`, `a[] = {x, y}` gives `{"x": 1, "y": 2}`. Use an expression to store the value without a key: `{x + 0, "" + s}`, or assign by index (`a[0] = x`).
- Strings are not arrays: `s[1]` on a string turns `s` into an array of zeros. Use `array(s)` (characters as elements), `code(s, i)`, or the string library.

### 3.6 Operators

Precedence, high to low (PG0.5; PG0 has the subset):

| Level | Operators |
|---|---|
| 1 | `()` `[]` function call |
| 2 | `!` `~` `+a` `-a` `++` `--` (unary) |
| 3 | `*` `/` `%` |
| 4 | `+` `-` |
| 5 | `<<` `>>` `<<<` `>>>` |
| 6 | `<` `>` `<=` `>=` |
| 7 | `==` `!=` |
| 8 | `&` |
| 9 | `^` |
| 10 | `\|` |
| 11 | `&&` |
| 12 | `\|\|` |
| 13 | `:` (key in array initializer) |
| 14 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` `<<<=` `>>>=` |
| 15 | `,` |

- Arithmetic: `+ - * / %`. `%` of floats keeps the fraction (`5.5 % 2` is `1.5`). Division by zero is a runtime error.
- Unary: `+a`, `-a`, `!a` (1 if `a` is false, else 0), `~a` bitwise not, `++a`/`--a` (prefix), `a++`/`a--` (postfix; applied when the statement finishes: after `b = a++`, `b` is the old value and `a` is incremented).
- Bitwise (32-bit): `& | ^`, `<<` `>>` (arithmetic), `<<<` `>>>` (logical).
- Comparison: `== != < > <= >=` return `1`/`0`. Comparing a string with a number converts the number to a string (`"10" == 10` is `1`, `"" == 0` is `0`).
- Logical: `&&`, `||` (short-circuit) return `1`/`0`.
- Assignment `=` and compound assignment are statements-level operators; using `=` inside the condition of `if`, `while`, `for` (second expression) is a syntax error.

### 3.7 Control flow

```
if (a > b) {
  max = a
} else if (a == b) {   // else if: PG0.5 only
  max = 0
} else {
  max = b
}

while (i < 10) {
  i = i + 1
}

do {                   // PG0.5
  i++
} while (i < 10)

for (i = 0; i < 10; i++) {   // PG0.5; each of the three parts may be empty; for (;;) loops forever
  sum += i
}

switch (x) {           // PG0.5; values may be numbers or strings
case 1:
case 2:
  print("one or two")
  break                // without break execution falls through to the next case
case "a":
  print("a")
  break
default:
  print("other")
}
```

`break` leaves the innermost loop or switch; `continue` jumps to the next iteration (for `for`, the third expression runs first). Both are PG0.5.

### 3.8 Functions (PG0.5)

```
function add(a, b = 10) {   // b is optional with default 10
  return a + b
}
function fill(&arr, n) {    // & passes by reference; without & arguments (arrays included) are copied
  for (i = 0; i < n; i++) { arr[i] = i }
}
print(add(1))       // 11
fill(list, 3)       // list is {0, 1, 2}
```

- Definitions are only allowed at the top level (not inside blocks), before or after the call.
- Names: same rules as variables, case-insensitive.
- Missing required arguments are a runtime error ("Too few arguments"); extra arguments are ignored.
- A function without `return` returns `0`. Recursion is allowed (deep recursion of several thousand levels works; extremely deep recursion fails).
- Parameters and `var` variables inside the function are local; other names resolve to globals.
- User functions with the same name as a built-in take precedence.

### 3.9 exit and return

- `exit` stops the program immediately; `exit value` also sets `result` in the run response. `exit` works inside functions too.
- `return value` at the top level ends the program and also sets `result`.
- When the program simply runs off the end, `result` is `null`.

### 3.10 Preprocessor

Lines starting with `#` are processed before execution and may appear anywhere.

- `#option("pg0.5")`: run as PG0.5 from this line on.
- `#option("strict")`: every variable must be declared with `var`.
- `#import("lib/math.pg0")`: load a library (see 4). Importing switches the program to PG0.5. In the API only `lib/math.pg0`, `lib/string.pg0` and `lib/io.pg0` can be imported; anything else (including `lib/screen.pg0` and URLs) fails with "Read error in script or library".

### 3.11 Pitfalls checklist

1. Braces are mandatory after `if`, `else`, `while`, `for`, `do`, `switch`, `function`.
2. `print` adds no newline. Use `print("...\n")` or `#import("lib/io.pg0")` and `println`.
3. `print`, `input` and all other functions do not exist in PG0 mode. In PG0 mode return information through `exit value` or by leaving it in global variables (`variables` in the response).
4. Floats print with 16 decimals (`3.5000000000000000`). Integer-valued results print as integers.
5. Integers are 32-bit and wrap silently.
6. Strings only support `+`, `==`, `!=`. Ordering comparisons on strings are runtime errors.
7. Variable names are case-sensitive; keywords must be lower case; function names are case-insensitive.
8. `=` inside a condition is a syntax error; use `==`.
9. Unknown variables silently read as `0`; typos do not raise errors (use `#option("strict")` while debugging).
10. `s[i]` on a string destroys the string; use `array(s)`, `code(s, i)` or `substring`.
11. Reading `a[i]` creates the element; arrays grow on read.
12. Arrays are copied on assignment and when passed to functions; use `&param` to modify the caller's array.
13. Several statements on one line need `;` between them.
14. `input()` returns integer `0` (not `""`) when no input line is left; test with `isType(x) == 0`.
15. No exponent literals, no block comments, no `else` without braces, no ternary operator, no string indexing.
16. A variable first assigned inside `{}` is local to that block and vanishes afterwards. Create accumulators, result arrays and flags at the top level (`total = 0`) before the loop or `if` that fills them.
17. `{x, y}` with bare variables creates keyed elements `"x"` and `"y"`; write `{x + 0, y + 0}` for a plain list.

## 4. Built-in functions and libraries

Function names are case-insensitive. Types: int, float, num (int or float), str, arr, any.

### 4.1 Always available (PG0.5)

| Function | Returns | Description |
|---|---|---|
| `print(v: any)` | 0 | Appends `v` to `output`, no newline. Arrays print as `{1, 2, "key": 3}`. |
| `error(v: any)` | 0 | Appends `v` and a newline to `error_output`. Execution continues. |
| `input()` | str or 0 | Next line of the request's `input`; integer `0` when exhausted. |
| `isType(v: any)` | int | 0 integer, 1 float, 2 string, 3 array. |
| `length(v: arr\|str)` | int | Element count or character count (numbers are converted to strings). |
| `array(s: str)` | arr | Characters of `s` as elements. |
| `string(a: arr)` | str | Elements joined into one string (no separator). |
| `number(s: str)` | num | Parses a decimal integer or float from the start of `s` (`"12abc"` gives 12, `"abc"` gives 0). |
| `int(v: str\|num)` | int | Converts to a 32-bit integer, truncating toward zero. |
| `code(s: str, i: int = 0)` | int | Character code at `i`; 0 if out of range. |
| `char(c: int)` | str | One-character string for code `c`. |
| `getKey(a: arr, i: int)` | str | Key of element `i` (`""` if none). |
| `setKey(a: arr, i: int, key: str)` | 0 | Sets the key of element `i`. |

### 4.2 Math library: `#import("lib/math.pg0")`

| Function | Description |
|---|---|
| `abs(n)` | Absolute value (keeps int/float). |
| `atan(n)` | Arc tangent, radians. |
| `cos(n)`, `sin(n)`, `tan(n)` | Trigonometry, radians. |
| `exp(n)` | e to the power `n`. |
| `log(n)` | Natural logarithm; error for `n <= 0`. |
| `sqrt(n)` | Square root; error for negative `n`. |
| `pow(base, exponent)` | Power. |
| `random()` | Float in [0, 1). |
| `sign(n)` | 1, -1 or 0. |

Results with no fractional part are returned as integers (`sqrt(16)` is `4`).

### 4.3 String library: `#import("lib/string.pg0")`

| Function | Description |
|---|---|
| `trim(s)` | Removes spaces and tabs at both ends. |
| `to_lower(s)`, `to_upper(s)` | Case conversion. |
| `str_match(pattern, s)` | Wildcard match, `*` any run of characters, `?` one character, case-insensitive; returns 1/0. |
| `substring(s, begin, length = -1)` | Substring; negative `begin` counts from the end; negative `length` means to the end. |
| `in_string(s, search, from = 0)` | Index of `search` in `s` or -1. |
| `split(s, separator)` | Array of strings. |

### 4.4 I/O library: `#import("lib/io.pg0")`

| Function | Description |
|---|---|
| `println(v)` | Like `print` followed by a newline. |
| `saveValue(key, v)`, `loadValue(key)`, `removeValue(key)` | Key/value store. In the API it exists only during the current run (in the browser it persists). `loadValue` of a missing key returns `0`. |
| `get_clipboard()`, `set_clipboard(s)` | Run-local clipboard string (empty at start). `set_clipboard` returns 1. |

### 4.5 Screen library: `#import("lib/screen.pg0")` (not available in the API)

Graphics, keyboard, mouse, sound, `sleep`, `time` and `timeString` need a web browser. Importing it through the API fails. Programs that use it can still be stored with `POST /agent/v1/scripts` and run by a person in the web editor at the returned `url`. Function names for reference: startScreen, sleep, time, timeString, startOffscreen, endOffscreen, startMask, endMask, clearRect, drawLine, drawRect, drawCircle, drawPolyline, drawFill, drawScroll, createImage, drawImage, drawText, measureText, rgbToPoint, rgbToHex, hexToRgb, inTouch, inKey, playSound, playMusic, stopSound (see `/doc/pg0.5_lib_eng.html`).

## 5. Examples

### 5.1 Reading input, associative array, sorting

Request:

```json
{
  "code": "#import(\"lib/io.pg0\")\n#import(\"lib/string.pg0\")\nscore = 0\nn = number(input())\nfor (i = 0; i < n; i++) {\n  parts = split(input(), \" \")\n  score[parts[0]] = number(parts[1])\n}\n// selection sort by value, descending\nfor (i = 0; i < length(score); i++) {\n  best = i\n  for (j = i + 1; j < length(score); j++) {\n    if (score[j] > score[best]) { best = j }\n  }\n  if (best != i) {\n    tmpv = score[i]; tmpk = getKey(score, i)\n    score[i] = score[best]; setKey(score, i, getKey(score, best))\n    score[best] = tmpv; setKey(score, best, tmpk)\n  }\n}\nfor (i = 0; i < length(score); i++) {\n  println(getKey(score, i) + \": \" + score[i])\n}\nexit score",
  "input": ["3", "ann 70", "bob 95", "cy 80"]
}
```

Response (abbreviated): `"output": "bob: 95\ncy: 80\nann: 70\n"`, `"result": {"bob": 95, "cy": 80, "ann": 70}`. Note the `score = 0` line: without it `score` would be created inside the loop block and be gone after it.

### 5.2 PG0 mode (integers only, no functions)

```json
{"code": "sum = 0\ni = 1\nwhile (i <= 10) {\n  sum = sum + i\n  i = i + 1\n}\nexit sum", "mode": "PG0"}
```

Response: `"status": "ok"`, `"result": 55`, `"variables": {"sum": 55, "i": 11}`.

### 5.3 Runtime error

```json
{"code": "a = 10\nb = 0\nc = a / b"}
```

Response: `"status": "error"`, `"error": {"message": "Division by zero", "line": 3, "source": "c = a / b", "phase": "runtime"}`, `"variables": {"a": 10, "b": 0, "c": 0}`.

### 5.4 Storing a program for a person

```http
POST /agent/v1/scripts
{"name": "FizzBuzz", "author": "AI agent", "password": "s3cret", "memo": "Prints 1..30",
 "code": "#import(\"lib/io.pg0\")\nfor (i = 1; i <= 30; i++) {\n  if (i % 15 == 0) { println(\"FizzBuzz\") }\n  else if (i % 3 == 0) { println(\"Fizz\") }\n  else if (i % 5 == 0) { println(\"Buzz\") }\n  else { println(i) }\n}"}
```

The `201` response contains `"url": "https://<host>/dev/?cid=<cid>"`; give that URL to the person. Append `&run=1` to run it on open.
