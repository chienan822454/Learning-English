// V6.4.0：速度（到期數量、出題選項索引、放回原句與對話填空的比對規則快取、統計頁一次算完與不重畫）結果和原本完全相同；
// Role Play 沒念到的字 → 錯題本（篩選辨識錯誤：相似度 50% 以上、不是自由回答、只收字表裡的進階字、兩次沒念到才放進去、念到就移除）
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path');
const PORT=8908,U='http://localhost:8908/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const MISS=[];
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
const open=async()=>{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block',permissions:['microphone']});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5);speechSynthesis.cancel=()=>{}});
 await pg.goto(U);await pg.waitForFunction(()=>typeof EX2_READY!=='undefined'&&EX2_READY&&MORE_READY,null,{timeout:40000});await sleep(200);
 return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}};

/* ===== A. 速度：結果和原本相同 ===== */
{const {ctx,pg,errs,E}=await open();
 await E(()=>{const base=WORDS.filter(x=>!x.b&&!x.ce).map(x=>x.w);base.slice(0,2500).forEach((w,i)=>{store.wordStatus[w]=i%3?'known':'learning';store.reviewDue[w]=day((i%40)-10)});store.reviewDue.notaword=day(-3);
  const ids=SENTENCES.map(x=>x.id).concat(ALLS.filter(s=>s.src!=='core').slice(0,3000).map(s=>s.id));store.known=ids.slice(0,2500);store.sDue={};ids.forEach((id,i)=>store.sDue[id]=day((i%30)-8));store.sDue['zz:none']=day(-1);save()});
 const c=await E(()=>({u1:new Set(ALLS.map(s=>String(s.id))).size===ALLS.length,u2:new Set(WORDS.map(x=>x.w)).size===WORDS.length,s:[sDueN(),ALLS.filter(s=>isSDue(s.id)).length],w:[wDueN(),WORDS.filter(x=>isDue(x.w)).length]}));
 ok('句子 id、單字都不重複（快速計數的前提）',c.u1&&c.u2);
 ok('到期句子、到期單字的數量：快速計數和逐一比對相同（含不存在的項目）',c.s[0]===c.s[1]&&c.w[0]===c.w[1]&&c.s[0]>0&&c.w[0]>0,JSON.stringify(c));
 /* 出題選項：用索引（同一個字表第二次起）和逐一比對（新的字表）在同樣亂數下完全相同 */
 const po=await E(()=>{const seed=s=>()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x80000000};const old=Math.random;let same=0,tot=0;const diff=[];
  const pools={all:quizPool(),base:window.__baseW=window.__baseW||WORDS.filter(y=>!y.b||y.k===7)};
  try{for(const [nm,P] of Object.entries(pools)){pickOpts(P[0],P);pickOpts(P[1],P);
   for(let t=0;t<150;t++){const x=P[(t*37+11)%P.length];Math.random=seed(t+1);const a=pickOpts(x,P).map(y=>y.w).join();Math.random=seed(t+1);const b2=pickOpts(x,P.slice()).map(y=>y.w).join();tot++;if(a===b2)same++;else if(diff.length<3)diff.push(x.w+' '+a+' | '+b2)}}}finally{Math.random=old}
  return {same,tot,diff,idx:!!_pkI.get(pools.all)&&_pkI.get(pools.all).n===pools.all.length}});
 ok('出題選項：用索引和逐一比對在同樣亂數下完全相同（300 題）',po.same===po.tot&&po.tot===300&&po.idx,JSON.stringify(po));
 const sp=await E(()=>{const P=quizPool();const T={fast:0,slow:0};for(let r=0;r<6;r++)for(const k of r%2?['fast','slow']:['slow','fast']){const xs=Array.from({length:15},(_,j)=>P[(j*53+r*7)%P.length]);const a=performance.now();xs.forEach(x=>pickOpts(x,k==='fast'?P:P.slice()));if(r>=2)T[k]+=performance.now()-a}return {fast:Math.round(T.fast),slow:Math.round(T.slow)}});
 ok('出題選項：用索引比較快',sp.fast<sp.slow,JSON.stringify(sp));
 /* 放回原句：快取的比對規則和含這個字的對話句，和每次重新找相同 */
 const cx=await E(()=>{const ws=['alarm','check','valve','power','temperature','breaker','pump','report','go','have'].filter(w=>BY_WORD[w]);let bad=[];
  ws.forEach(w=>{const x=BY_WORD[w];ctxFind(x);const hits=_cxD.get(w)||[];const fs=hlForms(w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');const want=[];DIALOGS.forEach(d=>d.lines.forEach((L,n)=>{if(want.length<20&&r.test(L.en))want.push('d:'+d.id+':'+n)}));if(hits.join()!==want.join())bad.push(w)});return {n:ws.length,bad}});
 ok('放回原句：快取的對話句和每次重新找的相同',cx.bad.length===0&&cx.n>=6,JSON.stringify(cx));
 const dr=await E(()=>{let bad=0,n=0;const P=dcPool();DIALOGS.slice(0,10).forEach(d=>d.lines.forEach(L=>{const low=L.en.toLowerCase();P.slice(0,300).forEach(w=>{n++;const a=dcRe(w).test(low),b2=new RegExp('\\b'+w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(low);if(a!==b2)bad++})}));return {n,bad}});
 ok('對話填空：快取的比對規則和每次重新建立的結果相同',dr.bad===0&&dr.n>1000,JSON.stringify(dr));
 /* 統計頁：冊別數量和逐一計算相同；內容一樣不重畫、有變動就重畫 */
 await pg.click('#navStats');await sleep(300);
 const st=await E(()=>{const sv=skipV(),inB=(x,b)=>inBook(x,String(b))&&!(sv&&x.b&&x.k!==7);const rows=[...document.querySelectorAll('#statsBody .stat-row')].map(r=>r.innerText.replace(/\s+/g,' '));
  const want=[1,2,3,4,5,7,8,'toeic'].map(b=>{const a=WORDS.filter(x=>inB(x,b));return [a.length,a.filter(x=>statusOf(x.w)==='known').length]}).filter(v=>v[0]);
  const all=WORDS.filter(x=>inB(x,'all'));return {rows:rows.slice(0,want.length+1),want,all:[all.length,all.filter(x=>statusOf(x.w)==='known').length],lr:WORDS.filter(x=>statusOf(x.w)==='learning').length,txt:document.querySelector('#statsBody').innerText}});
 const num=r=>(r.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/)||[]).slice(1).map(v=>+v.replace(/,/g,''));
 ok('統計頁：各冊、合計的已熟數量和逐一計算相同',st.want.every((v,k)=>JSON.stringify(num(st.rows[k]))===JSON.stringify([v[1],v[0]]))&&JSON.stringify(num(st.rows[st.want.length]))===JSON.stringify([st.all[1],st.all[0]])&&st.txt.includes('學習中 '+st.lr)||st.txt.includes(String(st.lr)),JSON.stringify({rows:st.rows,want:st.want,all:st.all}));
 const rd=await E(()=>{const sb=document.querySelector('#statsBody'),f=sb.firstChild;renderStats();const kept=sb.firstChild===f;const w=WORDS.find(x=>statusOf(x.w)==='new'&&!x.b&&x.k>=1&&x.k<=5);setStatus(w.w,'known');renderStats();const changed=sb.firstChild!==f;sb.innerHTML='';renderStats();return {kept,changed,back:sb.children.length>3}});
 ok('統計頁：內容沒變不重畫；學習紀錄變了、或內容被清掉都會重畫',rd.kept&&rd.changed&&rd.back,JSON.stringify(rd));
 ok('沒有 JavaScript 錯誤（速度）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== B. Role Play 沒念到的字 ===== */
{const {ctx,pg,errs,E}=await open();
 const pick=await E(()=>{store.settings.rpLevel='hint';for(const d of DIALOGS){const me='B';for(let n=0;n<d.lines.length;n++){const L=d.lines[n];if(L.s!==me)continue;const M=rpMissWords(L.en,'');const m=M.miss.find(w=>w.length>=5&&!/[A-Z]/.test(L.en.split(/\s+/).find(t=>t.toLowerCase().replace(/[^a-z'-]/g,'').startsWith(w.slice(0,4)))||'X'));
   if(m){const words=L.en.split(/\s+/);const drop=words.filter(t=>{const c=t.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,'');let x=null;try{x=kwTok(c)}catch(e){}return !(x&&x.w===m)});const heard=drop.join(' ');const T=scTok(L.en),H=scHeard(heard),sc=Math.round(T.filter(t=>H.has(t)).length/T.length*100);if(sc>=50&&sc<100&&words.length>=6)return {d:d.id,n,en:L.en,w:m,heard,sc,t:d.t}}}}return null});
 ok('找到測試用的 Role Play 句子（含一個進階字）',!!pick,JSON.stringify(pick));
 const st0=await E(p=>({st:statusOf(p.w),rd:store.reviewDue[p.w]||null}),pick);
 await E(p=>{rpStart(DLG_BY[p.d],'B',p.n,{},true)},pick);await sleep(300);
 const on=await E(p=>RP.on&&RP.n===p.n&&cur().en===p.en,pick);
 ok('Role Play 停在這一句',on);
 /* 第一次沒念到：觀察中 */
 await E(p=>srResult(p.heard),pick);await sleep(100);
 const r1=await E(p=>({ww:(store.wrongWords||{})[p.w]||0,pm:(store.rpMiss||{})[p.w],msg:(document.querySelector('#result .rp-miss')||{}).textContent||''}),pick);
 ok('第一次沒念到：先記在觀察中（還沒放進錯題本），提醒「下次再沒念到才會放進錯題本」',!r1.ww&&r1.pm&&r1.pm.s==='d:'+pick.d+':'+pick.n&&/下次再沒念到/.test(r1.msg),JSON.stringify(r1));
 /* 念到了：移除 */
 await E(p=>srResult(p.en),pick);await sleep(100);
 ok('之後念到了：從觀察中移除',await E(p=>!(store.rpMiss||{})[p.w]&&!(store.wrongWords||{})[p.w],pick));
 /* 兩次沒念到：放進錯題本 */
 await E(p=>{srResult(p.heard);srResult(p.heard)},pick);await sleep(100);
 const r2=await E(p=>({ww:(store.wrongWords||{})[p.w]||0,src:(store.wrongSrc||{})[p.w],pm:(store.rpMiss||{})[p.w],msg:[...document.querySelectorAll('#result .rp-miss')].map(e=>e.textContent).join(' '),st:statusOf(p.w),rd:store.reviewDue[p.w]||null}),pick);
 ok('再沒念到一次：放進答錯單字本（還要答對 2 次），出處是這一句（Role Play），提醒「已放進錯題本」',r2.ww===2&&r2.src&&r2.src.s==='d:'+pick.d+':'+pick.n&&r2.src.q==='rp'&&!r2.pm&&/已放進錯題本/.test(r2.msg),JSON.stringify(r2));
 ok('不會改變這個字的學習狀態和複習日期',r2.st===st0.st&&r2.rd===st0.rd,JSON.stringify([st0,r2.st,r2.rd]));
 /* 錯題本顯示出處、可以放回原句 */
 await E(()=>{rpOff();openWrongBook()});await sleep(300);
 const wb=await E(p=>{const r=[...document.querySelectorAll('#wrongBody .wb-row')].find(x=>x.querySelector('b').textContent===dispW(p.w));return r&&(r.querySelector('.wb-src')||{}).textContent},pick);
 ok('錯題本顯示出處「🎭 Role Play「對話名稱」」',!!wb&&wb.includes('Role Play')&&wb.includes(pick.t),wb);
 await E(p=>{store.wrongWords={[p.w]:2};page('quiz');$('#quizType').value='wctx';$('#quizType').onchange()},pick);await sleep(200);
 const cq=await E(()=>document.querySelector('#quizQ').innerText);
 ok('放回原句：用 Role Play 沒念到的那一句出題',cq.includes(pick.t),cq.slice(0,120));
 /* 篩選 */
 await E(p=>{store.wrongWords={};delete store.rpMiss;rpStart(DLG_BY[p.d],'B',p.n,{},true)},pick);await sleep(200);
 await E(()=>{srResult('hello');srResult('hello')});
 ok('相似度不到 50%（多半是辨識或麥克風問題）：不記錄',await E(p=>!(store.rpMiss||{})[p.w]&&!Object.keys(store.wrongWords||{}).length,pick));
 await E(p=>{store.settings.rpLevel='free';srResult(p.heard);srResult(p.heard);store.settings.rpLevel='hint'},pick);
 ok('自由回答難度：不記錄（可以用自己的話說）',await E(p=>!(store.rpMiss||{})[p.w]&&!Object.keys(store.wrongWords||{}).length,pick));
 const flt=await E(()=>{const M=rpMissWords('Please check the UPS-2A breaker on the 3rd floor at 2:15 and the AHU-5 pump.','');return M.miss});
 ok('只收字表裡比較進階的字：常用字（please、check）、基本字、介系詞冠詞、設備編號、縮寫、數字都不收',!flt.some(w=>/^(please|check|the|on|at|and|ups|ahu)$/i.test(w)||/\d/.test(w))&&flt.includes('breaker'),JSON.stringify(flt));
 await E(p=>{srResult(p.heard)},pick);
 const old=await E(p=>{store.rpMiss[p.w].d=day(-20);srResult(p.heard);return {ww:(store.wrongWords||{})[p.w]||0,pm:store.rpMiss[p.w]&&store.rpMiss[p.w].d===day()}},pick);
 ok('觀察中超過 14 天：重新開始觀察（不放進錯題本）',old.ww===0&&old.pm,JSON.stringify(old));
 const nz=await E(()=>normStore({rpMiss:{pump:{n:1,d:day(-2),s:'d:d01:3'},old:{n:1,d:day(-30),s:'d:d01:3'},'bad key':{d:day()},valve:{d:day(),s:'<x>'}}}).rpMiss);
 ok('匯入時整理觀察中的字：去掉 14 天以前、格式不對的',JSON.stringify(Object.keys(nz).sort())==='["pump","valve"]'&&nz.pump.s==='d:d01:3'&&!nz.valve.s,JSON.stringify(nz));
 ok('沒有 JavaScript 錯誤（Role Play）',errs.length===0,errs.join(' | '));await ctx.close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p37.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
