// V5.33.0：🧠 意思回想卡（會念、聽得懂發音，卻想不起中文意思的字）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8898);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 /* 版面檢查用：文字實際排成幾行（只看最後一段文字：按鈕裡圖示在上、文字在下）、文字和背景的對比 */
 window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};
 window.__tlines=el=>{const t=[...el.childNodes].filter(n=>n.nodeType===3&&n.data.trim()).pop();if(!t)return 0;const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(t);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};
 window.__canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
 window.__contrast=el=>{const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};let bg=null;for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0.5){bg=c;break}}bg=bg||{r:255,g:255,b:255};const fg=rgb(getComputedStyle(el).color);const a=lum(fg),z=lum(bg);return Math.round((Math.max(a,z)+0.05)/(Math.min(a,z)+0.05)*10)/10}};
async function open(vp,extra,route,noWait,init){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone'],acceptDownloads:true},extra||{}));await ctx.addInitScript(init||stub);if(route)await route(ctx);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8898/');await sleep(900);if(!noWait)await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
const iso=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
/* 學習紀錄：[單字, 狀態, 階段, 下次複習（幾天後；null＝沒有排程）] */
const setW=(pg,L)=>pg.evaluate(L=>{store.reviewStage=store.reviewStage||{};for(const [w,st,sg,due] of L){store.wordStatus[w]=st;store.reviewStage[w]=sg;if(due==null)delete store.reviewDue[w];else store.reviewDue[w]=day(due);store.wordKnown=store.wordKnown.filter(x=>x!==w);if(st==='known')store.wordKnown.push(w)}save()},L);
const words=(pg,k,n,skip)=>pg.evaluate(([k,n,s])=>WORDS.filter(x=>!x.b&&x.k===k&&/^[a-z]+$/.test(x.w)&&x.w.length>=3).slice(s||0,(s||0)+n).map(x=>x.w),[k,n,skip]);
const card=pg=>pg.evaluate(()=>{const c=$('#wordCard');return {mr:c.classList.contains('mr-mode'),hidden:c.hidden,txt:c.innerText,w:cardPool[cardIndex]&&cardPool[cardIndex].w,i:cardIndex,n:cardPool.length,pool:cardPool.map(x=>x.w),rv:cardReveal,said:window.__said.slice(-1)[0],g:[...c.querySelectorAll('[data-ca^="g-"]')].map(x=>x.textContent.trim())}});
const reveal=async pg=>{await pg.evaluate(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="reveal"]');await sleep(100)};
/* 意思回想評分：先翻面再按 ✓／◐／✗（known／learning／new） */
const mrGrade=async(pg,g)=>{await reveal(pg);await pg.evaluate(()=>{window.__cardAt=0});await pg.click(`#wordCard [data-ca="g-${g}"]`);await sleep(100)};
const bar=pg=>pg.evaluate(()=>{const e=document.getElementById('flowBar');return e&&!e.hidden?e.textContent:''});
const IMP='p29_import.json';
async function imp(pg,obj){fs.writeFileSync(IMP,JSON.stringify(obj));await pg.click('#navStats');await sleep(300);await pg.setInputFiles('#bkImport',IMP);await pg.waitForLoadState('load');await sleep(1600);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});fs.rmSync(IMP,{force:true})}

// ---------- A. 單字頁入口（還沒有學習紀錄） ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navWords');await sleep(400);
const A1=await E(()=>{const bs=[...document.querySelectorAll('#wordPage .v5-actions button')];const nav=document.querySelector('nav').getBoundingClientRect().top,c=[...document.querySelectorAll('#wordRows .word-card')],va=$('#wordPage .v5-actions').getBoundingClientRect(),ws=[...document.querySelectorAll('#wordPage .word-stats button')].filter(x=>x.offsetParent);return {t:bs.map(x=>x.textContent.trim()),top:[...new Set(bs.map(x=>Math.round(x.getBoundingClientRect().top)))],h:bs.map(x=>Math.round(x.getBoundingClientRect().height)),fit:bs.every(x=>x.scrollWidth<=x.clientWidth+1),vaH:Math.round(va.height),gap:Math.round(c[0].getBoundingClientRect().top-va.bottom),wsRows:new Set(ws.map(x=>Math.round(x.getBoundingClientRect().top))).size,wsN:ws.length,full:c.filter(e=>e.getBoundingClientRect().bottom<=nav).length,chip:$('#wordPage .word-stats [data-st="meanweak"]').hidden,opt:$('#wordState option[value="meanweak"]').textContent,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth}});
ok('單字頁有「🧠 意思回想」按鈕，和「🆕 今日新字」「🔁 今日複習」「🃏 單字卡」排在同一排；四個按鈕高度至少 40px，文字沒有超出按鈕',JSON.stringify(A1.t)===JSON.stringify(['🆕 今日新字','🔁 今日複習','🃏 單字卡','🧠 意思回想'])&&A1.top.length===1&&A1.h.every(h=>h>=40)&&A1.fit&&A1.ovw<=0,JSON.stringify(A1));
ok('還沒有「意思不熟」的字：不顯示「🧠 意思不熟」小按鈕，數字列還是一排 4 個；按鈕列只有一排，單字清單緊接在下面（中間沒有多出東西），一個畫面看得到 4 張卡；篩選裡有「🧠 意思不熟（0）」',A1.chip&&A1.wsN===4&&A1.wsRows===1&&A1.vaH<=Math.max(...A1.h)+1&&A1.gap>=0&&A1.gap<=12&&A1.full>=4&&A1.opt==='🧠 意思不熟（0）',JSON.stringify(A1));
await pg.click('#meanStart');await sleep(300);
const A2=await card(pg);
await pg.click('#wordCard [data-ca="mr-new"]');await sleep(300);
const A3=await card(pg);
ok('還沒有學過任何字時按「🧠 意思回想」：說明「目前沒有可以回想意思的字」；按「🆕 今日新字」打開一般的新字卡',A2.mr&&A2.n===0&&/目前沒有可以回想意思的字/.test(A2.txt)&&!/undefined|NaN/.test(A2.txt)&&!A3.mr&&A3.n===20&&/先想意思，再點我看中文/.test(A3.txt),JSON.stringify([A2.txt.slice(0,40),A3.n,A3.mr]));
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 出哪些字：到期的先，再出學過的字；套用冊別與主題 ----------
{const {ctx,pg,errs,E}=await open();
const W1=await words(pg,1,40,0),W2=await words(pg,2,3,0);
const due=W1.slice(0,5),lrn=W1.slice(5,11),kn=W1.slice(11,21),weak=W1[21];
await setW(pg,[[due[0],'known',2,-3],[due[1],'known',3,-1],[due[2],'known',2,-2],[due[3],'learning',1,0],[due[4],'known',1,-1],
 ...lrn.map((w,k)=>[w,'learning',0,1+(k%3)]),...kn.map((w,k)=>[w,'known',3,5+k]),[weak,'known',4,30],...W2.map(w=>[w,'known',2,10])]);
await E(([w,d])=>{store.meanWeak={[w]:{n:1,last:d,ok:0}};save()},[weak,iso(-2)]);
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);
const B1=await card(pg);
const st=await E(p=>p.map(w=>statusOf(w)+'|'+(store.reviewDue[w]||'')),B1.pool);
const kd=B1.pool.slice(12).map(w=>st[B1.pool.indexOf(w)].split('|')[1]);
ok('按「🧠 意思回想」：一次 20 個；到期的字先出（最早到期的先、同一天階段低的先），再出意思不熟、學習中、已熟（下次複習日早的先）；不會出現沒學過的新字',
 B1.mr&&B1.n===20&&JSON.stringify(B1.pool.slice(0,5))===JSON.stringify([due[0],due[2],due[4],due[1],due[3]])&&B1.pool[5]===weak&&B1.pool.slice(6,12).every(w=>lrn.includes(w))&&B1.pool.slice(12).every(w=>kn.includes(w)||W2.includes(w))&&kd.every((d,k)=>!k||kd[k-1]<=d)&&!st.some(s=>/^new/.test(s)),JSON.stringify({pool:B1.pool,st}));
ok('卡片上方標示「🧠 意思回想 1 / 20」和冊別、狀態（已到期）',/^🧠 意思回想 1 \/ 20 · #\d+ · 第 1 冊.* · 已熟 · 已到期/.test(B1.txt),B1.txt.split('\n')[0]);
await pg.click('#wordCard [data-ca="list"]');await sleep(200);
await pg.click('#bookChips [data-b="2"]');await sleep(300);await pg.click('#meanStart');await sleep(300);
const B2=await card(pg);
const tp=await E(w=>BY_WORD[w].t[0],kn[0]);
await pg.click('#wordCard [data-ca="list"]');await pg.click('#bookChips [data-b="all"]');await sleep(200);
await pg.click('#wfToggle');await pg.selectOption('#wordTopic',tp);await sleep(300);await pg.click('#meanStart');await sleep(300);
const B3=await card(pg);
const want3=await E(([t,all])=>all.filter(w=>(BY_WORD[w].t||[]).includes(t)),[tp,[...due,...lrn,...kn,weak,...W2]]);
ok('套用單字頁的範圍：選「第 2 冊」只出第 2 冊學過的 3 個字；選主題只出這個主題學過的字（最多 20 個）',B2.n===3&&B2.pool.every(w=>W2.includes(w))&&B3.n===Math.min(20,want3.length)&&B3.n>0&&B3.pool.every(w=>want3.includes(w)),JSON.stringify({B2:B2.pool,tp,B3:B3.pool,want3}));
await pg.click('#wordCard [data-ca="list"]');await pg.selectOption('#wordTopic','all');await pg.click('#bookChips [data-b="5"]');await sleep(300);await pg.click('#meanStart');await sleep(300);
const B4=await card(pg),msg=await E(()=>({t:$('#wordBackupMsg').textContent,h:$('#wordBackupMsg').hidden}));
ok('選的冊別（第 5 冊）還沒有學過的字：改出其他冊別學過的字，並說明',B4.n===20&&B4.pool.every(w=>[...due,...lrn,...kn,weak,...W2].includes(w))&&!msg.h&&/還沒有學過的字，先出其他冊別學過的字/.test(msg.t),JSON.stringify([B4.n,msg]));
await pg.click('#wordCard [data-ca="list"]');await pg.click('#bookChips [data-b="all"]');await sleep(200);await pg.click('#meanStart');await sleep(300);
const first=(await card(pg)).pool;
for(let k=0;k<20;k++)await mrGrade(pg,'known');
const B5=await card(pg);
await pg.click('#wordCard [data-ca="mr-more"]');await sleep(300);
const B6=await card(pg);
ok('做完 20 個：「🧠 再回想 5 個」只出今天還沒回想過的 5 個字',/再回想 5 個/.test(B5.txt)&&B6.mr&&B6.n===5&&B6.pool.every(w=>!first.includes(w)),JSON.stringify({B5:B5.txt.slice(0,120),B6:B6.pool}));
ok('B 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 卡片：先聽、先說中文，再翻面 ----------
{const {ctx,pg,errs,E}=await open();
await setW(pg,[['go','known',2,-5],['open','learning',0,1]]);
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(400);
const x=await E(()=>({w:'go',zh:BY_WORD.go.zh,ex:BY_WORD.go.ex,exz:BY_WORD.go.exz}));
const C1=await E(()=>{const c=$('#wordCard');return {txt:c.innerText,big:(c.querySelector('.big')||{}).textContent,phon:!!c.querySelector('.phon'),ex:!!c.querySelector('.card-ex'),rels:!!c.querySelector('.rels'),grade:c.querySelectorAll('[data-ca^="g-"]').length,ask:(c.querySelector('.mr-ask')||{}).textContent,rv:(c.querySelector('[data-ca="reveal"]')||{}).textContent,said:window.__said.slice(-1)[0],auto:!!c.querySelector('[data-ca="auto"]')}});
ok('卡片出現就自動念出單字；顯示拼字和音標，中文意思、例句、例句中文、相關字（詞形）都先藏起來；提示「先說出中文意思，再翻面」，還不能評分',C1.said==='go'&&C1.big==='go'&&C1.phon&&!C1.txt.includes(x.zh)&&!C1.txt.includes(x.exz)&&!C1.ex&&!C1.rels&&C1.grade===0&&C1.ask==='先說出中文意思，再翻面'&&C1.rv==='👁 看意思'&&!C1.auto,JSON.stringify(C1));
const big=await E(()=>{const e=$('#wordCard [data-ca="reveal"]').getBoundingClientRect();return {h:Math.round(e.height),w:Math.round(e.width),cw:Math.round($('#wordCard').getBoundingClientRect().width)}});
await reveal(pg);
const C2=await E(()=>{const c=$('#wordCard');return {txt:c.innerText,zh:(c.querySelector('.mr-zh')||{}).textContent,big:(c.querySelector('.big')||{}).textContent,en:(c.querySelector('.card-ex .en')||{}).textContent,zhx:(c.querySelector('.card-ex .zhx')||{}).textContent,rels:(c.querySelector('.rels')||{}).textContent||'',g:[...c.querySelectorAll('[data-ca^="g-"]')].map(b=>b.dataset.ca+'='+b.textContent.trim()),order:[...c.children].map(e=>e.className).join(','),said:window.__said.slice(-1)[0]}});
ok('大大的「👁 看意思」（高度至少 48px、和卡片內容一樣寬）；翻面後顯示中文意思、拼字、例句和例句中文、詞形，並再念一次',big.h>=48&&big.w>=big.cw-40&&C2.zh===x.zh&&C2.big==='go'&&C2.en===x.ex&&C2.zhx===x.exz&&/詞形/.test(C2.rels)&&C2.said==='go',JSON.stringify({big,C2}));
ok('翻面後才有三個評分按鈕「✗ 想不起來」「◐ 有點印象」「✓ 想得起來」，放在中文意思的正下方',JSON.stringify(C2.g)===JSON.stringify(['g-new=✗ 想不起來','g-learning=◐ 有點印象','g-known=✓ 想得起來'])&&/reveal mr-zh,card-actions grade mr-grade/.test(C2.order),JSON.stringify(C2.g)+' '+C2.order);
await pg.evaluate(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(150);
const C3=await card(pg);
ok('評分後換下一張：自動念出下一個字，又回到「先說出中文意思」',C3.w==='open'&&C3.said==='open'&&!C3.rv&&/先說出中文意思/.test(C3.txt),JSON.stringify(C3));
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 只聽發音（不看拼字） ----------
{const {ctx,pg,errs,E}=await open();
const W=await words(pg,1,6,40);
await setW(pg,W.map((w,k)=>[w,'known',2,-1-k]));
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);
await pg.click('#wordCard [data-mr="ear"]');await sleep(300);
const hid=()=>E(()=>{const c=$('#wordCard'),w=cardPool[cardIndex].w,re=new RegExp('\\b'+w+'\\b','i');return {w,set:store.settings.mrEar,saved:JSON.parse(localStorage.getItem('english5000v5')||'{}').settings,shown:re.test(c.innerText),ipa:BY_WORD[w].p&&c.innerText.includes(phon(BY_WORD[w].p)),big:!!c.querySelector('.big'),spk:!!c.querySelector('.mr-earbig'),chk:c.querySelector('[data-mr="ear"]').checked,said:window.__said.slice(-1)[0],hint:(c.querySelector('.mr-earhint')||{}).textContent||''}});
const D1=await hid();
ok('勾選「只聽發音（不看拼字）」：看不到拼字和音標，改成大的 🔊 按鈕，並自動念出單字；設定存在 store.settings.mrEar',D1.set===true&&D1.chk&&!D1.shown&&!D1.ipa&&!D1.big&&D1.spk&&D1.said===D1.w&&/聽發音，想想中文意思/.test(D1.hint),JSON.stringify(D1));
await E(()=>{window.__said=[]});await pg.click('#wordCard .mr-earbig');await sleep(100);
const D2=await E(()=>window.__said.slice());
await reveal(pg);
const D3=await E(()=>{const c=$('#wordCard'),w=cardPool[cardIndex].w;return {big:(c.querySelector('.big')||{}).textContent,zh:(c.querySelector('.mr-zh')||{}).textContent===BY_WORD[w].zh,w}});
ok('按大的 🔊 再念一次；按「👁 看意思」後才顯示拼字和中文',D2.length===1&&D2[0]===D1.w&&D3.big===D3.w&&D3.zh,JSON.stringify([D2,D3]));
await pg.evaluate(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(150);
const D4=await hid();
await pg.reload();await sleep(1000);await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);
const D5=await hid();
ok('下一張和重新開啟 App 後仍是「只聽發音」',!D4.shown&&D4.spk&&D5.set===true&&D5.saved.mrEar===true&&D5.chk&&!D5.shown&&D5.spk,JSON.stringify([D4,D5]));
await pg.click('#wordCard [data-mr="ear"]');await sleep(300);
const D6=await hid();
ok('取消勾選：馬上顯示拼字，設定刪除（回到預設）',D6.shown&&D6.big&&!D6.spk&&D6.set===undefined&&!('mrEar' in D6.saved),JSON.stringify(D6));
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// 沒有朗讀功能的瀏覽器（LINE 等 App 內建瀏覽器）：只聽發音改成顯示拼字
{const {ctx,pg,errs,E}=await open(null,null,null,false,()=>{try{delete window.speechSynthesis;delete window.SpeechSynthesisUtterance}catch(e){}Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined,configurable:true})});
const W=await words(pg,1,3,50);
await setW(pg,W.map(w=>[w,'known',1,-1]));await E(()=>{store.settings.mrEar=true;save()});
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(400);
const D7=await E(()=>{const c=$('#wordCard');return {tts:TTS_OK,big:(c.querySelector('.big')||{}).textContent,w:cardPool[cardIndex].w,note:(c.querySelector('.mr-note')||{}).textContent||''}});
ok('瀏覽器沒有朗讀功能時，「只聽發音」改成顯示拼字並說明原因（不會只剩一張空白卡）',!D7.tts&&D7.big===D7.w&&/不能朗讀英文，先顯示拼字/.test(D7.note),JSON.stringify(D7));
ok('沒有朗讀功能時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 評分和一般單字卡完全一樣（複習排程、今日複習數） ----------
{const {ctx,pg,errs,E}=await open();
const W=await words(pg,1,6,60),A=W.slice(0,3),B2=W.slice(3);
const init=[['known',3,-2],['learning',1,-1],['known',2,6]];
await setW(pg,[...A.map((w,k)=>[w,...init[k]]),...B2.map((w,k)=>[w,...init[k]])]);
const snap=()=>E(()=>{const L=todayLog();return {review:L.review||0,rok:L.rok||0,rng:L.rng||0,mr:L.mr||0,newc:L.new||0}});
const s0=await snap();
await pg.click('#navWords');await sleep(300);
await E(a=>mrStart(a.map(w=>BY_WORD[w]),'btn'),A);await sleep(200);
for(const g of ['known','learning','new'])await mrGrade(pg,g);
const s1=await snap();
await E(a=>openCards(a.map(w=>BY_WORD[w])),B2);await sleep(200);
const n1=await card(pg);
for(const g of ['known','learning','new']){await E(()=>{window.__cardAt=0});await pg.click(`#wordCard [data-ca="g-${g}"]`);await sleep(100)}
const s2=await snap();
const res=await E(([A,B])=>A.map((w,k)=>{const v=x=>[statusOf(x),(store.reviewStage||{})[x],store.reviewDue[x]].join('|');return [v(w),v(B[k])]}),[A,B2]);
ok('「✓ 想得起來／◐ 有點印象／✗ 想不起來」和一般單字卡的「✓ 已熟／◐ 模糊／✗ 不熟」結果一模一樣（狀態、複習階段、下次複習日）',res.every(([p,q])=>p===q)&&res[0][0]===['known',4,iso(30)].join('|')&&res[1][0]===['learning',0,iso(1)].join('|')&&res[2][0]===['new',0,iso(0)].join('|'),JSON.stringify(res));
ok('今日的複習數、記得／忘記的統計也一樣（到期的 2 個：複習 +2、記得 +1、忘記 +1）；意思回想另外記今天評分 3 張，一般單字卡不記',s1.review-s0.review===2&&s1.rok-s0.rok===1&&s1.rng-s0.rng===1&&s2.review-s1.review===2&&s2.rok-s1.rok===1&&s2.rng-s1.rng===1&&s1.mr===3&&s2.mr===3&&!n1.mr&&s2.newc===s0.newc,JSON.stringify([s0,s1,s2]));
// 連點兩下
await setW(pg,W.map(w=>[w,'known',2,-1]));
await E(a=>mrStart(a.map(w=>BY_WORD[w]),'btn'),W);await sleep(400);
await reveal(pg);await sleep(400);
const before=await E(()=>JSON.stringify(todayLog()));
await pg.dblclick('#wordCard [data-ca="g-known"]');await sleep(300);
const E3=await E(()=>({i:cardIndex,rv:cardReveal,mr:todayLog().mr,zh:$('#wordCard').innerText.includes(BY_WORD[cardPool[cardIndex].w].zh)}));
ok('評分按鈕連點兩下：只評分這一張；下一張不會被直接翻開（中文仍然藏著）',E3.i===1&&!E3.rv&&E3.mr===JSON.parse(before).mr+1&&!E3.zh,JSON.stringify([E3,before]));
ok('E 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. 意思不熟清單：◐／✗ 加入，連續兩次 ✓ 才移出 ----------
{const {ctx,pg,errs,E}=await open();
const W=await words(pg,1,8,70),w=W[0];
await setW(pg,W.map((x,k)=>[x,'known',2,-1-k]));
await pg.click('#navWords');await sleep(300);
const one=async g=>{await E(x=>mrStart([BY_WORD[x]],'btn'),w);await sleep(150);await mrGrade(pg,g);return E(x=>store.meanWeak&&store.meanWeak[x]?JSON.parse(JSON.stringify(store.meanWeak[x])):null,w)};
const f1=await one('new'),f2=await one('known'),f3=await one('learning'),f4=await one('known'),f5=await one('known');
ok('「✗ 想不起來」加入意思不熟（次數 1、今天）；之後 ✓ 一次還在；中間按「◐ 有點印象」要重新算（次數 2）；連續兩次 ✓ 才移出',JSON.stringify(f1)===JSON.stringify({n:1,last:iso(0),ok:0})&&JSON.stringify(f2)===JSON.stringify({n:1,last:iso(0),ok:1})&&JSON.stringify(f3)===JSON.stringify({n:2,last:iso(0),ok:0})&&f4&&f4.ok===1&&f5===null,JSON.stringify([f1,f2,f3,f4,f5]));
const g0=await E(x=>{mrStart([BY_WORD[x]],'btn');return 1},W[1]);await sleep(150);await mrGrade(pg,'known');
const F2=await E(x=>!!(store.meanWeak||{})[x],W[1]);
await E(a=>openCards(a.map(x=>BY_WORD[x])),[W[2],W[3]]);await sleep(150);
for(const g of ['new','learning']){await E(()=>{window.__cardAt=0});await pg.click(`#wordCard [data-ca="g-${g}"]`);await sleep(100)}
const F3=await E(a=>a.map(x=>!!(store.meanWeak||{})[x]),[W[2],W[3]]);
ok('「✓ 想得起來」不會加入；一般單字卡的「✗ 不熟」「◐ 模糊」也不會加入意思不熟（只算意思回想）',!F2&&F3.every(v=>!v),JSON.stringify([F2,F3]));
// 單字頁的「🧠 意思不熟（N）」
await E(a=>{mrStart(a.map(x=>BY_WORD[x]),'btn')},W.slice(2,7));await sleep(150);
for(const g of ['new','learning','new','known','learning'])await mrGrade(pg,g);
await pg.click('#wordCard [data-ca="list"]');await sleep(300);
const weakW=[W[2],W[3],W[4],W[6]];
const F4=await E(()=>{const c=$('#wordPage .word-stats [data-st="meanweak"]');return {hid:c.hidden,t:c.textContent,opt:$('#wordState option[value="meanweak"]').textContent,n:Object.keys(store.meanWeak).length}});
ok('單字頁出現「🧠 意思不熟（4）」小按鈕；篩選選單也是「🧠 意思不熟（4）」',!F4.hid&&F4.t==='🧠 意思不熟（4）'&&F4.opt==='🧠 意思不熟（4）'&&F4.n===4,JSON.stringify(F4));
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(300);
const F5=await E(()=>({st:$('#wordState').value,on:$('#wordPage .word-stats [data-st="meanweak"]').classList.contains('on'),cnt:$('#wordCount').textContent,rows:[...document.querySelectorAll('#wordRows .word-card')].map(e=>e.dataset.w),ban:($('#wordRows .mr-banner')||{}).textContent||'',first:$('#wordRows').firstElementChild.className,tog:$('#wfToggle').textContent}));
ok('點「🧠 意思不熟（4）」：清單只列出這 4 個字；清單上方說明「🧠 意思不熟 4 個」並有「▶ 回想這 4 個」',F5.st==='meanweak'&&F5.on&&F5.cnt==='4'&&F5.rows.length===4&&F5.rows.every(x=>weakW.includes(x))&&/🧠 意思不熟 4 個/.test(F5.ban)&&/▶ 回想這 4 個/.test(F5.ban)&&F5.first==='mr-banner'&&/●/.test(F5.tog),JSON.stringify(F5));
await pg.click('#wordRows [data-mr="list"]');await sleep(300);
const F6=await card(pg);
ok('按「▶ 回想這 4 個」：直接用意思回想練這 4 個字（到期的先）',F6.mr&&F6.n===4&&F6.pool.every(x=>weakW.includes(x)),JSON.stringify(F6.pool));
await pg.click('#wordCard [data-ca="list"]');await sleep(200);
await pg.click('#meanStart');await sleep(300);
const F7=await card(pg);
await pg.click('#wordCard [data-ca="list"]');await sleep(200);
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(300);
const F8=await E(()=>({st:$('#wordState').value,hid:$('#wordPage .word-stats [data-st="meanweak"]').hidden,cnt:+$('#wordCount').textContent}));
ok('看「意思不熟」清單時按「🧠 意思回想」也只練這些字；再點一次小按鈕回到全部（小按鈕還在）',F7.n===4&&F7.pool.every(x=>weakW.includes(x))&&F8.st==='all'&&!F8.hid&&F8.cnt>4,JSON.stringify([F7.pool,F8]));
// 都移出後
await E(a=>{a.forEach(x=>{delete store.meanWeak[x]});save()},weakW);
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(300);
const F9=await E(()=>({hid:$('#wordPage .word-stats [data-st="meanweak"]').hidden,t:$('#wordRows').textContent}));
await pg.click('#meanStart');await sleep(300);const F10=await card(pg);
ok('意思不熟的字都移出後：清單說明「目前這個範圍沒有「意思不熟」的字」；這時按「🧠 意思回想」改出學過的字',!F9.hid&&/目前這個範圍沒有「意思不熟」的字/.test(F9.t)&&F10.mr&&F10.n>0,JSON.stringify([F9,F10.n]));
ok('F 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 完成畫面 ----------
{const {ctx,pg,errs,E}=await open();
const W=await words(pg,1,25,90);
await setW(pg,W.map((x,k)=>[x,'known',2,k<6?-1:k]));
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);
const pat=['known','learning','new','new','new','known','learning','known','known','known','known','known','known','known','known','known','known','known','known','known'];
for(const g of pat)await mrGrade(pg,g);
const G1=await E(()=>{const c=$('#wordCard');return {txt:c.innerText,btn:[...c.querySelectorAll('button')].map(b=>b.dataset.ca+'='+b.textContent.trim()),sum:[...c.querySelectorAll('.mr-sum span')].map(s=>s.textContent)}});
ok('一組做完：顯示 ✓ 想得起來 15、◐ 有點印象 2、✗ 想不起來 3，和意思不熟的字數（5 個）',JSON.stringify(G1.sum)===JSON.stringify(['✓ 想得起來 15','◐ 有點印象 2','✗ 想不起來 3'])&&/意思不熟的字：5 個/.test(G1.txt),JSON.stringify(G1));
ok('完成畫面的按鈕：「🧠 再回想 5 個」「🧠 練意思不熟的 5 個」「返回列表」',JSON.stringify(G1.btn)===JSON.stringify(['mr-more=🧠 再回想 5 個','mr-weak=🧠 練意思不熟的 5 個','list=返回列表']),JSON.stringify(G1.btn));
await pg.click('#wordCard [data-ca="mr-weak"]');await sleep(300);
const G2=await card(pg),G2s=await E(()=>$('#wordState').value);
const weak=await E(()=>Object.keys(store.meanWeak));
for(let k=0;k<5;k++)await mrGrade(pg,'known');
const G3=await E(()=>({btn:[...$('#wordCard').querySelectorAll('button')].map(b=>b.textContent.trim()),ok:Object.values(store.meanWeak).map(v=>v.ok)}));
ok('按「🧠 練意思不熟的 5 個」：清單切到「🧠 意思不熟」並只練這 5 個；做完可以「再練意思不熟的 5 個」（這次 ✓ 一次，還沒移出）',G2.mr&&G2.n===5&&G2.pool.every(x=>weak.includes(x))&&G2s==='meanweak'&&G3.btn[0]==='🧠 再練意思不熟的 5 個'&&G3.ok.every(v=>v===1),JSON.stringify([G2.pool,G3]));
await pg.click('#wordCard [data-ca="mr-more"]');await sleep(300);
for(let k=0;k<5;k++)await mrGrade(pg,'known');
const G4=await E(()=>({txt:$('#wordCard').innerText,n:Object.keys(store.meanWeak).length,btn:[...$('#wordCard').querySelectorAll('button')].map(b=>b.textContent.trim())}));
ok('再練一次都 ✓：5 個都移出意思不熟，完成畫面說明「這次有 5 個連續兩次 ✓，已移出」',G4.n===0&&/這次有 5 個連續兩次 ✓，已移出/.test(G4.txt)&&JSON.stringify(G4.btn)===JSON.stringify(['返回列表']),JSON.stringify(G4));
await pg.click('#wordCard [data-ca="list"]');await sleep(200);
// 一般單字卡不受影響（先回到全部的字）
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(200);
await pg.click('#cardMode');await sleep(300);
const G5=await E(()=>{const c=$('#wordCard');return {mr:c.classList.contains('mr-mode'),rv:(c.querySelector('[data-ca="reveal"]')||{}).textContent,g:[...c.querySelectorAll('[data-ca^="g-"]')].map(b=>b.textContent),auto:!!c.querySelector('[data-ca="auto"]'),ear:!!c.querySelector('[data-mr="ear"]')}});
ok('用過意思回想後，「🃏 單字卡」還是一般單字卡（👁 先想意思、✗ 不熟／◐ 模糊／✓ 已熟、▶ 自動播放）',!G5.mr&&G5.rv==='👁 先想意思，再點我看中文'&&JSON.stringify(G5.g)===JSON.stringify(['✗ 不熟','◐ 模糊','✓ 已熟'])&&G5.auto&&!G5.ear,JSON.stringify(G5));
ok('G 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- H. 今日學習：⚙️ 調整今日學習加上「🧠 意思回想」 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,8).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-1);store.wordKnown.push(w)});WORDS.filter(x=>!x.b&&x.k===2).slice(0,20).forEach((x,k)=>{store.wordStatus[x.w]='known';store.reviewDue[x.w]=day(5+k)});save();renderToday()});
const H0=await E(()=>({plan:JSON.stringify(flowPlan()),cfg:'flowCfg' in store.settings,btn:$('#todayBody .flow-start').textContent}));
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
const H1=await E(()=>{const s=$('#todayBody select[data-fc="mr"]');return {row:s&&s.closest('.fcg-row').querySelector('span').textContent,v:s&&s.value,opts:s&&[...s.options].map(o=>o.value+'='+o.textContent),sel:[...document.querySelectorAll('#todayBody select[data-fc]')].map(s=>s.dataset.fc).join(','),est:$('#todayBody .fcg-est').textContent}});
ok('沒有調整時今日學習和原本一樣（複習 8 → 新字 20 → 句子跟讀 → CE 情境題，約 12 分鐘）；「⚙️ 調整今日學習」多了「🧠 意思回想」：不做／10 個／20 個，預設「不做」',H0.plan==='[{"k":"review","n":8},{"k":"new","n":20},{"k":"sent","n":5},{"k":"situ","n":1}]'&&!H0.cfg&&/約 12 分鐘/.test(H0.btn)&&H1.row==='🧠 意思回想'&&H1.v==='0'&&JSON.stringify(H1.opts)===JSON.stringify(['0=不做','10=10 個','20=20 個'])&&H1.sel==='rev,mr,new,ph,sent,fr,radio,situ,rp,zf'&&/預估約 12 分鐘/.test(H1.est),JSON.stringify([H0,H1]));
await pg.selectOption('#todayBody select[data-fc="mr"]','10');await sleep(150);
const H2=await E(()=>({cfg:JSON.stringify(store.settings.flowCfg),plan:flowPlan().map(s=>s.k+s.n).join(','),est:$('#todayBody .fcg-est').textContent,btn:$('#todayBody .flow-start').textContent,t:$('#todayBody .fcg-t').textContent}));
ok('選「10 個」：複習之後、新字之前多一步「意思回想 10」；預估時間每張約 12 秒（12 → 14 分鐘）；按鈕立刻更新',H2.cfg==='{"mr":10}'&&H2.plan==='review8,mr10,new20,sent5,situ1'&&/預估約 14 分鐘：複習單字 8 → 意思回想 10 → 學新單字 20 → 句子跟讀 → CE 情境題/.test(H2.est)&&/複習單字 8 → 意思回想 10 → 學新單字 20 → 句子跟讀 → CE 情境題，約 14 分鐘/.test(H2.btn)&&/●/.test(H2.t),JSON.stringify(H2));
await pg.click('#todayBody .fcg-btns [data-go="flowcfg"]');await sleep(200);
await pg.click('#todayBody .flow-start');await sleep(400);
for(let k=0;k<8;k++){await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(40)}
await sleep(1300);const H3=await bar(pg);
await pg.click('#flowBar [data-flow="next"]');await sleep(500);
const H4=await E(()=>({page:!$('#wordPage').hidden,mr:$('#wordCard').classList.contains('mr-mode'),n:cardPool.length,bar:$('#flowBar').textContent,said:window.__said.slice(-1)[0],w:cardPool[0]&&cardPool[0].w}));
ok('第 1 步複習做完顯示「下一步：意思回想」；第 2 步打開 10 張意思回想卡（今日學習 2／5，說出中文意思再翻面）',/複習單字 8／8 ✅/.test(H3)&&/下一步：意思回想/.test(H3)&&H4.page&&H4.mr&&H4.n===10&&H4.said===H4.w&&/今日學習 2／5/.test(H4.bar)&&/說出中文意思再翻面/.test(H4.bar)&&/🧠 意思回想 0／10/.test(H4.bar),JSON.stringify([H3,H4]));
for(const g of ['known','learning','new'])await mrGrade(pg,g);
await sleep(1300);const H5=await bar(pg);
const at=await E(()=>({i:cardIndex,w:cardPool[cardIndex].w,pool:cardPool.map(x=>x.w).join()}));
await pg.click('#navToday');await sleep(300);await pg.click('#flowBar [data-flow="go"]');await sleep(400);
const H6=await E(()=>({page:!$('#wordPage').hidden,i:cardIndex,w:cardPool[cardIndex].w,pool:cardPool.map(x=>x.w).join(),mr:$('#wordCard').classList.contains('mr-mode'),vis:!$('#wordCard').hidden}));
ok('進度＝在意思回想評分的張數（3／10）；換頁後按「回到這一步」回到同一組、同一張卡',/🧠 意思回想 3／10/.test(H5)&&H6.page&&H6.vis&&H6.mr&&H6.i===at.i&&H6.w===at.w&&H6.pool===at.pool,JSON.stringify([H5,at,H6]));
for(let k=0;k<7;k++)await mrGrade(pg,'known');
await sleep(1300);const H7=await bar(pg);
const H7c=await card(pg);
await pg.click('#flowBar [data-flow="next"]');await sleep(500);
const H8=await E(()=>({mr:$('#wordCard').classList.contains('mr-mode'),n:cardPool.length,st:statusOf(cardPool[0].w),bar:$('#flowBar').textContent,log:todayLog().mr}));
ok('評分 10 張：「🧠 意思回想 10／10 ✅」、下一步：學新單字；下一步打開一般的新字卡（20 個）',/🧠 意思回想 10／10 ✅/.test(H7)&&/下一步：學新單字/.test(H7)&&/這一組意思回想完成了/.test(H7c.txt)&&!H8.mr&&H8.n===20&&H8.st==='new'&&/今日學習 3／5/.test(H8.bar)&&H8.log===10,JSON.stringify([H7,H8]));
await E(()=>flowEnd());await pg.click('#navToday');await sleep(300);
const H9=await E(()=>flowPlan().map(s=>s.k+s.n).join(','));
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
await pg.selectOption('#todayBody select[data-fc="mr"]','20');await sleep(150);
const H10=await E(()=>flowPlan().map(s=>s.k+s.n).join(','));
await pg.selectOption('#todayBody select[data-fc="mr"]','0');await sleep(150);
const H11=await E(()=>({cfg:'flowCfg' in store.settings,t:$('#todayBody .fcg-t').textContent,plan:flowPlan().map(s=>s.k).join(',')}));
ok('今天已經在意思回想評分 10 張：設定 10 個時不再排這一步、設定 20 個時只排剩下的 10 張；改回「不做」刪除設定（和原本一樣）',!/mr/.test(H9)&&/^(review\d+,)?mr10,new20/.test(H10)&&!H11.cfg&&!/●/.test(H11.t)&&!/mr/.test(H11.plan),JSON.stringify([H9,H10,H11]));
ok('H 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// 還沒有學過的字：不排意思回想
{const {ctx,pg,errs,E}=await open();
await E(()=>{store.settings.flowCfg={mr:10};save();renderToday()});
const H12=await E(()=>({plan:flowPlan().map(s=>s.k+s.n).join(','),btn:$('#todayBody .flow-start').textContent,nothing:flowNothing('mr')}));
ok('還沒有學過任何字：就算設定了意思回想 10 個，今日學習也不排這一步（不會卡住）',H12.plan==='new20,sent5,situ1'&&!/意思回想/.test(H12.btn)&&H12.nothing,JSON.stringify(H12));
ok('沒有學過的字時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- I. 例句還沒下載好（data-ex.js 延後載入）、下載失敗 ----------
{const {ctx,pg,errs,E}=await open(null,{serviceWorkers:'block'},async c=>{await c.route('**/data-ex.js',async r=>{await new Promise(z=>setTimeout(z,7000));await r.continue().catch(()=>{})})},true);
const W=await words(pg,1,3,120);
await setW(pg,W.map(w=>[w,'known',1,-1]));
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);await reveal(pg);
const I1=await E(()=>({ready:EX_READY,txt:$('#wordCard').innerText,zh:($('#wordCard .mr-zh')||{}).textContent===BY_WORD[cardPool[0].w].zh,ex:!!$('#wordCard .card-ex'),g:document.querySelectorAll('#wordCard [data-ca^="g-"]').length}));
ok('例句還沒下載好：翻面照常顯示中文和評分按鈕，說明「例句還在下載」，不會出現 undefined',!I1.ready&&I1.zh&&!I1.ex&&I1.g===3&&/例句還在下載/.test(I1.txt)&&!/undefined|NaN/.test(I1.txt),JSON.stringify(I1));
await pg.waitForFunction(()=>EX_READY,null,{timeout:20000}).catch(()=>{});
await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(150);await reveal(pg);
const I2=await E(()=>({ready:EX_READY,en:($('#wordCard .card-ex .en')||{}).textContent,want:BY_WORD[cardPool[cardIndex].w].ex,zhx:($('#wordCard .card-ex .zhx')||{}).textContent}));
ok('例句下載好之後，下一張卡翻面就有例句和例句中文',I2.ready&&!!I2.want&&I2.en===I2.want&&!!I2.zhx,JSON.stringify(I2));
ok('例句延後下載時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E}=await open(null,{serviceWorkers:'block'},async c=>{await c.route('**/data-ex.js',r=>r.abort())},true);
const W=await words(pg,1,3,130);
await setW(pg,W.map(w=>[w,'known',1,-1]));
await pg.waitForFunction(()=>EX_FAIL,null,{timeout:25000}).catch(()=>{});
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(300);await reveal(pg);
const I3=await E(()=>({fail:EX_FAIL,txt:$('#wordCard').innerText,g:document.querySelectorAll('#wordCard [data-ca^="g-"]').length}));
ok('例句下載失敗（離線、網路不穩）：意思回想照常可以用，說明「例句沒有下載完成」',I3.fail&&I3.g===3&&/例句沒有下載完成/.test(I3.txt)&&!/undefined|NaN/.test(I3.txt),JSON.stringify(I3));
ok('例句下載失敗時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- J. 備份匯出 → 匯入：新欄位都保留；被竄改的值整理掉 ----------
{const {ctx,pg,errs,E}=await open();
const W=await words(pg,1,4,140);
const G0=await E(W=>{store.meanWeak={[W[0]]:{n:2,last:day(-3),ok:1},[W[1]]:{n:1,last:day(),ok:0}};store.settings.mrEar=true;store.settings.flowCfg={mr:20};store.dailyLog={[day()]:{mr:7,review:3}};store.studyDays=[day()];W.forEach(w=>{store.wordStatus[w]='learning';store.reviewDue[w]=day(1)});save();return __canon({mw:store.meanWeak,ear:store.settings.mrEar,cfg:store.settings.flowCfg,log:store.dailyLog})},W);
await pg.click('#navStats');await sleep(300);
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
const G1=await E(x=>__canon({mw:x.meanWeak,ear:x.settings.mrEar,cfg:x.settings.flowCfg,log:x.dailyLog}),ex.progress);
await E(()=>{delete store.meanWeak;delete store.settings.mrEar;delete store.settings.flowCfg;store.dailyLog={};save()});
await imp(pg,ex);
const G2=await E(()=>__canon({mw:store.meanWeak,ear:store.settings.mrEar,cfg:store.settings.flowCfg,log:store.dailyLog}));
ok('匯出的備份檔包含意思不熟清單、只聽發音設定、今日學習的意思回想張數、今天評分的張數；匯入後全部還原',G1===G0&&G2===G0,JSON.stringify([G0,G1,G2]).slice(0,700));
const X='<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const bad=JSON.parse(JSON.stringify(ex));
bad.progress.meanWeak=JSON.parse(JSON.stringify({[X]:{n:1,last:iso(0),ok:0},[W[0]]:'x',[W[1]]:{n:'abc',last:'bad',ok:5},[W[2]]:{n:3.7,last:iso(-2),ok:1},[W[3]+X]:{n:1}}).replace('{','{"__proto__":{"n":1},'));
bad.progress.settings.mrEar='yes';bad.progress.settings.flowCfg={mr:15,sent:10};bad.progress.dailyLog={[iso(0)]:{mr:'x',review:2},[iso(-1)]:{mr:'4'}};
await imp(pg,bad);
await pg.click('#navWords');await sleep(300);await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(300);await pg.click('#meanStart');await sleep(300);await reveal(pg);
const G3=await E(([w])=>({x:window.__xss||0,mw:__canon(store.meanWeak),proto:Object.getPrototypeOf(store.meanWeak)===Object.prototype,ear:'mrEar' in store.settings,cfg:JSON.stringify(store.settings.flowCfg),log:JSON.stringify(store.dailyLog),chip:$('#wordPage .word-stats [data-st="meanweak"]').textContent,txt:document.body.innerText}),[W]);
ok('匯入被竄改的備份檔：意思不熟清單只留下合法的字和欄位（次數、日期、連續 ✓ 修正），只聽發音、意思回想張數的錯誤值丟掉；畫面不會執行任何程式碼',G3.x===0&&G3.mw===await E(o=>__canon(o),{[W[1]]:{n:1,last:iso(0),ok:0},[W[2]]:{n:3,last:iso(-2),ok:1}})&&G3.proto&&!G3.ear&&G3.cfg==='{"sent":10}'&&G3.log===JSON.stringify({[iso(0)]:{review:2},[iso(-1)]:{mr:4}})&&G3.chip==='🧠 意思不熟（2）'&&!/undefined|NaN|<img/.test(G3.txt),JSON.stringify(G3).slice(0,700));
ok('J 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- K. 小手機（360×640）＋特大字＋深色模式：按鈕不被底部選單、今日學習進度列蓋住 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
const W=await words(pg,1,30,160);
await setW(pg,W.map((x,k)=>[x,k%3?'known':'learning',2,k<8?-1:k]));
await E(W=>{store.meanWeak={[W[1]]:{n:2,last:day(-1),ok:0},[W[2]]:{n:1,last:day(),ok:0}};store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme();save()},W);
await pg.click('#navWords');await sleep(400);
const vis=sel=>E(sel=>{const vw=document.documentElement.clientWidth,lim=bottomLimit(),out=[];for(const el of document.querySelectorAll(sel)){if(!el.offsetParent)continue;const r=el.getBoundingClientRect();out.push({t:el.textContent.trim().slice(0,12),l:Math.round(r.left),r:Math.round(r.right),top:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height),lines:__tlines(el)||__lines(el),fit:el.scrollWidth<=el.clientWidth+1,c:__contrast(el)})}return {vw,lim:Math.round(lim),ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,out}},sel);
const inView=(m,minH=40)=>m.ovw<=0&&m.out.length>0&&m.out.every(x=>x.l>=0&&x.r<=m.vw&&x.h>=minH&&x.fit&&x.lines===1&&x.c>=4.5);
const K1=await vis('#wordPage .v5-actions button, #wordPage .word-stats [data-st="meanweak"]');
ok('單字頁（小手機＋特大字＋深色）：四個按鈕仍在同一排、高度至少 40px、文字一行沒有超出；「🧠 意思不熟（2）」也在畫面內；深色對比足夠；沒有左右捲動',inView(K1)&&new Set(K1.out.filter(x=>!/意思不熟/.test(x.t)).map(x=>x.top)).size===1&&K1.out.length===5,JSON.stringify(K1));
await pg.click('#meanStart');await sleep(400);
const cardChk=()=>vis('#wordCard .mr-reveal, #wordCard .mr-ear-t, #wordCard .card-actions button, #wordCard .mr-earbig');
const K2=await cardChk();const rv=K2.out.find(x=>/看意思/.test(x.t));
const K2c=await E(()=>['.mr-ask','.mr-tag','.mr-ear-t','.meta'].map(s=>{const e=$('#wordCard '+s);return s+':'+(e?__contrast(e):0)}));
ok('意思回想卡：「👁 看意思」整個在底部選單上面；「只聽發音」、🔊、上一字／下一字等按鈕高度至少 40px、在畫面內、文字一行；提示文字深色對比足夠',inView(K2)&&rv&&rv.top>=0&&rv.b<=K2.lim&&K2c.every(s=>+s.split(':')[1]>=4.5),JSON.stringify([K2,K2c]));
await reveal(pg);
const K3=await vis('#wordCard .mr-grade button'),K3e=await vis('#wordCard .card-ex .exbtn button');
const K3z=await E(()=>{const z=$('#wordCard .mr-zh').getBoundingClientRect();return {top:Math.round(z.top),c:__contrast($('#wordCard .mr-zh'))}});
ok('翻面後：中文意思和三個評分按鈕都在畫面上、不被底部選單蓋住；評分按鈕和例句的 💬／🐢 按鈕高度至少 40px、文字一行',inView(K3)&&K3.out.length===3&&K3.out.every(x=>x.top>=0&&x.b<=K3.lim)&&K3z.top>=0&&K3z.c>=4.5&&inView(K3e)&&K3e.out.length>=2,JSON.stringify([K3,K3z,K3e]));
await E(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));await sleep(200);
const K4=await E(()=>{const r=[...document.querySelectorAll('#wordCard .card-actions')].pop().getBoundingClientRect();return {b:Math.round(r.bottom),lim:Math.round(bottomLimit())}});
ok('捲到最下面：最後一排按鈕（上一字／列表／下一字）在底部選單上面，按得到',K4.b<=K4.lim,JSON.stringify(K4));
await pg.click('#wordCard [data-mr="ear"]');await sleep(300);
/* 翻開的卡片照樣顯示拼字；換到下一張才是只聽發音 */
await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="next"]');await sleep(300);
const K5=await vis('#wordCard .mr-earbig, #wordCard .mr-reveal');
const K5c=await E(()=>__contrast($('#wordCard .mr-earhint')));
ok('只聽發音：大的 🔊 和「👁 看意思」都在畫面上、不被底部選單蓋住；說明文字深色對比足夠',K5.out.length===2&&K5.out.every(x=>x.top>=0&&x.b<=K5.lim&&x.h>=40&&x.r<=K5.vw)&&K5c>=4.5,JSON.stringify([K5,K5c]));
await pg.click('#wordCard [data-mr="ear"]');await sleep(200);
// 做完一組：完成畫面
await E(()=>{cardIndex=cardPool.length-1;cardReveal=false;showCard()});await sleep(100);await mrGrade(pg,'new');
const K6=await vis('#wordCard .mr-endb button'),K6s=await vis('#wordCard .mr-sum span');
ok('完成畫面：按鈕（再回想、練意思不熟的、返回列表）高度至少 40px、文字一行、在畫面內；✓◐✗ 統計也在畫面內、深色對比足夠',inView(K6)&&K6.out.length===3&&K6s.out.length===3&&K6s.out.every(x=>x.l>=0&&x.r<=K6s.vw&&x.lines===1&&x.c>=4.5),JSON.stringify([K6,K6s]));
await pg.click('#wordCard [data-ca="list"]');await sleep(200);
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(300);
const K7=await vis('#wordRows .mr-banner button');
const K7c=await E(()=>['.mr-banner b','.mr-banner small'].map(s=>__contrast($('#wordRows '+s))));
ok('「意思不熟」清單上方的說明和「▶ 回想」按鈕：在畫面內、按鈕至少 40px、文字一行、深色對比足夠',inView(K7)&&K7c.every(c=>c>=4.5),JSON.stringify([K7,K7c]));
await pg.click('#wordPage .word-stats [data-st="meanweak"]');await sleep(200);
// 今日學習進行中（進度列在底部選單上面）
await E(()=>{store.settings.flowCfg={rev:0,new:0,sent:5,situ:0,mr:10};save()});
await pg.click('#navToday');await sleep(300);await pg.click('#todayBody .flow-start');await sleep(600);
const fb=()=>E(()=>{const f=$('#flowBar').getBoundingClientRect(),c=$('#wordCard'),k=c.querySelector('.mr-grade')||c.querySelector('.mr-reveal');const r=k.getBoundingClientRect(),w=(c.querySelector('.big,.mr-earbig')||c).getBoundingClientRect();return {fb:Math.round(f.top),k:Math.round(r.bottom),kt:Math.round(r.top),w:Math.round(w.top),bar:$('#flowBar').textContent}});
const K8=await fb();await reveal(pg);const K9=await fb();
await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-learning"]');await sleep(200);const K10=await fb();
ok('今日學習進行中：「👁 看意思」和評分按鈕都在進度列上面（不被蓋住），單字也在畫面上',/意思回想/.test(K8.bar)&&K8.k<=K8.fb&&K8.w>=0&&K9.k<=K9.fb&&K9.kt>=0&&K10.k<=K10.fb&&K10.w>=0,JSON.stringify([K8,K9,K10]));
/* 進度列：和 p27 一樣不寫死像素，和原本就有說明文字的「句子跟讀」那一步比較 */
const fbm=()=>E(()=>{const bar=$('#flowBar'),t=bar.querySelector('.fb-t'),b=t.querySelector('b'),sm=t.querySelector('small');return {h:Math.round(bar.getBoundingClientRect().height),vh:innerHeight,bl:__lines(b),sl:sm?__lines(sm):0,btn:[...bar.querySelectorAll('button')].map(x=>x.textContent+':'+__lines(x)),t:bar.textContent}});
const K10b=await fbm();await E(()=>{FLOW.i++;flowGo()});await sleep(400);const K10s=await fbm();
ok('進度列顯示「🧠 意思回想」這一步時：按鈕文字一行、說明最多兩行、不比「句子跟讀」那一步高、不超過畫面的 1/4',/🧠 意思回想/.test(K10b.t)&&/句子跟讀/.test(K10s.t)&&K10b.h<=K10s.h+2&&K10b.h<=K10b.vh*0.25&&K10b.bl<=2&&K10b.sl<=2&&K10b.btn.every(x=>/:1$/.test(x)),JSON.stringify([K10b,K10s]));
await E(()=>flowEnd());
// iPhone 主畫面 App：底部橫條的安全區域（底部選單變高）
await pg.addStyleTag({content:'nav{padding-bottom:34px!important}body{padding-bottom:calc(75px + 34px)!important}'});
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(400);
const K11=await E(()=>{const n=document.querySelector('nav').getBoundingClientRect().top,r=$('#wordCard .mr-reveal').getBoundingClientRect();return {nav:Math.round(n),b:Math.round(r.bottom),t:Math.round(r.top)}});
await reveal(pg);
const K12=await E(()=>{const n=document.querySelector('nav').getBoundingClientRect().top,r=$('#wordCard .mr-grade').getBoundingClientRect();return {nav:Math.round(n),b:Math.round(r.bottom),t:Math.round(r.top)}});
ok('iPhone 底部安全區域（底部選單多 34px）：「👁 看意思」和評分按鈕仍在底部選單上面',K11.b<=K11.nav&&K11.t>=0&&K12.b<=K12.nav&&K12.t>=0,JSON.stringify([K11,K12]));
ok('K 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p29.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
