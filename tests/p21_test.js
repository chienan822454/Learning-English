// V5.29.0：複習排程、一鍵今日學習、點字查詢、無線電用語、發音辨別、KK 音標、速度、資料保存、單字頁與統計頁、新內容
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8890);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
async function open(vp,extra){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone']},extra||{}));await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8890/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
/* 在畫面上點某個英文字（用滑鼠座標，跟手指點一樣） */
async function clickWord(pg,sel,word,nth){const p=await pg.evaluate(([sel,word,nth])=>{for(const el of document.querySelectorAll(sel)){if(!el.offsetParent&&el.id!=='english')continue;const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){if(n.parentElement.closest('small'))continue;const m=new RegExp('\\b'+word+'\\b').exec(n.data);if(m){if(nth-->0)continue;el.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+word.length);const q=r.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}}}}return null},[sel,word,nth||0]);if(p){await pg.mouse.click(p.x,p.y);await sleep(250)}return p}
const pop=pg=>pg.evaluate(()=>{const p=document.querySelector('#lkPop');return p&&!p.hidden?{w:(p.querySelector('.lk-w b')||{}).textContent||'',zh:(p.querySelector('.lk-zh')||{}).textContent||'',p:(p.querySelector('.lk-p')||{}).textContent||'',base:(p.querySelector('.lk-base')||{}).textContent||'',said:window.__said.slice(-1)[0]}:null});
const iso=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};

// ---------- A. 複習排程 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const IV=await E(()=>INTERVALS.join(','));
ok('複習間隔延長到 240 天（1、3、7、14、30、60、120、240）',IV==='1,3,7,14,30,60,120,240',IV);
// 30 個到期的字：到期日不同、階段不同
await E(([a,b2])=>{const base=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,30).map(x=>x.w);base.forEach((w,i)=>{store.wordStatus[w]='known';store.reviewDue[w]=i<10?a:b2;store.reviewStage=store.reviewStage||{};store.reviewStage[w]=i===0?6:i===1?6:3});save();window.__base=base},[iso(-5),iso(-1)]);
await pg.click('#navWords');await sleep(300);await pg.click('#reviewStart');await sleep(300);
const Q=await E(()=>({n:cardPool.length,firsts:cardPool.slice(0,10).every(x=>store.reviewDue[x.w]===cardPool[0]&&store.reviewDue[cardPool[0].w]||true),early:cardPool.slice(0,10).map(x=>store.reviewDue[x.w]),kind:window.__cardKind}));
ok('今日複習一次 20 個，最早到期的先出（最久沒複習的 10 個排在最前面）',Q.n===20&&Q.early.every(d=>d===Q.early[0])&&Q.kind==='review',JSON.stringify(Q));
// 「◐ 模糊」：階段 6 → 4，明天複習；「✓ 已熟」：階段 6 → 7（240 天後）
const grade=async a=>{await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="'+a+'"]');await sleep(80)};
const w0=await E(()=>{const w=cardPool[cardIndex].w;store.reviewStage[w]=6;return w});await grade('g-learning');
const w1=await E(()=>{const w=cardPool[cardIndex].w;store.reviewStage[w]=6;return w});await grade('g-known');
const S=await E(([a,b2])=>({a:[store.reviewStage[a],store.reviewDue[a]],b:[store.reviewStage[b2],store.reviewDue[b2]]}),[w0,w1]);
ok('「◐ 模糊」往前退兩級（階段 6 → 4）、明天再複習；「✓ 已熟」階段 6 → 7、240 天後',S.a[0]===4&&S.a[1]===iso(1)&&S.b[0]===7&&S.b[1]===iso(240),JSON.stringify(S));
const lg=await E(()=>{const L=store.dailyLog[day()]||{};return {rok:L.rok,rng:L.rng,review:L.review}});
ok('複習時記得／忘記都有記錄（統計頁的答對率用）',lg.rok===1&&lg.rng===1&&lg.review===2,JSON.stringify(lg));
for(let k=0;k<18;k++)await grade('g-known');
const done=await E(()=>({t:document.querySelector('#wordCard').textContent,more:!!document.querySelector('#wordCard [data-ca="more"]')}));
ok('一組 20 個做完後顯示「🔁 再複習 N 個」（還有 10 個到期，含剛剛按模糊的字明天才到期）',done.more&&/再複習 10 個/.test(done.t)&&/還有 10 個字到期/.test(done.t),done.t.slice(0,80));
await pg.click('#wordCard [data-ca="more"]');await sleep(200);
ok('按「再複習」接著出下一組（10 個）',await E(()=>cardPool.length)===10);
// 每日複習上限
await E(()=>{store.settings.reviewCap=50;const L=store.dailyLog[day()];L.review=50;const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(100,220).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-2)});save()});
await pg.click('#navToday');await sleep(300);
const T=await E(()=>{const t=[...document.querySelectorAll('#todayBody .task')].find(x=>/複習到期單字/.test(x.textContent));return {t:t&&t.textContent,note:(document.querySelector('#todayBody .task-note')||{}).textContent||''}});
ok('每日複習上限：今天已複習 50 個（上限 50）時，複習任務算完成，剩下的明天再複習',/50 \/ 50/.test(T.t)&&/✅/.test(T.t)&&/達到每日上限/.test(T.note),JSON.stringify(T));
await E(()=>{store.dailyLog[day()].review=10;save()});await E(()=>renderToday());
const T2=await E(()=>(document.querySelector('#todayBody .task-note')||{}).textContent||'');
ok('到期太多時提示「今天先複習 40 個」（每日上限可在統計頁調整）',/今天先複習 40 個/.test(T2),T2);
ok('複習排程測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 一鍵今日學習 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,8).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-1);store.wordKnown.push(w)});save();renderToday()});
const btn=await E(()=>(document.querySelector('#todayBody .flow-start')||{}).textContent||'');
ok('今日頁最上方有「▶ 開始今天的學習」（複習 8 → 學新單字 20 → 句子跟讀 → CE 情境題）',/開始今天的學習/.test(btn)&&/複習單字 8 → 學新單字 20 → 句子跟讀 → CE 情境題/.test(btn),btn);
await pg.click('#todayBody .flow-start');await sleep(400);
const F1=await E(()=>({words:!$('#wordPage').hidden,n:cardPool.length,bar:($('#flowBar')||{}).textContent||'',barVis:!!$('#flowBar')&&!$('#flowBar').hidden}));
ok('按下後直接開始第 1 步（複習 8 個），下方出現進度列「今日學習 1／4」',F1.words&&F1.n===8&&F1.barVis&&/今日學習 1／4/.test(F1.bar)&&/複習單字 0／8/.test(F1.bar),JSON.stringify(F1));
for(let k=0;k<8;k++){await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(60)}
await sleep(1300);
const F2=await E(()=>($('#flowBar')||{}).textContent||'');
ok('做完這一步：進度列顯示 ✅ 和「下一步：學新單字 ▶」',/複習單字 8／8 ✅/.test(F2)&&/下一步：學新單字/.test(F2),F2);
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const F3=await E(()=>({n:cardPool.length,st:cardPool.length&&statusOf(cardPool[0].w),bar:$('#flowBar').textContent}));
ok('按「下一步」：打開今日新字（20 個新字）',F3.n===20&&F3.st==='new'&&/今日學習 2／4/.test(F3.bar),JSON.stringify(F3));
// 重新開啟 App：進度列還在、今日頁顯示「繼續」
await pg.reload();await sleep(1200);
const F4=await E(()=>({bar:!!$('#flowBar')&&!$('#flowBar').hidden&&$('#flowBar').textContent,btn:(document.querySelector('#todayBody .flow-start')||{}).textContent||''}));
ok('關掉 App 再打開：進度列還在，今日頁按鈕變成「▶ 繼續今天的學習（第 2／4 步）」',!!F4.bar&&/繼續今天的學習/.test(F4.btn)&&/第 2／4 步：學新單字/.test(F4.btn),JSON.stringify(F4));
await pg.click('#flowBar [data-flow="end"]');await sleep(300);
const F5=await E(()=>({vis:!!$('#flowBar')&&!$('#flowBar').hidden,ls:localStorage.getItem('e5k_flow'),btn:(document.querySelector('#todayBody .flow-start')||{}).textContent||''}));
ok('按 ✕ 結束：進度列關閉，按鈕回到「▶ 開始今天的學習」',!F5.vis&&F5.ls===null&&/開始今天的學習/.test(F5.btn),JSON.stringify(F5));
ok('今日學習測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 點字查詢 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(300);
await E(()=>{const u=$('#unit');u.value='all';u.onchange&&u.onchange();i=0;filter();render()});
await clickWord(pg,'#english','morning');
let P=await pop(pg);
ok('句子頁：點英文字 morning → 跳出中文、音標，並唸出單字',P&&P.w==='morning'&&/早/.test(P.zh)&&/mɔrnɪŋ/.test(P.p)&&P.said==='morning',JSON.stringify(P));
await pg.mouse.click(10,200);await sleep(200);
ok('點畫面其他地方：查詢視窗關閉',await pop(pg)===null);
// 對話：詞形、兩個字的 CE 用語、中文顯示
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');
await pg.click('.dlg-card[data-d="d40"]');await sleep(300);
await clickWord(pg,'.dlg-en','locked');P=await pop(pg);
const zhShown=await E(()=>{const l=[...document.querySelectorAll('.dlg-line')].find(x=>/locked out/.test(x.textContent));return l&&!l.querySelector('.dlg-zh').hidden});
ok('對話：點 locked → 顯示 locked 和原形 lock，那一句的中文也顯示出來',P&&P.w==='locked'&&/lock/.test(P.base)&&zhShown,JSON.stringify(P)+' zh '+zhShown);
await clickWord(pg,'.dlg-en','valves');
const zhStill=await E(()=>{const l=[...document.querySelectorAll('.dlg-line')].find(x=>/locked out/.test(x.textContent));return l&&!l.querySelector('.dlg-zh').hidden});
P=await pop(pg);
ok('同一句再點另一個字（valves → valve）：中文保持顯示，不會收起來',P&&/valve/.test(P.w+P.base)&&zhStill,JSON.stringify(P));
await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d21"]');await sleep(300);
{const pt=await E(()=>{for(const el of document.querySelectorAll('.dlg-en')){const n=el.firstChild;if(!n||n.nodeType!==3)continue;const k=n.data.indexOf('load bank');if(k<0)continue;el.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+4);const q=r.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}}return null});if(pt){await pg.mouse.click(pt.x,pt.y);await sleep(250)}}P=await pop(pg);
ok('兩個字的 CE 用語：點 load bank 的 load → 顯示 load bank（假負載）',P&&P.w==='load bank'&&/假負載/.test(P.zh),JSON.stringify(P));
await clickWord(pg,'.dlg-en','transferring');P=await pop(pg);
ok('單字表沒有的詞形（transferring）也找得到原形 transfer',P&&/transfer/.test(P.w),JSON.stringify(P));
// 加入複習
const nw=await E(()=>{delete store.wordStatus.stable;store.wordKnown=store.wordKnown.filter(w=>w!=='stable');return statusOf('stable')});
await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d21"]');await sleep(300);
await clickWord(pg,'.dlg-en','stable');
const rb=await E(()=>{const b=document.querySelector('#lkPop [data-lk="rev"]');return b&&b.textContent});
await pg.click('#lkPop [data-lk="rev"]');await sleep(200);
const after=await E(()=>({st:statusOf('stable'),due:store.reviewDue.stable,btn:document.querySelector('#lkPop [data-lk="rev"]').textContent}));
ok('查詢視窗「＋ 加入複習」：新字改成學習中、明天複習',nw==='new'&&/加入複習/.test(rb)&&after.st==='learning'&&after.due===iso(1)&&/明天複習/.test(after.btn),JSON.stringify([nw,rb,after]));
// 單字卡例句
await pg.click('#navWords');await sleep(300);await E(()=>openCards([BY_WORD.close]));await sleep(200);
const ex=await E(()=>BY_WORD.close.ex);const ew=(ex.match(/[A-Za-z]{4,}/g)||[]).find(w=>w.toLowerCase()!=='close');
await clickWord(pg,'#wordCard .card-ex .en',ew);P=await pop(pg);
ok('單字卡的例句也可以點字查詢（'+ew+'）',!!P&&P.w.length>0,JSON.stringify(P));
ok('點字查詢測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 無線電用語 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');
const card=await E(()=>!!document.querySelector('.radio-card'));
await pg.click('.radio-card');await sleep(300);
const R1=await E(()=>({abc:[...document.querySelectorAll('.abc-grid button')].map(b=>b.querySelector('b').textContent+b.querySelector('span').textContent),pro:document.querySelectorAll('.dlg-keys .dlg-key').length,code:$('#rdCode').textContent}));
ok('對話頁有「📻 無線電用語」：字母代碼 A–Z 26 個（Alpha…Zulu）、常用說法 16 個',card&&R1.abc.length===26&&R1.abc[0]==='AAlpha'&&R1.abc[1]==='BBravo'&&R1.abc[25]==='ZZulu'&&new Set(R1.abc.map(x=>x[0])).size===26&&R1.pro===16,JSON.stringify(R1).slice(0,200));
await pg.click('.abc-grid button:nth-child(4)');await sleep(100);
ok('點字母 D → 唸出 Delta',await E(()=>window.__said.slice(-1)[0])==='Delta');
await pg.click('#rdHear');await sleep(150);
const R2=await E(()=>({code:$('#rdCode').textContent,said:window.__said.slice(-1)[0],sp:$('#rdSpell').textContent,exp:rdSpelled($('#rdCode').textContent)}));
ok('唸唸看：「聽正確唸法」用字母代碼拼出設備代號（例：'+R2.code+' → '+R2.said+'）',/^[A-Z]{3,4}-(\d[A-D]|[A-D]\d|0\d)$/.test(R2.code)&&R2.said===R2.exp&&R2.sp.includes(R2.exp),JSON.stringify(R2));
// 測驗：20 題
await pg.click('#rdQuiz');await sleep(300);

const chk=await E(()=>{let okc=0,tot=0;for(let k=0;k<30;k++){radioQuiz();const o=[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent),s=window.__said.slice(-1)[0];const m=o.filter(c=>/-/.test(c)?rdSpoken(c)===s:s.includes(' '+parseInt(c,10)+' '));tot++;if(new Set(o).size===4&&m.length===1)okc++}return [okc,tot]});
ok('聽代號測驗：每題 4 個不同的選項，只有一個和唸出來的內容相符（設備代號用字母代碼、數字練 15／50 這類 -teen／-ty）',chk[0]===chk[1],JSON.stringify(chk));
await pg.click('#quizOpts button');await sleep(150);
const st=await E(()=>({msg:$('#quizMsg').textContent,stat:(store.qStat||{}).radio}));
ok('作答後顯示正確答案和唸法；統計頁「無線電代號與數字」有記錄',/答對了|正確答案/.test(st.msg)&&Array.isArray(st.stat)&&st.stat[0]+st.stat[1]>=1,JSON.stringify(st).slice(0,160));
// 句子頁：無線電用語 30 句
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.radio-card');await sleep(200);await pg.click('#rdPractice');await sleep(400);
const U=await E(()=>({u:$('#unit').value,n:pool.length,src:cur().src,lab:$('#unit option[value="radio"]').textContent}));
ok('「用 🎤 練習無線電句子」：句子頁切到「📻 無線電用語（30）」',U.u==='radio'&&U.n===30&&U.src==='radio'&&/30/.test(U.lab),JSON.stringify(U));
ok('無線電用語測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 發音辨別、KK 音標 ----------
{const {ctx,pg,errs,E}=await open();
const PW=await E(()=>PAIRS.every(p=>WMAP[p[0]]&&WMAP[p[1]]&&WMAP[p[0]].zh&&WMAP[p[1]].zh&&p[0]!==p[1])&&PAIRS.length);
ok('發音辨別：'+PW+' 組（th／s、l／n、r／l、v／b、ship／sheep…），每個字都在單字表、有中文',PW>=40,String(PW));
await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','pairs');await sleep(300);
const P1=await E(()=>({o:[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent),s:window.__said.slice(-1)[0]}));
ok('出題：唸出其中一個字，選項是那一組的兩個字',P1.o.length===2&&P1.o.includes(P1.s),JSON.stringify(P1));
await pg.click('#quizOpts button');await sleep(150);
const P2=await E(()=>({t:$('#quizMsg').textContent,n:document.querySelectorAll('#quizMsg [data-psay]').length}));
await pg.click('#quizMsg [data-psay]');await sleep(100);
ok('作答後兩個字並排顯示音標、中文，各有 🔊 可以比較',P2.n===2&&/\//.test(P2.t)&&await E(()=>PAIRS.flat().includes(window.__said.slice(-1)[0])),JSON.stringify(P2).slice(0,160));
const KK=await E(()=>['ˈθərti','ˈməni','ˈeɪʤənt','ðə','kəˈrɛkt','ˈoʊvər','bət','wərk','ˈloʊd ˌbæŋk','ɪnˈʤɔɪ'].map(phonKK));
ok('KK 音標轉換：thirty ˋθɝtɪ、money ˋmʌnɪ、agent ˋedʒənt、the ðə、correct kəˋrɛkt、over ˋovɚ、but bʌt、work wɝk、load bank ˋlod ˏbæŋk、enjoy ɪnˋdʒɔɪ',KK.join(',')==='ˋθɝtɪ,ˋmʌnɪ,ˋedʒənt,ðə,kəˋrɛkt,ˋovɚ,bʌt,wɝk,ˋlod ˏbæŋk,ɪnˋdʒɔɪ',KK.join(','));
await pg.click('#navStats');await sleep(300);await pg.selectOption('#phonSel','kk');await sleep(100);
await pg.click('#navWords');await sleep(300);await pg.fill('#wordSearch','thirty');await sleep(400);
const k1=await E(()=>document.querySelector('#wordRows .word-card small').textContent);
await pg.reload();await sleep(1200);
const k2=await E(()=>({set:store.settings.phon,sel:$('#phonSel').value}));
await pg.click('#navStats');await sleep(200);await pg.selectOption('#phonSel','ipa');await sleep(100);await pg.click('#navWords');await sleep(300);await pg.fill('#wordSearch','thirty');await sleep(400);
const k3=await E(()=>document.querySelector('#wordRows .word-card small').textContent);
ok('統計頁改成 KK：單字清單顯示 KK（重新開啟後也記得），改回 IPA 就顯示 IPA',/ˋθɝtɪ/.test(k1)&&k2.set==='kk'&&k2.sel==='kk'&&/ˈθərti/.test(k3),JSON.stringify([k1,k2,k3]));
ok('發音辨別與 KK 測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. 速度 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navQuiz');await sleep(200);
const sp=await E(()=>{$('#quizType').value='word';$('#quizBook').value='all';$('#quizMode').value='en';wordQuiz();const t=performance.now();for(let k=0;k<10;k++)wordQuiz();return {ms:Math.round(performance.now()-t),cached:WORDS.filter(x=>x._zs).length}});
ok('測驗出題：每個字的中文義項只算一次（出 10 題 '+sp.ms+' ms）',sp.cached>=4500&&sp.ms<400,JSON.stringify(sp));
const same=await E(()=>{const C=WORDS.filter(x=>x.k===7&&!x.b),seen=new Set(C.map(x=>x.w.toLowerCase())),ce=C.map((x,k)=>[x.w,x.w.toLowerCase(),k,0]);/* V5.34.0：CE 縮寫的全名（work order ← WO）也算，排在縮寫的位置；多字 CE 字最後一個字的複數也算 */C.forEach((x,k)=>{const m=x.acr&&/（([A-Za-z][^）；，]*)/.exec(x.zh||''),e=m?m[1].toLowerCase().replace(/[^a-z0-9-]/g,' ').split(' ').filter(Boolean).join(' '):'';if(e.includes(' ')&&!seen.has(e)){seen.add(e);ce.push([e,e,k,1])}});ce.sort((a,b)=>a[2]-b[2]||a[3]-b[3]);ce.forEach(c=>{const p=c[1].split(' '),z=p.pop();c[1]=[c[1]].concat(p.length?[z+'s',z+'es'].concat(/[^aeiou]y$/.test(z)?[z.slice(0,-1)+'ies']:[]).map(v=>p.concat(v).join(' ')):[]).map(v=>' '+v+' ')});let diff=0,tot=0;const ds=dlgSentences();DIALOGS.forEach(d=>d.lines.forEach((L,n)=>{const low=' '+L.en.toLowerCase().replace(/[^a-z0-9-]/g,' ')+' ';const old=kwDedupe(ce.filter(c=>c[1].some(v=>low.includes(v))).map(c=>c[0])).slice(0,2);const nw=ds.find(s=>s.id==='d:'+d.id+':'+n).keys;tot++;if(old.some((k,j)=>nw[j]!==k))diff++}));return [diff,tot]});
ok('對話句的 CE 關鍵字改用較快的做法，結果和原本相同（'+same[1]+' 句；V5.32.0 起去掉被長關鍵字包含的字，再補上其他關鍵字）',same[0]===0,JSON.stringify(same));
ok('速度測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 資料保存（iPhone 提示、Android 保留資料） ----------
{const iUA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const {ctx,pg,errs,E}=await open({width:390,height:844},{userAgent:iUA});
const t1=await E(()=>!!document.querySelector('#todayBody .ios-tip')&&/加入主畫面/.test(document.querySelector('#todayBody .ios-tip').textContent));
await pg.click('#todayBody [data-go="iostip"]');await sleep(200);
const t2=await E(()=>({tip:!!document.querySelector('#todayBody .ios-tip'),set:store.settings.iosTip,today:day()}));
await E(()=>{store.settings.iosTip=day(-31);renderToday()});
const t3=await E(()=>!!document.querySelector('#todayBody .ios-tip'));
await pg.click('#todayBody [data-go="iostipnever"]');await sleep(200);
const t4=await E(()=>({tip:!!document.querySelector('#todayBody .ios-tip'),set:store.settings.iosTip}));
ok('iPhone 用 Safari 開（沒加到主畫面）：今日頁提示「加入主畫面」；按「知道了」30 天內不再出現，「不再提醒」就不出現',t1&&!t2.tip&&t2.set===t2.today&&t3&&!t4.tip&&t4.set==='never',JSON.stringify([t1,t2,t3,t4]));
ok('iPhone 測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const aUA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const ctx=await b.newContext({viewport:{width:390,height:844},userAgent:aUA});await ctx.addInitScript(()=>{window.__persist=0;speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5);if(navigator.storage){navigator.storage.persisted=()=>Promise.resolve(false);navigator.storage.persist=()=>{window.__persist++;return Promise.resolve(true)}}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://localhost:8890/');await sleep(1200);
const a=await pg.evaluate(()=>({p:window.__persist,tip:!!document.querySelector('#todayBody .ios-tip')}));
ok('Android：開啟時請瀏覽器保留學習紀錄（不會被自動清除）；不顯示 iPhone 提示',a.p===1&&!a.tip,JSON.stringify(a));
ok('Android 測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- H. 單字頁、統計頁 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navWords');await sleep(400);
const innerH=await E(()=>innerHeight);
const L=await E(()=>{const nav=document.querySelector('nav').getBoundingClientRect().top,c=[...document.querySelectorAll('#wordRows .word-card')];return {first:Math.round(c[0].getBoundingClientRect().top),full:c.filter(e=>e.getBoundingClientRect().bottom<=nav).length,panel:$('#wfPanel').hidden,tog:$('#wfToggle').textContent}});
ok('單字頁：主題、狀態、只學原形、每日新字收進「篩選」，第一張卡在畫面上方 30% 以內，一個畫面完整看到 4 張卡（V5.33.1 起不寫死像素：各手機的中文字型高度不同）',L.first<=Math.round(innerH*0.3)&&L.full>=4&&L.panel&&/篩選/.test(L.tog),JSON.stringify(Object.assign({lim:Math.round(innerH*0.3)},L)));
await pg.click('#wfToggle');await sleep(150);
const vis=await E(()=>['#wordTopic','#wordState','#skipVar','#dailyGoal'].every(s=>{const e=document.querySelector(s);return e&&e.getBoundingClientRect().height>0}));
await pg.selectOption('#wordTopic','el');await sleep(300);
const mk=await E(()=>({t:$('#wfToggle').textContent,on:$('#wfToggle').classList.contains('on')}));
await pg.selectOption('#wordTopic','all');await sleep(200);
const mk2=await E(()=>$('#wfToggle').textContent);
ok('按「篩選」展開；選了主題後按鈕顯示「篩選 ●」，改回全部就恢復',vis&&mk.on&&/●/.test(mk.t)&&/▾/.test(mk2),JSON.stringify([vis,mk,mk2]));
await pg.selectOption('#dailyGoal','30');await sleep(100);
ok('每日新字數量在篩選裡調整，照常記住（30）',await E(()=>store.settings.dailyGoal)===30);
// 統計頁：未來 7 天、答對率、每日複習上限
await E(([a,b2])=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,12).map(x=>x.w);ws.forEach((w,i)=>{store.wordStatus[w]='known';store.reviewDue[w]=i<5?a:b2});store.dailyLog=store.dailyLog||{};const L=store.dailyLog[day()]=store.dailyLog[day()]||{};L.rok=9;L.rng=3;save()},[iso(0),iso(2)]);
await pg.click('#navStats');await sleep(400);
const S=await E(()=>({rows:[...document.querySelectorAll('.fc-row')].map(r=>r.textContent),acc:[...document.querySelectorAll('#statsBody h3')].some(h=>/複習答對率/.test(h.textContent)),bar:document.querySelector('#statsBody').textContent.includes('9 / 12')}));
ok('統計頁：未來 7 天要複習（今天單字 5、後天單字 7）、單字複習答對率（9 / 12）',S.rows.length===7&&/單字 5/.test(S.rows[0])&&/單字 7/.test(S.rows[2])&&S.acc&&S.bar,JSON.stringify(S).slice(0,240));
await pg.selectOption('#reviewCapSel','200');await sleep(100);await pg.reload();await sleep(1200);
ok('每日複習上限的設定會記住（200）',await E(()=>[store.settings.reviewCap,$('#reviewCapSel').value].join())==='200,200');
ok('單字頁與統計頁測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- I. 新內容 ----------
{const {ctx,pg,errs,E}=await open();
const C=await E(()=>{const ce=WORDS.filter(x=>x.k===7);const nw=ce.filter(x=>x.r>7539);const z=new Map();ce.forEach(x=>z.set(x.zh,(z.get(x.zh)||0)+1));
 return {ce:ce.length,nw:nw.length,acr:nw.filter(x=>x.acr).every(x=>/（[A-Za-z].+）/.test(x.zh)),ex:nw.every(x=>x.ex&&x.exz&&x.p&&x.zh&&x.t&&x.t.length),dupZh:[...z.values()].filter(v=>v>1).length,has:['changeover','rollback','walk-down','undervoltage','N+1','ESD','JSA','CPR','load shedding','stop-work authority'].filter(w=>!BY_WORD[w])}});
ok('CE 專業字 +'+C.nw+'（共 '+C.ce+' 個）：每個都有音標、中文、例句、主題；縮寫附英文全名；中文不重複',C.nw>=80&&C.ex&&C.acr&&C.dupZh===0&&C.has.length===0,JSON.stringify(C));
const DQ=await E(()=>{const nd=DIALOGS.filter(d=>+d.id.slice(1)>40&&+d.id.slice(1)<=50);const nq=SITQ.filter(q=>+q.id.slice(1)>120);const a=[0,0,0,0];nq.forEach(q=>a[q.ans]++);
 return {dl:DIALOGS.length,nd:nd.length,lines:nd.every(d=>d.lines.length===12&&d.keys.every(k=>d.lines.some(l=>l.en.includes(k.en)))),sq:SITQ.length,nq:nq.length,ans:a.sort().join(','),photo:nd.every(d=>d.lines.every(l=>!/photo|picture|camera|video/i.test(l.en)))}});
ok('情境對話 40 → 50 段（有人昏倒、電池室冒煙、EPO 虛驚、停工、JSA、上架、稽核、網路中斷、需量、雷擊），每段 12 句、重點句型都在對話裡；沒有拍照內容',DQ.dl>=50&&DQ.nd===10&&DQ.lines&&DQ.photo,JSON.stringify(DQ));
ok('CE 情境題 120 → 150 題（含無線電用語 6 題），新題答案位置平均（7／7／8／8）',DQ.sq===150&&DQ.nq===30&&DQ.ans==='7,7,8,8',JSON.stringify(DQ));
await pg.waitForFunction(()=>typeof EX2_READY==='undefined'||EX2_READY,null,{timeout:20000}).catch(()=>{});
const X=await E(()=>{const T=WORDS.filter(x=>x.toeic);const bad=T.filter(x=>{if(!x.ex2||!x.exz2)return true;const n=(x.ex2.match(/[A-Za-z0-9'’+-]+/g)||[]).length;return n<12||n>18});return {t:T.length,n2:T.filter(x=>x.ex2).length,bad:bad.slice(0,5).map(x=>x.w),unit:ALLS.filter(s=>s.src==='word2').length}});
ok('多益 '+X.t+' 字都有第二個較長的職場例句（12–18 字），句子頁有「📖 多益長例句」',X.n2===X.t&&X.bad.length===0&&X.unit===X.t,JSON.stringify(X));
await pg.click('#navWords');await sleep(300);await E(()=>openCards([BY_WORD[WORDS.find(x=>x.toeic&&x.ex2).w]]));await sleep(200);
const cardEx=await E(()=>({lbl:!!document.querySelector('#wordCard .ex2b .lbl'),en:(document.querySelector('#wordCard .ex2b .en')||{}).textContent,mark:!!document.querySelector('#wordCard .ex2b mark')}));
await pg.click('#wordCard [data-ca="ex2"]');await sleep(100);
ok('單字卡顯示「📖 多益例句」（單字有標出來），可以播放',cardEx.lbl&&cardEx.mark&&await E(()=>window.__said.slice(-1)[0])===cardEx.en,JSON.stringify(cardEx).slice(0,160));
ok('新內容測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p21.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
