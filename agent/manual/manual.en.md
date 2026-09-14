# PG0 Agent API Manual

This manual is written for AI agents (and people) that want to write, check, run and store programs in **PG0** and **PG0.5** through the HTTP API of the PG0 web service. It is self-contained: it covers the API, the full language specification and the library reference. The Japanese version is at `GET /api/agent/v1/manual?lang=ja`.

- API index (JSON): `GET /api/agent/v1`
- OpenAPI 3 document: `GET /api/agent/v1/openapi.json`
- Machine readable function list: `GET /api/agent/v1/libraries`
- Original HTML documentation: `/doc/pg0_eng.html`, `/doc/pg0.5_eng.html`, `/doc/pg0.5_lib_eng.html`

## 1. Quick start

1. Write a program. Use **PG0.5** (the default) unless a task explicitly asks for PG0.
2. `POST /api/agent/v1/run` with `{"code": "..."}`.
3. Read `status`, `output`, `result`, `variables` and `error` in the response. Fix the program and run again.
4. Optionally store the program with `POST /api/agent/v1/scripts`; the response contains a URL that opens it in the web editor.

```http
POST /api/agent/v1/run
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

- Base path: `/api/agent/v1` on the same host as the web editor (on https://pg0.jp: `https://pg0.jp/api/agent/v1`). The index response repeats it as `base_url`.
- Request and response bodies are JSON (`Content-Type: application/json`, UTF-8). Request bodies are limited to 1 MB.
- Authentication: none by default. If the server operator configured an API key, send `Authorization: Bearer <key>` (or `X-API-Key: <key>`); otherwise the API answers `401`.
- Errors of the API itself (not of your program) use HTTP status codes 4xx/5xx and the body `{"error": {"code": "...", "message": "..."}}`. Program failures are reported with HTTP `200` and `status` other than `"ok"` (see 2.3).
- Limits are listed in `GET /api/agent/v1`; typical values: 5 s default timeout (30 s max), 10,000,000 statements, 200,000 characters of code, 1,000,000 characters of output, 4 concurrent runs (`429 too_many_runs` beyond that, retry after a second).

### 2.2 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agent/v1` | Index: endpoints, manual URLs, limits |
| GET | `/api/agent/v1/manual?lang=en\|ja` | This manual (Markdown) |
| GET | `/api/agent/v1/openapi.json` | OpenAPI 3 description |
| GET | `/api/agent/v1/libraries` | Function list as JSON |
| POST | `/api/agent/v1/check` | Syntax check only |
| POST | `/api/agent/v1/run` | Run a program |
| GET | `/api/agent/v1/scripts` | List / search stored scripts |
| POST | `/api/agent/v1/scripts` | Store a new script |
| GET | `/api/agent/v1/scripts/{cid}` | Get a stored script with its code |
| PUT | `/api/agent/v1/scripts/{cid}` | Update a stored script |
| DELETE | `/api/agent/v1/scripts/{cid}` | Delete a stored script |
| POST | `/api/agent/v1/scripts/{cid}/run` | Run a stored script |
| GET | `/api/agent/v1/scripts/{cid}/history` | Previous versions of a stored script |
| GET | `/api/agent/v1/scripts/{cid}/history/{time}` | One previous version |

#### POST /api/agent/v1/check

Parses the program without executing it.

Request: `{"code": string, "mode": "PG0.5" | "PG0" (default PG0.5), "lang": "en" | "ja" (default en)}`

Response: `{"ok": true, "mode": "PG0.5", "error": null, "warnings": [...]}` or `{"ok": false, "mode": "PG0.5", "error": {"message": "Syntax error", "line": 3, "source": "if a > 1 {", "phase": "parse"}, "warnings": []}`

`warnings` lists likely mistakes that the interpreter accepts, each as `{"code", "line", "name", "message"}` (messages follow `lang`). They are best-effort static checks and do not affect `ok`:

- `block_local_variable`: a variable first used inside a block is read outside that block, where it is a different variable (see 3.4). Typical fix: create it before the block.
- `unused_variable`: a variable inside a function or block is assigned but never read.

#### POST /api/agent/v1/run

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
| `seed` | number or string | none | Makes `random()` of `lib/math.pg0` reproducible. Equivalent to calling `random(seed)` once before the program starts (see 4.2). |
| `globals` | object | `{}` | Initial values of global variables, `{"name": value}`; JSON numbers, strings, arrays and objects become integers/floats, strings, arrays and keyed arrays. Together with `variables` of a previous run this continues a long play across several runs (see 4.5). |
| `globals_at` | `"start"` or `"first_sleep"` | `"start"` | When `globals` are applied: before the first statement, or at the first `sleep()` call after the program's own initialization ran (screen programs; see 4.5). |
| `storage` | object | `{}` | Initial contents of the key/value store of `lib/io.pg0` (`loadValue`), `{"key": value}`. The final store comes back in the response field `storage`. |
| `max_frames` | integer | 10000 | Programs using `lib/screen.pg0`: stop with `status: "frame_limit"` after this many `sleep()` calls (frames). See 4.5. |
| `max_virtual_ms` | integer | none | Programs using `lib/screen.pg0`: stop with `status: "virtual_time_limit"` when the virtual clock reaches this value. |
| `screen` | object | `{}` | Programs using `lib/screen.pg0`: `{"touch": [...], "keys": [...], "record": true, "max_calls": 2000}`; input timelines and call recording, see 4.5. |

Response fields are described in 2.3.

#### Stored scripts

Stored scripts are the same documents the web editor uses, so an agent can hand a program to a human (the response `url` opens it in the editor) and a human can edit it there with the same password.

`POST /api/agent/v1/scripts` request:

| Field | Type | Notes |
|---|---|---|
| `name` | string, required, max 100 | Must be unique among public scripts (`409 name_conflict` otherwise). |
| `code` | string, required | Program source. |
| `password` | string, required | Needed for update/delete. Compared case-insensitively after trimming, exactly as in the editor. |
| `author` | string, max 100 | Default `"AI agent"`. |
| `memo` | string | **Revision note.** Shown in the editor and, per version, in the revision history. On creation describe the program; on every update describe what changed (see "Revision history" below). |
| `private` | 0 or 1 | 1 hides the script from lists (still reachable by `cid`, and the name need not be unique). |
| `mode` | `"PG0.5"` or `"PG0"` | Mode used by the editor and by `/scripts/{cid}/run`. |
| `uuid` | string | Optional owner id; `GET /scripts?uuid=` lists these first, private ones included. |
| `speed` | 0, 1, 250 or 500 | Execution speed in the web editor: milliseconds of wait per statement. 0 = no wait, 1 = fast, 250 = normal (default), 500 = slow. **Set 0 for programs that use `lib/screen.pg0`**: with a wait, drawing and animation become extremely slow. |
| `check` | boolean | `true` parses `code` before saving and rejects the request with `422 syntax_error` (details in `error.detail`) when it does not parse. Without it, saving never checks the code, so run `/check` yourself first. |

Response `201`: `{"cid", "name", "author", "mode", "private", "speed", "createTime", "updateTime", "url", "run_url", "memo", "code"}`. Times are milliseconds since 1970-01-01 UTC. `url` opens the script in the web editor; `run_url` (`url` + `&run=1`) opens and runs it immediately, which is the link to hand to a person for a game.

`PUT /api/agent/v1/scripts/{cid}`: body `{"password": "...", ...any of name, code, author, memo, private, mode, uuid, speed, check}`; only given fields change. The previous version is kept in the history. **Always send `memo` with an update** describing the change; if omitted, the previous memo is carried over and the history no longer tells the versions apart. `401 wrong_password`, `404 not_found`, `409 name_conflict`.

`DELETE /api/agent/v1/scripts/{cid}`: body `{"password": "..."}`. Response `{"deleted": true, "cid": "..."}`.

`GET /api/agent/v1/scripts?q=words&uuid=owner&skip=0&count=30`: `{"scripts": [summary...], "skip", "count"}`. `q` words are matched against name and author.

`POST /api/agent/v1/scripts/{cid}/run`: same body as `/run` without `code`; `mode` defaults to the stored mode.

`GET /api/agent/v1/scripts/{cid}/history`: `{"history": [summary with memo and current...]}`; the current version first (`"current": 1`), then previous versions, newest first. `GET /api/agent/v1/scripts/{cid}/history/{updateTime}` returns that version with its code.

**Revision history.** Every save creates a version, and each version keeps its own `memo`. The web editor shows this list under "Revision history" (変更履歴), with the current version on top, so `memo` works as the change log of the script. Write it like a commit message:

- on `POST /api/agent/v1/scripts`: what the program does (for example `Initial version: breakout game, 3 levels`);
- on every `PUT /api/agent/v1/scripts/{cid}`: what changed and why (for example `Fixed paddle leaving the screen at the right edge; ball speed +10% per level`).

Keep it to one or two lines. Each update stores the previous version in the history (a version identical to the newest history entry is not stored twice).

```http
PUT /api/agent/v1/scripts/2f1c...
{"password": "s3cret", "code": "...", "memo": "Fixed paddle leaving the screen at the right edge"}

GET /api/agent/v1/scripts/2f1c.../history
{"history": [
  {"cid": "2f1c...", "updateTime": 1789380000000, "memo": "Fixed paddle leaving the screen at the right edge", "current": 1, ...},
  {"cid": "2f1c...", "updateTime": 1789379000000, "memo": "Initial version: breakout game, 3 levels", "current": 0, ...}
]}
```

### 2.3 Run result

| Field | Meaning |
|---|---|
| `status` | `"ok"`: finished. `"error"`: parse or runtime error (see `error`). `"timeout"`: time limit reached. `"step_limit"`: statement limit reached. `"memory_limit"`: memory limit reached. `"frame_limit"` / `"virtual_time_limit"`: a screen program was stopped by `max_frames` / `max_virtual_ms` (expected for endless game loops; `error` stays `null`). Output produced before a limit is still returned. |
| `mode` | Mode actually used. |
| `output` | Everything written by `print()` / `println()`, in order. `print` adds no newline. |
| `output_truncated` | `true` when the output limit cut the text. |
| `error_output` | Text written by `error()`, one line per call. `error()` does not stop the program. |
| `result` | Value of `exit value` (or a top-level `return value`), converted to JSON; `null` if the program ended without one. |
| `result_type` | `"integer"`, `"float"`, `"string"`, `"array"` or `null`. |
| `error` | `null` or `{"message", "line", "source", "phase"}`. `line` is 1-based and refers to `code`; `phase` is `"parse"` or `"runtime"`. |
| `variables` | Final values of the global variables (`{"name": value}`), converted to JSON. Variables local to blocks and functions are not included. This is the only way to observe values in PG0 mode, which has no `print`. |
| `screen` | `null` unless `lib/screen.pg0` was imported. Then `{"started", "width", "height", "background", "fit", "frames", "virtual_ms", "calls", "images", "record", "record_truncated"}`, see 4.5. |
| `storage` | `null` unless `lib/io.pg0` was imported. Then the final key/value store `{"key": value}` (initialized from the request field `storage`). |
| `stats` | `steps` (execution steps: roughly one per statement or operator), `elapsed_ms`, `input_lines_used`, `globals_applied` (`"start"`, `"first_sleep"`, `false` when `globals` were given but never applied, `null` without `globals`), and for screen programs `steps_per_frame: {"avg", "max"}` (see the performance note in 4.5). |

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
- Parameters and `var` variables inside the function are local. Any other name used in the function body resolves to the **global variable of that name if it already exists when the function runs** (assigning to it updates the global); if no such global exists yet, the name becomes a variable local to the function (or to the block inside the function where it is first used). Globals that a function should update must therefore be created before the function is called.
- User functions with the same name as a built-in take precedence.

### 3.9 exit and return

- `exit` stops the program immediately; `exit value` also sets `result` in the run response. `exit` works inside functions too.
- `return value` at the top level ends the program and also sets `result`.
- When the program simply runs off the end, `result` is `null`.

### 3.10 Preprocessor

Lines starting with `#` are processed before execution and may appear anywhere.

- `#option("pg0.5")`: run as PG0.5 from this line on.
- `#option("strict")`: every variable must be declared with `var`.
- `#import("lib/math.pg0")`: load a library (see 4). Importing switches the program to PG0.5. In the API `lib/math.pg0`, `lib/string.pg0`, `lib/io.pg0` and `lib/screen.pg0` (headless, see 4.5) can be imported; anything else (other files, URLs) fails with "Read error in script or library".

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
18. Screen programs: call `sleep()` once per loop iteration (it is the frame boundary in the API and the only pause in the browser), use radians for angles, and remember that `drawText(x, y)` places the top-left of the text at (x, y).
19. A multi-line array initializer continues only while each line ends with an operator, so keep the closing brace on the line of the last element: `a[] = {1,\n 2,\n 3}` is fine, `a[] = {1,\n 2\n}` is a syntax error.
20. Inside a function, assigning to a name updates the global of that name if it already exists; otherwise the variable is function-local, and one first assigned inside an `if`/`for` block of the function is local to that block. Declare the function's working variables with `var` at the top of the function, and create shared state at the top level before calling the function.
21. `m = mons[0]` copies the element; changing `m["hp"]` leaves `mons[0]` untouched. Write `mons[0]["hp"] = ...` to modify the element in place.
22. `int(time())` overflows 32 bits (`time()` is milliseconds since 1970). Take a remainder first, for example `int(time() % 65521)`, or keep the float.

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
| `random(seed = none)` | Float in [0, 1). With `seed` (number or string) it restarts a reproducible sequence and returns its first value; following `random()` calls continue the sequence. Never seeded: true random. Use a seed to make tests deterministic without changing the program: the request field `seed` of `/run` does the same before the program starts. |
| `max(a, b, ...)`, `min(a, b, ...)` | Largest / smallest of the arguments; an array argument contributes its elements (`max({4, 2, 9})` is 9). |
| `sign(n)` | 1, -1 or 0. |

Results with no fractional part are returned as integers (`sqrt(16)` is `4`).

Functions that the library does not have can be written in a few lines. These are verified and can be pasted into a program:

```
function floor(x) { var n = int(x)
  if (x < n) { return n - 1 }
  return n }
function ceil(x) { var n = int(x)
  if (x > n) { return n + 1 }
  return n }
function round(x) { return floor(x + 0.5) }
function hypot(x, y) { return sqrt(x * x + y * y) }
function atan2(y, x) {
  var pi = 3.141592653589793
  if (x > 0) { return atan(y / x) }
  if (x < 0 && y >= 0) { return atan(y / x) + pi }
  if (x < 0 && y < 0) { return atan(y / x) - pi }
  if (y > 0) { return pi / 2 }
  if (y < 0) { return -pi / 2 }
  return 0
}
```


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
| `saveValue(key, v)`, `loadValue(key)`, `removeValue(key)` | Key/value store. In the API it exists only during the current run (in the browser it persists): the request field `storage` fills it before the program starts (for example a saved game to test "continue"), and the response field `storage` returns its final contents. `loadValue` of a missing key returns `0`. |
| `get_clipboard()`, `set_clipboard(s)` | Run-local clipboard string (empty at start). `set_clipboard` returns 1. |

### 4.5 Screen library: `#import("lib/screen.pg0")` (headless in the API)

In the browser this library opens a canvas that covers the page and provides drawing, keyboard, pointer and sound. Through the API it runs **headless**: the program executes with the same function signatures, but

- drawing and sound functions draw nothing; they are counted in `screen.calls` and, with `"screen": {"record": true}`, recorded per frame in `screen.record`;
- `sleep(ms)` does not wait: it advances a **virtual clock** by `ms` and counts one **frame**;
- `time()` returns the virtual clock (start time + virtual ms) and advances it by 1 ms per call, so busy-wait loops on `time()` terminate;
- `inTouch()` and `inKey()` answer from the `screen.touch` and `screen.keys` timelines of the request (nothing pressed by default);
- the run stops with `status: "frame_limit"` after `max_frames` frames (default 10000) or `status: "virtual_time_limit"` when the virtual clock reaches `max_virtual_ms`. These are normal stops for endless game loops: `variables` and `screen` are returned and `error` is `null`.

What cannot be verified headless: actual pixels (`rgbToPoint` returns black), exact text metrics (`measureText` is an approximation), real frame rate and appearance. Store the program (`POST /api/agent/v1/scripts` with `"speed": 0`) and let a person open the returned `run_url` for that.

**Performance budget per frame.** `stats.steps_per_frame` (`avg` and `max`) counts execution steps between two `sleep()` calls, in the same unit as `stats.steps`. In the browser at speed 0 the interpreter yields to the page every 1000 steps, which costs about 4 ms each, so a frame needs roughly **4.6 ms per 1000 steps plus the `sleep()` time plus drawing**. With `sleep(16)`: about 1000 steps per frame gives around 45 fps, 3000 steps around 30 fps, 10000 steps around 15 fps. Drawing 300 tiles with one `drawRect` each costs a few thousand steps; draw only what changed, or draw static layers once into an image (`createImage`) and blit it with `drawImage`.

**Step cost of common constructs** (measured; one step is roughly one token executed, so a variable, a constant and an operator cost about 1 each):

| Construct | Steps |
|---|---|
| `for` loop, per iteration (`i < n`, `i++`) | about 11 |
| `x = x + 1`, `x += 1`, `x = a[i]`, `x = a["key"]` | about 5 |
| `x = m[i][j]` | about 7 |
| `x = a + b * c - d` | about 9 |
| `if (x > 0) { }` | about 8 |
| Function call `f()` with no parameters | about 4 plus the body |
| Each parameter of a call, each default value | about 1 to 2 more |
| Each `var` declaration inside the function | about 2 |
| Library call such as `sqrt(x)` or `drawRect(...)` | about 5 plus about 1 per argument and per option element |

Steps count interpreted tokens, not work: copying a large array into a parameter costs few steps but real time, so pass big arrays with `&`. A function call is cheap by itself; its cost comes from the statements inside it, so avoid calling small helpers thousands of times per frame in physics loops and inline the arithmetic instead. Long computations without `sleep()` (for example generating a maze, 70,000 steps) are fine in the browser: the interpreter yields every 1000 steps, the page stays responsive and canvas drawing done before the computation (a "Loading" text) is visible; about 200,000 steps take one second, so keep one-off work under a few seconds or split it over frames. In the API such work counts toward `timeout_ms` and `max_steps`.


**Request fields** (`POST /api/agent/v1/run` and `/scripts/{cid}/run`):

| Field | Meaning |
|---|---|
| `max_frames` | Stop after this many `sleep()` calls. Default 10000, server maximum in `GET /api/agent/v1`. |
| `max_virtual_ms` | Stop when the virtual clock reaches this many ms. Default none. |
| `screen.touch` | Pointer timeline: `[{"ms": 500, "x": 330, "y": 300, "touch": 1, "button": 0}, {"ms": 700, "x": 330, "y": 300, "touch": 0}]`. Each entry is the state from its virtual time until the next entry. `touch` defaults to 1, `button` to 0. |
| `screen.keys` | Keyboard timeline: `[{"ms": 100, "keys": ["ArrowLeft"]}, {"ms": 400, "keys": []}]`. Each entry lists the keys held from its virtual time on; `[]` releases all keys. Short forms: `{"ms": 500, "tap": "Enter"}` presses a key for exactly one frame, `{"ms": 500, "hold": "ArrowDown", "frames": 8}` for 8 frames (`tap`/`hold` accept a string or an array of keys). Every entry may use `"frame": n` (frame index, 0-based) instead of `"ms"`. A tap/hold starts in the first frame whose start time is at or after `ms`, and is added on top of the held keys of the `keys` entries. |
| `screen.record` | `true` returns the drawing calls. |
| `screen.max_calls` | Cap on recorded calls (default 2000). Beyond it `record_truncated` becomes `true`; `calls` keeps counting. |
| `screen.record_frames` | `{"from": 300, "to": 320}` records only these frames (inclusive), so a late scene can be captured cheaply. |
| `screen.record_functions` | `["drawText", "drawImage"]` records only these functions (case-insensitive). |
| `screen.record_image_frames` | `true` records every frame in which `createImage` is called completely (all calls of that frame, from its start), even outside `record_frames` and regardless of `record_functions`, so that the images can be reproduced when replaying a partial recording. |

Touch entries also accept the short form `{"ms": 500, "tap": {"x": 330, "y": 300}}` (touch for one frame, or `"frames": n`) and `"frame"` instead of `"ms"`. The order of the entries does not matter: at any moment the state entry that became due last applies, and taps/holds are evaluated by their own time. Every entry must have exactly one of `ms` or `frame`, numeric `x`/`y` for touch, and `keys`, `tap` or `hold` for keys; otherwise the request is rejected with `400 invalid_request` naming the entry, for example `"screen.keys[2]" needs exactly one of "ms" ... or "frame" ...`.

**Response field `screen`** (present when the library was imported):

```json
{"started": true, "width": 320, "height": 240, "background": "#000000", "fit": 1,
 "frames": 100, "virtual_ms": 1600, "calls": 401, "images": 0,
 "record": [{"frame": 0, "ms": 0, "calls": [{"fn": "startScreen", "args": [320, 240, {"color": "#000000"}]},
                                            {"fn": "drawCircle", "args": [20, 20, 10, {"color": "#ffcc00", "fill": 1}]}]},
            {"frame": 1, "ms": 16, "calls": []}],
 "record_truncated": false}
```

`record` is `null` unless requested. A frame is the span between two `sleep()` calls; `frame` is its index and `ms` the virtual clock at its start.

**Coordinate system and units**: origin at the top-left of the screen, x to the right, y downwards, in the pixel units of `startScreen(width, height)`. With `"fit": 1` (default) the browser scales the screen to the window, but all coordinates, including `inTouch()`, stay in screen pixels. Angles are **radians**, clockwise from the positive x axis. Colors are CSS color strings: `"#rgb"`, `"#rrggbb"`, `"#rrggbbaa"`, `"rgb(255, 0, 0)"`, `"rgba(255, 0, 0, 0.5)"`, `"hsl(120, 100%, 50%)"` and names like `"red"` all work for drawing (`drawLine`, `drawRect`, `drawCircle`, `drawPolyline`, `drawText`, `startScreen`). Exceptions: `drawFill` and `hexToRgb` accept only `"#rrggbb"` or `"#rgb"`, and `rgbToHex` returns `"#rrggbb"`. The default drawing color is black `"#000"`.

**Functions**

| Function | Description |
|---|---|
| `startScreen(width, height, option = {})` | Opens the screen. `option`: `{"color": background, "fit": 1}`. Call it once at the start. |
| `sleep(ms)` | Browser: pause. Headless: advance the virtual clock, end the frame. One call per game-loop iteration. |
| `time()` | Milliseconds since 1970-01-01 UTC as a float. Headless: virtual. |
| `timeString(ms, format = "")` | Formats a time; `YYYY MM DD hh mm ss` (zero padded) or `M D h m s`. Without `format`: locale date and time. |
| `startOffscreen()` / `endOffscreen()` | Double buffering: draw to a buffer, then show it. Use around each frame's drawing to avoid flicker. |
| `startMask(option = {})` / `endMask()` | Mask mode: only drawn areas stay visible; `{"destination": "out"}` makes drawn areas transparent instead. |
| `clearRect(x, y, width, height)` | Makes the rectangle transparent (background color shows). |
| `drawLine(x1, y1, x2, y2, option = {})` | `option`: `{"width": 1, "color": "#000"}`. |
| `drawRect(x, y, width, height, option = {})` | Top-left at (x, y). `option`: `{"width": 1, "color": "#000", "fill": 0}`; `fill` 1 fills, 0 outlines. |
| `drawCircle(x, y, radiusX, option = {})` | Center (x, y). `option`: `{"radius_y": radiusX, "rotation": 0, "start": 0, "end": 6.2832, "color": "#000", "width": 1, "fill": 0, "close": 0}`. `start`/`end` in radians make an arc; `close` 1 joins the arc ends when outlining. |
| `drawPolyline(points, option = {})` | `points` is `{{x, y}, {x, y}, ...}`. `option`: `{"width": 1, "color": "#000", "fill": 0, "close": 0}`. |
| `drawFill(x, y, color)` | Flood fill from (x, y). Headless: recorded only. |
| `drawScroll(dx, dy)` | Scrolls the screen; content wraps around. |
| `createImage(x, y, width, height, option = {})` | Copies the region into an image and returns its id (0, 1, 2, ...). `{"id": n}` replaces image n. The source is the current drawing target: the offscreen buffer between `startOffscreen()` and `endOffscreen()`, otherwise the visible screen. Only pixels inside the screen area can be captured: a region reaching outside the screen gets transparent pixels there, and areas never drawn are transparent as well (the background color is not part of the pixels). So an image cannot hold more than one screen of content; for a maze larger than the screen keep the data in an array and draw the visible part each frame, or build several screen-sized tiles. Images live only for the current run: they are not carried over by `globals`/`storage` into a following run (see below). |
| `drawImage(id, x, y, option = {})` | Draws the image with top-left (x, y). `option`: `{"width", "height"}` (both or neither), `"angle"` in radians, **clockwise** (positive angles turn the top of the image to the right, because y grows downwards), rotating about the **image center**; `"alpha"` 0.0 to 1.0. Unknown ids are ignored. To rotate about another point P, rotate the image center around P and draw at the new center: with `cx = x + w/2 - px`, `cy = y + h/2 - py`, the new top-left is `(px + cx*cos(a) - cy*sin(a) - w/2, py + cx*sin(a) + cy*cos(a) - h/2)` with the same `angle` `a`. |
| `drawText(text, x, y, option = {})` | **(x, y) is the top-left of the text**; the baseline is at y + fontsize. `option`: `{"color": "#000", "fontsize": 30, "fontface": "sans-serif", "fontstyle": "normal"/"bold"/"italic"/"oblique", "fill": 1, "width": 1}`; `fill` 0 draws outlines. Numbers and arrays are converted to text. |
| `measureText(text, option = {})` | `{"width": w, "height": h}` in pixels; `option`: `{"fontsize", "fontface", "fontstyle"}`. Headless: 0.55 × fontsize per ASCII character, 1 × fontsize otherwise, height = fontsize. |
| `rgbToPoint(x, y)` | Pixel color `{"r", "g", "b"}` (0 to 255). Headless: always black. |
| `rgbToHex(rgb)` / `hexToRgb(hex)` | Convert between `{"r", "g", "b"}` and `"#rrggbb"`. |
| `inTouch()` | `{"x", "y", "touch": 0/1, "button": 0 left/1 middle/2 right, "pos": {{x, y}, ...}}`. When `touch` is 0, `x`/`y` keep the last position. `pos` holds all touch points (multi-touch). |
| `inKey(key = none)` | No argument: array of held key names (JavaScript `KeyboardEvent.key`: `"ArrowLeft"`, `"a"`, `" "`, `"Enter"`). String: 1 if held (case-insensitive). Array: 1 only if all are held; names in the array must be lower case (`{"arrowleft", "a"}`). Browser: the held list is cleared 1 s after the last `keydown` event; since a key that stays down produces repeated `keydown` events through the OS key repeat (typically every 30 to 50 ms after an initial delay of about 250 to 500 ms), ordinary keys held down stay in the list and this is not a problem in practice. Modifier keys (Shift, Ctrl, Alt) do not repeat and therefore read as released after 1 s. Poll every frame and treat the list as "currently pressed". |
| `playSound(note, start, duration, volume = 1)` | Square wave. `note`: Hz or a name like `"C4"`, `"F#5"`. `start`: delay in ms, `duration`: length in ms. |
| `playMusic(notes, option = {})` | `{{note, length_ms, volume?}, ...}` in sequence; `{"start": ms}` resets the position (chords), `{"volume": v}` sets the volume for following notes. `option`: `{"repeat": 1}`. Calling it again does not stop what is already playing: sounds overlap. |
| `bgm(notes = none, option = {"repeat": 1})` | Background music track: stops the previous `bgm` (and only that), then plays `notes` in a loop (`{"repeat": 0}` plays once). `bgm()` without arguments stops the music. Sound effects from `playSound`/`playMusic` keep playing. |
| `stopSound()` | Stops all sounds, `bgm` included. |

Sound notes: all sounds are square waves mixed together, so `playSound` effects play on top of `playMusic`/`bgm`. Browsers block audio until the first tap or key press on the page; sounds started before that may stay silent or start late, so start the music from the title screen after the first input. Sound is muted when the person turned on the mute button of the screen.

**Continuing a long play across runs.** One run is limited to `max_timeout_ms` of real time. To test a longer session, run with `max_frames`, read `variables` and `storage` from the response, and pass them back as `globals` and `storage` of the next request. Two things decide whether this works:

- **When the globals are applied.** With the default `globals_at: "start"` they exist before the first statement, so an initialization such as `state = 0` at the top of the program overwrites them, and a `var state` declaration fails with "Duplicate variable declaration". For screen programs use `"globals_at": "first_sleep"`: the program starts normally, runs its initialization (including `createImage`, whose images therefore exist again), and at the **first `sleep()` call** the passed values replace the current values of the named variables. Everything after that call continues from the restored state. The loop counter of the game loop is restored too, so pass exactly the state you want to continue from and drop the rest. `stats.globals_applied` tells whether and when the values were applied (`"start"`, `"first_sleep"`, or `false` when the program never called `sleep()`).
- **Programs without `sleep()`** (no screen) can only use `globals_at: "start"`. Then guard the initialization with a flag that you pass along with the state, and create each state variable at the top level with `name = name` (reads the existing value, or creates `0` when there is none) so that the assignments inside the `if` block update the globals:

```
resumed = resumed          // 0 on a fresh run, 1 when passed in globals
state = state; score = score; maze = maze
if (!resumed) {
  state = 0; score = 0
  maze[] = generateMaze()
}
```

Only variables and the key/value store are carried over: images created with `createImage` are not (image ids stored in variables point to nothing in the next run, and `drawImage` with them is ignored), which is another reason to let the initialization run with `globals_at: "first_sleep"`.

**Game-loop template that works both headless and in the browser**

```
#import("lib/screen.pg0")
startScreen(320, 240, {"color": "#000000"})
x = 160; y = 120; score = 0
while (1) {
  t = inTouch()
  if (t["touch"]) { x = t["x"]; y = t["y"]; score++ }
  if (inKey("ArrowLeft")) { x -= 4 }
  if (inKey("ArrowRight")) { x += 4 }
  startOffscreen()
  drawRect(0, 0, 320, 240, {"color": "#000000", "fill": 1})
  drawCircle(x, y, 10, {"color": "#ffcc00", "fill": 1})
  drawText("score " + score, 4, 4, {"color": "#ffffff", "fontsize": 16})
  endOffscreen()
  sleep(16)
}
```

Run it with a scenario:

```json
{"code": "...the program above...",
 "max_frames": 300,
 "screen": {"touch": [{"ms": 500, "x": 50, "y": 60}, {"ms": 600, "x": 50, "y": 60, "touch": 0}],
            "keys": [{"ms": 1000, "keys": ["ArrowRight"]}, {"ms": 1500, "keys": []}],
            "record": true, "max_calls": 50}}
```

Expected: `status` `"frame_limit"`, `screen.frames` 300, `variables.score` 6 (the pointer is down for virtual ms 500 to 599; the frames starting at 512, 528, ..., 592 see it), `variables.x` 50 + 4 × 31 = 174 (ArrowRight is held from 1000 to 1499 ms, which covers the 31 frames starting at 1008 to 1488), and `screen.record` showing the first 50 calls with their coordinates.

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
POST /api/agent/v1/scripts
{"name": "FizzBuzz", "author": "AI agent", "password": "s3cret", "memo": "Prints 1..30", "speed": 250,
 "code": "#import(\"lib/io.pg0\")\nfor (i = 1; i <= 30; i++) {\n  if (i % 15 == 0) { println(\"FizzBuzz\") }\n  else if (i % 3 == 0) { println(\"Fizz\") }\n  else if (i % 5 == 0) { println(\"Buzz\") }\n  else { println(i) }\n}"}
```

The `201` response contains `"url": "https://<host>/dev/?cid=<cid>"`; give that URL to the person. Append `&run=1` to run it on open.

### 5.5 Testing and storing a screen program

The bouncing-ball program below imports `lib/screen.pg0`. Through `/run` it executes headless (see 4.5): `max_frames` stops the endless loop, and `variables` shows where the ball ended up.

```json
{"code": "#import(\"lib/screen.pg0\")\nstartScreen(320, 240, {\"color\": \"#000000\"})\nx = 20; y = 20; dx = 3; dy = 2\nwhile (1) {\n  startOffscreen()\n  drawRect(0, 0, 320, 240, {\"color\": \"#000000\", \"fill\": 1})\n  drawCircle(x, y, 10, {\"color\": \"#ffcc00\", \"fill\": 1})\n  endOffscreen()\n  x += dx; y += dy\n  if (x < 10 || x > 310) { dx = -dx }\n  if (y < 10 || y > 230) { dy = -dy }\n  sleep(16)\n}",
 "max_frames": 100, "screen": {"record": true, "max_calls": 10}}
```

Response (abbreviated): `"status": "frame_limit"`, `"variables": {"x": 302, "y": 220, "dx": -3, "dy": 2}`, `"screen": {"frames": 100, "virtual_ms": 1600, "calls": 401, "record": [...], "record_truncated": true}`.

Store it for a person with `"speed": 0`:

```http
POST /api/agent/v1/scripts
{"name": "Bouncing ball", "author": "AI agent", "password": "s3cret", "speed": 0, "code": "...the same code..."}
```
