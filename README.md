# pg0_web

## English

- [PG0 Language specification](https://pg0.jp/doc/pg0_eng.html)
- [PG0.5 Language specification](https://pg0.jp/doc/pg0.5_eng.html)
- [PG0.5 - Library Reference](https://pg0.jp/doc/pg0.5_lib_eng.html)
- [Programming with AI](https://pg0.jp/doc/pg0_api_eng.html)

## Japanese

- [「PG0」の言語仕様](https://pg0.jp/doc/pg0.html)
- [「PG0.5」の言語仕様](https://pg0.jp/doc/pg0.5.html)
- [PG0.5用ライブラリ リファレンス](https://pg0.jp/doc/pg0.5_lib.html)
- [AIでプログラミング](https://pg0.jp/doc/pg0_api.html)

## Settings

`server_settings.js` (server) and `agent_settings.js` (AI agent API) are samples. Copy them to `server_settings.local.js` / `agent_settings.local.js` and edit those; the server reads the `.local.js` file when it exists and falls back to the sample when it does not. The local file is used on its own, so keep every entry in it. Both `.local.js` files are ignored by git, so the settings are kept when the sources are replaced.

## AI agent API

The server also exposes an HTTP API (`agent_api.js`, mounted from `server.js`) that lets AI agents write, syntax-check, run and store PG0 / PG0.5 programs. Programs run in an isolated worker thread with time, step and memory limits, using the same interpreter as the web editor.

- Index: `GET /api/agent/v1`
- Manual (API usage, language specification, library reference): `GET /api/agent/v1/manual?lang=en` / `?lang=ja`
- OpenAPI: `GET /api/agent/v1/openapi.json`
- Settings: `agent_settings.local.js`, or `agent_settings.js` when it does not exist (API key, limits)

## Apps (/app/)

`/app/?cid=<cid>` runs a stored script as an app, the way `pg0gen.exe` turns a program into an executable: the page has no editor and never receives the source. `GET /api/app/<cid>` (`app_server.js`, mounted from `server.js`) answers the program compiled, that is parsed into the parse trees the interpreter runs (`pg0/script_parse.js` loaded on the server), together with the scripts it imports (`#import("cid:...")`) and the library `.pg0` files, and the names of the JavaScript libraries the page loads. "Copy app URL" in the editor's online list copies this URL, and the editor's old autorun link (`/dev/?cid=<cid>&run=1`) goes here.

- A program without a screen shows a console with the start and end of the run, the output and the result, as the editor does. A program that imports `lib/screen.pg0` shows the screen only while it runs: no close or minimize button, just the speaker at the right edge. When it ends, or stops with an error, the screen goes and the console takes its place, so that the output and the error can be read and copied. The page is sent by the server with the name of the script as its title (and in the `og:` tags), so that a link shared on a social site shows the name. It runs without waiting between statements (the `speed` of the script is for the editor).
- The program's hash (SHA-256 of the code as saved) comes with the compiled program, so `lib/net.pg0` enters rooms as the saved program (the app has no source to hash).
- The names of the variables and of the functions the program declares are made short (`a`, `b`, ... and `_a`, `_b`, ...), as `pg0gen.exe` does for an executable: the compiled program is smaller, and reads like nothing. A variable named inside a `{...}` that makes an array keeps its name, since the name becomes the key of the element (`{x, y}` is `{"x": ..., "y": ...}`). The editor and the Windows version keep every name: they show them while debugging.
- Compiled programs are cached in the MongoDB collection `app_cache` (one document per cid, no expiry) and compiled again when the script was saved, a script it imports was saved, or the compiler changed (`app_server.js`, the parser, the library `.pg0` files). A program that does not compile is cached too, with its errors. Opening an app counts as a view of the script, as opening it in the editor does.
- `/app/` and `/app/index.html` are sent by the Node server (`app/index.html` is the template; the page's script and style are static files under `public/app/`), and the page loads the libraries from `/dev/lib/`. A web server in front that serves `public/` itself has to pass `/app/` and `/app/index.html` to Node, as it does `/api/`.

## Private scripts

A private script (`private: 1`) shows its code only with its edit password: `GET /api/script/item/<cid>`, `GET /api/script/item/<cid>/<time>` and `GET /api/script/import/<cid>` answer 401 unless `?password=<crc32>` carries the password as the editor saves it (`pg0_string.crc32`). The editor asks for the password when it opens such a script (after trying the one it remembers from saving), as the Windows version does. The AI agent API takes the password itself (`GET /api/agent/v1/scripts/<cid>?password=...`). Apps (`/app/`) and executables run a private program without the password.

A private script can be imported (`#import("cid:...")`) only by a private program with the same edit password; a public program cannot import it, and to it the script does not exist. The editor sends the password of the program it runs (the one it opened or saved it with), the Windows version passes it to the program and to `pg0gen.exe` as `PG0_PASSWORD`, the app compiler compares the two stored scripts, and the AI agent API compares the `private` and `password` of the request (or of the stored script it runs) with the part's.

## Online play (lib/net.pg0)

Programs that import `lib/net.pg0` (in the web editor and the Windows version) can send each other values when they are copies of the same program saved online (the same cid), for games played online. The server relays them over a WebSocket at `/api/net` (`net_server.js`, on both the https and the http port) and stores nothing. It needs the `ws` package: run `npm install` after updating.

- Players meet in rooms of a cid: by a room name, or in a room that is not full yet when the name is left out. Joining checks that a stored script has the cid and that the program is the one saved under it: the join carries a hash of the code, and a program that differs from the saved one is refused (`modified`) until it is saved, and everybody in a room runs the same program (`version`).
- `netRooms()` lists the rooms of the cid (name, players, size, closed; up to 500, oldest first) for a lobby where players pick a room. It asks over the same connection, in a room or out of one, and counts against the same rate as sending.
- Only pages of this site (and the origins in `allowOrigins`, or in `net.allowOrigins` for the relay only) can connect. The admin pages (pg0_web_admin) join the rooms of this site: add their origin, such as `https://pg0.jp:9443`, to `net.allowOrigins`.
- A web player whose connection goes (a phone that switched to another app) keeps its seat for `rejoinSeconds` (60) and takes it again with the messages sent meanwhile when it comes back; the others are not told until then. A player that ends the program leaves at once.
- Limits are in `exports.net` of the settings (largest room, size and number of messages a second, connections per address, idle time, what a player may leave unread, `rejoinSeconds`, and `relayPerSecond`: messages passed on in a second over all rooms, since the relay shares its process with the site and a full room of 8 costs 7 deliveries a message). Joining and listing rooms count against the same rate as messages; a connection that keeps naming scripts that do not exist (20 times) is closed. Without `exports.net` the defaults of `net_server.js` apply; `enabled: false` turns the relay off.
- The client address (for the log and the connections per address) comes from `X-Forwarded-For` when the connection is from a proxy on this machine (`trustProxy: 'loopback'`, the default; `true` trusts it from any connection, for a proxy on another machine; `false` never). The proxy has to send it, e.g. for nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. When it does not, every player has the proxy's address (127.0.0.1): the log says `no_client_address` once and that address has no limit of its own (only `maxConnections` applies).
- Runs through the AI agent API have no network: `netJoin` and `netRooms` return 0 there.
- Log (the server log, one line each, starting with `net`; the values sent are never written): `connect` / `disconnect` (address, origin, seconds, messages sent, drops, reason: close / idle / no_response / slow (did not read what was sent) / cid (kept naming scripts that do not exist)), `join` / `leave` / `close` / `room_end` (cid, room, player number, players / size; a leave with reason gone is a seat that was not taken again in time), `away` / `back` (a seat kept while the connection is gone, and taken again), `refused` (403 origin, 429 connection limits, 404 path), `no_client_address` (once: a proxy on this machine sent no client address) and `join_refused` (cid, modified, version, full, closed, busy, rate), `drop` (the first message of a connection dropped for size, rate or load (the relay as a whole), or not sent to it because it does not read: slow), and a `stats` summary every `statsSeconds` (connections, rooms, players, and connects, joins, room lists, messages, bytes, drops and refusals since the last summary; none while nothing goes on). `refused` and `join_refused` lines are written ten a second at most; the rest are counted (`unlogged`, with the summary). `net.log: false` turns the event lines off, `statsSeconds: 0` the summary.

## 設定

`server_settings.js`（サーバ）と `agent_settings.js`（AIエージェント用API）はサンプルです。それぞれ `server_settings.local.js` / `agent_settings.local.js` にコピーして編集してください。`.local.js` があればそちらを、無ければサンプルを読み込みます。`.local.js` だけを読むので、項目はすべて残したまま値を変更してください。`.local.js` は git の管理対象外なので、ソースを置き換えても設定は残ります。

## AIエージェント用API

サーバには、AIエージェントが PG0 / PG0.5 のプログラムを作成・構文チェック・実行・保存するための HTTP API（`agent_api.js`、`server.js` からマウント）があります。プログラムは Web エディタと同じインタプリタを使い、時間・ステップ数・メモリの制限付きで独立した Worker スレッド内で実行されます。

- インデックス: `GET /api/agent/v1`
- マニュアル（API の使い方、言語仕様、ライブラリリファレンス）: `GET /api/agent/v1/manual?lang=ja` / `?lang=en`
- OpenAPI: `GET /api/agent/v1/openapi.json`
- 設定: `agent_settings.local.js`、無い場合は `agent_settings.js`（API キー、制限値）

## アプリ（/app/）

`/app/?cid=<cid>` は、保存されたスクリプトをアプリとして実行します。`pg0gen.exe` でプログラムを実行ファイルにするのと同じ考え方で、ページにはエディタが無く、ソースは渡しません。`GET /api/app/<cid>`（`app_server.js`、`server.js` からマウント）が、コンパイル済みのプログラム、つまりインタプリタが実行する構文木（サーバー側で `pg0/script_parse.js` を動かして変換したもの）を、取り込んだスクリプト（`#import("cid:...")`）とライブラリの `.pg0` の分も含めて、ページが読み込む JavaScript ライブラリの名前と一緒に返します。エディタのオンライン一覧の「アプリURLをコピー」はこの URL をコピーし、以前の自動実行の URL（`/dev/?cid=<cid>&run=1`）はここに転送されます。

- 画面の無いプログラムは、エディタと同じように開始と終了、出力、実行結果をコンソールに表示します。`lib/screen.pg0` を取り込んだプログラムは実行中は画面だけを表示し、閉じるボタンや小さくするボタンは出さず、右端にスピーカーのアイコンだけを置きます。終了したとき、またはエラーで止まったときは画面を消してコンソールに切り替え、出力とエラーを読んだりコピーしたりできるようにします。ページはサーバーがスクリプトの名前をタイトル（と `og:` タグ）に入れて返すので、SNS でシェアしたリンクにプログラムの名前が出ます。文ごとの待ちは入れずに実行します（スクリプトの `speed` はエディタ用です）。
- プログラムのハッシュ（保存されたコードの SHA-256）をコンパイル済みのプログラムと一緒に渡すので、`lib/net.pg0` は保存されたプログラムとして部屋に入れます（アプリにはハッシュを取るソースがありません）。
- プログラムが宣言する変数名と関数名は、`pg0gen.exe` が実行ファイルにするときと同じく短い名前（`a`、`b`、... と `_a`、`_b`、...）に置き換えます。コンパイル済みのプログラムが小さくなり、読んでも分からなくなります。配列を作る `{...}` の中に書かれた変数は、その名前が要素のキーになる（`{x, y}` は `{"x": ..., "y": ...}`）ので名前を残します。エディタと Windows 版はデバッグで名前を見せるので置き換えません。
- コンパイル済みのプログラムは MongoDB のコレクション `app_cache` に入れます（cid ごとに 1 件、有効期限なし）。スクリプトが保存されたとき、取り込んでいるスクリプトが保存されたとき、コンパイラ（`app_server.js`、パーサー、ライブラリの `.pg0`）が変わったときに作り直します。コンパイルできないプログラムもエラーと一緒に入れます。アプリを開くと、エディタで開いたときと同じくスクリプトの閲覧数に数えます。
- `/app/` と `/app/index.html` は Node のサーバーが返します（`app/index.html` がテンプレート。ページのスクリプトとスタイルは `public/app/` の静的ファイル）。ライブラリは `/dev/lib/` から読みます。前段の Web サーバーが `public/` を直接返している場合は、`/api/` と同じように `/app/` と `/app/index.html` を Node に通してください。

## 非公開のスクリプト

非公開のスクリプト（`private: 1`）は編集パスワード無しではコードを見られません。`GET /api/script/item/<cid>`、`GET /api/script/item/<cid>/<time>`、`GET /api/script/import/<cid>` は、エディタが保存するのと同じ形（`pg0_string.crc32`）のパスワードを `?password=<crc32>` に付けないと 401 を返します。エディタはそのスクリプトを開くときに（保存で覚えているパスワードを試してから）パスワードを尋ねます。Windows 版も同じです。AI エージェント用 API はパスワードそのものを受け取ります（`GET /api/agent/v1/scripts/<cid>?password=...`）。アプリ（`/app/`）と実行ファイルはパスワード無しで非公開のプログラムを動かせます。

非公開のスクリプトを取り込める（`#import("cid:...")`）のは、同じ編集パスワードの非公開のプログラムだけです。公開のプログラムからは取り込めず、無いものとして扱われます。エディタは実行するプログラムのパスワード（開いたとき、または保存したときのもの）を付け、Windows 版はプログラムと `pg0gen.exe` に `PG0_PASSWORD` で渡し、アプリのコンパイルは保存された二つのスクリプトを比べ、AI エージェント用 API はリクエストの `private` と `password`（または実行する保存済みスクリプトのもの）を部品のものと比べます。

## オンライン対戦（lib/net.pg0）

`lib/net.pg0` を読み込んだプログラム（Web 版と Windows 版）は、オンラインに保存した同じプログラム（同じ cid）同士で値を送り合えます（オンライン対戦用）。サーバーは WebSocket（`/api/net`、`net_server.js`。https と http の両方のポート）で中継するだけで、何も保存しません。`ws` パッケージが必要なので、更新後に `npm install` を実行してください。

- cid ごとの部屋で出会います。部屋名を指定するか、省略すると人数のそろっていない部屋に自動で入ります。入るときに、その cid の保存済みスクリプトがあるか、そしてプログラムが保存したものと同じかを確かめます（コードのハッシュを送り、保存したものと違えば `modified` で断ります。変えたら保存してから実行してください。部屋の中は全員が同じプログラムで、違えば `version` で断ります）。
- `netRooms()` はその cid の部屋の一覧（部屋名、人数、定員、締め切り。作られた順に最大 500）を返します。部屋を選んで入るロビー用です。部屋の外でも中でも同じ接続で問い合わせ、送信と同じ回数制限に数えます。
- 接続できるのはこのサイトのページ（と `allowOrigins`、または中継だけに使う `net.allowOrigins` のオリジン）だけです。管理画面（pg0_web_admin）はこのサイトの部屋に入るので、そのオリジン（例: `https://pg0.jp:9443`）を `net.allowOrigins` に加えてください。
- Web 版のプレイヤーは、接続が切れても（スマホで別のアプリに切り替えたときなど）`rejoinSeconds`（60 秒）のあいだ席が残り、戻ればその間に送られた値と一緒に同じ席に戻ります。相手にはそれまで伝わりません。プログラムを終えた人はすぐに出ます。
- 制限は設定の `exports.net` にあります（部屋の最大人数、メッセージの大きさと 1 秒あたりの回数、アドレスごとの接続数、無通信で切るまでの時間、読まずにためておける量、`rejoinSeconds`、`relayPerSecond`: 全部屋を合わせて 1 秒に中継する数。中継はサイトと同じプロセスで動き、8 人の部屋では 1 メッセージが 7 回の送信になるため）。部屋に入ることと部屋の一覧もメッセージと同じ回数の制限に数えます。存在しないスクリプトの cid を言い続ける接続（20 回）は切ります。`exports.net` が無ければ `net_server.js` の既定値を使います。`enabled: false` で中継を止めます。
- 接続元のアドレス（ログとアドレスごとの接続数に使います）は、同じマシンのプロキシからの接続なら `X-Forwarded-For` から取ります（`trustProxy: 'loopback'`、既定値。`true` はどこからの接続でも信用し、別のマシンのプロキシ用。`false` は使いません）。プロキシがこのヘッダーを送るように設定してください（nginx なら `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`）。送られないと全員がプロキシのアドレス（127.0.0.1）になります。そのときはログに `no_client_address` を 1 度だけ出し、そのアドレスには接続数の上限をかけません（`maxConnections` だけがかかります）。
- AIエージェント用 API の実行には通信がなく、`netJoin` と `netRooms` は 0 を返します。
- ログ（サーバーのログに `net` で始まる 1 行ずつ。送られた値の中身は書きません）:
  - `connect` / `disconnect`: アドレス、オリジン、つながっていた秒数、送ったメッセージ数、捨てた数、切れた理由（close / idle / no_response / slow: 送ったものを読まない / cid: 存在しないスクリプトを言い続けた）
  - `join` / `leave` / `close` / `room_end`: cid、部屋名、プレイヤー番号、人数／定員（`leave` の reason が gone は、席が残っている間に戻らなかったとき）。`away` / `back`: 接続が切れて席を残したとき、その席に戻ったとき
  - `refused`: 接続を断ったとき（403 オリジン、429 接続数の上限、404 パス）。`join_refused`: 部屋に入れなかったとき（cid、modified、version、full、closed、busy、rate）
  - `no_client_address`: 同じマシンのプロキシが接続元のアドレスを送ってこなかったとき（最初の 1 度だけ）
  - `drop`: 大きさや回数の上限で捨てたとき（size、rate、load: 中継全体の上限）、読まない相手に送らなかったとき（slow）（接続ごとに種類ごとの最初の 1 件。合計は `disconnect` に出ます）
  - `stats`: `statsSeconds` ごとの集計（接続数、部屋数、部屋にいる人数と、前回からの接続・入室・一覧の問い合わせ・メッセージ数・バイト数・捨てた数・断った数）。何も起きていなければ出しません
  - `refused` と `join_refused` は 1 秒に 10 行までで、残りは数えて集計のときに `unlogged` として出します
  - `net.log: false` で 1 件ずつのログを、`statsSeconds: 0` で集計を止めます
