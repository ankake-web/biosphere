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
// 地図に「ふわっと」出す生き物マーカー（ポケGO風）。GBIF実観測点に種マーカー＝1種1個・上限で間引き。
const CREATURE_MAX=18;
const CLASS_EMOJI={Aves:'🐦',Mammalia:'🐾',Reptilia:'🦎',Amphibia:'🐸',Actinopterygii:'🐟',Chondrichthyes:'🦈',Fish:'🐟',Insecta:'🐛',Arachnida:'🕷️',Mollusca:'🐚'};
function classEmoji(cls){ return CLASS_EMOJI[cls]||'🐾'; }
// ★GBIF occurrence は eBird 由来で鳥に極端に偏る（同一地点で鳥が哺乳の約300倍）。単一 taxonKey=44 の
// 観測数順だと上位がほぼ全部鳥になる（＝報告バグ）。クラス別に facet 取得してマージし各クラスのご当地上位を必ず出す。
// キーは実occurrenceで動作確認済（新backbone）：鳥212・哺乳359・両生131・爬虫=Squamata11592253+Testudines11418114・
// 魚=Actinopterygii204+Elasmobranchii121。※条鰭魚(204)はGBIFがclassKey未付与の地点が多く実質軟骨魚中心になる場合あり。
const GBIF_VERT_GROUPS=[
  {c:'Aves',     keys:[212],               cap:12},
  {c:'Mammalia', keys:[359],               cap:12},
  {c:'Reptilia', keys:[11592253,11418114], cap:12},
  {c:'Amphibia', keys:[131],               cap:12},
  {c:'Fish',     keys:[204,121],           cap:12},
];
const NEAR_CLASS_KEYS={Aves:[212],Mammalia:[359],Reptilia:[11592253,11418114],Amphibia:[131],Fish:[204,121]};
// クラス別 facet 取得（429リトライ）。scientificName を二名へ正規化して返す。
async function gbifFacetNear(lat,lng,radius,keys,facetLimit,y1,y2){
  const kp=keys.map(x=>'&taxonKey='+x).join('');
  const url=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km${kp}&hasCoordinate=true&year=${y1},${y2}&limit=0&facet=scientificName&facetLimit=${facetLimit}`;
  for(let i=0;i<3;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1200*(i+1))); continue; }
    if(!r.ok) return []; const d=await r.json(); return mergeBinomials((d.facets&&d.facets[0]&&d.facets[0].counts)||[]);
  }catch(e){ await new Promise(s=>setTimeout(s,600)); } }
  return [];
}
// クラス別 occurrence 取得（座標付き＝マーカー用）
async function gbifOccByGroup(lat,lng,radius,keys,limit,y1,y2){
  const kp=keys.map(x=>'&taxonKey='+x).join('');
  const url=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km${kp}&hasCoordinate=true&year=${y1},${y2}&limit=${limit}`;
  for(let i=0;i<2;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1200*(i+1))); continue; }
    if(!r.ok) return []; const d=await r.json(); return d.results||[];
  }catch(e){ await new Promise(s=>setTimeout(s,500)); } }
  return [];
}
let nearState=null;                 // {lat,lng,radius,label}
let nearMarker=null, nearPick=false, nearTimer=null, nearClass='', nearThreatOnly=false, nearRows=[], nearPtsOn=false;
let creatureMarkers=[], creatureTimer=null, creaturesKey=null;
function nearKey(lat,lng,r){ return lat.toFixed(2)+','+lng.toFixed(2)+'@'+r; }
// iNat学名キャッシュ（30日）／近傍ファセットキャッシュ（1日）
function inatGet(s){ try{const o=JSON.parse(localStorage.getItem(LS_INAT+s)||'null'); if(o&&(Date.now()-o.t)<2592e6)return o.v;}catch(e){} return null; }
function inatSet(s,v){ try{localStorage.setItem(LS_INAT+s,JSON.stringify({t:Date.now(),v}));}catch(e){} }
function nearCacheGet(k){ try{const o=JSON.parse(localStorage.getItem(LS_NEAR+k)||'null'); if(o&&(Date.now()-o.t)<864e5)return o.c;}catch(e){} return null; }
function nearCacheSet(k,c){ try{localStorage.setItem(LS_NEAR+k,JSON.stringify({t:Date.now(),c}));}catch(e){} }
// iNat呼び出しはthrottle（同時3・間隔120ms）で礼儀正しく
let inatQueue=[], inatBusy=0;
function inatEnqueue(fn){ inatQueue.push(fn); pumpInat(); }
function pumpInat(){ while(inatBusy<3 && inatQueue.length){ const fn=inatQueue.shift(); inatBusy++; Promise.resolve(fn()).catch(()=>{}).finally(()=>{ inatBusy--; setTimeout(pumpInat,120); }); } }
// 同一種の同時解決を1本にまとめる（一覧と生き物マーカーで同じ種を二重取得しない＝リクエスト数を削減）。
const _inflight={};
function dedupe(key,fn){ if(_inflight[key]) return _inflight[key];
  const p=Promise.resolve().then(fn).finally(()=>{ delete _inflight[key]; }); _inflight[key]=p; return p; }
async function inatResolve(sci){
  const c=inatGet(sci); if(c) return c;
  return dedupe('inat:'+sci, async()=>{
    const c0=inatGet(sci); if(c0) return c0;
    for(let i=0;i<3;i++){
      try{
        const r=await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&rank=species&per_page=1&locale=ja`);
        if(r.status===429){ await new Promise(s=>setTimeout(s,1500*(i+1))); continue; }
        const d=await r.json(), x=d.results&&d.results[0], dp=x&&x.default_photo;
        const at=(dp&&dp.attribution||'').replace(/<[^>]*>/g,'').replace(/\(c\)/gi,'©');
        const v=x?{ja:x.preferred_common_name||'',ph:(dp&&dp.square_url)||'',ic:x.iconic_taxon_name||'',st:(x.conservation_status&&x.conservation_status.status_name)||'',at,id:x.id||0}:{ja:'',ph:'',ic:'',st:'',at:'',id:0};
        inatSet(sci,v); return v;
      }catch(e){ await new Promise(s=>setTimeout(s,600)); }
    }
    return {ja:'',ph:'',ic:'',st:'',at:'',id:0};
  });
}
// GBIF種キー解決（species/match、localStorageキャッシュ）＝月別/観測点に使用
async function resolveSpeciesKey(sci){
  try{ const c=localStorage.getItem(LS_SKEY+sci); if(c)return c==='0'?null:+c; }catch(e){}
  return dedupe('skey:'+sci, async()=>{
    try{ const c=localStorage.getItem(LS_SKEY+sci); if(c)return c==='0'?null:+c; }catch(e){}
    try{ const r=await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sci)}`);
      if(!r.ok) return null;                       // 429/5xx等の一過性失敗はキャッシュせず再訪で再試行（毒化防止）
      const j=await r.json(); const k=j.usageKey||j.speciesKey||0;
      try{localStorage.setItem(LS_SKEY+sci,String(k||0));}catch(e){}   // HTTP200のみ恒久キャッシュ（真の未マッチ matchType:NONE は k=0='0'＝正しい）
      return k||null;
    }catch(e){ return null; }
  });
}
// 保全状況（IUCNカテゴリ）を GBIF から直接取得（IUCN APIの商用制約を回避）。RARITYコードへ写像しキャッシュ。
const STMAP_I={LEAST_CONCERN:'LC',NEAR_THREATENED:'NT',VULNERABLE:'VU',ENDANGERED:'EN',CRITICALLY_ENDANGERED:'CR',DATA_DEFICIENT:'DD',NOT_EVALUATED:'NE',EXTINCT_IN_THE_WILD:'EW',EXTINCT:'EX'};
function iucnGet(s){ try{const v=localStorage.getItem(LS_IUCN+s); return v===null?undefined:v;}catch(e){return undefined;} }
function iucnSet(s,v){ try{localStorage.setItem(LS_IUCN+s,v);}catch(e){} }
async function resolveIucn(sci){
  const c=iucnGet(sci); if(c!==undefined) return c;
  return dedupe('iucn:'+sci, async()=>{
    const c0=iucnGet(sci); if(c0!==undefined) return c0;
    const key=await resolveSpeciesKey(sci); if(!key) return '';   // キー無し（真の未マッチ/一過性失敗）はIUCNをキャッシュしない（種キャッシュ側で再試行制御）
    try{ const r=await fetch(`https://api.gbif.org/v1/species/${key}/iucnRedListCategory`);
      if(r.ok){ const j=await r.json(); const code=STMAP_I[j.category]||''; iucnSet(sci,code); return code; }   // 取得成功のみ恒久キャッシュ
      if(r.status===404){ iucnSet(sci,''); return ''; } }catch(e){}   // 評価対象外＝確定的に無し（キャッシュ）
    return '';   // 429/5xx/例外＝一過性なのでキャッシュせず一時値で返す（再訪で再試行＝毒化防止）
  });
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
  panelSheet(true);   // 近くの一覧/詳細はモバイルで中間高さ＝上に地図＋生き物を見せる
  panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
    <div class="cc-head"><div class="lbl">📍 あなたの近く</div><div class="cname">${esc(title)}</div></div>
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
  setLocalBasemap(true); localMapAutoOn=true;   // 近く＝本物の地図（OpenFreeMap）を自動ON（離脱時に自動分だけ戻す）
  drawNearVisuals(lat,lng,nearState.radius);
  stopSpin(); map.flyTo({center:[lng,lat],zoom:ZOOM_BY_R[nearState.radius]||9,speed:.9,curve:1.4,essential:true});
  queryNear();
  loadNearCreatures(lat,lng,nearState.radius);   // 地図に生き物がふわっと出現
  saveLastLoc(lat,lng,nearState.radius);   // 次回起動のフォールバック（前回の場所）に記録
}
function setNearRadius(r){ if(!nearState)return; nearState.radius=r; removeNearPoints();
  drawNearVisuals(nearState.lat,nearState.lng,r);
  map.flyTo({center:[nearState.lng,nearState.lat],zoom:ZOOM_BY_R[r]||9,speed:.8,curve:1.3,essential:true});
  queryNear(); loadNearCreatures(nearState.lat,nearState.lng,r);
  saveLastLoc(nearState.lat,nearState.lng,r); }
function setNearClass(c){ nearClass=c; if(nearState) queryNear(); }   // クラス選択はクエリ側で絞る（再取得）
function armNearPick(){ nearPick=true; toast('📌','地図をタップすると、その地点に移動します',2400); }
function recenterCurrent(){
  if(!('geolocation' in navigator)){ toast('📍','現在地を取得できません',2000); return; }
  toast('📍','現在地を確認しています…',1800);
  navigator.geolocation.getCurrentPosition(
    pos=>setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',nearState?nearState.radius:NEAR_DEFAULT_R),
    ()=>toast('📍','現在地を取得できませんでした',2200),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}
// GBIFファセットで近傍の種一覧を取得→nearRowsへ（クラス別バランス取得＝鳥偏重を打破）
function queryNear(){
  const {lat,lng,radius}=nearState, k=nearKey(lat,lng,radius)+'|'+(nearClass||'all'), cached=nearCacheGet(k);
  if(cached&&cached.length){ nearRows=cached.map(c=>({name:c.name,count:c.count,gcls:c.gcls})); renderNearList(); }
  else { nearRows=[]; renderNearList('<div class="nearsum">🛰️ 周辺の記録を集めています…</div>'); }
  clearTimeout(nearTimer);
  nearTimer=setTimeout(async()=>{
    const y2=new Date().getFullYear(), y1=y2-10;
    const stale=()=> !currentMode||currentMode.type!=='near'||(nearKey(currentMode.lat,currentMode.lng,nearState.radius)+'|'+(nearClass||'all'))!==k;
    try{
      let counts;
      if(nearClass && NEAR_CLASS_KEYS[nearClass]){
        // クラス選択：そのクラスの taxonKey で直接取得（クライアント側 classMatch は廃止＝空にならない）
        counts=(await gbifFacetNear(lat,lng,radius,NEAR_CLASS_KEYS[nearClass],45,y1,y2)).slice(0,40).map(c=>({name:c.name,count:c.count,gcls:nearClass}));
      } else {
        // 既定：クラス別に並行取得→クラスをラウンドロビンでインターリーブ（先頭からクラスが交互＝鳥ばかりに見えない）
        const groupRows=await Promise.all(GBIF_VERT_GROUPS.map(g=>
          gbifFacetNear(lat,lng,radius,g.keys,18,y1,y2).then(rows=>rows.slice(0,g.cap).map(c=>({name:c.name,count:c.count,gcls:g.c})))));
        const merged=[], seen=new Set(), maxLen=Math.max(0,...groupRows.map(r=>r.length));
        for(let i=0;i<maxLen;i++) for(const rows of groupRows){ const c=rows[i]; if(c){ const key=c.name.toLowerCase(); if(!seen.has(key)){ seen.add(key); merged.push(c); } } }
        counts=merged.slice(0,45);
      }
      if(stale()) return;
      if(!counts.length){ nearRows=[]; renderNearList('<div class="nearsum">この範囲の脊椎動物の記録は見つかりませんでした。半径を広げるか場所を変えてみてください。</div>'); return; }
      nearCacheSet(k,counts); nearRows=counts; renderNearList();
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
    return `<button class="locrow nearrow" data-sci="${esc(sci)}" data-cnt="${c.count}" data-i="${i}" onclick="openNearDetail(this)">
      <span class="locav" data-sci="${e}">🐾</span>
      <span class="ln2"><b class="nja">${esc(c.ja||'…')}</b><span class="nsci">${esc(sci)}</span></span>
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
  if(c.ph&&av&&!av.querySelector('img')) av.innerHTML=`<img src="${esc(c.ph)}" alt="${esc(c.ja||c.name||'')}" onload="this.style.opacity=1">`;
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
    const show=(!nearThreatOnly||th);   // クラス絞りはクエリ側で実施済（classMatch廃止）。ここは絶滅危惧トグルのみ
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
  // ★地図は動かさず、その場で詳細を表示（世界地図への引き＝分布ビューはボタンで任意に）。図鑑収録種は分布ボタンを出す。
  renderNearShell(sci,'<div class="nearsum">情報を読み込んでいます…</div>'); openPanel();
  inatResolve(sci).then(v=>{
    if(!currentMode||currentMode.type!=='near')return;
    Object.assign(c,v,{done:true});
    const cls=NEAR_ICONIC[v.ic]||'';
    panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
      <button class="nbback" onclick="backToNear()">← 近くの一覧へ</button>
      <div class="nd">
        ${v.ph?`<img class="ndimg" src="${esc(v.ph.replace('/square.','/medium.'))}" alt="${esc(v.ja||sci)}" onerror="this.src='${esc(v.ph)}'">`:'<div class="ndimg ndnoimg">🐾</div>'}
        ${v.at?`<div class="ndcred">📷 ${esc(v.at)}（iNaturalist）</div>`:''}
        <div class="ndja">${esc(v.ja||'（和名なし）')}</div>
        <div class="ndsci">${esc(sci)}</div>
        <div class="ndtags">${cls?`<span class="ndtag">${cls}</span>`:''}<span class="ndtag">この範囲で ${fmtN(cnt)}件</span><span id="ndstatus"></span></div>
        <div class="ndsec"><div class="ndsech">📅 観察が多い月（出会いやすさの目安）</div><div id="seasonwrap" class="seasonwrap"><span class="muted">読み込み中…</span></div></div>
        <div class="ndsec"><div class="ndsech">🕐 観察が多い時間帯（朝・昼・夕の目安）</div><div id="timewrap" class="seasonwrap"><span class="muted">読み込み中…</span></div></div>
        <button class="nbtn wide" id="ptsBtn" onclick="toggleNearPoints('${sciKey(sci)}',this)">📍 観測スポットを地図に表示</button>
        ${hit?`<button class="nbtn wide" onclick="selectAnimal('${hit.id}')">🌍 世界地図で分布を見る（図鑑）</button>`:''}
        <button class="nbtn wide" onclick="shareSpeciesCard('${sciKey(sci)}',this)">📤 この種をシェア</button>
        <p class="ndnote">あなたの範囲（半径${nearState?nearState.radius:''}km）でGBIFに記録された生き物です。出会えるかは季節・時間帯によります。写真は iNaturalist（CC）。</p>
        <a class="cta" target="_blank" rel="noopener" href="https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(sci)}">iNaturalistで詳しく見る ↗</a><br>
        <a class="ndlink" target="_blank" rel="noopener" href="https://www.gbif.org/species/search?q=${encodeURIComponent(sci)}">GBIFで記録を見る ↗</a>
      </div>`;
    openPanel(); loadSeason(sci); loadTimeOfDay(v.id);
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
// 時間帯：iNat に hour_of_day ヒストグラムが無いため、観測サンプル(最大200件)の observed_on_details.hour
// （各観測の現地時刻）を時間帯別に集計。「朝・昼・夕いつ観察が多いか」の目安（その種・世界全体）。
async function loadTimeOfDay(inatId){
  const wrap=document.getElementById('timewrap'); if(!wrap)return;
  if(!inatId){ wrap.innerHTML='<span class="muted">時間帯データを取得できませんでした。</span>'; return; }
  try{
    const u=`https://api.inaturalist.org/v1/observations?taxon_id=${inatId}&quality_grade=research&per_page=200&order_by=created_at`;
    const d=await (await fetch(u)).json();
    if(document.getElementById('timewrap')!==wrap)return;
    const hours=Array(24).fill(0); let n=0;
    (d.results||[]).forEach(o=>{ const h=o.observed_on_details&&o.observed_on_details.hour; if(typeof h==='number'&&h>=0&&h<24){ hours[h]++; n++; } });
    if(n<10){ wrap.innerHTML='<span class="muted">時間帯の記録が十分ありません。</span>'; return; }
    wrap.innerHTML=renderHourBars(hours);
  }catch(e){ wrap.innerHTML='<span class="muted">時間帯データの取得に失敗しました。</span>'; }
}
function renderHourBars(hours){
  const max=Math.max(1,...hours), peak=hours.indexOf(max);
  const period = peak<5?'未明':peak<9?'早朝':peak<11?'朝':peak<14?'昼':peak<17?'午後':peak<20?'夕方':'夜';
  const bars='<div class="sbars hbars">'+hours.map((c,i)=>{const h=Math.round(c/max*100),pk=c>=max*0.8;
    return `<div class="sbar" title="${i}時台: ${c}件"><div class="sbv${pk?' pk':''}" style="height:${Math.max(4,h)}%"></div><div class="sbl">${i%6===0?i:''}</div></div>`;}).join('');
  return bars+`</div><div class="snote">観察が多いのは <b>${peak}時ごろ（${period}）</b>。iNaturalistの観察時刻分布（人が見た時間の傾向を含む）。</div>`;
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
/* ---------- 近くの生き物マーカー（ポケGO風・地図にふわっと出現）----------
   GBIFの実観測点を1回取得→種ごとに代表座標へ集計→頻度順に上限18種だけ配置（多い時の間引き＝1種1マーカー）。
   絵文字で即出現（有限CSSアニメ）→iNat写真サムネに差し替え／絶滅危惧はレア度カラーで発光。タップで詳細。
   永続rAFは使わない（アニメはCSS有限）。 */
function removeCreatures(){ creatureMarkers.forEach(m=>{try{m.remove();}catch(e){}}); creatureMarkers=[]; }
function loadNearCreatures(lat,lng,radius){
  removeCreatures();
  const k=nearKey(lat,lng,radius); creaturesKey=k;
  clearTimeout(creatureTimer);
  creatureTimer=setTimeout(async()=>{
    const y2=new Date().getFullYear(), y1=y2-10;
    try{
      // クラス別に occurrence を並行取得（鳥は少なめlimit）→各クラス上位数種をマーカー化＝マーカーも鳥だらけを回避。
      const per=await Promise.all(GBIF_VERT_GROUPS.map(g=>
        gbifOccByGroup(lat,lng,radius,g.keys,g.c==='Aves'?24:36,y1,y2).then(res=>({g,res}))));
      if(creaturesKey!==k || !currentMode || currentMode.type!=='near') return;   // 古い/別地点の応答は破棄
      const picks=[], perGroup=4;   // 各クラス最大4種
      per.forEach(({g,res})=>{
        const freq={}, coord={}, cls={};
        res.forEach(o=>{ const sp=(o.species||'').trim(); if(!sp || o.decimalLatitude==null || o.decimalLongitude==null) return;
          freq[sp]=(freq[sp]||0)+1; if(!coord[sp]) coord[sp]=[o.decimalLongitude,o.decimalLatitude]; if(!cls[sp]) cls[sp]=o.class||''; });
        Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,perGroup).forEach(sp=>picks.push({sci:sp,c:coord[sp],cls:CLASS_EMOJI[cls[sp]]?cls[sp]:g.c,n:freq[sp]}));
      });
      picks.sort((a,b)=>b.n-a.n);   // 件数順に整えつつ上限で間引き
      spawnCreatures(picks.slice(0,CREATURE_MAX));
    }catch(e){ /* 失敗は静かに（一覧・地図は維持） */ }
  },260);
}
function spawnCreatures(list){
  if(!mapReady) return; removeCreatures();
  const myKey=creaturesKey;   // この生成バッチの世代。地点/半径を切替えたら古いバッチの後処理はスキップ。
  list.forEach((it,idx)=>{
    const el=document.createElement('div'); el.className='cmk-wrap';
    const bub=document.createElement('div'); bub.className='cmk'; bub.style.setProperty('--d',(idx*55)+'ms'); bub.textContent=classEmoji(it.cls);
    const lab=document.createElement('div'); lab.className='cmk-lab'; lab.innerHTML=`<i>${esc(it.sci)}</i>`;   // ホバーで和名/分類/保全を表示
    el.appendChild(bub); el.appendChild(lab);
    el.addEventListener('click',(e)=>{ e.stopPropagation(); openCreature(it.sci,it.n); });
    let mk; try{ mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(it.c).addTo(map); }catch(e){ return; }
    creatureMarkers.push(mk);
    // 写真サムネに差し替え＆ホバーラベル更新（iNat・キャッシュ/throttle 共有）。鮮度ガード＝古い世代/撤去済みは何もしない。
    inatEnqueue(async()=>{ if(creaturesKey!==myKey||!bub.isConnected) return; const v=await inatResolve(it.sci);
      if(creaturesKey!==myKey||!bub.isConnected) return;
      const clsLab=NEAR_ICONIC[v.ic]||'';
      if(v.ja||clsLab) lab.innerHTML=(v.ja?`<b>${esc(v.ja)}</b>`:`<i>${esc(it.sci)}</i>`)+(clsLab?` <span class="cl">${clsLab}</span>`:'');
      if(v&&v.ph&&!bub.querySelector('img')){ const img=document.createElement('img'); img.src=v.ph; img.alt=''; img.onload=()=>img.classList.add('on'); bub.appendChild(img); } });
    // 近くの絶滅危惧種を強調（「近所にコレ!?」）＋ラベルにも保全状況
    resolveIucn(it.sci).then(code=>{ if(creaturesKey!==myKey||!bub.isConnected) return; if(code&&THREAT_CATS.has(code)&&RARITY[code]){ bub.classList.add('threat'); bub.style.setProperty('--tc',RARITY[code].color); lab.classList.add('th'); lab.insertAdjacentHTML('afterbegin',`<span class="w">⚠${code}</span> `); } });
  });
}
function openCreature(sci,cnt){
  const i=nearRows.findIndex(r=>(r.name||'').toLowerCase()===String(sci).toLowerCase());
  openNearDetail({dataset:{sci:sci,cnt:String(cnt||0),i:String(i)}});   // 既存の近く詳細を流用（図鑑収録種なら種カードへ）
}
function removeNearbyVisuals(){
  nearPick=false; nearClass='';
  clearTimeout(nearTimer); clearTimeout(creatureTimer);   // 近くを離れる際は保留中の周辺/生き物クエリも取消（無駄なAPI呼出・リーク防止）
  if(localMapAutoOn){ setLocalBasemap(false); localMapAutoOn=false; }   // 自動ONした基図だけ戻す（手動🏷️ONは温存）
  removeCreatures();        // 生き物マーカーも撤去
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
  if(m){ const la=+m[1], lo=+m[2];   // 共有/改ざんリンクの不正座標はローカル起動へフォールバック（flyToへ流さない）
    if(la>=-90&&la<=90&&lo>=-180&&lo<=180){ stopSpin(); setNearPin(la,lo,'指定地点', NEAR_RADII.includes(+m[3])?+m[3]:NEAR_DEFAULT_R); return; } }
  // 種ディープリンク：#id（ANIMALSが必要なので種データ到着を待つ。無い種ならローカルへフォールバック）
  if(h){ __speciesReady.then(()=>{ if(ANIMALS.some(a=>a.id===h)) selectAnimal(h); else startLocalBoot(); }); return; }
  // 既定：現在地ローカルで開く（種データを待たず即）
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
// 現在地が無い/拒否時：場所選択チップは即時、世界ヒートマップは種データ必須なので到着を待って描画
// （★デカップリングで startLocalBoot が種データ前に走り得るため。空ANIMALSでの drawOverview を防ぐ）。
function bootFallback(msg){ nearbyFallback(msg); __speciesReady.then(drawOverview); }
// 初回ローカル成功時のヒント（地球儀へ戻れることの発見性。一度きり）。
function localBootHint(){ if(localStorage.getItem(LS_LOCALHINT))return; try{localStorage.setItem(LS_LOCALHINT,'1');}catch(e){} toast('🌐','あなたの近くの生き物。⌂で世界全体（地球儀）へもどれます。',4000); }

