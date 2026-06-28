/* BIOSPHERE 静的SEOページ生成スクリプト（ビルド不要・実行時の本体 index.html は不変）
   index.html 内のデータ（ANIMALS / RARITY / BIOMES / CC / POP / TREND_* / CLASS / PHOTO_CRED）を
   抽出し、種ごとの静的HTML・図鑑インデックス・About・sitemap.xml・robots.txt・static.css を出力する。
   使い方:  node tools/gen-static.js
*/
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SITE='https://ankake-web.github.io/biosphere';
const TODAY='2026-06-28';
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

function grab(re,label){ const m=html.match(re); if(!m){ throw new Error('抽出失敗: '+label); } return m[1]; }
const ANIMALS=eval(grab(/const ANIMALS = (\[[\s\S]*?\]);\nANIMALS\.forEach/,'ANIMALS'));
ANIMALS.forEach((a,i)=>a.no=i+1);
const RARITY=eval('('+grab(/const RARITY = (\{[\s\S]*?\});/,'RARITY')+')');
const BIOMES=eval('('+grab(/const BIOMES = (\{[\s\S]*?\});/,'BIOMES')+')');
const CC=eval('('+grab(/const CC = (\{[\s\S]*?\});/,'CC')+')');
const POP=eval('('+grab(/const POP = (\{[\s\S]*?\});/,'POP')+')');
const TREND_UP=eval(grab(/const TREND_UP=(\[[^\]]*\]);/,'TREND_UP'));
const TREND_DOWN=eval(grab(/const TREND_DOWN=(\[[^\]]*\]);/,'TREND_DOWN'));
const CLASS=eval('('+grab(/const CLASS=(\{[\s\S]*?\});/,'CLASS')+')');
const clsOrder=eval(grab(/const clsOrder=(\[[^\]]*\]);/,'clsOrder'));
const PHOTO_CRED=eval('('+grab(/const PHOTO_CRED=(\{[\s\S]*?\});/,'PHOTO_CRED')+')');

const popOf=a=>a.pop||POP[a.id]||'データ不足';
function trendOf(a){ if(TREND_UP.includes(a.id))return'up'; if(TREND_DOWN.includes(a.id))return'down'; if(a.status==='LC')return'stable'; if(a.status==='DD')return'unknown'; return'down'; }
const TREND_LABEL={up:'↑ 増加',down:'↓ 減少',stable:'→ 横ばい',unknown:'– 不明'};
function classOf(a){ for(const k in CLASS){ if(CLASS[k].includes(a.id))return k; } return '哺乳類'; }
const ccName=c=>CC[c]?CC[c][0]:c;
const ccFlag=c=>CC[c]?CC[c][1]:'📍';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const credOf=a=>{ const c=PHOTO_CRED[a.id]||{by:'Wikimedia Commons',lic:''}; return c.by+(c.lic?(' · '+c.lic):''); };
const iucnURL=a=>'https://www.iucnredlist.org/search?query='+encodeURIComponent(a.nameSci)+'&searchType=species';
const gbifURL=a=>'https://www.gbif.org/species/'+a.gbif;

const HEAD=(title,desc,canon,img,extra='')=>`<!doctype html><html lang="ja"><head>
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
${extra}<link rel="stylesheet" href="${canon.includes('/species/')?'../static.css':'static.css'}">
</head><body>`;

const SITEHEAD=base=>`<header class="site"><a href="${base}"><b>🐾 BIOSPHERE</b></a> <span style="color:#8497a7;font-size:13px">いきもの分布アトラス</span></header>`;
const SITEFOOT=base=>`<footer class="site">
データ出典：分布=<a href="https://www.gbif.org/">GBIF</a>／保全状況・生息数=<a href="https://www.iucnredlist.org/">IUCN レッドリスト</a>等を参考に編集（数値は推定）／写真=<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>（各写真の撮影者・ライセンスは表記）／地図=<a href="https://carto.com/attributions">CARTO</a>・<a href="https://www.naturalearthdata.com/">Natural Earth</a>・<a href="https://www.esri.com/">Esri</a>／<a href="https://maplibre.org/">MapLibre</a>。
<br><a href="${base}">3D地球儀アトラス</a> ・ <a href="${base}zukan.html">図鑑インデックス</a> ・ <a href="${base}about.html">このサイトについて</a>
</footer></body></html>`;

// ---- 種ページ ----
function speciesPage(a,prev,next){
  const r=RARITY[a.status]; const cls=classOf(a);
  const title=`${a.nameJa}（${a.nameSci}）の分布・生態 | BIOSPHERE`;
  const descShort=a.desc.length>70?a.desc.slice(0,68)+'…':a.desc;
  const desc=`${a.nameJa}（${a.nameSci}）の分布・生態。分類は${cls}/${a.taxon}、生息環境は${a.biome}、保全状況は${r.jp}(${a.status})、推定生息数は${popOf(a)}。${descShort} GBIFの実観測データを3D地球儀で。`;
  const canon=`${SITE}/species/${a.id}.html`;
  const geos=a.range.map(c=>`<span class="geo">${ccFlag(c)} ${esc(ccName(c))}</span>`).join('');
  const navLinks=[
    prev?`<a href="${prev.id}.html">← ${esc(prev.nameJa)}</a>`:'<span></span>',
    `<a href="../zukan.html">図鑑インデックス</a>`,
    next?`<a href="${next.id}.html">${esc(next.nameJa)} →</a>`:'<span></span>',
  ].join('');
  return HEAD(title,desc,canon,a.photo)+SITEHEAD('../')+`<main class="wrap">
<img class="hero" src="${a.photo}" alt="${esc(a.nameJa)}の写真" loading="lazy">
<p class="cred">📷 ${esc(credOf(a))}（Wikimedia Commons）</p>
<h1>${esc(a.nameJa)}<span class="sci">${esc(a.nameSci)}</span></h1>
<div class="tags"><span class="tag">🧬 ${esc(cls)}・${esc(a.taxon)}</span><span class="tag">${BIOMES[a.biome].e} ${esc(a.biome)}</span><span class="tag" style="color:${r.color}">${esc(r.jp)}（${a.status}）</span></div>
<p class="pop">推定生息数（野生）：<b style="color:${r.color}">${esc(popOf(a))}</b> <span style="color:#8497a7">${TREND_LABEL[trendOf(a)]}</span></p>
<p class="desc">${esc(a.desc)}</p>
<div class="stats">
<div class="stat"><div class="k">📏 大きさ</div><div class="v">${esc(a.stats.size)}</div></div>
<div class="stat"><div class="k">⚖️ 体重</div><div class="v">${esc(a.stats.weight)}</div></div>
<div class="stat"><div class="k">🍖 食性</div><div class="v">${esc(a.stats.diet)}</div></div>
<div class="stat"><div class="k">⏳ 寿命</div><div class="v">${esc(a.stats.life)}</div></div>
</div>
<h2>分布する地域（${a.range.length}地域）</h2>
<div class="geos">${geos}</div>
<p><a class="cta" href="../#${a.id}">▶ 3D地球儀でこの種の実分布（GBIF）を見る</a></p>
<p class="src">出典：<a href="${iucnURL(a)}">IUCN レッドリスト ↗</a> ／ <a href="${gbifURL(a)}">GBIF 種ページ ↗</a></p>
<nav class="nav">${navLinks}</nav>
</main>`+SITEFOOT('../');
}

// ---- 図鑑インデックス ----
function zukanPage(){
  const title='図鑑インデックス（全'+ANIMALS.length+'種）｜ BIOSPHERE 世界いきもの分布アトラス';
  const desc='ライオン・トラ・ユキヒョウからセコイア・ラフレシアまで、世界の生きもの'+ANIMALS.length+'種の分布・生態・保全状況を一覧。GBIFの実観測データを3D地球儀で旅する図鑑。';
  let body='';
  clsOrder.forEach(cls=>{
    const list=ANIMALS.filter(a=>classOf(a)===cls);
    if(!list.length)return;
    body+=`<h2>${esc(cls)}（${list.length}種）</h2><div class="grid">`;
    list.forEach(a=>{ const r=RARITY[a.status];
      body+=`<a class="zcard" href="species/${a.id}.html"><img src="${a.photo}" alt="${esc(a.nameJa)}" loading="lazy"><span><span class="n">${esc(a.nameJa)}</span> <span class="s">${esc(a.nameSci)}</span><span class="b">${BIOMES[a.biome].e}${esc(a.biome)}・<span style="color:${r.color}">${esc(r.jp)}</span>・${esc(popOf(a))}</span></span></a>`;
    });
    body+='</div>';
  });
  return HEAD(title,desc,SITE+'/zukan.html',ANIMALS[0].photo)+SITEHEAD('./')+`<main class="wrap">
<h1>図鑑インデックス<span class="sci">世界のいきもの ${ANIMALS.length}種</span></h1>
<p>各種をクリックすると分布・生態・保全状況の詳細ページへ。<a href="./">3D地球儀アトラス</a>では実際の観測分布を地球儀で旅できます。</p>
${body}
</main>`+SITEFOOT('./');
}

// ---- About ----
function aboutPage(){
  const title='このサイトについて・データ出典 | BIOSPHERE';
  const desc='BIOSPHERE（世界いきもの分布アトラス）のデータ出典。分布=GBIF、保全状況=IUCN、写真=Wikimedia Commons、地図=CARTO/OpenStreetMap/Esri/Natural Earth、MapLibre。';
  return HEAD(title,desc,SITE+'/about.html',ANIMALS[0].photo)+SITEHEAD('./')+`<main class="wrap">
<h1>BIOSPHERE について</h1>
<p>世界のいきものの分布を3D地球儀で旅する図鑑です。分布・写真・地図はすべて実在のオープンソースに基づいています。</p>
<h2>データ・地図の出典</h2>
<ul style="line-height:1.9">
<li><b>分布データ</b>：<a href="https://www.gbif.org/">GBIF</a>（Global Biodiversity Information Facility）の実観測データ。</li>
<li><b>保全状況・生息数のめやす</b>：<a href="https://www.iucnredlist.org/">IUCN レッドリスト</a> 等を参考に編集（数値は推定・出典年により幅があります）。</li>
<li><b>写真</b>：<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>。各写真の撮影者・ライセンスは各種ページに明記。</li>
<li><b>ベースマップ</b>：<a href="https://carto.com/attributions">CARTO</a> Dark（© OpenStreetMap contributors © CARTO）。</li>
<li><b>地形（アトラス表示）</b>：<a href="https://www.esri.com/">Esri</a> World Hillshade。</li>
<li><b>国境</b>：<a href="https://www.naturalearthdata.com/">Natural Earth</a>（パブリックドメイン）。</li>
<li><b>逆引きの実写真</b>：<a href="https://www.inaturalist.org/">iNaturalist</a>。<b>地図ライブラリ</b>：<a href="https://maplibre.org/">MapLibre GL JS</a>。</li>
</ul>
<p style="color:#8497a7;font-size:13px">※写真はファイルごとにライセンス（CC BY／CC BY-SA／パブリックドメイン等）と帰属条件が異なります。本サイトを商用利用する場合、NC（非営利）条件の素材やIUCN APIの利用可否に注意が必要です。</p>
<p><a class="cta" href="./">▶ 3D地球儀アトラスへ</a></p>
</main>`+SITEFOOT('./');
}

const CSS=`:root{--bg:#070b11;--card:#0d141d;--ink:#eef4f7;--muted:#8497a7;--line:rgba(255,255,255,.1);--teal:#34d8c6}
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
.nav{display:flex;justify-content:space-between;gap:10px;margin:26px 0 0;font-size:13px}
footer.site{border-top:1px solid var(--line);padding:20px 18px;color:var(--muted);font-size:12px;line-height:1.8;max-width:760px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:14px 0 24px}
.zcard{display:flex;gap:11px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;align-items:center;color:var(--ink)}
.zcard:hover{text-decoration:none;border-color:rgba(255,255,255,.22)}
.zcard img{width:54px;height:54px;border-radius:9px;object-fit:cover;flex:0 0 auto}
.zcard .n{font-weight:700;font-size:14px}.zcard .s{font-size:11px;color:var(--muted);font-style:italic}
.zcard .b{font-size:11px;color:#cdd9df;margin-top:2px;display:block}`;

// ---- 出力 ----
const spDir=path.join(ROOT,'species');
fs.mkdirSync(spDir,{recursive:true});
ANIMALS.forEach((a,i)=>{
  fs.writeFileSync(path.join(spDir,a.id+'.html'), speciesPage(a, ANIMALS[i-1], ANIMALS[i+1]));
});
fs.writeFileSync(path.join(ROOT,'static.css'), CSS);
fs.writeFileSync(path.join(ROOT,'zukan.html'), zukanPage());
fs.writeFileSync(path.join(ROOT,'about.html'), aboutPage());

// sitemap.xml
const urls=[`${SITE}/`, `${SITE}/zukan.html`, `${SITE}/about.html`, ...ANIMALS.map(a=>`${SITE}/species/${a.id}.html`)];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>\n`;
fs.writeFileSync(path.join(ROOT,'sitemap.xml'), sitemap);

// robots.txt
fs.writeFileSync(path.join(ROOT,'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`生成完了：species/ ${ANIMALS.length}ページ + zukan.html + about.html + static.css + sitemap.xml + robots.txt`);
