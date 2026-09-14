# PG0 エージェントAPI マニュアル

このマニュアルは、PG0 Webサービスの HTTP API を通じて **PG0** / **PG0.5** のプログラムを作成・構文チェック・実行・保存する AI エージェント（および人間）向けに書かれています。API の使い方、言語仕様の全体、ライブラリリファレンスをこの1冊に収めています。英語版は `GET /api/agent/v1/manual?lang=en` です。

- API インデックス (JSON): `GET /api/agent/v1`
- OpenAPI 3 定義: `GET /api/agent/v1/openapi.json`
- 機械可読の関数一覧: `GET /api/agent/v1/libraries`
- 元の HTML ドキュメント: `/doc/pg0.html`, `/doc/pg0.5.html`, `/doc/pg0.5_lib.html`

## 1. クイックスタート

1. プログラムを書きます。課題で PG0 が明示されていない限り **PG0.5**（デフォルト）を使います。
2. `POST /api/agent/v1/run` に `{"code": "..."}` を送ります。
3. レスポンスの `status`, `output`, `result`, `variables`, `error` を読み、必要ならプログラムを直して再実行します。
4. 必要なら `POST /api/agent/v1/scripts` で保存します。レスポンスの `url` を開くと Web エディタでそのプログラムが開きます。

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

## 2. API リファレンス

### 2.1 共通事項

- ベースパス: Web エディタと同じホストの `/api/agent/v1`（https://pg0.jp では `https://pg0.jp/api/agent/v1`）。インデックスのレスポンスにも `base_url` として入っています。
- リクエスト・レスポンスとも JSON（`Content-Type: application/json`、UTF-8）。リクエストボディは 1MB まで。
- 認証: デフォルトでは不要。サーバ管理者が API キーを設定している場合は `Authorization: Bearer <key>`（または `X-API-Key: <key>`）を付けます。無い場合は `401` になります。
- API 自体のエラー（プログラムのエラーではない）は HTTP 4xx/5xx と `{"error": {"code": "...", "message": "..."}}` で返します。プログラムの失敗は HTTP `200` で、`status` が `"ok"` 以外になります（2.3 参照）。
- 制限値は `GET /api/agent/v1` に載っています。標準値: タイムアウト 5 秒（最大 30 秒）、実行文数 10,000,000、コード 200,000 文字、出力 1,000,000 文字、同時実行 4（超えると `429 too_many_runs`。1 秒ほど待って再試行）。

### 2.2 エンドポイント

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/agent/v1` | インデックス: エンドポイント一覧、マニュアル URL、制限値 |
| GET | `/api/agent/v1/manual?lang=ja\|en` | このマニュアル (Markdown) |
| GET | `/api/agent/v1/openapi.json` | OpenAPI 3 定義 |
| GET | `/api/agent/v1/libraries` | 関数一覧 (JSON) |
| POST | `/api/agent/v1/check` | 構文チェックのみ |
| POST | `/api/agent/v1/run` | プログラムの実行 |
| GET | `/api/agent/v1/scripts` | 保存済みスクリプトの一覧・検索 |
| POST | `/api/agent/v1/scripts` | スクリプトの新規保存 |
| GET | `/api/agent/v1/scripts/{cid}` | 保存済みスクリプトの取得（コード込み） |
| PUT | `/api/agent/v1/scripts/{cid}` | 保存済みスクリプトの更新 |
| DELETE | `/api/agent/v1/scripts/{cid}` | 保存済みスクリプトの削除 |
| POST | `/api/agent/v1/scripts/{cid}/run` | 保存済みスクリプトの実行 |
| GET | `/api/agent/v1/scripts/{cid}/history` | 保存済みスクリプトの履歴一覧 |
| GET | `/api/agent/v1/scripts/{cid}/history/{time}` | 履歴の 1 バージョン取得 |

#### POST /api/agent/v1/check

実行せずに構文解析だけ行います。

リクエスト: `{"code": string, "mode": "PG0.5" | "PG0" (デフォルト PG0.5), "lang": "en" | "ja" (デフォルト en)}`

レスポンス: `{"ok": true, "mode": "PG0.5", "error": null}` または `{"ok": false, "mode": "PG0.5", "error": {"message": "間違った書き方です", "line": 3, "source": "if a > 1 {", "phase": "parse"}}`

#### POST /api/agent/v1/run

リクエストのフィールド:

| フィールド | 型 | デフォルト | 意味 |
|---|---|---|---|
| `code` | string | 必須 | プログラムのソース。行は `\n` で区切ります。 |
| `input` | string または string の配列 | なし | `input()` が 1 回の呼び出しごとに 1 行ずつ返す内容。文字列の場合は改行で分割されます。 |
| `mode` | `"PG0.5"` または `"PG0"` | `"PG0.5"` | 言語モード（3.1 参照）。 |
| `lang` | `"en"` または `"ja"` | `"en"` | エラーメッセージの言語。 |
| `timeout_ms` | integer | 5000 | 実行時間の上限。サーバ側の上限（30000）で頭打ちになります。 |
| `max_steps` | integer | 10000000 | 実行する文の数の上限。サーバ側の上限で頭打ちになります。 |
| `variables` | boolean | true | 終了時のグローバル変数をレスポンスに含めるか。 |

レスポンスのフィールドは 2.3 を参照してください。

#### 保存済みスクリプト

保存されるスクリプトは Web エディタが使うものと同じデータです。エージェントが作ったプログラムを人に渡す（レスポンスの `url` でエディタが開く）ことも、人が同じパスワードでエディタから編集することもできます。

`POST /api/agent/v1/scripts` のリクエスト:

| フィールド | 型 | 備考 |
|---|---|---|
| `name` | string、必須、100 文字まで | 公開スクリプトの中で一意である必要があります（重複は `409 name_conflict`）。 |
| `code` | string、必須 | プログラムのソース。 |
| `password` | string、必須 | 更新・削除に必要。エディタと同様、前後の空白を除き大文字小文字を区別せずに比較されます。 |
| `author` | string、100 文字まで | デフォルト `"AI agent"`。 |
| `memo` | string | エディタに表示される説明。 |
| `private` | 0 または 1 | 1 で一覧に出なくなります（`cid` では取得可能。名前の一意性も不要）。 |
| `mode` | `"PG0.5"` または `"PG0"` | エディタと `/scripts/{cid}/run` が使うモード。 |
| `uuid` | string | 任意の所有者 ID。`GET /scripts?uuid=` で非公開分も含めて先頭に列挙されます。 |

レスポンス `201`: `{"cid", "name", "author", "mode", "private", "createTime", "updateTime", "url", "memo", "code"}`。時刻は 1970-01-01 UTC からのミリ秒です。

`PUT /api/agent/v1/scripts/{cid}`: ボディは `{"password": "...", name, code, author, memo, private, mode, uuid のうち変更したいもの}`。指定したフィールドだけ変わります。以前の内容は履歴に残ります。`401 wrong_password`, `404 not_found`, `409 name_conflict`。

`DELETE /api/agent/v1/scripts/{cid}`: ボディ `{"password": "..."}`。レスポンス `{"deleted": true, "cid": "..."}`。

`GET /api/agent/v1/scripts?q=単語&uuid=所有者&skip=0&count=30`: `{"scripts": [要約...], "skip", "count"}`。`q` の単語（空白区切り）は名前と作者に対して照合されます。

`POST /api/agent/v1/scripts/{cid}/run`: `/run` から `code` を除いたボディ。`mode` は保存時のモードがデフォルトです。

`GET /api/agent/v1/scripts/{cid}/history`: `{"history": [memo 付きの要約...]}`、新しい順。`GET /api/agent/v1/scripts/{cid}/history/{updateTime}` でそのバージョンのコードを取得できます。

### 2.3 実行結果

| フィールド | 意味 |
|---|---|
| `status` | `"ok"`: 正常終了。`"error"`: 構文エラーまたは実行時エラー（`error` 参照）。`"timeout"`: 時間制限。`"step_limit"`: 文数制限。`"memory_limit"`: メモリ制限。制限に達する前の出力はそのまま返ります。 |
| `mode` | 実際に使われたモード。 |
| `output` | `print()` / `println()` が書いた内容すべて（順序どおり）。`print` は改行を付けません。 |
| `output_truncated` | 出力上限で切り詰められた場合 `true`。 |
| `error_output` | `error()` が書いた内容。呼び出しごとに 1 行。`error()` はプログラムを止めません。 |
| `result` | `exit 値`（または最上位の `return 値`）の値を JSON に変換したもの。無ければ `null`。 |
| `result_type` | `"integer"`, `"float"`, `"string"`, `"array"` または `null`。 |
| `error` | `null` または `{"message", "line", "source", "phase"}`。`line` は `code` 内の 1 始まりの行番号。`phase` は `"parse"` か `"runtime"`。 |
| `variables` | グローバル変数の最終値（`{"名前": 値}`）を JSON に変換したもの。ブロックや関数のローカル変数は含みません。`print` のない PG0 モードでは値を観測する唯一の手段です。 |
| `stats` | `steps`（実行した文の数）、`elapsed_ms`、`input_lines_used`。 |

JSON への変換: 整数・実数は数値、文字列は文字列になります。要素にキーが一つも無い配列は JSON 配列、キー付き要素が一つでもある配列は JSON オブジェクトになり、キーの無い要素はインデックスがキーになります（例: `{"x": 1, 7}` は `{"x": 1, "1": 7}`）。

## 3. 言語仕様

PG0 はプログラミング学習のための小さな言語です。構文は C / JavaScript に似ていますが、はるかに小さく厳格です。コードを書く前に 3.11 の注意点を読んでください。

### 3.1 モード: PG0 と PG0.5

| | PG0 | PG0.5（デフォルト） |
|---|---|---|
| 型 | 32bit 整数のみ | 整数、実数、文字列、配列 |
| 文 | 代入、`if`/`else`、`while`、`exit` | 加えて `else if`、`for`、`do..while`、`switch`、`break`、`continue`、`return` |
| 関数 | なし（`print`/`input` も無い） | ユーザ関数、標準関数、`#import` によるライブラリ |
| 演算子 | `+ - * / %`、`+a -a !a`、比較、`&& \|\|`、`=` | 加えて `++ --`、ビット演算、複合代入（`+=` など） |
| 整数の除算 | `7 / 2` は `3` | `7 / 2` は `3.5`（実数） |
| 出力 | なし: 実行結果の `variables` / `result` を読む | `print`、`println`、`error`、`exit 値` |

PG0 モード向けに書いたプログラムは、`/` が実数を返しうる点を除き PG0.5 モードでもそのまま動きます。コード中に `#option("pg0.5")` または `#import(...)` があると、`mode` の指定に関係なく PG0.5 として動作します。

### 3.2 プログラムの構造

- 1 行に 1 文。1 行に複数の文を書くときは `;` で区切ります。
- コメントは `//` から行末まで。ブロックコメントはありません。
- ブロックは `{ ... }`。`if`、`else`、`while`、`for`、`do`、`switch`、`function` の本体は**必ず**ブロックにします。波括弧なしの単文は構文エラーです。
- 行末が演算子で終わる場合だけ、文は次の行に続きます:

```
a = 1 +
    2        // a = 3
```

- キーワード（`if`, `else`, `while`, `for`, `do`, `switch`, `case`, `default`, `break`, `continue`, `return`, `function`, `var`, `exit`）は小文字のみです。
- 文は上から順に実行されます。関数は呼び出しの前でも後でも定義できます。

### 3.3 型とリテラル

**整数**: 32bit 符号付き（-2,147,483,648 ～ 2,147,483,647）。演算はラップアラウンドします（`2147483647 + 1` は `-2147483648`）。範囲外のリテラルは範囲内に丸められます。リテラル: `1234`、`-123`、`0123`（8 進、PG0.5）、`0x12`（16 進、PG0.5）。指数表記（`1e3`）は使えません。

**実数**（PG0.5）: 64bit 倍精度。リテラル: `0.5`、`.5`、`2.0`。小数部が 0 になった実数の計算結果は整数に戻ります（`2.5 - 0.5` は整数の `2`、`6 / 3` は `2`）。実数は小数点以下 16 桁で表示されます: `print(7 / 2)` は `3.5000000000000000`。表示形式が重要なときは `int(x)` などで整数にしてください。

**文字列**（PG0.5）: `"text"` または `'text'`。内部は UTF-16。エスケープ: `\n \r \t \b \\ \" \' \ooo`（8 進）`\xhh`（16 進）。文字列に使える演算子は `+`（連結）、`==`、`!=` だけです。`-`、`*`、`<`、`>` を文字列に使うと実行時エラー（「間違ったな演算子です」）になります。`+` で数値と文字列を混ぜると数値が文字列に変換されます: `"abc" + 1` は `"abc1"`、`1 + 2 + "abc"` は `"3abc"`、`"" + 1 + 2` は `"12"`。

**配列**（PG0.5。PG0 では整数の配列）: 3.5 参照。

**真偽**: `0`、`0.0`、`""` が偽、それ以外が真。比較演算子と論理演算子は `1` か `0` を返します。

**型の判定**: `isType(v)` は 0 整数、1 実数、2 文字列、3 配列を返します。

### 3.4 変数

- 変数は最初に使われた時点で自動的に作られ、整数 `0` で初期化されます。未知の変数を読んでもエラーにならず `0` になります。
- `var a, b = 5` で明示的に宣言できます（`,` で複数）。同じブロック内で同じ名前を 2 回宣言するとエラーです。`#option("strict")` を書くと `var` が必須になります（未宣言の名前を使うとエラー）。
- **スコープは変数が作られたブロックです。** `if` やループ、関数の本体を含むブロック（`{}`）の中で初めて使った（または `var` で宣言した）変数はそのブロックの中だけに存在し、ブロックを抜けると消えます。外側のブロックに既にある名前へ代入した場合はその変数が変更されます。したがって、ブロックの後で必要な変数は先に最上位で初期化してください:

```
total = 0                          // 最上位で作る
for (i = 1; i <= 3; i++) { total += i }
print(total)                       // 6
for (i = 1; i <= 3; i++) { other += i }
print(other)                       // 0: ループ内の "other" は別のブロックローカル変数だった
```

  `for (i = 0; ...)` のループ変数はブロックの外で作られるので、ループ後も使えます。
- 関数からはグローバル変数（最上位の変数）を読み書きできます。
- 名前に使える文字: 英数字、`_`、全角文字。先頭に数字は使えません。この実装では変数名は**大文字小文字を区別します**（`A` と `a` は別の変数）。関数名は区別しません。
- 変数はどの型の値でも 1 つ保持し、代入で型が変わります（`a = 1` の後に `a = "x"` は可）。

### 3.5 配列

配列は順序付きの要素の並びで、各要素は文字列のキーを持つこともできます。ベクトルとしても連想配列としても、その混在としても使えます。

```
a[0] = 10            // インデックスは 0 始まり
a[5] = 1             // 自動的に拡張される。a[1]～a[4] は 0
b["name"] = "pg0"    // キーでアクセス（キーは大文字小文字を区別しない: b["NAME"] は同じ要素）
m[1][0] = 3          // 多次元
a[] = {1, 2, 3}      // 初期化（a[0] = 1; a[1] = 2; a[2] = 3 と同じ）
c[] = {"x": 1, "y": 2, 7}   // キー付きとキー無しの混在
n[] = {1, {2, 3}, {"k": "v"}}  // 入れ子
d = {"A", "B", "C"}[1]      // "B": どんな値にも添字を付けられる
```

- `a[]`（空の角括弧）は配列全体を表します。`a[] = b[]` はコピー（配列は代入でコピーされ、共有されません）、`a[] = b[] + c[]` は連結。`a = b[]` と `a[] = b[]` は同じ意味。`a[]` に配列以外を代入すると `a` はそのスカラーになります。
- 配列同士の比較は `==` と `!=` のみ（要素ごとに比較）。
- `length(a)` は要素数。`for (i = 0; i < length(a); i++)` で走査します。キー付き要素もインデックスでアクセスでき、`getKey(a, i)` で要素 `i` のキー（無ければ `""`）を取得、`setKey(a, i, "name")` で設定できます。
- 存在しないインデックスやキーは読み出しでも作られます（値 `0`）。`a[100]` を読むと配列は 101 要素に拡張されます。
- 初期化子のキーは式でも構いません: `{name: 1}` は変数 `name` の値をキーにします。
- 初期化子の中に裸の変数を書くと、**変数名がキーになって**格納されます: `x = 1; y = 2` の後の `a[] = {x, y}` は `{"x": 1, "y": 2}` です。キー無しで格納するには式にします（`{x + 0, "" + s}`）か、インデックスで代入します（`a[0] = x`）。
- 文字列は配列ではありません。文字列に `s[1]` を使うと `s` は 0 の配列に変わってしまいます。`array(s)`（1 文字ずつの配列）、`code(s, i)`、文字列ライブラリを使ってください。

### 3.6 演算子

優先順位（高い順。PG0 はこの一部）:

| 順位 | 演算子 |
|---|---|
| 1 | `()` `[]` 関数呼び出し |
| 2 | `!` `~` `+a` `-a` `++` `--`（単項） |
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
| 13 | `:`（配列初期化のキー） |
| 14 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` `<<<=` `>>>=` |
| 15 | `,` |

- 算術: `+ - * / %`。実数の `%` は小数部を保ちます（`5.5 % 2` は `1.5`）。0 除算は実行時エラー。
- 単項: `+a`、`-a`、`!a`（`a` が偽なら 1、それ以外 0）、`~a` ビット反転、`++a`/`--a`（前置）、`a++`/`a--`（後置。文の終了時に反映: `b = a++` の後、`b` は元の値で `a` は 1 増える）。
- ビット演算（32bit）: `& | ^`、`<<` `>>`（算術）、`<<<` `>>>`（論理）。
- 比較: `== != < > <= >=` は `1`/`0` を返します。文字列と数値の比較は数値を文字列に変換します（`"10" == 10` は `1`、`"" == 0` は `0`）。
- 論理: `&&`、`||`（短絡評価）は `1`/`0` を返します。
- 代入 `=` と複合代入は文として使う演算子です。`if`、`while`、`for`（2 番目の式）の条件の中で `=` を使うと構文エラーです。

### 3.7 制御構造

```
if (a > b) {
  max = a
} else if (a == b) {   // else if は PG0.5 のみ
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

for (i = 0; i < 10; i++) {   // PG0.5。3 つの式はそれぞれ省略可。for (;;) は無限ループ
  sum += i
}

switch (x) {           // PG0.5。値は数値でも文字列でも可
case 1:
case 2:
  print("one or two")
  break                // break が無いと次の case に落ちる
case "a":
  print("a")
  break
default:
  print("other")
}
```

`break` は最も内側のループまたは switch を抜けます。`continue` は次の繰り返しへ進みます（`for` では 3 番目の式を先に実行）。どちらも PG0.5 です。

### 3.8 関数（PG0.5）

```
function add(a, b = 10) {   // b は省略可能でデフォルト 10
  return a + b
}
function fill(&arr, n) {    // & は参照渡し。& が無ければ引数（配列も）はコピーされる
  for (i = 0; i < n; i++) { arr[i] = i }
}
print(add(1))       // 11
fill(list, 3)       // list は {0, 1, 2}
```

- 定義は最上位でのみ可能（ブロックの中では不可）。呼び出しの前後どちらでも可。
- 名前の規則は変数と同じで、大文字小文字は区別しません。
- 必須引数が足りないと実行時エラー（「引数が少なすぎます」）。多い分は無視されます。
- `return` の無い関数は `0` を返します。再帰は可能です（数千段の再帰は動きます。極端に深い再帰は失敗します）。
- 引数と関数内の `var` 変数はローカル。それ以外の名前はグローバル変数を参照します。
- 標準関数と同名のユーザ関数を定義するとユーザ関数が優先されます。

### 3.9 exit と return

- `exit` はプログラムを即座に終了します。`exit 値` とすると実行結果の `result` にその値が入ります。関数の中でも使えます。
- 最上位の `return 値` もプログラムを終了し、`result` を設定します。
- プログラムが最後まで到達して終わった場合、`result` は `null` です。

### 3.10 プリプロセッサ

`#` で始まる行は実行前に処理され、どこに書いても構いません。

- `#option("pg0.5")`: この行以降を PG0.5 として動作させます。
- `#option("strict")`: すべての変数に `var` による宣言を必須にします。
- `#import("lib/math.pg0")`: ライブラリを読み込みます（4 章参照）。import すると PG0.5 として動作します。API で読み込めるのは `lib/math.pg0`、`lib/string.pg0`、`lib/io.pg0` だけです。それ以外（`lib/screen.pg0` や URL を含む）は「スクリプトまたはライブラリの読み込みに失敗しました」というエラーになります。

### 3.11 注意点チェックリスト

1. `if`、`else`、`while`、`for`、`do`、`switch`、`function` の後の波括弧は必須。
2. `print` は改行しません。`print("...\n")` とするか、`#import("lib/io.pg0")` して `println` を使います。
3. PG0 モードには `print`、`input` を含め関数が一切ありません。PG0 モードでは `exit 値` かグローバル変数（レスポンスの `variables`）で情報を返します。
4. 実数は小数点以下 16 桁で表示されます（`3.5000000000000000`）。整数値の結果は整数として表示されます。
5. 整数は 32bit で、あふれても黙ってラップします。
6. 文字列に使えるのは `+`、`==`、`!=` だけ。大小比較は実行時エラー。
7. 変数名は大文字小文字を区別。キーワードは小文字のみ。関数名は区別しない。
8. 条件の中の `=` は構文エラー。`==` を使う。
9. 未知の変数は黙って `0` として読まれます。打ち間違いはエラーになりません（デバッグ中は `#option("strict")` が有効）。
10. 文字列への `s[i]` は文字列を壊します。`array(s)`、`code(s, i)`、`substring` を使う。
11. `a[i]` の読み出しは要素を作ります。配列は読むだけでも拡張されます。
12. 配列は代入と関数の引数でコピーされます。呼び出し元の配列を変更するには `&param` を使う。
13. 1 行に複数の文を書くときは `;` で区切る。
14. `input()` は入力が尽きると `""` ではなく整数 `0` を返します。`isType(x) == 0` で判定できます。
15. 指数リテラル、ブロックコメント、波括弧なしの `else`、三項演算子、文字列の添字はありません。
16. `{}` の中で初めて代入した変数はそのブロックのローカルで、ブロックの後には残りません。合計値、結果配列、フラグなどはループや `if` の前に最上位で作っておきます（`total = 0`）。
17. 裸の変数を並べた `{x, y}` はキー `"x"`、`"y"` 付きの要素になります。ただのリストにしたいときは `{x + 0, y + 0}` と書きます。

## 4. 標準関数とライブラリ

関数名は大文字小文字を区別しません。型の表記: int、float、num（int または float）、str、arr、any。

### 4.1 常に使える関数（PG0.5）

| 関数 | 戻り値 | 説明 |
|---|---|---|
| `print(v: any)` | 0 | `v` を `output` に追加。改行なし。配列は `{1, 2, "key": 3}` の形式。 |
| `error(v: any)` | 0 | `v` と改行を `error_output` に追加。実行は続く。 |
| `input()` | str または 0 | リクエストの `input` の次の行。尽きたら整数 `0`。 |
| `isType(v: any)` | int | 0 整数、1 実数、2 文字列、3 配列。 |
| `length(v: arr\|str)` | int | 要素数または文字数（数値は文字列に変換）。 |
| `array(s: str)` | arr | `s` の 1 文字を 1 要素にした配列。 |
| `string(a: arr)` | str | 要素を区切りなしで連結した文字列。 |
| `number(s: str)` | num | `s` の先頭から 10 進の整数か実数を読み取る（`"12abc"` は 12、`"abc"` は 0）。 |
| `int(v: str\|num)` | int | 32bit 整数に変換（0 方向に切り捨て）。 |
| `code(s: str, i: int = 0)` | int | 位置 `i` の文字コード。範囲外は 0。 |
| `char(c: int)` | str | 文字コード `c` の 1 文字。 |
| `getKey(a: arr, i: int)` | str | 要素 `i` のキー（無ければ `""`）。 |
| `setKey(a: arr, i: int, key: str)` | 0 | 要素 `i` のキーを設定。 |

### 4.2 数値ライブラリ: `#import("lib/math.pg0")`

| 関数 | 説明 |
|---|---|
| `abs(n)` | 絶対値（int/float を保つ）。 |
| `atan(n)` | アークタンジェント（ラジアン）。 |
| `cos(n)`, `sin(n)`, `tan(n)` | 三角関数（ラジアン）。 |
| `exp(n)` | e の `n` 乗。 |
| `log(n)` | 自然対数。`n <= 0` はエラー。 |
| `sqrt(n)` | 平方根。負数はエラー。 |
| `pow(base, exponent)` | 累乗。 |
| `random()` | [0, 1) の実数。 |
| `sign(n)` | 1、-1、0。 |

小数部が 0 の結果は整数で返ります（`sqrt(16)` は `4`）。

### 4.3 文字列ライブラリ: `#import("lib/string.pg0")`

| 関数 | 説明 |
|---|---|
| `trim(s)` | 前後の空白とタブを除去。 |
| `to_lower(s)`, `to_upper(s)` | 大文字小文字変換。 |
| `str_match(pattern, s)` | ワイルドカード照合。`*` は任意の文字列、`?` は任意の 1 文字。大文字小文字を区別しない。1/0 を返す。 |
| `substring(s, begin, length = -1)` | 部分文字列。`begin` が負なら末尾から数える。`length` が負なら末尾まで。 |
| `in_string(s, search, from = 0)` | `search` の位置。無ければ -1。 |
| `split(s, separator)` | 文字列の配列に分割。 |

### 4.4 入出力ライブラリ: `#import("lib/io.pg0")`

| 関数 | 説明 |
|---|---|
| `println(v)` | `print` の後に改行。 |
| `saveValue(key, v)`, `loadValue(key)`, `removeValue(key)` | キー/値ストア。API では現在の実行の間だけ有効（ブラウザでは永続化）。存在しないキーの `loadValue` は `0`。 |
| `get_clipboard()`, `set_clipboard(s)` | 実行内だけのクリップボード文字列（初期値は空）。`set_clipboard` は 1 を返す。 |

### 4.5 画面描画ライブラリ: `#import("lib/screen.pg0")`（API では使用不可）

描画、キーボード、マウス、サウンド、`sleep`、`time`、`timeString` は Web ブラウザが必要です。API 経由で import するとエラーになります。これらを使うプログラムも `POST /api/agent/v1/scripts` で保存でき、人がレスポンスの `url` から Web エディタで実行できます。参考の関数名: startScreen, sleep, time, timeString, startOffscreen, endOffscreen, startMask, endMask, clearRect, drawLine, drawRect, drawCircle, drawPolyline, drawFill, drawScroll, createImage, drawImage, drawText, measureText, rgbToPoint, rgbToHex, hexToRgb, inTouch, inKey, playSound, playMusic, stopSound（詳細は `/doc/pg0.5_lib.html`）。

## 5. 例

### 5.1 入力の読み取り、連想配列、ソート

リクエスト:

```json
{
  "code": "#import(\"lib/io.pg0\")\n#import(\"lib/string.pg0\")\nscore = 0\nn = number(input())\nfor (i = 0; i < n; i++) {\n  parts = split(input(), \" \")\n  score[parts[0]] = number(parts[1])\n}\n// 値の降順に選択ソート\nfor (i = 0; i < length(score); i++) {\n  best = i\n  for (j = i + 1; j < length(score); j++) {\n    if (score[j] > score[best]) { best = j }\n  }\n  if (best != i) {\n    tmpv = score[i]; tmpk = getKey(score, i)\n    score[i] = score[best]; setKey(score, i, getKey(score, best))\n    score[best] = tmpv; setKey(score, best, tmpk)\n  }\n}\nfor (i = 0; i < length(score); i++) {\n  println(getKey(score, i) + \": \" + score[i])\n}\nexit score",
  "input": ["3", "ann 70", "bob 95", "cy 80"]
}
```

レスポンス（抜粋）: `"output": "bob: 95\ncy: 80\nann: 70\n"`、`"result": {"bob": 95, "cy": 80, "ann": 70}`。`score = 0` の行に注意してください。これが無いと `score` はループのブロック内に作られ、ループ後には消えてしまいます。

### 5.2 PG0 モード（整数のみ、関数なし）

```json
{"code": "sum = 0\ni = 1\nwhile (i <= 10) {\n  sum = sum + i\n  i = i + 1\n}\nexit sum", "mode": "PG0"}
```

レスポンス: `"status": "ok"`、`"result": 55`、`"variables": {"sum": 55, "i": 11}`。

### 5.3 実行時エラー

```json
{"code": "a = 10\nb = 0\nc = a / b", "lang": "ja"}
```

レスポンス: `"status": "error"`、`"error": {"message": "0 で除算をしました", "line": 3, "source": "c = a / b", "phase": "runtime"}`、`"variables": {"a": 10, "b": 0, "c": 0}`。

### 5.4 人に渡すためにプログラムを保存する

```http
POST /api/agent/v1/scripts
{"name": "FizzBuzz", "author": "AI agent", "password": "s3cret", "memo": "1..30 を出力",
 "code": "#import(\"lib/io.pg0\")\nfor (i = 1; i <= 30; i++) {\n  if (i % 15 == 0) { println(\"FizzBuzz\") }\n  else if (i % 3 == 0) { println(\"Fizz\") }\n  else if (i % 5 == 0) { println(\"Buzz\") }\n  else { println(i) }\n}"}
```

`201` レスポンスに `"url": "https://<host>/dev/?cid=<cid>"` が含まれるので、その URL を人に渡します。`&run=1` を付けると開いたときに自動実行されます。
