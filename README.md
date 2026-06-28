# 🐾 BIOSPHERE — 世界いきもの分布アトラス

地球儀を**旅する**ように、世界の生きものの分布を見るインタラクティブ地図。
動物を選べば棲む土地へ飛び、**GBIFの実観測データ（数百万件）**で本物の分布が浮かび上がる。土地を選べばそこの住人がわかる。実在動物版の、地図中心のポケモン図鑑。

> **▶ デモ：`index.html` をブラウザで開くだけ**（ビルド不要 / 要ネット接続）

![BIOSPHERE](https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg/640px-020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg)

## できること
- 🌐 **3D地球儀**（MapLibre GL）が常に主役。自転し、ドラッグで回せる。
- 🦁 **動物を選ぶ** → 分布がレア度色で塗られ、地球が棲む土地へ飛ぶ＋詳細カードがせり出す。
- 🛰️ **GBIF実観測データ** を地図にメッシュで重ねる（黄→赤＝目撃の濃さ）。海の回遊や本物の分布が見える。🛰️ボタンでON/OFF。
- 🗺️ **土地（国）をタップ** → そこへ寄り、図鑑の種＋**GBIF実データで「その国で多く記録される生きもの」を実写真つきで逆引き**（iNaturalist写真／GBIFへリンク）。
- 🌿 **環境（biome）でしぼる** … サバンナ/森林/熱帯雨林/草原/寒帯林/高山/乾燥地/湿地/海/極地。
- 🔍 **検索**（和名・学名・分類・環境）／ 🎲 **探検モード**（ランダムに1種へ旅）／ 🧭 **図鑑コンプ率**（端末に保存）。
- 🔗 **共有**：動物ごとのリンク（`…/#lion`）で開くとその種に直行。共有ボタン／OGP対応。
- 図鑑カード：図鑑No.・和名・学名・分類・**推定生息数（IUCN保全状況の色）**・ステータス・解説・実写真・生息地。

色＝推定生息数のめやす（IUCN保全状況）：多い（LC）→ やや減少（NT）→ 少ない（VU）→ ごくわずか（EN）→ 絶滅寸前（CR）。各種に推定野生個体数＋**増減トレンド（↑増加／↓減少／→横ばい）**を表示（約／推定表記、出典で幅あり）。

## データ
- サンプル **82種**（実在のおおよそ正しい分布・ステータス。分布国はGBIF実観測から導出）。
- 動物写真：**Wikimedia Commons**（読み込み失敗時は絵文字へ自動フォールバック）。
- 実観測分布：**GBIF**（学名→taxonKey を解決し、occurrence density タイルを表示）。
- 国境：**Natural Earth 110m**（ISO A3 / `ADM0_A3` で識別）。

## アーキテクチャ（差し込み口＝seam）
UIは `AnimalDataSource`（`DATA`）だけに依存。`MockDataSource` を `GbifDataSource` 等へ差し替えるだけで、地図とUIはそのまま実データへ移行できる。

```
listAnimals() / getAnimal(id) / getAnimalsByCountry(iso) / getAnimalsByBiome(biome)
const DATA = MockDataSource;   // ← ここ1行を差し替える
gbifTileURL(taxonKey)          // 実観測タイルのURL（実データ層の入口）
```

## 技術
MapLibre GL JS 5（globe投影）/ CARTO ダークタイル / Natural Earth / GBIF map API。依存はCDNのみ・単一HTML。

## クレジット
- Occurrence data: **GBIF.org** / Basemap: **© OpenStreetMap, © CARTO** / Borders: **Natural Earth** / Photos: **Wikimedia Commons**
- 🤖 Built with [Claude Code](https://claude.com/claude-code)

## ライセンス
コードは MIT。地図・写真・観測データは各提供元のライセンスに従います。
