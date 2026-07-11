/* Faunaut 静的SEOページ生成（ESM・ビルド不要・実行時の本体 index.html は不変）
   データの単一ソース＝ data/species.json（種カタログ animals ＋写真クレジット photoCred）。
   小辞書（RARITY・BIOMES・CC・POP・TREND_UP/DOWN・CLASS・clsOrder・THREAT_OVR）は index.html から抽出。
   生成物：species/<id>.html（全種）・zukan.html・about.html・static.css・sitemap.xml・robots.txt。
   URL構造・テンプレートは従来（tools/gen-static.js）と完全互換。
   使い方:  node scripts/generate.mjs
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';   // sitemap の lastmod 初期値（種データの最終変更日）を git から引く
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://faunaut.com';
// 実行日（ローカル日付）。toISOString() は UTC なので日本の朝9時前だと前日になってしまう。
const _d = new Date();
const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
// サイト全体を表すOGP画像（自前・1200x630）。種ページは「その種の写真」の方が内容と一致するのでこれは使わない。
// 以前は zukan/about も（代表種でもない）ライオンの写真を指していた。
const OG_IMAGE = SITE + '/og.jpg';

/* sitemap の lastmod は「そのページの内容が最後に変わった日」でなければ意味がない。
   全URLに実行日を書くと、種を1件も触らずコードだけ直した再生成でも「6,300種すべて今日更新」と
   クローラに嘘をつくことになり、Google は当てにならない lastmod を無視するようになる。
   そこで生成した内容を既存ファイルと比べ、変わったページだけ日付を進める（不変なら前回の値を保つ）。 */
const prevLastmod = (() => {
  const p = path.join(ROOT, 'sitemap.xml'), m = new Map();
  if (!fs.existsSync(p)) return m;
  for (const x of fs.readFileSync(p, 'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) m.set(x[1], x[2]);
  return m;
})();
// 前回の記録が無いURL（初回生成・新しく増えた種）は、種データが最後に変わった日を使う。
const SPECIES_DATE = (() => {
  try {
    const s = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'data/species.json'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : TODAY;
  } catch { return TODAY; }   // git が無い環境では実行日にフォールバック
})();
// 内容が同じならファイルを書かない（mtime を動かさない・6,300ファイルの無駄な書き込みを避ける）
function writeIfChanged(abs, content) {
  let old = null;
  try { old = fs.readFileSync(abs, 'utf8'); } catch { /* 未作成 */ }
  if (old === content) return false;
  fs.writeFileSync(abs, content);
  return true;
}
const lastmodOf = (url, changed) => changed ? TODAY : (prevLastmod.get(url) || SPECIES_DATE);

// --- 単一ソース：種データ ---
const species = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/species.json'), 'utf8'));
const ANIMALS = species.animals;
ANIMALS.forEach((a, i) => a.no = i + 1);
const PHOTO_CRED = species.photoCred;

// --- 実行時用の分割データを生成（初回はコアだけ読み込み、カードを開いた時に詳細を遅延ロード） ---
// species.json が単一ソース。ここから派生する core（一覧/地図/検索に要る軽い項目）と
// detail（カードでだけ要る stats/desc/photoCred）を書き出す。runtime は core→detail の順に読む。
{
  // 写真URLをコンパクト表記に短縮（共通prefix除去＋thumbの重複ファイル名除去）。runtime の photoURL() と対で復元。
  const compactPhoto = u => {
    const P = 'https://upload.wikimedia.org/wikipedia/commons/';
    if (typeof u !== 'string' || !u.startsWith(P)) return '9|' + u;
    const r = u.slice(P.length);
    let m = r.match(/^thumb\/[0-9a-f]\/([0-9a-f]{2})\/(.+?)\/(\d+)px-\2$/);
    if (m) return '1|' + m[3] + '|' + m[1] + '|' + m[2];   // 1|width|ab|file（ab[0]=1文字目は復元時に導出）
    m = r.match(/^[0-9a-f]\/([0-9a-f]{2})\/(.+)$/);
    if (m) return '0|' + m[1] + '|' + m[2];                // 0|ab|file
    return '9|' + u;
  };
  // core = 一覧/地図/検索に要る軽い項目。カード専用の stats/desc/eco/human/wiki は core から外し detail へ（coreを肥大させない）。
  const coreAnimals = ANIMALS.map(a => { const c = { ...a }; delete c.stats; delete c.desc; delete c.eco; delete c.human; delete c.cook; delete c.wiki; c.photo = compactPhoto(c.photo); return c; });
  fs.writeFileSync(path.join(ROOT, 'data/species-core.json'), JSON.stringify({ animals: coreAnimals }));
  const detail = {};
  for (const a of ANIMALS) { const o = { stats: a.stats, desc: a.desc }; if (a.eco) o.eco = a.eco; if (a.human) o.human = a.human; if (a.cook) o.cook = a.cook; if (a.wiki) o.wiki = a.wiki; detail[a.id] = o; }
  fs.writeFileSync(path.join(ROOT, 'data/species-detail.json'), JSON.stringify({ detail, photoCred: PHOTO_CRED }));
  const kb = f => (fs.statSync(path.join(ROOT, 'data', f)).size / 1024).toFixed(0);
  console.log(`分割データ生成：species-core.json ${kb('species-core.json')}KB / species-detail.json ${kb('species-detail.json')}KB`);
}

// --- 小辞書は js/app.js から抽出（実行時データと単一ソースを共有） ---
// ※RARITY/BIOMES/CC/POP/TREND/CLASS/clsOrder/THREAT_OVR は index.html→js/data.js→(連結で)js/app.js と移動。
const html = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
function grab(re, label) { const m = html.match(re); if (!m) { throw new Error('抽出失敗: ' + label); } return m[1]; }
const RARITY = eval('(' + grab(/const RARITY = (\{[\s\S]*?\});/, 'RARITY') + ')');
const BIOMES = eval('(' + grab(/const BIOMES = (\{[\s\S]*?\});/, 'BIOMES') + ')');
const CC = eval('(' + grab(/const CC = (\{[\s\S]*?\});/, 'CC') + ')');
const POP = eval('(' + grab(/const POP = (\{[\s\S]*?\});/, 'POP') + ')');
const TREND_UP = eval(grab(/const TREND_UP=(\[[^\]]*\]);/, 'TREND_UP'));
const TREND_DOWN = eval(grab(/const TREND_DOWN=(\[[^\]]*\]);/, 'TREND_DOWN'));
const CLASS = eval('(' + grab(/const CLASS=(\{[\s\S]*?\});/, 'CLASS') + ')');
const clsOrder = eval(grab(/const clsOrder=(\[[^\]]*\]);/, 'clsOrder'));
const THREAT_OVR = eval('(' + grab(/const THREAT_OVR=(\{[\s\S]*?\});/, 'THREAT_OVR') + ')');

const popOf = a => a.pop || POP[a.id] || 'データ不足';
function trendOf(a) { if (TREND_UP.includes(a.id)) return 'up'; if (TREND_DOWN.includes(a.id)) return 'down'; if (a.status === 'LC') return 'stable'; return 'unknown'; }
const TREND_LABEL = { up: '↑ 増加', down: '↓ 減少', stable: '→ 横ばい', unknown: '– 不明' };
function classOf(a) { for (const k in CLASS) { if (CLASS[k].includes(a.id)) return k; } return '哺乳類'; }
const ccName = c => CC[c] ? CC[c][0] : c;
const ccFlag = c => CC[c] ? CC[c][1] : '📍';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const credOf = a => { const c = PHOTO_CRED[a.id] || { by: 'Wikimedia Commons', lic: '' }; return c.by + (c.lic ? (' · ' + c.lic) : ''); };
const iucnURL = a => 'https://www.iucnredlist.org/search?query=' + encodeURIComponent(a.nameSci) + '&searchType=species';
const gbifURL = a => 'https://www.gbif.org/species/' + a.gbif;
function threatsOf(a) {
  if (THREAT_OVR[a.id]) return THREAT_OVR[a.id];
  const t = [], b = a.biome, cls = classOf(a);
  if (b === '熱帯雨林' || b === '森林') t.push('森林伐採による生息地の破壊');
  else if (b === '海') t.push('混獲・乱獲');
  else if (b === '極地') t.push('気候変動による海氷の減少');
  else if (b === 'サバンナ' || b === '草原') t.push('生息地の農地化');
  else if (b === '湿地') t.push('湿地の埋め立て・開発');
  else t.push('開発による生息地の改変');
  if (['サイ科', 'ゾウ科'].includes(a.taxon)) t.push('密猟');
  else if (['ネコ科', 'イヌ科', 'クマ科'].includes(a.taxon)) t.push('人との軋轢');
  else if (cls === '両生類') t.push('ツボカビ症・水質汚染');
  else if (b === '海') t.push('海洋汚染');
  t.push('気候変動');
  return [...new Set(t)].slice(0, 3);
}
const isThreatened = a => ['CR', 'EN', 'VU', 'NT', 'DD'].includes(a.status);

const HEAD = (title, desc, canon, img, extra = '') => `<!doctype html><html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${extra}<link rel="stylesheet" href="${canon.includes('/species/') ? '../static.css' : 'static.css'}">
</head><body>`;

const SITEHEAD = base => `<header class="site"><a href="${base}"><b>🐾 Faunaut</b></a> <span style="color:#8497a7;font-size:13px">いきもの分布アトラス</span></header>`;
const SITEFOOT = base => `<footer class="site">
データ出典：分布=<a href="https://www.gbif.org/">GBIF</a>／保全状況・生息数=<a href="https://www.iucnredlist.org/">IUCN レッドリスト</a>等を参考に編集（数値は推定）／写真=<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>（各写真の撮影者・ライセンスは表記）／地図=<a href="https://carto.com/attributions">CARTO</a>・<a href="https://www.naturalearthdata.com/">Natural Earth</a>・<a href="https://www.esri.com/">Esri</a>／<a href="https://maplibre.org/">MapLibre</a>。
<br><a href="${base}">3D地球儀アトラス</a> ・ <a href="${base}zukan.html">図鑑インデックス</a> ・ <a href="${base}about.html">このサイトについて</a>
</footer></body></html>`;

// ---- 種ページ ----
function speciesPage(a, prev, next) {
  const r = RARITY[a.status]; const cls = classOf(a);
  const title = `${a.nameJa}（${a.nameSci}）の分布・生態 | Faunaut`;
  const descShort = a.desc.length > 70 ? a.desc.slice(0, 68) + '…' : a.desc;
  const desc = `${a.nameJa}（${a.nameSci}）の分布・生態。分類は${cls}/${a.taxon}、生息環境は${a.biome}、保全状況は${r.jp}(${a.status})、推定生息数は${popOf(a)}。${descShort} GBIFの実観測データを3D地球儀で。`;
  const canon = `${SITE}/species/${a.id}.html`;
  const geos = a.range.map(c => `<span class="geo">${ccFlag(c)} ${esc(ccName(c))}</span>`).join('');
  const navLinks = [
    prev ? `<a href="${prev.id}.html">← ${esc(prev.nameJa)}</a>` : '<span></span>',
    `<a href="../zukan.html">図鑑インデックス</a>`,
    next ? `<a href="${next.id}.html">${esc(next.nameJa)} →</a>` : '<span></span>',
  ].join('');
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Faunaut", "item": SITE + "/" },
    { "@type": "ListItem", "position": 2, "name": "図鑑インデックス", "item": SITE + "/zukan.html" },
    { "@type": "ListItem", "position": 3, "name": a.nameJa, "item": canon }] })}</script>\n`;
  return HEAD(title, desc, canon, a.photo, ld) + SITEHEAD('../') + `<main class="wrap">
<img class="hero" src="${a.photo}" alt="${esc(a.nameJa)}の写真" loading="lazy">
<p class="cred">📷 ${esc(credOf(a))}（Wikimedia Commons）</p>
<h1>${esc(a.nameJa)}<span class="sci">${esc(a.nameSci)}</span></h1>
<div class="tags"><span class="tag">🧬 ${esc(cls)}・${esc(a.taxon)}</span><span class="tag">${BIOMES[a.biome].e} ${esc(a.biome)}</span><span class="tag" style="color:${r.color}">${esc(r.jp)}（${a.status}）</span></div>
<p class="pop">推定生息数（野生）：<b style="color:${r.color}">${esc(popOf(a))}</b> <span style="color:#8497a7">${TREND_LABEL[trendOf(a)]}</span></p>
<p class="desc">${esc(a.desc)}</p>
${isThreatened(a) ? `<div class="conserv"><h2 style="margin-top:0;color:#ffcf7a">🛡 おもな脅威と保全（${esc(r.jp)}・${a.status}）</h2>
<div class="cvtags">${threatsOf(a).map(t => `<span class="cvtag">${esc(t)}</span>`).join('')}</div>
<p class="src">保全：<a href="${iucnURL(a)}">IUCNで状況を見る ↗</a> ／ <a href="https://www.google.com/search?q=${encodeURIComponent(a.nameJa + ' ' + a.nameSci + ' 保全 conservation')}">保全活動・団体を調べる ↗</a></p></div>` : ''}
<div class="stats">
<div class="stat"><div class="k">📏 大きさ</div><div class="v">${esc(a.stats.size)}</div></div>
<div class="stat"><div class="k">⚖️ 体重</div><div class="v">${esc(a.stats.weight)}</div></div>
<div class="stat"><div class="k">🍖 食性</div><div class="v">${esc(a.stats.diet)}</div></div>
<div class="stat"><div class="k">⏳ 寿命</div><div class="v">${esc(a.stats.life)}</div></div>
</div>
${(a.eco || a.human || a.cook) ? `<h2>🌿 生態</h2><p class="desc">${esc(a.eco || a.desc)}</p>${a.human ? `<h2>👤 人との関わり</h2><p class="desc">${esc(a.human)}</p>` : ''}${a.cook ? `<h2>🍴 調理法・味</h2><p class="desc">${esc(a.cook)}</p>` : ''}${a.wiki ? `<p class="src">生態・人との関わり・調理法の出典：<a href="${esc(a.wiki)}">Wikipedia ↗</a></p>` : ''}\n` : ''}<h2>分布する地域（${a.range.length}地域）</h2>
<div class="geos">${geos}</div>
<p><a class="cta" href="../#${a.id}">▶ 3D地球儀でこの種の実分布（GBIF）を見る</a></p>
<p class="src">出典：<a href="${iucnURL(a)}">IUCN レッドリスト ↗</a> ／ <a href="${gbifURL(a)}">GBIF 種ページ ↗</a></p>
<nav class="nav">${navLinks}</nav>
</main>` + SITEFOOT('../');
}

// ---- 図鑑インデックス ----
function zukanPage() {
  const title = '図鑑インデックス（全' + ANIMALS.length + '種）｜ Faunaut 世界いきもの分布アトラス';
  const desc = 'ライオン・トラ・ユキヒョウからセコイア・ラフレシアまで、世界の生きもの' + ANIMALS.length + '種の分布・生態・保全状況を一覧。GBIFの実観測データを3D地球儀で旅する図鑑。';
  let body = '';
  clsOrder.forEach(cls => {
    const list = ANIMALS.filter(a => classOf(a) === cls);
    if (!list.length) return;
    body += `<h2>${esc(cls)}（${list.length}種）</h2><div class="grid">`;
    list.forEach(a => { const r = RARITY[a.status];
      body += `<a class="zcard" href="species/${a.id}.html"><img src="${a.photo}" alt="${esc(a.nameJa)}" loading="lazy"><span><span class="n">${esc(a.nameJa)}</span> <span class="s">${esc(a.nameSci)}</span><span class="b">${BIOMES[a.biome].e}${esc(a.biome)}・<span style="color:${r.color}">${esc(r.jp)}</span>・${esc(popOf(a))}</span></span></a>`;
    });
    body += '</div>';
  });
  return HEAD(title, desc, SITE + '/zukan.html', OG_IMAGE) + SITEHEAD('./') + `<main class="wrap">
<h1>図鑑インデックス<span class="sci">世界のいきもの ${ANIMALS.length}種</span></h1>
<p>各種をクリックすると分布・生態・保全状況の詳細ページへ。<a href="./">3D地球儀アトラス</a>では実際の観測分布を地球儀で旅できます。</p>
${body}
</main>` + SITEFOOT('./');
}

// ---- About ----
function aboutPage() {
  const title = 'このサイトについて・データ出典 | Faunaut';
  const desc = 'Faunaut（ファウノート／世界いきもの分布アトラス）のデータ出典。分布=GBIF、保全状況=IUCN、写真=Wikimedia Commons、地図=CARTO/OpenStreetMap/Esri/Natural Earth、MapLibre。';
  return HEAD(title, desc, SITE + '/about.html', OG_IMAGE) + SITEHEAD('./') + `<main class="wrap">
<h1>Faunaut について</h1>
<p>世界のいきものの分布を3D地球儀で旅する図鑑です。分布・写真・地図はすべて実在のオープンソースに基づいています。</p>
<h2>データ・地図の出典</h2>
<ul style="line-height:1.9">
<li><b>分布データ</b>：<a href="https://www.gbif.org/">GBIF</a>（Global Biodiversity Information Facility）の実観測データ。</li>
<li><b>保全状況・生息数のめやす</b>：<a href="https://www.iucnredlist.org/">IUCN レッドリスト</a> 等を参考に編集（数値は推定・出典年により幅があります）。</li>
<li><b>写真</b>：<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>。各写真の撮影者・ライセンスは各種ページに明記。</li>
<li><b>ベースマップ</b>：<a href="https://carto.com/attributions">CARTO</a> Dark（© OpenStreetMap contributors © CARTO）。<b>本物の地図（近くモード）</b>：<a href="https://openfreemap.org/">OpenFreeMap</a> Liberty（街路・鉄道・地名・地形のベクター地図／© OpenStreetMap contributors）。</li>
<li><b>地形（アトラス表示）</b>：<a href="https://www.esri.com/">Esri</a> World Hillshade。</li>
<li><b>国境</b>：<a href="https://www.naturalearthdata.com/">Natural Earth</a>（パブリックドメイン）。</li>
<li><b>逆引きの実写真</b>：<a href="https://www.inaturalist.org/">iNaturalist</a>。<b>地図ライブラリ</b>：<a href="https://maplibre.org/">MapLibre GL JS</a>。</li>
</ul>
<p style="color:#8497a7;font-size:13px">※写真はファイルごとにライセンス（CC BY／CC BY-SA／パブリックドメイン等）と帰属条件が異なります。本サイトを商用利用する場合、NC（非営利）条件の素材やIUCN APIの利用可否に注意が必要です。</p>
<p><a class="cta" href="./">▶ 3D地球儀アトラスへ</a></p>
</main>` + SITEFOOT('./');
}

const CSS = `:root{--bg:#070b11;--card:#0d141d;--ink:#eef4f7;--muted:#8497a7;--line:rgba(255,255,255,.1);--teal:#34d8c6}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Helvetica Neue","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;line-height:1.7}
a{color:var(--teal);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:760px;margin:0 auto;padding:18px 18px 50px}
header.site{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(7,11,17,.92);backdrop-filter:blur(8px);z-index:2}
header.site b{font-weight:800;letter-spacing:.04em}
.hero{width:100%;max-height:380px;object-fit:cover;border-radius:14px;margin:10px 0 6px;display:block}
.cred{font-size:11px;color:var(--muted);margin:0 0 8px}
h1{font-size:28px;margin:14px 0 2px;font-weight:800}
h1 .sci{display:block;font-size:15px;font-style:italic;color:#cdd9df;font-weight:400;margin-top:3px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.tag{font-size:12.5px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:5px 10px;color:#cdd9df}
.pop{font-size:15px;margin:12px 0}
.desc{font-size:15px;color:#d2dde3;background:var(--card);border-left:3px solid var(--teal);padding:12px 16px;border-radius:0 10px 10px 0;margin:14px 0}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.stat .k{font-size:11px;color:var(--muted)}.stat .v{font-weight:600;margin-top:3px}
h2{font-size:14px;letter-spacing:.08em;color:var(--muted);margin:22px 0 8px}
.geos{display:flex;flex-wrap:wrap;gap:7px}.geo{font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:5px 10px}
.cta{display:inline-block;margin:16px 0;background:var(--teal);color:#04201d;font-weight:800;padding:11px 18px;border-radius:12px}
.cta:hover{text-decoration:none;filter:brightness(1.08)}
.src{font-size:13px;color:var(--muted);margin:10px 0}
.conserv{background:rgba(255,176,46,.06);border:1px solid rgba(255,176,46,.28);border-radius:12px;padding:6px 16px 12px;margin:14px 0}
.conserv h2{font-size:14px;letter-spacing:0;margin:12px 0 10px}
.cvtags{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}
.cvtag{font-size:12px;font-weight:600;color:#ffe1b0;background:rgba(255,176,46,.13);border:1px solid rgba(255,176,46,.3);border-radius:8px;padding:4px 11px}
.nav{display:flex;justify-content:space-between;gap:10px;margin:26px 0 0;font-size:13px}
footer.site{border-top:1px solid var(--line);padding:20px 18px;color:var(--muted);font-size:12px;line-height:1.8;max-width:760px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:14px 0 24px}
.zcard{display:flex;gap:11px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;align-items:center;color:var(--ink)}
.zcard:hover{text-decoration:none;border-color:rgba(255,255,255,.22)}
.zcard img{width:54px;height:54px;border-radius:9px;object-fit:cover;flex:0 0 auto}
.zcard .n{font-weight:700;font-size:14px}.zcard .s{font-size:11px;color:var(--muted);font-style:italic}
.zcard .b{font-size:11px;color:#cdd9df;margin-top:2px;display:block}`;

// ---- 出力 ----
// 各ページの「変わったか」を記録し、sitemap の lastmod をそれに紐づける。
const spDir = path.join(ROOT, 'species');
fs.mkdirSync(spDir, { recursive: true });
const changed = new Map();   // url -> 内容が変わったか
let nWritten = 0;
ANIMALS.forEach((a, i) => {
  const c = writeIfChanged(path.join(spDir, a.id + '.html'), speciesPage(a, ANIMALS[i - 1], ANIMALS[i + 1]));
  if (c) nWritten++;
  changed.set(`${SITE}/species/${a.id}.html`, c);
});
writeIfChanged(path.join(ROOT, 'static.css'), CSS);
changed.set(`${SITE}/zukan.html`, writeIfChanged(path.join(ROOT, 'zukan.html'), zukanPage()));
changed.set(`${SITE}/about.html`, writeIfChanged(path.join(ROOT, 'about.html'), aboutPage()));
// トップは手書きの index.html。生成物ではないので git の最終変更日をそのまま lastmod に使う。
changed.set(`${SITE}/`, false);
if (!prevLastmod.has(`${SITE}/`)) prevLastmod.set(`${SITE}/`, TODAY);

// sitemap.xml
const urls = [`${SITE}/`, `${SITE}/zukan.html`, `${SITE}/about.html`, ...ANIMALS.map(a => `${SITE}/species/${a.id}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${lastmodOf(u, changed.get(u))}</lastmod></url>`).join('\n')}
</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

// robots.txt
// faunaut.com は独自ドメインの直下配信なので、これはホスト直下 https://faunaut.com/robots.txt として
// 配信され、クローラに読まれる（robots.txt はホスト単位）。下の Sitemap: 行もそのまま有効。
// （旧 …github.io/biosphere/ のサブパス時代はホスト直下に置けず無効だった＝ドメイン移行で解消。
//   なお Search Console からの sitemap 送信も別途おこなうと発見が速い。）
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// .nojekyll：GitHub PagesにJekyll処理をスキップさせ、生成済み静的HTMLをそのまま配信させる。
// （5,000超のページをJekyllが処理するとビルドがタイムアウト/失敗するため必須。全て静的なのでJekyll不要）
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');

// CNAME：独自ドメイン faunaut.com を GitHub Pages に紐付ける設定ファイル。
// GitHub の Pages 設定でも作られるが、再生成のたびに書き出して確実に残す（消えるとカスタムドメインが外れる）。
fs.writeFileSync(path.join(ROOT, 'CNAME'), 'faunaut.com\n');

console.log(`生成完了：species/ ${ANIMALS.length}ページ（うち内容が変わって書き直したのは ${nWritten}ページ）+ zukan.html + about.html + static.css + sitemap.xml + robots.txt + .nojekyll + CNAME（単一ソース：data/species.json）`);
console.log(`sitemap の lastmod：変わったページ=${TODAY} ／ 変わらないページ=前回の値を保持（初出は ${SPECIES_DATE}＝data/species.json の最終変更日）`);
