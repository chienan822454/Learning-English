// V5.31.1：除蟲（KK 音標、點字查詢、今日學習、自動播放、查詢視窗、測驗、統計、版面）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8893);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
async function open(vp,extra){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone']},extra||{}));await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8893/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
async function tapWord(pg,sel,word){const p=await pg.evaluate(([sel,word])=>{for(const el of document.querySelectorAll(sel)){const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){if(n.parentElement.closest('small'))continue;const m=new RegExp('(^|[^A-Za-z])('+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z])').exec(n.data);if(m){el.scrollIntoView({block:'center'});const k=m.index+m[1].length;const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+word.length);const q=r.getBoundingClientRect();return {x:q.left+Math.min(q.width/2,4),y:q.top+q.height/2}}}}return null},[sel,word]);if(p){await pg.mouse.click(p.x,p.y);await sleep(250)}return p}
const pop=pg=>pg.evaluate(()=>{const p=document.querySelector('#lkPop');if(!p||p.hidden)return null;const r=p.getBoundingClientRect();return {w:(p.querySelector('.lk-w b')||{}).textContent||'',zh:(p.querySelector('.lk-zh')||{}).textContent||'',parts:[...p.querySelectorAll('.lk-part')].map(x=>x.textContent),base:[...p.querySelectorAll('.lk-base')].map(x=>x.textContent).join('｜'),top:Math.round(r.top),bottom:Math.round(r.bottom),said:window.__said.slice(-1)[0],n:window.__said.length}});
const iso=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};

// ---------- A. KK 音標、點字查詢的字詞 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const K=await E(()=>['battery','every','general','hurry','understand','income','UPS','PDU','city','money','thirty','over'].map(w=>phonKK(BY_WORD[w].p)).join(','));
ok('KK：ər 後面接母音不是捲舌音（battery ˋbætərɪ、every、general）；重讀才是 ɝ（hurry）；次重音也轉換（understand ˏʌndɚˋstænd、income）；縮寫字母不變（UPS juˏpiˋɛs）',K==='ˋbætərɪ,ˋɛvərɪ,ˋdʒɛnərəl,ˋhɝɪ,ˏʌndɚˋstænd,ˋɪnˏkʌm,juˏpiˋɛs,piˏdiˋju,ˋsɪtɪ,ˋmʌnɪ,ˋθɝtɪ,ˋovɚ',K);
const LK=await E(()=>{const f=w=>{const r=lkFind(w,null,null);return !r?'—':r.extra?r.extra.w:r.parts?r.parts.map(p=>p.x?p.x.w:'—').join('+'):(r.base?r.base.w:r.x.w)};return ['am','sat','shelves','taped','used','added','bigger','easier','UPS-2A','PDU-B3','year-end','Bravo','Roger','TWDC','Mr'].map(f).join(',')});
ok('點字查詢找得到：am→be、sat→sit、shelves→shelf、taped→tape、used→use、added→add、bigger→big、easier→easy、UPS-2A→UPS、PDU-B3→PDU、year-end→year+end、Bravo、Roger、TWDC、Mr.',LK==='be,sit,shelf,tape,use,add,big,easy,UPS,PDU,year+end,Bravo,Roger,TWDC,Mr.',LK);
// 對話頁：設備代號、a.m.、念點到的字
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');
await pg.click('.dlg-card[data-d="d12"]');await sleep(300);
await tapWord(pg,'.dlg-en','a.m.');let P=await pop(pg);
ok('點「a.m.」：顯示上午',P&&P.w==='a.m.'&&/上午/.test(P.zh),JSON.stringify(P));
await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d02"]');await sleep(300);
await tapWord(pg,'.dlg-en','UPS-2A');P=await pop(pg);
ok('點設備代號「UPS-2A」：顯示 UPS 的意思，並說明出現在 UPS-2A 裡',P&&P.w==='UPS'&&/UPS-2A/.test(P.base),JSON.stringify(P));
await E(()=>{window.__said=[]});
await pg.click('#lkPop [data-lk="play"]');await sleep(100);
const s1=await E(()=>window.__said.slice(-1)[0]);
await tapWord(pg,'.dlg-en','went');await sleep(100);
await E(()=>{window.__said=[]});await pg.click('#lkPop [data-lk="play"]');await sleep(100);
const s2=await E(()=>window.__said.slice(-1)[0]);P=await pop(pg);
ok('查詢視窗的 🔊 念點到的字（went），不是原形（go）',s1==='UPS'&&s2==='went'&&/go/.test(P.base),JSON.stringify({s1,s2,base:P&&P.base}));
await E(()=>{DLG.cur=DLG_BY.d14;renderDialog(DLG.cur)});await sleep(300);
// 視窗位置：點畫面下半部的字，視窗放上方
const pos=await E(()=>{const L=[...document.querySelectorAll('#dialogBody .dlg-en')];const el=L[6];el.scrollIntoView({block:'center'});window.scrollBy(0,-Math.round(innerHeight*.18));const n=el.firstChild;const r=document.createRange();r.setStart(n,0);r.setEnd(n,1);const q=r.getBoundingClientRect();return {x:q.left+2,y:q.top+q.height/2,nav:document.querySelector('nav').getBoundingClientRect().top}});
await pg.mouse.click(pos.x,pos.y);await sleep(250);P=await pop(pg);
ok('點畫面下半部的字：查詢視窗改放在畫面上方，不蓋住那一句',pos.y>844*.45&&pos.y<pos.nav&&P&&P.bottom<pos.y,JSON.stringify({word_y:Math.round(pos.y),nav:Math.round(pos.nav),pop:P&&[P.top,P.bottom]}));
// 錄音中點字：顯示意思但不發音
await E(()=>{REC.state='recording';window.__said=[]});
await tapWord(pg,'.dlg-en','breaker');P=await pop(pg);
const quiet=await E(()=>window.__said.length);await E(()=>{REC.state='idle'});
ok('錄音或語音辨識進行中點字：只顯示意思，不自動發音（不會錄進去）',!!P&&quiet===0,JSON.stringify({P,quiet}));
await pg.keyboard.press('Escape');await sleep(100);
ok('查詢視窗可以按 Esc 關閉',await pop(pg)===null);
ok('點字查詢測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 今日學習 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont()});
// 新字：單字頁選了 CE 而 CE 沒有新字 → 改出其他冊的新字
await E(()=>{WORDS.filter(x=>x.k===7).forEach(x=>{store.wordStatus[x.w]='known'});save();$('#wordBook').value='7'});
await pg.click('#todayBody .flow-start');await sleep(500);
const N=await E(()=>({n:cardPool.length,st:cardPool.length&&statusOf(cardPool[0].w),k:cardPool.length&&cardPool[0].k,bar:$('#flowBar').textContent}));
ok('今日學習的「學新單字」：單字頁選的冊別（CE）沒有新字時，改出其他冊的新字（不會卡住）',N.n===20&&N.st==='new'&&N.k!==7,JSON.stringify(N));
// 進度列版面：每台電腦的字型寬度不同（GitHub 測試機有中文與彩色表情字型，量到的高度比本機多約 8px），所以檢查版面結構，不寫死像素
const fbm=()=>E(()=>{const bar=$('#flowBar'),t=bar.querySelector('.fb-t'),b=t.querySelector('b');const lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};const fs=parseFloat(getComputedStyle(b).fontSize);return {h:Math.round(bar.getBoundingClientRect().height),vh:innerHeight,tw:Math.round(t.getBoundingClientRect().width),fs:Math.round(fs*10)/10,bl:lines(b),btn:[...bar.querySelectorAll('button')].map(x=>x.textContent+':'+lines(x)),next:(bar.querySelector('[data-flow="next"]')||{}).textContent||'',t:bar.textContent}});
const fbOk=m=>m.h<=m.vh*0.2&&m.tw>=m.fs*7&&m.bl<=2&&m.btn.length>0&&m.btn.every(x=>/:1$/.test(x));
const H=await fbm();
for(let k=0;k<20;k++){await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(40)}
await sleep(1300);
const H2=await fbm();
ok('小手機＋特大字：進度列不會擠成一字一行（按鈕文字都在同一行、說明至少 7 個字寬、高度不超過畫面的 20%；做完一步時有「下一步 ▶」、上面那一行寫下一步的名稱）',fbOk(H)&&fbOk(H2)&&/下一步 ▶/.test(H2.next)&&/下一步：句子跟讀/.test(H2.t),JSON.stringify({H,H2}));
// 句子跟讀：從「複習句子」過來時改回一般範圍
await E(()=>{$('#unit').value='sdue';store.settings.unit='sdue';store.settings.learnUnit='ce'});
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const S=await E(()=>({u:$('#unit').value,bar:$('#flowBar').textContent}));
ok('「句子跟讀」：句子頁原本停在待複習句子時，改回一般的句子範圍；進度列說明要 🎤 念對或按「✓ 我會說了」',S.u==='ce'&&/🎤 念對或按「✓ 我會說了」/.test(S.bar),JSON.stringify(S));
await E(()=>{bumpLog('shadow');bumpLog('shadow')});await sleep(1300);
const S2=await E(()=>$('#flowBar').textContent);
ok('🎤 念對的句子也算進「句子跟讀」（2／5）',/句子跟讀 2／5/.test(S2),S2);
// 略過
await pg.click('#flowBar [data-flow="skip"]');await sleep(400);
const K2=await E(()=>({i:FLOW&&FLOW.i,bar:$('#flowBar').textContent}));
ok('進度列可以「略過」這一步',K2.i===2&&/CE 情境題/.test(K2.bar),JSON.stringify(K2));
// 作答後「下一題」不被進度列擋住
await sleep(300);await pg.click('#quizOpts .sq-opt, #quizOpts button');await sleep(500);
const Q=await E(()=>{const nx=$('#newQuiz').getBoundingClientRect(),fb=$('#flowBar').getBoundingClientRect();return {nx:Math.round(nx.bottom),fb:Math.round(fb.top)}});
ok('作答後自動捲動：「下一題」在進度列上方，看得到',Q.nx<=Q.fb,JSON.stringify(Q));
// 過了午夜：進度列結束
await E(()=>{FLOW.day='2000-01-01';flowSave()});await sleep(1300);
const M=await E(()=>({flow:FLOW,bar:!!$('#flowBar')&&!$('#flowBar').hidden,ls:localStorage.getItem('e5k_flow')}));
ok('App 開著過了午夜：昨天的今日學習自動結束（不會卡在 0）',M.flow===null&&!M.bar&&M.ls===null,JSON.stringify(M));
// 做完一輪：今日頁顯示「完成了」
await E(()=>{flowStart();FLOW.i=FLOW.steps.length;flowSave();flowBar()});await sleep(200);
await pg.click('#flowBar [data-flow="end"]');await sleep(300);await pg.click('#navToday');await sleep(300);
const D=await E(()=>$('#todayBody .flow-start').textContent);
ok('今天的學習做完後，今日頁顯示「✅ 今天的學習完成了」（想多練習可以再練一輪）',/今天的學習完成了/.test(D)&&/再練一輪/.test(D),D);
ok('今日學習測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 自動播放、單字卡、測驗、統計、版面 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,30).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-3)});save()});
await pg.click('#navWords');await sleep(300);await pg.click('#cardMode');await sleep(300);
await pg.click('#wordCard [data-ca="auto"]');await sleep(300);
await E(()=>{flowStart()});await sleep(300);
await E(()=>todayGo('sent'));await sleep(1500);
const A1=await E(()=>({card:cardAuto,auto:autoOn,n:window.__said.length}));await sleep(1500);
const A2=await E(()=>window.__said.length);
ok('換頁時停止單字卡自動播放（今日學習的「下一步」也一樣）',!A1.card&&!A1.auto&&A2===A1.n,JSON.stringify({A1,A2}));
await E(()=>flowEnd());
await pg.click('#navWords');await sleep(300);await pg.click('#reviewStart');await sleep(300);
const meta=await E(()=>$('#wordCard .meta').textContent);
const before=await E(()=>+$('#wordDueN').textContent);
await E(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(100);
const after=await E(()=>+$('#wordDueN').textContent);
ok('複習卡顯示「已到期」（不是過去的日期）；按「✓ 已熟」後上方「待複習」數字跟著減少',/已到期/.test(meta)&&after===before-1,JSON.stringify({meta,before,after}));
// 測驗
await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','phrase');await sleep(200);
const PD=await E(()=>({dis:$('#quizMode option[value="dict"]').disabled,v:$('#quizMode').value}));
await pg.selectOption('#quizType','word');await sleep(200);
const WD=await E(()=>$('#quizMode option[value="dict"]').disabled);
ok('片語測驗和單字測驗都可以選「聽寫（拼字）」（V5.32.0 起片語也有聽寫題）',!PD.dis&&!WD,JSON.stringify({PD,WD}));
await pg.selectOption('#quizType','radio');await sleep(200);
let heads=new Set();for(let k=0;k<30;k++){await E(()=>radioQuiz());heads.add(await E(()=>$('#quizQ').textContent.split('🔊')[0].trim()))}
ok('無線電測驗的題目文字正常（沒有「…到？多少？」）',[...heads].every(h=>!/？多少？/.test(h)),[...heads].join('｜'));
await E(()=>{store.settings.phon='kk'});await pg.selectOption('#quizType','pairs');await sleep(200);
let labs=new Set();for(let k=0;k<80;k++){await E(()=>pairsQuiz());labs.add(await E(()=>($('#quizQ small')||{}).textContent))}
await E(()=>{store.settings.phon='ipa'});
ok('KK 模式的發音辨別標籤也用 KK 符號（ɝ、ʌ，不是 ər、ə）',[...labs].every(l=>!/ə/.test(l)),[...labs].join(''));
// 統計：未來 7 天（不算已經不存在的字）
await E(()=>{store.reviewDue.zzznotaword=day();save()});
await pg.click('#navStats');await sleep(400);
const F=await E(()=>{const t=document.querySelector('.fc-row small').textContent;const n=+((t.match(/單字 (\d+)/)||[])[1]||0);return {n,due:WORDS.filter(x=>isDue(x.w)).length,h:Math.round(document.querySelector('.fc-row:nth-child(3) b').getBoundingClientRect().height)}});
ok('統計頁「未來 7 天要複習」今天的單字數和今日頁一致（不算已經不存在的字）；日期不換行',F.n===F.due&&F.h<=24,JSON.stringify(F));
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 句子表、句子頁、iPhone 提示 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{$('#fontSel').value='1.3';$('#fontSel').dispatchEvent(new Event('change'))});await sleep(200);
await pg.click('#navPractice');await sleep(300);await pg.click('#openList');await sleep(300);
const L=await E(()=>({ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,bh:Math.round($('#back1').getBoundingClientRect().height)}));
ok('句子表（小手機＋特大字）：搜尋列不會撐破畫面、「返回練習」不會擠成一字一行',L.ovw<=0&&L.bh<=60,JSON.stringify(L));
await pg.click('#back1');await sleep(200);
await E(()=>{const u=$('#unit');u.value='radio';u.onchange()});await sleep(300);
const KW=await E(()=>{const k=pool.findIndex(s=>!(s.keys&&s.keys.length));i=k<0?0:k;render();const a={kw:$('#keywords').hidden,h:$('#keywords').previousElementSibling.hidden,id:cur().id,keys:(cur().keys||[]).length};i=0;render();a.kw0=$('#keywords').hidden;a.keys0=(cur().keys||[]).length;return a});
ok('沒有關鍵字的句子不顯示空的「③ 關鍵字」；有關鍵字的無線電句照常顯示（V5.32.0 起無線電句也有關鍵字）',KW.keys===0&&KW.kw&&KW.h&&KW.keys0>0&&!KW.kw0,JSON.stringify(KW));
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Line/14.0.0 Mobile Safari/604.1';
const {ctx,pg,errs,E}=await open({width:390,height:844},{userAgent:ua});
const t=await E(()=>(document.querySelector('#todayBody .ios-tip')||{}).textContent||'');
ok('iPhone 的 LINE 內建瀏覽器：提示先用 Safari 開啟再加入主畫面',/先用 Safari 開啟/.test(t),t.slice(0,80));
ok('iPhone 測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p24.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
