// V5.34.0：開啟速度（情境題、發音辨別、人名地名移到 data-more.js）、測驗出題速度、單字搜尋速度
// 用法：node p30_test.js（和其他測試一樣在 tests 資料夾執行，網站在 site/）。
// 選用：P30_OLD=舊版網站資料夾（例如 V5.33.1）時，用它測「從舊版更新」；沒有設定時，用目前的檔案還原出舊的字庫格式來測。
const {serve,launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const PORT=8901,SITE='site',TMP=path.join(require('os').tmpdir(),'e5k_p30_'+process.pid);
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
let ROOT=SITE,ONLINE=true,LOG=[];
const srv=http.createServer((q,s)=>{if(!ONLINE){q.socket.destroy();return}let p=decodeURIComponent(q.url.split('?')[0]);LOG.push(p);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});s.end(fs.readFileSync(f))}).listen(PORT);
const URL0=`http://localhost:${PORT}/`;
const sha12=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0,12);
const gz=s=>zlib.gzipSync(Buffer.isBuffer(s)?s:Buffer.from(s,'utf8')).length;
const load=(...files)=>{const vm=require('vm');const ctx={window:{}};for(const f of files)vm.runInNewContext(fs.readFileSync(f,'utf8'),ctx);return ctx.window};
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};

/* ---------- V5.33.1 原本的做法（用來比對結果是否完全相同；只在瀏覽器裡執行） ---------- */
function origLev(a,b){
  if(Math.abs(a.length-b.length)>3)return 9;
  let d=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){
    let p=d[0];
    d[0]=i;
    for(let j=1;j<=b.length;j++){
      let t=d[j];
      d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));
      p=t
    }
  }
  return d[b.length]
}
function origZhSenses(z){
  let r=window._oSenseC.get(z);
  if(!r){
    r=String(z||'').replace(/（[^）]*）|\([^)]*\)/g,'').split(/[；;]/).map(s=>s.trim()).filter(Boolean);
    window._oSenseC.set(z,r)
  }
  return r
}
function origPickOpts(x,pool,n=3){
  let p1=(x.pos||'').split('/')[0];
  const xs=origZhSenses(x.zh),dw=dispW(x.w).toLowerCase();
  let cand=pool.filter(y=>y.w!==x.w&&y.zh!==x.zh&&!(x.p&&y.p===x.p)&&y.b!==x.w&&x.b!==y.w&&!(x.b&&y.b===x.b)&&(y._dl||(y._dl=dispW(y.w).toLowerCase()))!==dw&&!(y._zs||(y._zs=origZhSenses(y.zh))).some(s=>xs.includes(s)));
  if(cand.length>500){
    const a=x.w[0],e2=x.w.slice(-2),L=x.w.length;
    const near=[],rest=[];
    for(const y of cand){
      if(y.w[0]===a||y.w.slice(-2)===e2)near.push(y);else rest.push(y)
    }
    for(let k=rest.length-1;k>0;k--){
      const j=Math.floor(Math.random()*(k+1));
      [rest[k],rest[j]]=[rest[j],rest[k]]
    }
    cand=near.concat(rest.slice(0,Math.max(150,500-near.length)))
  }
  let sc=cand.map(y=>{
    let s=Math.random()*1.5;
    if((y.pos||'').split('/')[0]===p1)s+=3;
    if(y.w[0]===x.w[0])s+=1;
    if(y.w.slice(0,3)===x.w.slice(0,3))s+=2;
    let L=origLev(x.w,y.w);
    if(L<=2)s+=3;else if(L<=3)s+=1.5;
    if(Math.abs(y.w.length-x.w.length)<=1)s+=.5;
    return [s,y]
  }).sort((a,b)=>b[0]-a[0]);
  const out=[],sz=new Set([x.zh]),sw=new Set([dw]);
  for(const y of sc.slice(0,12).map(v=>v[1]).sort(()=>Math.random()-.5).concat(sc.slice(12).map(v=>v[1]))){
    const yw=dispW(y.w).toLowerCase();
    if(sz.has(y.zh)||sw.has(yw))continue;
    sz.add(y.zh);
    sw.add(yw);
    out.push(y);
    if(out.length>=n)break
  }
  return out
}
function origHl0(x){
  const e=esc(x.ex);
  const fs=hlForms(x.w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
  return r.test(e)?e.replace(r,'$1<mark>$2</mark>'):e
}
function origWordFiltered(){
  let q=$('#wordSearch').value.trim().toLowerCase(),book=$('#wordBook').value,st=$('#wordState').value,tp=$('#wordTopic').value;
  return toeicSort(WORDS.filter(x=>(!q||x.w.toLowerCase().includes(q)||(x.zh&&x.zh.includes(q)))&&(q||!skipV()||!x.b||x.k===7)&&(tp==='all'||(x.t||[]).includes(tp))&&((q&&book==='all')||inBook(x,book))&&(st==='all'||(st==='fav'&&cset('wordFav').has(x.w))||(st==='review'&&isDue(x.w))||(st==='wrong'&&!!(store.wrongWords||{})[x.w])||(st==='zh'&&x.zh)||(st==='meanweak'&&mrHas(x.w))||(st!=='fav'&&st!=='review'&&st!=='zh'&&st!=='wrong'&&statusOf(x.w)===st))),q?'all':book)
}
function origWordNums(){
  const book=$('#wordBook').value,tp=$('#wordTopic').value,sv=skipV(),fv=cset('wordFav');
  const B=WORDS.filter(x=>inBook(x,book)&&!(sv&&x.b&&x.k!==7)&&(tp==='all'||(x.t||[]).includes(tp)));
  return [B.filter(x=>statusOf(x.w)==='known').length,B.filter(x=>fv.has(x.w)).length,B.filter(x=>isDue(x.w)).length].join(',')
}
function seedRng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
const ORIG=[origLev,origZhSenses,origPickOpts,origHl0,origWordFiltered,origWordNums,seedRng].map(f=>f.toString()).join('\n')+'\nwindow._oSenseC=new Map();';

(async()=>{const b=await launch();
/* 開一個分頁；more：data-more.js 的處理（'gate' 等測試放行、'fail' 下載失敗、預設照常）；sw：是否用離線快取 */
async function open(o={}){
  const ctx=await b.newContext(Object.assign({viewport:o.vp||{width:390,height:844},permissions:['microphone']},o.sw?{}:{serviceWorkers:'block'}));
  await ctx.addInitScript(stub);
  if(o.store)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('p30init')){sessionStorage.setItem('p30init','1');localStorage.setItem('english5000v5',s)}},JSON.stringify(o.store));
  let gate=null,openGate=null,mode=o.more||'';
  const newGate=()=>{gate=new Promise(r=>openGate=r)};newGate();
  if(mode)await ctx.route('**/data-more.js*',async r=>{try{if(mode==='fail')return await r.abort();if(mode==='gate')await gate;await r.continue()}catch(e){}});
  const pg=await ctx.newPage();const errs=[],reqs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));
  pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_FAILED|net::/.test(m.text()))errs.push('console: '+m.text())});
  pg.on('request',r=>{if(/data[\w-]*\.js/.test(r.url()))reqs.push({f:r.url().replace(/^.*\/|\?.*$/g,''),t:Date.now(),e:'req'})});
  pg.on('requestfinished',r=>{if(/data[\w-]*\.js/.test(r.url()))reqs.push({f:r.url().replace(/^.*\/|\?.*$/g,''),t:Date.now(),e:'done'})});
  if(o.go!==false){await pg.goto(URL0);await sleep(600);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:20000}).catch(()=>{})}
  return {ctx,pg,errs,reqs,E:(f,a)=>pg.evaluate(f,a),release:()=>{mode='';openGate()},setMode:m=>{mode=m;if(m==='gate')newGate()}}
}
async function tapWord(pg,sel,word){const p=await pg.evaluate(([sel,word])=>{for(const el of document.querySelectorAll(sel)){const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){if(n.parentElement.closest('small'))continue;const m=new RegExp('(^|[^A-Za-z])('+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z])').exec(n.data);if(m){el.scrollIntoView({block:'center'});const k=m.index+m[1].length;const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+word.length);const q=r.getBoundingClientRect();return {x:q.left+Math.min(q.width/2,4),y:q.top+q.height/2}}}}return null},[sel,word]);if(p){await pg.mouse.click(p.x,p.y);await sleep(250)}return p}
const pop=pg=>pg.evaluate(()=>{const p=document.querySelector('#lkPop');if(!p||p.hidden)return null;return {w:(p.querySelector('.lk-w b')||{}).textContent||'',tag:(p.querySelector('.lk-tag')||{}).textContent||'',zh:(p.querySelector('.lk-zh')||{}).textContent||'',base:[...p.querySelectorAll('.lk-base')].map(x=>x.textContent).join('｜'),said:window.__said.slice()}});
const quizState=E=>E(()=>({q:$('#quizQ').textContent,n:document.querySelectorAll('#quizOpts button[data-k]').length,sq:document.querySelectorAll('#quizOpts .sq-opt').length,pair:document.querySelectorAll('#quizOpts .pair-opt').length,retry:!!$('#moreRetry'),lab:$('#quizType option[value="situ"]').textContent}));

// ---------- A. 字庫分檔 ----------
{const W=load(SITE+'/data.js'),M=load(SITE+'/data-more.js');
const MV=['SITQ','PAIRS','PROPER','GLOSS'];
ok('開啟時用不到的字庫移到 data-more.js：CE 情境題（'+(M.SITQ||[]).length+' 題）、發音辨別（'+(M.PAIRS||[]).length+' 組）、人名地名（'+Object.keys(M.PROPER||{}).length+'）、補充字典（'+Object.keys(M.GLOSS||{}).length+'）；data.js 不再包含這些資料',MV.every(k=>M[k]&&!(k in W))&&M.SITQ.length>=150&&M.PAIRS.length>=46&&Object.keys(M.PROPER).length>=52&&Object.keys(M.GLOSS).length>=139&&Object.keys(M).sort().join()==='GLOSS,PAIRS,PROPER,SITQ',Object.keys(W).join(',')+' | '+Object.keys(M).join(','));
/* V6.2.0：V4_WORDS 移到 data-v4.js（只有很舊的紀錄才載入）；KWPRE＝事先算好的關鍵字 */{const V4=load(SITE+'/data-v4.js');ok('開啟時轉移舊版學習紀錄要用的資料（MERGED、MERGED4、MERGED5）、第一個畫面要用的資料和事先算好的關鍵字在 data.js；V4_WORDS 在 data-v4.js',['WORDS','SENTENCES','PHRASES','TOPICS','MERGED','MERGED4','MERGED5','DIALOGS','RADIO','FRAMES','KWPRE'].every(k=>k in W)&&!('V4_WORDS' in W)&&V4.V4_WORDS.length===5000,Object.keys(W).join(','))}
const d0=fs.readFileSync(SITE+'/data.js'),d1=fs.readFileSync(SITE+'/data-more.js');
const saved=gz(Buffer.concat([d0,Buffer.from('\n'),d1]))-gz(d0);
ok('第一次開啟少下載：data.js 壓縮後約 '+Math.round(gz(d0)/1024)+' KB，移到 data-more.js 的部分壓縮後約 '+Math.round(saved/1024)+' KB（50 KB 以上）',saved>=50*1024,JSON.stringify({dataJs:gz(d0),saved}));
const sw=fs.readFileSync(SITE+'/sw.js','utf8');const DF=JSON.parse(((sw.match(/const DATA_FILES=(\{[^}]*\})/)||[])[1]||'{}').replace(/'/g,'"'));
/* V6.2.0：加上 data-v4.js（V4 字表） */ok('離線快取清單有 6 個字庫檔（data.js、data-ex.js、data-ex2.js、data-more.js、data-toeic.js、data-v4.js），SHA-1 前 12 碼都和檔案一致',Object.keys(DF).length===6&&['data.js','data-ex.js','data-ex2.js','data-more.js','data-toeic.js','data-v4.js'].every(f=>DF[f]&&DF[f]===sha12(path.join(SITE,f))),JSON.stringify(DF));
ok('data-more.js 下載完會通知 App（最後一行呼叫 __dataMore），格式和 data-ex.js 一樣',/\nif\(window\.__dataMore\)window\.__dataMore\(\);\n?$/.test(d1.toString()));}

// ---------- B. 開啟順序、資料還沒下載完時的第一個畫面 ----------
{const {ctx,pg,errs,reqs,E}=await open();
await pg.waitForFunction(()=>MORE_READY&&EX2_READY,null,{timeout:30000}).catch(()=>{});
const t=f=>{const x=reqs.find(r=>r.f===f&&r.e==='req');return x?x.t:-1},d=f=>{const x=reqs.find(r=>r.f===f&&r.e==='done');return x?x.t:-1};
const ord=reqs.filter(r=>r.e==='req').map(r=>r.f);
ok('開啟順序：先 data.js；畫面出來後載入單字例句（data-ex.js），例句下載完才下載 data-more.js，最後才是多益長例句（data-ex2.js）',ord.join(' ')==='data.js data-ex.js data-more.js data-ex2.js'&&t('data-more.js')>=d('data-ex.js')&&t('data-ex2.js')>t('data-more.js'),ord.join(' → '));
const S=await E(()=>({ready:MORE_READY,sq:SITQ.length,pairs:(window.PAIRS||[]).length,lab:$('#quizType option[value="situ"]').textContent}));
ok('下載完：情境題 '+S.sq+' 題、發音辨別 '+S.pairs+' 組都可以用，測驗選單顯示題數',S.ready&&S.sq>=150&&S.pairs>=46&&new RegExp('（'+S.sq+' 題）').test(S.lab),JSON.stringify(S));
ok('開啟與下載過程沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate'});
const T=await E(()=>({ready:!!MORE_READY,today:!!document.querySelector('#todayBody [data-go="new"]')&&!$('#todayPage').hidden,ex:EX_READY}));
await pg.click('#navPractice');await sleep(200);await pg.click('#next');await sleep(150);
const P=await E(()=>({en:$('#english').textContent.length,prog:$('#progress').textContent}));
await pg.click('#navWords');await sleep(300);await pg.fill('#wordSearch','check');await sleep(500);
const Wd=await E(()=>({n:document.querySelectorAll('#wordRows .word-card').length,first:($('#wordRows .word-card strong')||{}).textContent}));
await pg.click('#navQuiz');await sleep(200);await E(()=>{$('#quizType').value='word';$('#quizMode').value='en';$('#quizType').onchange()});await sleep(150);
const Q=await E(()=>document.querySelectorAll('#quizOpts button').length);
ok('data-more.js 還沒下載完時：今日頁、句子頁、單字頁搜尋、單字測驗都能正常使用',!T.ready&&T.today&&T.ex&&P.en>5&&Wd.n>0&&/check/i.test(Wd.first||'')&&Q===4,JSON.stringify({T,P,Wd,Q}));
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});
ok('第一個畫面測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 下載中（網路慢）：顯示下載中，下載完自動接著做 ----------
{const {ctx,pg,errs,E,release}=await open({more:'gate',store:{sqWrong:{q01:1,q02:2},settings:{dailyGoal:20}}});
const A=await E(()=>({lab:$('#quizType option[value="situ"]').textContent,today:($('#todayBody').textContent.match(/我的錯題本[^開打]*/)||[''])[0].replace(/\s+/g,'')}));
ok('下載中：測驗選單的「CE 情境題」顯示（載入中）',/CE 情境題（載入中）/.test(A.lab),A.lab);
ok('下載中：今日頁的「我的錯題本」先用答錯紀錄算出情境題 2 題',/情境題2，共2題/.test(A.today),A.today);
await pg.click('#todayBody [data-go="situ"]');await sleep(300);
const B1=await quizState(E);
ok('下載中按今日頁 CE 情境題「開始」：顯示「題目資料下載中」，還沒有選項',/題目資料下載中/.test(B1.q)&&B1.n===0&&B1.sq===0,JSON.stringify(B1));
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const B2=await quizState(E);
ok('下載完自動出情境題（4 個選項），選單顯示題數',B2.sq===4&&/CE 情境題（\d+ 題）/.test(B2.lab)&&!/下載中/.test(B2.q),JSON.stringify(B2));
ok('下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate'});
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','pairs');await sleep(250);
const P1=await quizState(E);
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const P2=await quizState(E);
ok('下載中選「發音辨別」：先顯示下載中，下載完自動出題（2 個選項）',/發音辨別/.test(P1.q)&&/題目資料下載中/.test(P1.q)&&P1.n===0&&P2.pair===2,JSON.stringify({P1,P2}));
ok('發音辨別下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate',store:{sqWrong:{q03:1,q04:1},wrongWords:{},settings:{dailyGoal:20}}});
await pg.click('#navQuiz');await sleep(150);await pg.click('#openWB');await sleep(250);
const W1=await E(()=>({cards:[...document.querySelectorAll('#wrongBody .wb-cards b')].map(b=>b.textContent).join(','),rows:document.querySelectorAll('#wrongBody .wb-row').length,t:$('#wrongBody').textContent}));
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const W2=await E(()=>({rows:document.querySelectorAll('#wrongBody .wb-row').length,wait:/下載中/.test($('#wrongBody').textContent)}));
ok('錯題本：下載中先顯示情境題 2 題和「情境題資料下載中」，下載完自動列出 2 題',W1.cards==='0,0,2'&&W1.rows===0&&/情境題資料下載中/.test(W1.t)&&W2.rows===2&&!W2.wait,JSON.stringify({W1:{cards:W1.cards,rows:W1.rows},W2}));
ok('錯題本下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate',store:{sqWrong:{q05:1},settings:{dailyGoal:20}}});
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','wrongmix');await sleep(250);
const M1=await quizState(E);
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const M2=await E(()=>({sq:document.querySelectorAll('#quizOpts .sq-opt').length,tag:($('#quizQ .wb-tag')||{}).textContent||'',last:store.sqLast}));
ok('錯題本混合練習：情境題還沒下載完先顯示下載中，下載完自動出那一題（不會說錯題本是空的）',/題目資料下載中/.test(M1.q)&&!/空的/.test(M1.q)&&M2.sq===4&&/錯題本混合練習/.test(M2.tag)&&M2.last==='q05',JSON.stringify({M1:M1.q,M2}));
ok('混合練習下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate'});
await pg.click('#navPractice');await sleep(200);
const sid=await E(()=>{const s=ALLS.find(s=>/\bTaipei\b/.test(s.en));pool=[s];i=0;render();return s.en});
const n0=await E(()=>window.__said.length);
await tapWord(pg,'#english','Taipei');const L1=await pop(pg);
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(400);
const L2=await pop(pg);
ok('下載中點人名「Taipei」：先顯示「查詢資料下載中」而且不發音；下載完自動顯示「地名 台北」並念一次 Taipei',L1&&/查詢資料下載中/.test(L1.zh)&&L1.said.length===n0&&L2&&L2.tag==='地名'&&/台北/.test(L2.zh)&&L2.said.length===n0+1&&L2.said[n0]==='Taipei',JSON.stringify({sid,L1:L1&&{zh:L1.zh,n:L1.said.length},L2:L2&&{tag:L2.tag,zh:L2.zh,said:L2.said.slice(n0)}}));
await pg.keyboard.press('Escape');
const F=await E(()=>{const r=lkFind('flickering');return r&&r.extra?r.extra.tag+'|'+r.extra.w:JSON.stringify(r)});
ok('下載完：補充字典也查得到（flickering → 補充字 flicker）',F==='補充字|flicker',F);
ok('點字查詢下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E,release}=await open({more:'gate',store:{settings:{dailyGoal:20,flowCfg:{rev:0,new:0,sent:0}}}});
const btn=await E(()=>($('#todayBody .flow-start')||{}).textContent||'');
await pg.click('#todayBody [data-go="flow"]');await sleep(300);
const F1=await E(()=>({q:$('#quizQ').textContent,bar:($('#flowBar')||{}).textContent||'',type:$('#quizType').value,quiz:!$('#quiz').hidden}));
release();await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const n=await E(()=>document.querySelectorAll('#quizOpts .sq-opt').length);
await E(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent===q.opts[q.ans]).click()});await sleep(1300);
const F2=await E(()=>(($('#flowBar')||{}).textContent||''));
ok('今日學習（一鍵）的 CE 情境題步驟：下載中先顯示下載中，下載完自動出題，答完這一步顯示 1／1 ✅',/CE 情境題/.test(btn)&&F1.quiz&&F1.type==='situ'&&/題目資料下載中/.test(F1.q)&&/CE 情境題 0／1/.test(F1.bar)&&n===4&&/CE 情境題 1／1 ✅/.test(F2),JSON.stringify({btn:btn.slice(0,40),F1,n,F2}));
ok('今日學習下載中測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 下載失敗：顯示下載失敗、可以重新下載，其他功能照常 ----------
{const {ctx,pg,errs,E,setMode}=await open({more:'fail',store:{sqWrong:{q06:1},settings:{dailyGoal:20}}});
await pg.waitForFunction(()=>MORE_FAIL===true,null,{timeout:40000}).catch(()=>{});await sleep(200);
const D1=await E(()=>({fail:MORE_FAIL,lab:$('#quizType option[value="situ"]').textContent,note:($('#todayBody .more-fail')||{}).textContent||''}));
ok('下載失敗（重試 3 次後）：測驗選單顯示（下載失敗），今日頁提醒並有「🔄 重新下載」',D1.fail&&/CE 情境題（下載失敗）/.test(D1.lab)&&/還沒下載完成/.test(D1.note)&&/重新下載/.test(D1.note),JSON.stringify(D1));
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','situ');await sleep(1500);
const D2=await quizState(E);
await E(()=>{$('#quizType').value='word';$('#quizMode').value='en';$('#quizType').onchange()});await sleep(200);const D2w=await E(()=>document.querySelectorAll('#quizOpts button').length);
ok('下載失敗時開 CE 情境題：再試一次仍失敗就顯示「題目資料下載失敗」和「🔄 重新下載」；單字測驗照常可以用',/題目資料下載失敗/.test(D2.q)&&D2.retry&&D2.n===0&&D2w===4,JSON.stringify({D2,D2w}));
await pg.click('#openWB');await sleep(200);const D3=await E(()=>$('#wrongBody').textContent);
ok('下載失敗時的錯題本：情境題那一段顯示下載失敗和「重新下載」',/情境題資料下載失敗/.test(D3)&&/重新下載/.test(D3),D3.slice(0,160));
await pg.click('#navPractice');await sleep(200);await E(()=>{const s=ALLS.find(s=>/\bTaipei\b/.test(s.en));pool=[s];i=0;render()});
await tapWord(pg,'#english','Taipei');await sleep(1500);const D4=await pop(pg);
ok('下載失敗時點人名：顯示單字表找不到，並說明人名地名資料下載失敗、可以重新下載',D4&&/找不到/.test(D4.zh)&&/下載失敗/.test(D4.base)&&/重新下載/.test(D4.base),JSON.stringify(D4&&{zh:D4.zh,base:D4.base}));
await pg.keyboard.press('Escape');
setMode('');await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','situ');await sleep(300);
const st=await quizState(E);if(st.retry)await pg.click('#moreRetry');
await pg.waitForFunction(()=>MORE_READY,null,{timeout:20000}).catch(()=>{});await sleep(300);
const D5=await quizState(E);await pg.click('#navToday');await sleep(200);const D5t=await E(()=>!!$('#todayBody .more-fail'));
ok('連上網路後重新下載：情境題自動出題、選單顯示題數、今日頁的提醒消失',D5.sq===4&&/CE 情境題（\d+ 題）/.test(D5.lab)&&!D5t,JSON.stringify({D5,D5t}));
ok('下載失敗測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 離線與更新 ----------
const KS=async pg=>{for(let t=0;t<10;t++){try{return await pg.evaluate(()=>caches.keys())}catch(e){await sleep(300)}}return []};
const dataCache=pg=>pg.evaluate(async()=>{const k=(await caches.keys()).find(k=>k.startsWith('english-5000-data-'));if(!k)return null;const c=await caches.open(k);const out={k};for(const f of ['data.js','data-ex.js','data-ex2.js','data-more.js']){const r=await c.match(f);out[f]=r?(await r.text()).length:0}return out});
{ROOT=SITE;ONLINE=true;const {ctx,pg,errs,E}=await open({sw:true});
for(let k=0;k<60;k++){const d=await dataCache(pg).catch(()=>null);if(d&&d['data-more.js'])break;await sleep(300)}
const C1=await dataCache(pg);
ok('安裝後：離線快取裡有 data-more.js（和檔案一樣大）',C1&&C1['data-more.js']===fs.readFileSync(SITE+'/data-more.js','utf8').length,JSON.stringify(C1));
ONLINE=false;await pg.reload().catch(()=>{});await sleep(1500);await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','situ');await sleep(250);const O1=await quizState(E);
await pg.selectOption('#quizType','pairs');await sleep(250);const O2=await quizState(E);
const O3=await E(()=>{const r=lkFind('Taipei');return r&&r.extra?r.extra.tag+'|'+r.extra.zh:JSON.stringify(r)});
ok('離線開啟：情境題、發音辨別、點人名都從快取載入（不用網路）',O1.sq===4&&O2.pair===2&&/^地名\|台北/.test(O3),JSON.stringify({O1:O1.sq,O2:O2.pair,O3}));
ONLINE=true;ok('離線測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{/* 舊版：P30_OLD（例如 V5.33.1）；沒有設定時用目前的檔案還原出「情境題等還在 data.js」的舊格式 */
fs.rmSync(TMP,{recursive:true,force:true});const OLD=path.join(TMP,'old'),NEXT=path.join(TMP,'next');
if(process.env.P30_OLD)fs.cpSync(process.env.P30_OLD,OLD,{recursive:true});else{
 fs.cpSync(SITE,OLD,{recursive:true});const more=fs.readFileSync(SITE+'/data-more.js','utf8').split('\n'),get=p=>more.find(l=>l.startsWith(p)),out=[];
 for(const l of fs.readFileSync(SITE+'/data.js','utf8').split('\n')){if(l.startsWith('/* V5.34.0：')){out.push(get('window.SITQ='));continue}out.push(l);if(l.startsWith('window.RADIO='))out.push(get('window.PAIRS='),get('/* V5.32.0：點字查詢用。'),get('window.PROPER='),get('window.GLOSS='))}
 fs.writeFileSync(path.join(OLD,'data.js'),out.join('\n'));fs.rmSync(path.join(OLD,'data-more.js'));
 const s=fs.readFileSync(path.join(OLD,'sw.js'),'utf8');fs.writeFileSync(path.join(OLD,'sw.js'),s.replace(/const DATA_FILES=\{[^}]*\}/,"const DATA_FILES={"+['data.js','data-ex.js','data-ex2.js'].map(f=>`'${f}':'${sha12(path.join(OLD,f))}'`).join(',')+"}"))}
const oldW=load(path.join(OLD,'data.js'));
ROOT=OLD;const {ctx,pg,errs,E}=await open({sw:true});
for(let k=0;k<60;k++){const ks=await KS(pg);if(ks.some(x=>x.startsWith('english-5000-data-')))break;await sleep(300)}
await pg.reload();await sleep(1500);
await E(()=>{store.wordFav=['go','check'];store.sqWrong={q07:2};store.settings.dailyGoal=30;save()});await sleep(500);
const before=await E(()=>localStorage.getItem('english5000v5'));const k0=await KS(pg);
ROOT=SITE;LOG=[];await E(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
const want=dname=>k=>k.includes(dname);const NEWD='english-5000-data-'+['data.js','data-ex.js','data-ex2.js','data-more.js','data-toeic.js','data-v4.js'].map(f=>sha12(path.join(SITE,f)).slice(0,6)).join('');
for(let k=0;k<60;k++){await sleep(300);const ks=await KS(pg);if(ks.includes(NEWD)&&ks.length===2)break}
await sleep(1500);const k1=await KS(pg);const cnt=f=>LOG.filter(p=>p==='/'+f).length;
ok('從'+(process.env.P30_OLD?' '+path.basename(process.env.P30_OLD)+' ':'情境題還在 data.js 的舊版')+'更新：data.js、data-more.js 各下載一次，單字例句（data-ex.js、data-ex2.js）沿用不重新下載；舊的字庫快取清除','SITQ' in oldW&&cnt('data.js')===1&&cnt('data-more.js')===1&&cnt('data-ex.js')===0&&cnt('data-ex2.js')===0&&k1.includes(NEWD)&&k1.length===2&&!k1.some(k=>k.startsWith('english-5000-data-')&&k!==NEWD),JSON.stringify({dl:['data.js','data-ex.js','data-ex2.js','data-more.js'].map(cnt),k0,k1}));
await pg.reload().catch(()=>{});await sleep(1500);await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY,null,{timeout:20000}).catch(()=>{});
const after=await E(()=>localStorage.getItem('english5000v5'));const A=JSON.parse(after),B4=JSON.parse(before);
ok('更新後學習紀錄保留（收藏單字、答錯的情境題、每日目標）',JSON.stringify([A.wordFav,A.sqWrong,A.settings.dailyGoal])===JSON.stringify([B4.wordFav,B4.sqWrong,B4.settings.dailyGoal]),JSON.stringify([A.wordFav,A.sqWrong,A.settings.dailyGoal]));
ONLINE=false;await pg.reload().catch(()=>{});await sleep(1500);await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','situ');await sleep(250);const U1=await quizState(E);
await pg.click('#openWB');await sleep(200);const U2=await E(()=>document.querySelectorAll('#wrongBody .wb-row').length);
ok('更新後離線：情境題可以作答、錯題本列出答錯的情境題',U1.sq===4&&U2===1,JSON.stringify({U1:U1.sq,U2}));ONLINE=true;
/* 之後只改程式的版本（快取名稱不同、字庫不變）：字庫都不重新下載 */
fs.cpSync(SITE,NEXT,{recursive:true});fs.writeFileSync(path.join(NEXT,'sw.js'),fs.readFileSync(path.join(SITE,'sw.js'),'utf8').replace(/const C='[^']+'/,"const C='english-5000-v9-9-9'"));
ROOT=NEXT;LOG=[];await E(()=>navigator.serviceWorker.getRegistration().then(r=>r.update())).catch(()=>{});
for(let k=0;k<60;k++){await sleep(300);const ks=await KS(pg);if(ks.includes('english-5000-v9-9-9')&&ks.length===2)break}
await sleep(1200);const k2=await KS(pg);
ok('之後只改程式的版本：4 個字庫檔（含 data-more.js）都不重新下載，字庫快取沿用',['data.js','data-ex.js','data-ex2.js','data-more.js'].every(f=>cnt(f)===0)&&k2.includes('english-5000-v9-9-9')&&k2.includes(NEWD)&&k2.length===2,JSON.stringify({dl:['data.js','data-ex.js','data-ex2.js','data-more.js'].map(cnt),k2}));
ok('更新測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close();ROOT=SITE;fs.rmSync(TMP,{recursive:true,force:true})}

// ---------- F. 舊版學習紀錄轉移不需要 data-more.js ----------
{const {ctx,pg,errs,E}=await open({more:'gate',store:{wordFav:[1,2],wordKnown:[3],wordStatus:{'4':'known'},reviewDue:{'5':'2026-11-01'},fav:[],known:[],settings:{dailyGoal:20}}});
const S=await E(()=>({more:!!MORE_READY,v:store.wordKeyVersion,fav:store.wordFav,known:store.wordKnown,st:['and','of'].map(statusOf).join(),due:store.reviewDue,v4:V4_WORDS.slice(0,5),num:[...store.wordFav,...store.wordKnown,...Object.keys(store.wordStatus),...Object.keys(store.reviewDue)].some(k=>/^\d+$/.test(String(k)))}));
ok('很舊的學習紀錄（V5.0 用數字編號）：不用等 data-more.js，開啟時就轉移成單字（the、to 收藏，and、of 已熟，a 的複習日期）',!S.more&&S.v>=5&&S.v4.join()==='the,to,and,of,a'&&S.fav.join()==='the,to'&&S.known.join()==='and'&&S.st==='known,known'&&S.due.a==='2026-11-01'&&!S.num,JSON.stringify(S));
await E(()=>writeProgress({wordFav:[6],wordKnown:[7],wordStatus:{'8':'learning'},reviewDue:{'8':'2026-12-01'},fav:[],known:[],settings:{dailyGoal:20}},'測試匯入'));await sleep(2500);
await pg.waitForFunction(()=>typeof store!=='undefined',null,{timeout:20000}).catch(()=>{});
const I=await E(()=>({more:!!MORE_READY,v:store.wordKeyVersion,fav:store.wordFav,known:store.wordKnown,st:store.wordStatus,due:store.reviewDue,v4:V4_WORDS.slice(5,8)}));
ok('匯入很舊的備份（數字編號）：不用等 data-more.js，重新開啟後紀錄正確轉移（in 收藏、i 已熟、is 的紀錄併入原形 be）',!I.more&&I.v>=5&&I.v4.join()==='in,i,is'&&I.fav.join()==='in'&&I.known.join()==='i'&&I.st.be==='learning'&&!I.st.is&&I.due.be==='2026-12-01'&&!I.due.is,JSON.stringify(I));
ok('舊紀錄轉移測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 測驗出題：規則和結果與 V5.33.1 相同，而且比較快 ----------
{const {ctx,pg,errs,E}=await open();await pg.addScriptTag({content:ORIG});
const G=await E(()=>{const R=Math.random;let same=0,diff=[],tot=0;
 try{const sets={all:WORDS.filter(x=>x.zh&&inBook(x,'all')&&!(x.b&&x.k!==7)),ce:WORDS.filter(x=>x.k===7),base:WORDS.filter(y=>!y.b||y.k===7),dup:WORDS.filter(y=>!y.b||y.k===7).concat(WORDS.filter(y=>y.b==='know'))};
  const pick=seedRng(99);
  for(const [nm,pool] of Object.entries(sets))for(let t=0;t<150;t++){const x=pool[Math.floor(pick()*pool.length)];const sd=7000+tot;
   Math.random=seedRng(sd);const a=origPickOpts(x,pool).map(y=>y.w).join(',');Math.random=seedRng(sd);const b=pickOpts(x,pool).map(y=>y.w).join(',');tot++;if(a===b)same++;else if(diff.length<5)diff.push(nm+':'+x.w+' '+a+' | '+b)}
 }finally{Math.random=R}
 return {same,tot,diff}});
ok('看英文選中文的選項和 V5.33.1 完全相同：同樣的亂數出同樣的 3 個選項（全部範圍、CE、答錯本、含詞形的範圍各 150 題）',G.same===G.tot&&G.tot===600,JSON.stringify(G));
const V=await E(()=>{const pool=WORDS.filter(x=>!x.b&&x.k<=5);let bad=[];for(let t=0;t<400;t++){const x=pool[Math.floor(Math.random()*pool.length)];const o=pickOpts(x,pool);const xs=origZhSenses(x.zh);for(const y of o){if((x.p&&y.p===x.p)||y.zh===x.zh||origZhSenses(y.zh).some(s=>xs.includes(s))||y.b===x.w||x.b===y.w||y.w===x.w)bad.push(x.w+'/'+y.w)}if(new Set(o.map(y=>y.zh)).size<o.length||new Set(o.map(y=>dispW(y.w).toLowerCase())).size<o.length||o.length<3)bad.push('dup/short '+x.w)}return {n:bad.length,bad:bad.slice(0,5)}});
ok('選項仍然不會有同音字、答案的詞形、意思重疊或重複的中文和英文（抽 400 題）',V.n===0,JSON.stringify(V));
const Z=await E(()=>{const all=new Set();WORDS.forEach(x=>all.add(x.zh));PHRASES.forEach(x=>all.add(x.zh));let d=0,ex='';for(const z of [...all,'','（只有括號）','a(b)c；d;e',' ；; ',undefined,null,'(未關閉','（未關閉；x）y']){if(JSON.stringify(zhSenses(z))!==JSON.stringify(origZhSenses(z))){d++;ex=String(z)}}return {n:all.size,d,ex}});
ok('中文義項的拆法和原本相同（全部單字與片語的中文，'+Z.n+' 筆）',Z.d===0,JSON.stringify(Z));
const Lv=await E(()=>{let d=0;const ws=WORDS.map(x=>x.w);const r=seedRng(5);for(let t=0;t<20000;t++){const a=ws[Math.floor(r()*ws.length)],b=ws[Math.floor(r()*ws.length)];const o=origLev(a,b),n=lev(a,b),c=lev(a,b,3);if(o!==n||(o<=3?c!==o:c<=3))d++}return d});
ok('拼字相似度（lev）結果和原本相同；只算到 3 的時候分級也相同',Lv===0,String(Lv));
ok('測驗比對沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{/* 速度：模擬中階手機（CPU 降速 4 倍），新開 App 後第一次出 10 題（看英文選中文），新舊做法輪流量 */
const T={orig:[],now:[]};
for(let rep=0;rep<3;rep++)for(const kind of ['orig','now']){const {ctx,pg,E}=await open();await pg.addScriptTag({content:ORIG});await pg.waitForFunction(()=>EX2_READY&&MORE_READY,null,{timeout:30000}).catch(()=>{});await sleep(500);
 const c=await ctx.newCDPSession(pg);await c.send('Emulation.setCPUThrottlingRate',{rate:4});
 T[kind].push(await E(k=>{page('quiz');$('#quizType').value='word';$('#quizBook').value='all';$('#quizMode').value='en';const f=k==='orig'?origPickOpts:null,keep=window.pickOpts;if(f)window.pickOpts=f;const t=performance.now();try{for(let i=0;i<10;i++)wordQuiz()}finally{window.pickOpts=keep}return Math.round(performance.now()-t)},kind));
 await ctx.close()}
/* 共用的測試機器忙碌時時間會被拉長：各量 3 次取最快的一次比較 */
const mn=a=>Math.min(...a);
ok('出 10 題（看英文選中文，開 App 後第一次、CPU 降速 4 倍）：不比原本的做法慢（原本 '+mn(T.orig)+' ms → '+mn(T.now)+' ms；測試機器忙碌時時間會變動，各量 3 次取最快一次、容許 10% 誤差）',mn(T.now)<=mn(T.orig)*1.1,JSON.stringify(T))}

// ---------- H. 單字搜尋：結果和原本相同，而且比較快 ----------
{const {ctx,pg,errs,E}=await open({store:{settings:{dailyGoal:20}}});await pg.addScriptTag({content:ORIG});
const H1=await E(()=>{let n=0,d=0,ex='';const xs=WORDS.filter(x=>x.ex);const S=ALLS.map(s=>s.en);const r=seedRng(3);
 for(const x of xs){n++;if(hl0(x)!==origHl0(x)){d++;ex=x.w}}
 for(let t=0;t<4000;t++){const x=xs[Math.floor(r()*xs.length)],y={w:x.w,ex:S[Math.floor(r()*S.length)]};n++;if(hl0(y)!==origHl0(y)){d++;ex=x.w+' / '+y.ex}}
 return {n,d,ex}});
ok('例句裡的單字標示（黃色）和原本完全相同（全部 '+H1.n+' 句：每個字自己的例句＋和其他句子交叉比對）',H1.d===0&&H1.n>11000,JSON.stringify(H1));
await pg.click('#navWords');await sleep(300);
await E(()=>{const base=WORDS.filter(x=>!x.b&&!x.ce&&!x.job).map(x=>x.w);base.slice(0,800).forEach(w=>{store.wordStatus[w]='known'});base.slice(800,1200).forEach(w=>{store.wordStatus[w]='learning'});store.wordKnown=base.slice(0,800);store.wordFav=base.filter((w,i)=>i%13===0);store.reviewDue={};base.slice(0,1500).forEach((w,i)=>{store.reviewDue[w]=day((i%20)-8)});store.wrongWords={};base.slice(0,60).forEach(w=>{store.wrongWords[w]=2});save()});
const H2=await E(()=>{const Q=['','s','st','sta','stat','status','STATUS','檢','檢查','a','ing','ups','UPS','colour','zzz','  check  ','-','é','résumé'],BK=['all','1','3','7','8','toeic'],ST=['all','known','new','review','fav','wrong','learning','zh'],TP=['all',...Object.keys(TOPICS).slice(0,3)];let n=0,d=0,ex='';
 const set=(id,v)=>{$(id).value=v};
 for(const sv of [true,false]){store.settings.skipVar=sv;for(const q of Q)for(const bk of BK)for(const st of (q?['all','known','fav']:ST))for(const tp of (q?['all']:TP)){set('#wordSearch',q);set('#wordBook',bk);set('#wordState',st);set('#wordTopic',tp);n++;const a=wordFiltered().map(x=>x.w).join(','),b=origWordFiltered().map(x=>x.w).join(',');if(a!==b){d++;ex=[sv,q,bk,st,tp].join('|')}}}
 store.settings.skipVar=true;set('#wordSearch','');set('#wordBook','all');set('#wordState','all');set('#wordTopic','all');return {n,d,ex}});
ok('搜尋與篩選的結果和順序都和原本相同（'+H2.n+' 種搜尋字、冊別、狀態、主題、只學原形的組合）',H2.d===0&&H2.n>500,JSON.stringify(H2));
/* 實際在搜尋框連續打字、刪字、換冊別、標記已熟 */
const step=async(fn,ms=450)=>{await fn();await sleep(ms);return E(()=>({list:[...document.querySelectorAll('#wordRows .word-card')].map(c=>c.dataset.w).join(','),want:origWordFiltered().slice(0,wordShown).map(x=>x.w).join(','),cnt:$('#wordCount').textContent,wantCnt:String(origWordFiltered().length),nums:[$('#wordKnownN').textContent,$('#wordFavN').textContent,$('#wordDueN').textContent].join(','),wantNums:origWordNums()}))};
const same=r=>r.list===r.want&&r.cnt===r.wantCnt&&r.nums===r.wantNums;
const H3=[];
await pg.click('#wordSearch');for(const ch of 'stat'){H3.push(await step(()=>pg.keyboard.type(ch),60))}await sleep(400);H3.push(await step(async()=>{}));
H3.push(await step(()=>pg.keyboard.press('Backspace')));H3.push(await step(()=>pg.keyboard.press('Backspace')));H3.push(await step(()=>pg.keyboard.type('op')));
H3.push(await step(()=>pg.click('#bookChips [data-b="2"]')));H3.push(await step(()=>pg.fill('#wordSearch','')));H3.push(await step(()=>pg.click('#bookChips [data-b="3"]')));
H3.push(await step(()=>pg.click('#wordRows .word-card [data-act="known"]')));H3.push(await step(()=>pg.click('#wordRows .word-card [data-act="fav"]')));
H3.push(await step(()=>pg.fill('#wordSearch','檢')));H3.push(await step(()=>pg.fill('#wordSearch','檢查')));H3.push(await step(()=>pg.fill('#wordSearch','check')));
const last=H3.slice(4);
ok('實際操作：連續打字（stat）、刪字、再打字、換冊別、清空、標記已熟和收藏、中文搜尋：清單、字數、已熟／收藏／待複習數字都和原本相同',last.every(same)&&last.filter(r=>r.list).length>=8,JSON.stringify(last.map((r,i)=>same(r)?'ok':i+':'+r.cnt+'/'+r.wantCnt+' '+r.nums+'/'+r.wantNums+' '+r.list.slice(0,40)+' | '+r.want.slice(0,40))));
await pg.fill('#wordSearch','');await sleep(300);
ok('單字搜尋比對沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{/* 速度：CPU 降速 4 倍，每打一個字（"st"）重畫清單；比較原本的例句標示做法（每個字建 RegExp） */
const T={orig:[],now:[]};
for(let rep=0;rep<3;rep++)for(const kind of ['orig','now']){const {ctx,pg,E}=await open();await pg.waitForFunction(()=>EX2_READY&&MORE_READY,null,{timeout:30000}).catch(()=>{});await pg.click('#navWords');await sleep(500);
 const c=await ctx.newCDPSession(pg);await c.send('Emulation.setCPUThrottlingRate',{rate:4});
 T[kind].push(await E(k=>{if(k==='orig')window.hlFast=()=>null;const s=$('#wordSearch');let tot=0;for(const q of ['st','sta','e','ex']){s.value=q;const t=performance.now();wordShown=60;renderWords();tot+=performance.now()-t}return Math.round(tot/4)},kind));
 await ctx.close()}
const mn=a=>Math.min(...a);
ok('單字搜尋每打一個字（CPU 降速 4 倍，平均）：比原本的做法快 2 倍以上（原本 '+mn(T.orig)+' ms → '+mn(T.now)+' ms；時間會受測試機器影響，只比較快慢比例）',mn(T.now)*2<=mn(T.orig),JSON.stringify(T))}

fs.writeFileSync('results_p30.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
