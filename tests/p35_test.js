// V6.2.0 開啟速度：事先算好的關鍵字（KWPRE）和即時計算完全相同、句子改過時改用即時計算；
// 大的字庫用 JSON.parse 格式且內容不變；V4 字表（data-v4.js）只有很舊的學習紀錄才載入、下載失敗自動重試；單元數量標籤
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),vm=require('vm');
const PORT=8906,U='http://localhost:8906/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
/* 測試用網站：記錄每個請求（LOG）、可以讓某個檔案下載失敗（BLOCK：次數） */
const LOG=[],BLOCK={},MISS=[];
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(BLOCK[p]>0){BLOCK[p]--;q.socket.destroy();return}LOG.push(p);if(p.endsWith('/'))p+='index.html';const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
const open=async()=>{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5)});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}};
const ready=pg=>pg.waitForFunction(()=>typeof ALLS!=='undefined'&&document.readyState==='complete',null,{timeout:20000});

/* 1. 字庫檔：大的資料用 JSON.parse('…')，用 Node 讀出來的內容正確 */
{const files=fs.readdirSync('site').filter(f=>/^data.*\.js$/.test(f));const big=[];
 for(const f of files)fs.readFileSync(path.join('site',f),'utf8').split('\n').forEach(l=>{const m=/^window\.(\w+)=/.exec(l);if(m&&l.length>=10000)big.push([f,m[1],l.includes('=JSON.parse(\'')])});
 ok('大的字庫（10 KB 以上）都用 JSON.parse 格式（解析比較快）',big.length>=8&&big.every(x=>x[2]),big.map(x=>x[0]+':'+x[1]+(x[2]?'':'✗')).join(' '));
 const ctx={window:{}};for(const f of ['data.js','data-ex.js','data-ex2.js','data-more.js','data-v4.js'])vm.runInNewContext(fs.readFileSync(path.join('site',f),'utf8'),ctx);const w=ctx.window;
 ok('字庫內容可讀出：單字、對話、句型、例句、情境題、V4 字表',w.WORDS.length>5000&&w.DIALOGS.length>=20&&w.FRAMES.length>=20&&Object.keys(w.WORD_EX).length>4000&&w.SITQ.length>50&&w.V4_WORDS.length>4000&&w.V4_WORDS[0]==='the',[w.WORDS.length,w.DIALOGS.length,w.FRAMES.length,w.V4_WORDS.length].join('/'));
 ok('V4 字表不在 data.js（開啟時不用解析）',!/^window\.V4_WORDS=/m.test(fs.readFileSync('site/data.js','utf8')));
 const sw=fs.readFileSync('site/sw.js','utf8');ok('離線快取清單有 data-v4.js',/'data-v4\.js':'[0-9a-f]{12}'/.test(sw));
}
/* 2. 事先算好的關鍵字＝即時計算 */
{const {ctx,pg,errs,E}=await open();await pg.goto(U);await ready(pg);await sleep(300);
 ok('開啟 App 時沒有重算關鍵字（CE 字索引沒有建立）',await E(()=>typeof KWCE==='undefined'||!KWCE));
 const r=await E(()=>{const B=kwBuild(),P=window.KWPRE||{},ids=ALLS.filter(s=>/^(dialog|radio|frame)$/.test(s.src));
  const same=ids.filter(s=>B.k[s.id]===[kwHash(s.en)].concat(s.keys).join('|')).length;
  return {n:ids.length,nk:Object.keys(B.k).length,pk:JSON.stringify(P.k)===JSON.stringify(B.k),px:JSON.stringify(P.x)===JSON.stringify(B.x),same,kx:Object.keys(B.x).every(k=>JSON.stringify(KX[k])===JSON.stringify(B.x[k])),kxN:Object.keys(B.x).length}});
 ok('KWPRE（事先算好的關鍵字）和即時計算完全相同（字庫改了要用 data_build.js 重新產生）',r.pk&&r.px&&r.nk===r.n&&r.n>=900,JSON.stringify(r));
 ok('句子清單裡對話句、無線電用語、句型替換的關鍵字都和即時計算相同',r.same===r.n,r.same+'/'+r.n);
 ok('KEYX 說明（CE 縮寫全名、字母代碼、片語、無線電用語）都有',r.kx&&r.kxN>=10,r.kxN);
 const s=await E(()=>{const L=DIALOGS[0].lines[0],id='d:'+DIALOGS[0].id+':0';return {hit:!!kwPre(id,L.en),miss:kwPre(id,L.en+' changed'),none:kwPre('d:zz:0','x'),calc:kwSent(L.en).join('|')===kwPre(id,L.en).join('|')}});
 ok('句子改過（雜湊不同）或沒有事先算好時，改用即時計算',s.hit&&s.miss===null&&s.none===null&&s.calc,JSON.stringify(s));
 ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
/* 3. 改過的對話句：開啟時即時計算，結果和正常一樣 */
{const {ctx,pg,errs,E}=await open();await pg.addInitScript(()=>{let v;Object.defineProperty(window,'KWPRE',{configurable:true,get:()=>v,set:x=>{x.k['d:d01:0']='zzz|wrong';v=x}})});
 await pg.goto(U);await ready(pg);
 const r=await E(()=>{const s=ALLS.find(x=>x.id==='d:d01:0');return {k:s.keys.join('|'),c:kwSent(s.en).join('|')}});
 ok('事先算好的資料不符時，句子關鍵字照常（即時計算）',r.k===r.c&&r.k!=='wrong',JSON.stringify(r));ok('沒有 JavaScript 錯誤（資料不符）',errs.length===0,errs.join(' | '));await ctx.close()}
/* 4. 單元數量標籤 */
{const {ctx,pg,errs,E}=await open();await pg.goto(U);await ready(pg);await pg.waitForFunction(()=>ALLS.some(s=>s.src==='word2'),null,{timeout:30000}).catch(()=>{});await sleep(300);
 const r=await E(()=>{const t=s=>(document.querySelector(s)||{}).textContent||'',n=f=>WORDS.filter(f).length,a=f=>ALLS.filter(f).length;
  return [[t('#wordBook option[value="7"]'),'CE 專業字與縮寫（'+n(x=>x.k===7)+'）'],[t('#wordBook option[value="8"]'),'職場英文（多益＋商用，'+n(x=>x.k===8)+'）'],[t('#wordBook option[value="toeic"]'),'TOEIC 多益（'+n(x=>x.toeic)+'）'],
   [t('#unit option[value="w7"]'),'CE 專業字例句（'+a(s=>s.src==='word'&&s.book===7)+'）'],[t('#unit option[value="wt"]'),'TOEIC 多益例句（'+a(s=>s.src==='word'&&s.toeic)+'）'],[t('#unit option[value="wt2"]'),'📖 多益長例句（'+a(s=>s.src==='word2')+'）'],
   [t('#unit option[value="radio"]'),'📻 無線電用語（'+a(s=>s.src==='radio')+'）'],[t('#unit option[value="pwork"]'),'片語例句・工作（'+PHRASES.filter(p=>p.cat==='work').length+'）'],[t('#unit option[value="every"]'),'全部句子（'+ALLS.length+'）']]});
 ok('單元數量標籤正確（CE、職場、多益、長例句、無線電、片語、全部句子）',r.every(x=>x[0]===x[1]),r.filter(x=>x[0]!==x[1]).map(x=>x.join(' ≠ ')).join(' | ')||r.length+' 項');
 ok('沒有 JavaScript 錯誤（數量）',errs.length===0,errs.join(' | '));await ctx.close()}
/* 5. 一般開啟不載入 data-v4.js；很舊的紀錄才載入並轉移 */
{const {ctx,pg,errs,E}=await open();LOG.length=0;await pg.goto(U);await ready(pg);await sleep(300);
 ok('第一次開啟（沒有學習紀錄）不下載 data-v4.js',!LOG.includes('/data-v4.js')&&await E(()=>!window.V4_WORDS));
 await E(()=>{store.wordFav=['go'];save()});await sleep(600);LOG.length=0;await pg.reload();await ready(pg);await sleep(300);
 ok('之後開啟（新版紀錄）也不下載 data-v4.js',!LOG.includes('/data-v4.js')&&await E(()=>!window.V4_WORDS&&store.wordKeyVersion>=2));
 const V4=(()=>{const c={window:{}};vm.runInNewContext(fs.readFileSync('site/data-v4.js','utf8'),c);return c.window.V4_WORDS})();
 const old={wordFav:[3,5],wordKnown:[2],wordStatus:{'2':'known','4':'learning'},reviewDue:{},fav:[],known:[],settings:{dailyGoal:20}};
 /* 先停止 App 自己的存檔（不然重新載入前會把記憶體裡的紀錄寫回去，蓋掉測試放的舊紀錄） */await E(o=>{saveLock();localStorage.setItem('english5000v5',JSON.stringify(o))},old);LOG.length=0;await pg.reload();await ready(pg);await sleep(300);
 const r=await E(()=>({v:store.wordKeyVersion,fav:store.wordFav,kn:store.wordKnown,st:store.wordStatus,bar:!!document.getElementById('errBar')}));
 ok('很舊的學習紀錄（單字用編號記）：開啟時載入 data-v4.js 並轉成單字',LOG.includes('/data-v4.js')&&r.v>=5&&r.fav.includes(V4[2])&&r.fav.includes(V4[4])&&r.kn.includes(V4[1])&&r.st[V4[1]]==='known'&&!r.bar,JSON.stringify({dl:LOG.includes('/data-v4.js'),...r,st:undefined}));
 LOG.length=0;await pg.reload();await ready(pg);await sleep(300);ok('轉移後再開啟就不再下載 data-v4.js',!LOG.includes('/data-v4.js'));
 ok('沒有 JavaScript 錯誤（V4 轉移）',errs.length===0,errs.join(' | '));await ctx.close()}
/* 6. data-v4.js 下載失敗：不轉移、不存檔，自動重新載入一次再轉移；不顯示錯誤訊息 */
{const {ctx,pg,errs,E}=await open();await pg.goto(U);await ready(pg);
 const old={wordFav:[3],wordKnown:[],wordStatus:{'7':'known'},fav:[],known:[],settings:{dailyGoal:20}};
 /* 先停止 App 自己的存檔（不然重新載入前會把記憶體裡的紀錄寫回去，蓋掉測試放的舊紀錄） */await E(o=>{saveLock();localStorage.setItem('english5000v5',JSON.stringify(o))},old);BLOCK['/data-v4.js']=1;LOG.length=0;
 await pg.reload();await sleep(1500);await ready(pg);await sleep(500);
 const r=await E(()=>({v:store.wordKeyVersion,fav:store.wordFav,ss:sessionStorage.getItem('e5k_v4'),bar:!!document.getElementById('errBar')}));
 const V4=(()=>{const c={window:{}};vm.runInNewContext(fs.readFileSync('site/data-v4.js','utf8'),c);return c.window.V4_WORDS})();
 ok('data-v4.js 第一次下載失敗：自動重新載入後轉移成功、不顯示錯誤',r.v>=5&&r.fav.includes(V4[2])&&!r.bar&&r.ss===null&&LOG.filter(p=>p==='/data-v4.js').length===1,JSON.stringify(r));
 ok('沒有其他 JavaScript 錯誤（下載失敗）',errs.filter(e=>!/E5K_V4_RELOAD/.test(e)).length===0,errs.join(' | '));await ctx.close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p35.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
