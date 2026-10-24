// V5.17.0：今日學習新增任務、字庫快取沿用（新版本不重新下載沒變的字庫）
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),crypto=require('crypto');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
let ROOT='site',LOG=[],ONLINE=true;
const srv=http.createServer((q,s)=>{if(!ONLINE){q.socket.destroy();return}let p=decodeURIComponent(q.url.split('?')[0]);LOG.push(p);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});s.end(fs.readFileSync(f))}).listen(8872);
const sha12=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0,12);
const KS=async pg=>{for(let t=0;t<10;t++){try{return await pg.evaluate(()=>caches.keys())}catch(e){await sleep(300)}}return []};
(async()=>{const b=await launch();
// ---------- A. 今日學習 ----------
{const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20)});
 await pg.goto('http://localhost:8872/');await sleep(900);await pg.click('#navToday');await sleep(200);
 let t=await pg.textContent('#todayBody');
 ok('今日學習：新增 Role Play 任務（建議還沒演過的情境）',/Role Play（建議：交接班）/.test(t)&&/0 \/ 1/.test(t),t.match(/Role Play[^0-9]*/)&&t.match(/Role Play[^0-9]*/)[0]);
 ok('今日學習：新增 CE 情境題任務 0 / 5',/CE情境題0\/5/.test(t.replace(/\s+/g,'')));
 ok('沒有答錯時不顯示答錯清單任務',!/測驗答錯的句子|答錯的情境題/.test(t));
 await pg.click('#todayBody [data-go="rp"]');await sleep(200);
 ok('按 Role Play「開始」：打開建議的對話（有 🎭 按鈕）',await pg.evaluate(()=>!$('#dialogPage').hidden&&DLG.cur&&DLG.cur.id==='d01'&&!!$('#dlgRpB')));
 await pg.click('#dlgRpB');await sleep(300);for(let k=0;k<6;k++){await pg.click('#rpNext');await sleep(250)}
 await pg.click('#navToday');await sleep(200);t=await pg.textContent('#todayBody');
 ok('演完 1 段後：Role Play 任務完成、建議換成下一個情境',/Role Play（建議：向 FOC 回報異常事件）/.test(t)&&/1 \/ 1 ✅/.test(t),t.match(/Role Play[^✅]*✅?/)&&t.match(/Role Play[^✅]*✅?/)[0]);
 const ring0=await pg.evaluate(()=>+document.querySelector('.ring b').textContent);ok('「今日完成」計入 Role Play',ring0>=1,String(ring0));
 await pg.click('#todayBody [data-go="situ"]');await sleep(200);
 ok('按 CE 情境題「開始」：切到情境題',await pg.evaluate(()=>$('#quizType').value==='situ'&&!$('#quizSitOpts').hidden&&$('#quizSRange2').value==='all'&&document.querySelectorAll('#quizOpts .sq-opt').length===4));
 await pg.evaluate(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent!==q.opts[q.ans]).click()});await sleep(200);
 const wrongQ=await pg.evaluate(()=>store.sqLast);for(let k=0;k<2;k++){do{await pg.click('#newQuiz');await sleep(60)}while(await pg.evaluate(w=>store.sqLast===w,wrongQ));await pg.evaluate(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent===q.opts[q.ans]).click()});await sleep(100)}
 await pg.evaluate(()=>{store.lsWrong={[ALLS.find(s=>s.src==='core').id]:1,'d:d02:3':1};save()});
 await pg.click('#navToday');await sleep(200);t=(await pg.textContent('#todayBody')).replace(/\s+/g,'');
 ok('情境題答 3 題：任務顯示 3 / 5',/CE情境題3\/5/.test(t));
 ok('有答錯時顯示「我的錯題本」任務（單字、句子、情境題）',/我的錯題本單字0、句子2、情境題1，共3題/.test(t),t.match(/我的錯題本[^開]*/)&&t.match(/我的錯題本[^開]*/)[0]);
 await pg.click('#todayBody [data-go="wrongbook"]');await sleep(200);
 ok('按「我的錯題本」：打開錯題本頁',await pg.evaluate(()=>!$('#wrongPage').hidden&&document.querySelectorAll('#wrongBody .wb-row').length===3));
 await pg.click('#wrongBody [data-wbgo="s"]');await sleep(200);
 ok('錯題本 › 句子「聽力練習」：聽力題只出答錯的句子',await pg.evaluate(()=>$('#quizType').value==='lisen'&&$('#quizSRange').value==='wrong'&&!$('#quizSOpts').hidden&&document.querySelectorAll('#quizOpts button').length===4));
 await pg.click('#openWB');await sleep(200);await pg.click('#wrongBody [data-wbgo="q"]');await sleep(200);
 ok('錯題本 › 情境題「練習」：情境題只出答錯的題目',await pg.evaluate(()=>$('#quizType').value==='situ'&&$('#quizSRange2').value==='wrong'&&!!store.sqWrong[store.sqLast]));
 ok('今日學習沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// ---------- B. 字庫快取沿用 ----------
const swTxt=fs.readFileSync(path.join('site','sw.js'),'utf8');
const DF=JSON.parse(((swTxt.match(/const DATA_FILES=(\{[^}]*\})/)||[])[1]||'{}').replace(/'/g,'"'));
const dname=df=>'english-5000-data-'+Object.values(df).map(h=>h.slice(0,6)).join('');const DNAME=dname(DF);
ok('離線快取的字庫代碼和 data.js、data-ex.js、data-ex2.js 內容一致（SHA-1）',['data.js','data-ex.js','data-ex2.js'].every(f=>f in DF)&&Object.keys(DF).length===3&&Object.entries(DF).every(([f,h])=>h===sha12(path.join('site',f))),JSON.stringify(DF));
{fs.rmSync('/tmp/t5/swnext',{recursive:true,force:true});fs.cpSync('site','/tmp/t5/swnext',{recursive:true});
 fs.appendFileSync('/tmp/t5/swnext/data-ex.js','\n/* data changed */\n');const DF2=Object.assign({},DF,{'data-ex.js':sha12('/tmp/t5/swnext/data-ex.js')});
 fs.writeFileSync('/tmp/t5/swnext/sw.js',swTxt.replace(/const DATA_FILES=\{[^}]*\}/,'const DATA_FILES='+JSON.stringify(DF2).replace(/"/g,"'")).replace(/const C='[^']+'/,"const C='english-5000-v9-9-9'"));
 const ctx=await b.newContext();const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 ROOT=process.env.PREV||'prev';await pg.goto('http://localhost:8872/');await sleep(1500);await pg.reload();await sleep(1200);
 const k0=await KS(pg);
 ROOT='site';LOG=[];await pg.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
 for(let k=0;k<40;k++){await sleep(250);const ks=await KS(pg);if(ks.includes(process.env.CACHE)&&!ks.some(x=>/v5-16/.test(x)))break}
 await sleep(1500);const k1=await KS(pg);const dl1=LOG.filter(p=>p==='/data.js').length,dx1=LOG.filter(p=>p==='/data-ex.js').length;
 ok('從 V5.16.20 升到新版：字庫格式改變，data.js 與 data-ex.js 各下載一次',dl1===1&&dx1===1,'data.js '+dl1+' 次、data-ex.js '+dx1+' 次；舊 '+JSON.stringify(k0)+' → '+JSON.stringify(k1));
 ok('升版後快取：新版程式快取＋字庫快取，舊版已清除',k1.length===2&&k1.includes(process.env.CACHE)&&k1.includes(DNAME),JSON.stringify(k1));
 await pg.reload().catch(()=>{});await sleep(1500);
 const has=await pg.evaluate(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('english-5000-data-')));const a=await c.match('data.js'),b=await c.match('data-ex.js');return [a?(await a.text()).length:0,b?(await b.text()).length:0]});
 ok('字庫快取裡有完整的 data.js 與 data-ex.js',has[0]===fs.readFileSync(path.join('site','data.js'),'utf8').length&&has[1]===fs.readFileSync(path.join('site','data-ex.js'),'utf8').length,JSON.stringify(has));
 ONLINE=false;await pg.reload().catch(()=>{});await sleep(1800);
 const off=await pg.evaluate(()=>({v:(document.querySelector('#appVer')||{}).textContent,w:(window.WORDS||[]).length,d:(window.DIALOGS||[]).length,ex:!!((window.WORDS||[]).find(x=>x.w==='go')||{}).ex,every:(document.querySelector('#unit option[value="every"]')||{}).textContent})).catch(e=>({err:String(e)}));
 ok('離線時可以開啟（程式、字庫、單字例句都從快取載入）',off.v===process.env.VER&&off.w>6000&&off.d===require('./common').dataCounts().dn&&off.ex&&new RegExp('（'+require('./common').dataCounts().total+'）').test(off.every||''),JSON.stringify(off));ONLINE=true;
 ROOT='/tmp/t5/swnext';LOG=[];await pg.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
 for(let k=0;k<40;k++){await sleep(250);const ks=await KS(pg);if(ks.includes('english-5000-v9-9-9')&&ks.length===2)break}
 await sleep(1500);const k2=await KS(pg);const dl2=LOG.filter(p=>p==='/data.js').length,dx2=LOG.filter(p=>p==='/data-ex.js').length;
 ok('只有例句檔改動的版本：只重新下載 data-ex.js（data.js 沿用）、換成新的字庫快取',dl2===0&&dx2===1&&k2.includes(dname(DF2))&&!k2.includes(DNAME)&&k2.length===2,'data.js '+dl2+' 次、data-ex.js '+dx2+' 次；'+JSON.stringify(k2));
 ok('升版過程沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
fs.writeFileSync('results_p9.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
