/* ---------- UI構築 ---------- */
const chipsEl=$('#chips'), biomesEl=$('#biomes'), legendEl=$('#legend');
function avatar(a,cls=''){
  const g=BIOMES[a.biome]?BIOMES[a.biome].g:['#1b3a43','#0d1b22'];
  return `<span class="av ${cls}" style="background:linear-gradient(140deg,${g[0]},${g[1]})"><span>${a.emoji}</span>`
    +`<img class="ph" loading="lazy" src="${a.photo}" alt="${esc(a.nameJa||a.nameSci||'')}" onload="this.classList.add('loaded')" onerror="this.remove()"></span>`;
}
function makeChip(a,i){
  const b=document.createElement('button');
  b.className='chip'+(SEEN.has(a.id)?' is-seen':''); b.style.animationDelay=(i*22)+'ms';
  b.setAttribute('aria-pressed','false'); b.dataset.id=a.id; b.dataset.biome=a.biome;
  b.dataset.q=(a.nameJa+' '+a.nameSci+' '+a.taxon+' '+a.biome).toLowerCase();
  b.dataset.no=a.no; b.dataset.status=a.status; b.dataset.cls=classOf(a);
  b.dataset.trend=trendOf(a); b.dataset.popnum=popNum(a); b.dataset.name=a.nameJa;
  b.innerHTML=avatar(a)+`<span class="meta"><span class="n">${a.nameJa}</span><span class="s">${a.nameSci}</span></span>`
    +`<span class="rk" style="background:${RARITY[a.status].color};box-shadow:0 0 8px ${RARITY[a.status].color}"></span>`
    +`<span class="seen">✓</span><span class="undisc">？</span>`;
  b.onclick=()=>selectAnimal(a.id);
  return b;
}
// 図鑑チップ（最大2506枚＝DOM約4万ノード）は重い。段階描画でもDOM/メモリ/スタイル再計算の負荷が大きいので、
// モバイルでは「いきもの図鑑」ドックを開くまで構築を遅延する（buildChips）。デスクトップ（ドック常時表示）は即時。
let chipsBuilt=false;
function buildChips(){
  if(chipsBuilt) return; chipsBuilt=true;
  chipsEl.innerHTML='';   // スケルトン除去
  let _i=0; const _N=ANIMALS.length, _FIRST=160, _CHUNK=160;
  function _flush(end){ const f=document.createDocumentFragment(); for(;_i<end;_i++) f.appendChild(makeChip(ANIMALS[_i],_i)); chipsEl.appendChild(f); }
  _flush(Math.min(_FIRST,_N));
  (function _next(){ if(_i>=_N){ if(typeof applyFilters==='function') applyFilters();
    // 段階構築の途中で並び替えを変えていた場合（または遅延構築時）に、現在の並び順を全チップへ反映
    if(typeof sortChips==='function'){ const ss=document.querySelector('#sortSel'); sortChips(ss&&ss.value||'no'); }
    return; } _flush(Math.min(_i+_CHUNK,_N)); setTimeout(_next,0); })();
}
// 凡例をモード連動に：概観＝国塗り「種の多さ」(緑→ゴールド)、種/環境/国選択＝IUCN保全色。
// 地図の色語彙と凡例を一致させる（概観のゴールドを「IUCN色」と誤説明していた矛盾を解消）。
let _legendMode=null;
function renderLegend(mode){
  if(!legendEl || _legendMode===mode) return;
  _legendMode=mode;
  let title, body;
  if(mode==='overview'){
    title='地図の色 — 種の多さ';
    body=`<div class="lr"><span class="sw" style="width:64px;height:9px;border-radius:3px;box-shadow:none;background:linear-gradient(90deg,#1a4a3c,#21aa8c,#f2c14e)"></span></div>
      <div class="lr" style="justify-content:space-between;color:var(--muted-2);font-size:10.5px;margin-top:-3px"><span>少ない</span><span>多い</span></div>
      <div class="lr" style="color:var(--muted-2);font-size:11px">国ごとの図鑑掲載種の数</div>`;
  } else {
    title='生息数のめやす（IUCN保全状況）';
    const used=[...new Set(ANIMALS.map(a=>a.status))].sort((a,b)=>'LC NT VU EN CR DD NE'.indexOf(a)-'LC NT VU EN CR DD NE'.indexOf(b));
    body=used.map(s=>{const r=RARITY[s]; return `<div class="lr" style="color:${r.color}"><span class="sw" style="background:${r.color}"></span><b>${r.band}</b><span style="margin-left:auto;color:var(--muted-2)">${s}</span></div>`;}).join('');
  }
  legendEl.innerHTML=`<div class="lt">${title}</div>${body}`
    +`<div class="lf">地図の<b>黄〜赤のメッシュ</b>は GBIF の実観測地点。<b>ズームで細かく</b>なります。🛰️で表示切替。</div>`
    +`<button type="button" class="lhelp">🛟 保全状況（IUCN）とは？</button>`;
  const h=legendEl.querySelector('.lhelp'); if(h) h.onclick=()=>openRedlist();
}
function initCatalog(){
Object.keys(BIOMES).forEach(bm=>{
  const b=document.createElement('button');
  b.className='bm'; b.setAttribute('aria-pressed','false'); b.dataset.bm=bm;
  b.innerHTML=`<span class="e">${BIOMES[bm].e}</span>${bm}`; b.onclick=()=>selectBiome(bm);
  biomesEl.appendChild(b);
});
const allBtn=document.createElement('button'); allBtn.className='bm'; allBtn.innerHTML='✺ ぜんぶ'; allBtn.onclick=resetAll; biomesEl.appendChild(allBtn);
renderLegend(currentMode&&currentMode.type==='overview'?'overview':'status');   // 起動時のモードに合わせて凡例を描く（以後は各paint関数が切替）
buildSortFilter();
// チップ本体：モバイルはドックを開くまで作らない（初期DOMを軽量化）。デスクトップは即時構築。
if(matchMedia('(max-width:640px)').matches){ chipsEl.innerHTML=''; }
else buildChips();
} // initCatalog
// 種データ到着後：採番 → 図鑑UI構築 → 「準備完了」を通知（地図側はこれを await して描画）
__spData.then(d=>{ ANIMALS=d.animals; PHOTO_CRED=d.photoCred; ANIMALS.forEach((a,i)=>a.no=i+1); initCatalog(); __speciesDone(); })
        .catch(e=>{ console.error(e); if(typeof bootFail==='function') bootFail('種データを読み込めませんでした。'); __speciesDone(); });

/* ---------- セレクション ---------- */
function pressChip(id){ chipsEl.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.id===id?'true':'false')); }
function pressBiome(bm){ biomesEl.querySelectorAll('.bm').forEach(c=>c.setAttribute('aria-pressed',c.dataset.bm===bm?'true':'false')); }
function filterChips(bm){ filterState.biome=bm; applyFilters(); }
// 環境・検索・分類/傾向/保全 をAND結合して表示/非表示を決める（一元化）
function applyFilters(){
  const {biome:bm,q,facet}=filterState; let ft=null,fv=null;
  if(facet){ const i=facet.indexOf(':'); ft=facet.slice(0,i); fv=facet.slice(i+1); }
  chipsEl.querySelectorAll('.chip').forEach(c=>{
    let ok=true;
    if(bm && c.dataset.biome!==bm) ok=false;
    if(ok && q && !c.dataset.q.includes(q)) ok=false;
    if(ok && ft){
      if(ft==='cls')    ok=(c.dataset.cls===fv);
      else if(ft==='trend')  ok=(c.dataset.trend===fv);
      else if(ft==='status') ok=(c.dataset.status===fv);
      else if(ft==='threat') ok=THREAT.includes(c.dataset.status);
    }
    c.style.display=ok?'':'none';
  });
}
// チップの並び替え（DOM順を入れ替え。並び替え後は入場アニメを止めてスナップ）
function sortChips(mode){
  const so='CR EN VU NT LC DD';
  const cmps={
    'no':(a,b)=>(+a.dataset.no)-(+b.dataset.no),
    'pop-desc':(a,b)=>(+b.dataset.popnum)-(+a.dataset.popnum)||(+a.dataset.no)-(+b.dataset.no),
    'pop-asc':(a,b)=>{const x=+a.dataset.popnum,y=+b.dataset.popnum,xu=x<0,yu=y<0;
      if(xu&&yu)return (+a.dataset.no)-(+b.dataset.no); if(xu)return 1; if(yu)return -1; return x-y;},
    'status':(a,b)=>so.indexOf(a.dataset.status)-so.indexOf(b.dataset.status)||(+a.dataset.no)-(+b.dataset.no),
    'cls':(a,b)=>clsOrder.indexOf(a.dataset.cls)-clsOrder.indexOf(b.dataset.cls)||(+a.dataset.no)-(+b.dataset.no),
    'name':(a,b)=>a.dataset.name.localeCompare(b.dataset.name,'ja'),
  };
  const arr=[...chipsEl.querySelectorAll('.chip')]; arr.sort(cmps[mode]||cmps.no);
  arr.forEach(c=>{ c.style.animation='none'; c.style.animationDelay='0ms'; chipsEl.appendChild(c); });
}
// 並び替え/絞り込みセレクトを生成（実データに存在する分類・保全状況のみ）
function buildSortFilter(){
  const sortSel=$('#sortSel'), facetSel=$('#facetSel');
  sortSel.innerHTML=`<option value="no">№順（標準）</option>`
    +`<option value="pop-desc">生息数 多い順</option>`
    +`<option value="pop-asc">生息数 少ない順</option>`
    +`<option value="status">絶滅危機が高い順</option>`
    +`<option value="cls">分類ごと</option>`
    +`<option value="name">名前順（あいうえお）</option>`;
  const clsP=clsOrder.filter(k=>ANIMALS.some(a=>classOf(a)===k));
  const stL={CR:'近絶滅 CR',EN:'絶滅危惧 EN',VU:'危急 VU',NT:'準絶滅危惧 NT',LC:'軽度懸念 LC',DD:'データ不足 DD'};
  const stP='CR EN VU NT LC DD'.split(' ').filter(s=>ANIMALS.some(a=>a.status===s));
  facetSel.innerHTML=`<option value="">🔎 すべて表示</option>`
    +`<optgroup label="分類で">`+clsP.map(k=>`<option value="cls:${k}">${k}</option>`).join('')+`</optgroup>`
    +`<optgroup label="傾向で"><option value="trend:up">↑ 増えている</option><option value="trend:down">↓ 減っている</option><option value="trend:stable">→ 横ばい</option></optgroup>`
    +`<optgroup label="保全状況で">`
      +(stP.some(s=>THREAT.includes(s))?`<option value="threat:1">⚠ 絶滅危惧（CR・EN・VU）</option>`:'')
      +stP.map(s=>`<option value="status:${s}">${stL[s]}</option>`).join('')+`</optgroup>`;
  sortSel.onchange=()=>sortChips(sortSel.value);
  facetSel.onchange=()=>{ filterState.facet=facetSel.value; applyFilters(); };
}
function markSeen(id){ if(!SEEN.has(id)){ SEEN.add(id); localStorage.setItem('biosphere_seen',JSON.stringify([...SEEN])); const ch=chipsEl.querySelector(`.chip[data-id="${id}"]`); if(ch)ch.classList.add('is-seen'); updateDex(); celebrate(id); } }
function saveBadges(){ try{ localStorage.setItem('biosphere_badges',JSON.stringify([...BADGES])); }catch(e){} }
// コンプ演出：全種＞生息環境ごと＞保全状況ごと。既達成はBADGESで一度きり
function celebrate(id){
  const a=ANIMALS.find(x=>x.id===id); if(!a)return;
  if(SEEN.size>=ANIMALS.length){ if(!BADGES.has('ALL')){ BADGES.add('ALL'); saveBadges(); confetti(); toast('🏆',`図鑑コンプリート！全${ANIMALS.length}種を旅しました`,4600); } return; }
  const list=ANIMALS.filter(x=>x.biome===a.biome);
  if(list.every(x=>SEEN.has(x.id)) && !BADGES.has('biome:'+a.biome)){ BADGES.add('biome:'+a.biome); saveBadges();
    toast(BIOMES[a.biome].e, `${a.biome} の生きものをすべて発見！🎖️`, 3400); return; }
  const slist=ANIMALS.filter(x=>x.status===a.status);
  if(slist.every(x=>SEEN.has(x.id)) && !BADGES.has('status:'+a.status)){ BADGES.add('status:'+a.status); saveBadges();
    toast(RARITY[a.status].gem, `「${RARITY[a.status].band}（${a.status}）」をすべて発見！🎖️`, 3400); }
}
function confetti(){
  const cols=['#34d8c6','#f2c14e','#b072ff','#ff9a8a','#5fd39a'];
  for(let i=0;i<30;i++){ const d=document.createElement('div'); d.className='confetti';
    d.style.left=(Math.random()*100)+'vw'; d.style.background=cols[i%cols.length];
    d.style.animationDelay=(Math.random()*0.7).toFixed(2)+'s'; d.style.width=(6+Math.random()*6).toFixed(0)+'px';
    document.body.appendChild(d); setTimeout(()=>d.remove(),3600); }
}
function updateDex(){ const n=SEEN.size,t=ANIMALS.length; $('#dexNum').textContent=`${n}/${t}`; $('#dex').querySelector('.ring').style.setProperty('--p',Math.round(n/t*100)); $('#dexEmoji').textContent=n>=t?'🏆':(n>0?'🐾':'🧭'); }

async function selectAnimal(id){
  const a=await DATA.getAnimal(id); if(!a)return;
  removeNearbyVisuals();
  currentMode={type:'animal',id}; currentAnimal=a;
  pressChip(id); pressBiome(null); filterChips(null);
  paintAnimal(a); flyTo(a.focus.c,a.focus.z); renderAnimalCard(a); markSeen(id);
  try{ history.replaceState(null,'','#'+id); }catch(e){}   // 共有用ディープリンク
  setMode(animalModeText(a)); showYearbar(gbifOn);
}
async function selectBiome(bm){
  removeNearbyVisuals();
  currentMode={type:'biome',bm}; currentAnimal=null;
  pressBiome(bm); pressChip(null); filterChips(bm); paintBiome(bm); closePanel(); showYearbar(false);
  const list=await DATA.getAnimalsByBiome(bm);
  setMode(`${BIOMES[bm].e} ${bm} の住人 ${list.length}種`);
  if(list[0]) flyTo(list[0].focus.c, Math.max(1.6,list[0].focus.z-0.8));
}
async function showCountry(code, lngLat){
  if(!code)return; removeNearbyVisuals(); currentMode={type:'country',code}; currentAnimal=null; pressChip(null); showYearbar(false);
  const animals=await DATA.getAnimalsByCountry(code); paintCountry(code); renderCountryCard(code,animals);
  setMode(`${ccFlag(code)} ${ccName(code)} に棲むいきもの`);
  const center = lngLat ? [lngLat.lng,lngLat.lat] : countryCentroid(code);
  if(center){ stopSpin(); map.flyTo({center,zoom:3.4,speed:.8,curve:1.5,essential:true}); pulseArrival(); }
  fetchLocalSpecies(code);
}
// 国の重心（bbox中心）を求める
function countryCentroid(code){
  if(!countryGeo)return null;
  const f=countryGeo.features.find(ft=>ft.properties[CODE_PROP]===code); if(!f)return null;
  let minx=180,miny=90,maxx=-180,maxy=-90;
  const walk=(co)=>{ if(typeof co[0]==='number'){ if(co[0]<minx)minx=co[0]; if(co[0]>maxx)maxx=co[0]; if(co[1]<miny)miny=co[1]; if(co[1]>maxy)maxy=co[1]; } else co.forEach(walk); };
  walk(f.geometry.coordinates);
  return [(minx+maxx)/2,(miny+maxy)/2];
}
// 動物の分布国へズーム（その種の詳細メッシュを保ったまま寄る）
function flyCountry(code){ const c=countryCentroid(code); if(c){ stopSpin(); map.flyTo({center:c,zoom:4,speed:.85,curve:1.5,essential:true}); } }
// GBIF実データ：その国で多く記録される脊椎動物（taxonKey=44=脊索動物）
// 堅牢化：localStorageキャッシュで再訪を即時表示＋背景更新／連打はデバウンス／失敗・空でも図鑑情報は維持
const LS_GBIF='biosphere_gbif_';   // 国別ファセットのキャッシュ接頭辞（A2コード）
function gbifCacheGet(a2){ try{ const o=JSON.parse(localStorage.getItem(LS_GBIF+a2)||'null'); if(o&&(Date.now()-o.t)<6048e5) return o.c; }catch(e){} return null; } // 7日有効
function gbifCacheSet(a2,c){ try{ localStorage.setItem(LS_GBIF+a2,JSON.stringify({t:Date.now(),c})); }catch(e){} }
function renderLocalSpecies(el,counts,a2){
  el.innerHTML=counts.map(c=>{const disp=c.name.split(' ').slice(0,2).join(' ');
    return `<a class="locrow" target="_blank" rel="noopener" href="https://www.gbif.org/occurrence/search?country=${a2}&q=${encodeURIComponent(c.name)}"><span class="locav" data-sci="${encodeURIComponent(disp)}">🐾</span><span class="ln2">${esc(disp)}</span><span class="cnt2">${fmtN(c.count)}件 ↗</span></a>`;}).join('');
  // iNaturalistから実写真サムネを後追いで挿入
  el.querySelectorAll('.locav').forEach(async av=>{
    try{ const sci=decodeURIComponent(av.dataset.sci);
      const d=await (await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&rank=species&per_page=1`)).json();
      const ph=d.results&&d.results[0]&&d.results[0].default_photo&&d.results[0].default_photo.square_url;
      if(ph){ av.innerHTML=`<img src="${esc(ph)}" alt="${esc(sci)}" onload="this.style.opacity=1">`; }
    }catch(e){}
  });
}
let localTimer=null;
function fetchLocalSpecies(code){
  const el=document.getElementById('localspecies'); if(!el)return;
  const a2=A3toA2[code];
  if(!a2){ el.innerHTML='<span class="muted">この地域の実データは取得できませんでした。</span>'; return; }
  const cached=gbifCacheGet(a2);
  if(cached && cached.length){ renderLocalSpecies(el,cached,a2); }           // キャッシュを即時表示（再訪が速い）
  else { el.innerHTML='<span class="muted">🛰️ 実データを取得中…</span>'; }
  clearTimeout(localTimer);                                                   // 連打は最後の1回だけ叩く（レート配慮）
  localTimer=setTimeout(async()=>{
    try{
      const r=await fetch(`https://api.gbif.org/v1/occurrence/search?country=${a2}&taxonKey=44&hasCoordinate=true&limit=0&facet=scientificName&facetLimit=8`);
      const d=await r.json();
      const counts=(d.facets&&d.facets[0]&&d.facets[0].counts)||[];
      if(document.getElementById('localspecies')!==el) return;               // 別の国へ切替済みなら中断
      if(!counts.length){ if(!cached||!cached.length) el.innerHTML='<span class="muted">記録が見つかりませんでした。</span>'; return; }
      gbifCacheSet(a2,counts); renderLocalSpecies(el,counts,a2);              // 最新で上書き＆キャッシュ更新
    }catch(e){
      if(document.getElementById('localspecies')!==el) return;
      if(!cached||!cached.length) el.innerHTML='<span class="muted">実データ取得に失敗しました（オフライン？）。図鑑情報はそのままご覧いただけます。</span>';
    }
  },250);
}
function fmtN(n){ return n>=1000? (n/1000).toFixed(n>=10000?0:1)+'k' : String(n); }
function resetAll(){ pressChip(null); pressBiome(null); removeNearbyVisuals();
  filterState.biome=null; filterState.facet=''; filterState.q='';
  const ss=$('#sortSel'),fs=$('#facetSel'),sr=$('#search'); if(fs)fs.value=''; if(sr)sr.value=''; if(ss)ss.value='no';
  sortChips('no'); applyFilters(); closePanel(); drawOverview();
  map.flyTo({center:[18,16],zoom:1.45,speed:.7,curve:1.5,essential:true}); }
function explore(){
  // まだ見ていない種を優先してランダムに（全部見たら全体から）
  const pool = ANIMALS.filter(a=>!SEEN.has(a.id));
  const from = pool.length ? pool : ANIMALS;
  const pick = from[Math.floor(Math.random()*from.length)];
  toast('🎲', `気ままに ${pick.nameJa} の世界へ…`, 2200);
  selectAnimal(pick.id);
}

/* ---------- パネル ---------- */
const panelEl=$('#panel');
function openPanel(){ panelEl.classList.add('open'); }
function closePanel(){ panelEl.classList.remove('open'); }
// モバイルのシート高さ：近くの一覧/詳細は中間（地図＋生き物を上に見せる）、種/国カードは通常（full）。
function panelSheet(mid){ panelEl.classList.toggle('sheet-mid', !!mid); }
function renderAnimalCard(a){
  const r=RARITY[a.status], g=BIOMES[a.biome]?BIOMES[a.biome].g:['#1b3a43','#0d1b22'], tm=TREND_META[trendOf(a)];
  const cred=PHOTO_CRED[a.id]||{by:'Wikimedia Commons',lic:''};
  panelEl.innerHTML=`
    <button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button>
    <div class="grab"></div>
    <div class="hero" style="background:linear-gradient(140deg,${g[0]},${g[1]})">
      <div class="emojibg">${a.emoji}</div>
      <img class="bgph" src="${a.photo}" alt="${a.nameJa}" onload="this.classList.add('loaded')" onerror="this.remove()">
      <div class="scrim"></div>
      <div class="no">№ ${String(a.no).padStart(3,'0')}</div>
      <div class="htext"><div class="nm">${a.nameJa}</div><div class="sci">${a.nameSci}</div></div>
      <a class="phcred" href="${commonsPageURL(a.photo)}" target="_blank" rel="noopener" title="写真の出典（Wikimedia Commons）">📷 ${cred.by}${cred.lic?(' · '+cred.lic):''}</a>
    </div>
    <div class="pbody">
      <div class="row1"><span class="tax">🧬 ${a.taxon}</span><span class="tax">${BIOMES[a.biome].e} ${a.biome}</span><button class="tax pshare" onclick="shareFigureCard('${a.id}',this)">🔗 共有</button></div>
      <div class="rare" style="background:${hexA(r.color,.1)}">
        <span class="glowbar" style="background:${r.color};box-shadow:0 0 14px ${r.color}"></span>
        <span class="gem" style="color:${r.color}">${r.gem}</span>
        <span class="popwrap"><span class="poplabel">推定生息数（野生）</span><span class="popline"><span class="popval" style="color:${r.color}">${popOf(a)}</span><span class="trend" style="color:${tm.c}">${tm.a} ${tm.t}</span></span><span class="popsrc">出典 <a href="${iucnURL(a)}" target="_blank" rel="noopener">IUCN ↗</a><a href="${gbifURL(a)}" target="_blank" rel="noopener">GBIF ↗</a></span></span>
        <button type="button" class="iucn" onclick="openRedlist('${a.status}','${a.id}')" title="保全状況（IUCNレッドリスト）の意味を見る"><span class="code" style="background:${r.color}">${a.status}<span class="qm">?</span></span><span class="jp">${r.jp}・${r.band}</span></button>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">📏 大きさ</div><div class="v">${a.stats.size}</div></div>
        <div class="stat"><div class="k">⚖️ 体重</div><div class="v">${a.stats.weight}</div></div>
        <div class="stat"><div class="k">🍖 食性</div><div class="v">${a.stats.diet}</div></div>
        <div class="stat"><div class="k">⏳ 寿命</div><div class="v">${a.stats.life}</div></div>
      </div>
      <div class="flavor">${a.desc}</div>
      ${['CR','EN','VU','NT','DD'].includes(a.status)?`<div class="conserv">
        <div class="cvhead">🛡 おもな脅威と保全 <span class="cvst" style="color:${r.color}">${r.jp}（${a.status}）</span></div>
        <div class="cvtags">${threatsOf(a).map(t=>`<span class="cvtag">${t}</span>`).join('')}</div>
        <div class="cvlinks">${conservLinks(a).map(x=>`<a href="${x.u}" target="_blank" rel="noopener">${x.l} ↗</a>`).join('')}<button type="button" class="cvmore" onclick="openRedlist('${a.status}','${a.id}')">保全状況とは？</button></div>
      </div>`:''}
      <div class="seclab">生息地 — ${a.range.length}地域（タップで寄る） <span class="ln"></span></div>
      <div class="geos">${a.range.map(c=>`<button class="geo" onclick="flyCountry('${c}')"><span class="fl">${ccFlag(c)}</span>${ccName(c)}</button>`).join('')}</div>
      <div class="gbifnote">🛰️ 地図の<b>メッシュ</b>＝GBIFの実観測地点（${a.nameSci}）。<b>ズームするほど分布が細かく</b>見えます。だれかが実際にこの生きものを見た場所です。</div>
      ${MIGRATION[a.id]?`<div class="gbifnote mignote">🧭 <b>季節移動</b>：${MIGRATION[a.id].note}。地図に<span style="color:#ffd45e;font-weight:700">繁殖↔越冬の経路</span>（模式）を表示中。</div>`:''}
    </div>`;
  panelSheet(false); openPanel();
}
function renderCountryCard(code,animals){
  const rows=animals.length? animals.map(a=>{const r=RARITY[a.status];
    return `<button class="cc-item" onclick="selectAnimal('${a.id}')">${avatar(a)}
      <span class="info"><span class="n">${a.nameJa}</span><span class="s">${a.nameSci}</span></span>
      <span class="rkbadge" style="background:${r.color}">${r.band}</span></button>`;}).join('')
    : `<div class="cc-empty">図鑑の${ANIMALS.length}種ではこの地域の登録がありません。<br>下の<b>GBIF実データ</b>には、その土地で実際に記録された生きものが出ます。</div>`;
  panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
    <div class="cc-head"><div class="lbl">この土地に棲む</div>
      <div class="cname"><span class="cflag">${ccFlag(code)}</span>${ccName(code)}</div>
      <div class="cnt">${animals.length?`図鑑の${animals.length}種が確認されています`:'図鑑では登録なし'}</div></div>
    ${animals.length?'<div class="seclab" style="margin:4px 16px 8px">🐾 図鑑の種 <span class="ln"></span></div>':''}
    <div class="cc-list">${rows}</div>
    <div class="seclab" style="margin:8px 16px 9px">🛰️ GBIF実データ：この国で多く記録される生きもの <span class="ln"></span></div>
    <div id="localspecies" class="locsp">実データを取得中…</div>`;
  panelSheet(false); openPanel();
}
function shareAnimal(id){
  const url = location.origin + location.pathname + '#' + id;
  if(navigator.share){ navigator.share({title:'BIOSPHERE — いきもの分布アトラス', url}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>toast('🔗','リンクをコピーしました',1900)).catch(()=>toast('🔗',url,3200)); }
  else { toast('🔗',url,3200); }
}
function openAbout(){ $('#about').removeAttribute('hidden'); }
function closeAbout(){ $('#about').setAttribute('hidden',''); }
/* レッドリスト解説モーダル：階段で意味を示し、種を指定するとその位置を強調＋IUCN導線。下部に図鑑の危機サマリ。 */
function openRedlist(status, id){
  const a = id ? ANIMALS.find(x=>x.id===id) : null;
  const cur = status || (a && a.status) || null;
  let banner='';
  if(a){
    const m=RL[a.status]||{jp:'',color:'#888'};
    banner=`<div class="rl-now" style="border-left-color:${m.color}">
      <span class="em">${a.emoji}</span>
      <span class="t"><b>${a.nameJa}</b> は現在<br><span class="nc" style="background:${m.color}">${a.status}</span><b>${m.jp}</b></span>
      <a class="ln" href="${iucnURL(a)}" target="_blank" rel="noopener">IUCNで見る ↗</a></div>`;
  }
  let rows='', threatOpened=false;
  REDLIST.forEach(r=>{
    if(THREAT.includes(r.code) && !threatOpened){ rows+=`<div class="rl-glabel">⚠ 絶滅危惧種（Threatened）</div>`; threatOpened=true; }
    const isCur=cur===r.code, th=THREAT.includes(r.code);
    const lb=(isCur||th)?r.color:'transparent';
    const hi=isCur?`background:${hexA(r.color,.15)};border-color:${r.color};box-shadow:0 0 0 1px ${r.color} inset;`:'';
    rows+=`<div class="rl-row${isCur?' cur':''}" style="border-left-color:${lb};${hi}">
      <span class="code" style="background:${r.color}">${r.code}</span>
      <span class="tx"><b>${r.jp}</b><i>${r.en}</i><span class="mean">${r.mean}</span></span></div>`;
  });
  const cnt={}; ANIMALS.forEach(x=>cnt[x.status]=(cnt[x.status]||0)+1);
  const nThreat=THREAT.reduce((s,c)=>s+(cnt[c]||0),0);
  const chips=REDLIST.filter(r=>cnt[r.code]).map(r=>
    `<button class="rl-chip" style="border-left-color:${r.color}" onclick="filterStatus('${r.code}')">${r.code} ${r.jp.split('（')[0]}<b style="color:${r.color}">${cnt[r.code]}</b></button>`).join('');
  const summary=`<div class="rl-summary">
    <div class="rl-sumtitle">この図鑑の <b>${ANIMALS.length}種</b> のうち <b style="color:#ffb02e">${nThreat}種</b> が<b>絶滅の危機</b>（CR・EN・VU）にあります。バッジを押すと図鑑をしぼれます。</div>
    <button class="rl-threatbtn" onclick="filterThreat()">⚠ 絶滅危惧の ${nThreat}種 をしぼって見る　→</button>
    <div class="rl-sumchips">${chips}</div></div>`;
  $('#rlBody').innerHTML = banner
    + `<p class="rl-lead">国際自然保護連合（IUCN）の<b>レッドリスト</b>は、生きものの絶滅リスクを評価した世界共通のものさし。上ほど危機的で、<b>CR・EN・VU</b>をまとめて「絶滅危惧種」と呼びます。</p>`
    + `<div class="rl-ladder">${rows}</div>`
    + summary;
  $('#redlist').removeAttribute('hidden');
}
function closeRedlist(){ $('#redlist').setAttribute('hidden',''); }
// モバイルで図鑑ドックが畳まれたまま絞り込むと「絞ったのに何も見えない」になるため、ドックを開きチップを構築してから適用する。
function ensureCatalogVisible(){ if(!matchMedia('(max-width:640px)').matches) return;
  const d=$('#dock'); if(d&&!d.classList.contains('open')){ d.classList.add('open'); const t=$('#dockToggle'); if(t)t.setAttribute('aria-expanded','true'); }
  if(typeof buildChips==='function') buildChips(); }
function filterStatus(code){ const fs=$('#facetSel'); filterState.facet='status:'+code; if(fs)fs.value='status:'+code; ensureCatalogVisible(); applyFilters(); closeRedlist(); toast('🔎',(RL[code]?RL[code].jp.split('（')[0]:code)+'でしぼりました',1900); }
function filterThreat(){ const fs=$('#facetSel'); filterState.facet='threat:1'; if(fs)fs.value='threat:1'; ensureCatalogVisible(); applyFilters(); closeRedlist(); toast('⚠','絶滅危惧（CR・EN・VU）でしぼりました',2000); }
window.closePanel=closePanel; window.showCountry=showCountry; window.selectAnimal=selectAnimal;
window.flyCountry=flyCountry; window.shareAnimal=shareAnimal; window.closeAbout=closeAbout;
window.openRedlist=openRedlist; window.closeRedlist=closeRedlist; window.filterStatus=filterStatus; window.filterThreat=filterThreat;

/* ---------- 地図ホバー（国＝代表5種の実写真／ズーム時＝この辺りの実観測＋地名）---------- */
const ZOOM_LOCAL_HOVER=6;   // この拡大率以上で「国」→「この辺り」のローカル表示に切替
function thumbHTML(photo,name,emoji){
  return `<span class="mt-th"><span class="mt-im">${photo?`<img src="${esc(photo)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${emoji||''}'">`:(emoji||'')}</span><b>${esc(name)}</b></span>`;
}
function countryHoverHTML(code,name){
  const here=ANIMALS.filter(a=>a.range.includes(code)).slice(0,5);   // 代表5種まで（図鑑掲載順）
  const thumbs=here.length
    ? `<div class="mt-thumbs">${here.map(a=>thumbHTML(a.photo,a.nameJa,a.emoji)).join('')}</div>`
    : `<div class="mt-sub">図鑑の代表種は未登録（クリックで実データを表示）</div>`;
  return `<div class="mt-name">${ccFlag(code)} ${esc(name)}</div>${thumbs}`;
}
// ⑤ ズーム時：カーソル付近の地名（OFMベクタータイルの地名ラベルをローカル取得＝ネットワーク不要）＋GBIF実観測の代表5種。
let _lhTimer=null, _lhKey=null; const _lhCache={};   // 種サムネ部分のみグリッドキャッシュ（地名は都度ローカル取得で最新）
function cancelLocalHover(){ clearTimeout(_lhTimer); _lhKey=null; }
// OFMの地名ラベル(place source-layer)から、カーソル付近の最も細かい地名を拾う（逆ジオコーディング不要）。
function getPlaceNameAt(point){
  if(typeof ofmLoaded==='undefined'||!ofmLoaded||!point) return '';
  let feats=[]; try{ feats=map.queryRenderedFeatures([[point.x-50,point.y-50],[point.x+50,point.y+50]]).filter(f=>f.sourceLayer==='place'); }catch(e){ return ''; }
  if(!feats.length) return '';
  const rank={neighbourhood:0,suburb:1,quarter:1,hamlet:2,village:3,town:4,island:4,city:5,county:6,state:7,province:7,region:7};
  feats.sort((a,b)=>(rank[a.properties.class]==null?9:rank[a.properties.class])-(rank[b.properties.class]==null?9:rank[b.properties.class]));
  const pr=feats[0].properties; return pr['name:ja']||pr.name||pr['name:latin']||'';
}
function localHover(lngLat, point){
  const lat=lngLat.lat, lng=lngLat.lng, gk=(Math.round(lat*20)/20)+','+(Math.round(lng*20)/20);   // ~5kmグリッド
  const tip=$('#maptip'), place=getPlaceNameAt(point)||'この辺り';
  _lhKey=gk;
  if(_lhCache[gk]){ tip.innerHTML=`<div class="mt-name">📍 ${esc(place)}</div>`+_lhCache[gk]; tip.classList.add('show'); refillHoverPhotos(tip,gk); return; }
  tip.innerHTML=`<div class="mt-name">📍 ${esc(place)}</div><div class="mt-sub">この辺りの生き物を確認中…</div>`; tip.classList.add('show');
  clearTimeout(_lhTimer); _lhTimer=setTimeout(()=>fetchLocalHover(lat,lng,gk,place),420);
}
async function fetchLocalHover(lat,lng,gk,place){
  const tip=$('#maptip'), y2=new Date().getFullYear(), y1=y2-10;
  let sp=[];
  try{ // クラス別に取得→各クラス上位をマージ（ホバーでも鳥だらけにしない）
    const per=await Promise.all(GBIF_VERT_GROUPS.map(g=> gbifFacetNear(lat,lng,8,g.keys,6,y1,y2).then(rows=>rows.slice(0,g.c==='Aves'?1:2))));
    const seen=new Map(); per.flat().forEach(c=>{ const key=c.name.toLowerCase(),cur=seen.get(key); if(!cur||cur.count<c.count) seen.set(key,c); });
    sp=[...seen.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  }catch(e){}
  const thumbs = sp.length
    ? `<div class="mt-thumbs">${sp.map(c=>{const cat=ANIMALS.find(a=>(a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===c.name.toLowerCase());
        return `<span class="mt-th" data-sci="${esc(c.name)}"><span class="mt-im">${cat?`<img src="${esc(cat.photo)}" alt="">`:''}</span><b>${esc(cat?cat.nameJa:c.name)}</b></span>`;}).join('')}</div>`
    : '<div class="mt-sub">この辺りのGBIF実観測は見つかりませんでした</div>';
  _lhCache[gk]=thumbs;
  if(_lhKey===gk){ tip.innerHTML=`<div class="mt-name">📍 ${esc(place||'この辺り')}</div>`+thumbs; tip.classList.add('show'); refillHoverPhotos(tip,gk); }
}
// 図鑑外の種は iNat 写真を後追い（このtipが同じグリッドを指す間だけ）。絵文字は使わず、未取得は空サムネ。
function refillHoverPhotos(tip,gk){
  tip.querySelectorAll('.mt-th[data-sci]').forEach(thmb=>{ const im=thmb.querySelector('.mt-im'); if(!im||im.querySelector('img'))return;   // 図鑑種は写真済み→スキップ
    const sci=thmb.getAttribute('data-sci');
    inatEnqueue(async()=>{ const v=await inatResolve(sci); if(_lhKey!==gk)return;
      const im2=thmb.querySelector('.mt-im'); if(im2&&!im2.querySelector('img')&&v&&v.ph) im2.innerHTML=`<img src="${esc(v.ph)}" alt="">`;
      const b=thmb.querySelector('b'); if(b&&v&&v.ja) b.textContent=v.ja; });   // 和名も補完
  });
}

/* ---------- 地図インタラクション ---------- */
function bindMap(){
  map.on('click','c-fill',(e)=>{ if(nearPick)return; showCountry(e.features[0].properties[CODE_PROP], e.lngLat); });
  map.on('click',(e)=>{ if(nearPick){ setNearPin(e.lngLat.lat,e.lngLat.lng,'指定地点',nearState?nearState.radius:NEAR_DEFAULT_R); return; } if(!map.queryRenderedFeatures(e.point,{layers:['c-fill']}).length) closePanel(); });
  const tip=$('#maptip');
  map.on('mousemove','c-fill',(e)=>{
    const f=e.features[0], code=f.properties[CODE_PROP];
    map.setFilter('c-hover',['==',['get',CODE_PROP],code]); map.getCanvas().style.cursor='pointer';
    if(map.getZoom()>=ZOOM_LOCAL_HOVER){ localHover(e.lngLat, e.point); return; }   // ⑤ ズーム時＝この辺りの実観測＋地名
    cancelLocalHover();
    const name=f.properties.NAME_JA||(CC[code]?CC[code][0]:null)||f.properties.NAME||f.properties.ADMIN||code;
    tip.innerHTML=countryHoverHTML(code,name);   // ④ 国名＋代表5種（実写真）
    tip.classList.add('show');
  });
  map.on('mousemove',(e)=>{const t=$('#maptip');t.style.left=(e.originalEvent.clientX+14)+'px';t.style.top=(e.originalEvent.clientY+14)+'px';});
  map.on('mouseleave','c-fill',()=>{ map.setFilter('c-hover',['==',['get',CODE_PROP],'__none__']); map.getCanvas().style.cursor=''; $('#maptip').classList.remove('show'); cancelLocalHover(); });
}

