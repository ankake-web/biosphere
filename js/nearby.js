/* ---------- 近くの生き物（脊椎動物・Chordata=taxonKey44） ----------
   現在地→GBIF geoDistance facet で周辺の種一覧→iNatで和名/写真を遅延付与。
   プライバシー：座標は~1km丸めしGBIF/iNatの問い合わせにのみ使用（保存はローカルのみ）。 */
const NEAR_RADII=[1,3,5,10,30,50,100];                       // 半径(km)の選択肢
const ZOOM_BY_R={1:13.2,3:11.9,5:11,10:10,30:8.4,50:7.6,100:6.6};  // 半径→ズーム（円が収まる程度）
const NEAR_DEFAULT_R=10;
const NEAR_PRESETS=[['東京',35.68,139.76],['大阪',34.69,135.50],['札幌',43.06,141.35],['那覇',26.21,127.68],['ニューヨーク',40.71,-74.01],['ロンドン',51.51,-0.13],['シンガポール',1.35,103.82],['シドニー',-33.87,151.21],['ナイロビ',-1.29,36.82],['リオデジャネイロ',-22.91,-43.17]];
const NEAR_ICONIC={Aves:'鳥類',Mammalia:'哺乳類',Reptilia:'爬虫類',Amphibia:'両生類',Actinopterygii:'魚類',Chondrichthyes:'魚類（軟骨魚）'};
const NEAR_CLASSES=[['','すべて'],['Aves','🐦鳥'],['Mammalia','🦫哺乳'],['Reptilia','🦎爬虫'],['Amphibia','🐸両生'],['Fish','🐟魚']];
const LS_NEAR='biosphere_near_', LS_INAT='biosphere_inat_', LS_SKEY='biosphere_skey_', LS_IUCN='biosphere_iucn_';
const THREAT_CATS=new Set(['VU','EN','CR']);   // 絶滅危惧（Threatened）
let nearState=null;                 // {lat,lng,radius,label}
let nearMarker=null, nearPick=false, nearTimer=null, nearClass='', nearThreatOnly=false, nearRows=[], nearPtsOn=false;
function nearKey(lat,lng,r){ return lat.toFixed(2)+','+lng.toFixed(2)+'@'+r; }
function classMatch(ic){ if(!nearClass)return true; if(nearClass==='Fish')return ic==='Actinopterygii'||ic==='Chondrichthyes'; return ic===nearClass; }
// iNat学名キャッシュ（30日）／近傍ファセットキャッシュ（1日）
function inatGet(s){ try{const o=JSON.parse(localStorage.getItem(LS_INAT+s)||'null'); if(o&&(Date.now()-o.t)<2592e6)return o.v;}catch(e){} return null; }
function inatSet(s,v){ try{localStorage.setItem(LS_INAT+s,JSON.stringify({t:Date.now(),v}));}catch(e){} }
function nearCacheGet(k){ try{const o=JSON.parse(localStorage.getItem(LS_NEAR+k)||'null'); if(o&&(Date.now()-o.t)<864e5)return o.c;}catch(e){} return null; }
function nearCacheSet(k,c){ try{localStorage.setItem(LS_NEAR+k,JSON.stringify({t:Date.now(),c}));}catch(e){} }
// iNat呼び出しはthrottle（同時3・間隔120ms）で礼儀正しく
let inatQueue=[], inatBusy=0;
function inatEnqueue(fn){ inatQueue.push(fn); pumpInat(); }
function pumpInat(){ while(inatBusy<3 && inatQueue.length){ const fn=inatQueue.shift(); inatBusy++; Promise.resolve(fn()).catch(()=>{}).finally(()=>{ inatBusy--; setTimeout(pumpInat,120); }); } }
async function inatResolve(sci){
  const c=inatGet(sci); if(c) return c;
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&rank=species&per_page=1&locale=ja`);
      if(r.status===429){ await new Promise(s=>setTimeout(s,1500*(i+1))); continue; }
      const d=await r.json(), x=d.results&&d.results[0], dp=x&&x.default_photo;
      const at=(dp&&dp.attribution||'').replace(/<[^>]*>/g,'').replace(/\(c\)/gi,'©');
      const v=x?{ja:x.preferred_common_name||'',ph:(dp&&dp.square_url)||'',ic:x.iconic_taxon_name||'',st:(x.conservation_status&&x.conservation_status.status_name)||'',at}:{ja:'',ph:'',ic:'',st:'',at:''};
      inatSet(sci,v); return v;
    }catch(e){ await new Promise(s=>setTimeout(s,600)); }
  }
  return {ja:'',ph:'',ic:'',st:'',at:''};
}
// GBIF種キー解決（species/match、localStorageキャッシュ）＝月別/観測点に使用
async function resolveSpeciesKey(sci){
  try{ const c=localStorage.getItem(LS_SKEY+sci); if(c)return c==='0'?null:+c; }catch(e){}
  try{ const j=await (await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sci)}`)).json();
    const k=j.usageKey||j.speciesKey||0; try{localStorage.setItem(LS_SKEY+sci,String(k||0));}catch(e){} return k||null;
  }catch(e){ return null; }
}
// 保全状況（IUCNカテゴリ）を GBIF から直接取得（IUCN APIの商用制約を回避）。RARITYコードへ写像しキャッシュ。
const STMAP_I={LEAST_CONCERN:'LC',NEAR_THREATENED:'NT',VULNERABLE:'VU',ENDANGERED:'EN',CRITICALLY_ENDANGERED:'CR',DATA_DEFICIENT:'DD',NOT_EVALUATED:'NE',EXTINCT_IN_THE_WILD:'EW',EXTINCT:'EX'};
function iucnGet(s){ try{const v=localStorage.getItem(LS_IUCN+s); return v===null?undefined:v;}catch(e){return undefined;} }
function iucnSet(s,v){ try{localStorage.setItem(LS_IUCN+s,v);}catch(e){} }
async function resolveIucn(sci){
  const c=iucnGet(sci); if(c!==undefined) return c;
  const key=await resolveSpeciesKey(sci); if(!key){ iucnSet(sci,''); return ''; }
  try{ const r=await fetch(`https://api.gbif.org/v1/species/${key}/iucnRedListCategory`);
    if(r.ok){ const j=await r.json(); const code=STMAP_I[j.category]||''; iucnSet(sci,code); return code; } }catch(e){}
  iucnSet(sci,''); return '';
}
// GBIF scientificName facet を二名に正規化＆統合（種に限定）
function mergeBinomials(counts){
  const m=new Map();
  for(const c of counts){ const p=(c.name||'').trim().split(/\s+/);
    if(p.length<2||!/^[A-Z][a-zé-]+$/.test(p[0])||!/^[a-zé-]+$/.test(p[1])) continue;
    const key=p[0]+' '+p[1]; m.set(key,(m.get(key)||0)+c.count); }
  return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
}
function renderNearShell(title,inner){
  panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
    <div class="cc-head"><div class="lbl">📍 あなたの近く</div><div class="cname">${title}</div></div>
    <div class="nearbody">${inner}</div>`;
}
function openNearby(){
  closePanel(); stopSpin();
  if(!('geolocation' in navigator)){ nearbyFallback('お使いの環境では現在地を取得できません。'); return; }
  renderNearShell('近くの生き物','<div class="nearsum">現在地を確認しています…<br><span style="color:#9fb0bd">ブラウザの確認ダイアログで「許可」を選んでください。</span></div>'); openPanel();
  navigator.geolocation.getCurrentPosition(
    pos=>setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',NEAR_DEFAULT_R),
    err=>nearbyFallback(err&&err.code===1?'位置情報の利用が許可されませんでした。':'現在地を取得できませんでした。'),
    {enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}
function nearbyFallback(msg){
  const chips=NEAR_PRESETS.map(([n,la,lo])=>`<button class="nbchip" onclick="setNearPin(${la},${lo},'${n}',NEAR_DEFAULT_R)">${n}</button>`).join('');
  renderNearShell('近くの生き物',
    `<div class="nearsum">${msg}</div>
     <div class="nbhint">場所を選ぶ、または<b>地図をタップ</b>して指定してください。</div>
     <div class="nbchips">${chips}</div>`);
  openPanel(); nearPick=true; toast('📍','地図をタップして場所を指定できます',2600);
}
// 任意地点に「ピン」を置く（現在地/都市/タップ/ドラッグ 共通の入口）
function setNearPin(latRaw,lngRaw,label,radius){
  const lat=Math.round(latRaw*100)/100, lng=Math.round(lngRaw*100)/100;   // ~1km丸め（プライバシー）
  nearPick=false; currentAnimal=null;
  nearState={lat,lng,radius:radius||(nearState&&nearState.radius)||NEAR_DEFAULT_R,label:label||'指定地点'};
  currentMode={type:'near',lat,lng};
  setMode('📍 '+nearState.label+'の近くの生き物'); showYearbar(false);
  removeNearPoints(); nearClass=''; nearThreatOnly=false;
  drawNearVisuals(lat,lng,nearState.radius);
  stopSpin(); map.flyTo({center:[lng,lat],zoom:ZOOM_BY_R[nearState.radius]||9,speed:.9,curve:1.4,essential:true});
  queryNear();
  saveLastLoc(lat,lng,nearState.radius);   // 次回起動のフォールバック（前回の場所）に記録
}
function setNearRadius(r){ if(!nearState)return; nearState.radius=r; removeNearPoints();
  drawNearVisuals(nearState.lat,nearState.lng,r);
  map.flyTo({center:[nearState.lng,nearState.lat],zoom:ZOOM_BY_R[r]||9,speed:.8,curve:1.3,essential:true});
  queryNear(); }
function setNearClass(c){ nearClass=c; if(nearState) renderNearList(); }
function armNearPick(){ nearPick=true; toast('📌','地図をタップすると、その地点に移動します',2400); }
function recenterCurrent(){
  if(!('geolocation' in navigator)){ toast('📍','現在地を取得できません',2000); return; }
  toast('📍','現在地を確認しています…',1800);
  navigator.geolocation.getCurrentPosition(
    pos=>setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',nearState?nearState.radius:NEAR_DEFAULT_R),
    ()=>toast('📍','現在地を取得できませんでした',2200),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}
// GBIFファセットで近傍の種一覧を取得→nearRowsへ
function queryNear(){
  const {lat,lng,radius}=nearState, k=nearKey(lat,lng,radius), cached=nearCacheGet(k);
  if(cached&&cached.length){ nearRows=cached.map(c=>({name:c.name,count:c.count})); renderNearList(); }
  else { nearRows=[]; renderNearList('<div class="nearsum">🛰️ 周辺の記録を集めています…</div>'); }
  clearTimeout(nearTimer);
  nearTimer=setTimeout(async()=>{
    const y2=new Date().getFullYear(), y1=y2-10;
    try{
      const url=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km&taxonKey=44&hasCoordinate=true&year=${y1},${y2}&limit=0&facet=scientificName&facetLimit=80`;
      const d=await (await fetch(url)).json();
      let counts=mergeBinomials((d.facets&&d.facets[0]&&d.facets[0].counts)||[]).slice(0,40);
      if(!currentMode||currentMode.type!=='near'||nearKey(currentMode.lat,currentMode.lng,nearState.radius)!==k) return;
      if(!counts.length){ nearRows=[]; renderNearList('<div class="nearsum">この範囲の脊椎動物の記録は見つかりませんでした。半径を広げるか場所を変えてみてください。</div>'); return; }
      nearCacheSet(k,counts); nearRows=counts.map(c=>({name:c.name,count:c.count})); renderNearList();
    }catch(e){
      if(!currentMode||currentMode.type!=='near') return;
      if(!nearRows.length) renderNearList('<div class="nearsum">実データの取得に失敗しました（オフライン？）。少し時間をおいて再度お試しください。</div>');
    }
  },250);
}
function nearControlsHTML(){
  const rchips=NEAR_RADII.map(r=>`<button class="rchip${nearState.radius===r?' on':''}" onclick="setNearRadius(${r})">${r}km</button>`).join('');
  const cchips=NEAR_CLASSES.map(([k,l])=>`<button class="cchip${nearClass===k?' on':''}" onclick="setNearClass('${k}')">${l}</button>`).join('');
  return `<div class="nearctl">
    <div class="ctlrow"><span class="ctll">半径</span><div class="rchips">${rchips}</div></div>
    <div class="ctlrow"><span class="ctll">種別</span><div class="cchips">${cchips}</div></div>
    <div class="ctlrow ctlbtns"><button class="nbtn" onclick="recenterCurrent()">📍 現在地</button><button class="nbtn" onclick="armNearPick()">📌 タップで移動</button><button class="nbtn" onclick="shareNearCard(this)">📤 シェア</button></div>
  </div>`;
}
function renderNearList(overrideInner){
  if(!nearState)return;
  const controls=nearControlsHTML();
  if(overrideInner){ renderNearShell(nearState.label+'の近く', controls+overrideInner); openPanel(); return; }
  const rows=nearRows.map((c,i)=>{const sci=c.name, e=encodeURIComponent(sci);
    const cat=ANIMALS.find(a=>(a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===sci.toLowerCase());
    return `<button class="locrow nearrow" data-sci="${sci}" data-cnt="${c.count}" data-i="${i}" onclick="openNearDetail(this)">
      <span class="locav" data-sci="${e}">🐾</span>
      <span class="ln2"><b class="nja">${c.ja||'…'}</b><span class="nsci">${sci}</span></span>
      ${cat?'<span class="catbadge" title="図鑑に収録">📖</span>':''}
      <span class="cnt2">${fmtN(c.count)}件</span></button>`;}).join('');
  renderNearShell(nearState.label+'の近く',
    controls+
    `<div class="nearsum" id="nearsum">この範囲で記録の多い脊椎動物 <b>${nearRows.length}種</b><br><span style="color:#9fb0bd">半径${nearState.radius}km・GBIF実観測（タップで詳細／📖は図鑑収録）</span></div>
     <div class="locsp" id="nearlist">${rows}</div>`);
  openPanel(); resolveAllRows();
}
// 全行のiNat（和名/写真/クラス）を throttle で解決＝クラス絞り込みも可能に
function resolveAllRows(){
  nearRows.forEach((c,i)=>{
    if(c.done){ applyRowDom(i); return; }
    inatEnqueue(async()=>{ const v=await inatResolve(c.name); Object.assign(c,v); c.st2=await resolveIucn(c.name); c.done=true; applyRowDom(i); applyNearFilter(); });
  });
  applyNearFilter();
}
function applyRowDom(i){
  const row=document.querySelector(`#nearlist .nearrow[data-i="${i}"]`); if(!row)return;
  const c=nearRows[i], av=row.querySelector('.locav'), ja=row.querySelector('.nja');
  if(c.ph&&av&&!av.querySelector('img')) av.innerHTML=`<img src="${c.ph}" alt="" onload="this.style.opacity=1">`;
  if(ja) ja.textContent=c.ja||'（和名なし）';
  row.dataset.ic=c.ic||''; row.dataset.th=THREAT_CATS.has(c.st2)?'1':'';
  // 保全状況ピル（絶滅危惧VU/EN/CRのみ強調＝レア度カラー）
  if(THREAT_CATS.has(c.st2) && RARITY[c.st2]){
    let pill=row.querySelector('.stpill');
    if(!pill){ pill=document.createElement('span'); pill.className='stpill'; row.insertBefore(pill,row.querySelector('.cnt2')); }
    pill.style.background=RARITY[c.st2].color; pill.textContent='⚠'+c.st2; pill.title=RARITY[c.st2].jp+'（絶滅危惧）';
    row.classList.add('threat');
  }
}
function toggleNearThreat(){ nearThreatOnly=!nearThreatOnly; applyNearFilter(); }
function applyNearFilter(){
  let vis=0, thCount=0;
  document.querySelectorAll('#nearlist .nearrow').forEach(row=>{
    const c=nearRows[+row.dataset.i]; const th=THREAT_CATS.has(c.st2); if(th)thCount++;
    const show=(!nearClass||(c.done?classMatch(c.ic):false)) && (!nearThreatOnly||th);
    row.style.display=show?'':'none'; if(show)vis++;
  });
  const sum=document.getElementById('nearsum'); if(!sum)return;
  const thChip=`<button class="thsum${nearThreatOnly?' on':''}" onclick="toggleNearThreat()">⚠ 近くの絶滅危惧 <b>${thCount}</b>種${nearThreatOnly?'（解除）':''}</button>`;
  let head;
  if(nearThreatOnly) head=`この範囲の<b>絶滅危惧</b> <b>${vis}種</b>`;
  else if(nearClass){ const lab=(NEAR_CLASSES.find(x=>x[0]===nearClass)||['',''])[1]; head=`<b>${lab}</b>でしぼり込み <b>${vis}種</b>`; }
  else head=`この範囲で記録の多い脊椎動物 <b>${nearRows.length}種</b>`;
  sum.innerHTML=`${head}<br>${thChip}<br><span style="color:#9fb0bd">半径${nearState.radius}km・GBIF実観測（タップで詳細／📖は図鑑収録）</span>`;
}
function openNearDetail(btn){
  const c=nearRows[+btn.dataset.i]||{name:btn.dataset.sci,count:+btn.dataset.cnt}, sci=c.name, cnt=c.count;
  const hit=ANIMALS.find(a=>(a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===sci.toLowerCase());
  if(hit){ selectAnimal(hit.id); return; }
  renderNearShell(sci,'<div class="nearsum">情報を読み込んでいます…</div>'); openPanel();
  inatResolve(sci).then(v=>{
    if(!currentMode||currentMode.type!=='near')return;
    Object.assign(c,v,{done:true});
    const cls=NEAR_ICONIC[v.ic]||'';
    panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
      <button class="nbback" onclick="backToNear()">← 近くの一覧へ</button>
      <div class="nd">
        ${v.ph?`<img class="ndimg" src="${v.ph.replace('/square.','/medium.')}" alt="" onerror="this.src='${v.ph}'">`:'<div class="ndimg ndnoimg">🐾</div>'}
        ${v.at?`<div class="ndcred">📷 ${v.at}（iNaturalist）</div>`:''}
        <div class="ndja">${v.ja||'（和名なし）'}</div>
        <div class="ndsci">${sci}</div>
        <div class="ndtags">${cls?`<span class="ndtag">${cls}</span>`:''}<span class="ndtag">この範囲で ${fmtN(cnt)}件</span><span id="ndstatus"></span></div>
        <div class="ndsec"><div class="ndsech">📅 観察が多い月（出会いやすさの目安）</div><div id="seasonwrap" class="seasonwrap"><span class="muted">読み込み中…</span></div></div>
        <button class="nbtn wide" id="ptsBtn" onclick="toggleNearPoints('${sci.replace(/'/g,'')}',this)">📍 観測スポットを地図に表示</button>
        <button class="nbtn wide" onclick="shareSpeciesCard('${sci.replace(/'/g,'')}',this)">📤 この種をシェア</button>
        <p class="ndnote">あなたの範囲（半径${nearState?nearState.radius:''}km）でGBIFに記録された生き物です。出会えるかは季節・時間帯によります。写真は iNaturalist（CC）。</p>
        <a class="cta" target="_blank" rel="noopener" href="https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(sci)}">iNaturalistで詳しく見る ↗</a><br>
        <a class="ndlink" target="_blank" rel="noopener" href="https://www.gbif.org/species/search?q=${encodeURIComponent(sci)}">GBIFで記録を見る ↗</a>
      </div>`;
    openPanel(); loadSeason(sci);
    resolveIucn(sci).then(code=>{ const el=document.getElementById('ndstatus'); if(!el||!code||!RARITY[code])return;
      const th=THREAT_CATS.has(code), r=RARITY[code];
      el.outerHTML=`<span class="ndtag" style="background:${r.color};color:#06231f;border-color:${r.color}">${th?'⚠ ':''}保全：${r.jp}（${code}）</span>`;
      c.st2=code; });
  });
}
function backToNear(){ removeNearPoints(); if(nearState) renderNearList(); }
// 季節性：その種の月別記録数（geoDistance内）を取得して棒グラフ
async function loadSeason(sci){
  const wrap=document.getElementById('seasonwrap'); if(!wrap||!nearState)return;
  const key=await resolveSpeciesKey(sci); const {lat,lng,radius}=nearState;
  if(!key){ wrap.innerHTML='<span class="muted">季節データを取得できませんでした。</span>'; return; }
  try{
    const u=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km&taxonKey=${key}&hasCoordinate=true&limit=0&facet=month&facetLimit=12`;
    const d=await (await fetch(u)).json();
    if(document.getElementById('seasonwrap')!==wrap)return;
    const counts=(d.facets&&d.facets[0]&&d.facets[0].counts)||[];
    if(!counts.length){ wrap.innerHTML='<span class="muted">この範囲では月別の記録が十分ありません。</span>'; return; }
    const months=Array(12).fill(0); counts.forEach(c=>{const m=+c.name; if(m>=1&&m<=12)months[m-1]=c.count;});
    wrap.innerHTML=renderSeasonBars(months);
  }catch(e){ wrap.innerHTML='<span class="muted">季節データの取得に失敗しました。</span>'; }
}
// 半径円（近似ポリゴン）
function circlePolygon(lat,lng,km,pts=64){
  const R=6371,d=km/R,la=lat*Math.PI/180,lo=lng*Math.PI/180,co=[];
  for(let i=0;i<=pts;i++){ const b=2*Math.PI*i/pts;
    const la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
    const lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
    co.push([lo2*180/Math.PI,la2*180/Math.PI]); }
  return {type:'Feature',geometry:{type:'Polygon',coordinates:[co]}};
}
function renderSeasonBars(months){
  const max=Math.max(1,...months), L=['1','2','3','4','5','6','7','8','9','10','11','12'];
  return '<div class="sbars">'+months.map((c,i)=>{const h=Math.round(c/max*100),pk=c>=max*0.75;
    return `<div class="sbar" title="${L[i]}月: ${c}件"><div class="sbv${pk?' pk':''}" style="height:${Math.max(5,h)}%"></div><div class="sbl">${L[i]}</div></div>`;}).join('')
    +'</div><div class="snote">棒が高い月ほど観察記録が多い＝出会いやすい目安（GBIF）。</div>';
}
// 半径円＋📍ピン（ドラッグで移動可）
function addNearCircle(lat,lng,km){
  if(!mapReady)return; const gj=circlePolygon(lat,lng,km);
  if(map.getSource('nearc')){ map.getSource('nearc').setData(gj); return; }
  map.addSource('nearc',{type:'geojson',data:gj});
  const before=map.getLayer('c-glow')?'c-glow':undefined;
  map.addLayer({id:'nearc-fill',type:'fill',source:'nearc',paint:{'fill-color':'#34d8c6','fill-opacity':.08}},before);
  map.addLayer({id:'nearc-line',type:'line',source:'nearc',paint:{'line-color':'#34d8c6','line-width':1.6,'line-opacity':.7,'line-dasharray':[2,2]}},before);
}
function drawNearVisuals(lat,lng,km){
  addNearCircle(lat,lng,km);
  if(nearMarker)nearMarker.remove();
  const el=document.createElement('div'); el.className='nearpin'; el.textContent='📍';
  try{
    nearMarker=new maplibregl.Marker({element:el,anchor:'bottom',draggable:true}).setLngLat([lng,lat]).addTo(map);
    nearMarker.on('dragend',()=>{ const ll=nearMarker.getLngLat(); setNearPin(ll.lat,ll.lng,'指定地点',nearState?nearState.radius:NEAR_DEFAULT_R); });
  }catch(e){}
}
// 観測点（観察スポット）：その種の実観測点をクラスタで重畳＝「どこで見られるか」
function addNearPoints(feats){
  if(!mapReady)return; removeNearPoints();
  map.addSource('nearpts',{type:'geojson',data:{type:'FeatureCollection',features:feats},cluster:true,clusterRadius:42,clusterMaxZoom:15});
  const before=map.getLayer('c-glow')?'c-glow':undefined;
  map.addLayer({id:'nearpts-cl',type:'circle',source:'nearpts',filter:['has','point_count'],paint:{'circle-color':'#ff9a1a','circle-opacity':.45,'circle-stroke-color':'#ffb02e','circle-stroke-width':1.2,'circle-radius':['step',['get','point_count'],13,10,18,50,26]}},before);
  map.addLayer({id:'nearpts-pt',type:'circle',source:'nearpts',filter:['!',['has','point_count']],paint:{'circle-color':'#ff7a1a','circle-radius':5,'circle-stroke-color':'#fff','circle-stroke-width':1,'circle-opacity':.9}},before);
}
function removeNearPoints(){ if(!mapReady){nearPtsOn=false;return;} ['nearpts-cl','nearpts-pt'].forEach(l=>{if(map.getLayer(l))map.removeLayer(l);}); if(map.getSource('nearpts'))map.removeSource('nearpts'); nearPtsOn=false; }
async function toggleNearPoints(sci,btn){
  if(nearPtsOn){ removeNearPoints(); btn.textContent='📍 観測スポットを地図に表示'; btn.classList.remove('on'); return; }
  if(!nearState)return; btn.textContent='読み込み中…';
  const key=await resolveSpeciesKey(sci); const {lat,lng,radius}=nearState;
  if(!key){ btn.textContent='📍 観測スポットを地図に表示'; toast('📍','観測点を取得できませんでした',2000); return; }
  try{
    const u=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km&taxonKey=${key}&hasCoordinate=true&limit=300`;
    const d=await (await fetch(u)).json();
    const feats=(d.results||[]).filter(o=>o.decimalLatitude!=null&&o.decimalLongitude!=null).map(o=>({type:'Feature',geometry:{type:'Point',coordinates:[o.decimalLongitude,o.decimalLatitude]},properties:{}}));
    if(!feats.length){ btn.textContent='📍 観測スポットを地図に表示'; toast('📍','この範囲の観測点は見つかりませんでした',2200); return; }
    addNearPoints(feats); nearPtsOn=true; btn.textContent='✓ 観測スポット表示中（タップで消す）'; btn.classList.add('on');
    toast('📍',feats.length+'件の観測スポットを地図に表示しました',2400);
  }catch(e){ btn.textContent='📍 観測スポットを地図に表示'; toast('📍','観測点の取得に失敗しました',2000); }
}
function removeNearbyVisuals(){
  nearPick=false; nearClass='';
  if(nearMarker){ try{nearMarker.remove();}catch(e){} nearMarker=null; }
  if(!mapReady)return;
  removeNearPoints();
  ['nearc-line','nearc-fill'].forEach(l=>{ if(map.getLayer(l))map.removeLayer(l); });
  if(map.getSource('nearc'))map.removeSource('nearc');
}

/* ====================================================================
   起動ビュー（ローカル起点）— Googleマップ式に「近所のリアル地図」で開く。
   ・地点リンク #@lat,lng[,radius] → その場所のローカル（共有/検証に便利）
   ・種リンク #id → 従来どおりその種を開く（SEO/シェア流入を壊さない）
   ・それ以外 → 現在地ローカル。前回の場所があれば即表示（待ち時間ゼロ・再プロンプトしない）。
     取得不可/拒否/無反応は「世界ヒートマップ＋場所選択」へ滑らかにフォールバック（クラッシュしない）。
   地球儀（世界を見る）は ⌂ ボタンで1タップ復帰＝二番手モードとして温存。
   ==================================================================== */
const LS_LASTLOC='biosphere_lastloc', LS_LOCALHINT='biosphere_localhint';
function saveLastLoc(lat,lng,radius){ try{ localStorage.setItem(LS_LASTLOC,JSON.stringify({lat,lng,radius})); }catch(e){} }
function getLastLoc(){ try{ const o=JSON.parse(localStorage.getItem(LS_LASTLOC)||'null'); return (o&&typeof o.lat==='number'&&typeof o.lng==='number')?o:null; }catch(e){ return null; } }
function bootInitialView(){
  const h=location.hash.replace('#','');
  // 地点ディープリンク：#@lat,lng[,radius]（例 #@35.68,139.76 や #@35.68,139.76,5）
  const m=h.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+))?$/);
  if(m){ stopSpin(); setNearPin(+m[1],+m[2],'指定地点',+m[3]||NEAR_DEFAULT_R); return; }
  // 種ディープリンク：#id（従来挙動）
  if(h && ANIMALS.some(a=>a.id===h)){ selectAnimal(h); return; }
  // 既定：現在地ローカルで開く
  startLocalBoot();
}
function startLocalBoot(){
  stopSpin();
  const last=getLastLoc();
  // 返ってきた人：前回の場所を即表示（GPS待ちゼロ・プライバシー配慮で再プロンプトしない）。
  if(last){
    setNearPin(last.lat,last.lng,'前回の場所',last.radius||NEAR_DEFAULT_R);
    toast('📍','前回の場所を表示中。📍で現在地に更新／⌂で世界全体（地球儀）へ。',3800);
    return;
  }
  // 初回：現在地を取得して近所で開く（Googleマップ式）。
  if(!('geolocation' in navigator)){ bootFallback('お使いの環境では現在地を取得できません。'); return; }
  renderNearShell('近くの生き物','<div class="nearsum">現在地を確認しています…<br><span style="color:#9fb0bd">ブラウザの確認ダイアログで「許可」を選ぶと、近所の生き物が見られます。</span></div>'); openPanel();
  let settled=false;
  const finish=fn=>{ if(settled)return; settled=true; fn(); };   // 二重発火を防止（成功/失敗/監視タイマーの競合）
  navigator.geolocation.getCurrentPosition(
    pos=>finish(()=>{ setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',NEAR_DEFAULT_R); localBootHint(); }),
    err=>finish(()=>bootFallback(err&&err.code===1?'位置情報の利用が許可されませんでした。':'現在地を取得できませんでした。')),
    {enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  // 監視タイマー：ダイアログ無反応や環境差でコールバックが来ない場合も必ずフォールバック（ヘッドレス検証も固まらない）
  setTimeout(()=>finish(()=>bootFallback('現在地の確認に時間がかかっています。')),9000);
}
// 現在地が無い/拒否時：世界ぜんたいの分布ヒートマップを見せつつ、場所を選んでローカルへ入れる。
function bootFallback(msg){ drawOverview(); nearbyFallback(msg); }
// 初回ローカル成功時のヒント（地球儀へ戻れることの発見性。一度きり）。
function localBootHint(){ if(localStorage.getItem(LS_LOCALHINT))return; try{localStorage.setItem(LS_LOCALHINT,'1');}catch(e){} toast('🌐','あなたの近くの生き物。⌂で世界全体（地球儀）へもどれます。',4000); }

