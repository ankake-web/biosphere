# 🐾 BIOSPHERE — 世界いきもの分布アトラス

地球儀を**旅する**ように、世界の生きものの分布を見るインタラクティブ地図。
動物を選べば棲む土地へ飛び、**GBIFの実観測データ（数百万件）**で本物の分布が浮かび上がる。土地を選べばそこの住人がわかる。実在動物版の、地図中心のポケモン図鑑。

> **▶ デモ：<https://ankake-web.github.io/biosphere/>**（ビルド不要 / 要ネット接続）
> ローカルで動かすときは `node tools/serve.mjs` でHTTP配信して開く（`fetch` を使うため `file://` 直開きは不可）。

![BIOSPHERE](https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg/640px-020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg)

## できること
- 🌐 **3D地球儀**（MapLibre GL）が常に主役。自転し、ドラッグで回せる。
- 📍 **近くの生き物**（視点を「世界のどこにXがいる?」→「私の近くに何がいる?」に反転）：現在地（または地図にピンを置く／都市選択）の**周辺にいる脊椎動物**を、GBIFの実観測から一覧表示（和名・写真＝iNaturalist）。**半径 1〜100km を選択**、種別（鳥/哺乳/爬虫/両生/魚）でしぼり込み。種をタップすると**観察が多い月（季節性）**と、**周辺の観測スポット（地図上のクラスタ）＝どこで見られるか**がわかる。位置情報は約1kmに丸めてGBIF/iNatの問い合わせにのみ使用（保存はローカルのみ）。
- 🦁 **動物を選ぶ** → 分布がレア度色で塗られ、地球が棲む土地へ飛ぶ＋詳細カードがせり出す。
- 🛰️ **GBIF実観測データ** を地図にメッシュで重ねる（黄→赤＝目撃の濃さ）。海の回遊や本物の分布が見える。🛰️ボタンでON/OFF。
- 🗺️ **土地（国）をタップ** → そこへ寄り、図鑑の種＋**GBIF実データで「その国で多く記録される生きもの」を実写真つきで逆引き**（iNaturalist写真／GBIFへリンク）。
- 🌿 **環境（biome）でしぼる** … サバンナ/森林/熱帯雨林/草原/寒帯林/高山/乾燥地/湿地/海/極地。
- 🔍 **検索**（和名・学名・分類・環境）／ 🎲 **探検モード**（ランダムに1種へ旅）／ 🧭 **図鑑コンプ率**（端末に保存）。
- 🔀 **並び替え・絞り込み**：生息数順／絶滅危機順／分類ごと、＋傾向（↑↓→）・保全状況・分類（哺乳/鳥/爬虫/両生/魚/昆虫/植物/無脊椎）でフィルタ。
- 🕰️ **時系列スライダー＋▶再生**：年代（〜1990s/2000s/2010s/2020s〜）でGBIF分布の変化を見る。**▶**で年代を自動でたどり、**年代別の観測数**も表示＝「昔は記録が少ない／増えてきた」が感覚的にわかる。
- 🧊 **3D立体分布（試験）**：分布の密度を立体の柱で表示（高い柱ほど観測が多い）。globeでは描画不可のため自動で平面表示に切替え、ワンタップで地球儀へ戻る。
- 🧭 **季節移動の経路**：オオカバマダラ・ザトウクジラ等の回遊・渡り種で、繁殖↔越冬の経路を矢印で表示（模式）。
- 🛡️ **おもな脅威と保全**：絶滅危惧種のカードに主な脅威と、IUCN・保全活動への導線。🛟保全状況（IUCNレッドリスト9段階）の解説モーダルも。
- 🏔️ **アトラス表示**：地形relief（Esri）＋**自然の地名**（サハラ/ヒマラヤ/セレンゲティ/アマゾン等）の「アトラス」⇄「ミニマル（暗）」をワンタップ切替（分布は常に主役）。
- 🔦 **収集ループ**：未発見はシルエット（ホバーで覗き見・クリックで発見）。環境/保全状況コンプでバッジ、全種で締め演出。自由閲覧は維持。
- 🔗 **共有**：動物ごとのリンク（`…/#lion`）で開くとその種に直行。共有ボタン／OGP対応。
- ℹ️ **出典・クレジット**：各写真の撮影者・ライセンス、生息数の出典（IUCN・GBIF）リンク、Aboutモーダル。
- 📖 **静的図鑑ページ**：`zukan.html`／`species/<id>.html` でJS無効でも全種テキストが読める（SEO・sitemap.xml対応）。
- ♿ **アクセシビリティ**：ページ/ピンチズーム許可、キーボードフォーカスリング、低モーション/通信節約時は自動回転停止。
- 図鑑カード：図鑑No.・和名・学名・分類・**推定生息数（IUCN保全状況の色）**・増減トレンド・ステータス・解説・実写真・生息地・出典。

色＝推定生息数のめやす（IUCN保全状況）：多い（LC）→ やや減少（NT）→ 少ない（VU）→ ごくわずか（EN）→ 絶滅寸前（CR）。各種に推定野生個体数＋**増減トレンド（↑増加／↓減少／→横ばい）**を表示（約／推定表記、出典で幅あり）。

## データ
- **5,348種**（哺乳・鳥・爬虫・両生・魚・昆虫・無脊椎・植物まで世界各地から）。学名→GBIFの`taxonKey`、保全状況（IUCNカテゴリ）・分布国・写真・撮影者/ライセンスはGBIF種照合API・Wikimedia Commons APIで実検証。分布はGBIF実観測から。推定生息数は出典が確認できる種で**出典年を併記**（IUCN・Partners in Flight・NOAA/IWC・BirdLife 等。捏造せず、確証のない年は付さない）。
- 動物写真：**Wikimedia Commons**（撮影者・ライセンスを各種カードに明記。読み込み失敗時は絵文字へ自動フォールバック）。
- 実観測分布：**GBIF**（学名→taxonKey を解決し、occurrence density タイルを表示。年代フィルタ対応）。
- 地形（アトラス）：**Esri World Hillshade**／国境：**Natural Earth 110m**（`ADM0_A3` で識別）。

## アーキテクチャ（差し込み口＝seam）
UIは `AnimalDataSource`（`DATA`）だけに依存。`MockDataSource` を `GbifDataSource` 等へ差し替えるだけで、地図とUIはそのまま実データへ移行できる。

```
listAnimals() / getAnimal(id) / getAnimalsByCountry(iso) / getAnimalsByBiome(biome)
const DATA = MockDataSource;   // ← ここ1行を差し替える
gbifTileURL(taxonKey, year)    // 実観測タイルのURL（実データ層の入口・年代フィルタ対応）
```

## 技術
MapLibre GL JS 5.6（globe投影・`vendor/` に同梱＝CDN非依存）/ CARTO ダークタイル / Esri 地形relief / Natural Earth / GBIF map API / iNaturalist。**ビルド不要**（バンドラ/フレームワーク不使用）。構成は「ガワ `index.html`＋単一ESモジュール `js/app.js`（`type=module`）＋種データ `data/species-core.json`＋（カード表示時に遅延ロードする）`data/species-detail.json`」。静的SEOページと分割データは `scripts/generate.mjs` で生成（本体の挙動は不変）。回帰チェックは `node tools/verify.mjs`。

## クレジット
- Occurrence data: **GBIF.org** / Conservation status: **IUCN Red List** / Basemap: **© OpenStreetMap, © CARTO** / Terrain: **Esri** / Borders: **Natural Earth** / Photos: **Wikimedia Commons**（各撮影者・ライセンス明記） / Reverse photos: **iNaturalist** / Map library: **MapLibre GL JS**
- 🤖 Built with [Claude Code](https://claude.com/claude-code)

## ライセンス
コードは MIT。地図・写真・観測データは各提供元のライセンスに従います。
