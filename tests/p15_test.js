// V5.24.0：版面精簡（頁首、單字頁篩選區、單字卡與片語卡、匯出匯入移到統計頁、主畫面全螢幕的安全區域）；V5.24.1：句子頁再精簡
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8883);
(async()=>{const b=await launch();
// iPhone Safari 實際可見的範圍（扣掉網址列與下方工具列）
const ctx=await b.newContext({viewport:{width:390,height:686},acceptDownloads:true});const pg=await ctx.newPage();require('./common').wfAuto(pg);const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);
await pg.goto('http://localhost:8883/');await sleep(1200);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const navTop=await E(()=>Math.round(document.querySelector('nav').getBoundingClientRect().top));
const hd=await E(()=>({h:Math.round(document.querySelector('header').getBoundingClientRect().height),p:getComputedStyle(document.querySelector('header p')).display,v:document.querySelector('#appVer').getBoundingClientRect().height>0}));
ok('頁首只有一行（高度 ≤ 50px，原本約 103px），版本號仍顯示',hd.h<=50&&hd.p==='none'&&hd.v,JSON.stringify(hd));
// 單字頁
await pg.click('#navWords');await sleep(400);
const L=await E(()=>{const c=[...document.querySelectorAll('#wordRows .word-card')];const h=c.slice(0,60).map(e=>e.getBoundingClientRect().height);return {first:Math.round(c[0].getBoundingClientRect().top),avg:Math.round(h.reduce((a,b)=>a+b,0)/h.length),head:['play','slow','fav','known'].every(k=>!!c[0].querySelector('.wc-head .word-actions [data-act="'+k+'"]')),ex:!!c[0].querySelector('.ex [data-act="ex"]')}});
ok('單字頁一打開就看得到單字：至少 2 個單字卡完整出現在畫面內',L.first+2*L.avg<=navTop,JSON.stringify(L)+' 底部選單 '+navTop);
ok('單字卡高度 ≤ 160px（原本約 227px）',L.avg<=160,String(L.avg));
ok('🔊 🐢 ☆ ○ 在單字那一行、💬 在例句框右邊',L.head&&L.ex);
const ch=await E(()=>({chips:[...document.querySelectorAll('#bookChips [data-b]')].map(x=>x.dataset.b),opts:[...document.querySelectorAll('#wordBook option')].map(o=>o.value),on:[...document.querySelectorAll('#bookChips .on')].map(x=>x.dataset.b),hidden:document.querySelector('#wordBook').hidden}));
ok('冊別改成一排按鈕（全部、第 1–5 冊、CE、職場、多益），和原本的選項一致；預設「全部 5000」',JSON.stringify(ch.chips)===JSON.stringify(ch.opts)&&ch.chips.length===9&&JSON.stringify(ch.on)===JSON.stringify(['all'])&&ch.hidden,JSON.stringify(ch));
const want=b=>E(b=>String(WORDS.filter(x=>inBook(x,b)&&!(skipV()&&x.b&&x.k!==7)).length),b);
for(const [bk,name] of [['1','第 1 冊'],['7','CE'],['toeic','多益']]){await pg.click(`#bookChips [data-b="${bk}"]`);await sleep(300);
 const r=await E(()=>({v:$('#wordBook').value,cnt:$('#wordCount').textContent,on:[...document.querySelectorAll('#bookChips .on')].map(x=>x.dataset.b),topic:$('#wordTopic option[value="el"]').textContent}));
 ok(`點「${name}」：範圍換成${name}、清單字數正確、按鈕反白、主題數字跟著變`,r.v===bk&&r.cnt===await want(bk)&&JSON.stringify(r.on)===JSON.stringify([bk])&&/（\d+）/.test(r.topic),JSON.stringify(r))}
await pg.click('#bookChips [data-b="all"]');await sleep(300);
// 統計數字可以點
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(250);
const f1=await E(()=>({st:$('#wordState').value,on:!!document.querySelector('#wordPage .word-stats [data-st="fav"].on'),cnt:$('#wordCount').textContent}));
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(250);
const f2=await E(()=>({st:$('#wordState').value,on:!!document.querySelector('#wordPage .word-stats .on')}));
ok('點「收藏」只列出收藏的字；再點一次回到全部',f1.st==='fav'&&f1.on&&f1.cnt==='0'&&f2.st==='all'&&!f2.on,JSON.stringify([f1,f2]));
await pg.click('#wordPage .word-stats [data-st="review"]');await sleep(250);const r1=await E(()=>$('#wordState').value);
await pg.click('#wordPage .word-stats [data-st="all"]');await sleep(250);const r2=await E(()=>$('#wordState').value);
ok('點「待複習」只列出待複習；點「顯示 N 字」回到全部',r1==='review'&&r2==='all',r1+' → '+r2);
// 單字卡上的按鈕照常運作
await E(()=>{window.__said=[]});
await pg.click('#wordRows .word-card[data-w="the"] [data-act="play"]');await pg.click('#wordRows .word-card[data-w="the"] [data-act="ex"]');await sleep(100);
const sd=await E(()=>window.__said.slice());
await pg.click('#wordRows .word-card[data-w="the"] [data-act="fav"]');await sleep(150);
await pg.click('#wordRows .word-card[data-w="the"] [data-act="known"]');await sleep(150);
const fk=await E(()=>({fav:store.wordFav.includes('the'),st:statusOf('the'),star:document.querySelector('#wordRows .word-card[data-w="the"] [data-act="fav"]').textContent,ck:document.querySelector('#wordRows .word-card[data-w="the"] [data-act="known"]').textContent,favN:$('#wordFavN').textContent}));
ok('單字卡按鈕：🔊 念單字、💬 念例句、☆ 收藏、○ 標記已熟',sd[0]==='the'&&sd[1]===(await E(()=>BY_WORD.the.ex))&&fk.fav&&fk.st==='known'&&fk.star==='★'&&fk.ck==='✓'&&fk.favN==='1',JSON.stringify([sd,fk]));
await pg.click('#wordRows .word-card[data-w="the"] .zh');await sleep(250);ok('點單字卡其他地方：打開這個字的單字卡',await E(()=>!$('#wordCard').hidden&&cardPool.length===1&&cardPool[0].w==='the'));
await E(()=>renderWords());await sleep(150);
// 匯出／匯入移到統計頁
ok('單字頁沒有「匯出進度／匯入進度」按鈕',await E(()=>!document.querySelector('#exportProgress')&&!document.querySelector('#importProgress')&&!document.querySelector('#wordPage .importBtn')));
await pg.click('#navStats');await sleep(300);ok('「統計 › 資料備份與還原」有匯出與匯入',await E(()=>!!document.querySelector('#bkExport')&&!!document.querySelector('#bkImport')));
// 今日學習的備份提醒：直接匯出
await E(()=>{store.studyDays=['2026-10-01','2026-10-02'];store.lastExport='2026-09-01';save();page('today');renderToday()});await sleep(300);
const hasBk=await E(()=>!!document.querySelector('#todayBody [data-go="backup"]'));
let dlOk=false;if(hasBk){const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null),pg.click('#todayBody [data-go="backup"]')]);if(dl){const j=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));dlOk=j.app==='english-5000'&&!!j.progress}}
ok('今日學習「立即匯出備份」：直接下載備份檔',hasBk&&dlOk,JSON.stringify([hasBk,dlOk]));
// 片語卡
await pg.click('#navPhrases');await sleep(400);
const P=await E(()=>{const c=[...document.querySelectorAll('#phRows .word-card')];const h=c.slice(0,40).map(e=>e.getBoundingClientRect().height);const x=c[0];return {avg:Math.round(h.reduce((a,b)=>a+b,0)/h.length),head:['play','fav','known'].every(k=>!!x.querySelector('.wc-head [data-a="'+k+'"]')),ex:['ex','slow'].every(k=>!!x.querySelector('.ex [data-a="'+k+'"]')),fit:[...x.querySelectorAll('.ex-btns button')].every(btn=>{const r=btn.getBoundingClientRect(),e=x.querySelector('.ex').getBoundingClientRect();return r.top>=e.top-1&&r.bottom<=e.bottom+1})}});
ok('片語卡高度 ≤ 160px（原本約 227px）；🔊 ☆ ○ 在片語那一行，💬 🐢 在例句框內',P.avg<=160&&P.head&&P.ex&&P.fit,JSON.stringify(P));
await E(()=>{window.__said=[]});const p1=await E(()=>PHRASES[+document.querySelector('#phRows .word-card').dataset.id-1]);
await pg.click('#phRows .word-card [data-a="ex"]');await sleep(100);await pg.click('#phRows .word-card [data-a="fav"]');await sleep(150);
ok('片語卡按鈕：💬 念例句、☆ 收藏',await E(p=>window.__said[0]===p.ex&&store.phFav.includes(p.id),p1));
// 句子頁：🎤 與 🎙 不用往下捲
await pg.click('#navPractice');await sleep(400);
const S=await E(()=>['#check','#record'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().bottom)));
ok('句子頁的 🎤 和 🎙 不用往下捲就按得到（離底部選單至少 40px，字型較大的手機也看得到）',S.every(y=>y<=navTop-40),JSON.stringify(S)+' 底部選單 '+navTop);
// 加入主畫面（全螢幕）：底部選單避開 iPhone 底部橫條、頁首避開瀏海
ok('全螢幕模式的安全區域：底部選單與頁首會讓開',await E(()=>{const t=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return []}}).flatMap(r=>r.cssRules&&r.cssRules.length?[...r.cssRules]:[r]).map(r=>r.cssText);return t.some(x=>/^nav\s*\{/.test(x)&&x.includes('safe-area-inset-bottom'))&&t.some(x=>/^header\s*\{/.test(x)&&x.includes('safe-area-inset-top'))&&!!document.querySelector('meta[name="viewport"][content*="viewport-fit=cover"]')}));
// 特大字體：單字頁不會左右超出畫面、四個按鈕在同一排
await pg.click('#navStats');await sleep(200);await pg.selectOption('#fontSel','1.3');await sleep(200);await pg.click('#navWords');await sleep(400);
const X=await E(()=>({over:document.documentElement.scrollWidth-innerWidth,row:[...document.querySelectorAll('#wordPage .v5-actions select,#wordPage .v5-actions button')].map(e=>Math.round(e.getBoundingClientRect().top)),right:Math.max(...[...document.querySelectorAll('#wordPage .wf-row>*,#wordPage .word-stats button,#wordRows .word-card .word-actions button')].map(e=>e.getBoundingClientRect().right))}));
ok('特大字體：單字頁不會左右超出畫面，四個按鈕在同一排',X.over<=0&&new Set(X.row).size===1&&X.right<=390,JSON.stringify(X));
await pg.click('#navStats');await sleep(200);await pg.selectOption('#fontSel','1');await sleep(150);
// 深色模式
await E(()=>{$('#themeSel').value='dark';$('#themeSel').onchange({target:$('#themeSel')})});await sleep(200);
const dk=await E(()=>{const on=document.querySelector('#bookChips .on'),off=document.querySelector('#bookChips button:not(.on)');return [getComputedStyle(on).backgroundColor,getComputedStyle(on).color,getComputedStyle(off).backgroundColor,getComputedStyle(off).color]});
ok('深色模式：冊別按鈕的顏色清楚（選中的是藍底白字）',dk[0]==='rgb(47, 105, 213)'&&dk[1]==='rgb(255, 255, 255)'&&dk[2]!==dk[0]&&dk[3]!==dk[2],JSON.stringify(dk));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p15.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
