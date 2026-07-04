# tools/ — 開発・検証ツール

ビルド不要・依存ゼロ（Node標準API＋ローカルのChromeだけ）で動く回帰チェックです。
本体（`index.html`／`js/*.js`／`data/species.json`）を変更したら、コミット前にこれを通します。

## ワンコマンド検証

```bash
node tools/verify.mjs
```

静的サーバ起動 → ヘッドレスChromeで主要シナリオを開いて自動判定 → 後片付け、までを一括で行います。
終了コード `0`=全PASS / `1`=失敗あり / `2`=起動失敗。各シナリオのスクリーンショットは `tools/shots/`（git管理外）に保存されるので目視確認できます。

Chromeの場所が違う場合:

```bash
CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" node tools/verify.mjs
```

## 検証しているシナリオ（`tools/check.mjs`）

判定は **DOM・観測可能な状態だけ** に依存させています（内部のグローバル変数に依存しない）。
そのため、ES Modules化やデータ分割などの内部リファクタをしても同じチェックがそのまま通ります。

| シナリオ | URL | 主な判定 |
|---|---|---|
| 種ディープリンク | `/#lion` | MapLibre読込・地図canvas初期化・カードに「ライオン」表示 |
| 近くモード | `/#@35.681,139.767,10` | MapLibre読込・地図canvas初期化 |
| 素の起動 | `/` | MapLibre読込・地図canvas初期化・`species.json`が5000種以上 |

**致命エラー判定**: `maplibre` 参照のエラー、または `js/*.js` 由来の例外があれば FAIL。
GBIF・CARTO・OpenFreeMap・測位などの外部API失敗はヘッドレスでは起こりうるため「非致命」として判定対象外にしています。

## 個別に動かす

```bash
node tools/serve.mjs 8799     # 静的サーバだけ（http://127.0.0.1:8799/）
node tools/check.mjs          # サーバが起動済みの前提でチェックだけ
```

> このアプリは `fetch` を使うため `file://` 直開きでは動きません。必ずHTTPで配信して検証してください。
