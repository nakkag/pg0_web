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
- Runs through the AI agent API have no network: `netJoin` returns 0 there.

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
- AIエージェント用 API の実行には通信がなく、`netJoin` は 0 を返します。
