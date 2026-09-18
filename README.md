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

## 設定

`server_settings.js`（サーバ）と `agent_settings.js`（AIエージェント用API）はサンプルです。それぞれ `server_settings.local.js` / `agent_settings.local.js` にコピーして編集してください。`.local.js` があればそちらを、無ければサンプルを読み込みます。`.local.js` だけを読むので、項目はすべて残したまま値を変更してください。`.local.js` は git の管理対象外なので、ソースを置き換えても設定は残ります。

## AIエージェント用API

サーバには、AIエージェントが PG0 / PG0.5 のプログラムを作成・構文チェック・実行・保存するための HTTP API（`agent_api.js`、`server.js` からマウント）があります。プログラムは Web エディタと同じインタプリタを使い、時間・ステップ数・メモリの制限付きで独立した Worker スレッド内で実行されます。

- インデックス: `GET /api/agent/v1`
- マニュアル（API の使い方、言語仕様、ライブラリリファレンス）: `GET /api/agent/v1/manual?lang=ja` / `?lang=en`
- OpenAPI: `GET /api/agent/v1/openapi.json`
- 設定: `agent_settings.local.js`、無い場合は `agent_settings.js`（API キー、制限値）
