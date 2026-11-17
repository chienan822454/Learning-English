// 📈 多益程度估計（非官方）：入口（統計頁卡片、測驗選單）、說明、40 題（應答問題、聽句子選意思、句子填空、短文閱讀）、
// 播放與再聽一次、中途離開與繼續／放棄、結果與計分、CEFR、檢討、題本輪流、進步趨勢、正式成績、學習紀錄與備份、下載中／下載失敗、小手機與深色模式
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path');
const PORT=8905,U='http://localhost:8905/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
/* 測試用網站：記錄每個請求（LOG）、可以讓某個檔案下載失敗（BLOCK）或變慢（DELAY）、可以整個離線（ONLINE） */
let ONLINE=true;const LOG=[],BLOCK={},DELAY={},MISS=[];
const srv=http.createServer(async(q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(!ONLINE||BLOCK[p]){q.socket.destroy();return}LOG.push(p);if(DELAY[p])await sleep(DELAY[p]);if(p.endsWith('/'))p+='index.html';const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
/* 朗讀用假的（記下念了什麼、速度、停止了幾次）；版面檢查：文字排成幾行 */
const stub=()=>{window.__said=[];window.__rate=[];window.__cancel=0;speechSynthesis.speak=u=>{window.__said.push(u.text);window.__rate.push(u.rate);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{window.__cancel++};
 window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n}};
async function open(o){o=o||{};const ctx=await b.newContext(Object.assign({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true},o.ctx||{}));await ctx.addInitScript(stub);if(o.init)await ctx.addInitScript(o.init);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});pg.__dlg=[];pg.__ans=true;pg.on('dialog',d=>{pg.__dlg.push(d.message());(pg.__ans?d.accept():d.dismiss()).catch(()=>{})});await pg.goto(U);await sleep(700);if(o.wait!==false)await pg.waitForFunction(()=>typeof EX2_READY!=='undefined'&&EX2_READY,null,{timeout:25000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
const day=n=>{const t=new Date();t.setDate(t.getDate()+(n||0));return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
const txt=(E,s)=>E(s=>{const e=document.querySelector(s);return e?e.textContent:''},s);
/* 作答：'right' 答對、'wrong' 答錯；每題出現後 0.3 秒內的點擊不算（防止連點），所以先等一下 */
/* 點之前像使用者一樣把選項捲到看得到的地方（底部選單、今日學習進度列上方，固定在上方的文章下面） */
async function answer(pg,mode){const c=await pg.evaluate(()=>{const R=TQ.run,it=R.items[R.i];return [it.c,it.n]});const k=mode==='right'?c[0]:(c[0]+1)%c[1];await sleep(330);
 await pg.evaluate(k=>{const b=document.querySelector(`#toeicBody [data-ans="${k}"]`);if(!b)return;const r=b.getBoundingClientRect(),lim=bottomLimit()-12,st=document.querySelector('#toeicBody .tq-stick'),top=st?st.getBoundingClientRect().bottom:0;if(r.bottom>lim)window.scrollBy(0,r.bottom-lim);else if(r.top<top+4)window.scrollBy(0,r.top-top-8)},k);
 await pg.click(`#toeicBody [data-ans="${k}"]`);await sleep(60)}
const ready=pg=>pg.waitForFunction(()=>typeof TQ_READY!=='undefined'&&TQ_READY&&EX2_READY&&document.querySelector('#toeicBody [data-tq="go"],#toeicBody [data-tq="cont"]')&&!document.querySelector('#toeicBody [data-tq="go"],#toeicBody [data-tq="cont"]').disabled,null,{timeout:25000}).catch(()=>{});
/* 計分公式（和 App 分開寫一次）：扣掉猜對的期望值，5＋490×p'，取 5 的倍數，範圍 ±50 */
const score=(c,ks)=>{const n=ks.length,g=ks.reduce((s,k)=>s+1/k,0),p=Math.max(0,Math.min(1,(c-g)/(n-g)));const S=Math.min(495,Math.max(5,Math.round((5+490*p)/5)*5));return {S,lo:Math.max(5,S-50),hi:Math.min(495,S+50)}};
/* 新題目出來時：選項的位置、底部選單或今日學習進度列的上緣（bottomLimit）、固定在上方的文章 */
const fit=E=>E(()=>{const lim=bottomLimit(),o=[...document.querySelectorAll('#toeicBody .tq-opts button')],fb=$('#flowBar'),st=$('#toeicBody .tq-stick'),q=$('#toeicBody .tq-q');return {flow:!!fb&&!fb.hidden,lim:Math.round(lim),first:Math.round(o[0].getBoundingClientRect().bottom),firstTop:Math.round(o[0].getBoundingClientRect().top),last:Math.round(o[o.length-1].getBoundingClientRect().bottom),top:Math.round($('#toeicBody .tq-top').getBoundingClientRect().top),stick:st?Math.round(st.getBoundingClientRect().top):null,q:q?Math.round(q.getBoundingClientRect().bottom):null}});
const KEEP=['qStat','quizRight','quizWrong','wrongWords','lsWrong','sqWrong','phWrong'];

// ---------- A. 開啟 App、入口、說明 ----------
const A=await open();{const {pg,errs,E}=A;
await sleep(1500);
const a1=await E(()=>({bank:!!window.TOEIC_BANK,ready:!!TQ_READY,prep:_tqFP===null,poll:TQ.poll,est:JSON.stringify(store.toeicEst),off:JSON.stringify(store.toeicOfficial)}));
const order=LOG.filter(p=>/^\/data[^/]*\.js$/.test(p));
ok('開啟 App 時不下載多益題目檔（data-toeic.js），也不先準備題目；字庫照原本的順序下載（data.js → data-ex.js → data-more.js → data-ex2.js）',!LOG.includes('/data-toeic.js')&&!a1.bank&&!a1.ready&&a1.prep&&!a1.poll&&order.join(' ')==='/data.js /data-ex.js /data-more.js /data-ex2.js',JSON.stringify({order,a1}));
ok('沒有紀錄時，學習紀錄的估計（toeicEst）和正式成績（toeicOfficial）是空的清單',a1.est==='[]'&&a1.off==='[]',a1.est+' '+a1.off);
await pg.click('#navStats');await sleep(300);
const a2=await E(()=>{const c=document.querySelector('#tqCard'),hs=[...document.querySelectorAll('#statsBody h3')].map(h=>h.textContent);return {h:c&&c.textContent,card:(document.querySelector('#statsBody .tq-card')||{}).textContent||'',btn:[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent),i:hs.findIndex(h=>/多益程度估計/.test(h)),w:hs.findIndex(h=>/單字（已熟）/.test(h)),last:hs[hs.length-1]}});
ok('統計頁有「📈 多益程度估計（非官方）」卡片（在每週摘要之後）：還沒做過時說明約 20 分鐘、40 題，按鈕「開始（約 20 分鐘）」；最後一個標題仍是「💽 儲存空間」',a2.h==='📈 多益程度估計（非官方）'&&/40 題（聽力 20、閱讀 20）/.test(a2.card)&&/不是正式分數/.test(a2.card)&&JSON.stringify(a2.btn)==='["開始（約 20 分鐘）"]'&&a2.i>=0&&a2.i<a2.w&&/儲存空間/.test(a2.last),JSON.stringify(a2));
await pg.click('#navQuiz');await sleep(200);
const optT=await E(()=>($('#quizType option[value="toeic"]')||{}).textContent);
await pg.selectOption('#quizType','toeic');await sleep(250);
const a3=await E(()=>({card:!!document.querySelector('#quizQ .tq-qcard'),t:($('#quizQ .tq-ct')||{}).textContent,btn:[...document.querySelectorAll('#quizQ .tq-card button')].map(b=>b.textContent),next:getComputedStyle($('#newQuiz')).display,opts:document.querySelectorAll('#quizOpts button').length,qs:JSON.stringify(store.qStat||{})}));
await pg.selectOption('#quizType','word');await sleep(250);
const a3b=await E(()=>({next:getComputedStyle($('#newQuiz')).display,card:!!document.querySelector('#quizQ .tq-qcard'),q:$('#quizQ').textContent.trim().length}));
ok('測驗類型選單有「📈 多益程度估計（非官方）」：選了顯示同一張卡片（開始按鈕），「下一題」收起來；換回單字測驗就恢復',optT==='📈 多益程度估計（非官方）'&&a3.card&&a3.t==='📈 多益程度估計（非官方）'&&JSON.stringify(a3.btn)==='["開始（約 20 分鐘）"]'&&a3.next==='none'&&a3.opts===0&&a3b.next!=='none'&&!a3b.card&&a3b.q>0,JSON.stringify([optT,a3,a3b]));
await pg.selectOption('#quizType','toeic');await sleep(250);
const n0=LOG.length;await pg.click('#quizQ [data-tq="start"]');await sleep(150);
const a4=await E(()=>({vis:!$('#toeicPage').hidden,quiz:$('#quiz').hidden,stats:$('#statsPage').hidden,nav:(document.querySelector('nav button.active')||{}).id,t:$('#toeicBody').textContent,back:($('#toeicBody [data-tq="back"]')||{}).textContent}));
await ready(pg);const a4b=await E(()=>({go:$('#toeicBody [data-tq="go"]').disabled,ready:TQ_READY}));
ok('按「開始」先看到說明：40 題（聽力 20、閱讀 20）、聽力題用手機語音念、結果只是大概的程度和進步趨勢、不是正式分數；這時才下載 data-toeic.js',a4.vis&&a4.quiz&&a4.stats&&/40 題：聽力 20、閱讀 20/.test(a4.t)&&/手機語音/.test(a4.t)&&/大概的程度和進步趨勢，不是正式分數/.test(a4.t)&&/題本 A/.test(a4.t)&&LOG.slice(n0).includes('/data-toeic.js')&&a4b.ready&&!a4b.go,JSON.stringify(a4).slice(0,400));
ok('從測驗選單進來：底部選單停在「測驗」，左上角是「← 返回測驗」',a4.nav==='navQuiz'&&a4.back==='← 返回測驗',JSON.stringify([a4.nav,a4.back]));
await pg.click('#toeicBody [data-tq="back"]');await sleep(250);
const a5=await E(()=>({quiz:!$('#quiz').hidden,card:!!document.querySelector('#quizQ .tq-qcard'),toeic:$('#toeicPage').hidden}));
ok('按「← 返回測驗」回到測驗頁的卡片',a5.quiz&&a5.card&&a5.toeic,JSON.stringify(a5));

// ---------- C. 完整做一次（題本 A） ----------
const before=await E(K=>{const o={};K.forEach(k=>o[k]=JSON.stringify(store[k]===undefined?null:store[k]));o.log=JSON.stringify((store.dailyLog||{})[day()]||{});return o},KEEP);
await pg.click('#quizQ [data-tq="start"]');await ready(pg);
const s0=await E(()=>window.__said.length);
await pg.click('#toeicBody [data-tq="go"]');await sleep(150);
const F0=[['應答問題',await fit(E)]];
const c1=await E(()=>({types:TQ.run.items.map(x=>x.t).join(','),form:TQ.run.form,top:$('#toeicBody .tq-top').textContent,run:!!localStorage.getItem('e5k_toeic_run')}));
const want=['qr','lm','sf','rd'].map((t,k)=>Array([10,10,12,8][k]).fill(t).join(',')).join(',');
ok('開始作答：40 題依序是應答問題 10 → 聽句子選意思 10 →（閱讀）句子填空 12 → 短文閱讀 8；第一次用題本 A',c1.types===want&&c1.form==='A'&&/聽力・應答問題 1／10/.test(c1.top)&&/第 1／40 題・題本 A/.test(c1.top)&&c1.run,JSON.stringify(c1).slice(0,300));
await pg.waitForFunction(n=>window.__said.length>=n+4&&!TQ.playing,s0,{timeout:15000}).catch(()=>{});
const c2=await E(n=>{const R=TQ.run,it=R.items[0],x=TOEIC_BANK.forms.A.qr.find(q=>q.id===it.id);const want=[x.q].concat(it.o.map((o,k)=>'ABC'[k]+'. '+x.o[o]));const body=$('#toeicBody').textContent;
 return {said:window.__said.slice(n),want,rate:window.__rate.slice(n),shown:x.o.filter(o=>body.includes(o)).length+(body.includes(x.q)?1:0),btn:[...document.querySelectorAll('#toeicBody [data-ans]')].map(b=>b.textContent),play:$('#tqPlay').textContent,dis:$('#tqPlay').disabled}},s0);
ok('應答問題：自動念題目，再念「A …」「B …」「C …」三個回答；畫面不顯示題目和回答的英文，只有 A、B、C 三個按鈕',JSON.stringify(c2.said)===JSON.stringify(c2.want)&&c2.rate.every(r=>Math.abs(r-0.9)<1e-6)&&c2.shown===0&&c2.btn.join()==='A,B,C'&&c2.play==='🔁 再聽一次'&&!c2.dis,JSON.stringify(c2).slice(0,500));
await pg.click('#tqPlay');await sleep(100);const c3a=await E(()=>({t:$('#tqPlay').textContent,dis:$('#tqPlay').disabled}));
await pg.waitForFunction(n=>window.__said.length>=n+8&&!TQ.playing,s0,{timeout:15000}).catch(()=>{});
const c3=await E(n=>({again:window.__said.slice(n+4),first:window.__said.slice(n,n+4),t:$('#tqPlay').textContent,dis:$('#tqPlay').disabled,rep:TQ.run.rep[0]}),s0);
await E(()=>{$('#tqPlay').disabled=false;$('#tqPlay').click()});await sleep(1500);const c3b=await E(n=>window.__said.length-n,s0);
ok('「🔁 再聽一次」：播放中按鈕停用；再念一次題目和三個回答；每題只能用一次（之後按鈕顯示「🔁 已重聽」並停用）',c3a.dis&&/播放中/.test(c3a.t)&&JSON.stringify(c3.again)===JSON.stringify(c3.first)&&c3.t==='🔁 已重聽'&&c3.dis&&c3.rep===1&&c3b===8,JSON.stringify({c3a,c3,c3b}).slice(0,400));
/* 作答：每 3 題答錯 1 題（第 3、6、9…題），記下每一部分答對幾題 */
const plan=k=>k%3===2?'wrong':'right';
for(let k=0;k<10;k++)await answer(pg,plan(k));
await pg.waitForFunction(()=>TQ.run.i===10&&!TQ.playing&&window.__said.length>0,null,{timeout:10000}).catch(()=>{});
F0.push(['聽句子選意思',await fit(E)]);
const c4=await E(()=>{const R=TQ.run,it=R.items[R.i],x=BY_WORD[it.w],opts=[...document.querySelectorAll('#toeicBody [data-ans]')].map(b=>b.textContent),S2=new Set(ALLS.filter(s=>s.src==='word2').map(s=>s.zh));
 return {top:$('#toeicBody .tq-top').textContent,said:window.__said[window.__said.length-1],en:x.ex2,shownEn:$('#toeicBody').textContent.includes(x.ex2),opts,right:opts.filter(o=>o===x.exz2).length,c:it.c,okPos:opts[it.c]===x.exz2,allWord2:opts.every(o=>S2.has(o)),uniq:new Set(opts).size}});
ok('聽句子選意思：念多益長例句的英文（畫面不顯示英文），4 個中文選項只有一個是這句的意思，其他 3 個是別的多益長例句的中文',/聽力・聽句子選意思 1／10/.test(c4.top)&&c4.said===c4.en&&!c4.shownEn&&c4.opts.length===4&&c4.right===1&&c4.okPos&&c4.allWord2&&c4.uniq===4,JSON.stringify(c4).slice(0,500));
for(let k=10;k<20;k++)await answer(pg,plan(k));
await sleep(200);F0.push(['句子填空',await fit(E)]);
const c5=await E(()=>{const R=TQ.run,P=tqFillPrep(),bad=[];
 R.items.filter(x=>x.t==='sf').forEach(it=>{const x=BY_WORD[it.w],e=x.ex2,f=it.o[it.c],tok=e.substr(it.at,it.len);
  const xs=new Set(zhSenses(x.zh)),low=e.toLowerCase(),toks=new Set(low.match(/[a-z]+/g));
  if(tok.toLowerCase()!==f)bad.push(it.w+': blank');
  if(new Set(it.o).size!==4||it.o.filter(o=>o===f).length!==1)bad.push(it.w+': options');
  if(!x.toeic||(x.pos||'')!=='n.')bad.push(it.w+': target');
  it.b.forEach((w,k)=>{if(k===it.c)return;const y=BY_WORD[w];if(!y){bad.push(w+': ?');return}
   if(!String(y.pos).split('/').includes('n.'))bad.push(w+': pos '+y.pos);
   if(toks.has(it.o[k])||toks.has(w))bad.push(w+': in sentence');
   if(zhSenses(y.zh).some(z=>xs.has(z)))bad.push(w+': same meaning');
   if((y.t||[]).some(t=>(x.t||[]).includes(t)))bad.push(w+': same topic');
   if(f!==it.w&&it.o[k]===w)bad.push(w+': form');
   if((y.t||[]).some(t=>/^(people|feel|society|basic|time|num)$/.test(t)))bad.push(w+': generic')})});
 const it=R.items[R.i],e=BY_WORD[it.w].ex2;
 return {bad,top:$('#toeicBody .tq-top').textContent,sent:$('#toeicBody .tq-sent').textContent,want:e.slice(0,it.at)+'_____'+e.slice(it.at+it.len),btn:[...document.querySelectorAll('#toeicBody [data-ans]')].map(b=>b.textContent),o:it.o,n:R.items.filter(x=>x.t==='sf').length}});
ok('句子填空：句子裡的多益字（名詞）變成空格；4 個選項只有一個是句子原本的字（同樣的詞形），另外 3 個是同詞性、不在句子裡、意思和主題都不同的字（12 題都檢查）',/閱讀・句子填空 1／12/.test(c5.top)&&c5.sent===c5.want&&JSON.stringify(c5.btn)===JSON.stringify(c5.o)&&c5.n===12&&c5.bad.length===0,JSON.stringify(c5).slice(0,600));
for(let k=20;k<32;k++)await answer(pg,plan(k));
await sleep(200);F0.push(['短文閱讀',await fit(E)]);
ok('一般手機（390×844）：每種題目出來時，題目在畫面上方，應答問題、聽句子選意思、句子填空的選項全部在底部選單上方，短文題的第一個選項也在上方',F0.every(([n,f])=>!f.flow&&f.first<=f.lim&&(n==='短文閱讀'||f.last<=f.lim)&&(f.stick!==null||f.top>=0)),JSON.stringify(F0));
const c6=[];for(let k=32;k<40;k++){c6.push(await E(()=>{const R=TQ.run,it=R.items[R.i],p=TOEIC_BANK.forms.A.rd.find(x=>x.id===it.id),q=p.qs[it.q],pass=$('#toeicBody .tq-pass'),r=pass.getBoundingClientRect();
 return {id:it.id,q:it.q,pass:pass.textContent===p.text,vis:r.bottom>0&&r.top<innerHeight&&r.height>40,qt:$('#toeicBody .tq-q').textContent===q.q,opts:[...document.querySelectorAll('#toeicBody [data-ans]')].map(b=>b.textContent.replace(/^[ABCD]\. /,'')).sort().join('|')===q.o.slice().sort().join('|'),n:document.querySelectorAll('#toeicBody [data-ans]').length,top:$('#toeicBody .tq-top').textContent}}));await answer(pg,plan(k))}
const ids=c6.map(x=>x.id);
ok('短文閱讀：4 篇文章（電子郵件、公告、備忘錄、訊息）各 2 題、每題 4 個選項；作答時文章一直顯示，第 2 題還是同一篇',c6.length===8&&c6.every(x=>x.pass&&x.vis&&x.qt&&x.opts&&x.n===4)&&new Set(ids).size===4&&[0,2,4,6].every(k=>ids[k]===ids[k+1]&&c6[k].q===0&&c6[k+1].q===1)&&/閱讀・短文閱讀 1／8/.test(c6[0].top),JSON.stringify(c6.map(x=>[x.id,x.q,x.pass,x.vis,x.qt,x.opts,x.n])));
await sleep(500);
// ---------- E. 結果 ----------
const e1=await E(()=>({res:!!document.querySelector('#toeicBody .tq-res'),t:$('#toeicBody').textContent,parts:[...document.querySelectorAll('#toeicBody .tq-pr')].map(d=>d.textContent),est:JSON.parse(JSON.stringify(store.toeicEst)),run:JSON.parse(localStorage.getItem('e5k_toeic_run')),items:TQ.run.items.map(x=>[x.t,x.n])}));
const P={qr:[0,0],lm:[0,0],sf:[0,0],rd:[0,0]};let cL=0,cR=0;const ksL=[],ksR=[];e1.items.forEach(([t,n],k)=>{const r=plan(k)==='right';P[t][1]++;if(r)P[t][0]++;if(t==='qr'||t==='lm'){ksL.push(n);if(r)cL++}else{ksR.push(n);if(r)cR++}});
const SL=score(cL,ksL),SR=score(cR,ksR),est=e1.est[0]||{};
ok('做完 40 題顯示結果：各部分答對題數（應答問題 '+P.qr.join('／')+'、聽句子選意思 '+P.lm.join('／')+'、句子填空 '+P.sf.join('／')+'、短文閱讀 '+P.rd.join('／')+'）、聽力和閱讀的分數範圍、合計範圍',e1.res&&JSON.stringify(e1.parts)===JSON.stringify(['🎧 聽力・應答問題'+P.qr.join('／'),'🎧 聽力・聽句子選意思'+P.lm.join('／'),'📝 閱讀・句子填空'+P.sf.join('／'),'📄 閱讀・短文閱讀'+P.rd.join('／')])&&e1.t.includes(`🎧 聽力約 ${SL.lo}–${SL.hi}`)&&e1.t.includes(`📖 閱讀約 ${SR.lo}–${SR.hi}`)&&e1.t.includes(`合計約 ${SL.lo+SR.lo}–${SL.hi+SR.hi}`),JSON.stringify({parts:e1.parts,SL,SR}).slice(0,400)+' | '+e1.t.slice(0,300));
ok('分數照公式算（聽力 '+cL+' 題對 → '+SL.S+'、閱讀 '+cR+' 題對 → '+SR.S+'）：先扣掉猜對的期望值（應答問題 3 選 1、其他 4 選 1），換算成 5–495、取 5 的倍數，範圍是 ±50',est.estL===SL.S&&est.estR===SR.S&&est.estL%5===0&&est.estR%5===0,JSON.stringify(est));
const e2=await E(()=>{const L=[...Array(10).fill(3),...Array(10).fill(4)],Rk=Array(20).fill(4);return {all:tqScore(20,L).S,none:tqScore(0,L).S,guess:tqScore(6,L).S,c13:tqScore(13,L).S,r12:tqScore(12,Rk).S,r20:tqScore(20,Rk).S,r5:tqScore(5,Rk).S,band30:tqBand(30),band480:tqBand(480),b300:tqBand(300)}});
ok('計分公式：全對 495、全錯 5、和猜的差不多（聽力 6 題）只有 5 分左右；聽力 13 題 255、閱讀 12 題 235、閱讀 5 題（剛好是猜的期望值）5；範圍 ±50 但不會小於 5 或大於 495',e2.all===495&&e2.none===5&&e2.guess<=10&&e2.c13===255&&e2.r12===235&&e2.r20===495&&e2.r5===5&&e2.band30.join()==='5,80'&&e2.band480.join()==='430,495'&&e2.b300.join()==='250,350',JSON.stringify(e2));
const e3=await E(()=>[tqCefr('L',60),tqCefr('L',55),tqCefr('L',110),tqCefr('L',270),tqCefr('L',275),tqCefr('L',395),tqCefr('L',400),tqCefr('L',490),tqCefr('R',115),tqCefr('R',110),tqCefr('R',385),tqCefr('R',380),tqCefr('R',455),tqCefr('R',450)]);
ok('CEFR 用 ETS 公布的各級最低分數對照（聽力 A1 60、A2 110、B1 275、B2 400、C1 490；閱讀 A1 60、A2 115、B1 275、B2 385、C1 455），結果頁說明 ETS 把這些分數當作參考指引、不是門檻分數',JSON.stringify(e3)===JSON.stringify(['約 A1','未達 A1','約 A2','約 A2','約 B1','約 B1','約 B2','約 C1','約 A2','約 A1','約 B2','約 B1','約 C1','約 B2'])&&e1.t.includes('CEFR '+await E(s=>tqCefr('L',s),SL.S))&&/參考指引（guidelines），不是門檻分數（cut scores）/.test(e1.t)&&/不是正式成績/.test(e1.t)&&/每部分只有 20 題/.test(e1.t),JSON.stringify(e3));
const e4=await E(()=>{const R=TQ.run,wrong=R.items.map((it,k)=>k).filter(k=>R.ans[k]!==R.items[k].c),rv=[...document.querySelectorAll('#toeicBody .tq-rv')];
 const q0=wrong.find(k=>R.items[k].t==='qr'),it=R.items[q0],x=TOEIC_BANK.forms.A.qr.find(q=>q.id===it.id),el=rv[wrong.indexOf(q0)],t=el?el.textContent:'';
 const l0=wrong.find(k=>R.items[k].t==='lm'),el2=rv[wrong.indexOf(l0)],t2=el2?el2.textContent:'',xl=BY_WORD[R.items[l0].w];
 const r0=wrong.find(k=>R.items[k].t==='rd'),el3=rv[wrong.indexOf(r0)],p=TOEIC_BANK.forms.A.rd.find(z=>z.id===R.items[r0].id),q=p.qs[R.items[r0].q];
 return {head:($('#tqRev')||{}).textContent,n:rv.length,wrong:wrong.length,qr:t.includes(x.q)&&x.o.every(o=>t.includes(o))&&t.includes(x.zh)&&/✓ 正確答案/.test(t)&&/✗ 你的答案/.test(t)&&!!el.querySelector('[data-tq="say"]'),
  lm:t2.includes(xl.ex2)&&t2.includes(xl.exz2)&&t2.includes(xl.zh),rd:!!el3&&el3.textContent.includes(q.q)&&el3.textContent.includes(q.zh)&&!!el3.querySelector('details .tq-pass')}});
const s1=await E(()=>window.__said.length);await pg.click('#toeicBody .tq-rv [data-tq="say"]');await sleep(200);const e4s=await E(n=>window.__said.slice(n),s1);
ok('結果頁列出答錯的題目（'+e4.wrong+' 題）：聽力題附原文（題目和 A、B、C 回答）、正確答案和你的答案，每題都有中文說明；「🔊 再聽」可以再聽原文；短文題可以展開看文章',e4.n===e4.wrong&&e4.wrong===13&&/答錯的題目（13）/.test(e4.head)&&e4.qr&&e4.lm&&e4.rd&&e4s.length===1&&/\?|\./.test(e4s[0]||''),JSON.stringify({e4,e4s}).slice(0,400));
ok('結果存進學習紀錄（toeicEst）：日期、題本 A、各部分答對／題數、聽力和閱讀的估計分數、作答秒數；作答進度標成已完成',e1.est.length===1&&est.date===day()&&est.form==='A'&&JSON.stringify(est.parts)===JSON.stringify(P)&&est.seconds>=10&&est.seconds<=3600&&e1.run&&e1.run.done===1&&JSON.stringify(e1.run.est)===JSON.stringify(est),JSON.stringify(est));
const after=await E(K=>{const o={};K.forEach(k=>o[k]=JSON.stringify(store[k]===undefined?null:store[k]));o.log=JSON.stringify((store.dailyLog||{})[day()]||{});return o},KEEP);
ok('估計的作答不計入題型統計（qStat）、測驗正確率和錯題本（單字、句子、情境題、片語）',JSON.stringify(before)===JSON.stringify(after),JSON.stringify([before,after]).slice(0,400));
const e6=await E(()=>({svg:!!document.querySelector('#toeicBody svg.tq-chart'),dots:document.querySelectorAll('#toeicBody svg.tq-chart circle').length,lib:typeof window.Chart+typeof window.d3,hist:document.querySelectorAll('#toeicBody .tq-hist > div').length}));
ok('結果頁有進步趨勢圖（網頁內建的 SVG，不用圖表程式庫）：每次估計畫聽力、閱讀各一個點',e6.svg&&e6.dots===2&&e6.lib==='undefinedundefined'&&e6.hist===1,JSON.stringify(e6));
await pg.click('#navStats');await sleep(300);
const e7=await E(()=>({card:($('#statsBody .tq-card')||{}).textContent||'',btn:[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent)}));
ok('統計頁卡片顯示上次的估計（日期、題本、聽力和閱讀的範圍、合計），可以再開始或看「📊 結果與紀錄」',e7.card.includes(`上次 ${day().replace(/-/g,'/')}（題本 A）：聽力 約 ${SL.lo}–${SL.hi}、閱讀 約 ${SR.lo}–${SR.hi}`)&&e7.card.includes(`合計 約 ${SL.lo+SR.lo}–${SL.hi+SR.hi}`)&&JSON.stringify(e7.btn)==='["開始（約 20 分鐘）","📊 結果與紀錄"]',JSON.stringify(e7));

// ---------- F. 題本輪流、避開上一次的句子 ----------
/* 再做 4 次（作答直接填好，只看出題）：第 2 次放棄 */
const f1=await E(async()=>{const out=[],gens=[];for(let n=0;n<4;n++){const old=JSON.parse(localStorage.getItem('e5k_toeic_run'));tqAct('start',null,'stats');tqStart();const R=TQ.run;
  out.push({form:R.form,overlap:R.gen.filter(w=>old.gen.includes(w)).length,avoid:old.gen.every(w=>R.avoid.includes(w)),prev2:n===2?gens[0].filter(w=>R.gen.includes(w)).length:0,n:R.items.length,gen:R.gen.length});gens.push(R.gen);
  if(n===1){tqDiscard();continue}
  R.ans=R.items.map((it,k)=>n===3&&k%4===0?(it.c+1)%it.n:it.c);R.i=R.items.length-1;TQ.readyAt=0;tqAnswer(R.ans[R.i])}
 return {out,forms:store.toeicEst.map(e=>e.form).join('')}});
ok('題本輪流：做完 A 之後用 B；用 C 的那次放棄的話，下次還是 C，再下一次回到 A；多益長例句的題目每次都避開上一次（含放棄的那次）用過的句子',f1.forms==='ABCA'&&f1.out.map(x=>x.form).join('')==='BCCA'&&f1.out.every(x=>x.overlap===0&&x.avoid&&x.prev2===0&&x.n===40&&x.gen===22),JSON.stringify(f1));
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '))}

// ---------- G. 正式成績 ----------
{const {pg,errs,E}=A;
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="hist"]');await sleep(300);
const estBefore=await E(()=>JSON.stringify(store.toeicEst));
await pg.click('#toeicBody [data-tq="oform"]');await sleep(200);
const tryOff=async(d,l,r)=>{await pg.fill('#tqOd',d);await pg.fill('#tqOl',String(l));await pg.fill('#tqOr',String(r));await pg.click('#toeicBody [data-tq="osave"]');await sleep(150);return E(()=>({msg:$('#tqOmsg')&&!$('#tqOmsg').hidden?$('#tqOmsg').textContent:'',n:store.toeicOfficial.length}))};
const g=[await tryOff(day(-10),352,300),await tryOff(day(-10),500,300),await tryOff(day(-10),'',300),await tryOff(day(-10),300,0),await tryOff(day(3),300,300)];
ok('輸入正式成績：聽力、閱讀要是 5–495 的 5 的倍數，考試日期不能是未來；不對時顯示提示，不會存起來',/聽力分數要是 5–495、5 的倍數/.test(g[0].msg)&&/聽力分數/.test(g[1].msg)&&/聽力分數/.test(g[2].msg)&&/閱讀分數要是 5–495、5 的倍數/.test(g[3].msg)&&/考試日期/.test(g[4].msg)&&g.every(x=>x.n===0),JSON.stringify(g));
const g2=await tryOff(day(-10),355,300);
const G2=await E(()=>{const o=store.toeicOfficial[0],e=store.toeicEst[store.toeicEst.length-1],row=($('#toeicBody .tq-orow')||{}).textContent||'';return {o,row,diff:'聽力 '+(o.L-e.estL>0?'+':o.L-e.estL<0?'−':'±')+Math.abs(o.L-e.estL||0),rects:document.querySelectorAll('#toeicBody svg.tq-chart rect').length,msg:($('#toeicBody .rec-msg.ok')||{}).textContent||''}});
const estAfter=await E(()=>JSON.stringify(store.toeicEst));
ok('正確的正式成績存起來（日期、聽力、閱讀），畫在進步趨勢圖上（菱形）；和 60 天內的估計比較，顯示相差多少；估計紀錄完全不變',G2.o.date===day(-10)&&G2.o.L===355&&G2.o.R===300&&/已記下/.test(G2.msg)&&G2.row.includes('聽力 355・閱讀 300・合計 655')&&G2.row.includes('相隔 10 天')&&G2.row.includes(G2.diff.replace('±0','±0'))&&G2.rects===2&&estBefore===estAfter,JSON.stringify(G2));
await pg.click('#toeicBody [data-tq="oform"]');await sleep(150);await tryOff(day(-200),250,200);
const g3=await E(()=>[...document.querySelectorAll('#toeicBody .tq-orow')].map(r=>r.textContent));
ok('考試日期前後 60 天內沒有估計時，顯示沒有可以比較的估計；清單新的在上面',g3.length===2&&/前後 60 天內沒有估計可以比較/.test(g3[1])&&/聽力 355/.test(g3[0]),JSON.stringify(g3));
pg.__ans=false;await pg.click('#toeicBody .tq-orow:last-child [data-tq="odel"]');await sleep(150);const g4a=await E(()=>store.toeicOfficial.length);
pg.__ans=true;await pg.click('#toeicBody .tq-orow:last-child [data-tq="odel"]');await sleep(150);const g4=await E(()=>store.toeicOfficial.map(o=>o.date));
ok('正式成績可以刪除（先確認；取消就不刪）',g4a===2&&g4.length===1&&g4[0]===day(-10),JSON.stringify([g4a,g4]));
ok('正式成績測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '))}

// ---------- H. 備份匯出、匯入 ----------
{const {pg,errs,E}=A;
await pg.click('#navStats');await sleep(300);
const orig=await E(()=>JSON.stringify([store.toeicEst,store.toeicOfficial]));
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const chunks=[];for await(const c of await dl.createReadStream())chunks.push(c);const ex=JSON.parse(Buffer.concat(chunks).toString('utf8'));
ok('匯出的備份檔有估計紀錄和正式成績',JSON.stringify([ex.progress.toeicEst,ex.progress.toeicOfficial])===orig&&ex.progress.toeicEst.length===4,orig.slice(0,200));
await E(()=>{store.toeicEst=[];store.toeicOfficial=[];saveNow()});
await pg.setInputFiles('#bkImport',{name:'p34_backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(ex))});await pg.waitForLoadState('load');await sleep(1500);
const h2=await E(()=>JSON.stringify([store.toeicEst,store.toeicOfficial]));
ok('備份檔匯入後，估計紀錄和正式成績都還原（和匯出前一樣）',h2===orig,h2.slice(0,200));
const nL=LOG.length,bank0=await E(()=>!!window.TOEIC_BANK);await pg.click('#statsBody [data-tq="hist"]');
await pg.waitForFunction(()=>document.querySelectorAll('#toeicBody .tq-rv').length>0,null,{timeout:20000}).catch(()=>{});
const h2r=await E(()=>({n:document.querySelectorAll('#toeicBody .tq-rv').length,head:($('#tqRev')||{}).textContent,zh:document.querySelectorAll('#toeicBody .tq-rv .tq-zh').length}));
ok('重新開啟 App 後，「📊 結果與紀錄」還能看最近一次的檢討（答錯 10 題，每題有中文說明；這時才下載題目檔）',!bank0&&h2r.n===10&&/答錯的題目（10）/.test(h2r.head)&&h2r.zh>=10&&LOG.slice(nL).includes('/data-toeic.js'),JSON.stringify({bank0,h2r}));
await pg.click('#navStats');await sleep(300);
const bad=JSON.parse(JSON.stringify(ex));const E0=ex.progress.toeicEst[0];
bad.progress.toeicEst=[];for(let k=0;k<55;k++)bad.progress.toeicEst.push(Object.assign({},E0,{date:'2026-0'+(1+k%9)+'-1'+(k%10),estL:100+5*k,estR:200}));
bad.progress.toeicEst.push(Object.assign({},E0,{estL:7}),Object.assign({},E0,{estR:500}),Object.assign({},E0,{date:'2026-13-01'}),Object.assign({},E0,{date:'2026-02-30'}),'oops',Object.assign({},E0,{form:'Z',estL:'250',parts:{qr:[11,10],lm:'x',sf:[3,12]},seconds:-5}));
bad.progress.toeicOfficial=[];for(let k=0;k<23;k++)bad.progress.toeicOfficial.push({date:'2025-'+String(1+k%12).padStart(2,'0')+'-'+String(10+k%18).padStart(2,'0'),L:300,R:250});
bad.progress.toeicOfficial.push({date:'2025-05-05',L:302,R:250},{date:'2025-05-06',L:300,R:0},{date:'x',L:300,R:300});
await pg.setInputFiles('#bkImport',{name:'p34_bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await pg.waitForLoadState('load');await sleep(1500);
const h3=await E(()=>({n:store.toeicEst.length,last:store.toeicEst[store.toeicEst.length-1],okAll:store.toeicEst.every(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.estL%5===0&&e.estL>=5&&e.estL<=495&&e.estR%5===0&&e.estR<=495&&/^[ABC]$/.test(e.form)),off:store.toeicOfficial.length,offSorted:store.toeicOfficial.every((o,k,a)=>!k||a[k-1].date<=o.date),offOk:store.toeicOfficial.every(o=>o.L%5===0&&o.R>=5)}));
ok('匯入有問題的資料：不合理的分數（7、500、不是 5 的倍數）、不存在的日期會被略過，分數寫成文字也能讀；估計最多留最近 50 筆、正式成績最多 20 筆（依日期排好）',h3.n===50&&h3.okAll&&h3.last.form==='A'&&h3.last.estL===250&&JSON.stringify(h3.last.parts)==='{"sf":[3,12]}'&&h3.last.seconds===0&&h3.off===20&&h3.offSorted&&h3.offOk,JSON.stringify(h3));
ok('備份測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await A.ctx.close()}

// ---------- D. 中途離開、繼續、放棄 ----------
{const {pg,errs,E}=await open();
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');await ready(pg);await pg.click('#toeicBody [data-tq="go"]');
let s3=0;for(let k=0;k<3;k++){await pg.waitForFunction(()=>!TQ.playing,null,{timeout:10000}).catch(()=>{});if(k===2)s3=await E(()=>window.__said.length);await answer(pg,'right')}
await sleep(250);
const d1a=await E(()=>({i:TQ.run.i,playing:TQ.playing,c:window.__cancel}));
await pg.click('#navToday');await sleep(2500);
const d1=await E(n=>({said:window.__said.slice(n),c:window.__cancel,run:JSON.parse(localStorage.getItem('e5k_toeic_run')),q:TOEIC_BANK.forms.A.qr.find(x=>x.id===TQ.run.items[3].id).q}),s3);
ok('作答中換到別的頁面：停止播放（念完題目後的 A、B、C 不再念），作答進度存在 e5k_toeic_run（已答 3 題、現在第 4 題、這題還沒播完）',d1a.i===3&&d1a.playing&&d1.said.length===1&&d1.said[0]===d1.q&&d1.c>d1a.c&&d1.run.i===3&&d1.run.ans.slice(0,4).join()===[0,1,2].map(k=>d1.run.items[k].c).join()+',-1'&&d1.run.d===day()&&!d1.run.heard[3]&&!d1.run.done,JSON.stringify({d1a,said:d1.said,i:d1.run.i,c:d1.c}));
await pg.click('#navStats');await sleep(300);
const d2a=await E(()=>({card:$('#statsBody .tq-card').textContent,btn:[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent)}));
const s4=await E(()=>window.__said.length);await pg.click('#statsBody [data-tq="resume"]');await sleep(150);
await pg.waitForFunction(n=>window.__said.length>=n+4&&!TQ.playing,s4,{timeout:15000}).catch(()=>{});
const d2=await E(n=>({top:$('#toeicBody .tq-top').textContent,said:window.__said.length-n,play:$('#tqPlay').textContent,rep:!!TQ.run.rep[3],heard:TQ.run.heard[3]}),s4);
ok('統計頁顯示「▶ 繼續上次的估計」（做到第 4／40 題）和「放棄這次」；按繼續回到第 4 題，沒播完的題目重新播放（不算重聽，還可以再聽一次）',/做到第 4／40 題/.test(d2a.card)&&JSON.stringify(d2a.btn)==='["▶ 繼續上次的估計","放棄這次"]'&&/第 4／40 題/.test(d2.top)&&d2.said===4&&d2.play==='🔁 再聽一次'&&!d2.rep&&d2.heard===1,JSON.stringify({d2a,d2}));
await answer(pg,'right');await sleep(200);
await E(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(2200);
const d4=await E(()=>({said:window.__said.slice(-2),i:TQ.run.i,heard:!!TQ.run.heard[4],t0:TQ.t0}));
await E(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(100);
const d4b=await E(()=>({play:$('#tqPlay').textContent,dis:$('#tqPlay').disabled,t0:TQ.t0>0}));
ok('App 切到背景時停止播放、暫停計時；回來後按「▶ 播放題目」可以重新播放這題',d4.i===4&&!d4.heard&&d4.t0===0&&!/^[ABC]\. /.test(d4.said[1]||'')&&d4b.play==='▶ 播放題目'&&!d4b.dis&&d4b.t0,JSON.stringify({d4,d4b}));
await pg.reload();await sleep(800);await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="resume"]');await sleep(300);await pg.waitForFunction(()=>document.querySelector('#toeicBody .tq-top'),null,{timeout:20000}).catch(()=>{});
const d3=await E(()=>({top:($('#toeicBody .tq-top')||{}).textContent,i:TQ.run&&TQ.run.i}));
ok('重新開啟 App 後也可以繼續（回到第 5 題）',/第 5／40 題/.test(d3.top||'')&&d3.i===4,JSON.stringify(d3));
await pg.click('#toeicBody [data-tq="pause"]');await sleep(300);
const d5a=await E(()=>!$('#statsPage').hidden&&/做到第 5／40 題/.test($('#statsBody .tq-card').textContent));
pg.__ans=false;await pg.click('#statsBody .tq-card [data-tq="discard"]');await sleep(200);
const d6a=await E(()=>({can:tqCanResume(tqRunGet()),btn:[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent)}));
pg.__ans=true;await pg.click('#statsBody .tq-card [data-tq="discard"]');await sleep(300);
const d6=await E(()=>({can:tqCanResume(tqRunGet()),btn:[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent),est:store.toeicEst.length,run:JSON.parse(localStorage.getItem('e5k_toeic_run'))}));
ok('「⏸ 暫停」回到統計頁；「放棄這次」先確認（取消就不放棄），確定後不能再繼續、卡片回到「開始」，也不會留下估計紀錄',d5a&&d6a.can&&d6a.btn[0]==='▶ 繼續上次的估計'&&!d6.can&&JSON.stringify(d6.btn)==='["開始（約 20 分鐘）"]'&&d6.est===0&&d6.run.items.length===0&&d6.run.gen.length===22,JSON.stringify({d5a,d6a,d6:{can:d6.can,btn:d6.btn,est:d6.est}}));
/* 隔天：昨天沒做完的不能繼續 */
await pg.click('#statsBody [data-tq="start"]');await ready(pg);await pg.click('#toeicBody [data-tq="go"]');await sleep(300);await answer(pg,'right');await pg.click('#toeicBody [data-tq="pause"]');await sleep(200);
await E(()=>{const r=JSON.parse(localStorage.getItem('e5k_toeic_run'));const d=new Date();d.setDate(d.getDate()-1);r.d=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');localStorage.setItem('e5k_toeic_run',JSON.stringify(r))});
await pg.reload();await sleep(800);await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});await pg.click('#navStats');await sleep(300);
const d7a=await E(()=>[...document.querySelectorAll('#statsBody .tq-card button')].map(b=>b.textContent));
await pg.click('#statsBody [data-tq="start"]');await ready(pg);
const d7=await E(()=>({t:$('#toeicBody').textContent,go:!!$('#toeicBody [data-tq="go"]'),cont:!!$('#toeicBody [data-tq="cont"]')}));
ok('昨天沒做完的估計今天不能繼續：卡片只有「開始」，說明頁提示已經過期、只能重新開始',JSON.stringify(d7a)==='["開始（約 20 分鐘）"]'&&/沒做完的估計已經過期/.test(d7.t)&&d7.go&&!d7.cont,JSON.stringify([d7a,d7.t.slice(0,300)]));
ok('中途離開與繼續測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}

// ---------- B. 下載中、下載失敗、重新下載 ----------
{BLOCK['/data-toeic.js']=1;const {pg,errs,E}=await open();
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');await sleep(300);
const b0=await E(()=>({t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled}));
await pg.waitForFunction(()=>TQ_FAIL,null,{timeout:20000}).catch(()=>{});await sleep(500);
const b1=await E(()=>({t:$('#toeicBody').textContent,retry:!!$('#toeicBody [data-tq="retry"]'),go:$('#toeicBody [data-tq="go"]').disabled}));
ok('題目檔下載中：顯示「題目資料下載中」，還不能開始；下載失敗（重試後）：顯示「題目資料下載失敗」和「🔄 重新下載」',/題目資料下載中/.test(b0.t)&&b0.go&&/題目資料下載失敗/.test(b1.t)&&b1.retry&&b1.go,JSON.stringify({b0,b1}).slice(0,300));
delete BLOCK['/data-toeic.js'];await pg.click('#toeicBody [data-tq="retry"]');await ready(pg);
const b2=await E(()=>({t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled,ready:TQ_READY}));
ok('連上網路後按「重新下載」：題目檔載入，可以開始作答',b2.ready&&!b2.go&&!/下載失敗/.test(b2.t),JSON.stringify(b2).slice(0,200));
ok('下載失敗測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}
{DELAY['/data-ex2.js']=5000;const {pg,errs,E}=await open({wait:false});
await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');await sleep(500);
const b3=await E(()=>({ex2:EX2_READY,bank:TQ_READY,t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled}));
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});await sleep(900);
const b3b=await E(()=>({t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled}));
delete DELAY['/data-ex2.js'];
ok('多益長例句（data-ex2.js）還沒下載完：說明頁顯示下載中、不能開始；下載完自動可以開始（不用重新整理）',!b3.ex2&&/題目資料下載中/.test(b3.t)&&b3.go&&!/下載中/.test(b3b.t)&&!b3b.go,JSON.stringify({b3:[b3.ex2,b3.bank,b3.go],b3b:b3b.go}));
ok('等多益長例句時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}
{BLOCK['/data-ex2.js']=1;const {pg,errs,E}=await open({wait:false});
await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');
await pg.waitForFunction(()=>EX2_FAIL&&!window.__ex2Loading&&document.querySelector('#toeicBody [data-tq="retry"]'),null,{timeout:40000}).catch(()=>{});
const b4=await E(()=>({t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled,fail:EX2_FAIL}));
delete BLOCK['/data-ex2.js'];await pg.click('#toeicBody [data-tq="retry"]');await ready(pg);
const b4b=await E(()=>({ex2:EX2_READY,go:$('#toeicBody [data-tq="go"]').disabled,n:ALLS.filter(s=>s.src==='word2').length}));
ok('多益長例句下載失敗：顯示下載失敗和「🔄 重新下載」；重新下載成功後可以開始，長例句沒有重複加進句子清單',b4.fail&&/題目資料下載失敗/.test(b4.t)&&b4.go&&b4b.ex2&&!b4b.go&&b4b.n===1247,JSON.stringify({b4:[b4.fail,b4.go],b4b}));
ok('長例句下載失敗測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}

// ---------- I. 小手機（360×640）、特大字體、深色模式、底部選單和今日學習進度列 ----------
{const {pg,errs,E}=await open({ctx:{viewport:{width:360,height:640}}});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme();save();flowStart()});await sleep(300);
/* 版面：沒有橫向捲動；按鈕高度至少 40px；控制按鈕的文字不換行；每個按鈕捲到畫面中間時不被底部選單、進度列擋住 */
const LAY=async(where,sel)=>E(([where,sel])=>{const vw=document.documentElement.clientWidth,bad=[];
 if(document.documentElement.scrollWidth>vw+1)bad.push('橫向捲動 '+document.documentElement.scrollWidth);
 const bs=[...document.querySelectorAll(sel)].filter(b=>b.offsetParent&&getComputedStyle(b).visibility!=='hidden');
 bs.forEach(b=>{const r=b.getBoundingClientRect();if(r.height<40)bad.push('高度 '+Math.round(r.height)+' '+b.textContent);if(r.right>vw+1||r.left<-1)bad.push('超出 '+b.textContent);
  if(b.closest('.tq-btns,.tq-audio,.tq-abc,.tq-head,.tq-words')&&__lines(b)!==1)bad.push('換行 '+b.textContent)});
 for(const b of bs){b.scrollIntoView({block:'center'});const r0=b.getBoundingClientRect();window.scrollBy(0,r0.bottom-(bottomLimit()-12));const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(r.bottom>bottomLimit()+1||!t||!b.contains(t)&&t!==b)bad.push('被擋住 '+b.textContent+' ← '+(t&&(t.id||t.className||t.tagName)))}
 return {where,n:bs.length,bad}},[where,sel]);
const L=[];
await pg.click('#navStats');await sleep(300);L.push(await LAY('統計頁卡片','#statsBody .tq-card button'));
await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','toeic');await sleep(200);L.push(await LAY('測驗選單卡片','#quizQ .tq-card button'));
await pg.click('#quizQ [data-tq="start"]');await ready(pg);L.push(await LAY('說明頁','#toeicBody button'));
await pg.click('#toeicBody [data-tq="go"]');await sleep(400);
const F=[];F.push(['應答問題',await fit(E)]);L.push(await LAY('應答問題','#toeicBody button'));
for(let k=0;k<10;k++)await answer(pg,'right');await sleep(300);F.push(['聽句子選意思',await fit(E)]);L.push(await LAY('聽句子選意思','#toeicBody button'));
for(let k=0;k<10;k++)await answer(pg,'right');await sleep(300);F.push(['句子填空',await fit(E)]);L.push(await LAY('句子填空','#toeicBody button'));
for(let k=0;k<12;k++)await answer(pg,'right');await sleep(300);F.push(['短文閱讀',await fit(E)]);L.push(await LAY('短文閱讀','#toeicBody button'));
const st=await E(()=>{const o=[...document.querySelectorAll('#toeicBody .tq-opts button')];o[o.length-1].scrollIntoView({block:'end'});window.scrollBy(0,o[o.length-1].getBoundingClientRect().bottom-(bottomLimit()-8));const p=$('#toeicBody .tq-pass').getBoundingClientRect(),q=$('#toeicBody .tq-q').getBoundingClientRect(),last=o[o.length-1].getBoundingClientRect();return {p:Math.round(p.top)+'–'+Math.round(p.bottom),q:Math.round(q.bottom),last:Math.round(last.bottom),lim:Math.round(bottomLimit()),vis:p.bottom>30&&p.top<innerHeight&&q.bottom>0&&q.bottom<=last.top+2}});
for(let k=0;k<8;k++)await answer(pg,'right');await sleep(400);
await pg.click('#toeicBody [data-tq="oform"]');await sleep(200);L.push(await LAY('結果頁＋正式成績','#toeicBody button'));
const dk=await E(()=>{const c=getComputedStyle($('#toeicBody .tq-res > div')).backgroundColor,t=getComputedStyle($('#toeicBody .tq-res b')).color,svg=getComputedStyle($('#toeicBody .tq-chart text')).fill;return {dark:document.documentElement.classList.contains('dark'),fs:getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),c,t,svg}});
const badL=L.filter(x=>x.bad.length||!x.n);
ok('小手機（360×640）＋特大字體＋深色模式：統計頁卡片、測驗選單卡片、說明、四種題目、結果頁和正式成績都沒有橫向捲動；按鈕高度至少 40px，控制按鈕文字不換行',badL.length===0&&dk.dark&&dk.fs==='1.3',JSON.stringify(badL.length?badL:L.map(x=>x.where+':'+x.n)).slice(0,600));
ok('底部選單和今日學習進度列不會擋住按鈕：每個按鈕都能捲到進度列上方按得到；新題目出來時第一個選項就在進度列上方（短文題的文章和題目固定在上方），應答問題的 A、B、C 全部在上方',F.every(([n,f])=>f.flow&&(n==='短文閱讀'?f.stick>=-1&&f.q<=f.firstTop+2:f.top>=0)&&f.first<=f.lim)&&F.filter(([n])=>n==='應答問題').every(([n,f])=>f.last<=f.lim),JSON.stringify(F));
ok('小手機看短文題：往下捲到最後一個選項時，文章和題目還在畫面上',st.vis&&st.last<=st.lim,JSON.stringify(st));
ok('深色模式：結果卡片是深色底、淺色字，趨勢圖的文字也是淺色',dk.c!=='rgb(238, 244, 253)'&&/rgb\((1[0-9]|2[0-9]|3[0-9]), /.test(dk.c)&&/rgb\((1[5-9]\d|2\d\d), /.test(dk.t)&&dk.svg!=='rgb(107, 127, 152)',JSON.stringify(dk));
ok('版面測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}

// ---------- J. 沒有朗讀功能的瀏覽器 ----------
{const {pg,errs,E}=await open({init:()=>{try{delete window.speechSynthesis;delete window.SpeechSynthesisUtterance}catch(e){}Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined,configurable:true})}});
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');await pg.waitForFunction(()=>TQ_READY&&EX2_READY,null,{timeout:20000}).catch(()=>{});await sleep(600);
const j=await E(()=>({t:$('#toeicBody').textContent,go:$('#toeicBody [data-tq="go"]').disabled}));
ok('瀏覽器不能朗讀英文（例如 LINE 內建瀏覽器）：說明頁提示改用 Safari 或 Chrome，不能開始（聽力題沒辦法作答）',/這個瀏覽器不能朗讀英文/.test(j.t)&&/Safari 或 Chrome/.test(j.t)&&j.go,JSON.stringify(j).slice(0,200));
ok('沒有朗讀功能時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}

// ---------- K. 離線（安裝後的 App） ----------
{const {pg,errs,E}=await open({ctx:{serviceWorkers:'allow'}});
const KS=async()=>{for(let t=0;t<10;t++){try{return await pg.evaluate(()=>caches.keys())}catch(e){await sleep(300)}}return []};
for(let k=0;k<80;k++){if((await KS()).some(x=>x.startsWith('english-5000-data-')))break;await sleep(300)}await sleep(1500);
const k1=await E(async()=>{const k=(await caches.keys()).find(x=>x.startsWith('english-5000-data-'));const c=k&&await caches.open(k);const r=c&&await c.match('data-toeic.js');return {k,len:r?(await r.text()).length:0}});
const want=fs.readFileSync(path.join('site','data-toeic.js'),'utf8').length;
ONLINE=false;await pg.reload().catch(()=>{});await sleep(1500);await pg.waitForFunction(()=>typeof EX2_READY!=='undefined'&&EX2_READY,null,{timeout:20000}).catch(()=>{});
await pg.click('#navStats');await sleep(300);await pg.click('#statsBody [data-tq="start"]');await ready(pg);
const k2=await E(()=>({ready:TQ_READY,go:$('#toeicBody [data-tq="go"]')&&!$('#toeicBody [data-tq="go"]').disabled}));ONLINE=true;
ok('離線快取（安裝後）有 data-toeic.js；沒有網路時也可以開始多益程度估計',k1.len>20000&&k1.len===want&&k2.ready&&k2.go,JSON.stringify({k1,k2,want}));
ok('離線測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await pg.context().close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p34.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
