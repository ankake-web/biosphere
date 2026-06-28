# Claude Code 指示プロンプト — 世界いきもの分布図（仮）

## 0. これは何を作るか
ブラウザで動く「世界のいきもの分布エクスプローラー」を新規で作る。**主役は常に世界地図**。動物を選ぶと地図にその分布が塗られ、地図上の国をタップするとそこに棲む動物が出る。各動物には図鑑的な詳細（学名・分類・保全状況・ステータス・解説）があり、それは**地図の上にせり出す詳細カード**として表示する（地図はカードの中に入れない）。実在動物版のポケモン図鑑を、地図中心の操作で。

まずはサンプル8種のベタ書きデータで全機能を動かす。**実データAPI（GBIF / iNaturalist / IUCN）は今回は繋がない**が、後から差し替えられる「データ層の差し込み口（seam）」だけ用意しておく。これが今回の設計の肝。

---

## 1. 技術スタック・セットアップ
- **Vite + React + TypeScript + Tailwind CSS** で新規プロジェクト。
- 新規gitリポジトリとして初期化（最終的に `ankake-web` の新規リポジトリ → GitHub Pages 公開を想定）。リポジトリ名スラッグは任せる（例：`ikimono-map`）。
- **GitHub Pages のプロジェクトサイト（/リポジトリ名 配下）で動くよう、`vite.config.ts` に `base: '/<リポジトリ名>/'` を設定**しておく。
- **地図ライブラリ：`react-leaflet`（+ 世界国境のGeoJSON、ISO A3で国を識別）を基本**とする。理由は、いまの「国単位で分布を塗る（choropleth）」と、将来の「GBIFの観測点（多数の緯度経度）を載せる」の両方を1つで扱えるから。もしより良い選択（MapLibre 等）があるなら置き換えてよいが、(a) 国ポリゴンの塗り分け と (b) 後から点データを重ねられること、の2条件は必須。

---

## 2. 【最重要】アーキテクチャ：APIスワップ seam
UIは「データ層インターフェース」だけに依存させる。v1ではベタ書き実装を入れ、後でGBIF/iNaturalist/IUCNの実装に**UIを触らず差し替えられる**ようにする。

```ts
// 保全状況（IUCNレッドリスト相当）
type ConservationStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'DD';

// 図鑑エントリー（1動物分）
interface AnimalEntry {
  id: string;
  nameJa: string;          // 和名
  nameSci: string;         // 学名
  portraitEmoji: string;   // 仮の見た目（本番はiNaturalistの写真に差し替え）
  taxonGroupJa: string;    // 分類（例：ネコ科）
  biome: string;           // 生息環境（biomeフィルタに使用）
  status: ConservationStatus;   // → レア度の素
  stats: {
    sizeJa: string;        // 大きさ（例：体長1.7–2.5m）
    weightJa: string;      // 体重
    dietJa: string;        // 食性（肉食/草食/雑食）
    lifespanJa: string;    // 寿命
  };
  descriptionJa: string;   // 解説（ポケモン図鑑のフレーバー文の役割、1–2文）
  rangeCountries: string[]; // 分布する国（ISO A3コード）— 地図の塗りに使用
  // 将来追加予定: occurrencePoints?: { lat: number; lng: number }[]; // GBIFの観測点
}

// ★この差し込み口にUIを依存させる
interface AnimalDataSource {
  listAnimals(): Promise<AnimalEntry[]>;
  getAnimal(id: string): Promise<AnimalEntry>;
  getAnimalsByCountry(isoA3: string): Promise<AnimalEntry[]>; // 逆引き（探索）
  getAnimalsByBiome(biome: string): Promise<AnimalEntry[]>;
}
```

- v1 = `MockDataSource implements AnimalDataSource`（下のシード8種をベタ書きで返す）。
- 将来 = `GbifDataSource` / `INaturalistDataSource` / `IucnDataSource` を同じインターフェースで実装して差し替え。
- コンポーネントは `AnimalDataSource` 型のみ参照し、具体実装は1箇所（例：`dataSource.ts`）で注入する。

---

## 3. レア度マッピング（保全状況 → ランク）
これがこのプロジェクトの推し要素。色も割り当てる。

| status | ランク表記 | 色の方向性 |
|---|---|---|
| LC | コモン | グレー〜緑 |
| NT | アンコモン | 緑〜青緑 |
| VU | レア | 青 |
| EN | スーパーレア | 紫 |
| CR | レジェンダリー | 金/赤 |
| DD | データ不足 | グレー |

絶滅に近いほどレア＝「珍しいのを見つけた」感が出るように、カードやグリッドでこの色・ランクを目立たせる。

---

## 4. v1 で作る機能
1. **起動時＝世界地図がホーム・画面の主役**。サンプル種が分布する国がうっすら色づいた overview 表示（国ごとの該当種数で濃淡をつけてよい）。
2. **動物を選ぶ**（上部の検索 or 一覧チップ）→ 地図にその動物の `rangeCountries` がハイライト塗り（図鑑＝forward）。同時に下から**詳細カードがせり出す**（地図は消さない・縮むだけでOK）。
3. **地図の国をタップ** → その国に棲む動物の一覧を出す（探索＝inverse、`getAnimalsByCountry`）。
4. **生息環境（biome）でフィルタ** → その環境の動物だけに絞る／地図に塗る（`getAnimalsByBiome`）。
5. **詳細カード（地図の上にせり出すレイヤー）** の中身：portraitEmoji・和名・学名・分類・**レア度（色付き）**・ステータス（大きさ/体重/食性/寿命）・解説。
   - ※カードはあくまで地図に従属する詳細レイヤー。**カードの中に地図を入れてはいけない／主役を地図から動かさない**。
6. レスポンシブ（スマホで快適に）。タップ領域は十分大きく、キーボードフォーカスが見えること。

---

## 5. シードデータ（MockData に入れる8種）
以下の8種。`status`・`taxonGroupJa`・`biome` は下記の通り。`stats`・`descriptionJa`・`rangeCountries`(ISO A3) は**実在のおおよそ正しい値**を入れて（厳密でなくてよいが現実離れしない範囲で）。

1. ライオン / Panthera leo / ネコ科 / VU / サバンナ
2. アフリカゾウ / Loxodonta africana / ゾウ科 / EN / サバンナ
3. ホッキョクグマ / Ursus maritimus / クマ科 / VU / 極地
4. コウテイペンギン / Aptenodytes forsteri / ペンギン科 / NT / 極地・海
5. アカカンガルー / Osphranter rufus / カンガルー科 / LC / 乾燥地
6. ジャイアントパンダ / Ailuropoda melanoleuca / クマ科 / VU / 森林（竹林）
7. トラ / Panthera tigris / ネコ科 / EN / 森林
8. ハイイロオオカミ / Canis lupus / イヌ科 / LC / 寒帯林

**記入例（ライオン）:**
```ts
{
  id: 'lion',
  nameJa: 'ライオン',
  nameSci: 'Panthera leo',
  portraitEmoji: '🦁',
  taxonGroupJa: 'ネコ科',
  biome: 'サバンナ',
  status: 'VU',
  stats: { sizeJa: '体長1.7–2.5m', weightJa: '120–250kg', dietJa: '肉食', lifespanJa: '10–14年' },
  descriptionJa: '群れ（プライド）で狩りをする、唯一はっきり社会性をもつネコ科。',
  rangeCountries: ['KEN','TZA','ZAF','BWA','ZMB','ZWE','NAM','MOZ','IND'],
}
```

---

## 6. v1 でやらないこと（非ゴール）
- 実APIへの接続（GBIF/iNat/IUCN）。**seam を用意するだけ**。
- ログイン・認証・ユーザー登録。
- 観測点（点データ）の表示。型に将来枠だけ残す。
- 地図をカード内に入れること／主役を地図以外にすること（禁止）。

---

## 7. 進め方（自律実行でお願い）
- **質問は最初にまとめて1回だけ**。詰まらなければ確認は挟まず最後まで自律で進めてよい。
- 意味のある単位で**こまめにgitコミット（チェックポイント）**。
- 応答・コミットメッセージ・コメントは**日本語**で。
- 完了後に**状況レポート**を出す：作ったもの／ディレクトリ構成／`npm run dev` での動かし方／**後で実APIを繋ぐ時にどのファイルのどこを差し替えればいいか（seamの場所）**。

## 8. 完了条件
`npm run dev` で起動し、サンプル8種で次が全部動く：動物選択→地図に分布が塗られる／国タップ→その国の動物が出る／biomeフィルタ／詳細カードがせり出す／レア度が色で出る。地図が常に主役のまま。
