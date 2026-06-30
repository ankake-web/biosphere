const map = window.map = new maplibregl.Map({
  container:'map',
  style:{version:8,
    sources:{carto:{type:'raster',
      tiles:['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize:256, attribution:'© OpenStreetMap © CARTO'}},
    layers:[{id:'bg',type:'background',paint:{'background-color':'#070b11'}},
      {id:'carto',type:'raster',source:'carto',paint:{'raster-opacity':.9,'raster-saturation':-.1,'raster-contrast':.05}}]},
  center:[18,16], zoom:1.45, minZoom:.7, maxZoom:16, attributionControl:false, dragRotate:true, pitchWithRotate:false
});
map.addControl(new maplibregl.AttributionControl({compact:true, customAttribution:'観測点: GBIF.org'}), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'bottom-right');

map.on('load', async ()=>{
  try{ map.setProjection({type:'globe'}); }catch(e){}
  try{ map.setSky({'sky-color':'#0a1320','horizon-color':'#16324a','fog-color':'#070b11','sky-horizon-blend':.6,'horizon-fog-blend':.5,'fog-ground-blend':.7,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.85,4,.4,7,0]}); }catch(e){}
  try{
    const res=await fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson');
    countryGeo=await res.json();
  }catch(e){ bootFail('国境データを読み込めませんでした。'); return; }
  const p0=countryGeo.features[0].properties;
  CODE_PROP=['ADM0_A3','ISO_A3_EH','ISO_A3','iso_a3','adm0_a3'].find(k=>k in p0)||'ADM0_A3';
  // A3→A2（GBIF実データの国別クエリに使用）
  countryGeo.features.forEach(f=>{const p=f.properties;const a3=p[CODE_PROP];const a2=p.ISO_A2||p.ISO_A2_EH;if(a3&&a2&&a2!=='-99')A3toA2[a3]=a2;});

  map.addSource('countries',{type:'geojson',data:countryGeo});
  map.addLayer({id:'c-fill',type:'fill',source:'countries',paint:{'fill-color':'rgba(0,0,0,0)','fill-opacity':.72}});
  map.addLayer({id:'c-glow',type:'line',source:'countries',layout:{'line-join':'round'},paint:{'line-color':'#34d8c6','line-width':7,'line-blur':6,'line-opacity':0}});
  map.addLayer({id:'c-active',type:'line',source:'countries',paint:{'line-color':'#34d8c6','line-width':1.4,'line-opacity':0}});
  map.addLayer({id:'c-hover',type:'line',source:'countries',paint:{'line-color':'#ffffff','line-width':1.1,'line-opacity':.55},filter:['==',['get',CODE_PROP],'__none__']});

  // アトラス用：事前レンダリング済みの地形relief（Esri・CORS可）。国境/分布の下に重ね、🏔️でトグル
  try{
    map.addSource('relief',{type:'raster',tiles:['https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:13,attribution:'地形: Esri'});
    map.addLayer({id:'relief',type:'raster',source:'relief',layout:{visibility:'none'},paint:{'raster-opacity':.22,'raster-saturation':-.4,'raster-brightness-max':.62,'raster-contrast':.12,'raster-fade-duration':300}},'c-fill');
  }catch(e){}

  // 地名ラベル（アトラス）基図：CARTO Voyager（明色・地名ラベル付き＝サーバ側で各地の地名を描画）を🏷️でトグル。
  // setStyle不使用＝既存の carto/relief/countries/gbif/near-me 層をすべて維持し、dark基図と visibility 切替するだけ。
  try{
    map.addSource('carto-atlas',{type:'raster',tiles:['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png','https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap © CARTO'});
    const baseBefore=map.getLayer('relief')?'relief':'c-fill';
    map.addLayer({id:'carto-atlas',type:'raster',source:'carto-atlas',layout:{visibility:'none'},paint:{'raster-opacity':.95}},baseBefore);
  }catch(e){}

  mapReady=true; bindMap();
  if(atlasOn) setAtlas(true);
  $('#boot').classList.add('gone');   // 地図シェルを先に表示（種データは待たない＝初回ロード短縮）
  if(LOW_MOTION) spinning=false;   // 低モーション/通信節約時は自動回転しない
  spinLoop();
  // 種データ到着後に図鑑由来の描画（分布オーバービュー・コンプ率・ディープリンク）を反映
  __speciesReady.then(()=>{
    drawOverview(); updateDex();
    const deeplink=location.hash.replace('#','');
    if(deeplink && ANIMALS.some(a=>a.id===deeplink)){ selectAnimal(deeplink); }
    else { toast('🌍','動物を選ぶと図鑑に登録（未発見はシルエット）。地図の土地を選ぶと住人が出ます。🎲で旅へ。',5200); }
  });
});
// GBIFタイルの読み込み完了/失敗を検知してスピナーを止める（失敗しても図鑑カードは常に表示される）
map.on('error',(e)=>{ if(e && e.sourceId==='gbif') gbifLoading(false); });
map.on('sourcedata',(e)=>{ if(e.sourceId==='gbif' && map.getSource('gbif') && map.isSourceLoaded('gbif')) gbifLoading(false); });

/* ---------- 描画 ---------- */
function setFill(expr){ if(mapReady) map.setPaintProperty('c-fill','fill-color',expr); }
function clearActive(){
  if(!mapReady)return;
  map.setPaintProperty('c-active','line-opacity',0); map.setPaintProperty('c-glow','line-opacity',0);
  map.setFilter('c-active',['==',['get',CODE_PROP],'__none__']); map.setFilter('c-glow',['==',['get',CODE_PROP],'__none__']);
}
function setActive(codes,color){
  if(!mapReady)return;
  const f=['in',['get',CODE_PROP],['literal',codes]];
  map.setFilter('c-active',f); map.setFilter('c-glow',f);
  map.setPaintProperty('c-active','line-color',color); map.setPaintProperty('c-glow','line-color',color);
  map.setPaintProperty('c-active','line-opacity',.95); map.setPaintProperty('c-glow','line-opacity',.55);
}
function gbifLoading(on){ const b=$('#gbifBtn'); if(b) b.classList.toggle('loading',!!on); }   // 🛰️ボタンにスピナー
function removeGbif(){ if(!mapReady)return;
  if(map.getLayer('gbif'))map.removeLayer('gbif'); if(map.getLayer('gbif-glow'))map.removeLayer('gbif-glow');
  if(map.getLayer('gbif3d'))map.removeLayer('gbif3d'); if(map.getSource('gbif3d'))map.removeSource('gbif3d');
  if(map.getSource('gbif'))map.removeSource('gbif'); gbifLoading(false); }
function addGbif(key){
  if(!mapReady)return; removeGbif(); gbifLoading(true);
  if(dist3D){ addGbif3D(key); return; }                              // 3D（立体）モードのときは押し出しレイヤーへ
  map.addSource('gbif',{type:'raster',tiles:[gbifTileURL(key, gbifYear)],tileSize:512,attribution:'観測点: GBIF.org'});
  // 下層：にじみグロー（線形リサンプルでぼかし、密度の高い所がぼうっと発光＝立体感。低密度も視認しやすく）
  map.addLayer({id:'gbif-glow',type:'raster',source:'gbif',paint:{'raster-opacity':.5,'raster-resampling':'linear','raster-saturation':.25,'raster-fade-duration':260}},'c-glow');
  // 上層：くっきりヘックス＋彩度/コントラストを上げ「色の濃さ」を強調
  map.addLayer({id:'gbif',type:'raster',source:'gbif',paint:{'raster-opacity':.98,'raster-resampling':'nearest','raster-saturation':.35,'raster-contrast':.18}},'c-glow');
}
// 3D（立体）分布：GBIFのMVTヘックス（プロパティ total=観測数）を fill-extrusion で高さ表現。試験的トグル。
function gbif3dURL(key){
  return 'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}.mvt?srs=EPSG:3857&taxonKey='+key
       +'&bin=hex&hexPerTile=45&basisOfRecord=HUMAN_OBSERVATION'+(gbifYear?('&year='+gbifYear):'');
}
function addGbif3D(key){
  map.addSource('gbif3d',{type:'vector',tiles:[gbif3dURL(key)],minzoom:0,maxzoom:14,attribution:'観測点: GBIF.org'});
  map.addLayer({id:'gbif3d',type:'fill-extrusion',source:'gbif3d','source-layer':'occurrence',paint:{
    'fill-extrusion-color':['interpolate',['linear'],['get','total'],1,'#1fb6a6',8,'#7CFC55',40,'#ffd54a',180,'#ff8c1a',900,'#ff3322'],
    'fill-extrusion-height':['interpolate',['linear'],['get','total'],1,30000,40,180000,400,500000,4000,1400000],
    'fill-extrusion-opacity':.82,'fill-extrusion-base':0,'fill-extrusion-vertical-gradient':true
  }},'c-glow');
  map.once('idle',()=>gbifLoading(false));
}
// 時系列スライダー（GBIF &year=）。動物選択中＆GBIF ON のときだけ表示
function showYearbar(on){
  const yb=$('#yearbar'); if(!yb)return;
  stopYearPlay();
  if(on){ let i=YEAR_STOPS.findIndex(s=>s.y===gbifYear); if(i<0)i=0;
    $('#yearSlider').value=i; $('#yearLabel').textContent=YEAR_STOPS[i].label; yb.removeAttribute('hidden'); updateYearCount(); }
  else yb.setAttribute('hidden','');
}
let yearTileTimer=null;
function applyYear(idx){
  const st=YEAR_STOPS[idx]||YEAR_STOPS[0]; gbifYear=st.y; $('#yearLabel').textContent=st.label;
  if(currentAnimal && gbifOn && currentAnimal.gbif){
    setMode(animalModeText(currentAnimal));                        // ラベル/モードは即時更新（操作感）
    updateYearCount();                                             // 「この年代の記録数」を更新＝昔はたくさんいた/少ない を体感化
    clearTimeout(yearTileTimer);                                   // タイル再取得はデバウンス（ドラッグ中の連続リクエストを抑制）
    yearTileTimer=setTimeout(()=>{ if(currentAnimal&&gbifOn&&currentAnimal.gbif) addGbif(currentAnimal.gbif); },180);
  }
}
// 年代別の観測数（GBIF件数）。年代を変えると数が変わり「昔はたくさんいた/まだ記録が少ない」が感覚的に伝わる。確定時に取得・キャッシュ。
const yearCountCache={};
let yearCountTimer=null, yearCountMax={};
function updateYearCount(){
  const el=$('#yearCount'); if(!el) return;
  if(!currentAnimal||!gbifOn||!currentAnimal.gbif){ el.textContent=''; return; }
  const taxon=currentAnimal.gbif, yr=gbifYear, key=taxon+'@'+(yr||'all');
  if(key in yearCountCache){ paintYearCount(el,taxon,yearCountCache[key]); return; }
  el.textContent='…'; el.classList.remove('lo');
  clearTimeout(yearCountTimer);
  yearCountTimer=setTimeout(async()=>{
    try{
      const q='https://api.gbif.org/v1/occurrence/search?taxonKey='+taxon+'&hasCoordinate=true&limit=0'+(yr?('&year='+yr):'');
      const r=await fetch(q); const d=await r.json(); const n=d.count||0;
      yearCountCache[key]=n;
      if(!yr) yearCountMax[taxon]=n;                               // 全期間＝最大の目安
      if(currentAnimal&&currentAnimal.gbif===taxon&&gbifYear===yr) paintYearCount(el,taxon,n);
    }catch(e){ el.textContent=''; }
  },360);
}
function paintYearCount(el,taxon,n){
  el.innerHTML='📊 '+fmtN(n)+'件';
  const mx=yearCountMax[taxon];                                    // 全期間比で「少ない年代」を橙で示す
  el.classList.toggle('lo', !!(gbifYear && mx && n>0 && n < mx*0.25));
}
// 年代「再生」：全期間→各年代へ時間をたどり、記録の濃淡が動いて見える（移動・増減の体感）
let yearPlayTimer=null, yearPlaying=false;
function stopYearPlay(){ yearPlaying=false; clearTimeout(yearPlayTimer); const b=$('#yearPlay'); if(b){b.classList.remove('playing');b.textContent='▶';b.title='年代を再生（時間をたどる）';} }
function startYearPlay(){
  if(!currentAnimal||!gbifOn||!currentAnimal.gbif) return;
  yearPlaying=true; const b=$('#yearPlay'); if(b){b.classList.add('playing');b.textContent='⏸';b.title='停止';}
  let i=0;
  const step=()=>{
    if(!yearPlaying) return;
    $('#yearSlider').value=i; applyYear(i);
    i++;
    if(i>=YEAR_STOPS.length){ yearPlayTimer=setTimeout(stopYearPlay,1800); return; }
    yearPlayTimer=setTimeout(step,1900);
  };
  step();
}
function animalModeText(a){
  const yl=(gbifOn&&gbifYear)?('・'+((YEAR_STOPS.find(s=>s.y===gbifYear)||{}).label||'')):'';
  return `${a.emoji} ${a.nameJa} の分布（${a.range.length}地域）${gbifOn?' ・GBIF実データ':''}${yl}`;
}

function drawOverview(){
  currentMode={type:'overview'}; currentAnimal=null; removeGbif(); removeMigration(); showYearbar(false);
  const count={}; ANIMALS.forEach(a=>a.range.forEach(c=>count[c]=(count[c]||0)+1));
  const max=Math.max(1,...Object.values(count)); const pairs=[];
  Object.entries(count).forEach(([c,n])=>pairs.push(c,heatColor(n/max)));
  setFill(['match',['get',CODE_PROP],...pairs,'rgba(0,0,0,0)']); clearActive();
  setMode('世界ぜんたいの分布ヒートマップ');
}
function heatColor(t){
  const stops=[[0,[26,74,60]],[.5,[33,170,140]],[1,[242,193,78]]];
  for(let i=0;i<stops.length-1;i++){const [t0,c0]=stops[i],[t1,c1]=stops[i+1];
    if(t<=t1){const k=(t-t0)/(t1-t0||1);
      return `rgba(${Math.round(c0[0]+(c1[0]-c0[0])*k)},${Math.round(c0[1]+(c1[1]-c0[1])*k)},${Math.round(c0[2]+(c1[2]-c0[2])*k)},.82)`;}}
  return 'rgba(242,193,78,.85)';
}
function paintAnimal(a){
  const col=RARITY[a.status].color;
  const fillA = gbifOn ? .16 : .7;   // GBIF表示時は国塗りを控えめにして実データ(詳細メッシュ)を主役に
  setFill(['case',['in',['get',CODE_PROP],['literal',a.range]],hexA(col,fillA),'rgba(0,0,0,0)']);
  setActive(a.range,col);
  if(gbifOn && a.gbif) addGbif(a.gbif); else removeGbif();
  showMigration(a);
}
/* ---------- 季節移動の経路（キュレーション） ---------- */
let migMarkers=[];
function removeMigration(){ migMarkers.forEach(m=>m.remove()); migMarkers=[];
  if(mapReady){ if(map.getLayer('mig-line'))map.removeLayer('mig-line'); if(map.getLayer('mig-glow'))map.removeLayer('mig-glow'); if(map.getSource('mig'))map.removeSource('mig'); } }
function migArc(a,b,bend){ const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2], dx=b[0]-a[0], dy=b[1]-a[1];
  const ctrl=[mid[0]-dy*bend, mid[1]+dx*bend], pts=[];
  for(let t=0;t<=1.0001;t+=0.025){ const u=1-t; pts.push([u*u*a[0]+2*u*t*ctrl[0]+t*t*b[0], u*u*a[1]+2*u*t*ctrl[1]+t*t*b[1]]); }
  return pts; }
function migMarker(c,html,cls){ const el=document.createElement('div'); el.className='migm '+(cls||''); el.innerHTML=html;
  migMarkers.push(new maplibregl.Marker({element:el}).setLngLat(c).addTo(map)); }
function showMigration(a){
  removeMigration(); const mg=a&&MIGRATION[a.id]; if(!mg||!mapReady) return;
  const pts=migArc(mg.from.c,mg.to.c,0.18);
  map.addSource('mig',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:pts}}});
  map.addLayer({id:'mig-glow',type:'line',source:'mig',layout:{'line-cap':'round'},paint:{'line-color':'#1fd0ff','line-width':7,'line-blur':6,'line-opacity':.42}},'c-glow');
  map.addLayer({id:'mig-line',type:'line',source:'mig',layout:{'line-cap':'round'},paint:{'line-color':'#bff6ff','line-width':2.4,'line-dasharray':[2,1.7],'line-opacity':.96}},'c-glow');
  migMarker(mg.from.c, `<span class="dot from"></span><span class="lab">${mg.from.label}</span>`, 'from');
  migMarker(mg.to.c,   `<span class="lab">${mg.to.label}</span><span class="dot to"></span>`, 'to');
  const i=Math.floor(pts.length*0.55), m=pts[i], n=pts[Math.min(i+2,pts.length-1)];
  const ang=Math.atan2(n[0]-m[0], n[1]-m[1])*180/Math.PI;   // 北基準・時計回り。東向き'➤'は -90 補正
  migMarker(m, `<span class="arr" style="transform:rotate(${ang-90}deg)">➤</span>`, 'arrow');
}
function paintBiome(b){
  removeGbif(); removeMigration();
  const set=new Set(); ANIMALS.filter(a=>a.biome===b).forEach(a=>a.range.forEach(c=>set.add(c)));
  const codes=[...set]; const col=BIOMES[b]?BIOMES[b].g[0]:'#34d8c6';
  setFill(['case',['in',['get',CODE_PROP],['literal',codes]],hexA(col,.6),'rgba(0,0,0,0)']); setActive(codes,col);
}
function paintCountry(code){
  removeGbif(); removeMigration();
  setFill(['case',['==',['get',CODE_PROP],code],'rgba(52,216,198,.45)','rgba(0,0,0,0)']); setActive([code],'#34d8c6');
}
function flyTo(c,z){ stopSpin(); map.flyTo({center:c,zoom:z,speed:.85,curve:1.5,essential:true}); }
function hexA(hex,a){const n=hex.replace('#','');return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;}
function spinLoop(){ if(!spinning)return; const c=map.getCenter(); c.lng-=0.12; map.setCenter(c); requestAnimationFrame(spinLoop); }
function stopSpin(){ spinning=false; }
['mousedown','touchstart','wheel','dragstart'].forEach(ev=>map.on(ev,stopSpin));

