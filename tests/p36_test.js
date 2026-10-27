// V6.3.0：⚡ 快速模式（意思回想倒數、時間到記為「◐ 再練」、已熟的字不降級、暫停）、
// 🧩 錯字放回原句（記下答錯出處、挖空原句、播放、選或輸入、對話填空的字）、學習天數（本週 N／7、每週可休 1 天、可以關掉）
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path');
const PORT=8907,U='http://localhost:8907/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const MISS=[];
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
const open=async()=>{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),5)};speechSynthesis.cancel=()=>{}});
 await pg.goto(U);await pg.waitForFunction(()=>typeof ALLS!=='undefined'&&typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:30000});await sleep(300);
 return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}};
const noOverflow=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);

/* ===== A. ⚡ 快速模式 ===== */
{const {ctx,pg,errs,E}=await open();
 await E(()=>{['check','pump','valve','alarm','power','cable'].forEach((w,k)=>{store.wordStatus[w]=k<3?'known':'learning';store.reviewStage[w]=k<3?4:0;store.reviewDue[w]=day(k<3?30:2);if(k<3)store.wordKnown.push(w)});save()});
 await pg.click('#navWords');await sleep(200);
 const start=ws=>E(ws=>{mrStart(ws.map(w=>BY_WORD[w]),'btn')},ws);
 await start(['check','pump']);await sleep(200);
 ok('快速模式預設關閉：沒有倒數條，有「⚡ 快速模式」選項',await E(()=>!document.querySelector('#wordCard .mrq')&&!!document.querySelector('#wordCard select[data-mr="quick"]')&&!store.settings.mrQuick));
 await pg.selectOption('#wordCard select[data-mr="quick"]','2');await sleep(150);
 const q1=await E(()=>({set:store.settings.mrQuick,bar:!!document.querySelector('#wordCard .mrq-bar i'),dur:(document.querySelector('#wordCard .mrq-bar i')||{}).style.animationDuration,pause:!!document.querySelector('[data-mrq="pause"]'),reveal:!!document.querySelector('#wordCard [data-ca="reveal"]')}));
 ok('選 2 秒：記在設定、顯示倒數條（2 秒）和「⏸ 暫停」，還沒翻面',q1.set===2&&q1.bar&&q1.dur==='2s'&&q1.pause&&q1.reveal,JSON.stringify(q1));
 ok('倒數條在手機寬度內（沒有超出畫面）',await noOverflow(pg));
 await pg.waitForFunction(()=>!!document.querySelector('#wordCard .mrq-note'),null,{timeout:10000}).catch(()=>{});
 const t1=await E(()=>({note:(document.querySelector('#wordCard .mrq-note')||{}).textContent||'',zh:!!document.querySelector('#wordCard .mr-zh'),next:!!document.querySelector('#wordCard [data-ca="mr-next"]'),g:!!document.querySelector('#wordCard [data-ca^="g-"]'),st:statusOf('check'),stage:store.reviewStage.check,due:store.reviewDue.check,tom:day(1),weak:mrHas('check'),pool:cardPool.map(x=>x.w),mr:todayLog().mr||0}));
 ok('時間到：自動翻面顯示中文、說明「◐ 再練」、只剩「下一張 →」（不用再評分）',/時間到/.test(t1.note)&&/再練/.test(t1.note)&&t1.zh&&t1.next&&!t1.g,t1.note);
 ok('已熟的字時間到：不降級（仍是已熟、階段不變），下次複習改成明天',t1.st==='known'&&t1.stage===4&&t1.due===t1.tom&&/不會降級/.test(t1.note),JSON.stringify(t1));
 ok('時間到的字放進「意思不熟」、這一組最後再出一次、算進今天意思回想的張數',t1.weak&&t1.pool.join()==='check,pump,check'&&t1.mr===1&&/最後會再出一次/.test(t1.note),t1.pool.join());
 await sleep(400);await pg.click('#wordCard [data-ca="mr-next"]');await sleep(150);
 ok('按「下一張 →」換到下一個字，重新倒數',await E(()=>cardPool[cardIndex].w==='pump'&&!cardReveal&&!!document.querySelector('#wordCard .mrq-bar')));
 /* 時間內翻面：照平常評分，倒數不會再觸發 */
 await sleep(300);await pg.click('#wordCard [data-ca="reveal"]');await sleep(150);
 ok('時間內按「👁 看意思」：照平常顯示三個評分按鈕',await E(()=>document.querySelectorAll('#wordCard [data-ca^="g-"]').length===3&&!document.querySelector('#wordCard .mrq-note')));
 await sleep(2600);
 ok('翻面後倒數不會再觸發（字的狀態沒有被改）',await E(()=>document.querySelectorAll('#wordCard [data-ca^="g-"]').length===3&&statusOf('pump')==='known'&&store.reviewStage.pump===4));
 await sleep(200);await pg.click('#wordCard [data-ca="g-known"]');await sleep(250);
 /* 重出的 check：手動翻面要照平常評分（不是時間到的說明） */
 ok('重出的字是同一組的最後一張，回到倒數狀態',await E(()=>cardPool[cardIndex].w==='check'&&cardIndex===2&&!!document.querySelector('#wordCard .mrq-bar')));
 await sleep(400);await pg.click('#wordCard [data-ca="reveal"]');await sleep(150);
 ok('重出的字手動翻面：顯示評分按鈕（沒有時間到的說明）',await E(()=>document.querySelectorAll('#wordCard [data-ca^="g-"]').length===3));
 await sleep(400);await pg.click('#wordCard [data-ca="g-known"]');await sleep(250);
 const end=await E(()=>(document.querySelector('#wordCard .mr-end')||{}).textContent||'');
 ok('完成畫面列出「⏱ 時間到 1」',/時間到 1/.test(end),end.slice(0,120));
 /* 學習中的字時間到＝學習中（和 ◐ 一樣） */
 await start(['alarm']);await pg.waitForFunction(()=>!!document.querySelector('#wordCard .mrq-note'),null,{timeout:10000}).catch(()=>{});
 ok('學習中的字時間到：記為學習中、明天複習（和按 ◐ 一樣）',await E(()=>statusOf('alarm')==='learning'&&store.reviewDue.alarm===day(1)&&mrHas('alarm')));
 /* 暫停 */
 await sleep(300);await start(['power']);await sleep(300);await pg.click('[data-mrq="pause"]');
 const p0=await E(()=>({t:document.querySelector('[data-mrq="pause"]').textContent,pc:document.querySelector('#wordCard .mrq').classList.contains('paused')}));
 await sleep(3000);
 ok('按「⏸ 暫停」：倒數停止（等超過 2 秒也不翻面），按鈕變成「▶ 繼續」',/繼續/.test(p0.t)&&p0.pc&&await E(()=>!cardReveal&&!document.querySelector('#wordCard .mrq-note')&&statusOf('power')==='learning'&&store.reviewDue.power===day(2)),JSON.stringify(p0));
 await pg.click('[data-mrq="pause"]');await pg.waitForFunction(()=>!!document.querySelector('#wordCard .mrq-note'),null,{timeout:10000}).catch(()=>{});
 ok('按「▶ 繼續」：接著倒數，時間到照樣翻面',await E(()=>!!document.querySelector('#wordCard .mrq-note')&&cardReveal));
 /* 離開單字頁：不觸發 */
 await sleep(300);await start(['cable']);await sleep(200);await pg.click('#navToday');await sleep(3000);
 ok('倒數中離開單字頁：不會在背景翻面或改紀錄',await E(()=>statusOf('cable')==='learning'&&store.reviewDue.cable===day(2)&&!mrHas('cable')));
 await pg.click('#navWords');await sleep(200);
 /* 關掉 */
 await start(['check']);await sleep(150);await pg.selectOption('#wordCard select[data-mr="quick"]','0');await sleep(150);
 ok('選「關」：設定移除、沒有倒數條',await E(()=>!('mrQuick' in store.settings)&&!document.querySelector('#wordCard .mrq')));
 const n=await E(()=>{const a=normStore({settings:{mrQuick:7,hideStreak:'yes'}}).settings,b2=normStore({settings:{mrQuick:3,hideStreak:true}}).settings;return {a:'mrQuick' in a||'hideStreak' in a,b:b2.mrQuick===3&&b2.hideStreak===true}});
 ok('匯入時整理設定：秒數只接受 2／3／5、hideStreak 只接受 true',!n.a&&n.b,JSON.stringify(n));
 ok('沒有 JavaScript 錯誤（快速模式）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== B. 🧩 錯字放回原句 ===== */
{const {ctx,pg,errs,E}=await open();
 const pick=await E(()=>{for(const d of DIALOGS)for(let n=1;n<d.lines.length;n++){const L=d.lines[n];for(const w of ['alarm','temperature','breaker','valve','pressure']){const x=BY_WORD[w];if(x&&ctxCut(x,L.en))return {w,id:'d:'+d.id+':'+n,t:d.t,prev:d.lines[n-1].en,en:L.en}}}return null});
 ok('找到測試用的對話句（含字表裡的字）',!!pick,JSON.stringify(pick));
 await E(()=>{page('quiz');quizResult(BY_WORD.pump,false,'','cloze')});
 const s1=await E(()=>JSON.stringify(store.wrongSrc.pump));
 await E(()=>quizResult(BY_WORD.pump,false,'','en'));
 const s2=await E(()=>store.wrongSrc.pump);
 ok('例句填空答錯：記下出處＝單字例句；之後在「看英文選中文」答錯，保留出處句子、題型更新',/"s":"w:pump"/.test(s1)&&/"q":"cloze"/.test(s1)&&s2.s==='w:pump'&&s2.q==='en'&&!!s2.d,s1+' → '+JSON.stringify(s2));
 /* 對話填空答錯：空格的字放進答錯單字本，出處是那一句 */
 const dm=await E(p=>{const h=dcWordMark(p.w,p.id,false);return {h,n:store.wrongWords[p.w],s:store.wrongSrc[p.w]}},pick);
 ok('對話填空答錯：空格的字放進答錯單字本（還要答對 2 次），出處是那一句',dm.n===2&&dm.s.s===pick.id&&dm.s.q==='dc'&&/放回原句/.test(dm.h),JSON.stringify(dm));
 const dmf=await E(()=>{const n0=Object.keys(store.wrongWords).length;dcWordMark('UPS-2A','d:d01:1',false);dcWordMark('xyzzy','d:d01:1',false);return Object.keys(store.wrongWords).length===n0});
 ok('對話填空的設備編號或字表沒有的字：不放進答錯單字本',dmf);
 /* 錯題本：出處、放回原句按鈕 */
 await E(()=>{save();openWrongBook()});await sleep(300);
 const wb=await E(p=>{const rows=[...document.querySelectorAll('#wrongBody .wb-row')];const r=rows.find(x=>x.querySelector('b').textContent===p.w);return {src:r&&(r.querySelector('.wb-src')||{}).textContent,pump:((rows.find(x=>x.querySelector('b').textContent==='pump')||{}).querySelector||(()=>null)).call(rows.find(x=>x.querySelector('b').textContent==='pump'),'.wb-src')?.textContent,btn:!!document.querySelector('#wrongBody [data-wbgo="wc"]')}},pick);
 ok('錯題本的單字列出出處（對話名稱、單字例句）和「🧩 放回原句」按鈕',wb.btn&&wb.src&&wb.src.includes(pick.t)&&/單字例句/.test(wb.pump||''),JSON.stringify(wb));
 await E(p=>{store.wrongWords={[p.w]:2};save()},pick);
 await pg.click('#wrongBody [data-wbgo="wc"]');await sleep(300);
 const q=await E(()=>({type:document.querySelector('#quizType').value,q:document.querySelector('#quizQ').innerText,blank:!!document.querySelector('#quizQ .blank'),opts:[...document.querySelectorAll('#quizOpts button[data-ok]')].map(b=>b.textContent),okb:(document.querySelector('#quizOpts button[data-ok=true]')||{}).textContent,inp:!!document.querySelector('#cxIn'),play:!!document.querySelector('#quizQ [data-cx="play"]'),prev:!!document.querySelector('#quizQ [data-cx="prev"]')}));
 ok('「🧩 放回原句」：測驗頁出題，題目是答錯的那一句（挖空）、上面有前一句和對話名稱',q.type==='wctx'&&q.blank&&q.q.includes(pick.t)&&q.q.includes(pick.prev)&&q.prev,q.q.slice(0,200));
 ok('有 4 個選項（含答案）、可以直接輸入、有「🔊 播放這一句」',q.opts.length===4&&q.okb===pick.w&&q.inp&&q.play,JSON.stringify(q.opts));
 ok('題目和選項在手機寬度內',await noOverflow(pg));
 await E(()=>{window.__said=[]});await pg.click('#quizQ [data-cx="play"]');await pg.click('#quizQ [data-cx="prev"]');await sleep(100);
 const said=await E(()=>window.__said);
 ok('「🔊 播放這一句」念完整的原句；前一句也可以播放',said[0]===pick.en&&said[1]===pick.prev,JSON.stringify(said));
 await pg.click('#quizOpts button[data-ok=true]');await sleep(200);
 const a1=await E(p=>({n:store.wrongWords[p.w],msg:document.querySelector('#quizMsg').innerHTML,qs:store.qStat['w-ctx'],dis:[...document.querySelectorAll('#quizOpts button,#quizOpts input')].every(x=>x.disabled)}),pick);
 ok('選對：還要答對的次數減 1、顯示完整句子（標出答案）、記在「單字：放回原句」的正確率',a1.n===1&&/<mark>/.test(a1.msg)&&/✅/.test(a1.msg)&&a1.qs[0]===1&&a1.dis,JSON.stringify({n:a1.n,qs:a1.qs}));
 await pg.click('#newQuiz');await sleep(250);await pg.fill('#cxIn','wrongword');await pg.press('#cxIn','Enter');await sleep(200);
 const a2=await E(p=>({n:store.wrongWords[p.w],s:store.wrongSrc[p.w],msg:document.querySelector('#quizMsg').textContent}),pick);
 ok('輸入錯的字：加回 2 次、出處還是那一句、顯示你輸入的字',a2.n===3&&a2.s.s===pick.id&&a2.s.q==='ctx'&&/wrongword/.test(a2.msg),JSON.stringify(a2));
 await pg.click('#newQuiz');await sleep(250);
 const surf=await E(()=>{const t=document.querySelector('#quizMsg');return null});
 const hit=await E(p=>ctxFind(BY_WORD[p.w]).hit,pick);
 await pg.fill('#cxIn',hit.toUpperCase());await pg.click('#cxGo');await sleep(200);
 ok('輸入句子裡的樣子（不分大小寫）也算對',await E(p=>store.wrongWords[p.w]===2&&/✅/.test(document.querySelector('#quizMsg').innerHTML),pick),hit);
 for(let k=0;k<2;k++){await pg.click('#newQuiz');await sleep(200);await pg.click('#quizOpts button[data-ok=true]');await sleep(150)}
 ok('答對到移出答錯單字本時，出處紀錄也一起移除；題目改成「答錯單字本是空的」',await E(p=>!store.wrongWords[p.w]&&!(store.wrongSrc||{})[p.w],pick)&&await (async()=>{await pg.click('#newQuiz');await sleep(200);return /空的/.test(await E(()=>document.querySelector('#quizQ').textContent))})());
 /* 沒有出處的字：用含這個字的對話句或例句 */
 const fb=await E(()=>{store.wrongWords={valve:2,check:2};delete store.wrongSrc;const r=['valve','check'].map(w=>{const c=ctxFind(BY_WORD[w]);return c&&{w,id:c.id,ok:(c.pre+c.hit+c.post).toLowerCase().includes(c.hit.toLowerCase())&&!!c.en}});return r});
 ok('沒有記到出處的字：改用含這個字的 CE 對話句或單字例句（都找得到要挖空的字）',fb.every(x=>x&&x.ok&&/^(d|w|x):/.test(x.id)),JSON.stringify(fb));
 /* 錯題本混合練習也會出放回原句 */
 const mix=await E(()=>{store.lsWrong={};store.sqWrong={};let n=0;const old=Math.random;let t=0;Math.random=()=>{t++;return t%2?0.1:0.3};try{for(let k=0;k<4;k++){wrongMixQuiz();if(/放回原句/.test(document.querySelector('#quizQ').textContent))n++}}finally{Math.random=old}return n});
 ok('錯題本混合練習：單字有時會用放回原句出題',mix>0,mix);
 const nz=await E(()=>{const s=normStore({wrongWords:{pump:2},wrongSrc:{pump:{s:'d:d01:3',q:'en',d:'2026-10-01'},gone:{s:'w:gone',q:'en'},bad:{s:'<x>'},'?':{q:'en'}}});return s.wrongSrc});
 ok('匯入時整理出處：只留還在答錯單字本裡、格式正確的',JSON.stringify(nz)==='{"pump":{"s":"d:d01:3","q":"en","d":"2026-10-01"}}',JSON.stringify(nz));
 ok('沒有 JavaScript 錯誤（放回原句）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== C. 學習天數 ===== */
{const {ctx,pg,errs,E}=await open();
 const sf=await E(()=>{const set=a=>{store.studyDays=a.map(k=>day(k));return streakFlex()};return {
  a:set([0,-1,-2]),b:set([0,-2,-3]),c:set([0,-1,-3,-4,-6]),d:set([-1,-2]),e:set([-2,-3]),f:set([-3,-4]),g:set([0,-2,-9]),h:set([]),i:set([0,-1,-2,-3,-4,-5,-6,-8,-9,-10,-11,-12,-13,-14,-16,-17])}});
 ok('連續天數：每週可以休息 1 天（休息日算在天數裡）；連續兩天沒學或 7 天內休息兩次才重新開始；今天還沒學不算休息',sf.a===3&&sf.b===4&&sf.c===5&&sf.d===2&&sf.e===2&&sf.f===0&&sf.g===3&&sf.h===0&&sf.i===18,JSON.stringify(sf));
 const wd=await E(()=>{store.studyDays=Array.from({length:14},(_,k)=>day(-k));const a=weekDays(),dow=(new Date().getDay()+6)%7;store.studyDays=[day(-dow-1)];return {a,dow,b:weekDays()}});
 ok('本週天數：只算這週（星期一到今天）',wd.a===wd.dow+1&&wd.b===0,JSON.stringify(wd));
 await E(()=>{store.studyDays=[0,-2,-3].map(k=>day(k));save();page('today');renderToday()});
 const t=await E(()=>document.querySelector('#todayBody .today-head').innerText);
 ok('今日頁顯示「本週學了 N／7 天 · 連續 N 天」，沒有「中斷」之類的字',/本週學了 \d／7 天 · 連續 4 天/.test(t)&&!/中斷|斷了|歸零|失去/.test(t),t.replace(/\n/g,' '));
 await pg.click('#navStats');await sleep(300);
 const s1=await E(()=>({card:document.querySelector('#statsBody .stat-cards').innerText,chk:document.querySelector('#streakShow').checked}));
 ok('統計頁：第一張卡是本週學習天數（含連續天數），設定預設是顯示',/本週學習天數/.test(s1.card)&&/連續 4 天/.test(s1.card)&&s1.chk,s1.card.replace(/\n/g,' '));
 await pg.click('#streakShow');await sleep(200);
 const s2=await E(()=>({h:store.settings.hideStreak,card:document.querySelector('#statsBody .stat-cards').innerText,n:document.querySelectorAll('#statsBody .stat-cards > div').length}));
 await pg.click('#navToday');await sleep(200);const t2=await E(()=>({wk:!!document.querySelector('#todayBody .wk-days'),txt:document.querySelector('#todayBody .today-head').innerText}));
 ok('關掉「顯示學習天數」：記在設定，統計頁和今日頁都不顯示本週天數和連續天數',s2.h===true&&!/本週|連續/.test(s2.card)&&s2.n===2&&!t2.wk&&!/本週|連續/.test(t2.txt),JSON.stringify(s2)+' '+t2.txt.replace(/\n/g,' '));
 await pg.reload();await pg.waitForFunction(()=>typeof ALLS!=='undefined',null,{timeout:20000});await sleep(400);await pg.click('#navToday');await sleep(200);
 ok('重新開啟後設定保留',await E(()=>store.settings.hideStreak===true&&!document.querySelector('#todayBody .wk-days')&&!document.querySelector('#streakShow').checked));
 await pg.click('#navStats');await sleep(200);await pg.click('#streakShow');await sleep(200);
 ok('再打開：恢復顯示',await E(()=>!('hideStreak' in store.settings)&&/本週學習天數/.test(document.querySelector('#statsBody .stat-cards').innerText)));
 ok('沒有 JavaScript 錯誤（學習天數）',errs.length===0,errs.join(' | '));await ctx.close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p36.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
