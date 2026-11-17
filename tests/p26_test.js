// V5.32.0：🎤 逐字回饋（句子頁、Role Play）、片語聽寫（拼字）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8895);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];window.__rate=[];speechSynthesis.speak=u=>{window.__said.push(u.text);window.__rate.push(u.rate);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
  say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f))};
async function open(vp,extra){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone']},extra||{}));await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8895/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
// 句子頁換成指定的句子（測試用）
const setSent=(E,en)=>E(en=>{page('practice');pool=[{id:'t:'+en.length,en,zh:'（測試句）',keys:[],src:'core'}];i=0;render()},en);
// 按 🎤、念出 heard，等評分結束
async function speak(pg,heard){await pg.click('#check');await sleep(150);await pg.evaluate(t=>window.__speak(t),heard);await pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent)&&/相似度/.test(document.querySelector('#result').textContent),null,{timeout:12000}).catch(()=>{});await sleep(100);
 return pg.evaluate(()=>{const r=document.querySelector('#result');return {t:r.textContent,score:+((/相似度 (\d+)%/.exec(r.textContent)||[])[1]),ok:[...r.querySelectorAll('.sw-line .sw-ok')].map(x=>x.textContent),miss:[...r.querySelectorAll('.sw-line .sw-miss')].map(x=>x.textContent),aria:[...r.querySelectorAll('.sw-line .sw-miss')].map(x=>x.getAttribute('aria-label')),extra:(r.querySelector('.sw-extra')||{}).textContent||'',note:(r.querySelector('.sw-note')||{}).textContent||'',key:[...r.querySelectorAll('.sw-line .sw-key')].map(x=>x.textContent+(x.classList.contains('sw-miss')?'✗':'✓')),run:[...r.querySelectorAll('.sw-line .sw-keyrun')].map(x=>x.textContent)}})}
// 版面：一個元素裡的文字有幾行（不寫死像素，字型不同的電腦也能比）
const LINES=`window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n}`;
// 紅字按得到的範圍：中心上下左右 20px 都點得到同一個字（≥ 40px）
const HIT=`window.__hit=el=>{el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;return [[cx,cy-19.5],[cx,cy+19.5],[cx-19.5,cy],[cx+19.5,cy]].every(([x,y])=>{const t=document.elementFromPoint(x,y);return !!t&&t.closest('.sw-miss')===el})}`;

// ---------- A. 句子頁：🎤 逐字回饋 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
await pg.click('#navPractice');await sleep(200);
await setSent(E,'Please check the breaker panel.');
let r=await speak(pg,'please check the baker panel');
ok('念錯一個字（breaker 聽成 baker）：句子裡 breaker 標紅、其他字標綠，相似度 80%，下面列出「另外聽到：baker」和「紅色的字再練一次」',r.score===80&&r.miss.join('|')==='breaker'&&r.ok.join('|')==='Please|check|the|panel.'&&/另外聽到：baker/.test(r.extra)&&/紅色的字再練一次/.test(r.note),JSON.stringify(r));
ok('紅色的字有讀屏說明（aria-label「沒念到：breaker（聽成 baker）」）',/^沒念到：breaker（聽成 baker）/.test(r.aria[0]||''),r.aria[0]);
await E(()=>{window.__said=[];window.__rate=[]});
await pg.click('#result .sw-miss');await sleep(120);await pg.click('#result .sw-miss');await sleep(120);
const T=await E(()=>({said:window.__said,rate:window.__rate}));
ok('點紅色的字念出那個字；再點一次放慢',T.said.join('|')==='breaker|breaker'&&T.rate[0]===1&&T.rate[1]<0.8,JSON.stringify(T));
await E(HIT);
const H1=await E(()=>window.__hit(document.querySelector('#result .sw-miss')));
ok('紅色的字按得到的範圍至少 40×40px（字本身不會變大、句子不會變形）',H1);
// 念法不同也算對：數字、時間、a.m.、縮寫、連字號、It's
await setSent(E,"It's 9:30 a.m. and PDU-B3 is at twenty-five percent.");
r=await speak(pg,'it is nine thirty am and pdu b 3 is at 25 percent');
ok('念法不同也算對（It is、nine thirty、am、P D U B 3、25）：每個字都是綠色、相似度 100%、沒有「另外聽到」',r.score===100&&r.miss.length===0&&r.ok.length===9&&!r.extra&&/全部都有念到/.test(r.t),JSON.stringify(r));
// 跨字合併的數字：twenty five ＝ 25
await setSent(E,'Set it to twenty five degrees.');
r=await speak(pg,'set it to 20 degrees');
ok('跨兩個字的數字（twenty five）念成 20：兩個字都標紅、相似度 80%、列出「另外聽到：20」',r.score===80&&r.miss.join('|')==='twenty|five'&&/另外聽到：20/.test(r.extra),JSON.stringify(r));
r=await speak(pg,'set it to 25 degrees');
ok('念 25 也對：twenty five 兩個字都是綠色',r.score===100&&r.miss.length===0,JSON.stringify(r));
// 重複的字：和評分一樣只看有沒有念到
await setSent(E,'The cat and the dog.');
r=await speak(pg,'the cat and dog');
ok('顏色和相似度一致：句子有兩個 the、只念一個 the 時，相似度 100%，也沒有紅字',r.score===100&&r.miss.length===0,JSON.stringify(r));
// 大量句子：綠字、紅字和相似度一致
const P=await E(()=>{const S=ALLS.filter((s,k)=>k%97===0).slice(0,60),bad=[],sp=x=>x.replace(/\s+/g,' ').trim();let n=0,reds=0;
 S.forEach((s,k)=>{const kept=s.en.split(/\s+/).filter((x,j)=>(j+k)%3!==1);const heard=(kept.join(' ').replace(/[^A-Za-z0-9' ]/g,' ').toLowerCase()+' zzqx').replace(/\s+/g,' ').trim();
  const a=scTok(s.en),H=scHeard(heard),score=a.length?Math.round(scMatch(a,H)/a.length*100):0;const d=document.createElement('div');d.innerHTML=swFeedback(s.en,heard,score);const line=d.querySelector('.sw-line'),miss=d.querySelectorAll('.sw-miss').length;n++;reds+=miss;
  const wrong=[...line.querySelectorAll('.sw-ok,.sw-miss')].filter(el=>{const t=scTok(el.textContent);if(t.some(x=>/\d/.test(x)))return false;const allHit=t.every(x=>H.has(x));return el.classList.contains('sw-ok')?!allHit:allHit});
  if(sp(line.textContent)!==sp(s.en)||(score===100)!==(miss===0)||wrong.length||!/另外聽到：zzqx/.test(d.textContent))bad.push(s.en+' → '+score+'% 紅 '+miss+' '+wrong.map(e=>e.textContent).join(','))});return {n,reds,bad}});
ok('60 個不同的句子（漏念、多念）：紅字就是相似度沒算到的字、綠字都有算到；100% 時沒有紅字；多念的字（zzqx）列在「另外聽到」',P.n===60&&P.reds>60&&P.bad.length===0,JSON.stringify(P).slice(0,400));
// 🎙 錄音：不會出現逐字標示
await setSent(E,'Please check the breaker panel.');
await pg.click('#record');const rs=await pg.waitForFunction(()=>REC.state==='recording',null,{timeout:5000}).then(()=>true).catch(()=>false);await sleep(800);await pg.click('#record');
const rd=await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:6000}).then(()=>true).catch(()=>false);
const RC=await E(()=>({res:$('#result').textContent,line:!!document.querySelector('.sw-line'),msg:!!document.querySelector('#recMsg .sw-miss')}));
ok('🎙 錄音（錄完播放自己的聲音）不會出現逐字標示，只有 🎤 辨識才會',rs&&rd&&!RC.line&&!RC.msg&&/按下後朗讀/.test(RC.res),JSON.stringify(RC));
// 沒做過片語聽寫：今日、統計、錯題本都看過，學習紀錄（備份檔）也不會多出新欄位
await pg.click('#navToday');await sleep(200);await pg.click('#navStats');await sleep(200);await pg.click('#navQuiz');await sleep(150);await pg.click('#openWB');await sleep(150);await E(()=>saveNow());
const NK=await E(()=>({mem:'phWrong' in store,ls:/phWrong/.test(localStorage.getItem('english5000v5')||'')}));
ok('沒做過片語聽寫時，看今日、統計、錯題本都不會在學習紀錄（備份檔）多出新欄位',!NK.mem&&!NK.ls,JSON.stringify(NK));
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. Role Play：每一句的逐字回饋 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d14"]');await sleep(200);await pg.click('#dlgRpB');await sleep(500);
const D=await E(()=>DLG_BY.d14.lines.map(L=>L.en));
let r=await speak(pg,'hi i am on i found a tripped breaker on msb 1');
const RP1=await E(()=>({inBox:!!document.querySelector('#rpSpeak #result .sw-line'),pass:(document.querySelector('#rpSpeak .rp-pass')||{}).textContent||'',prog:document.querySelector('.rp-prog').textContent,sc:RP.sc[RP.n]}));
ok('Role Play 我的台詞：🎤 後在 Role Play 區塊裡標出漏念的字（rounds 紅色），相似度和進度列的最高分一致，仍顯示通過與否',RP1.inBox&&r.miss.join('|')==='rounds.'&&r.score===RP1.sc&&/最高 92%/.test(RP1.prog)&&/通過/.test(RP1.pass)&&/紅色的字再練一次/.test(r.note),JSON.stringify({r,RP1}));
// 連續模式：點紅字練習時暫停自動下一句
await E(()=>{rpStart(DLG_BY.d14,'B',3,{},true)});await sleep(300);
await pg.check('#rpAuto');await sleep(100);
r=await speak(pg,'feeder breaker 52 3 it feeds ups 2 a');
const auto1=/自動下一句/.test(r.t);
await E(()=>{window.__said=[]});await pg.click('#result .sw-miss');await sleep(2300);
const RP2=await E(()=>({n:RP.n,said:window.__said,t:document.querySelector('#result').textContent}));
ok('連續模式：念到 80% 以上但有紅字時，點紅字聽發音會暫停自動下一句（不會被打斷）',auto1&&r.miss.join('|')==='input.'&&RP2.n===3&&RP2.said[0]==='input'&&/已暫停自動下一句/.test(RP2.t),JSON.stringify({miss:r.miss,auto1,RP2}));
await pg.uncheck('#rpAuto');
// 自由回答：重點句型框起來
await E(()=>{rpStart(DLG_BY.d14,'B',1,{},true)});await sleep(300);
await pg.selectOption('#rpLevel','free');await sleep(200);
r=await speak(pg,'i found a tripped breaker on msb 1');
const pass3=await E(()=>(document.querySelector('#rpSpeak .rp-pass')||{}).textContent||'');
ok('自由回答：重點句型（I found a tripped breaker on MSB-1）用黃底連起來標出、而且都是綠色，說明「重點句型都念到了，其他字可以用自己的話說」',r.key.length===7&&r.key.every(x=>/✓$/.test(x))&&r.run.length===1&&/I found a tripped breaker on MSB-1\.$/.test(r.run[0])&&r.miss.length===3&&/重點句型都念到了/.test(r.note)&&/通過/.test(pass3),JSON.stringify({r,pass3}));
r=await speak(pg,'i found a breaker on msb 1');
ok('自由回答：重點句型漏念的字（tripped）標紅，提示重點句型一定要念到',r.key.includes('tripped✗')&&/一定要念到/.test(r.note),JSON.stringify(r));
await E(()=>{store.settings.rpLevel='hint';save()});
ok('Role Play 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 小手機＋特大字＋深色：逐字回饋版面 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme()});
await pg.click('#navPractice');await sleep(200);
await setSent(E,'Please make sure the UPS-2A maintenance bypass breaker is locked out before you open the panel.');
const r=await speak(pg,'please make sure the ups 2 a bypass breaker is locked before you open the panel');
await E(LINES);await E(HIT);
const L=await E(()=>{const se=document.scrollingElement,m=[...document.querySelectorAll('#result .sw-miss')];const cs=m[0]&&getComputedStyle(m[0]);return {ovw:se.scrollWidth-se.clientWidth,n:m.length,lines:m.map(x=>window.__lines(x)),hit:m.every(x=>window.__hit(x)),color:cs&&cs.color,bg:cs&&cs.backgroundColor,okc:getComputedStyle(document.querySelector('#result .sw-ok')).color}});
ok('360×640＋特大字＋深色：結果不會撐出橫向捲動；紅字每個都在一行、按得到的範圍至少 40px；深色模式用淺紅、淺綠（看得清楚）',L.ovw<=0&&L.n===2&&L.lines.every(x=>x===1)&&L.hit&&L.color==='rgb(255, 138, 138)'&&/rgba\(0, 0, 0, 0\)|transparent/.test(L.bg)&&L.okc==='rgb(127, 224, 174)',JSON.stringify({L,miss:r.miss}));
// Role Play 同樣版面
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d14"]');await sleep(200);await pg.click('#dlgRpB');await sleep(500);
await speak(pg,'hi i am on rounds i found a breaker on msb 1');
const L2=await E(()=>{const se=document.scrollingElement,m=[...document.querySelectorAll('#rpSpeak .sw-miss')];return {ovw:se.scrollWidth-se.clientWidth,n:m.length,lines:m.map(x=>window.__lines(x)),hit:m.every(x=>window.__hit(x))}});
ok('360×640＋特大字＋深色的 Role Play：逐字回饋不會撐出橫向捲動，紅字（tripped）按得到',L2.ovw<=0&&L2.n===1&&L2.lines[0]===1&&L2.hit,JSON.stringify(L2));
await E(()=>rpOff());
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 片語聽寫（拼字） ----------
{const {ctx,pg,errs,E}=await open();
const pq=p=>E(p=>{window.__said=[];window.__rate=[];pdQuiz(PHRASES.find(x=>x.p===p))},p);
const ans=async(t,how)=>{await pg.fill('#pdIn',t);if(how==='enter')await pg.press('#pdIn','Enter');else await pg.click('#pdGo');await sleep(150);return E(()=>({msg:$('#quizMsg').textContent,dis:$('#pdIn').disabled&&$('#pdGo').disabled&&$('#pdGive').disabled,need:[...document.querySelectorAll('#quizMsg .pd-need')].map(x=>x.textContent),wrong:[...document.querySelectorAll('#quizMsg .pd-wrong')].map(x=>x.textContent),miss:[...document.querySelectorAll('#quizMsg .pd-miss')].map(x=>x.textContent),x:[...document.querySelectorAll('#quizMsg .pd-x')].map(x=>x.textContent),opt:[...document.querySelectorAll('#quizMsg .pd-opt')].map(x=>x.textContent)}))};
await pg.click('#navQuiz');await sleep(200);
await pg.selectOption('#quizType','phrase');await sleep(150);
const O=await E(()=>{const o=$('#quizMode option[value="dict"]');return {dis:o.disabled,hid:o.hidden,txt:o.textContent}});
await E(()=>{window.__said=[];window.__rate=[]});
await pg.selectOption('#quizMode','dict');await sleep(300);
const Q=await E(()=>{const inp=$('#pdIn');return {inp:!!inp,attrs:inp&&['autocapitalize','autocomplete','autocorrect','spellcheck','enterkeyhint'].map(a=>inp.getAttribute(a)).join(','),focus:document.activeElement===inp,q:$('#quizQ').textContent,said:window.__said.slice(),rate:window.__rate.slice(),p:PH_BY[PD.last].p,zh:PH_BY[PD.last].zh,btn:['#pdPlay','#pdSlow','#pdGo','#pdGive'].map(s=>($(s)||{}).textContent)}});
ok('片語測驗可以選「聽寫（拼字）」：出聽寫題，自動念一次片語，顯示中文意思當提示，游標在輸入框',!O.dis&&!O.hid&&Q.inp&&Q.focus&&Q.said.length===1&&Q.said[0]===Q.p&&Q.q.includes(Q.zh)&&/片語聽寫/.test(Q.q),JSON.stringify({O,Q}));
ok('輸入框關閉自動大寫、自動完成、自動修正、拼字檢查，鍵盤的 Enter 鍵顯示「完成」；有 🔊 再聽、🐢 慢速、確認、不會，看答案',Q.attrs==='off,off,off,false,done'&&Q.btn.join('|')==='🔊 再聽|🐢 慢速|確認|不會，看答案',JSON.stringify(Q));
await E(()=>{window.__said=[];window.__rate=[]});await pg.click('#pdPlay');await sleep(80);await pg.click('#pdSlow');await sleep(80);
const SP=await E(()=>({said:window.__said,rate:window.__rate,p:PH_BY[PD.last].p}));
ok('🔊 用一般速度念、🐢 用慢速念',SP.said.length===2&&SP.said.every(t=>t===SP.p)&&SP.rate[0]>=0.85&&SP.rate[1]<=0.65,JSON.stringify(SP));
await E(()=>{store.qStat={};store.phWrong={};save()});
await pq("I'm on it");
let A=await ans("  i’M   ON it!! ",'enter');
ok('不分大小寫，多的空白、標點、彎引號都不影響：「  i’M   ON it!! 」算對（按 Enter 送出），送出後輸入框和按鈕鎖住',/^✅/.test(A.msg)&&A.dis,A.msg);
await pq('fill someone in');A=await ans('Fill me in');
const A2=await (async()=>{await pq('fill someone in');return ans('fill in')})();
const A3=await (async()=>{await pq('be good at');return ans('good at')})();
ok('有代換字的片語：fill someone in 寫 fill me in、fill in 都算對；be good at 可以不寫 be（並提示標準寫法）',/^✅/.test(A.msg)&&/^✅/.test(A2.msg)&&/^✅/.test(A3.msg)&&/標準寫法是 fill someone in/.test(A.msg)&&/標準寫法是 be good at/.test(A3.msg),JSON.stringify([A.msg,A2.msg,A3.msg]));
await pq('look forward to');A=await ans('look foward too');
ok('拼錯：顯示正確答案，標出漏掉的字母（forward 的 r）和多寫的字母（too 多一個 o）',/^❌ 正確答案：look forward to/.test(A.msg)&&A.need.join('')==='r'&&A.wrong.join('')==='o',JSON.stringify(A));
await pq('look forward to');A=await ans('look forward');
const B2=await (async()=>{await pq('look forward to');return ans('look forward to it')})();
ok('漏寫整個字（to）用紅色波浪線標出、多寫的字（it）用刪除線標出',A.miss.join('|')==='to'&&B2.x.join('|')==='it'&&/^❌/.test(B2.msg),JSON.stringify([A,B2]));
await pq('fill someone in');A=await ans('fill me on');
ok('代換字可以不寫：fill me on 只標 on 拼錯，me 不算錯',/^❌/.test(A.msg)&&A.need.join('')==='i'&&A.wrong.join('')==='o'&&A.miss.length===0,JSON.stringify(A));
await pq('take care of');await pg.fill('#pdIn','take car');await pg.click('#pdGive');await sleep(150);
const G=await E(()=>({msg:$('#quizMsg').textContent,dis:$('#pdIn').disabled,w:store.phWrong[PHRASES.find(x=>x.p==='take care of').id]}));
ok('「不會，看答案」：顯示答案、算答錯、加入錯題本，輸入框鎖住',/^❌ 正確答案：take care of/.test(G.msg)&&G.dis&&G.w===1&&/錯題本/.test(G.msg),JSON.stringify(G));
await pq('look after');await pg.click('#pdGo');await sleep(100);
const EM=await E(()=>({msg:$('#quizMsg').textContent,dis:$('#pdIn').disabled,st:JSON.stringify(store.qStat['p-dict'])}));
ok('沒輸入就按確認：提示先輸入（不算作答）',/先輸入/.test(EM.msg)&&!EM.dis,JSON.stringify(EM));
const ST=await E(()=>({st:store.qStat['p-dict'],ph:Object.keys(store.phWrong).map(k=>PH_BY[k].p).sort()}));
ok('統計記在「片語：聽寫拼字」（答對 4、答錯 5）；答錯的片語收進錯題本',JSON.stringify(ST.st)==='[4,5]'&&ST.ph.join('|')==='fill someone in|look forward to|take care of',JSON.stringify(ST));
await pg.click('#navStats');await sleep(300);
const SS=await E(()=>$('#statsBody').textContent);
ok('統計頁顯示「片語：聽寫拼字」4 / 9，錯題本數量含片語 3',/片語：聽寫拼字( ⚠️)?4 \/ 9（44%）/.test(SS)&&/、片語 3/.test(SS),(SS.match(/片語：聽寫拼字[^%]*%/)||[''])[0]+' | '+(SS.match(/單字 \d+[^打]*/)||[''])[0]);
// 錯題本
await pg.click('#navQuiz');await sleep(150);await pg.click('#openWB');await sleep(200);
const W=await E(()=>({cards:[...document.querySelectorAll('.wb-cards span')].map(x=>x.textContent+(x.previousElementSibling||{}).textContent),rows:[...document.querySelectorAll('#wrongBody .wb-row')].filter(r=>r.querySelector('[data-wbdel^="p|"]')).map(r=>r.querySelector('b').textContent+'｜'+r.querySelector('.wb-n').textContent),h3:[...document.querySelectorAll('#wrongBody h3')].map(h=>h.textContent),foot:document.querySelector('#wrongBody > p.muted:last-child').textContent}));
ok('錯題本：多一張「片語」卡片和「片語聽寫」清單（錯幾次），說明答對 1 次移出',W.cards.includes('片語3')&&W.rows.length===3&&W.rows.includes('look forward to｜錯 3 次')&&W.h3.some(h=>/^片語聽寫（3）/.test(h))&&/片語聽寫答對 1 次/.test(W.foot),JSON.stringify(W));
await E(()=>{window.__said=[]});await pg.click('#wrongBody [data-wbsay="look forward to"]');await sleep(80);
const n0=await E(()=>document.querySelectorAll('#wrongBody [data-wbdel^="p|"]').length);
await pg.click('#wrongBody [data-wbdel^="p|"] >> nth=0');await sleep(150);
const n1=await E(()=>({n:document.querySelectorAll('#wrongBody [data-wbdel^="p|"]').length,k:Object.keys(store.phWrong).length,said:window.__said}));
await pg.click('#wrongBody [data-wbundo]');await sleep(150);
const n2=await E(()=>({n:document.querySelectorAll('#wrongBody [data-wbdel^="p|"]').length,k:Object.keys(store.phWrong).length,v:store.phWrong}));
ok('錯題本的片語：🔊 可播放、✕ 可移除、↩️ 復原（次數不變）',n1.said[0]==='look forward to'&&n0===3&&n1.n===2&&n1.k===2&&n2.n===3&&n2.k===3&&Object.values(n2.v).sort().join(',')==='1,1,3',JSON.stringify({n0,n1,n2}));
// 聽寫練習：只出答錯的片語
await pg.click('#wrongBody [data-wbgo="pd"]');await sleep(300);
const WO=[];for(let k=0;k<4;k++){const q=await E(()=>({tag:(document.querySelector('#quizQ .wb-tag')||{}).textContent||'',p:$('#pdIn')?PH_BY[PD.last].p:'',inWrong:$('#pdIn')?!!store.phWrong[PD.last]:false,q:$('#quizQ').textContent,type:$('#quizType').value,mode:$('#quizMode').value}));WO.push(q);if(!q.p)break;await pg.fill('#pdIn',q.p.toUpperCase());await pg.click('#pdGo');await sleep(150);await pg.click('#newQuiz');await sleep(250)}
const left=await E(()=>Object.keys(store.phWrong).length);
ok('錯題本「聽寫練習」：只出答錯的片語（顯示剩幾題），答對就移出，練完顯示完成',WO.length===4&&WO[0].type==='phrase'&&WO[0].mode==='dict'&&/只練答錯的片語（剩 3 題）/.test(WO[0].tag)&&WO.slice(0,3).every(q=>q.inWrong)&&/剩 1 題/.test(WO[2].tag)&&/答錯的片語聽寫都練完了/.test(WO[3].q)&&left===0,JSON.stringify({WO,left}));
// 錯題本混合練習：重新出聽寫題
await pq('figure out');await ans('figure it out');
await E(()=>{store.wrongWords={};store.lsWrong={};store.sqWrong={};save()});
await pg.selectOption('#quizType','wrongmix');await sleep(250);
const MX=await E(()=>({tag:$('#quizQ').textContent,inp:!!$('#pdIn'),p:$('#pdIn')?PH_BY[PD.last].p:''}));
await pg.fill('#pdIn','figure out');await pg.press('#pdIn','Enter');await sleep(150);
const MX2=await E(()=>$('#quizMsg').textContent);await pg.click('#newQuiz');await sleep(200);
const MX3=await E(()=>$('#quizQ').textContent);
ok('錯題本混合練習會重新出片語聽寫題；答對後移出，錯題本變空',/錯題本混合練習（剩 1 題）/.test(MX.tag)&&MX.inp&&MX.p==='figure out'&&/^✅/.test(MX2)&&/已從「📕 錯題本」移除/.test(MX2)&&/錯題本是空的/.test(MX3),JSON.stringify({MX,MX2,MX3}));
// 綜合（混合題型）也會出聽寫
await pg.selectOption('#quizType','phrase');await pg.selectOption('#quizMode','mix');await sleep(100);
let nd=0,nc=0;for(let k=0;k<60;k++){await pg.click('#newQuiz');await sleep(25);const t=await E(()=>!!$('#pdIn')?'d':document.querySelectorAll('#quizOpts button[data-ok]').length===4?'c':'?');if(t==='d')nd++;else if(t==='c')nc++}
ok('片語測驗的「混合題型」也會出聽寫題（60 題裡有聽寫也有選擇題）',nd>0&&nc>0&&nd+nc===60,'聽寫 '+nd+'、選擇 '+nc);
// 選擇題照常
await pg.selectOption('#quizMode','en');await sleep(100);
const before=await E(()=>({ph:JSON.stringify(store.qStat.phrase||[0,0]),w:Object.keys(store.phWrong).length}));
await E(()=>{[...document.querySelectorAll('#quizOpts button[data-ok]')].find(b=>b.dataset.ok==='false').click()});await sleep(100);
const after=await E(()=>({ph:store.qStat.phrase,w:Object.keys(store.phWrong).length,msg:$('#quizMsg').textContent}));
ok('片語選擇題（看英文選中文）照常，統計仍記在「片語測驗」',/^❌/.test(after.msg)&&(after.ph[1]-JSON.parse(before.ph)[1])===1&&after.w===before.w,JSON.stringify({before,after}));
// 靜音（預留設定）時不自動念
await E(()=>{store.settings.mute=true});await pq('look up');const MU=await E(()=>window.__said.length);await E(()=>{delete store.settings.mute;save()});
ok('App 設成靜音時，聽寫題出題不自動念（按 🔊 才念）',MU===0,String(MU));
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 片語聽寫：小手機＋特大字＋深色、螢幕鍵盤 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme()});
await E(LINES);
await pg.click('#navQuiz');await sleep(150);await pg.selectOption('#quizType','phrase');await pg.selectOption('#quizMode','dict');await sleep(300);
await E(()=>pdQuiz(PHRASES.find(x=>x.p==='I hope this email finds you well')));await sleep(400);
const L=await E(()=>{const se=document.scrollingElement,bs=['#pdPlay','#pdSlow','#pdGo','#pdGive'].map(s=>$(s)),inp=$('#pdIn'),cs=getComputedStyle(inp),f=$('#pdForm').getBoundingClientRect(),nav=document.querySelector('nav').getBoundingClientRect();
 return {ovw:se.scrollWidth-se.clientWidth,lines:bs.map(x=>window.__lines(x)),h:bs.map(x=>Math.round(x.getBoundingClientRect().height)),w:bs.map(x=>Math.round(x.getBoundingClientRect().width)),fs:parseFloat(cs.fontSize),bg:cs.backgroundColor,form:[Math.round(f.top),Math.round(f.bottom)],nav:Math.round(nav.top)}});
ok('360×640＋特大字＋深色：聽寫題不會撐出橫向捲動；4 個按鈕都是一行、至少 40px；輸入框字體至少 16px（iPhone 不會自動放大）、深色底；輸入框和按鈕在底部選單上方',L.ovw<=0&&L.lines.every(x=>x===1)&&L.h.every(x=>x>=40)&&L.w.every(x=>x>=40)&&L.fs>=16&&L.bg==='rgb(15, 27, 46)'&&L.form[0]>=0&&L.form[1]<=L.nav,JSON.stringify(L));
// 螢幕鍵盤（iPhone、新版 Android：只縮小可見區域，底部選單被鍵盤蓋住）
await E(()=>{window.scrollTo(0,0);window.visualViewport={offsetTop:0,pageTop:0,height:300,width:360,scale:1,addEventListener(){},removeEventListener(){}};pdKeep()});await sleep(100);
const K1=await E(()=>{const f=$('#pdForm').getBoundingClientRect();return {top:Math.round(f.top),bottom:Math.round(f.bottom),y:Math.round(scrollY)}});
await E(()=>{delete window.visualViewport});
ok('螢幕鍵盤打開（可見高度只剩 300px）：自動捲動，輸入框和確認／不會按鈕都在鍵盤上方',K1.top>=0&&K1.bottom<=300,JSON.stringify(K1));
// 螢幕鍵盤（舊版 Android：整個畫面變矮，底部選單跟著移到鍵盤上方）
await E(()=>{window.scrollTo(0,0);$('#pdIn').focus()});await pg.setViewportSize({width:360,height:340});await sleep(700);
const K2=await E(()=>{const f=$('#pdForm').getBoundingClientRect(),n=document.querySelector('nav').getBoundingClientRect();return {top:Math.round(f.top),bottom:Math.round(f.bottom),nav:Math.round(n.top),ih:innerHeight}});
ok('螢幕鍵盤打開（畫面變矮成 340px）：輸入框和按鈕捲到底部選單上方',K2.ih===340&&K2.top>=0&&K2.bottom<=K2.nav,JSON.stringify(K2));
await pg.setViewportSize({width:360,height:640});await sleep(300);
// 答錯的比對畫面
await pg.fill('#pdIn','I hope this emial find you');await pg.click('#pdGo');await sleep(300);
const L2=await E(()=>{const se=document.scrollingElement,d=document.querySelector('.pd-diff'),need=document.querySelector('.pd-need'),m=$('#quizMsg').getBoundingClientRect(),nav=document.querySelector('nav').getBoundingClientRect();return {ovw:se.scrollWidth-se.clientWidth,dw:d&&Math.round(d.scrollWidth-d.clientWidth),need:[...document.querySelectorAll('.pd-need')].map(x=>x.textContent).join(','),miss:[...document.querySelectorAll('.pd-miss')].map(x=>x.textContent).join(','),color:need&&getComputedStyle(need).color,msg:Math.round(m.top),nav:Math.round(nav.top),focus:document.activeElement&&document.activeElement.id}});
ok('答錯後（小手機＋特大字＋深色）：比對結果不會撐出橫向捲動，拼錯的字母（email、finds）與漏寫的字（well）標出來、深色模式看得清楚；答案在畫面上、按 Enter 就到「下一題」',L2.ovw<=0&&L2.dw<=0&&/^[ai],s$/.test(L2.need)&&L2.miss==='well'&&L2.color==='rgb(255, 180, 180)'&&L2.msg>=0&&L2.msg<L2.nav&&L2.focus==='newQuiz',JSON.stringify(L2));
// 錯題本 4 張卡片
await pg.click('#openWB');await sleep(200);
const W=await E(()=>{const se=document.scrollingElement;return {ovw:se.scrollWidth-se.clientWidth,cards:[...document.querySelectorAll('.wb-cards > div')].map(d=>window.__lines(d.querySelector('span'))),top:[...document.querySelectorAll('.wb-cards > div')].map(d=>Math.round(d.getBoundingClientRect().top))}});
ok('錯題本（小手機＋特大字）：單字、句子、情境題、片語 4 張卡片排成一列，文字不換行、不撐出橫向捲動',W.ovw<=0&&W.cards.length===4&&W.cards.every(x=>x===1)&&new Set(W.top).size===1,JSON.stringify(W));
ok('E 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p26.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
