/* ---------- ツール ---------- */
$('#nearBtn').addEventListener('click',openNearby);
$('#search').addEventListener('input',(e)=>{ if(typeof buildChips==='function') buildChips(true); filterState.q=e.target.value.trim().toLowerCase(); applyFilters(); });
// モバイル：図鑑ドック内の検索窓（上部バーの検索は≤640pxで非表示）。既存 filterState.q/applyFilters に配線。
{ const ds=$('#dockSearch'); if(ds) ds.addEventListener('input',(e)=>{ filterState.q=e.target.value.trim().toLowerCase(); if(typeof buildChips==='function') buildChips(true); applyFilters(); }); }
let isGlobe=true;
function syncGlobeBtn(){ const g=$('#globeBtn'); if(g){ g.setAttribute('aria-pressed',String(isGlobe)); g.textContent=isGlobe?'🌐':'🗺️'; } }
$('#globeBtn').addEventListener('click',()=>{
  if(dist3D){ setDist3D(false); return; }                            // 3D（平面専用）中はまず3D解除＝地球儀に戻る
  isGlobe=!isGlobe; try{ map.setProjection({type:isGlobe?'globe':'mercator'}); }catch(e){}
  syncGlobeBtn(); toast(isGlobe?'🌐':'🗺️',isGlobe?'地球儀表示':'平面表示',1500);});
$('#gbifBtn').addEventListener('click',()=>{ gbifOn=!gbifOn; $('#gbifBtn').setAttribute('aria-pressed',String(gbifOn));
  toast('🛰️', gbifOn?'GBIF実観測データ：ON':'実観測データ：OFF（手描き分布）',1900);
  if(currentAnimal) paintAnimal(currentAnimal); else removeGbif();
  if(currentAnimal) setMode(animalModeText(currentAnimal));
  showYearbar(gbifOn && currentMode.type==='animal'); });
$('#exploreBtn').addEventListener('click',explore);
$('#homeBtn').addEventListener('click',resetAll);
$('#yearSlider').addEventListener('input',(e)=>{ stopYearPlay(); applyYear(+e.target.value); });
$('#yearPlay').addEventListener('click',()=>{ if(yearPlaying) stopYearPlay(); else startYearPlay(); });
// アトラス（地形relief）表示トグル：スタイルは入れ替えず relief レイヤーの可視性だけ切替（分布/GBIF/国境は不変）
let natMarkers=[];
function showNaturalPlaces(on){
  natMarkers.forEach(m=>m.remove()); natMarkers=[];
  if(!on||!mapReady) return;
  NATURAL_PLACES.forEach(([name,lon,lat])=>{
    const el=document.createElement('div'); el.className='natm'; el.textContent=name;
    natMarkers.push(new maplibregl.Marker({element:el}).setLngLat([lon,lat]).addTo(map));
  });
}
function setAtlas(on){ atlasOn=on; if(mapReady && map.getLayer('relief')) map.setLayoutProperty('relief','visibility',on?'visible':'none');
  showNaturalPlaces(on);   // 自然の地理ラベルもアトラス表示に連動
  const b=$('#atlasBtn'); if(b)b.setAttribute('aria-pressed',String(on)); }
$('#atlasBtn').addEventListener('click',()=>{ setAtlas(!atlasOn);
  toast(atlasOn?'🏔️':'🗺️', atlasOn?'アトラス表示：地形と地名で旅する':'ミニマル表示にもどしました',1900); });
// 🏷️ 本物の地図トグル：OpenFreeMapのベクター基図（街路・鉄道・地名・地形／日本語優先）を手動ON/OFF。
// 近く(ローカル)モードでは自動でONになる。setStyle不使用＝gbif/relief/near-me/countries は維持。
$('#labelBtn').addEventListener('click',()=>{ const on=!localMapOn; setLocalBasemap(on); localMapAutoOn=false;   // 手動操作＝以後、近く離脱の自動OFF対象から外す（ユーザー意思を尊重）
  toast('🗺️', on?'本物の地図：街路・鉄道・地名・地形（OpenFreeMap）':'ダーク基図にもどしました',2000); });
// 分布3D（立体）トグル：fill-extrusionはglobeでは描画されないため、3D中は自動で平面(mercator)＋傾きにし、
// OFFで地球儀に復帰。地球儀を主役に保ちつつ「立体で詳しく見る」没入オプションとして提供。
function setDist3D(on){ dist3D=on; const b=$('#d3dBtn'); if(b)b.setAttribute('aria-pressed',String(on));
  try{
    if(on){ isGlobe=false; map.setProjection({type:'mercator'}); syncGlobeBtn(); map.easeTo({pitch:55, duration:700}); }
    else  { map.easeTo({pitch:0, duration:500}); isGlobe=true; map.setProjection({type:'globe'}); syncGlobeBtn(); }
  }catch(e){}
  if(currentAnimal && gbifOn && currentAnimal.gbif) addGbif(currentAnimal.gbif); }
$('#d3dBtn').addEventListener('click',()=>{
  if(!currentAnimal && !dist3D){ toast('🧊','まず動物を選ぶと、その分布を3D（立体）で見られます',2400); return; }
  setDist3D(!dist3D);
  toast(dist3D?'🧊':'🌐', dist3D?'分布を3D（立体）で表示：高い柱ほど観測が多い（平面表示）':'地球儀にもどしました',2400); });
$('#dex').addEventListener('click',()=>{ const t=ANIMALS.length,n=SEEN.size; toast(n>=t?'🏆':'🧭', n>=t?'図鑑コンプリート！全種を旅しました':`図鑑 ${n}/${t} 種を発見。🎲で続きを旅しよう`,2600); });
$('#dex').addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('#dex').click(); } });
$('#aboutBtn').addEventListener('click',openAbout);
// モバイル：⋯「そのほかの操作」メニュー（二次操作はここの奥へ）。項目選択/外側タップで閉じる。
$('#moreBtn').addEventListener('click',(e)=>{ e.stopPropagation();
  const g=$('#moregroup'), open=g.classList.toggle('open'); $('#moreBtn').setAttribute('aria-expanded',String(open)); });
$('#moregroup').addEventListener('click',()=>{ $('#moregroup').classList.remove('open'); $('#moreBtn').setAttribute('aria-expanded','false'); });
document.addEventListener('click',()=>{ const g=$('#moregroup'); if(g&&g.classList.contains('open')){ g.classList.remove('open'); $('#moreBtn').setAttribute('aria-expanded','false'); } });
// モバイル：いきもの図鑑ドックの開閉（初期は畳む＝地図＋生き物を主役に）。初回オープン時に図鑑チップを遅延構築。
$('#dockToggle').addEventListener('click',()=>{ const d=$('#dock'), open=d.classList.toggle('open'); $('#dockToggle').setAttribute('aria-expanded',String(open));
  if(open && typeof buildChips==='function') buildChips(); });

function setMode(t){ $('#modetext').textContent=t; }
let toastT; function toast(e,msg,ms=2600){const t=$('#toast');t.innerHTML=`<span class="e">${e}</span>${msg}`;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);}
function bootFail(msg){$('#boot').innerHTML=`<div class="bootwrap"><div style="font-size:40px">📡</div><div class="bt" style="margin-top:14px">読み込みエラー</div><div class="bs" style="max-width:280px;line-height:1.6">${msg}<br>ネット接続を確認して再読み込みしてください。</div></div>`;}
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ closeRedlist(); closeAbout(); closePanel();
  const g=$('#moregroup'); if(g&&g.classList.contains('open')){ g.classList.remove('open'); const b=$('#moreBtn'); if(b){b.setAttribute('aria-expanded','false');b.focus();} } } });
// モバイル幅で起動→デスクトップ幅へリサイズ/回転した際、図鑑チップが空のまま操作不能にならないよう建て直す安全網（chipsBuiltガードで多重構築なし）
addEventListener('resize',()=>{ if(typeof chipsBuilt!=='undefined' && !chipsBuilt && typeof buildChips==='function' && !matchMedia('(max-width:640px)').matches) buildChips(); },{passive:true});
