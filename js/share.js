/* ---------- シェアカード（タスクB） ----------
   「あなたの近くの生き物」を画像カード化してWeb Share/保存。プライバシー：精密座標は
   出さず、Nominatim逆ジオで粗い地名のみ。写真はiNat(CORS=*)をcanvasに描画(taintしない)。 */
function loadImg(url){ return new Promise(res=>{ if(!url){res(null);return;} const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=()=>res(null); im.src=url; }); }
function rrect(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
function drawCover(x,im,a,b,w,h,r){ x.save(); rrect(x,a,b,w,h,r); x.clip(); if(im){const s=Math.max(w/im.width,h/im.height),iw=im.width*s,ih=im.height*s; x.drawImage(im,a+(w-iw)/2,b+(h-ih)/2,iw,ih);}else{x.fillStyle='#16303a';x.fillRect(a,b,w,h);} x.restore(); }
function clip2(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
async function reverseGeocode(lat,lng){
  const k='biosphere_geo_'+lat.toFixed(2)+','+lng.toFixed(2);
  try{ const c=localStorage.getItem(k); if(c!==null) return c; }catch(e){}
  try{ const j=await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=ja`)).json();
    const a=j.address||{}, place=a.city||a.town||a.county||a.suburb||a.village||a.state||''; const name=[place,a.country].filter(Boolean).join('・');
    try{localStorage.setItem(k,name);}catch(e){} return name;
  }catch(e){ return ''; }
}
async function nearPlaceName(){ if(!nearState)return 'この場所'; const l=nearState.label; if(l&&l!=='現在地'&&l!=='指定地点')return l; return (await reverseGeocode(nearState.lat,nearState.lng))||l||'この場所'; }
async function buildShareCanvas(o){
  const W=1080,H=1080,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0c1c27');g.addColorStop(1,'#06121a');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='#34d8c6';x.fillRect(0,0,W,12);
  x.fillStyle='#eaf2f6';x.font='bold 50px sans-serif';x.fillText('🌍 BIOSPHERE',58,100);
  x.fillStyle='#9fb0bd';x.font='27px sans-serif';x.fillText('世界いきもの分布アトラス',60,142);
  x.fillStyle='#34d8c6';x.font='bold 58px sans-serif';
  x.fillText(o.figure ? ('📖 '+clip2(o.figure.biome||'いきもの図鑑',12)) : ('📍 '+clip2(o.place||'この場所',14)),56,232);
  if(o.figure){
    // 図鑑カード：写真/№/保全バッジ/和名/学名/推定生息数/生息環境。写真CORS失敗時はim=null→ソリッド背景＋絵文字。
    const f=o.figure, im=await loadImg(f.ph);
    drawCover(x,im,58,270,964,470,26);
    if(!im && f.emoji){ x.textAlign='center';x.font='200px sans-serif';x.fillStyle='rgba(255,255,255,.92)';x.fillText(f.emoji,540,575);x.textAlign='left'; }
    if(f.no){ x.fillStyle='rgba(0,0,0,.5)'; rrect(x,78,290,168,48,12); x.fill(); x.fillStyle='#eaf2f6';x.font='bold 27px sans-serif';x.fillText('№ '+String(f.no).padStart(3,'0'),96,323); }
    if(f.statusCode){ const bw=304,bx=1002-bw; x.fillStyle=f.color||'#34d8c6'; rrect(x,bx,290,bw,50,13); x.fill(); x.fillStyle='#06231f';x.font='bold 27px sans-serif';x.textAlign='center';x.fillText(clip2(f.statusJp,8)+'（'+f.statusCode+'）',bx+bw/2,324);x.textAlign='left'; }
    x.fillStyle='#eaf2f6';x.font='bold 64px sans-serif';x.fillText(clip2(f.ja||f.sci,15),60,806);
    x.fillStyle='#9fb0bd';x.font='italic 33px sans-serif';x.fillText(clip2(f.sci,32),62,854);
    x.fillStyle='#cdd9df';x.font='29px sans-serif';x.fillText('推定生息数（野生）：'+clip2(f.pop,20),62,908);
    x.fillStyle='#9fb0bd';x.font='27px sans-serif';x.fillText(clip2(f.biome,10)+(f.taxon?(' ・ '+clip2(f.taxon,16)):''),62,950);
  } else if(o.single){
    const sp=o.species[0], im=await loadImg(sp.ph);
    drawCover(x,im,58,282,964,480,26);
    x.fillStyle='#eaf2f6';x.font='bold 62px sans-serif';x.fillText(clip2(sp.ja||sp.sci,16),60,852);
    x.fillStyle='#9fb0bd';x.font='italic 33px sans-serif';x.fillText(clip2(sp.sci,30),62,902);
    x.fillStyle='#cdd9df';x.font='30px sans-serif';x.fillText('この近くで '+sp.count+'件 記録',62,952);
    if(sp.th&&sp.band){ x.fillStyle=sp.bandColor||'#ffb02e'; rrect(x,640,912,382,56,14); x.fill(); x.fillStyle='#06231f';x.font='bold 32px sans-serif';x.fillText('⚠ 絶滅危惧 '+sp.band,660,950); }
  } else {
    x.fillStyle='#cdd9df';x.font='30px sans-serif';x.fillText('周辺 半径'+o.radius+'km ・ 脊椎動物 '+o.total+'種',58,286);
    if(o.threatened>0){ x.fillStyle='#ffd089';x.font='bold 31px sans-serif';x.fillText('⚠ うち絶滅危惧 '+o.threatened+'種',58,330); }
    let y=378; for(const sp of o.species.slice(0,5)){ const im=await loadImg(sp.ph);
      drawCover(x,im,58,y,120,120,18);
      x.fillStyle=sp.th?'#ffce86':'#eaf2f6';x.font='bold 42px sans-serif';x.fillText((sp.th?'⚠ ':'')+clip2(sp.ja||sp.sci,13),200,y+52);
      x.fillStyle='#9fb0bd';x.font='italic 26px sans-serif';x.fillText(clip2(sp.sci,30),202,y+92);
      x.textAlign='right';x.fillStyle='#34d8c6';x.font='bold 30px sans-serif';x.fillText(sp.count+'件',1022,y+52);x.textAlign='left';
      y+=138;
    }
  }
  x.fillStyle='#132935';x.fillRect(0,H-94,W,94);
  x.fillStyle='#34d8c6';x.font='bold 33px sans-serif';x.fillText('ankake-web.github.io/biosphere',58,H-38);
  x.textAlign='right';x.fillStyle='#7f97a3';x.font='23px sans-serif';x.fillText(o.figure?'データ: GBIF ・ 写真: Wikimedia Commons':'データ: GBIF ・ 写真: iNaturalist (CC)',1022,H-38);x.textAlign='left';
  return cv;
}
function doShare(cv,fname,text,url){
  cv.toBlob(async(blob)=>{
    if(!blob){ toast('📤','画像の生成に失敗しました',2200); return; }
    const file=new File([blob],fname,{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],text,url}); }catch(e){} return; }
    showShareModal(URL.createObjectURL(blob),text,url,fname);
  },'image/png');
}
function showShareModal(imgUrl,text,url,fname){
  let m=document.getElementById('sharemodal');
  if(!m){ m=document.createElement('div'); m.id='sharemodal'; m.className='smodal'; document.body.appendChild(m); }
  m.innerHTML=`<div class="sbox"><button class="pclose" onclick="this.closest('.smodal').remove()" aria-label="閉じる">✕</button>
    <img src="${imgUrl}" class="simg" alt="シェアカード">
    <div class="srow"><a class="cta" href="${imgUrl}" download="${fname}">⬇ 画像を保存</a>
      <button class="nbtn" onclick="(navigator.clipboard&&navigator.clipboard.writeText('${url}'))?toast('🔗','リンクをコピーしました',1800):0">🔗 リンクをコピー</button></div>
    <div class="snote2">${text}<br>${url}</div></div>`;
}
async function shareNearCard(btn){
  if(!nearState||!nearRows.length){ toast('📤','まず近くの生き物を表示してください',2200); return; }
  const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const place=await nearPlaceName();
    const ph=nearRows.filter(c=>c.ph);
    const pick=[...ph.filter(c=>THREAT_CATS.has(c.st2)),...ph.filter(c=>!THREAT_CATS.has(c.st2))].slice(0,5)
      .map(c=>({ja:c.ja,sci:c.name,ph:c.ph.replace('/square.','/medium.'),count:fmtN(c.count),th:THREAT_CATS.has(c.st2),band:c.st2,bandColor:RARITY[c.st2]?RARITY[c.st2].color:'#888'}));
    const threatened=nearRows.filter(c=>THREAT_CATS.has(c.st2)).length;
    const cv=await buildShareCanvas({place,species:pick,radius:nearState.radius,total:nearRows.length,threatened});
    const text=`📍${place}の近くにいる脊椎動物 ${nearRows.length}種`+(threatened?`（うち絶滅危惧${threatened}種）`:'')+' #BIOSPHERE';
    const nurl=location.origin+location.pathname+'#@'+nearState.lat+','+nearState.lng+(nearState.radius?(','+nearState.radius):'');   // 受け手がその場所に着地できる地点ディープリンク
    doShare(cv,'biosphere-near.png',text,nurl);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'📤 シェア';btn.disabled=false;}
}
async function shareSpeciesCard(sci,btn){
  if(!nearState)return; const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const place=await nearPlaceName();
    const c=nearRows.find(r=>r.name===sci)||{name:sci,count:0};
    const v=await inatResolve(sci), code=await resolveIucn(sci);
    const sp={ja:v.ja,sci,ph:(v.ph||'').replace('/square.','/medium.'),count:fmtN(c.count||0),th:THREAT_CATS.has(code),band:code,bandColor:RARITY[code]?RARITY[code].color:'#ffb02e'};
    const cv=await buildShareCanvas({place,single:true,species:[sp]});
    const text=`📍${place}の近くで見つけた ${v.ja||sci} #BIOSPHERE`;
    // 図鑑収録種は種ページ(#id)へ、未収録は地点(#@)へ着地させる
    const hit=ANIMALS.find(x=>(x.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===String(sci).toLowerCase());
    const surl = hit ? (location.origin+location.pathname+'#'+hit.id)
                     : (location.origin+location.pathname+'#@'+nearState.lat+','+nearState.lng+(nearState.radius?(','+nearState.radius):''));
    doShare(cv,'biosphere-species.png',text,surl);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'📤 この種をシェア';btn.disabled=false;}
}
// 図鑑の種カードを 1080² 画像でシェア（near-me の buildShareCanvas を figure モードで流用）。
async function shareFigureCard(id, btn){
  const a=(typeof ANIMALS!=='undefined'&&ANIMALS.find)?ANIMALS.find(x=>x.id===id):null; if(!a) return;
  const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const r=RARITY[a.status]||{};
    const fig={ ja:a.nameJa, sci:a.nameSci, ph:a.photo, emoji:a.emoji, no:a.no,
      pop:popOf(a), statusJp:r.jp||'', statusCode:a.status, color:r.color||'#34d8c6',
      biome:a.biome, taxon:a.taxon };
    const cv=await buildShareCanvas({figure:fig});
    const url=location.origin+location.pathname+'#'+a.id;
    const text=`${a.nameJa}（${a.nameSci}）の分布・生態 — BIOSPHERE #いきもの図鑑`;
    doShare(cv,'biosphere-'+a.id+'.png',text,url);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'🔗 共有';btn.disabled=false;}
}

