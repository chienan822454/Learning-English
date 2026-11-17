// V6.6.0：字根強化——複習排程（記住了→明天第一次複習、到期答對延後、答錯排入今天、舊紀錄分散排程、備份檢查）、今日頁「🌱 複習字根」、
// 字根頁（今天要複習、建議先學、待複習、下次複習日）、字根測驗（先學再考、用字根猜字義、連續答對 2 次自動記住、到期優先、複習完提示）、
// 例字卡片與「🌱 回字根」、詞形也顯示字根、回到字根頁時展開的字根在畫面上、小手機＋特大字＋深色、iPhone 靜音模式說明
// V6.6.1：字根例句也能念（例句旁 💬、🐢；「💬 念例句」依序念、標出念到的那一行、■ 停止；按其他按鈕、收起、換頁時停止；例句後下載好自動補上）
// V6.7.0：新增字根 pel / puls（rt105，插在 part 和 pend / pens 之間，舊字根編號不變；K 段：資料、匯出檔、單字卡、字根頁、念例句、搜尋、字根測驗、先學再考）；字根數用 NR
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path');
const PORT=8910,U='http://localhost:8910/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const MISS=[];const NR=105;  /* 字根數（V6.7.0 新增 pel / puls） */
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
 const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
const open=async(o={})=>{const ctx=await b.newContext(Object.assign({viewport:{width:390,height:844},serviceWorkers:'block'},o.ctx||{}));const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),5)};speechSynthesis.cancel=()=>{}});
 if(o.init)await pg.addInitScript(o.init);
 await pg.goto(U);await pg.waitForFunction(()=>typeof ALLS!=='undefined'&&document.readyState==='complete',null,{timeout:30000});
 await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY&&EX_READY&&window.ROOTS,null,{timeout:40000});
 await sleep(200);return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}};
/* 作答：有「新字根」說明先按「開始作答」；right＝true 選正確答案，false 選錯的 */
const answer=(E,right=true)=>E(r=>{const s=document.querySelector('#quizOpts [data-rtstart]');if(s)s.click();
 const bs=[...document.querySelectorAll('#quizOpts button[data-k]')],a=RT.cq&&RT.cq.a,t=bs.find(x=>r?x.textContent===a:x.textContent!==a);if(t)t.click();
 return {id:RT.last,t:RT.cq&&RT.cq.t,ok:!!t,msg:$('#quizMsg').textContent}},right);

/* ===== A. 建議順序、記住了 → 排程 ===== */
{const {ctx,pg,errs,E}=await open();
 const a1=await E(()=>{const o=rtOrder(),ids=o.map(r=>r.id),f=rtFocus().map(r=>r.id);const c12=r=>(r.w||[]).filter(w=>BY_WORD[w]&&BY_WORD[w].k<=2).length;
  const avg=a=>a.reduce((s,r)=>s+c12(r),0)/a.length;return {n:ids.length,u:new Set(ids).size,f,top5:ids.slice(0,5),hi:avg(o.slice(0,20)),lo:avg(o.slice(-20))}});
 ok('建議學習順序：'+NR+' 個字根都在、不重複；前面的字根常用例字（第 1、2 冊）比後面多；建議先學＝順序裡前 5 個還沒記住的',a1.n===NR&&a1.u===NR&&a1.hi>a1.lo+1&&JSON.stringify(a1.f)===JSON.stringify(a1.top5),JSON.stringify(a1));
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(300);
 const p1=await E(()=>({plan:!$('#rtPlan').hidden,sug:[...document.querySelectorAll('#rtPlan [data-rtsug]')].map(b=>b.dataset.rtsug),rev:!!document.querySelector('#rtPlan [data-rtrev]'),chips:[...document.querySelectorAll('#rtFilter [data-rf]')].map(b=>b.dataset.rf)}));
 ok('字根頁上方「🆕 建議先學」5 個（沒有到期時不顯示「開始複習」）；篩選多了「待複習」',p1.plan&&JSON.stringify(p1.sug)===JSON.stringify(a1.f)&&!p1.rev&&JSON.stringify(p1.chips)==='["all","todo","known","due"]',JSON.stringify(p1));
 const sid=a1.f[2];await pg.click(`#rtPlan [data-rtsug="${sid}"]`);await sleep(250);
 const p2=await E(id=>{const c=document.querySelector('#rootList .rt-card.open');const r=c&&c.getBoundingClientRect();return {id:c&&c.dataset.rt,top:r&&r.top,taught:RT.taught.has(id)}},sid);
 ok('點「建議先學」的字根：展開那個字根並捲到畫面上（之後字根測驗不用再先看說明）',p2.id===sid&&p2.top>=0&&p2.top<844&&p2.taught,JSON.stringify(p2));
 const fid=a1.f[0];await E(id=>{RT.open=id;renderRoots();rtShow(id)},fid);await sleep(150);
 await pg.click(`#rootList [data-rtk="${fid}"]`);await sleep(200);
 const k1=await E(id=>({kn:(store.rootKnown||[]).includes(id),st:(store.rtStage||{})[id],due:(store.rtDue||{})[id],tm:day(1),f:rtFocus().map(r=>r.id),sr:(document.querySelector('#rootList .rt-card.open .rt-sr')||{}).textContent||'',sug:[...document.querySelectorAll('#rtPlan [data-rtsug]')].map(b=>b.dataset.rtsug)}),fid);
 ok('按「✓ 記住了」：明天第一次複習（級數 0）；展開的字根顯示「下次複習」日期；「建議先學」補上下一個',k1.kn&&k1.st===0&&k1.due===k1.tm&&/下次複習/.test(k1.sr)&&!k1.f.includes(fid)&&k1.f.length===5&&JSON.stringify(k1.sug)===JSON.stringify(k1.f),JSON.stringify(k1));
 await pg.click(`#rootList [data-rtk="${fid}"]`);await sleep(200);
 const k2=await E(id=>({kn:(store.rootKnown||[]).includes(id),has:'rtDue' in store||'rtStage' in store}),fid);
 ok('改回「還沒記住」：取消複習排程（沒有已記住的字根時學習紀錄裡沒有排程欄位）',!k2.kn&&!k2.has,JSON.stringify(k2));
 ok('沒有 JavaScript 錯誤（建議順序、記住了）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== B. 讀取／匯入學習紀錄 ===== */
{const {ctx,pg,errs,E}=await open();
 const n=await E(()=>{const ids=['rt001','rt002','rt003','rt004','rt005','rt006','rt007','rt008','rt009','rt010'];
  const a=normStore({rootKnown:ids.slice()});
  const b=normStore({rootKnown:['rt001','rt002','rt003'],rtStage:{rt001:3,rt002:'x',rt003:99,rt050:2},rtDue:{rt001:'2026-12-01',rt002:'2026-12-02',rt003:'bad',rt050:'2026-12-03'}});
  const c=normStore({rtStage:{rt001:1},rtDue:{rt001:'2026-12-01'}});
  const bk=checkBackup(JSON.stringify({app:'english-5000',fmt:6,progress:{rtDue:'x',known:[]}})).err||'';
  const days=Object.values(a.rtDue).sort();
  return {n:Object.keys(a.rtDue).length,st:[...new Set(Object.values(a.rtStage))],min:days[0],max:days[days.length-1],d1:day(1),d7:day(7),dist:new Set(days).size,
   b:{st:b.rtStage,due:b.rtDue,d3:!!b.rtDue.rt003&&b.rtDue.rt003>=day(1)&&b.rtDue.rt003<=day(7)},c:'rtDue' in c||'rtStage' in c,bk}});
 ok('舊紀錄（V6.5.0 已記住、還沒有排程）：分散在之後 7 天第一次複習（級數 1）',n.n===10&&JSON.stringify(n.st)==='[1]'&&n.min===n.d1&&n.max===n.d7&&n.dist===7,JSON.stringify(n));
 ok('已有的排程保留；級數不對改成 0、日期不對重新排；不是已記住的字根拿掉；沒有已記住的字根就沒有排程欄位',n.b.st.rt001===3&&n.b.due.rt001==='2026-12-01'&&n.b.st.rt002===0&&n.b.due.rt002==='2026-12-02'&&n.b.d3&&n.b.st.rt003===1&&!('rt050' in n.b.st)&&!('rt050' in n.b.due)&&!n.c,JSON.stringify(n));
 ok('格式不對的備份檔（rtDue 不是物件）不匯入',/rtDue/.test(n.bk),n.bk);
 ok('沒有 JavaScript 錯誤（學習紀錄）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== C. 今日頁「🌱 複習字根」與複習 ===== */
{const {ctx,pg,errs,E}=await open();
 await E(()=>{store.rootKnown=['rt078','rt101','rt001'];store.rtStage={rt078:2,rt101:2,rt001:2};store.rtDue={rt078:day(),rt101:day(-1),rt001:day(5)};save()});
 await pg.click('#navToday');await sleep(300);
 const t1=await E(()=>{const t=[...document.querySelectorAll('#todayBody .task')].find(x=>/複習字根/.test(x.textContent));return t?t.textContent.replace(/\s+/g,''):''});
 ok('今日頁：有到期的字根時顯示「🌱 複習字根（到期）0 / 2」',/複習字根（到期）/.test(t1)&&/0\/2/.test(t1),t1);
 await pg.click('#todayBody [data-go="rtrev"]');await sleep(300);
 const c1=await E(()=>({quiz:!$('#quiz').hidden,type:$('#quizType').value,rev:RT.rev,id:RT.last,teach:!!document.querySelector('#quizOpts [data-rtstart]'),n:document.querySelectorAll('#quizOpts button[data-k]').length}));
 ok('按「開始」：到測驗頁出到期的字根（已記住的字根不先看說明）',c1.quiz&&c1.type==='roots'&&c1.rev&&['rt078','rt101'].includes(c1.id)&&!c1.teach&&c1.n===4,JSON.stringify(c1));
 const a1=await answer(E,true);await sleep(100);
 const c2=await E(id=>({st:store.rtStage[id],due:store.rtDue[id],want:day(INTERVALS[3]),msg:$('#quizMsg').textContent,md:v532MD(day(INTERVALS[3])),log:todayLog().rtrev,kn:store.rootKnown.includes(id)}),a1.id);
 ok('到期的字根答對：往上一級（2 → 3），下次複習延到 14 天後，顯示日期；算一次字根複習',c2.st===3&&c2.due===c2.want&&c2.msg.includes('下次複習：'+c2.md)&&c2.log===1&&c2.kn,JSON.stringify(c2));
 await pg.click('#newQuiz');await sleep(200);
 const c3=await E(()=>RT.last);
 const a2=await answer(E,false);await sleep(100);
 const c4=await E(id=>({st:store.rtStage[id],due:store.rtDue[id],today:day(),kn:store.rootKnown.includes(id),msg:$('#quizMsg').textContent,log:todayLog().rtrev}),a2.id);
 ok('接著出另一個到期的字根；答錯：仍是「已記住」、往前退兩級、排入今天複習',c3!==a1.id&&['rt078','rt101'].includes(c3)&&a2.id===c3&&c4.kn&&c4.st===0&&c4.due===c4.today&&/排入今天複習/.test(c4.msg)&&c4.log===2,JSON.stringify({c3,c4}));
 /* 一直答對，直到到期的都複習完 */
 let done='';const seen=[];for(let k=0;k<12;k++){await pg.click('#newQuiz');await sleep(120);const q=await E(()=>({note:(document.querySelector('#quizQ .rt-done')||{}).textContent||'',id:RT.last}));seen.push(q.id);if(q.note){done=q.note;break}await answer(E,true);await sleep(60)}
 const c5=await E(id=>({st:store.rtStage[id],due:store.rtDue[id],want:day(INTERVALS[1]),rev:RT.rev,dueN:rtDueN()}),c3);
 ok('答錯的字根之後再出（不會馬上重出）、答對後延到 3 天後；到期的都複習完：顯示「都複習完了」，接著出一般題目',/都複習完了/.test(done)&&!c5.rev&&c5.dueN===0&&c5.st===1&&c5.due===c5.want&&seen[0]!==c3&&seen.includes(c3),JSON.stringify({done,seen,c5}));
 await pg.click('#navToday');await sleep(300);
 const t2=await E(()=>({task:[...document.querySelectorAll('#todayBody .task')].some(x=>/複習字根/.test(x.textContent)),log:todayLog().rtrev}));
 ok('複習完：今日頁不再顯示「複習字根」，今天的字根複習次數有記錄',!t2.task&&t2.log>=3,JSON.stringify(t2));
 ok('沒有 JavaScript 錯誤（今日頁、複習）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== D. 先學再考、連續答對 2 次自動記住、「✓ 記住了」 ===== */
{const {ctx,pg,errs,E}=await open();
 const pk=await E(()=>{const f=new Set(rtFocus().map(r=>r.id));let n=0;for(let k=0;k<300;k++){RT.last='';if(f.has(rtPick(ROOTS).id))n++}return n});
 ok('沒有到期的字根時：大多出「建議先學」的 5 個（300 次裡 70% 以上）',pk>=210,String(pk));
 await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','roots');await sleep(300);
 const d1=await E(()=>({teach:!!document.querySelector('#quizOpts [data-rtstart]'),n:document.querySelectorAll('#quizOpts button[data-k]').length,q:$('#quizQ').textContent,id:RT.last,b:!!document.querySelector('#quizQ .rt-teach .rt-b'),shown:[...document.querySelectorAll('#quizQ .rt-tw span[lang=en]')].map(s=>s.textContent.toLowerCase()),said:window.__said.slice(-1)[0]}));
 const r1=await E(id=>{const r=ROOTS.find(x=>x.id===id);return {r:r.r,bw:r.b.split('：')[0]}},d1.id);
 ok('新使用者第一題：先顯示「🆕 新字根」說明（字根、意思、拆解、例字），沒有選項，念出拆解的例字',d1.teach&&d1.n===0&&/新字根/.test(d1.q)&&d1.q.includes(r1.r)&&d1.b&&d1.shown.length===2&&d1.shown.includes(r1.bw.toLowerCase())&&d1.said===r1.bw,JSON.stringify({d1,r1}));
 await pg.click('#quizOpts [data-rtstart]');await sleep(150);
 const d2=await E(()=>({n:document.querySelectorAll('#quizOpts button[data-k]').length,t:RT.cq.t,w:String(RT.cq.w).toLowerCase(),id:RT.last,taught:RT.taught.has(RT.last)}));
 ok('按「看完了，開始作答」：出應用題（用字根猜字義或找字根），不用剛看過的例字',d2.n===4&&['wm','wr'].includes(d2.t)&&d2.w&&!d1.shown.includes(d2.w)&&d2.id===d1.id&&d2.taught,JSON.stringify(d2));
 const a1=await answer(E,true);await sleep(100);
 const d3=await E(id=>({kn:(store.rootKnown||[]).includes(id),msg:$('#quizMsg').textContent,btn:!!document.querySelector('#quizMsg [data-rtqk]')}),a1.id);
 ok('還沒記住的字根答對一次：提示「再答對 1 次會自動標成已記住」，有「✓ 記住了」按鈕',!d3.kn&&/再答對 1 次/.test(d3.msg)&&d3.btn,JSON.stringify(d3));
 await E(id=>{rtAsk(ROOTS.find(x=>x.id===id),null,'')},a1.id);const a2=await answer(E,true);await sleep(100);
 const d4=await E(id=>({kn:(store.rootKnown||[]).includes(id),st:(store.rtStage||{})[id],due:(store.rtDue||{})[id],tm:day(1),msg:$('#quizMsg').textContent}),a1.id);
 ok('同一個字根連續答對 2 次：自動標成「已記住」，明天第一次複習',a2.id===a1.id&&d4.kn&&d4.st===0&&d4.due===d4.tm&&/連續答對 2 次/.test(d4.msg),JSON.stringify(d4));
 /* 另一個新字根：答錯 → 按「✓ 記住了」 */
 const other=await E(()=>{const f=rtFocus().find(r=>!RT.taught.has(r.id));return f&&f.id});
 await E(id=>{RT.last=id;rtTeach(ROOTS.find(x=>x.id===id),'')},other);const a3=await answer(E,false);await sleep(100);
 const d5=await E(id=>({kn:(store.rootKnown||[]).includes(id),ok:RT.ok[id],btn:!!document.querySelector('#quizMsg [data-rtqk]')}),other);
 await pg.click('#quizMsg [data-rtqk]');await sleep(150);
 const d6=await E(id=>({kn:(store.rootKnown||[]).includes(id),due:(store.rtDue||{})[id],tm:day(1),msg:$('#quizMsg').textContent}),other);
 ok('答錯時連續答對次數歸零；按答案下方的「✓ 記住了」：標成已記住、明天第一次複習',a3.id===other&&!d5.kn&&d5.ok===0&&d5.btn&&d6.kn&&d6.due===d6.tm&&/已記住，明天第一次複習/.test(d6.msg),JSON.stringify({d5,d6}));
 /* 連續出 60 題：同一個字根這次只先看一次說明；已記住的字根不看說明 */
 const d7=await E(()=>{const seen={},bad=[];for(let k=0;k<60;k++){rootQuiz();const id=RT.last,st=document.querySelector('#quizOpts [data-rtstart]');if(st){if(seen[id]||RT.taught.has(id)||(store.rootKnown||[]).includes(id))bad.push(id);seen[id]=1;st.click()}
   const bs=[...document.querySelectorAll('#quizOpts button[data-k]')];if(bs.length!==4)bad.push('n'+id);const t=bs.find(x=>x.textContent===RT.cq.a);if(t)t.click();else bad.push('a'+id)}return {bad,taught:Object.keys(seen).length}});
 ok('連續出 60 題：每個新字根這次只先看一次說明，已記住的字根不看說明；每題都有 4 個選項和正確答案',d7.bad.length===0,JSON.stringify(d7));
 ok('沒有 JavaScript 錯誤（先學再考）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== E. 用字根猜字義 ===== */
{const {ctx,pg,errs,E}=await open();
 await pg.click('#navQuiz');await sleep(200);await E(()=>{$('#quizType').value='roots'});
 const e1=await E(()=>{const bad=[];let wm=0,canWm=0;
  for(const r of ROOTS){let got=false;for(let k=0;k<8&&!got;k++){rtAsk(r,[],'');if(RT.cq.t==='wm')got=true}if(got)canWm++}
  for(let k=0;k<250;k++){const r=ROOTS[k%ROOTS.length];rtAsk(r,[],'');if(RT.cq.t!=='wm')continue;wm++;
   const w=RT.cq.w,opts=[...document.querySelectorAll('#quizOpts button[data-k]')].map(b=>b.textContent),z=rtZh(r,w)[1];
   if(opts.length!==4||new Set(opts).size!==4)bad.push('選項 '+w);
   if(RT.cq.a!==z||opts.filter(o=>o===z).length!==1)bad.push('答案 '+w);
   const ts=zhSenses(z);opts.forEach(o=>{if(o!==z&&zhSenses(o).some(s=>ts.includes(s)))bad.push('意思重疊 '+w+'/'+o)});
   if(!rtWords(r).includes(w))bad.push('不是例字 '+w);
   if(!/最可能是什麼意思/.test($('#quizQ').textContent)||!document.querySelector('#rtHint'))bad.push('題目 '+w)}
  return {bad:[...new Set(bad)].slice(0,8),wm,canWm}});
 ok('用字根猜字義：大部分字根都能出（90% 以上）；4 個選項不重複，只有一個是這個例字的中文，其他選項的意思和答案不重疊',e1.bad.length===0&&e1.wm>100&&e1.canWm>=Math.ceil(NR*.9),JSON.stringify(e1));
 const e2=await E(()=>{const r=ROOTS.find(x=>x.id==='rt078');for(let k=0;k<30;k++){rtAsk(r,[],'');if(RT.cq.t==='wm')break}
  const w=RT.cq.w;document.querySelector('#rtHint').click();const hint=(document.querySelector('#quizQ .rt-hint')||{}).textContent||'';
  const m=rtForm(r,w);const b=[...document.querySelectorAll('#quizOpts button[data-k]')].find(x=>x.textContent===RT.cq.a);b.click();
  return {t:RT.cq.t,w,hint,form:m&&m[1],msg:$('#quizMsg').textContent,hl:(document.querySelector('#quizMsg .rt-ans .rt-hl')||{}).textContent,qs:store.qStat.root}});
 ok('「💡 字根提示」：顯示單字裡的字根和意思（spect＝看）；答對後顯示單字（標出字根）、中文和字根說明，記在字根測驗正確率',e2.t==='wm'&&e2.hint.includes(e2.form+'＝看')&&/答對了/.test(e2.msg)&&e2.hl===e2.form&&/🧩/.test(e2.msg)&&e2.qs&&e2.qs[0]>=1,JSON.stringify(e2));
 ok('沒有 JavaScript 錯誤（猜字義）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== F. 字根頁：今天要複習、待複習、下次複習日、搜尋詞形 ===== */
{const {ctx,pg,errs,E}=await open();
 await E(()=>{store.rootKnown=['rt078','rt101'];store.rtStage={rt078:1,rt101:2};store.rtDue={rt078:day(),rt101:day(5)};save()});
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(300);
 const f1=await E(()=>({prog:$('#rtProg').textContent,plan:$('#rtPlan').textContent,rev:!!document.querySelector('#rtPlan [data-rtrev]'),tag:(document.querySelector('#rootList .rt-card[data-rt="rt078"] .rt-due')||{}).textContent||'',tag2:!!document.querySelector('#rootList .rt-card[data-rt="rt101"] .rt-due')}));
 ok('字根頁：上方顯示「今天要複習 1 個字根」和「開始複習」；到期的字根標「今天複習」',/已記住 2 個/.test(f1.prog)&&/今天要複習 1 個字根/.test(f1.plan)&&f1.rev&&/今天複習/.test(f1.tag)&&!f1.tag2,JSON.stringify(f1));
 await pg.click('#rtFilter [data-rf="due"]');await sleep(200);
 const f2=await E(()=>[...document.querySelectorAll('#rootList .rt-card')].map(c=>c.dataset.rt));
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(150);const s1=await E(()=>(document.querySelector('#rootList .rt-card.open .rt-sr')||{}).textContent||'');
 await pg.click('#rtFilter [data-rf="all"]');await sleep(150);await pg.click('#rootList [data-rtx="rt101"]');await sleep(150);
 const s2=await E(()=>({t:(document.querySelector('#rootList .rt-card.open .rt-sr')||{}).textContent||'',md:v532MD(day(5))}));
 ok('「待複習」只列到期的字根；展開時顯示「今天要複習」或「下次複習」日期',JSON.stringify(f2)==='["rt078"]'&&/今天要複習/.test(s1)&&s2.t.includes('下次複習 '+s2.md),JSON.stringify({f2,s1,s2}));
 await E(()=>{store.rtDue.rt078=day(1);save();renderRoots()});await pg.click('#rtFilter [data-rf="due"]');await sleep(150);
 ok('沒有到期的字根時「待複習」顯示說明，也不顯示「開始複習」',await E(()=>/今天沒有要複習的字根/.test($('#rootList').textContent)&&!document.querySelector('#rtPlan [data-rtrev]')));
 await pg.click('#rtFilter [data-rf="all"]');await sleep(150);
 await pg.fill('#rtSearch','used');await sleep(200);
 const f3=await E(()=>({c:[...document.querySelectorAll('#rootList .rt-card')].map(c=>c.dataset.rt),note:(document.querySelector('#rootList .rt-note')||{}).textContent||'',plan:$('#rtPlan').hidden,want:rtOfWord('use').map(r=>r.id)}));
 ok('搜尋詞形「used」：找到原形 use 的字根（不是用拼字猜，不顯示「僅供參考」）；搜尋時不顯示上方的建議',f3.want.length===1&&f3.c.includes(f3.want[0])&&!/僅供參考/.test(f3.note)&&f3.plan,JSON.stringify(f3));
 await pg.fill('#rtSearch','');await sleep(150);
 await E(()=>{store.rtDue.rt078=day();save();renderRoots()});await pg.click('#rtPlan [data-rtrev]');await sleep(300);
 ok('字根頁「開始複習」：到測驗頁複習到期的字根',await E(()=>!$('#quiz').hidden&&$('#quizType').value==='roots'&&RT.rev&&RT.last==='rt078'));
 ok('沒有 JavaScript 錯誤（字根頁複習）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== G. 例字卡片、回字根、詞形的字根、回到字根頁 ===== */
{const {ctx,pg,errs,E}=await open();
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(200);await pg.click('#rootList [data-rtx="rt078"]');await sleep(150);
 await pg.click('#rootList .rt-card.open [data-rtw="expect"]');await sleep(300);
 const g1=await E(()=>({vis:!$('#wordCard').hidden&&!$('#wordPage').hidden,pool:cardPool.map(x=>x.w),i:cardIndex,w:cardPool[cardIndex].w,back:!!document.querySelector('#wordCard [data-ca="rtback"]'),list:!!document.querySelector('#wordCard [data-ca="list"]'),want:ROOTS.find(r=>r.id==='rt078').w}));
 ok('點例字：打開這個字根的例字卡片，從點的那個字開始；卡片下方「🌱 回字根」取代「列表」',g1.vis&&JSON.stringify(g1.pool)===JSON.stringify(g1.want)&&g1.w==='expect'&&g1.i===g1.want.indexOf('expect')&&g1.back&&!g1.list,JSON.stringify(g1));
 await pg.click('#wordCard [data-ca="next"]');await sleep(200);const g2=await E(()=>cardPool[cardIndex].w);
 await pg.click('#wordCard [data-ca="rtback"]');await sleep(300);
 const g3=await E(()=>{const c=document.querySelector('#rootList .rt-card.open');const r=c&&c.getBoundingClientRect();return {vis:!$('#rootPage').hidden,id:c&&c.dataset.rt,top:r&&r.top,back:$('#rtBack').textContent}});
 ok('「下一字」換下一個例字；「🌱 回字根」回到字根頁、那個字根展開在畫面上',g2==='special'&&g3.vis&&g3.id==='rt078'&&g3.top>=0&&g3.top<844&&/返回單字/.test(g3.back),JSON.stringify({g2,g3}));
 await pg.click('#rootList .rt-card.open [data-rtdeck]');await sleep(300);
 const g4=await E(()=>({i:cardIndex,w:cardPool[cardIndex].w,n:cardPool.length}));
 await E(()=>{cardIndex=cardPool.length-1;showCard()});await sleep(450);await pg.click('#wordCard [data-ca="g-known"]');await sleep(200);
 const g5=await E(()=>({fin:/完成了/.test($('#wordCard').textContent),back:!!document.querySelector('#wordCard [data-ca="rtback"]'),list:!!document.querySelector('#wordCard [data-ca="list"]')}));
 ok('「🃏 例字卡片」從第一個例字開始；評分完最後一張的完成畫面也有「🌱 回字根」和「返回列表」',g4.i===0&&g4.w==='inspect'&&g4.n===6&&g5.fin&&g5.back&&g5.list,JSON.stringify({g4,g5}));
 await pg.click('#wordCard [data-ca="list"]');await sleep(200);await pg.click('#cardMode');await sleep(300);
 ok('一般的單字卡仍是「列表」（沒有「回字根」）',await E(()=>!!document.querySelector('#wordCard [data-ca="list"]')&&!document.querySelector('#wordCard [data-ca="rtback"]')));
 const v1=await E(()=>{const one=w=>{openCards([BY_WORD[w]]);cardReveal=true;showCard();return [...document.querySelectorAll('#wordCard .rt-chip')].map(b=>b.dataset.rtgo+':'+b.textContent)};
  return {used:one('used'),usedW:rtOfWord('use').map(r=>r.id),dep:one('depressing'),depW:rtOfWord('depress').map(r=>r.id),pro:one('programme'),proW:rtOfWord('program').map(r=>r.id)}});
 ok('詞形、衍生字、英式拼法也顯示原形的字根（used → use、depressing → depress、programme → program）',v1.used.length===1&&v1.used[0].startsWith(v1.usedW[0]+':us ')&&v1.dep.length===v1.depW.length&&v1.dep.length>0&&v1.dep[0].startsWith(v1.depW[0]+':press')&&v1.pro.length===v1.proW.length&&v1.pro.length>0,JSON.stringify(v1));
 /* 回到字根頁：剛才展開的字根在畫面上 */
 await pg.click('#navWords');await sleep(150);await pg.click('#rootOpen');await sleep(200);await E(()=>{RT.open='rt100';renderRoots();rtShow('rt100')});await sleep(150);
 await pg.click('#rtBack');await sleep(200);await pg.click('#rootOpen');await sleep(300);
 const h1=await E(()=>{const c=document.querySelector('#rootList .rt-card.open');const r=c&&c.getBoundingClientRect();return {id:c&&c.dataset.rt,top:r&&r.top}});
 ok('離開字根頁再回來：剛才展開的字根仍展開、捲到畫面上',h1.id==='rt100'&&h1.top>=0&&h1.top<844,JSON.stringify(h1));
 ok('沒有 JavaScript 錯誤（例字卡片）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== H. 小手機＋特大字＋深色 ===== */
{const {ctx,pg,errs,E}=await open({ctx:{viewport:{width:360,height:740},colorScheme:'dark'},init:()=>{localStorage.setItem('e5k_fs','1.3')}});
 await E(()=>{store.settings.fontScale='1.3';applyFont();store.rootKnown=['rt078'];store.rtStage={rt078:1};store.rtDue={rt078:day()};save()});
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(300);await pg.click('#rootList [data-rtx="rt078"]');await sleep(200);
 const h1=await E(()=>{const els=[...document.querySelectorAll('#rootPage button, #rtPlan, #rtFilter, .rt-due, .rt-sr')].filter(e=>e.offsetParent);
  return {ov:document.documentElement.scrollWidth-innerWidth,out:els.filter(e=>{const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).map(e=>e.className||e.id||e.textContent).slice(0,5),n:els.length,chips:[...document.querySelectorAll('#rtFilter [data-rf]')].every(b=>b.getBoundingClientRect().right<=innerWidth),bg:getComputedStyle($('#rtPlan')).backgroundColor}});
 ok('小手機＋特大字＋深色：字根頁（今天要複習、建議先學、4 個篩選、展開的字根）都在畫面內，深色背景',h1.ov<=0&&h1.out.length===0&&h1.n>12&&h1.chips&&h1.bg!=='rgb(243, 250, 244)',JSON.stringify(h1));
 await pg.click('#navQuiz');await sleep(150);await E(()=>{store.rootKnown=[];store.rtDue={};store.rtStage={};RT.taught.clear();RT.rev=false;$('#quizType').value='roots';rtTeach(ROOTS.find(r=>r.id==='rt081'),'')});await sleep(150);
 const h2=await E(()=>{const els=[...document.querySelectorAll('#quizQ *, #quizOpts button')].filter(e=>e.offsetParent);return {ov:document.documentElement.scrollWidth-innerWidth,out:els.filter(e=>{const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).length,btn:$('#quizOpts [data-rtstart]').getBoundingClientRect().width>200}});
 await pg.click('#quizOpts [data-rtstart]');await sleep(150);
 const h3=await E(()=>({ov:document.documentElement.scrollWidth-innerWidth,n:document.querySelectorAll('#quizOpts button[data-k]').length}));
 ok('小手機＋特大字＋深色：新字根說明、開始作答按鈕、題目都沒有超出畫面',h2.ov<=0&&h2.out===0&&h2.btn&&h3.ov<=0&&h3.n===4,JSON.stringify({h2,h3}));
 ok('沒有 JavaScript 錯誤（小手機）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== I. iPhone 靜音模式說明（發音設定） ===== */
{const {ctx,pg,errs,E}=await open();
 await pg.click('#navStats');await sleep(300);
 const i1=await E(()=>({hid:$('#iosMuteNote').hidden,vis:!!$('#iosMuteNote').offsetParent}));
 ok('一般手機、電腦：發音設定不顯示 iPhone 靜音模式說明',i1.hid&&!i1.vis,JSON.stringify(i1));
 await ctx.close()}
{const {ctx,pg,errs,E}=await open({ctx:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}});
 await pg.click('#navStats');await sleep(300);
 const i2=await E(()=>{const n=$('#iosMuteNote'),t=$('#voiceTest');return {vis:!n.hidden&&!!n.offsetParent,t:n.textContent,after:!!t&&t.nextElementSibling===n,ov:document.documentElement.scrollWidth-innerWidth}});
 ok('iPhone：發音設定的「🔊 試聽」下方顯示靜音模式說明（靜音時朗讀可能沒有聲音、網頁沒辦法改、請先關掉靜音模式）',i2.vis&&i2.after&&/靜音模式/.test(i2.t)&&/網頁沒辦法改/.test(i2.t)&&/關掉靜音模式/.test(i2.t)&&i2.ov<=0,JSON.stringify(i2));
 ok('沒有 JavaScript 錯誤（iPhone 說明）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== J. V6.6.1：字根例句也能念（💬、🐢、💬 念例句） ===== */
{const {ctx,pg,errs,E}=await open({init:()=>{window.__rate=[];const sp=speechSynthesis.speak;speechSynthesis.speak=u=>{window.__rate.push(Math.round(u.rate*100)/100);sp(u)}}});
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(300);
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(200);
 const want=()=>E(()=>{const r=ROOTS.find(x=>x.id==='rt078'),w=rtWords(r).filter(v=>BY_WORD[v]&&BY_WORD[v].ex);return {w,ex:w.map(v=>BY_WORD[v].ex)}});
 const W=await want();
 const j1=await E(()=>{const c=document.querySelector('#rootList .rt-card.open'),b=c.querySelector('[data-rtexall]');
  return {ex:[...c.querySelectorAll('[data-rtex]')].map(x=>x.dataset.rtex),sl:[...c.querySelectorAll('[data-rtexs]')].map(x=>x.dataset.rtexs),rows:[...c.querySelectorAll('.rt-w')].filter(r=>r.querySelector('.rt-ex')).length,
   lab:b&&b.textContent,aria:c.querySelector('[data-rtex]').getAttribute('aria-label'),acts:[...c.querySelectorAll('.rt-acts button')].map(x=>x.textContent)}});
 ok('展開字根：每個有例句的例字，例句旁邊有 💬（播放）和 🐢（慢速）；下方「🔊 念例字」旁邊多一個「💬 念例句」',W.w.length>=3&&JSON.stringify(j1.ex)===JSON.stringify(W.w)&&JSON.stringify(j1.sl)===JSON.stringify(W.w)&&j1.rows===W.w.length&&j1.lab==='💬 念例句'&&/播放例句/.test(j1.aria)&&j1.acts[0]==='🔊 念例字'&&j1.acts[1]==='💬 念例句',JSON.stringify({W:W.w,j1}));
 const j2=await E(()=>{const c=document.querySelector('#rootList .rt-card.open'),cr=c.getBoundingClientRect(),say=c.querySelector('.rt-say').getBoundingClientRect();
  return [...c.querySelectorAll('.rt-ex')].map(e=>{const t=e.querySelector('.rt-ext').getBoundingClientRect(),b=e.querySelector('.rt-exb').getBoundingClientRect(),p=e.querySelector('[data-rtex]').getBoundingClientRect(),q=e.querySelector('[data-rtexs]').getBoundingClientRect();
   return {side:b.left>=t.right-0.5,inCard:b.right<=cr.right+0.5&&t.left>=cr.left-0.5,stack:q.top>=p.bottom-0.5&&Math.abs(q.left-p.left)<1,size:p.height>=say.height*0.85&&q.height>=say.height*0.85}})});
 ok('例句的 💬、🐢 在例句右邊上下排，不蓋到例句、在卡片內，大小和例字的 🔊 差不多；沒有左右超出畫面',j2.length===W.w.length&&j2.every(o=>o.side&&o.inCard&&o.stack&&o.size)&&await E(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(j2));
 await E(()=>{window.__said=[];window.__rate=[]});
 await pg.click('#rootList .rt-card.open [data-rtex="inspect"]');await sleep(100);
 await pg.click('#rootList .rt-card.open [data-rtexs="inspect"]');await sleep(100);
 const j3=await E(()=>({said:window.__said,rate:window.__rate,ex:BY_WORD.inspect.ex}));
 ok('按 💬：念這個例句（一般速度）；按 🐢：慢速再念一次',j3.said.length===2&&j3.said.every(x=>x===j3.ex)&&j3.rate[0]>j3.rate[1],JSON.stringify(j3));
 /* 念例句：記下每次標出來的那一行 */
 await E(()=>{window.__said=[];window.__marks=[];const c=document.querySelector('#rootList .rt-card.open');
  new MutationObserver(()=>{const n=c.querySelector('.rt-w.rt-now'),b=n&&n.querySelector('[data-rtex]'),k=b&&b.dataset.rtex;if(k&&window.__marks[window.__marks.length-1]!==k)window.__marks.push(k)}).observe(c,{subtree:true,attributes:true,attributeFilter:['class']})});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(60);
 const j4a=await E(()=>({lab:$('#rootList [data-rtexall]').textContent,now:document.querySelectorAll('#rootList .rt-w.rt-now').length,run:RT.exRun}));
 ok('按「💬 念例句」：按鈕變成「■ 停止」，念到的那一行標出來',/停止/.test(j4a.lab)&&j4a.now===1&&j4a.run,JSON.stringify(j4a));
 await pg.waitForFunction(()=>!RT.exRun,null,{timeout:20000}).catch(()=>{});
 const j4=await E(()=>({said:window.__said,marks:window.__marks,lab:$('#rootList [data-rtexall]').textContent,now:document.querySelectorAll('#rootList .rt-now').length,run:RT.exRun}));
 ok('「💬 念例句」依序念完這個字根全部的例句，每一句念的時候標出那一行；念完按鈕恢復「💬 念例句」、不再標示',!j4.run&&JSON.stringify(j4.said)===JSON.stringify(W.ex)&&JSON.stringify(j4.marks)===JSON.stringify(W.w)&&j4.lab==='💬 念例句'&&j4.now===0,JSON.stringify(j4));
 /* 再按一次停止 */
 await E(()=>{window.__said=[]});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(60);
 await pg.click('#rootList .rt-card.open [data-rtexall]');
 const n5=await E(()=>window.__said.length);await sleep(1200);
 const j5=await E(()=>({n:window.__said.length,run:RT.exRun,lab:$('#rootList [data-rtexall]').textContent,now:document.querySelectorAll('#rootList .rt-now').length}));
 ok('念例句時再按一次（■ 停止）：停止，不再念下一句；按鈕恢復、不再標示',n5>=1&&n5<W.ex.length&&j5.n===n5&&!j5.run&&j5.lab==='💬 念例句'&&j5.now===0,JSON.stringify({n5,j5}));
 /* 按例字的 🔊：停止念例句，只念那個字 */
 await E(()=>{window.__said=[]});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(60);
 await pg.click('#rootList .rt-card.open [data-rtsay="respect"]');
 const n6=await E(()=>window.__said.length);await sleep(1200);
 const j6=await E(()=>({said:window.__said,run:RT.exRun,lab:$('#rootList [data-rtexall]').textContent}));
 ok('念例句時按例字的 🔊：停止念例句，只念那個字',j6.said.length===n6&&j6.said[n6-1]==='respect'&&!j6.run&&j6.lab==='💬 念例句',JSON.stringify(j6));
 /* 收起字根：停止 */
 await E(()=>{window.__said=[]});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(60);
 await pg.click('#rootList [data-rtx="rt078"]');
 const n7=await E(()=>window.__said.length);await sleep(1200);
 const j7=await E(()=>({n:window.__said.length,run:RT.exRun,open:!!document.querySelector('#rootList .rt-card.open')}));
 ok('念例句時收起字根：停止念例句',j7.n===n7&&!j7.run&&!j7.open,JSON.stringify({n7,j7}));
 /* 離開字根頁：停止 */
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(200);
 await E(()=>{window.__said=[]});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(60);
 await pg.click('#rtBack');
 const n8=await E(()=>window.__said.length);await sleep(1200);
 const j8=await E(()=>({n:window.__said.length,run:RT.exRun,hid:$('#rootPage').hidden}));
 ok('念例句時離開字根頁（← 返回單字）：停止念例句',j8.n===n8&&!j8.run&&j8.hid,JSON.stringify({n8,j8}));
 await pg.click('#rootOpen');await sleep(300);
 const j9=await E(()=>({open:(document.querySelector('#rootList .rt-card.open')||{dataset:{}}).dataset.rt,lab:($('#rootList [data-rtexall]')||{}).textContent,now:document.querySelectorAll('#rootList .rt-now').length}));
 ok('再回到字根頁：「💬 念例句」是一般狀態，沒有標示中的那一行',j9.open==='rt078'&&j9.lab==='💬 念例句'&&j9.now===0,JSON.stringify(j9));
 ok('沒有 JavaScript 錯誤（字根例句發音）',errs.length===0,errs.join(' | '));await ctx.close()}
/* 字根頁先打開、單字例句（data-ex.js）後下載好：自動補上例句和 💬 */
{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let go;const gate=new Promise(z=>go=z);
 await ctx.route('**/data-ex.js',async r=>{await gate;await r.continue().catch(()=>{})});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const E=(f,a)=>pg.evaluate(f,a);
 await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),5)};speechSynthesis.cancel=()=>{}});
 await pg.goto(U);await pg.waitForFunction(()=>typeof ALLS!=='undefined'&&document.readyState==='complete',null,{timeout:30000});
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');
 await pg.waitForFunction(()=>window.ROOTS&&document.querySelector('#rootList [data-rtx="rt078"]'),null,{timeout:40000});
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(200);
 const k1=await E(()=>({ready:EX_READY,ex:document.querySelectorAll('#rootList .rt-card.open .rt-ex').length,all:!!document.querySelector('#rootList [data-rtexall]'),open:!!document.querySelector('#rootList .rt-card.open')}));
 go();await pg.waitForFunction(()=>EX_READY,null,{timeout:30000}).catch(()=>{});await sleep(200);
 const k2=await E(()=>({ready:EX_READY,open:(document.querySelector('#rootList .rt-card.open')||{dataset:{}}).dataset.rt,ex:document.querySelectorAll('#rootList .rt-card.open [data-rtex]').length,all:!!document.querySelector('#rootList [data-rtexall]')}));
 ok('字根頁先打開、例句後下載好：自動補上例句、💬 和「💬 念例句」，展開的字根仍展開',!k1.ready&&k1.open&&k1.ex===0&&!k1.all&&k2.ready&&k2.open==='rt078'&&k2.ex>=3&&k2.all,JSON.stringify({k1,k2}));
 ok('沒有 JavaScript 錯誤（例句後下載好）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== K. V6.7.0：新增字根 pel / puls（rt105；舊字根編號不變） ===== */
{const vm=require('vm'),c={window:{}};for(const f of ['data.js','data-more.js'])vm.runInNewContext(fs.readFileSync(path.join('site',f),'utf8'),c);
 const RT=c.window.ROOTS,M={};c.window.WORDS.forEach(x=>{if(!M[x.w])M[x.w]=x});
 const csvRows=t=>{const out=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}else if(ch==='"')q=true;else if(ch===','){row.push(f);f=''}else if(ch==='\n'){row.push(f);out.push(row);row=[];f=''}else if(ch!=='\r')f+=ch}if(f||row.length){row.push(f);out.push(row)}return out};
 /* 匯出檔在專案資料夾（GitHub 自動測試的 site 只有 App 的檔案） */
 const csvF=[path.join('..','word_roots.csv'),path.join('site','word_roots.csv')].find(f=>fs.existsSync(f));
 const rows=csvF?csvRows(fs.readFileSync(csvF,'utf8').replace(/^\ufeff/,'')):[],O={L:'拉丁文',G:'希臘文',LG:'拉丁文、希臘文'},bad=[];
 rows.slice(1).forEach((x,k)=>{const r=RT[k]||{},ex=(r.w||[]).map(w=>w+'（'+(M[w]||{}).zh+'）').concat((r.x||[]).map(v=>v[0]+'（'+v[2]+'）')).join('、');
  [r.id,r.r,O[r.o],r.m,r.e,ex,r.b,r.t||''].forEach((v,i)=>{if(x[i]!==v)bad.push((r.id||k)+'#'+i)})});
 ok('word_roots.csv（可用 Excel 開啟）和 App 的字根一致：'+NR+' 列、順序相同（pel / puls 也在 part 和 pend / pens 之間）；編號、字根、來源、意思、例字（中文）、拆解、提醒都相同',rows.length-1===NR&&RT.length===NR&&bad.length===0&&!!rows[58]&&rows[58][0]==='rt105'&&rows[58][1]==='pel / puls',(csvF?'':'找不到 word_roots.csv ')+(bad.slice(0,8).join(' ')||String(rows.length-1)));
}
{const {ctx,pg,errs,E}=await open();
 const k1=await E(()=>{const i=ROOTS.findIndex(r=>r.id==='rt105'),r=ROOTS[i]||{};
  return {n:ROOTS.length,i,r:r.r,prev:(ROOTS[i-1]||{}).r,next:(ROOTS[i+1]||{}).r,m:r.m,e:r.e,o:r.o,
   old:ROOTS.filter(x=>x.id!=='rt105').every((x,k)=>x.id==='rt'+String(k+1).padStart(3,'0')),
   pend:(rtById('rt058')||{}).r,volv:(rtById('rt104')||{}).r,ws:rtWords(r),bw:String(r.b||'').split('：')[0],ce:!!(BY_WORD.impeller||{}).ce}});
 ok('新增字根 pel / puls（rt105）：排在 part 和 pend / pens 之間；意思「推；驅使」（drive, push）、拉丁文；舊的 104 個字根編號不變（rt058 仍是 pend / pens、rt104 仍是 volv / volu）',k1.n===NR&&k1.r==='pel / puls'&&k1.prev==='part'&&k1.next==='pend / pens'&&k1.m==='推；驅使'&&k1.e==='drive, push'&&k1.o==='L'&&k1.old&&k1.pend==='pend / pens'&&k1.volv==='volv / volu',JSON.stringify(k1));
 ok('pel 的例字：字庫裡的 impeller（CE 專業字：葉輪）、pulse、compelling，字庫外的 compel、expel、impulse；拆解用 impeller',JSON.stringify(k1.ws)===JSON.stringify(['impeller','pulse','compelling','compel','expel','impulse'])&&k1.bw==='impeller'&&k1.ce,JSON.stringify(k1.ws));
 await pg.click('#navWords');await sleep(200);
 const k2=await E(()=>{const one=w=>{openCards([BY_WORD[w]]);cardReveal=true;showCard();return [...document.querySelectorAll('#wordCard .rt-chip')].map(b=>b.dataset.rtgo+':'+b.textContent)};
  return {imp:one('impeller'),pul:one('pulse'),com:one('compelling')}});
 ok('單字卡翻面後的「🌱 字根」：impeller、compelling 顯示「pel 推；驅使」，pulse 顯示「puls 推；驅使」',JSON.stringify(k2)===JSON.stringify({imp:['rt105:pel 推；驅使'],pul:['rt105:puls 推；驅使'],com:['rt105:pel 推；驅使']}),JSON.stringify(k2));
 await E(()=>{openCards([BY_WORD.impeller]);cardReveal=true;showCard()});await sleep(200);
 await pg.click('#wordCard [data-rtgo="rt105"]');await sleep(400);
 const k3=await E(()=>{const c=document.querySelector('#rootList .rt-card.open');return {vis:!$('#rootPage').hidden,id:c&&c.dataset.rt,
   hl:c?[...c.querySelectorAll('.rt-w .rt-hl')].map(x=>x.textContent):[],rows:c?c.querySelectorAll('.rt-w').length:0,
   b:c?c.querySelector('.rt-b').textContent:'',tip:c?(c.querySelector('.rt-tip')||{}).textContent||'':'',
   ex:c?[...c.querySelectorAll('[data-rtex]')].map(x=>x.dataset.rtex):[],all:!!(c&&c.querySelector('[data-rtexall]')),deck:!!(c&&c.querySelector('[data-rtdeck]')),
   zh:c?[...c.querySelectorAll('.rt-wz')].map(x=>x.textContent):[],prog:$('#rtProg').textContent,wide:document.documentElement.scrollWidth<=innerWidth}});
 ok('點單字卡的「🌱 pel」：到字根頁、pel 展開；6 個例字都標出字根（pel、puls）和中文，有拆解和提醒；字庫裡的 3 個例字有例句、「💬 念例句」和「🃏 例字卡片」；共 '+NR+' 個字根、沒有左右超出畫面',
   k3.vis&&k3.id==='rt105'&&k3.rows===6&&JSON.stringify(k3.hl)===JSON.stringify(['pel','puls','pel','pel','pel','puls'])&&/^🧩 impeller：/.test(k3.b)&&/脈衝/.test(k3.tip)&&JSON.stringify(k3.ex)===JSON.stringify(['impeller','pulse','compelling'])&&k3.all&&k3.deck&&k3.zh.length===6&&/葉輪/.test(k3.zh[0])&&/衝動；衝擊/.test(k3.zh[5])&&k3.prog.includes('共 '+NR+' 個')&&k3.wide,JSON.stringify(k3));
 await E(()=>{window.__said=[]});
 await pg.click('#rootList .rt-card.open [data-rtexall]');await sleep(100);
 await pg.waitForFunction(()=>!RT.exRun&&window.__said.length>=3,null,{timeout:20000}).catch(()=>{});
 const k4=await E(()=>({said:window.__said.slice(),want:['impeller','pulse','compelling'].map(w=>BY_WORD[w].ex)}));
 ok('pel 的「💬 念例句」：依序念 impeller、pulse、compelling 的例句',k4.want.every(Boolean)&&JSON.stringify(k4.said)===JSON.stringify(k4.want),JSON.stringify(k4));
 const srch=async q=>{await pg.fill('#rtSearch',q);await sleep(200);return E(()=>[...document.querySelectorAll('#rootList .rt-card')].map(c=>c.dataset.rt))};
 const s1=await srch('pel'),s2=await srch('葉輪'),s3=await srch('impulse'),s4=await srch('驅使');await srch('');
 ok('字根頁搜尋 pel、葉輪（例字中文）、impulse（字庫外例字）、驅使（意思）：都找得到 pel / puls',s1[0]==='rt105'&&s2.includes('rt105')&&s3.includes('rt105')&&s4.includes('rt105'),JSON.stringify({s1,s2,s3,s4}));
 await pg.click('#navQuiz');await sleep(200);await E(()=>{$('#quizType').value='roots'});
 const k5=await E(()=>{const r=rtById('rt105'),bad=[],t={};
  for(let k=0;k<60;k++){rtAsk(r,null,'');const q=RT.cq,opts=[...document.querySelectorAll('#quizOpts button[data-k]')].map(b=>b.textContent);t[q.t]=(t[q.t]||0)+1;
   if(opts.length!==4||new Set(opts).size!==4)bad.push('選項 '+q.t);
   if(opts.filter(o=>o===q.a).length!==1)bad.push('答案 '+q.t+' '+q.a);
   if((q.t==='rm'&&q.a!=='推；驅使')||((q.t==='mr'||q.t==='wr')&&q.a!=='pel / puls'))bad.push('正確答案 '+q.t+' '+q.a);
   if((q.t==='wm'||q.t==='wr')&&!rtWords(r).includes(q.w))bad.push('例字 '+q.w)}
  return {bad:[...new Set(bad)],t}});
 ok('字根測驗出 pel 的題目（看字根選意思、看意思選字根、找出單字裡的字根、用字根猜字義）：每題 4 個不同選項、只有一個正確答案',k5.bad.length===0&&Object.keys(k5.t).length===4,JSON.stringify(k5));
 const k6=await E(()=>{window.__said=[];rtTeach(rtById('rt105'),'');const q=$('#quizQ');return {t:q.textContent,said:window.__said.slice(),hl:[...q.querySelectorAll('.rt-tw .rt-hl')].map(x=>x.textContent)}});
 ok('pel 是新字根時先看說明：pel / puls ＝ 推；驅使、拉丁文、拆解（impeller）、例字 impeller 葉輪和 pulse 脈搏、提醒；念出 impeller',k6.t.includes('pel / puls ＝ 推；驅使')&&k6.t.includes('拉丁文')&&k6.t.includes('🧩 impeller：')&&k6.t.includes('impeller 葉輪、pulse 脈搏')&&k6.t.includes('💡')&&k6.said[0]==='impeller'&&JSON.stringify(k6.hl)==='["pel","puls"]',JSON.stringify(k6));
 ok('沒有 JavaScript 錯誤（新增字根 pel）',errs.length===0,errs.join(' | '));await ctx.close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p39.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
