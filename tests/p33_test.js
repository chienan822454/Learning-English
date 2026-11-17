// V6.0：儲存格式——每日自動備份的歷史存在瀏覽器資料庫（IndexedDB：english5000／snaps，鍵＝日期，保留 14 份），
//       localStorage 只留最新一份（學習紀錄損毀時開啟就能立刻改用）；備份檔加上 "fmt":6。
// 用法：node p33_test.js（和其他測試一樣在 tests 資料夾執行，網站在 site/）。
// 「從已安裝的舊版更新」：P33_OLD=舊版網站資料夾（例如 V5.34.0）；沒有設定時用 tests/v534（有的話），否則用 tests/prev（V5.16.20）。
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),os=require('os');
const PORT=8904,U='http://localhost:8904/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
let ROOT='site';
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(s)}).listen(PORT);
const TMP=path.join(os.tmpdir(),'e5k_p33_'+process.pid);fs.rmSync(TMP,{recursive:true,force:true});fs.mkdirSync(TMP,{recursive:true});
const OLD=process.env.P33_OLD||(fs.existsSync('v534')?'v534':'prev');
const ALL=[];   // 全部的錯誤（JavaScript 錯誤、主控台錯誤、錯誤提示條）
/* 每一頁都先放：朗讀替身、直接讀資料庫的工具（測試自己開資料庫，不用 App 的函式；先存原本的 open，模擬故障時也讀得到） */
const stub=()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);speechSynthesis.cancel=()=>{};
 const I=window.indexedDB,O=I&&IDBFactory.prototype.open;
 window.__idbAll=async()=>{if(!I)return null;try{const ds=I.databases?await I.databases():null;if(ds&&!ds.some(d=>d.name==='english5000'))return {}}catch(e){}
  return await new Promise(res=>{const rq=O.call(I,'english5000');rq.onsuccess=()=>{const db=rq.result;if(!db.objectStoreNames.contains('snaps')){db.close();return res({})}const out={},tx=db.transaction('snaps','readonly');tx.objectStore('snaps').openCursor().onsuccess=e=>{const c=e.target.result;if(c){out[c.key]=c.value;c.continue()}};tx.oncomplete=()=>{db.close();res(out)};tx.onabort=()=>{db.close();res(null)}};rq.onerror=()=>res(null)})}};
/* 模擬故障 */
const noIDB=()=>{try{delete window.indexedDB}catch(e){}try{if(window.indexedDB)Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true})}catch(e){}};
const failOpen=()=>{IDBFactory.prototype.open=function(){const rq={};setTimeout(()=>{try{Object.defineProperty(rq,'error',{value:new DOMException('測試：開不起來','UnknownError')})}catch(e){}if(rq.onerror)rq.onerror({target:rq,preventDefault(){}})},5);return rq}};
const hangOpen=()=>{IDBFactory.prototype.open=function(){return {}}};
const failPut=()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('測試：空間不足','QuotaExceededError')}};
const badPut=()=>{const p=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(v&&typeof v.raw==='string')v=Object.assign({},v,{raw:v.raw+' '});return p.call(this,v,k)}};
const IGN=/\/(icon-\d+\.png|favicon\.ico)$/;   // 測試網站沒有 PNG 圖示（正式網站有）
function hook(pg,errs){pg.on('pageerror',e=>errs.push('JS：'+e.message));pg.on('console',m=>{if(m.type()!=='error')return;const u=(m.location()||{}).url||'';if(/Failed to load resource/.test(m.text())&&IGN.test(u))return;errs.push('主控台：'+m.text()+' '+u)});pg.__dlg=[];pg.on('dialog',d=>{pg.__dlg.push(d.message());d.accept().catch(()=>{})})}
let b;
async function open(o={}){const ctx=await b.newContext(Object.assign({viewport:{width:390,height:844},serviceWorkers:o.sw?'allow':'block',acceptDownloads:true,permissions:['clipboard-read','clipboard-write']},o.ctx||{}));await ctx.addInitScript(stub);if(o.init)await ctx.addInitScript(o.init);if(o.time)await ctx.clock.setFixedTime(o.time);const errs=[];const pg=await newPage(ctx,errs,o.pinit);return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
async function newPage(ctx,errs,pinit){const pg=await ctx.newPage();hook(pg,errs);if(pinit)await pg.addInitScript(pinit);return pg}
async function done(ctx,errs,pages){for(const pg of pages){try{if(!pg.isClosed()&&await pg.evaluate(()=>!!document.getElementById('errBar')))errs.push('錯誤提示條：'+await pg.evaluate(()=>document.getElementById('errBar').textContent))}catch(e){}}ALL.push(...errs);await ctx.close()}
/* 在 icon.svg（同一個網址，App 沒有執行）寫入 V5.34.0 的儲存狀態：學習紀錄＋n 份每日自動備份（每天一個鍵＋索引），今天還沒開過 */
function seedV5(o){const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const day=k=>{const d=new Date();d.setDate(d.getDate()+k);return ymd(d)};
 if(o.clear)localStorage.clear();
 const rec={wordKnown:['go','cat'],wordFav:['color'],wordStatus:{go:'known',cat:'known',dog:'learning'},reviewDue:{dog:day(3)},fav:['c1'],known:['c2'],phKnown:[1],phFav:[],studyDays:[day(-2),day(-1)],settings:{dailyGoal:20},wordKeyVersion:5,srsV:514};
 localStorage.setItem('english5000v5',JSON.stringify(rec));const idx=[],raws={};
 for(let k=1;k<=o.n;k++){const d=day(-k),raw=JSON.stringify(Object.assign({},rec,{wordKnown:['old'+k]}));raws[d]=raw;localStorage.setItem('english5000v5_snap_'+d,raw);idx.push({date:d,savedAt:d+'T08:00:00.000Z',version:'5.34.0',summary:{wordKnown:1,learning:1,review:1,wordFav:1,wrong:0,sentKnown:1,sentFav:1,phKnown:1,phFav:0,dlg:0,rp:0,days:2}})}
 localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(idx));localStorage.setItem('english5000v5_snaps_date',day(-1));localStorage.removeItem('english5000v5_snaps_db');
 return {raws,idx,today:day(0),dates:idx.map(x=>x.date),main:JSON.stringify(rec)}}
/* 目前 localStorage 的自動備份狀態 */
const LS=()=>{const keys=Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).map(k=>k.slice(19)).sort().reverse(),raws={};keys.forEach(d=>raws[d]=localStorage.getItem('english5000v5_snap_'+d));return {keys,raws,idx:JSON.parse(localStorage.getItem('english5000v5_snaps_idx')||'[]'),flag:JSON.parse(localStorage.getItem('english5000v5_snaps_db')||'null')}};
const sameMeta=(r,m)=>!!r&&r.date===m.date&&r.savedAt===m.savedAt&&r.version===m.version&&JSON.stringify(r.summary)===JSON.stringify(m.summary);
const kb=n=>n<1e6?(n?Math.max(1,Math.round(n/1e3)):0)+' KB':(n/1e6).toFixed(1)+' MB';

(async()=>{b=await launch();

// ---------- A. 從 V5 第一次開啟 V6：舊的自動備份搬到瀏覽器資料庫 ----------
{const {ctx,pg,errs,E}=await open();
await pg.goto(U+'icon.svg');const S=await pg.evaluate(seedV5,{n:3,clear:true});
await pg.goto(U);await sleep(900);
const A=await E(async LSf=>{const st=await snapDbIdle();const ls=eval(LSf)();return {st,ls,db:await __idbAll(),main:localStorage.getItem('english5000v5'),today:todayStr()}},LS.toString());
const olds=S.dates;
ok('從 V5 第一次開啟 V6：localStorage 的 3 份舊自動備份搬到瀏覽器資料庫（english5000／snaps，鍵＝日期），內容逐字相同，日期、時間、版本、摘要都保留',A.st==='ok'&&A.db&&olds.every(d=>A.db[d]&&A.db[d].raw===S.raws[d])&&S.idx.every(m=>sameMeta(A.db[m.date],m)),JSON.stringify({st:A.st,db:A.db&&Object.keys(A.db)}));
ok('localStorage 只留最新一份（今天開啟時存的），索引記下已存進資料庫（db:1）；今天這份也在資料庫裡',A.ls.keys.join()===S.today&&A.ls.idx.length===1&&A.ls.idx[0].date===S.today&&A.ls.idx[0].db===1&&A.db[S.today]&&A.db[S.today].raw===S.main&&A.ls.raws[S.today]===S.main&&Object.keys(A.db).length===4,JSON.stringify({keys:A.ls.keys,idx:A.ls.idx.map(x=>x.date+(x.db?'(db)':'')),db:Object.keys(A.db||{})}));
const M=JSON.parse(A.main);
ok('轉移完成有記錄（english5000v5_snaps_db：v6、ok、完成時間、搬了 3 份）；學習紀錄仍在 english5000v5，內容不變、沒有多出欄位',A.ls.flag&&A.ls.flag.v===6&&A.ls.flag.ok===1&&!isNaN(Date.parse(A.ls.flag.at))&&A.ls.flag.n===3&&M.wordKnown.join()==='go,cat'&&M.wordFav.join()==='color'&&M.wordStatus.dog==='learning'&&!Object.keys(M).some(k=>/fmt|snap|idb/i.test(k)),JSON.stringify(A.ls.flag)+' '+Object.keys(M).join(','));
await pg.reload();await sleep(900);
const A4=await E(async LSf=>{const st=await snapDbIdle();return {st,ls:eval(LSf)(),db:await __idbAll()}},LS.toString());
ok('再開一次（重複執行）：結果完全相同，轉移記錄不變',A4.st==='ok'&&JSON.stringify(A4.db)===JSON.stringify(A.db)&&JSON.stringify(A4.ls)===JSON.stringify(A.ls),JSON.stringify({keys:A4.ls.keys,flag:A4.ls.flag}));
// 中途中斷：已經寫進資料庫、localStorage 還沒刪（索引沒有 db:1）；另外有一個索引裡沒有的備份鍵
const D5=await E(o=>{const d=k=>{const x=new Date();x.setDate(x.getDate()+k);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};const idx=JSON.parse(localStorage.getItem('english5000v5_snaps_idx'));
 o.forEach(m=>{localStorage.setItem('english5000v5_snap_'+m.date,m.raw);idx.push({date:m.date,savedAt:m.savedAt,version:m.version,summary:m.summary})});localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(idx));
 const raw=JSON.stringify({wordKnown:['orphan'],fav:[],known:[],wordFav:[],wordStatus:{},reviewDue:{},settings:{dailyGoal:20}});localStorage.setItem('english5000v5_snap_'+d(-5),raw);return {date:d(-5),raw}},olds.slice(0,2).map(d=>Object.assign({raw:S.raws[d]},S.idx.find(m=>m.date===d))));
await pg.reload();await sleep(900);
const A5=await E(async LSf=>{const st=await snapDbIdle();return {st,ls:eval(LSf)(),db:await __idbAll()}},LS.toString());
ok('中途中斷（已寫入資料庫、還沒刪 localStorage；另有索引外的備份鍵）：下次開啟接著搬完，localStorage 只剩今天一份，資料庫內容相同',A5.st==='ok'&&A5.ls.keys.join()===S.today&&olds.every(d=>A5.db[d]&&A5.db[d].raw===S.raws[d])&&A5.db[D5.date]&&A5.db[D5.date].raw===D5.raw&&A5.db[D5.date].summary.wordKnown===1&&A5.ls.flag.at===A.ls.flag.at&&A5.ls.flag.n===3,JSON.stringify({keys:A5.ls.keys,db:Object.keys(A5.db||{}),flag:A5.ls.flag}));

// ---------- B. 從資料庫裡的自動備份還原、復原 ----------
await pg.click('#navStats');await sleep(200);
const B0=await E(()=>{renderBackup();return {t:document.querySelector('#bkSnaps').textContent,rows:document.querySelectorAll('#bkSnaps [data-snap]').length}});
await pg.waitForFunction(()=>document.querySelectorAll('#bkSnaps [data-snap]').length>0,null,{timeout:5000}).catch(()=>{});
const B1=await E(()=>({rows:[...document.querySelectorAll('#bkSnaps .bk-row b')].map(x=>x.textContent),h:[...document.querySelectorAll('#backupBody h3')].map(h=>h.textContent).join('|')}));
const want=[S.today,...olds.slice(0,3),D5.date];
ok('統計頁的自動備份清單：先顯示「讀取中」，再列出全部（localStorage 最新一份＋資料庫的歷史，新的在前）；標題寫「保留 14 天」',/讀取中/.test(B0.t)&&B0.rows===0&&JSON.stringify(B1.rows)===JSON.stringify(want)&&/保留 14 天/.test(B1.h),JSON.stringify([B0,B1]));
const k2=B1.rows.indexOf(olds[1]);pg.__dlg.length=0;
await pg.click(`#bkSnaps [data-snap="${k2}"]`);await pg.waitForLoadState('load');await sleep(1500);
const B2=await E(()=>({wk:JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join(),msg:document.querySelector('#backupMsg').textContent,undo:!!document.querySelector('#bkUndo'),stats:!document.querySelector('#statsPage').hidden}));
ok('還原資料庫裡的自動備份：先確認、還原成那一天的紀錄、回到統計頁並顯示「已還原」',pg.__dlg.length===1&&pg.__dlg[0].includes(olds[1])&&B2.wk==='old2'&&B2.msg.includes('已還原到「'+olds[1]+' 自動備份」')&&B2.stats,JSON.stringify([pg.__dlg,B2]));
await pg.click('#bkUndo');await pg.waitForLoadState('load');await sleep(1500);
const B3=await E(()=>JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join());
ok('還原後可以「↩️ 復原到還原前」（復原點照常）',B2.undo&&B3==='go,cat',B3);
await done(ctx,errs,[pg])}

// ---------- C. 每天開啟（模擬 16 天）：localStorage 只留最新一份，資料庫保留 14 份 ----------
const T0=new Date(2027,2,1,9,0,0).getTime(),DAY=864e5;
const C={};
{const {ctx,pg,errs,E}=await open({time:T0});
await pg.goto(U);await sleep(700);await E(()=>{store.wordFav=['day0'];saveNow()});
const lsN=[];
for(let k=1;k<=16;k++){await ctx.clock.setFixedTime(T0+k*DAY);await pg.reload();await sleep(250);
 lsN.push(await E(async K=>{const n=Object.keys(localStorage).filter(x=>x.startsWith('english5000v5_snap_')).length;await snapDbIdle();store.wordFav=['day'+K];saveNow();return n},k))}
const C1=await E(async LSf=>({ls:eval(LSf)(),db:await __idbAll(),today:todayStr(),all:(await snapMetaAll()).list.map(x=>x.date)}),LS.toString());
const dk=Object.keys(C1.db||{}).sort();
ok('每天開啟（模擬 16 天）：每次開啟後 localStorage 都只有最新一份；資料庫保留最近 14 份（最舊的自動刪掉）',lsN.every(n=>n===1)&&C1.ls.keys.join()===C1.today&&dk.length===14&&dk[13]===C1.today&&C1.db[C1.today].raw===C1.ls.raws[C1.today],JSON.stringify({lsN,keys:C1.ls.keys,db:dk}));
await pg.click('#navStats');await pg.waitForFunction(()=>document.querySelectorAll('#bkSnaps [data-snap]').length>0,null,{timeout:5000}).catch(()=>{});
const C2=await E(()=>[...document.querySelectorAll('#bkSnaps .bk-row b')].map(x=>x.textContent));
await pg.click(`#bkSnaps [data-snap="${C2.length-1}"]`);await pg.waitForLoadState('load');await sleep(1500);
const C3=await E(()=>JSON.parse(localStorage.getItem('english5000v5')).wordFav.join());
ok('清單列出 14 份（新的在前）；還原資料庫裡最舊的一份（第 3 天開啟時存的）內容正確',C2.length===14&&JSON.stringify(C2)===JSON.stringify(C1.all)&&C2[13]===dk[0]&&C3==='day2',JSON.stringify({n:C2.length,first:C2[0],last:C2[13],C3}));
await pg.click('#bkUndo');await pg.waitForLoadState('load');await sleep(1200);

// ---------- G. 💽 儲存空間 ----------
await pg.click('#navStats');await pg.waitForFunction(()=>{const e=document.getElementById('stDb');return e&&!/讀取中/.test(e.textContent)},null,{timeout:5000}).catch(()=>{});
const G=await E(async()=>{let tot=0,prog=0,snap=0;for(let k=0;k<localStorage.length;k++){const key=localStorage.key(k),n=key.length+localStorage.getItem(key).length;tot+=n;if(key==='english5000v5')prog+=n;if(key.startsWith('english5000v5_snap'))snap+=n}
 const box=document.querySelector('#statsBody .st-box'),seg=[...box.querySelectorAll('.st-bar span')].map(s=>parseFloat(s.style.width)),db=await __idbAll();
 return {pct:Math.round(tot/5e6*100),top:box.querySelector('.st-top').textContent,leg:box.querySelector('.st-leg').textContent,w0:seg[0],w1:seg[1],want0:prog/5e6*100,want1:snap/5e6*100,dbt:$('#stDb').textContent,n:Object.keys(db).length,size:Object.values(db).reduce((s,r)=>s+r.raw.length,0),warn:!!box.querySelector('.st-warn')}});
ok('💽 儲存空間：localStorage 用量照舊（學習紀錄＋最新一份自動備份＋其他，長條比例正確），另外一行「瀏覽器資料庫：N 份自動備份（約 X KB）」份數和大小正確',/上限約 5 MB（已用 \d+%）/.test(G.top)&&G.top.includes('已用 '+G.pct+'%')&&/學習紀錄 \d/.test(G.leg)&&/每日自動備份 \d/.test(G.leg)&&Math.abs(G.w0-G.want0)<0.05&&Math.abs(G.w1-G.want1)<0.05&&G.w1>0&&G.dbt===`瀏覽器資料庫：${G.n} 份自動備份（約 ${kb(G.size)}）`&&G.n===14&&!G.warn,JSON.stringify(G));
const filled=await E(()=>{try{localStorage.setItem('zz_other_page','x'.repeat(4.2e6));return true}catch(e){return String(e)}});
await E(()=>renderStats());await sleep(300);
const G2=await E(()=>{const w=document.querySelector('#statsBody .st-warn');return w?w.textContent:''});await E(()=>localStorage.removeItem('zz_other_page'));
ok('localStorage 用量超過 80%：照樣顯示「快滿了」警告（說明空間不夠時會先把自動備份移到瀏覽器資料庫）',filled===true&&/已用 8\d%，快滿了/.test(G2)&&/匯出備份檔/.test(G2)&&/把每日自動備份移到瀏覽器資料庫/.test(G2),G2);

// ---------- I. 學習紀錄損毀：開啟時立刻改用 localStorage 最新的自動備份（不等資料庫） ----------
const snapDay=C1.today,snapRaw=C1.ls.raws[C1.today];
await E(()=>localStorage.setItem('english5000v5','{"wordKnown":["x"'));await pg.close();
const p2=await newPage(ctx,errs,hangOpen);await p2.goto(U);await sleep(700);
const I=await p2.evaluate(()=>({note:window.__storeNote||'',fav:store.wordFav.join(),st:SNAPDB.st,db:!!SNAPDB.db,main:(()=>{try{return JSON.parse(localStorage.getItem('english5000v5')).wordFav.join()}catch(e){return 'bad'}})(),corrupt:Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_corrupt_')).length,msg:(document.querySelector('#backupMsg')||{}).textContent||''}));
ok('學習紀錄損毀：開啟時立刻（同步，資料庫沒有回應也一樣）改用 localStorage 最新的自動備份並寫回，另存損毀檔、顯示提示',I.note.includes('損毀')&&I.note.includes(snapDay)&&I.fav===JSON.parse(snapRaw).wordFav.join()&&I.main===I.fav&&I.corrupt===1&&/損毀/.test(I.msg)&&I.st===''&&!I.db,JSON.stringify(I));
await done(ctx,errs,[p2])}

// ---------- D. 瀏覽器資料庫不能用：照 V5 的做法（localStorage 保留 3 天） ----------
{const {ctx,pg,errs,E}=await open({init:noIDB});
await pg.goto(U+'icon.svg');const S=await pg.evaluate(seedV5,{n:3,clear:true});
await pg.goto(U);await sleep(900);
const D1=await E(async LSf=>({ls:eval(LSf)(),st:await snapDbIdle(),has:!!window.indexedDB,db:await __idbAll()}),LS.toString());
await pg.click('#navStats');await pg.waitForFunction(()=>document.querySelectorAll('#bkSnaps [data-snap]').length>0,null,{timeout:5000}).catch(()=>{});await sleep(300);
const D1b=await E(()=>({rows:[...document.querySelectorAll('#bkSnaps .bk-row b')].map(x=>x.textContent),h:[...document.querySelectorAll('#backupBody h3')].map(h=>h.textContent).join('|'),dbt:$('#stDb').textContent}));
ok('沒有 IndexedDB（例如舊瀏覽器；用 init script 刪掉 window.indexedDB）：和 V5 一樣 localStorage 保留 3 天（今天＋前 2 天，最舊的刪掉），清單 3 份、標題「保留 3 天」',!D1.has&&D1.ls.keys.join()===[S.today,S.dates[0],S.dates[1]].join()&&D1.ls.raws[S.dates[0]]===S.raws[S.dates[0]]&&D1.ls.raws[S.dates[1]]===S.raws[S.dates[1]]&&D1.ls.flag===null&&!D1.ls.idx.some(x=>x.db)&&Object.keys(D1.db||{}).length===0&&JSON.stringify(D1b.rows)===JSON.stringify(D1.ls.keys)&&/保留 3 天/.test(D1b.h),JSON.stringify({keys:D1.ls.keys,flag:D1.ls.flag,rows:D1b.rows,h:D1b.h}));
await pg.click(`#bkSnaps [data-snap="1"]`);await pg.waitForLoadState('load');await sleep(1500);
const D2a=await E(()=>JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join());
await E(()=>localStorage.setItem('english5000v5','{"wordKnown":["x"'));await pg.reload();await sleep(1200);
const D2b=await E(()=>({note:window.__storeNote||'',wk:JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join()}));
ok('沒有 IndexedDB：💽 顯示「瀏覽器資料庫：無法使用」；還原 localStorage 的自動備份照常；學習紀錄損毀時照樣改用最新的自動備份',/^瀏覽器資料庫：無法使用/.test(D1b.dbt)&&D2a==='old1'&&D2b.note.includes('損毀')&&D2b.note.includes(S.today)&&D2b.wk==='go,cat',JSON.stringify([D1b.dbt,D2a,D2b]));
// localStorage 滿了（沒有資料庫）：照 V5 的順序清理
pg.__dlg.length=0;const D3=await E(()=>{Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).forEach(k=>localStorage.removeItem(k));localStorage.setItem('english5000v5_corrupt_1','{"x":');
 const days=['2026-01-03','2026-01-02','2026-01-01'];const put=n=>{try{days.forEach(d=>localStorage.removeItem('english5000v5_snap_'+d));days.forEach(d=>localStorage.setItem('english5000v5_snap_'+d,JSON.stringify({wordKnown:['s'+d],pad:'x'.repeat(n)})));localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(days.map(d=>({date:d,summary:{}}))));return true}catch(e){return false}};
 let lo=100000,hi=1800000;while(hi-lo>40){const m=Math.floor((lo+hi)/2);if(put(m))lo=m;else hi=m}put(lo);
 WORDS.filter(x=>!x.b&&x.k===2).slice(0,300).forEach(x=>store.wordFav.push(x.w));saveNow();
 return {saved:JSON.parse(localStorage.getItem('english5000v5')).wordFav.length===store.wordFav.length,corrupt:localStorage.getItem('english5000v5_corrupt_1')!==null,snaps:snapMeta().length}});
ok('沒有 IndexedDB 且 localStorage 滿了：照 V5 的順序清理（先刪損毀檔備份…），學習紀錄照樣存好、不跳出「空間不足」',D3.saved&&!D3.corrupt&&pg.__dlg.length===0,JSON.stringify(D3)+JSON.stringify(pg.__dlg));
await done(ctx,errs,[pg])}
// 資料庫開不起來 → 下次開啟（正常）再試
{const {ctx,pg,errs,E}=await open({pinit:failOpen});
await pg.goto(U+'icon.svg');const S=await pg.evaluate(seedV5,{n:3,clear:true});
await pg.goto(U);await sleep(900);
const F1=await E(async LSf=>({st:await snapDbIdle(),ls:eval(LSf)()}),LS.toString());
await pg.close();const p2=await newPage(ctx,errs);await p2.goto(U);await sleep(900);
const F2=await p2.evaluate(async LSf=>({st:await snapDbIdle(),ls:eval(LSf)(),db:await __idbAll()}),LS.toString());
const kept=[S.today,S.dates[0],S.dates[1]];
ok('資料庫開不起來（open 失敗）：和 V5 一樣 localStorage 保留 3 天，記下 ok:0',F1.st==='off'&&F1.ls.keys.join()===kept.join()&&F1.ls.flag&&F1.ls.flag.ok===0&&!F1.ls.idx.some(x=>x.db),JSON.stringify({st:F1.st,keys:F1.ls.keys,flag:F1.ls.flag}));
ok('下次開啟（資料庫正常）再試：localStorage 的 3 份全部搬進資料庫、內容相同，一份都沒少；記下 ok:1',F2.st==='ok'&&F2.ls.keys.join()===S.today&&kept.every(d=>F2.db[d]&&F2.db[d].raw===F1.ls.raws[d])&&F2.ls.flag.ok===1&&F2.ls.flag.n===2&&!isNaN(Date.parse(F2.ls.flag.at)),JSON.stringify({keys:F2.ls.keys,db:Object.keys(F2.db||{}),flag:F2.ls.flag}));
await done(ctx,errs,[p2])}
// 寫入失敗（空間不足）／讀回內容不同 → 一份都不刪
for(const [name,fn] of [['寫入資料庫失敗（QuotaExceededError）',failPut],['寫入後讀回內容不同',badPut]]){const {ctx,pg,errs,E}=await open({pinit:fn});
await pg.goto(U+'icon.svg');const S=await pg.evaluate(seedV5,{n:2,clear:true});
await pg.goto(U);await sleep(900);
const F=await E(async LSf=>({st:await snapDbIdle(),ls:eval(LSf)(),db:await __idbAll()}),LS.toString());
ok(name+'：localStorage 的自動備份一份都不刪（今天＋前 2 天都在、內容不變），資料庫裡沒有留下不對的資料，記下 ok:0',F.st==='off'&&F.ls.keys.join()===[S.today,...S.dates].join()&&S.dates.every(d=>F.ls.raws[d]===S.raws[d])&&Object.keys(F.db||{}).length===0&&F.ls.flag&&F.ls.flag.ok===0,JSON.stringify({st:F.st,keys:F.ls.keys,db:Object.keys(F.db||{}),flag:F.ls.flag}));
await done(ctx,errs,[pg])}
// 資料庫一直沒有回應（Safari 14 的問題）
{const {ctx,pg,errs,E}=await open({pinit:hangOpen});
await pg.goto(U+'icon.svg');const S=await pg.evaluate(seedV5,{n:3,clear:true});
await pg.goto(U);await sleep(1200);
const H0=await E(()=>({st:SNAPDB.st,today:!$('#todayPage').hidden,n:Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).length}));
await sleep(8000);
const H1=await E(async LSf=>({st:await snapDbIdle(),ls:eval(LSf)()}),LS.toString());
await pg.click('#navStats');await sleep(500);
const H2=await E(()=>({rows:document.querySelectorAll('#bkSnaps [data-snap]').length,dbt:$('#stDb').textContent}));
ok('資料庫一直沒有回應（Safari 14 的問題）：畫面照常；8 秒後改用 V5 的做法（localStorage 保留 3 天），統計頁照常列出',H0.st===''&&H0.today&&H0.n===4&&H1.st==='off'&&H1.ls.keys.join()===[S.today,S.dates[0],S.dates[1]].join()&&H2.rows===3&&/無法使用/.test(H2.dbt),JSON.stringify({H0,st:H1.st,keys:H1.ls.keys,H2}));
await done(ctx,errs,[pg])}

// ---------- E. localStorage 滿了：先把自動備份移到資料庫（不刪任何東西） ----------
{const {ctx,pg,errs,E}=await open();
await pg.goto(U);await sleep(900);await E(()=>snapDbIdle());
const E1=await E(async()=>{Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).forEach(k=>localStorage.removeItem(k));
 localStorage.setItem('english5000v5_corrupt_1','{"x":');localStorage.setItem('english5000v5_before_restore',JSON.stringify({savedAt:new Date().toISOString(),version:'5.34.0',summary:{},progress:{wordKnown:['undo']}}));
 const days=['2026-01-03','2026-01-02','2026-01-01'];const put=n=>{try{days.forEach(d=>localStorage.removeItem('english5000v5_snap_'+d));days.forEach(d=>localStorage.setItem('english5000v5_snap_'+d,JSON.stringify({wordKnown:['s'+d],pad:'x'.repeat(n)})));localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(days.map(d=>({date:d,savedAt:d+'T08:00:00.000Z',version:'5.34.0',summary:{wordKnown:1}}))));return true}catch(e){return false}};
 let lo=100000,hi=1800000;while(hi-lo>40){const m=Math.floor((lo+hi)/2);if(put(m))lo=m;else hi=m}put(lo);
 const raws={};days.forEach(d=>raws[d]=localStorage.getItem('english5000v5_snap_'+d));const before=snapMeta().length;
 WORDS.filter(x=>!x.b&&x.k===2).slice(0,300).forEach(x=>store.wordFav.push(x.w));saveNow();
 const r={before,saved:JSON.parse(localStorage.getItem('english5000v5')).wordFav.length===store.wordFav.length,after:snapMeta().length,corrupt:localStorage.getItem('english5000v5_corrupt_1')!==null,pre:localStorage.getItem('english5000v5_before_restore')!==null};
 r.st=await snapDbIdle();const db=await __idbAll();r.inDb=days.filter(d=>db[d]&&db[d].raw===raws[d]);r.meta=days.every(d=>db[d]&&db[d].savedAt===d+'T08:00:00.000Z'&&db[d].version==='5.34.0');
 r.lsKeys=Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).length;return r});
ok('localStorage 滿了：先把自動備份移到瀏覽器資料庫（不刪損毀檔備份、復原點），學習紀錄照樣存好，不跳出「空間不足」',E1.before===3&&E1.saved&&E1.after<3&&E1.corrupt&&E1.pre&&pg.__dlg.length===0,JSON.stringify(E1)+JSON.stringify(pg.__dlg));
ok('移出的自動備份都在資料庫裡，內容逐字相同、日期／時間／版本保留（沒有遺失）；之後 localStorage 只留最新一份',E1.st==='ok'&&E1.inDb.length===3&&E1.meta&&E1.lsKeys===1,JSON.stringify(E1));
// 匯入／還原前存「復原點」也放不下：先把自動備份移到資料庫
const E3=await E(async()=>{Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')||k.startsWith('english5000v5_corrupt_')||k==='english5000v5_before_restore').forEach(k=>localStorage.removeItem(k));
 store.wordFav=store.wordFav.slice(0,5);store.pad='p'.repeat(1000000);saveNow();
 const days=['2026-02-02','2026-02-01'];const put=n=>{try{days.forEach(d=>localStorage.removeItem('english5000v5_snap_'+d));days.forEach(d=>localStorage.setItem('english5000v5_snap_'+d,JSON.stringify({wordKnown:['t'+d],pad:'y'.repeat(n)})));localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(days.map(d=>({date:d,savedAt:'',version:'5.34.0',summary:{}}))));return true}catch(e){return false}};
 let lo=100000,hi=2000000;while(hi-lo>40){const m=Math.floor((lo+hi)/2);if(put(m))lo=m;else hi=m}put(lo);
 const raws={};days.forEach(d=>raws[d]=localStorage.getItem('english5000v5_snap_'+d));window.__raws=raws;
 return {wp:writeProgress({wordKnown:['restored'],wordFav:[],fav:[],known:[],wordStatus:{},reviewDue:{},settings:{dailyGoal:20},wordKeyVersion:5},'測試還原')}});
await pg.waitForLoadState('load');await sleep(2500);
const E3b=await E(async()=>{await snapDbIdle();const db=await __idbAll();const pre=JSON.parse(localStorage.getItem('english5000v5_before_restore')||'null');return {wk:JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join(),pre:!!(pre&&pre.progress&&pre.progress.pad),undo:!!document.querySelector('#bkUndo'),inDb:['2026-02-02','2026-02-01'].filter(d=>db[d]&&JSON.parse(db[d].raw).wordKnown[0]==='t'+d&&db[d].raw.length>100000).length}});
ok('匯入／還原前存「復原點」放不下時：先把自動備份移到資料庫（內容保留）再存復原點，還原照常、可以復原',E3.wp===true&&E3b.wk==='restored'&&E3b.pre&&E3b.undo&&E3b.inDb===2,JSON.stringify([E3,E3b]));
await done(ctx,errs,[pg])}

// ---------- F. 備份檔：匯出 fmt 6、匯入舊檔與 fmt 6、拒絕較新的 fmt ----------
{const {ctx,pg,errs,E}=await open();
await pg.goto(U);await sleep(900);
await E(()=>{store.wordKnown=['go','cat'];store.wordStatus={go:'known',cat:'known'};store.studyDays=['2026-10-20','2026-10-21'];store.settings.dailyGoal=30;saveNow()});
await pg.reload();await sleep(900);await pg.click('#navStats');await sleep(300);
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));const av=await E(()=>APP_VERSION);
ok('匯出備份檔：加上 "fmt":6，原有欄位（app、version、schemaVersion、exportedAt、summary、progress）都保留',ex.fmt===6&&ex.app==='english-5000'&&ex.version===av&&ex.schemaVersion===3&&!isNaN(Date.parse(ex.exportedAt))&&ex.summary&&ex.summary.wordKnown===2&&ex.progress&&ex.progress.wordKnown.join()==='go,cat'&&ex.progress.settings.dailyGoal===30&&JSON.stringify(Object.keys(ex))===JSON.stringify(['app','version','schemaVersion','fmt','exportedAt','summary','progress']),JSON.stringify(Object.keys(ex)));
const cp=await E(()=>{const o=JSON.parse(backupText());return o.fmt});
ok('「📋 複製備份內容」的文字也有 "fmt":6',cp===6,String(cp));
const file=(n,o)=>{const f=path.join(TMP,n);fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o));return f};
const prog=w=>Object.assign({},ex.progress,{wordKnown:[w],wordStatus:{[w]:'known'}});
const v5={app:'english-5000',version:'5.34.0',schemaVersion:3,exportedAt:'2026-10-20T08:00:00.000Z',summary:{},progress:prog('vfive')};
const imp=async f=>{pg.__dlg.length=0;await pg.setInputFiles('#bkImport',f);await pg.waitForLoadState('load');await sleep(1500);return E(()=>({wk:JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join(),msg:document.querySelector('#backupMsg').textContent}))};
const F3=await imp(file('v5.json',v5));
ok('匯入 V5 的備份檔（沒有 fmt）：照常匯入',pg.__dlg.length===1&&F3.wk==='vfive'&&/已匯入/.test(F3.msg),JSON.stringify([F3,pg.__dlg.length]));
const F4=await imp(file('f6.json',Object.assign({},ex,{progress:prog('fsix')})));
ok('匯入 fmt 6 的備份檔：照常匯入',pg.__dlg.length===1&&F4.wk==='fsix'&&/已匯入/.test(F4.msg),JSON.stringify([F4,pg.__dlg.length]));
const cur=await E(()=>localStorage.getItem('english5000v5'));const rej=[];
for(const [n,o] of [['f7.json',Object.assign({},ex,{fmt:7,progress:prog('fseven')})],['f7b.json',{app:'english-5000',fmt:7,data:{}}],['f7c.json',Object.assign({},ex,{fmt:'7',progress:prog('fseven')})]]){pg.__dlg.length=0;await pg.setInputFiles('#bkImport',file(n,o));await sleep(400);rej.push(await E(()=>({msg:document.querySelector('#backupMsg').textContent,st:localStorage.getItem('english5000v5')})).then(r=>/這是較新版本 App 的備份，請先更新 App 再匯入/.test(r.msg)&&/目前的紀錄沒有變動/.test(r.msg)&&r.st===cur&&pg.__dlg.length===0?'':n))}
await pg.click('.bk-paste summary');await pg.fill('#bkPaste',JSON.stringify(Object.assign({},ex,{fmt:8})));pg.__dlg.length=0;await pg.click('#bkPasteGo');await sleep(400);
const F5p=await E(()=>({msg:document.querySelector('#backupMsg').textContent,st:localStorage.getItem('english5000v5')}));
ok('較新的格式（fmt 7、只有 fmt 沒有 progress、"7"、貼上 fmt 8）：顯示「這是較新版本 App 的備份，請先更新 App 再匯入」，不詢問、紀錄完全不變',rej.every(x=>!x)&&/這是較新版本 App 的備份，請先更新 App 再匯入/.test(F5p.msg)&&F5p.st===cur&&pg.__dlg.length===0,rej.filter(Boolean).join(',')+' '+F5p.msg);
await pg.setInputFiles('#bkImport',file('fbad.json',Object.assign({},ex,{fmt:'abc'})));await sleep(400);
const F6=await E(()=>({msg:document.querySelector('#backupMsg').textContent,st:localStorage.getItem('english5000v5')}));
ok('fmt 不是數字：顯示「無法辨識備份檔的格式版本」，紀錄不變',/無法辨識備份檔的格式版本/.test(F6.msg)&&F6.st===cur,F6.msg);
await done(ctx,errs,[pg])}

// ---------- H. 從已安裝的舊版（V5.34.0）更新 ----------
{const NX=path.join(TMP,'next');fs.cpSync('site',NX,{recursive:true});
 fs.writeFileSync(path.join(NX,'app.js'),fs.readFileSync(path.join('site','app.js'),'utf8').replace(/const APP_VERSION='[^']+'/,"const APP_VERSION='9.9.9'"));
 fs.writeFileSync(path.join(NX,'index.html'),fs.readFileSync(path.join('site','index.html'),'utf8').replace(/id="appVer">V[^<]+</,'id="appVer">V9.9.9<'));
 fs.writeFileSync(path.join(NX,'sw.js'),fs.readFileSync(path.join('site','sw.js'),'utf8').replace(/const C='[^']+'/,"const C='english-5000-v9-9-9'"));
 ROOT=OLD;const {ctx,pg,errs,E}=await open({sw:true});
 const KS=async()=>{for(let t=0;t<10;t++){try{return await pg.evaluate(()=>caches.keys())}catch(e){await sleep(300)}}return []};
 await pg.goto(U);for(let k=0;k<60;k++){if((await KS()).some(x=>/^english-5000-v/.test(x)))break;await sleep(300)}
 await pg.reload();await sleep(1500);const v0=await E(()=>APP_VERSION);
 await E(()=>{const s=JSON.parse(localStorage.getItem('english5000v5')||'{}');s.wordFav=['go','check'];s.wordKnown=['be'];s.wordStatus=Object.assign(s.wordStatus||{},{be:'known',dog:'learning'});s.studyDays=['2026-10-20','2026-10-21'];s.settings=Object.assign(s.settings||{},{dailyGoal:30});localStorage.setItem('english5000v5',JSON.stringify(s))});
 await pg.reload();await sleep(1500);
 // 前 2 天的自動備份（用舊版自己的格式：V5.28 起每天一個鍵＋索引；更舊的版本是一個鍵存 3 份）
 const OS=await E(()=>{const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const day=k=>{const d=new Date();d.setDate(d.getDate()+k);return ymd(d)};
  const base=JSON.parse(localStorage.getItem('english5000v5')),dates=[day(-1),day(-2)],out={dates,today:day(0)};
  const idx=localStorage.getItem('english5000v5_snaps_idx');
  if(idx!=null){const a=JSON.parse(idx);dates.forEach((d,k)=>{const raw=JSON.stringify(Object.assign({},base,{wordFav:['prev'+k]}));localStorage.setItem('english5000v5_snap_'+d,raw);a.push({date:d,savedAt:d+'T08:00:00.000Z',version:APP_VERSION,summary:{wordKnown:1}})});localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(a));out.fmt='每天一個鍵'}
  else{const a=JSON.parse(localStorage.getItem('english5000v5_snaps')||'[]');dates.forEach((d,k)=>a.push({date:d,savedAt:d+'T08:00:00.000Z',version:APP_VERSION,progress:Object.assign({},base,{wordFav:['prev'+k]})}));localStorage.setItem('english5000v5_snaps',JSON.stringify(a));out.fmt='一個鍵'}
  out.n=Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap')).length;return out});
 const before=await E(()=>localStorage.getItem('english5000v5'));
 ROOT=NX;await E(()=>navigator.serviceWorker.getRegistration().then(r=>r&&r.update())).catch(()=>{});
 for(let k=0;k<60;k++){await sleep(300);if((await KS()).includes('english-5000-v9-9-9'))break}
 await sleep(2000);await pg.reload().catch(()=>{});await sleep(1500);
 await pg.waitForFunction(()=>typeof APP_VERSION!=='undefined'&&APP_VERSION==='9.9.9',null,{timeout:15000}).catch(()=>{});
 const H=await E(async LSf=>({v:APP_VERSION,st:typeof snapDbIdle==='function'?await snapDbIdle():'無',ls:eval(LSf)(),db:await __idbAll(),main:localStorage.getItem('english5000v5')}),LS.toString()).catch(e=>({err:String(e)}));
 const A1=JSON.parse(before),A2=H.main?JSON.parse(H.main):{};
 ok(`從已安裝的 V${v0} 更新到新版：學習紀錄全部保留（收藏單字、已熟、單字狀態、學習天數、每日目標）`,!!H.v&&H.v==='9.9.9'&&JSON.stringify([A2.wordFav,A2.wordKnown,A2.wordStatus&&A2.wordStatus.be,A2.wordStatus&&A2.wordStatus.dog,A2.studyDays,A2.settings&&A2.settings.dailyGoal])===JSON.stringify([A1.wordFav,A1.wordKnown,'known','learning',A1.studyDays,30]),JSON.stringify({old:OLD,v0,v:H.v,fav:A2.wordFav,err:H.err}));
 const dbk=Object.keys(H.db||{}).sort();
 ok(`更新後：舊版的自動備份（${OS.fmt}，今天＋前 2 天）搬到瀏覽器資料庫、內容正確，localStorage 只留最新一份`,H.st==='ok'&&H.ls&&H.ls.keys.join()===OS.today&&[OS.today,...OS.dates].every(d=>H.db[d])&&OS.dates.every((d,k)=>JSON.parse(H.db[d].raw).wordFav.join()==='prev'+k)&&H.ls.flag&&H.ls.flag.ok===1,JSON.stringify({fmt:OS.fmt,n:OS.n,keys:H.ls&&H.ls.keys,db:dbk,flag:H.ls&&H.ls.flag}));
 ROOT='site';await done(ctx,errs,[pg])}

ok('p33 全部沒有 JavaScript 錯誤、主控台錯誤或錯誤提示條',ALL.length===0,ALL.join(' | ').slice(0,1500));
fs.writeFileSync('results_p33.json',JSON.stringify(R,null,1));fs.rmSync(TMP,{recursive:true,force:true});await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
