# BIOSPHERE — 世界いきもの分布アトラス（デモ）

`index.html` を**ダブルクリックでブラウザに開くだけ**で動きます（ビルド不要・要ネット接続）。

## 何ができる
- **3D地球儀**（MapLibre GL）が常に主役。最初はゆっくり自転し、ドラッグで回せます。
- **動物を選ぶ** → 分布がレア度色で塗られ、地球が**棲む土地へ飛ぶ**（旅している感覚）＋詳細カードがせり出す。
- **土地（国）をタップ** → そこに棲むいきものの一覧（逆引き）。
- **環境（biome）でしぼる** → サバンナ/熱帯雨林/極地…の住人だけに。
- **検索** → 和名・学名・分類・環境で動物をしぼり込み。
- **詳細カード**：図鑑No.／和名・学名／分類／**レア度（保全状況の色）**／ステータス（大きさ・体重・食性・寿命）／解説／生息地チップ。
- レア度は IUCN 保全状況に対応：LC コモン → NT アンコモン → VU レア → EN スーパーレア → **CR レジェンダリー**。

## いま入っているデータ
サンプル **12種** をベタ書き（`index.html` 内 `const ANIMALS`）。実在のおおよそ正しい分布・ステータスを収録。
動物写真は Wikimedia Commons から読み込み、失敗時は絵文字に自動フォールバック。

## 実APIへ差し替える場所（seam＝設計の肝）
UIは `AnimalDataSource` インターフェース（= `DATA`）だけに依存しています。

```
index.html 内：
  const MockDataSource = { listAnimals / getAnimal / getAnimalsByCountry / getAnimalsByBiome }
  const DATA = MockDataSource;   ← ここを GbifDataSource 等に替えるだけ
```

- `GbifDataSource` / `INaturalistDataSource` / `IucnDataSource` を同じ4メソッドで実装し、
  `const DATA = ...` の1行を差し替えれば、**地図とUIはそのまま**。
- 国境は Natural Earth 110m（ISO A3 / `ADM0_A3` で識別）。
- 将来の「観測点（緯度経度）」表示は、GeoJSONソースを1つ足すだけで地図に重ねられます。

## 技術
MapLibre GL JS 5（地球儀投影）／ CARTO ダークタイル ／ Natural Earth 国境GeoJSON ／ 単一HTML・依存はCDNのみ。
> 本番リポジトリ化する際は、md仕様どおり Vite + React + TS + Tailwind + react-leaflet/MapLibre へ移植できます（このデモのデータ構造・seam・レア度設計をそのまま流用可）。
