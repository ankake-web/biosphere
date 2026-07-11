# 🐾 Faunaut — 世界いきもの分布アトラス

ブラウザで動く「世界のいきもの分布エクスプローラー」。3D地球儀を主役に、実在の観測データで生きものの分布を旅する図鑑です。動物を選べば棲む土地へ飛び、**GBIF の実観測データ**で本物の分布が浮かび上がる。土地を選べばそこの住人がわかる。実在の生きもの版・地図中心の図鑑。

**🌍 公開サイト: https://faunaut.com**

![Faunaut](https://faunaut.com/og.jpg)

> ローカルで動かすときは `node tools/serve.mjs` で HTTP 配信して開く（`fetch` ＋ ES module のため `file://` 直開きは不可）。

## できること
- 🌐 **3D地球儀**（MapLibre GL）が常に主役。自転し、ドラッグで回せる。
- 🦁 **動物を選ぶ** → 分布が地図に出て、地球が棲む土地へ飛ぶ＋詳細カードがせり出す。
- 🛰️ **GBIF 実観測データ** を地図にメッシュで重ねる（黄→赤＝目撃の濃さ）。
- 🗺️ **土地（国）をタップ** → そこへ寄り、GBIF 実データで「その国で多く記録される生きもの」を実写真つきで逆引き。
- 📍 **近くの生きもの** → 現在地（またはピン／住所検索）の周辺にいる種を、GBIF・OBIS の実観測から一覧＆地図アイコンで表示。半径・種別でしぼり込み、季節性や観測スポットもわかる。位置情報は端末内でのみ使用。
- 👀 **見た！／📔 Myずかん／🏅 クエスト** → 現実で出会った生きものを記録して集めるゲーム要素（端末内に保存）。
- 🌿 **環境（biome）でしぼる** … サバンナ／森林／熱帯雨林／草原／寒帯林／高山／乾燥地／湿地／海／極地。
- 🔍 **検索**（和名・学名・分類・環境／住所・地名でも地図移動）／ 🎲 **探検モード**（ランダムに1種へ旅）。
- 🛡️ **脅威と保全**：絶滅危惧種のカードに主な脅威と、IUCN レッドリスト9段階の解説。
- 🔗 **共有**：種ごとのディープリンク（`…/#lion`）と、写真つきシェアカード（OGP対応）。
- 📖 **静的図鑑ページ**：`zukan.html`／`species/<id>.html` で JS 無効でも全種テキストが読める（SEO・`sitemap.xml` 対応）。

図鑑カード：和名・学名・分類・**推定生息数（IUCN 保全状況の色）**・増減トレンド・ステータス・生態／人との関わり／調理法・実写真・生息地・出典（数値は推定・出典で幅あり。確証のない値は付さない）。

収録種数：**8,143種**（哺乳・鳥・爬虫・両生・魚・昆虫・無脊椎・植物・菌類）。学名→GBIF `taxonKey`・保全状況（IUCN）・分布国・写真・撮影者/ライセンスを実 API で照合し、**捏造せず**掲載。

## データ出典
- 分布：[GBIF](https://www.gbif.org/)（実観測データ／国別逆引き）・海洋は [OBIS](https://obis.org/)
- 保全状況：[IUCN レッドリスト](https://www.iucnredlist.org/)
- 写真：[Wikimedia Commons](https://commons.wikimedia.org/) ・ [iNaturalist](https://www.inaturalist.org/)（各撮影者・ライセンスを明記）
- 国境：[Natural Earth](https://www.naturalearthdata.com/)（`ADM0_A3`）
- 地図：[OpenFreeMap](https://openfreemap.org/) ・ [CARTO](https://carto.com/) ・ [Esri](https://www.esri.com/) ／ [MapLibre GL JS](https://maplibre.org/)

各写真の撮影者・ライセンスはカード内および [/about](https://faunaut.com/about.html) に表記しています。

## 技術・構成（ビルド不要）
フレームワークもバンドラも使わない静的サイト。

- `index.html` … HTML シェル＋CSS
- `js/app.js` … 単一 ES モジュール（`<script type="module">`）
- `data/species-core.json` … 一覧／地図／検索用のコアデータ（カード詳細は `data/species-detail.json` を遅延ロード）
- `vendor/` … MapLibre GL JS を同梱（CDN 非依存・同一オリジン配信）
- `data/species.json` … 種データの単一ソース。`scripts/generate.mjs` が分割データと静的 SEO ページ（`species/*.html`・`zukan.html`・`sitemap.xml` など）を生成する。

> `fetch` ＋ ES module のため **`file://` の直開きは不可**＝ HTTP 配信が前提です。

## 開発

```bash
node tools/serve.mjs      # ローカル静的サーバ（http://127.0.0.1:8799）
node tools/verify.mjs     # ヘッドレス Chrome による回帰チェック
node scripts/generate.mjs # 種データから静的ページ＋分割データを再生成
```

## クレジット
Occurrence data: **GBIF.org** ・ **OBIS** / Conservation: **IUCN Red List** / Basemap: **© OpenStreetMap, © CARTO, OpenFreeMap** / Terrain: **Esri** / Borders: **Natural Earth** / Photos: **Wikimedia Commons**（各撮影者・ライセンス明記）・ **iNaturalist** / Map library: **MapLibre GL JS**

🤖 Built with [Claude Code](https://claude.com/claude-code)

## ライセンス
コードは MIT。地図・写真・観測データは各提供元のライセンスに従います。
