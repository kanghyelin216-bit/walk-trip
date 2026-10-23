// ===== 16개 권역 (출발 거점: 기차역·터미널·도보 중심지, 좌표는 경도x/위도y) =====
const REGIONS=[
{n:'서울',h:'안국역 · 인사동',x:126.9854,y:37.5766},{n:'부산',h:'부산역 · 초량',x:129.0415,y:35.1150},
{n:'대구',h:'중앙로역 · 동성로',x:128.5944,y:35.8714},{n:'인천',h:'인천역 · 차이나타운',x:126.6165,y:37.4757},
{n:'광주',h:'금남로4가역 · 충장로',x:126.9156,y:35.1488},{n:'대전·세종',h:'대전역',x:127.4348,y:36.3320},
{n:'울산',h:'태화강역',x:129.3515,y:35.5384},{n:'경기',h:'수원역 · 화성',x:127.0010,y:37.2660},
{n:'강원',h:'강릉역',x:128.8996,y:37.7645},{n:'충북',h:'청주 성안길',x:127.4890,y:36.6376},
{n:'충남',h:'공주 공산성',x:127.1425,y:36.4651},{n:'전북',h:'전주 한옥마을',x:127.1530,y:35.8153},
{n:'전남',h:'여수엑스포역',x:127.7520,y:34.7520},{n:'경북',h:'경주 황리단길',x:129.2100,y:35.8387},
{n:'경남',h:'통영 중앙시장',x:128.4228,y:34.8453},{n:'제주',h:'동문시장',x:126.5290,y:33.5128}];
const COL={관광지:'#0A8F5B',문화유산:'#A8691D',맛집:'#F26B21',카페:'#6C4AB6',지하철역:'#1B5FAA',장소:'#5E7068',문화시설:'#B0366B','등산·트레킹':'#3F7D20'};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
const kakao=(n,y,x)=>`https://map.kakao.com/link/to/${encodeURIComponent(n)},${y},${x}`;

// ===== 16회 무중복 '가방(bag)' 추첨: 16개를 섞어 하나씩 뽑고, 비면 다시 채움 (localStorage 유지) =====
function bagLeft(){return LS.get('bag',[]).length}
function drawRegion(){
  let bag=LS.get('bag',[]),renewed=false;
  if(!bag.length){bag=REGIONS.map((_,i)=>i);for(let i=bag.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[bag[i],bag[j]]=[bag[j],bag[i]]}renewed=true}
  const r=bag.pop();LS.set('bag',bag);return{r,renewed};
}

// ===== 지역 확정 모달 (Y/N) =====
function ask(i,mode){
  const d=document.createElement('div');d.className='md';
  d.innerHTML=`<div class="bx" role="dialog"><p class="sm">${mode==='random'?'🎰 랜덤 결과':'📍 선택 완료'}</p><h2>${esc(REGIONS[i].n)}</h2><p>${esc(REGIONS[i].n)} 지역이 선택되었습니다.<br><b>여행 가시겠습니까?</b></p><div class="row"><button class="btn o" id="y">Y 출발!</button><button class="btn k" id="no">N 다시</button></div></div>`;
  document.body.append(d);d.querySelector('#y').focus();
  d.querySelector('#y').onclick=()=>location.href=`course.html?r=${i}&m=${mode}`;
  d.querySelector('#no').onclick=()=>{d.remove();window.onNo&&window.onNo()};
}

// ===== 공공데이터 API: 한국관광공사 TourAPI 위치기반 조회 (JSON) =====
async function tour(op,params){
  const q=new URLSearchParams({serviceKey:CONFIG.KEY,MobileOS:'ETC',MobileApp:'WalkTrip',_type:'json',...params});
  const res=await fetch(`${CONFIG.BASE}/${op}?${q}`);
  if(!res.ok)throw new Error('HTTP '+res.status);
  const j=await res.json();
  const h=j.response?.header;if(h&&h.resultCode!=='0000')throw new Error(h.resultMsg);
  const it=j.response?.body?.items?.item;return it?[].concat(it):[];
}
const near=(R,type,n,rad=2500)=>tour('locationBasedList2',{mapX:R.x,mapY:R.y,radius:rad,contentTypeId:type,arrange:'E',numOfRows:n,pageNo:1});
const tourSearch=q=>tour('searchKeyword2',{keyword:q,contentTypeId:12,numOfRows:8,pageNo:1});
const meters=(a,b)=>{const r=Math.PI/180,dy=(b.y-a.y)*r,dx=(b.x-a.x)*r*Math.cos(a.y*r);return Math.hypot(dx,dy)*6371000};

// ===== 국가유산청 문화유산 API (XML, 인증키 없음): 이름 검색 → 좌표 =====
const HB=(typeof CONFIG!=='undefined'&&CONFIG.HERITAGE)||'https://www.khs.go.kr/cha';
async function xml(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return new DOMParser().parseFromString(await r.text(),'text/xml')}
const tx=(e,k)=>e.querySelector(k)?.textContent.trim()||'';
async function heritageSearch(q){
  const d=await xml(`${HB}/SearchKindOpenapiList.do?ccbaMnm1=${encodeURIComponent(q)}&pageUnit=8&pageIndex=1`);
  return[...d.querySelectorAll('item')].map(e=>({name:tx(e,'ccbaMnm1'),addr:`${tx(e,'ccbaCtcdNm')} ${tx(e,'ccsiName')}`,x:+tx(e,'longitude'),y:+tx(e,'latitude'),kd:tx(e,'ccbaKdcd'),as:tx(e,'ccbaAsno'),ct:tx(e,'ccbaCtcd'),t:'문화유산',k:'heritage'}));
}
async function heritageXY(h){ // 목록에 좌표가 없으면 상세 API로 보충
  if(h.x&&h.y)return h;
  const d=await xml(`${HB}/SearchKindOpenapiDt.do?ccbaKdcd=${h.kd}&ccbaAsno=${h.as}&ccbaCtcd=${h.ct}`);
  return{...h,x:+tx(d,'longitude'),y:+tx(d,'latitude')};
}
// ===== 지하철역·일반 장소 좌표: OpenStreetMap Nominatim (공공데이터포털에 역 좌표 API가 마땅치 않아 보조 사용) =====
async function geocode(q){
  const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&countrycodes=kr&limit=5&accept-language=ko`);
  const j=await r.json();
  return j.map(i=>{const n=i.name||i.display_name.split(',')[0],st=/역$/.test(n)||/station|subway|railway/.test(i.type+i.category);
    return{name:n,addr:i.display_name.split(',').slice(-3,-1).reverse().join(' ').trim(),x:+i.lon,y:+i.lat,k:st?'station':'place',t:st?'지하철역':'장소'}});
}

// ===== 동선 최적화 코스 알고리즘 =====
// 중심점(거점·역·검색한 장소) 반경 내 관광지(12)·음식점(39) 조회 → 맛집/카페(cat3)·문화유산(cat2=A0201) 분류
// 후보(관광지 7·맛집 6·카페 6)에서 [관광지 2 + 맛집 1 + 카페 1] 조합을 모두 만들고,
// 방문 순서 전체 순열(맛집→카페 순서 제약)의 총 도보거리를 계산해 최단 동선(브루트포스 TSP)을 구함
// 점수 = 총 도보거리 − 문화유산 보너스(250m/곳) → 상위 4개 중 랜덤 (다시 짜기 때 다른 코스)
// 도보거리 = 직선거리×1.3(도로 보정), 속도 67m/분
const perms=a=>a.length<2?[a]:a.flatMap((v,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[v,...p]));
async function buildCourse(R,rad=2500){
  const [sp,fd]=await Promise.all([near(R,12,60,rad),near(R,39,150,rad)]);
  const mk=(a,t)=>a.map(i=>({id:i.contentid,t:t==='관광지'&&i.cat2==='A0201'?'문화유산':t,name:i.title,addr:i.addr1,x:+i.mapx,y:+i.mapy,img:(i.firstimage||'').replace('http://','https://')}));
  const F=R.fixed,o=F||{x:R.x,y:R.y};
  const pick=(a,n)=>a.filter(p=>!(F&&p.name===F.name)).map(p=>({...p,w:meters(o,p)-(p.t==='문화유산'?400:0)})).sort((a,b)=>a.w-b.w).slice(0,n);
  const S=pick(mk(sp,'관광지'),7),Fo=pick(mk(fd.filter(i=>i.cat3!=='A05020900'),'맛집'),6),Ca=pick(mk(fd.filter(i=>i.cat3==='A05020900'),'카페'),6);
  const pairs=[];for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++)pairs.push([S[i],S[j]]);
  if(!pairs.length&&S.length)pairs.push([S[0]]);
  const all=[];
  for(const pr of pairs)for(const f of Fo.length?Fo:[null])for(const c of Ca.length?Ca:[null])
    for(const q of perms([...pr,f,c].filter(Boolean))){
      const fi=q.findIndex(s=>s.t==='맛집'),ci=q.findIndex(s=>s.t==='카페');if(fi>=0&&ci>=0&&fi>ci)continue;
      let cur=o,d=0;const legs=q.map(s=>{const l=Math.round(meters(cur,s)*1.3);cur=s;d+=l;return l});
      all.push({q,legs,sc:d-q.filter(s=>s.t==='문화유산').length*250});
    }
  all.sort((a,b)=>a.sc-b.sc);
  const b=all[Math.random()*Math.min(4,all.length)|0];
  if(!b)throw new Error('이 주변(반경 '+rad+'m)에 코스를 만들 데이터가 부족해요. 반경을 늘리거나 다른 장소를 골라보세요.');
  const stops=[...(F?[{...F}]:[]),...b.q.map((s,i)=>({...s,leg:b.legs[i]}))];
  if(stops.length<3)throw new Error('주변 데이터가 부족해요. 다른 장소를 골라보세요.');
  const total=stops.reduce((a,s)=>a+s.leg,0);
  return{stops,total,mins:Math.round(total/67)};
}


// ===== Overpass(OSM 역 조회): 공개 서버가 자주 혼잡(502 등)해서 미러 3곳을 순서대로 시도 =====
const OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
async function overpass(q){
  for(const u of OVP){
    try{
      const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});
      if(!r.ok)throw 0;const t=await r.text();if(t.trim()[0]!=='{')throw 0;return JSON.parse(t);
    }catch{}
  }
  throw new Error('지하철역 조회 서버(Overpass)가 혼잡해요. 잠시 후 다시 검색해 주세요');
}

// ===== 구간 이동수단 판단 =====
// ① 도보 1km 이하 → 도보
// ② 국토교통부 TAGO 버스정류소정보 API(JSON): 두 지점 근처 정류소 → 각 정류소 경유노선 → 공통 노선번호가 있으면 직행 버스 안내
// ③ 없으면 OSM으로 근처 지하철·철도역을 찾아 역 간 이동 안내, ④ 그것도 없으면 일반 '대중교통'(카카오맵 링크)
const TB='https://apis.data.go.kr/1613000/BusSttnInfoInqireService';
async function pub(u,p){
  const r=await fetch(`${u}?${new URLSearchParams({serviceKey:CONFIG.KEY,_type:'json',...p})}`);
  if(!r.ok)throw new Error('HTTP '+r.status);
  const it=(await r.json()).response?.body?.items?.item;return it?[].concat(it):[];
}
async function busBetween(a,b){
  const stops=async p=>(await pub(TB+'/getCrdntPrxmtSttnList',{gpsLati:p.y,gpsLong:p.x,numOfRows:3,pageNo:1})).slice(0,2);
  const routes=async s=>new Set((await pub(TB+'/getSttnThrghRouteList',{cityCode:s.citycode,nodeId:s.nodeid,numOfRows:100,pageNo:1})).map(r=>String(r.routeno)));
  const [A,B]=await Promise.all([stops(a),stops(b)]);
  const ra=await Promise.all(A.map(async s=>({s,r:await routes(s)}))),rb=await Promise.all(B.map(async s=>({s,r:await routes(s)})));
  for(const x of ra)for(const y of rb)if(x.s.citycode==y.s.citycode)for(const no of x.r)if(y.r.has(no))return{no,from:x.s.nodenm,to:y.s.nodenm};
  return null;
}
async function nearStation(p,r=1200){
  const q=`[out:json][timeout:10];node["railway"="station"](around:${r},${p.y},${p.x});out 10;`;
  const l=(await overpass(q)).elements.filter(e=>/[가-힣]/.test(e.tags?.name||'')).map(e=>({n:e.tags.name.replace(/역?$/,'역'),d:meters(p,{x:e.lon,y:e.lat})}));
  return l.sort((a,b)=>a.d-b.d)[0]?.n||null;
}
const kakaoRoute=(a,b)=>`https://map.kakao.com/link/by/traffic/${encodeURIComponent(a.name)},${a.y},${a.x}/${encodeURIComponent(b.name)},${b.y},${b.x}`;
async function legTransit(a,b){
  const w=Math.round(meters(a,b)*1.3);
  if(w<=1000)return{ic:'🚶',lab:'도보',min:Math.max(1,Math.round(w/67))};
  try{const k=await busBetween(a,b);if(k)return{ic:'🚌',lab:k.no+'번 버스',min:11+Math.round(w/300),det:`${k.from} 승차 → ${k.to} 하차 (방향은 카카오맵 확인)`}}catch{}
  try{const [s1,s2]=await Promise.all([nearStation(a),nearStation(b)]);if(s1&&s2&&s1!==s2)return{ic:'🚇',lab:'지하철·철도',min:14+Math.round(w/580),det:`${s1} → ${s2}`}}catch{}
  return{ic:'🚌🚇',lab:'대중교통',min:12+Math.round(w/350),det:'노선은 카카오맵에서 확인'};
}
