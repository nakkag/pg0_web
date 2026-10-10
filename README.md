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

## Online play (lib/net.pg0)

Programs that import `lib/net.pg0` (in the web editor and the Windows version) can send each other values when they are copies of the same program saved online (the same cid), for games played online. The server relays them over a WebSocket at `/api/net` (`net_server.js`, on both the https and the http port) and stores nothing. It needs the `ws` package: run `npm install` after updating.

- Players meet in rooms of a cid: by a room name, or in a room that is not full yet when the name is left out. Joining checks that a stored script has the cid.
- Only pages of this site (and the origins in `allowOrigins`, or in `net.allowOrigins` for the relay only) can connect. The admin pages (pg0_web_admin) join the rooms of this site: add their origin, such as `https://pg0.jp:9443`, to `net.allowOrigins`.
- Limits are in `exports.net` of the settings (largest room, size and number of messages a second, connections per address, idle time). Without `exports.net` the defaults of `net_server.js` apply; `enabled: false` turns the relay off.
- The client address (for the log and the connections per address) comes from `X-Forwarded-For` when the connection is from a proxy on this machine (`trustProxy: 'loopback'`, the default; `true` trusts it from any connection, for a proxy on another machine; `false` never). The proxy has to send it, e.g. for nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. When it does not, every player has the proxy's address (127.0.0.1): the log says `no_client_address` once and that address has no limit of its own (only `maxConnections` applies).
- Runs through the AI agent API have no network: `netJoin` returns 0 there.
- Log (the server log, one line each, starting with `net`; the values sent are never written): `connect` / `disconnect` (address, origin, seconds, messages sent, drops, reason: close / idle / no_response), `join` / `leave` / `close` / `room_end` (cid, room, player number, players / size), `refused` (403 origin, 429 connection limits, 404 path), `no_client_address` (once: a proxy on this machine sent no client address) and `join_refused` (cid, full, closed, busy), `drop` (the first message of a connection dropped for size or rate), and a `stats` summary every `statsSeconds` (connections, rooms, players, and connects, joins, messages, bytes, drops and refusals since the last summary; none while nothing goes on). `net.log: false` turns the event lines off, `statsSeconds: 0` the summary.

## 設定

`server_settings.js`（サーバ）と `agent_settings.js`（AIエージェント用API）はサンプルです。それぞれ `server_settings.local.js` / `agent_settings.local.js` にコピーして編集してください。`.local.js` があればそちらを、無ければサンプルを読み込みます。`.local.js` だけを読むので、項目はすべて残したまま値を変更してください。`.local.js` は git の管理対象外なので、ソースを置き換えても設定は残ります。

## AIエージェント用API

サーバには、AIエージェントが PG0 / PG0.5 のプログラムを作成・構文チェック・実行・保存するための HTTP API（`agent_api.js`、`server.js` からマウント）があります。プログラムは Web エディタと同じインタプリタを使い、時間・ステップ数・メモリの制限付きで独立した Worker スレッド内で実行されます。

- インデックス: `GET /api/agent/v1`
- マニュアル（API の使い方、言語仕様、ライブラリリファレンス）: `GET /api/agent/v1/manual?lang=ja` / `?lang=en`
- OpenAPI: `GET /api/agent/v1/openapi.json`
- 設定: `agent_settings.local.js`、無い場合は `agent_settings.js`（API キー、制限値）

## オンライン対戦（lib/net.pg0）

`lib/net.pg0` を読み込んだプログラム（Web 版と Windows 版）は、オンラインに保存した同じプログラム（同じ cid）同士で値を送り合えます（オンライン対戦用）。サーバーは WebSocket（`/api/net`、`net_server.js`。https と http の両方のポート）で中継するだけで、何も保存しません。`ws` パッケージが必要なので、更新後に `npm install` を実行してください。

- cid ごとの部屋で出会います。部屋名を指定するか、省略すると人数のそろっていない部屋に自動で入ります。入るときに、その cid の保存済みスクリプトがあるかを確かめます。
- 接続できるのはこのサイトのページ（と `allowOrigins`、または中継だけに使う `net.allowOrigins` のオリジン）だけです。管理画面（pg0_web_admin）はこのサイトの部屋に入るので、そのオリジン（例: `https://pg0.jp:9443`）を `net.allowOrigins` に加えてください。
- 制限は設定の `exports.net` にあります（部屋の最大人数、メッセージの大きさと 1 秒あたりの回数、アドレスごとの接続数、無通信で切るまでの時間）。`exports.net` が無ければ `net_server.js` の既定値を使います。`enabled: false` で中継を止めます。
- 接続元のアドレス（ログとアドレスごとの接続数に使います）は、同じマシンのプロキシからの接続なら `X-Forwarded-For` から取ります（`trustProxy: 'loopback'`、既定値。`true` はどこからの接続でも信用し、別のマシンのプロキシ用。`false` は使いません）。プロキシがこのヘッダーを送るように設定してください（nginx なら `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`）。送られないと全員がプロキシのアドレス（127.0.0.1）になります。そのときはログに `no_client_address` を 1 度だけ出し、そのアドレスには接続数の上限をかけません（`maxConnections` だけがかかります）。
- AIエージェント用 API の実行には通信がなく、`netJoin` は 0 を返します。
- ログ（サーバーのログに `net` で始まる 1 行ずつ。送られた値の中身は書きません）:
  - `connect` / `disconnect`: アドレス、オリジン、つながっていた秒数、送ったメッセージ数、捨てた数、切れた理由（close / idle / no_response）
  - `join` / `leave` / `close` / `room_end`: cid、部屋名、プレイヤー番号、人数／定員
  - `refused`: 接続を断ったとき（403 オリジン、429 接続数の上限、404 パス）。`join_refused`: 部屋に入れなかったとき（cid、full、closed、busy）
  - `no_client_address`: 同じマシンのプロキシが接続元のアドレスを送ってこなかったとき（最初の 1 度だけ）
  - `drop`: 大きさや回数の上限で捨てたとき（接続ごとに種類ごとの最初の 1 件。合計は `disconnect` に出ます）
  - `stats`: `statsSeconds` ごとの集計（接続数、部屋数、部屋にいる人数と、前回からの接続・入室・メッセージ数・バイト数・捨てた数・断った数）。何も起きていなければ出しません
  - `net.log: false` で 1 件ずつのログを、`statsSeconds: 0` で集計を止めます
