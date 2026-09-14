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

レスポンス: `{"ok": true, "mode": "PG0.5", "error": null, "warnings": [...]}` または `{"ok": false, "mode": "PG0.5", "error": {"message": "間違った書き方です", "line": 3, "source": "if a > 1 {", "phase": "parse"}, "warnings": []}`

`warnings` には、インタプリタは受け付けるが誤りの可能性が高い箇所が `{"code", "line", "name", "message"}` の形で入ります（メッセージは `lang` に従います）。静的解析による目安で、`ok` には影響しません。

- `block_local_variable`: ブロック内で初めて使った変数をそのブロックの外で読んでいる。外では別の変数になります（3.4 参照）。ブロックの前に作るのが典型的な直し方です。
- `unused_variable`: 関数やブロック内の変数に代入しているが一度も読んでいない。

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
| `seed` | number または string | なし | `lib/math.pg0` の `random()` を再現可能にします。プログラム開始前に `random(seed)` を 1 回呼ぶのと同じです（4.2 参照）。 |
| `globals` | object | `{}` | グローバル変数の初期値 `{"名前": 値}`。JSON の数値・文字列・配列・オブジェクトはそれぞれ整数/実数・文字列・配列・キー付き配列になります。前回実行の `variables` を渡せば、長いプレイを複数回の実行に分けて続けられます（4.5 参照）。 |
| `globals_at` | `"start"` または `"first_sleep"` | `"start"` | `globals` を適用する時点。最初の文より前か、プログラム自身の初期化が終わった最初の `sleep()` の時点か（スクリーンのプログラム向け。4.5 参照）。 |
| `storage` | object | `{}` | `lib/io.pg0` のキー/値ストア（`loadValue`）の初期内容 `{"キー": 値}`。最終的なストアはレスポンスの `storage` に返ります。 |
| `max_frames` | integer | 10000 | `lib/screen.pg0` を使うプログラム: `sleep()` の呼び出し（フレーム）がこの回数に達したら `status: "frame_limit"` で停止。4.5 参照。 |
| `max_virtual_ms` | integer | なし | `lib/screen.pg0` を使うプログラム: 仮想時計がこの値に達したら `status: "virtual_time_limit"` で停止。 |
| `screen` | object | `{}` | `lib/screen.pg0` を使うプログラム: `{"touch": [...], "keys": [...], "record": true, "max_calls": 2000}`。入力のタイムラインと描画呼び出しの記録。4.5 参照。 |

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
| `memo` | string | **変更履歴のメモ。** エディタと、バージョンごとの変更履歴に表示されます。作成時はプログラムの説明を、更新時は毎回その変更内容を書きます（下の「変更履歴」参照）。 |
| `private` | 0 または 1 | 1 で一覧に出なくなります（`cid` では取得可能。名前の一意性も不要）。 |
| `mode` | `"PG0.5"` または `"PG0"` | エディタと `/scripts/{cid}/run` が使うモード。 |
| `uuid` | string | 任意の所有者 ID。`GET /scripts?uuid=` で非公開分も含めて先頭に列挙されます。 |
| `speed` | 0, 1, 250, 500 のいずれか | Web エディタでの実行速度。1 文ごとの待ち時間（ミリ秒）で、0 = 待ち無し、1 = 速い、250 = 普通（デフォルト）、500 = 遅い。**`lib/screen.pg0` を使うプログラムは 0 にしてください。** 待ちがあると描画やアニメーションが極端に遅くなります。 |
| `check` | boolean | `true` にすると保存前に `code` を構文解析し、通らなければ `422 syntax_error`（詳細は `error.detail`）で保存を拒否します。指定しなければ保存時に構文チェックは行われないので、先に `/check` を実行してください。 |

レスポンス `201`: `{"cid", "name", "author", "mode", "private", "speed", "createTime", "updateTime", "url", "run_url", "memo", "code"}`。時刻は 1970-01-01 UTC からのミリ秒です。`url` は Web エディタでスクリプトを開く URL、`run_url`（`url` + `&run=1`）は開いてすぐ実行する URL で、ゲームを人に渡すときはこちらを使います。

`PUT /api/agent/v1/scripts/{cid}`: ボディは `{"password": "...", name, code, author, memo, private, mode, uuid, speed, check のうち変更したいもの}`。指定したフィールドだけ変わります。以前の内容は履歴に残ります。**更新時は必ず `memo` に変更内容を書いてください。** 省略すると前の memo が引き継がれ、履歴でバージョンの区別がつかなくなります。`401 wrong_password`, `404 not_found`, `409 name_conflict`。

`DELETE /api/agent/v1/scripts/{cid}`: ボディ `{"password": "..."}`。レスポンス `{"deleted": true, "cid": "..."}`。

`GET /api/agent/v1/scripts?q=単語&uuid=所有者&skip=0&count=30`: `{"scripts": [要約...], "skip", "count"}`。`q` の単語（空白区切り）は名前と作者に対して照合されます。

`POST /api/agent/v1/scripts/{cid}/run`: `/run` から `code` を除いたボディ。`mode` は保存時のモードがデフォルトです。

`GET /api/agent/v1/scripts/{cid}/history`: `{"history": [memo と current 付きの要約...]}`。現在のバージョンが先頭（`"current": 1`）で、その後に過去のバージョンが新しい順に並びます。`GET /api/agent/v1/scripts/{cid}/history/{updateTime}` でそのバージョンのコードを取得できます。

**変更履歴。** 保存のたびにバージョンが作られ、各バージョンは自分の `memo` を保持します。Web エディタはこの一覧を「変更履歴」として現在のバージョンを先頭に表示するので、`memo` がスクリプトの変更履歴になります。コミットメッセージのように書いてください。

- `POST /api/agent/v1/scripts` では、プログラムの内容（例: `初版: ブロック崩し、3 ステージ`）
- `PUT /api/agent/v1/scripts/{cid}` では毎回、変更内容と理由（例: `パドルが右端で画面外に出る不具合を修正。ステージごとにボール速度 +10%`）

1～2 行にまとめます。更新のたびに直前のバージョンが履歴に保存されます（履歴の最新と全く同じ内容の場合は重複して保存されません）。

```http
PUT /api/agent/v1/scripts/2f1c...
{"password": "s3cret", "code": "...", "memo": "パドルが右端で画面外に出る不具合を修正"}

GET /api/agent/v1/scripts/2f1c.../history
{"history": [
  {"cid": "2f1c...", "updateTime": 1789380000000, "memo": "パドルが右端で画面外に出る不具合を修正", "current": 1, ...},
  {"cid": "2f1c...", "updateTime": 1789379000000, "memo": "初版: ブロック崩し、3 ステージ", "current": 0, ...}
]}
```

### 2.3 実行結果

| フィールド | 意味 |
|---|---|
| `status` | `"ok"`: 正常終了。`"error"`: 構文エラーまたは実行時エラー（`error` 参照）。`"timeout"`: 時間制限。`"step_limit"`: 文数制限。`"memory_limit"`: メモリ制限。`"frame_limit"` / `"virtual_time_limit"`: スクリーンのプログラムが `max_frames` / `max_virtual_ms` で停止（無限ループのゲームでは正常な停止。`error` は `null`）。制限に達する前の出力はそのまま返ります。 |
| `mode` | 実際に使われたモード。 |
| `output` | `print()` / `println()` が書いた内容すべて（順序どおり）。`print` は改行を付けません。 |
| `output_truncated` | 出力上限で切り詰められた場合 `true`。 |
| `error_output` | `error()` が書いた内容。呼び出しごとに 1 行。`error()` はプログラムを止めません。 |
| `result` | `exit 値`（または最上位の `return 値`）の値を JSON に変換したもの。無ければ `null`。 |
| `result_type` | `"integer"`, `"float"`, `"string"`, `"array"` または `null`。 |
| `error` | `null` または `{"message", "line", "source", "phase"}`。`line` は `code` 内の 1 始まりの行番号。`phase` は `"parse"` か `"runtime"`。 |
| `variables` | グローバル変数の最終値（`{"名前": 値}`）を JSON に変換したもの。ブロックや関数のローカル変数は含みません。`print` のない PG0 モードでは値を観測する唯一の手段です。 |
| `screen` | `lib/screen.pg0` を import していなければ `null`。import していれば `{"started", "width", "height", "background", "fit", "frames", "virtual_ms", "calls", "images", "record", "record_truncated"}`。4.5 参照。 |
| `storage` | `lib/io.pg0` を import していなければ `null`。import していれば最終的なキー/値ストア `{"キー": 値}`（リクエストの `storage` で初期化）。 |
| `stats` | `steps`（実行ステップ数。おおむね文や演算子ごとに 1）、`elapsed_ms`、`input_lines_used`、`globals_applied`（`"start"`、`"first_sleep"`、`globals` を渡したのに適用されなかったときは `false`、`globals` 無しなら `null`）、スクリーンのプログラムでは `steps_per_frame: {"avg", "max"}`（4.5 の性能の目安を参照）。 |

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
- 引数と関数内の `var` 変数はローカルです。それ以外の名前は、**関数が実行される時点で同名のグローバル変数が既にあればそのグローバル**を参照し、代入するとグローバルが更新されます。同名のグローバルがまだ無ければ、その名前は関数ローカル（関数内の `if`/`for` ブロックで初めて使った場合はそのブロックのローカル）になります。関数から更新したい共有の状態は、関数を呼ぶ前に最上位で作っておいてください。
- 標準関数と同名のユーザ関数を定義するとユーザ関数が優先されます。

### 3.9 exit と return

- `exit` はプログラムを即座に終了します。`exit 値` とすると実行結果の `result` にその値が入ります。関数の中でも使えます。
- 最上位の `return 値` もプログラムを終了し、`result` を設定します。
- プログラムが最後まで到達して終わった場合、`result` は `null` です。

### 3.10 プリプロセッサ

`#` で始まる行は実行前に処理され、どこに書いても構いません。

- `#option("pg0.5")`: この行以降を PG0.5 として動作させます。
- `#option("strict")`: すべての変数に `var` による宣言を必須にします。
- `#import("lib/math.pg0")`: ライブラリを読み込みます（4 章参照）。import すると PG0.5 として動作します。API で読み込めるのは `lib/math.pg0`、`lib/string.pg0`、`lib/io.pg0`、`lib/screen.pg0`（ヘッドレス。4.5 参照）です。それ以外（他のファイル、URL）は「スクリプトまたはライブラリの読み込みに失敗しました」というエラーになります。

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
18. スクリーンのプログラムでは、ループ 1 周につき `sleep()` を 1 回呼びます（API ではフレームの区切り、ブラウザでは唯一の待ち）。角度はラジアンで、`drawText(x, y)` の (x, y) は文字の左上です。
19. 複数行の配列初期化子は各行が演算子で終わる間だけ継続するので、閉じ括弧は最後の要素と同じ行に書きます。`a[] = {1,\n 2,\n 3}` は可、`a[] = {1,\n 2\n}` は構文エラーです。
20. 関数内での代入は、同名のグローバル変数が既にあればそれを更新します。無ければ関数ローカルになり、関数内の `if`/`for` ブロックで初めて代入した変数はそのブロックのローカルになります。関数で使う作業変数は関数の先頭で `var` 宣言し、共有の状態は関数を呼ぶ前に最上位で作っておくのが安全です。
21. `m = mons[0]` は要素のコピーです。`m["hp"]` を変えても `mons[0]` は変わりません。要素を書き換えるときは `mons[0]["hp"] = ...` と書きます。
22. `int(time())` は 32bit を超えます（`time()` は 1970 年からのミリ秒）。`int(time() % 65521)` のように剰余を取ってから変換するか、実数のまま使います。

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
| `random(seed = なし)` | [0, 1) の実数。`seed`（数値または文字列）を渡すと再現可能な乱数列を最初から始めてその最初の値を返し、以降の `random()` はその列を続けます。一度もシードを与えなければ本当の乱数です。プログラムを変えずにテストを決定的にしたいときは `/run` の `seed` フィールドを使うと、開始前に同じことが行われます。 |
| `max(a, b, ...)`, `min(a, b, ...)` | 引数の最大値 / 最小値。配列を渡すとその要素が対象になります（`max({4, 2, 9})` は 9）。 |
| `sign(n)` | 1、-1、0。 |

小数部が 0 の結果は整数で返ります（`sqrt(16)` は `4`）。

ライブラリに無い関数は数行で書けます。以下は動作確認済みで、そのままプログラムに貼り付けて使えます。

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
| `saveValue(key, v)`, `loadValue(key)`, `removeValue(key)` | キー/値ストア。API では現在の実行の間だけ有効です（ブラウザでは永続化）。リクエストの `storage` で開始前に内容を入れられ（例: セーブデータがある状態で「つづきから」を試す）、最終内容はレスポンスの `storage` に返ります。存在しないキーの `loadValue` は `0`。 |
| `get_clipboard()`, `set_clipboard(s)` | 実行内だけのクリップボード文字列（初期値は空）。`set_clipboard` は 1 を返す。 |

### 4.5 画面描画ライブラリ: `#import("lib/screen.pg0")`（API ではヘッドレス）

ブラウザではこのライブラリはページを覆うキャンバスを開き、描画・キーボード・ポインタ・サウンドを提供します。API では**ヘッドレス**で動作します。関数のシグネチャは同じですが、次のように振る舞います。

- 描画・サウンド関数は何も描かず、`screen.calls` に回数だけ数えられます。`"screen": {"record": true}` を付けるとフレームごとに `screen.record` に記録されます。
- `sleep(ms)` は待ちません。**仮想時計**を `ms` だけ進め、**フレーム**を 1 つ数えます。
- `time()` は仮想時計（開始時刻 + 仮想ミリ秒）を返し、呼ぶたびに 1 ミリ秒進めます。`time()` を待つビジーループも終了します。
- `inTouch()` と `inKey()` はリクエストの `screen.touch` / `screen.keys` タイムラインから状態を返します（指定がなければ何も押されていない状態）。
- `sleep()` が `max_frames` 回（デフォルト 10000）に達すると `status: "frame_limit"`、仮想時計が `max_virtual_ms` に達すると `status: "virtual_time_limit"` で停止します。無限ループのゲームではこれが正常な停止で、`variables` と `screen` が返り、`error` は `null` です。

ヘッドレスで確認できないもの: 実際のピクセル（`rgbToPoint` は黒を返す）、正確な文字サイズ（`measureText` は概算）、実際のフレームレートと見た目。これらは `POST /api/agent/v1/scripts` に `"speed": 0` で保存し、人が `run_url` から開いて確認します。

**1 フレームあたりの性能の目安。** `stats.steps_per_frame`（`avg` と `max`）は `sleep()` から次の `sleep()` までの実行ステップ数で、`stats.steps` と同じ単位です。ブラウザでは実行速度「待ち無し」でも 1000 ステップごとにページへ制御を戻し、それに約 4ms かかるため、1 フレームには**1000 ステップあたり約 4.6ms + `sleep()` の時間 + 描画時間**が必要です。`sleep(16)` の場合、1 フレーム 1000 ステップで約 45fps、3000 ステップで約 30fps、10000 ステップで約 15fps です。300 枚のタイルを毎フレーム `drawRect` で描くと数千ステップになります。変化した部分だけ描くか、静的なレイヤーは一度 `createImage` で画像にして `drawImage` で貼ってください。

**よく使う構文のステップ数**（実測。1 ステップはおおむね実行したトークン 1 つで、変数・定数・演算子がそれぞれ約 1）:

| 構文 | ステップ数 |
|---|---|
| `for` ループ 1 周（`i < n`、`i++` を含む） | 約 11 |
| `x = x + 1`、`x += 1`、`x = a[i]`、`x = a["key"]` | 約 5 |
| `x = m[i][j]` | 約 7 |
| `x = a + b * c - d` | 約 9 |
| `if (x > 0) { }` | 約 8 |
| 引数なしの関数呼び出し `f()` | 約 4 + 本体 |
| 呼び出しの引数 1 つ、デフォルト値 1 つ | それぞれ約 1～2 追加 |
| 関数内の `var` 宣言 1 つ | 約 2 |
| `sqrt(x)` や `drawRect(...)` などのライブラリ呼び出し | 約 5 + 引数とオプション要素 1 つにつき約 1 |

ステップ数は解釈したトークン数であり、仕事量ではありません。大きな配列を引数にコピーするのはステップ数は少なくても実時間がかかるので、大きな配列は `&` で渡してください。関数呼び出し自体は軽く、コストは中の文の分です。物理計算のループで小さな補助関数を毎フレーム何千回も呼ぶのは避け、式を直接書いてください。`sleep()` を挟まない長い処理（例: 迷路生成で 70,000 ステップ）はブラウザでも問題ありません。インタプリタは 1000 ステップごとにブラウザへ制御を戻すのでページは固まらず、処理の前に描いた「Loading」などの文字は表示されます。約 200,000 ステップで 1 秒なので、一度きりの処理は数秒以内に収めるか、複数フレームに分けてください。API ではこの処理も `timeout_ms` と `max_steps` に数えられます。


**リクエストのフィールド**（`POST /api/agent/v1/run` と `/scripts/{cid}/run`）:

| フィールド | 意味 |
|---|---|
| `max_frames` | `sleep()` の呼び出し回数がこの値に達したら停止。デフォルト 10000。サーバの上限は `GET /api/agent/v1` に載っています。 |
| `max_virtual_ms` | 仮想時計がこのミリ秒に達したら停止。デフォルトは無制限。 |
| `screen.touch` | ポインタのタイムライン: `[{"ms": 500, "x": 330, "y": 300, "touch": 1, "button": 0}, {"ms": 700, "x": 330, "y": 300, "touch": 0}]`。各要素はその仮想時刻から次の要素までの状態。`touch` の既定は 1、`button` の既定は 0。 |
| `screen.keys` | キーボードのタイムライン: `[{"ms": 100, "keys": ["ArrowLeft"]}, {"ms": 400, "keys": []}]`。各要素はその仮想時刻以降に押されているキーの一覧。`[]` で全て離します。簡易表記: `{"ms": 500, "tap": "Enter"}` はちょうど 1 フレームだけ押す、`{"ms": 500, "hold": "ArrowDown", "frames": 8}` は 8 フレーム押し続ける（`tap`/`hold` は文字列またはキーの配列）。どの要素も `"ms"` の代わりに `"frame": n`（0 始まりのフレーム番号）で指定できます。tap/hold は開始時刻が `ms` 以上になる最初のフレームから始まり、`keys` で押されているキーに加算されます。 |
| `screen.record` | `true` で描画呼び出しを返します。 |
| `screen.max_calls` | 記録する呼び出しの上限（デフォルト 2000）。超えると `record_truncated` が `true` になります。`calls` は数え続けます。 |
| `screen.record_frames` | `{"from": 300, "to": 320}` でそのフレーム範囲（両端含む）だけを記録します。後半の場面を安く取れます。 |
| `screen.record_functions` | `["drawText", "drawImage"]` でその関数だけを記録します（大文字小文字を区別しない）。 |
| `screen.record_image_frames` | `true` にすると、`createImage` を呼んだフレームは `record_frames` の範囲外でも、また `record_functions` に関係なく、そのフレームの先頭からの全呼び出しを記録します。部分的な記録を再生するときに画像を再現できます。 |

タッチの要素も簡易表記 `{"ms": 500, "tap": {"x": 330, "y": 300}}`（1 フレームだけタッチ。`"frames": n` で複数フレーム）と `"ms"` の代わりの `"frame"` を使えます。要素の順序は問いません。各時点では最後に到達した状態要素が有効になり、tap/hold はそれぞれの時刻で評価されます。各要素は `ms` か `frame` のどちらか一方を必ず持ち、タッチは数値の `x`/`y`、キーは `keys`、`tap`、`hold` のいずれかが必要です。満たさない場合は `400 invalid_request` で該当要素を示して拒否します（例: `"screen.keys[2]" needs exactly one of "ms" ... or "frame" ...`）。

**レスポンスの `screen`**（ライブラリを import した場合に存在）:

```json
{"started": true, "width": 320, "height": 240, "background": "#000000", "fit": 1,
 "frames": 100, "virtual_ms": 1600, "calls": 401, "images": 0,
 "record": [{"frame": 0, "ms": 0, "calls": [{"fn": "startScreen", "args": [320, 240, {"color": "#000000"}]},
                                            {"fn": "drawCircle", "args": [20, 20, 10, {"color": "#ffcc00", "fill": 1}]}]},
            {"frame": 1, "ms": 16, "calls": []}],
 "record_truncated": false}
```

`record` は要求しない限り `null` です。フレームは `sleep()` から次の `sleep()` までの区間で、`frame` はその番号、`ms` は区間開始時の仮想時計です。

**座標系と単位**: 原点は画面の左上、x は右、y は下向きで、単位は `startScreen(width, height)` のピクセルです。`"fit": 1`（既定）ではブラウザが画面をウィンドウに合わせて拡大縮小しますが、`inTouch()` を含むすべての座標は画面ピクセルのままです。角度は**ラジアン**で、x 軸の正方向から時計回りです。色は CSS の色文字列で、`"#rgb"`、`"#rrggbb"`、`"#rrggbbaa"`、`"rgb(255, 0, 0)"`、`"rgba(255, 0, 0, 0.5)"`、`"hsl(120, 100%, 50%)"`、`"red"` のような色名がすべて描画（`drawLine`、`drawRect`、`drawCircle`、`drawPolyline`、`drawText`、`startScreen`）で使えます。例外は `drawFill` と `hexToRgb` で、`"#rrggbb"` か `"#rgb"` だけを受け付けます。`rgbToHex` は `"#rrggbb"` を返します。描画色の既定は黒 `"#000"` です。

**関数**

| 関数 | 説明 |
|---|---|
| `startScreen(width, height, option = {})` | 画面を開く。`option`: `{"color": 背景色, "fit": 1}`。最初に 1 回呼ぶ。 |
| `sleep(ms)` | ブラウザ: 待つ。ヘッドレス: 仮想時計を進めてフレームを終える。ゲームループ 1 周に 1 回。 |
| `time()` | 1970-01-01 UTC からのミリ秒（実数）。ヘッドレスでは仮想。 |
| `timeString(ms, format = "")` | 時刻の書式化。`YYYY MM DD hh mm ss`（ゼロ埋め）または `M D h m s`。`format` 省略時はロケールの日時。 |
| `startOffscreen()` / `endOffscreen()` | ダブルバッファ。バッファに描いてから表示する。ちらつき防止のため各フレームの描画を挟む。 |
| `startMask(option = {})` / `endMask()` | マスクモード。描いた領域だけが残る。`{"destination": "out"}` で描いた領域が透明になる。 |
| `clearRect(x, y, width, height)` | 矩形を透明にする（背景色が見える）。 |
| `drawLine(x1, y1, x2, y2, option = {})` | `option`: `{"width": 1, "color": "#000"}`。 |
| `drawRect(x, y, width, height, option = {})` | 左上が (x, y)。`option`: `{"width": 1, "color": "#000", "fill": 0}`。`fill` 1 で塗りつぶし、0 で枠線。 |
| `drawCircle(x, y, radiusX, option = {})` | 中心 (x, y)。`option`: `{"radius_y": radiusX, "rotation": 0, "start": 0, "end": 6.2832, "color": "#000", "width": 1, "fill": 0, "close": 0}`。`start`/`end`（ラジアン）で円弧。`close` 1 で枠線描画時に弧の両端を結ぶ。 |
| `drawPolyline(points, option = {})` | `points` は `{{x, y}, {x, y}, ...}`。`option`: `{"width": 1, "color": "#000", "fill": 0, "close": 0}`。 |
| `drawFill(x, y, color)` | (x, y) からの塗りつぶし。ヘッドレスでは記録のみ。 |
| `drawScroll(dx, dy)` | 画面をスクロール。はみ出た部分は反対側に出る。 |
| `createImage(x, y, width, height, option = {})` | 領域を画像にして ID（0, 1, 2, ...）を返す。`{"id": n}` で画像 n を置き換える。取り込み元はそのときの描画先で、`startOffscreen()`～`endOffscreen()` の間はオフスクリーンバッファ、それ以外は表示中の画面。取り込めるのは画面の範囲内のピクセルだけで、画面の外にはみ出した部分は透明になり、一度も描いていない部分も透明（背景色はピクセルに含まれない）。したがって 1 枚の画像に画面 1 面分より多くの内容は入らない。画面より大きい迷路は配列にデータを持って毎フレーム見える部分だけを描くか、画面サイズのタイルを複数枚作る。画像は現在の実行の間だけ存在し、`globals`/`storage` による継続実行には引き継がれない（下記参照）。 |
| `drawImage(id, x, y, option = {})` | 画像を左上 (x, y) に描く。`option`: `{"width", "height"}`（両方か無指定）、`"angle"` はラジアンで**時計回り**（y が下向きなので、正の角度で画像の上辺が右に傾く）、回転の基準は**画像の中心**。`"alpha"` 0.0～1.0。未知の ID は無視。別の点 P を中心に回すには、画像の中心を P の周りで回してから新しい中心に描く: `cx = x + w/2 - px`、`cy = y + h/2 - py` として、新しい左上は `(px + cx*cos(a) - cy*sin(a) - w/2, py + cx*sin(a) + cy*cos(a) - h/2)`、`angle` は同じ `a`。 |
| `drawText(text, x, y, option = {})` | **(x, y) は文字の左上**。ベースラインは y + fontsize。`option`: `{"color": "#000", "fontsize": 30, "fontface": "sans-serif", "fontstyle": "normal"/"bold"/"italic"/"oblique", "fill": 1, "width": 1}`。`fill` 0 で中抜き。数値や配列は文字列に変換される。 |
| `measureText(text, option = {})` | `{"width": w, "height": h}`（ピクセル）。`option`: `{"fontsize", "fontface", "fontstyle"}`。ヘッドレスでは ASCII 1 文字 0.55 × fontsize、それ以外 1 × fontsize、高さ = fontsize の概算。 |
| `rgbToPoint(x, y)` | ピクセルの色 `{"r", "g", "b"}`（0～255）。ヘッドレスでは常に黒。 |
| `rgbToHex(rgb)` / `hexToRgb(hex)` | `{"r", "g", "b"}` と `"#rrggbb"` の相互変換。 |
| `inTouch()` | `{"x", "y", "touch": 0/1, "button": 0 左/1 中/2 右, "pos": {{x, y}, ...}}`。`touch` が 0 のとき `x`/`y` は最後の位置。`pos` は全タッチ点（マルチタッチ）。 |
| `inKey(key = なし)` | 引数なし: 押されているキー名の配列（JavaScript の `KeyboardEvent.key`: `"ArrowLeft"`, `"a"`, `" "`, `"Enter"`）。文字列: 押されていれば 1（大文字小文字を区別しない）。配列: 全て押されていれば 1。配列内の名前は小文字で書く（`{"arrowleft", "a"}`）。ブラウザでは最後の `keydown` イベントから 1 秒後に一覧が空になるが、押し続けたキーは OS のキーリピートで `keydown` が繰り返し発生する（一般に約 250～500ms の初期遅延の後、30～50ms 間隔）ためタイマーがその都度リセットされ、通常のキーを押し続けている間は一覧に残る。実用上は問題ない。Shift、Ctrl、Alt などの修飾キーはリピートしないため 1 秒後に離した扱いになる。毎フレーム読んで「今押されているキー」として扱う。 |
| `playSound(note, start, duration, volume = 1)` | 矩形波。`note`: 周波数（Hz）か `"C4"`、`"F#5"` のような音名。`start`: 開始までの遅延（ミリ秒）、`duration`: 長さ（ミリ秒）。 |
| `playMusic(notes, option = {})` | `{{note, length_ms, volume?}, ...}` を順に再生。`{"start": ms}` で位置を戻す（和音）、`{"volume": v}` で以降の音量。`option`: `{"repeat": 1}`。再度呼んでも再生中の音は止まらず、重なって鳴ります。 |
| `bgm(notes = なし, option = {"repeat": 1})` | BGM トラック。前の `bgm`（だけ）を止めてから `notes` をループ再生します（`{"repeat": 0}` で 1 回）。引数なしの `bgm()` は BGM を止めます。`playSound`/`playMusic` の効果音は鳴り続けます。 |
| `stopSound()` | `bgm` を含む全てのサウンドを停止。 |

サウンドの補足: すべて矩形波でミックスされるので、`playSound` の効果音は `playMusic`/`bgm` に重ねて鳴ります。ブラウザはページで最初のタップまたはキー入力があるまで音声をブロックするため、それより前に開始した音は鳴らないか遅れて始まることがあります。曲はタイトル画面で最初の入力があった後に開始してください。画面のミュートボタンが押されている間は鳴りません。

**長いプレイを複数回の実行に分ける。** 1 回の実行は実時間で `max_timeout_ms` までです。長いセッションを試すには、`max_frames` で実行してレスポンスの `variables` と `storage` を読み、次のリクエストの `globals` と `storage` に渡します。うまく続くかどうかは次の 2 点で決まります。

- **globals をいつ適用するか。** 既定の `globals_at: "start"` では最初の文より前に値が入るため、プログラム先頭の `state = 0` のような初期化で上書きされ、`var state` の宣言は「変数の宣言が重複しています」で失敗します。スクリーンのプログラムでは `"globals_at": "first_sleep"` を使ってください。プログラムは普通に開始して初期化（`createImage` も含むので画像も作り直される）を実行し、**最初の `sleep()` の時点**で渡した値がその名前の変数の現在値を置き換えます。それ以降は復元した状態から続きます。ゲームループのカウンタも復元されるので、続けたい状態だけを渡し、不要な変数は除いてください。`stats.globals_applied` で適用の有無と時点が分かります（`"start"`、`"first_sleep"`、プログラムが一度も `sleep()` を呼ばなければ `false`）。
- **`sleep()` の無いプログラム**（スクリーン無し）では `globals_at: "start"` しか使えません。その場合は、状態と一緒に渡すフラグで初期化を囲み、各状態変数を最上位で `名前 = 名前`（既存の値を読む。無ければ `0` で作る）として作っておくと、`if` ブロック内の代入がグローバルを更新します。

```
resumed = resumed          // 新規実行では 0、globals で渡せば 1
state = state; score = score; maze = maze
if (!resumed) {
  state = 0; score = 0
  maze[] = generateMaze()
}
```

引き継がれるのは変数とキー/値ストアだけで、`createImage` で作った画像は引き継がれません（変数に入れた画像 ID は次の実行では何も指さず、その ID での `drawImage` は無視されます）。これも `globals_at: "first_sleep"` で初期化を実行させる理由の一つです。

**ヘッドレスでもブラウザでも動くゲームループの雛形**

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

シナリオを付けて実行します。

```json
{"code": "...上のプログラム...",
 "max_frames": 300,
 "screen": {"touch": [{"ms": 500, "x": 50, "y": 60}, {"ms": 600, "x": 50, "y": 60, "touch": 0}],
            "keys": [{"ms": 1000, "keys": ["ArrowRight"]}, {"ms": 1500, "keys": []}],
            "record": true, "max_calls": 50}}
```

期待される結果: `status` は `"frame_limit"`、`screen.frames` は 300、`variables.score` は 6（ポインタは仮想時刻 500～599 ミリ秒の間押されており、512, 528, ..., 592 ミリ秒から始まるフレームがそれを見る）、`variables.x` は 50 + 4 × 31 = 174（ArrowRight は 1000～1499 ミリ秒の間押されており、1008～1488 ミリ秒から始まる 31 フレーム分）、`screen.record` には最初の 50 呼び出しが座標付きで入ります。

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
{"name": "FizzBuzz", "author": "AI agent", "password": "s3cret", "memo": "1..30 を出力", "speed": 250,
 "code": "#import(\"lib/io.pg0\")\nfor (i = 1; i <= 30; i++) {\n  if (i % 15 == 0) { println(\"FizzBuzz\") }\n  else if (i % 3 == 0) { println(\"Fizz\") }\n  else if (i % 5 == 0) { println(\"Buzz\") }\n  else { println(i) }\n}"}
```

`201` レスポンスに `"url": "https://<host>/dev/?cid=<cid>"` が含まれるので、その URL を人に渡します。`&run=1` を付けると開いたときに自動実行されます。

### 5.5 スクリーンのプログラムをテストして保存する

下の跳ねるボールのプログラムは `lib/screen.pg0` を import しています。`/run` ではヘッドレスで実行され（4.5 参照）、`max_frames` で無限ループを止め、`variables` でボールの最終位置が分かります。

```json
{"code": "#import(\"lib/screen.pg0\")\nstartScreen(320, 240, {\"color\": \"#000000\"})\nx = 20; y = 20; dx = 3; dy = 2\nwhile (1) {\n  startOffscreen()\n  drawRect(0, 0, 320, 240, {\"color\": \"#000000\", \"fill\": 1})\n  drawCircle(x, y, 10, {\"color\": \"#ffcc00\", \"fill\": 1})\n  endOffscreen()\n  x += dx; y += dy\n  if (x < 10 || x > 310) { dx = -dx }\n  if (y < 10 || y > 230) { dy = -dy }\n  sleep(16)\n}",
 "max_frames": 100, "screen": {"record": true, "max_calls": 10}}
```

レスポンス（抜粋）: `"status": "frame_limit"`、`"variables": {"x": 302, "y": 220, "dx": -3, "dy": 2}`、`"screen": {"frames": 100, "virtual_ms": 1600, "calls": 401, "record": [...], "record_truncated": true}`。

人に渡すときは `"speed": 0` で保存します。

```http
POST /api/agent/v1/scripts
{"name": "跳ねるボール", "author": "AI agent", "password": "s3cret", "speed": 0, "code": "...同じコード..."}
```
