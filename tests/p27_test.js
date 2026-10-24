// V5.32.0：今日學習自訂、每週摘要、儲存空間與備份提醒、Role Play 間隔複習
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8896);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 /* 版面檢查用：文字實際排成幾行、文字和背景的對比 */
 window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};
 window.__canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
 window.__contrast=el=>{const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};let bg=null;for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0.5){bg=c;break}}bg=bg||{r:255,g:255,b:255};const fg=rgb(getComputedStyle(el).color);const a=lum(fg),z=lum(bg);return Math.round((Math.max(a,z)+0.05)/(Math.min(a,z)+0.05)*10)/10}};
async function open(vp,extra){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone'],acceptDownloads:true},extra||{}));await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8896/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
const iso=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
const md=n=>{const t=new Date();t.setDate(t.getDate()+n);return (t.getMonth()+1)+'/'+t.getDate()};
const grade=async(pg,n)=>{for(let k=0;k<n;k++){await pg.evaluate(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="g-known"]');await sleep(40)}};
const bar=pg=>pg.evaluate(()=>{const e=document.getElementById('flowBar');return e&&!e.hidden?e.textContent:''});
/* 匯入備份檔（寫在測試資料夾，不用系統暫存區），等 App 重新載入 */
const IMP='p27_import.json';
async function imp(pg,obj){fs.writeFileSync(IMP,JSON.stringify(obj));await pg.click('#navStats');await sleep(300);await pg.setInputFiles('#bkImport',IMP);await pg.waitForLoadState('load');await sleep(1600);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});fs.rmSync(IMP,{force:true})}
/* Role Play 演完一段：每一句用 🎤 得到 score 分（score=null：都沒有用 🎤 檢查） */
const rpRun=(pg,id,me,score)=>pg.evaluate(([id,me,score])=>{if(id)rpStart(DLG_BY[id],me);const m=rpMine();if(score!=null)for(const n of m){rpGo(n,false);rpScore(score,'')}rpGo(m[m.length-1],false);rpNav(1);return {fin:RP.fin,top:$('#rpTop').textContent,s:store.rpSched&&store.rpSched[RP.d.id]?JSON.parse(JSON.stringify(store.rpSched[RP.d.id])):null}},[id,me,score]);

// ---------- A. 沒有調整過：今日學習和原本一樣 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,8).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-1);store.wordKnown.push(w)});save();renderToday()});
const A=await E(()=>({plan:JSON.stringify(flowPlan()),cfg:'flowCfg' in store.settings,btn:$('#todayBody .flow-start').textContent,t:$('#todayBody .fcg-t').textContent,open:!!$('#todayBody .fcg')}));
ok('沒有調整過時，「▶ 開始今天的學習」和原本一樣：複習單字 8 → 學新單字 20 → 句子跟讀 → CE 情境題，並顯示預估時間（約 12 分鐘）',A.plan==='[{"k":"review","n":8},{"k":"new","n":20},{"k":"sent","n":5},{"k":"situ","n":1}]'&&!A.cfg&&/複習單字 8 → 學新單字 20 → 句子跟讀 → CE 情境題，約 12 分鐘/.test(A.btn)&&!A.open,JSON.stringify(A));
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
const A2=await E(()=>({open:!!$('#todayBody .fcg'),sel:[...document.querySelectorAll('#todayBody select[data-fc]')].map(s=>s.dataset.fc+'='+s.value).join(','),est:$('#todayBody .fcg-est').textContent}));
await pg.click('#todayBody .fcg-btns [data-go="flowcfg"]');await sleep(200);
const A3=await E(()=>({open:!!$('#todayBody .fcg'),cfg:'flowCfg' in store.settings,ls:JSON.parse(localStorage.getItem('english5000v5')).settings.flowCfg===undefined}));
ok('按「⚙️ 調整今日學習」：顯示目前的步驟與數量（複習開、新字 20、片語不做、句子 5、無線電不做、情境題 1、Role Play 不做）和預估時間；只看不改不會存任何設定',A2.open&&A2.sel==='rev=1,new=20,ph=0,sent=5,radio=0,situ=1,rp=0'&&/預估約 12 分鐘/.test(A2.est)&&!A3.open&&!A3.cfg&&A3.ls,JSON.stringify([A2,A3]));
await pg.click('#todayBody .flow-start');await sleep(400);
const A4=await E(()=>({n:cardPool.length,bar:$('#flowBar').textContent}));
await grade(pg,8);await sleep(1300);await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const A5=await E(()=>({n:cardPool.length,st:statusOf(cardPool[0].w),bar:$('#flowBar').textContent}));
ok('沒有調整過時照原本的流程：第 1 步複習 8 個（今日學習 1／4），下一步打開 20 個新字',A4.n===8&&/今日學習 1／4/.test(A4.bar)&&/複習單字 0／8/.test(A4.bar)&&A5.n===20&&A5.st==='new'&&/今日學習 2／4/.test(A5.bar),JSON.stringify([A4,A5]));
await E(()=>flowEnd());
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 自訂步驟與數量，一步一步做完 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,8).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-1)});save();renderToday()});
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
for(const [k,v] of [['rev','0'],['new','10'],['ph','5'],['sent','10'],['radio','5'],['situ','3'],['rp','1']]){await pg.selectOption(`#todayBody select[data-fc="${k}"]`,v);await sleep(60)}
const B=await E(()=>({cfg:JSON.stringify(store.settings.flowCfg),cc:__canon(store.settings.flowCfg),plan:flowPlan().map(s=>s.k+s.n).join(','),est:$('#todayBody .fcg-est').textContent,btn:$('#todayBody .flow-start').textContent,t:$('#todayBody .fcg-t').textContent}));
ok('自訂：複習關、新字 10、片語 5、句子 10、無線電 5、情境題 3、Role Play 1 段 → 步驟依序排好，預估約 23 分鐘，按鈕立刻更新；「⚙️ 調整今日學習 ●」表示有自訂',B.cfg==='{"rev":0,"new":10,"ph":5,"sent":10,"radio":5,"situ":3,"rp":1}'&&B.plan==='new10,ph5,sent10,radio5,situ3,rp1'&&/預估約 23 分鐘/.test(B.est)&&/學新單字 10 → 片語 5 → 句子跟讀 10 → 無線電用語 5 → CE 情境題 3 → Role Play，約 23 分鐘/.test(B.btn)&&/●/.test(B.t),JSON.stringify(B));
await pg.reload();await sleep(1200);
const B1=await E(()=>({cfg:__canon(store.settings.flowCfg),btn:$('#todayBody .flow-start').textContent}));
ok('自訂的設定會記住（重新開啟 App 後一樣）',B1.cfg===B.cc&&/學新單字 10 → 片語 5/.test(B1.btn),JSON.stringify(B1));
// 1. 新字：卡片數量照自訂（10 個，不是每日新字 20 個）
await pg.click('#todayBody .flow-start');await sleep(500);
const B2=await E(()=>({n:cardPool.length,meta:$('#wordCard .meta').textContent,bar:$('#flowBar').textContent}));
await grade(pg,10);await sleep(1300);
const B3=await bar(pg);
ok('第 1 步「學新單字」：打開 10 張新字卡（1 / 10），做完顯示 ✅ 和「下一步：片語」',B2.n===10&&/^1 \/ 10/.test(B2.meta)&&/今日學習 1／6/.test(B2.bar)&&/學新單字 10／10 ✅/.test(B3)&&/下一步：片語/.test(B3),JSON.stringify([B2,B3]));
// 2. 片語：有到期的先複習，沒有就標記新片語
await E(()=>{store.phKnown.push(1);store.pStage[1]=1;store.pDue[1]=day(-1);save()});
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const B4=await E(()=>({page:!$('#phrasePage').hidden,st:$('#phState').value,bar:$('#flowBar').textContent}));
await pg.click('#phRows [data-a="pok"]');await sleep(300);
await pg.click('#flowBar [data-flow="go"]');await sleep(300);
const B5=await E(()=>$('#phState').value);
for(let k=0;k<4;k++){await pg.click('#phRows .word-card [data-a="known"]');await sleep(120)}
await sleep(1200);const B6=await bar(pg);
ok('第 2 步「片語」：有到期的片語先打開待複習；「✓還會」和標記「○ 已會」都算（1＋4＝5／5 ✅）',B4.page&&B4.st==='due'&&/片語 0／5/.test(B4.bar)&&/標記已會/.test(B4.bar)&&B5==='new'&&/片語 5／5 ✅/.test(B6),JSON.stringify([B4,B5,B6]));
// 3. 句子跟讀 10 句
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
await E(()=>{for(let k=0;k<10;k++)bumpLog('shadow')});await sleep(1300);
const B7=await bar(pg);
ok('第 3 步「句子跟讀」：數量照自訂（10 句）',/句子跟讀 10／10 ✅/.test(B7)&&/下一步：無線電用語/.test(B7),B7);
// 4. 無線電用語：✓ 我會說了、🎤 念對、聽代號測驗都算
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const B8=await E(()=>({page:!$('.panel').hidden,u:$('#unit').value,src:cur().src,bar:$('#flowBar').textContent}));
await pg.click('#known');await sleep(150);await pg.click('#known');await sleep(150);
await E(()=>srResult(cur().en));await sleep(100);
await E(()=>{page('quiz');$('#quizType').value='radio';$('#quizType').onchange()});await sleep(300);
await pg.click('#quizOpts button[data-k="0"]');await sleep(200);await pg.click('#newQuiz');await sleep(200);await pg.click('#quizOpts button[data-k="1"]');await sleep(1300);
const B9=await E(()=>{const L=todayLog();return {ids:(L.sentIds||[]).filter(x=>/^r:/.test(x)).length,rsay:L.rsay,rquiz:L.rquiz,q:(L.qok||0)+(L.qng||0),bar:$('#flowBar').textContent}});
ok('第 4 步「無線電用語」：打開句子頁的無線電範圍；✓ 我會說了 2 句＋🎤 念對 1 句＋聽代號測驗 2 題＝5／5 ✅',B8.page&&B8.u==='radio'&&B8.src==='radio'&&/無線電用語 0／5/.test(B8.bar)&&B9.ids===2&&B9.rsay===1&&B9.rquiz===2&&B9.q===2&&/無線電用語 5／5 ✅/.test(B9.bar),JSON.stringify([B8,B9]));
// 5. CE 情境題 3 題
await pg.click('#flowBar [data-flow="next"]');await sleep(400);
for(let k=0;k<3;k++){await pg.click('#quizOpts .sq-opt');await sleep(150);if(k<2){await pg.click('#newQuiz');await sleep(150)}}
await sleep(1300);const B10=await bar(pg);
ok('第 5 步「CE 情境題」：數量照自訂（3 題）',/CE 情境題 3／3 ✅/.test(B10)&&/下一步：Role Play/.test(B10),B10);
// 6. Role Play：沒有到期的對話時打開建議的對話；演完一段就完成
await pg.click('#flowBar [data-flow="next"]');await sleep(500);
const B11=await E(()=>({page:!$('#dialogPage').hidden,id:DLG.cur&&DLG.cur.id,sug:rpSuggest().id,bar:$('#flowBar').textContent}));
await pg.click('#dlgRpB');await sleep(400);await rpRun(pg,null,null,90);await sleep(1300);
const B11b=await bar(pg);await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const B12=await E(()=>({bar:$('#flowBar').textContent,flow:todayLog().flow,fd:localStorage.getItem('e5k_flow_done')===day()}));
await pg.click('#flowBar [data-flow="end"]');await sleep(300);await pg.click('#navToday');await sleep(300);
const B13=await E(()=>({flow:todayLog().flow,btn:$('#todayBody .flow-start').textContent,vis:!!$('#flowBar')&&!$('#flowBar').hidden}));
ok('第 6 步「Role Play」：沒有到期的對話時打開建議的對話；演完一段 → ✅「完成 ▶」→「🎉 今天的學習完成了」，完成紀錄只記一次',B11.page&&B11.id===B11.sug&&/Role Play 0／1/.test(B11.bar)&&/Role Play 1／1 ✅/.test(B11b)&&/完成 ▶/.test(B11b)&&/今天的學習完成了/.test(B12.bar)&&B12.flow===1&&B12.fd&&B13.flow===1&&/今天的學習完成了/.test(B13.btn)&&!B13.vis,JSON.stringify([B11,B11b,B12,B13]));
// 恢復預設、全部不做
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);await pg.click('#todayBody [data-go="flowreset"]');await sleep(200);
const B14=await E(()=>({cfg:'flowCfg' in store.settings,plan:flowPlan().map(s=>s.k+s.n).join(','),t:$('#todayBody .fcg-t').textContent}));
ok('「恢復預設」：刪除自訂設定，回到原本的步驟（複習 8 → 新字 20−今天已學 10 → 句子 → 情境題）',!B14.cfg&&B14.plan==='review8,new10,sent5,situ1'&&!/●/.test(B14.t),JSON.stringify(B14));
for(const [k,v] of [['rev','0'],['new','0'],['sent','0'],['situ','0']]){await pg.selectOption(`#todayBody select[data-fc="${k}"]`,v);await sleep(60)}
await pg.click('#todayBody .fcg-btns [data-go="flowcfg"]');await sleep(200);
const B15=await E(()=>$('#todayBody .flow-start').textContent);
await pg.click('#todayBody .flow-start');await sleep(300);
const B16=await E(()=>({flow:FLOW,open:!!$('#todayBody .fcg')}));
ok('全部設成不做：按鈕說明「目前的設定今天沒有要做的項目」，按下去打開設定（不會開始空的今日學習）',/沒有要做的項目/.test(B15)&&B16.flow===null&&B16.open,JSON.stringify([B15,B16]));
ok('B 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 每週摘要（最近 7 天和前 7 天） ----------
{const {ctx,pg,errs,E}=await open();
await E(([D])=>{store.dailyLog={[D[0]]:{new:5,review:10,sent:2,shadow:1,quiz:4,qok:3,qng:1,rp:1},[D[2]]:{new:5,review:5,ph:2,prev:1,quiz:6,qok:3,qng:3,flow:1},[D[4]]:{review:5},[D[6]]:{sent:3},
 /* 前 7 天：舊版紀錄（沒有答對／答錯、完成今日學習的計數） */[D[7]]:{new:20,quiz:10},[D[10]]:{review:3,rp:2},[D[13]]:{sent:1,sentIds:['c1']}};
 store.studyDays=[D[0],D[2],D[4],D[5],D[7],D[10]];localStorage.setItem('e5k_flow_done',D[0]);save()},[[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(k=>iso(-k))]);
await pg.click('#navStats');await sleep(400);
const C=await E(()=>{const g=document.querySelector('#statsBody .wk');const c=[...g.children];const rows={};for(let k=3;k<c.length;k+=3)rows[c[k].textContent]=[c[k+1].textContent.trim(),c[k+2].textContent.trim()];return {rows,head:$('#wkCard').textContent,txt:$('#statsBody').innerText}});
const W=C.rows;
ok('統計頁「📅 每週摘要」：最近 7 天和前 7 天的學習天數、新單字、複習單字、句子跟讀、片語、測驗、Role Play、完成今日學習；多的 ▲、少的 ▼',
 W['學習天數']+''==='5 天 ▲,3 天'&&W['新單字']+''==='10 個 ▼,20 個'&&W['複習單字']+''==='20 個 ▲,3 個'&&W['句子跟讀']+''==='6 句 ▲,1 句'&&W['片語']+''==='3 個 ▲,0 個'&&W['測驗作答']+''==='10 題,10 題'&&W['Role Play']+''==='1 段 ▼,2 段'&&W['完成今日學習']+''==='2 天 ▲,0 天',JSON.stringify(W));
ok('測驗正確率：最近 7 天 60%（6／10）；前 7 天是舊版紀錄沒有答對數，顯示「—」（不會出現 NaN）',W['測驗正確率']+''==='60%,—'&&!/NaN|undefined|Infinity/.test(C.txt),JSON.stringify(W['測驗正確率']));
await pg.click('#navToday');await sleep(300);
const C2=await E(()=>({chips:[...document.querySelectorAll('#todayBody .wk-chips span')].map(s=>s.textContent.trim()),txt:$('#todayBody').innerText}));
ok('今日頁最下方「📅 最近 7 天」小卡：學習 5 天 ▲、新字 10 ▼、測驗 10 題（60%）、Role Play 1 段 ▼、完成今日學習 2 天 ▲',C2.chips.includes('學習 5 天 ▲')&&C2.chips.includes('新字 10 ▼')&&C2.chips.includes('測驗 10 題（60%）')&&C2.chips.includes('Role Play 1 段 ▼')&&C2.chips.includes('完成今日學習 2 天 ▲')&&!/NaN|undefined/.test(C2.txt),JSON.stringify(C2.chips));
// 實際作答：答對、答錯分別記錄
await E(()=>{page('quiz');quiz()});await sleep(150);await pg.click('#quizOpts [data-ok="true"]');await sleep(150);
await E(()=>quiz());await sleep(150);await pg.click('#quizOpts [data-ok="false"]');await sleep(150);
const C3=await E(()=>({qok:todayLog().qok,qng:todayLog().qng,quiz:todayLog().quiz}));
ok('作答時每天另外記錄答對、答錯（舊的「測驗」計數照常）',C3.qok===4&&C3.qng===2&&C3.quiz===6,JSON.stringify(C3));
await pg.click('#navToday');await sleep(300);await pg.click('#todayBody [data-go="week"]');await sleep(400);
const C4=await E(()=>{const h=$('#wkCard').getBoundingClientRect();return {stats:!$('#statsPage').hidden,top:Math.round(h.top),vh:innerHeight}});
ok('今日頁小卡「完整摘要 ›」：打開統計頁並捲到每週摘要',C4.stats&&C4.top>=0&&C4.top<C4.vh*0.5,JSON.stringify(C4));
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 儲存空間（統計頁） ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.slice(0,300).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='learning';store.reviewDue[w]=day(3)});store.studyDays=[day(-1),day()];save();flushSave();localStorage.setItem('english5000v5_snap_'+day(-1),localStorage.getItem('english5000v5'))});
await pg.click('#navStats');await sleep(400);
await pg.waitForFunction(()=>{const e=document.getElementById('stEst');return e&&(e.hidden||!/計算中/.test(e.textContent))},null,{timeout:5000}).catch(()=>{});
const D=await E(()=>{let tot=0,prog=0,snap=0;for(let k=0;k<localStorage.length;k++){const key=localStorage.key(k),n=key.length+localStorage.getItem(key).length;tot+=n;if(key==='english5000v5')prog+=n;if(key.startsWith('english5000v5_snap'))snap+=n}
 const box=document.querySelector('#statsBody .st-box'),seg=[...box.querySelectorAll('.st-bar span')].map(s=>parseFloat(s.style.width));
 return {pct:Math.round(tot/5e6*100),top:box.querySelector('.st-top').textContent,leg:box.querySelector('.st-leg').textContent,w0:seg[0],w1:seg[1],want0:prog/5e6*100,want1:snap/5e6*100,est:$('#stEst').hidden?'(不支援)':$('#stEst').textContent,warn:!!box.querySelector('.st-warn'),h3:[...document.querySelectorAll('#statsBody h3')].pop().textContent}});
ok('統計頁「💽 儲存空間」：學習紀錄、每日自動備份、其他的用量與長條（上限約 5 MB）；另外顯示離線檔案用量（navigator.storage.estimate）',/上限約 5 MB（已用 \d+%）/.test(D.top)&&D.top.includes('已用 '+D.pct+'%')&&/學習紀錄 \d/.test(D.leg)&&/每日自動備份 \d/.test(D.leg)&&Math.abs(D.w0-D.want0)<0.05&&Math.abs(D.w1-D.want1)<0.05&&D.w1>0&&/離線檔案與快取：約 [\d.]+ (KB|MB|GB)/.test(D.est)&&!D.warn&&/儲存空間/.test(D.h3),JSON.stringify(D));
const filled=await E(()=>{try{localStorage.setItem('zz_other_page','x'.repeat(4.2e6));return true}catch(e){return String(e)}});
await E(()=>renderStats());await sleep(300);
const D2=await E(()=>{const w=document.querySelector('#statsBody .st-warn');return {warn:w?w.textContent:'',leg:document.querySelector('#statsBody .st-leg').textContent}});
await pg.click('#statsBody [data-bkgo]');await sleep(300);
const D3=await E(()=>{const h=$('#backupBody').previousElementSibling.getBoundingClientRect();return {t:$('#backupBody').previousElementSibling.textContent,top:Math.round(h.top),vh:innerHeight}});
await E(()=>localStorage.removeItem('zz_other_page'));
ok('用量超過 80%：顯示警告「快滿了」並說明先匯出備份；「⬇️ 前往資料備份」捲到「資料備份與還原」（同網址其他網頁的資料也算進去）',filled===true&&/已用 8\d%，快滿了/.test(D2.warn)&&/匯出備份檔/.test(D2.warn)&&/同網址的其他網頁/.test(D2.leg)&&D3.t==='資料備份與還原'&&D3.top>=0&&D3.top<D3.vh*0.4,JSON.stringify([filled,D2,D3]));
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 上次備份時間與備份提醒 ----------
{const {ctx,pg,errs,E}=await open(null,{permissions:['microphone','clipboard-read','clipboard-write']});
const E0=await E(()=>({rem:!!$('#todayBody .bk-remind')}));
await E(()=>{const ws=WORDS.filter(x=>!x.b).slice(0,30).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known'});store.studyDays=[day(-3),day(-1)];save();renderToday()});
const E1=await E(()=>{const r=$('#todayBody .bk-remind');return r?{t:r.textContent,btn:[...r.querySelectorAll('button')].map(x=>x.dataset.go)}:null});
ok('還沒有學習進度時不提醒備份；有進度又從沒備份過：今日頁提醒「你還沒有備份過」，有「💾 立即匯出備份」「前往備份區」「稍後提醒」',!E0.rem&&!!E1&&/你還沒有備份過/.test(E1.t)&&E1.btn.join()==='backup,bkgo,bklater',JSON.stringify([E0,E1]));
await pg.click('#todayBody [data-go="bklater"]');await sleep(200);
const E2=await E(()=>({rem:!!$('#todayBody .bk-remind'),later:store.settings.bkLater,d7:day(7)}));
await E(()=>{store.settings.bkLater=day();save();renderToday()});
const E3=await E(()=>!!$('#todayBody .bk-remind'));
ok('「稍後提醒」：提醒先隱藏 7 天，7 天後再出現',!E2.rem&&E2.later===E2.d7&&E3,JSON.stringify([E2,E3]));
await pg.click('#todayBody [data-go="bkgo"]');await sleep(400);
const E4=await E(()=>{const h=$('#backupBody').previousElementSibling.getBoundingClientRect();return {stats:!$('#statsPage').hidden,top:Math.round(h.top),vh:innerHeight,last:$('#backupBody .bk-last').textContent}});
ok('「前往備份區」：打開統計頁並捲到「資料備份與還原」；顯示「還沒有備份過」',E4.stats&&E4.top>=0&&E4.top<E4.vh*0.4&&E4.last==='還沒有備份過',JSON.stringify(E4));
await pg.click('#navToday');await sleep(300);
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#todayBody [data-go="backup"]')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));await sleep(500);
const E5=await E(()=>({at:store.lastBackupAt,le:store.lastExport,rem:!!$('#todayBody .bk-remind')}));
await pg.click('#navStats');await sleep(300);const E6=await E(()=>$('#backupBody .bk-last').textContent);
ok('「💾 立即匯出備份」：下載備份檔、記錄備份時間；提醒消失，統計頁顯示「上次備份：'+md(0)+'（今天）」',ex.app==='english-5000'&&Math.abs(Date.parse(E5.at)-Date.now())<60000&&E5.le===iso(0)&&!E5.rem&&E6==='上次備份：'+md(0)+'（今天）'&&ex.progress.lastBackupAt===ex.exportedAt,JSON.stringify([E5,E6,ex.exportedAt,ex.progress.lastBackupAt]));
await E(([a])=>{store.lastBackupAt=new Date(a+'T09:00:00').toISOString();store.lastExport=a;save();renderToday();renderBackup()},[iso(-15)]);
const E7=await E(()=>({rem:($('#todayBody .bk-remind')||{}).textContent||'',last:$('#backupBody .bk-last').textContent}));
await E(([a])=>{store.lastBackupAt=new Date(a+'T09:00:00').toISOString();store.lastExport=a;save();renderToday()},[iso(-13)]);
const E8=await E(()=>!!$('#todayBody .bk-remind'));
ok('上次備份 15 天前：今日頁提醒「上次備份是 15 天前」，統計頁「上次備份：M/D（15 天前）」；13 天前不提醒',new RegExp('上次備份是 15 天前（'+md(-15)+'）').test(E7.rem)&&E7.last==='上次備份：'+md(-15)+'（15 天前）'&&!E8,JSON.stringify([E7,E8]));
await pg.click('#bkCopy');await sleep(400);
const E9=await E(()=>({at:store.lastBackupAt,last:$('#backupBody .bk-last').textContent,msg:$('#backupMsg').textContent}));
ok('「📋 複製備份內容」也算備份：記錄時間，顯示「上次備份：'+md(0)+'（今天）」',/已複製備份內容/.test(E9.msg)&&Math.abs(Date.parse(E9.at)-Date.now())<60000&&E9.last==='上次備份：'+md(0)+'（今天）',JSON.stringify(E9));
// 匯入 20 天前做的備份檔：上次備份＝那個檔案的時間（匯入不算新的備份）
const old=JSON.parse(JSON.stringify(ex));const t20=new Date(iso(-20)+'T08:00:00').toISOString();old.exportedAt=t20;old.progress.lastBackupAt=t20;old.progress.lastExport=iso(-20);
await imp(pg,old);
const E10=await E(()=>({last:$('#backupBody .bk-last').textContent,msg:$('#backupMsg').textContent,at:store.lastBackupAt}));
await pg.click('#navToday');await sleep(300);const E11=await E(()=>($('#todayBody .bk-remind')||{}).textContent||'');
ok('匯入 20 天前的備份檔：「上次備份」是那個檔案的時間（20 天前），匯入本身不算新的備份，所以今日頁照樣提醒',/已匯入/.test(E10.msg)&&E10.at===t20&&E10.last==='上次備份：'+md(-20)+'（20 天前）'&&/上次備份是 20 天前/.test(E11),JSON.stringify([E10,E11]));
ok('E 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. Role Play 間隔複習 ----------
{const {ctx,pg,errs,E}=await open();
const F1=await rpRun(pg,'d14','B',60);
const F2=await rpRun(pg,'d02','A',75);
const F3=await rpRun(pg,'d03','B',90);
ok('Role Play 演完：平均 60% → 明天複習；75% → 3 天後；90% → 7 天後（第一次）；完成畫面顯示「📅 下次複習：M/D」',F1.s.due===iso(1)&&F1.s.iv===1&&/下次複習：\d+\/\d+（明天）/.test(F1.top)&&/低於 70%/.test(F1.top)&&F2.s.due===iso(3)&&F2.s.iv===3&&F2.s.me==='A'&&/3 天後/.test(F2.top)&&F3.s.due===iso(7)&&F3.s.iv===7&&/下次複習：\d+\/\d+（7 天後）/.test(F3.top),JSON.stringify([F1.s,F2.s,F3.s]));
const F4=await rpRun(pg,'d03','B',95);
ok('同一天再演一次（95%）：重新計算今天的結果，不會連續加倍（還是 7 天，最高分 95、次數 2）',F4.s.iv===7&&F4.s.due===iso(7)&&F4.s.best===95&&F4.s.n===2,JSON.stringify(F4.s));
await E(([a,b2])=>{store.rpSched.d03={due:a,iv:7,last:b2,best:90,n:1,sc:90,me:'B'};store.rpSched.d02={due:a,iv:40,last:b2,best:88,n:3,sc:88,me:'A'};store.rpSched.d14={due:a,iv:14,last:b2,best:90,n:2,sc:90,me:'B'};save()},[iso(-1),iso(-8)]);
const F5=await rpRun(pg,'d03','B',95),F6=await rpRun(pg,'d02','A',90),F7=await rpRun(pg,'d14','B',65);
const F8=await E(()=>{store.rpSched.d05={due:day(-1),iv:14,last:day(-15),best:80,n:1,sc:80,me:'B'};save();return 1});
const F9=await rpRun(pg,'d05','B',80);
ok('之後的複習：85% 以上間隔加倍（7→14 天；40→60 天上限）；低於 70% 回到 1 天；70–84% 一律 3 天',F5.s.iv===14&&F5.s.due===iso(14)&&F6.s.iv===60&&F6.s.due===iso(60)&&F7.s.iv===1&&F7.s.due===iso(1)&&F9.s.iv===3&&F9.s.due===iso(3),JSON.stringify([F5.s,F6.s,F7.s,F9.s]));
const before=await E(()=>JSON.stringify(store.rpSched.d02));
const F10=await rpRun(pg,'d02','A',null);
ok('沒有用 🎤 檢查就演完：不改複習日期，完成畫面說明原因（Role Play 完成紀錄照常）',JSON.stringify(F10.s)===before&&/沒有用 🎤 檢查/.test(F10.top)&&await E(()=>store.rpDone.d02.d===day()),F10.top.slice(-80));
await E(()=>rpOff());
// 今日頁、情境列表
await E(([a,b2,c])=>{store.rpSched={d14:{due:a,iv:1,last:a,best:60,n:1,sc:60,me:'B'},d02:{due:b2,iv:3,last:b2,best:75,n:1,sc:75,me:'A'},d03:{due:c,iv:7,last:day(),best:90,n:1,sc:90,me:'B'}};save()},[iso(-2),iso(-1),iso(5)]);
await pg.click('#navToday');await sleep(300);
const F11=await E(()=>{const t=[...document.querySelectorAll('#todayBody .task')].filter(x=>/Role Play/.test(x.textContent));return {n:t.length,first:t[0]&&t[0].textContent,due:t[1]&&t[1].textContent,btn:!!(t[1]&&t[1].querySelector('[data-go="rpdue"]'))}});
const t14=await E(()=>DLG_BY.d14.t);
ok('今日頁：「🎭 Role Play 待複習 2 段」（最久的：'+t14+'，已到期 2 天）；原本的 Role Play 建議照常在前面',F11.n===2&&/Role Play（建議：/.test(F11.first)&&/Role Play 待複習 2 段/.test(F11.due)&&F11.due.includes('最久的：'+t14+'（已到期 2 天）')&&F11.btn,JSON.stringify(F11));
await pg.click('#todayBody [data-go="rpdue"]');await sleep(600);
const F12=await E(()=>({on:RP.on,id:RP.d&&RP.d.id,me:RP.me,box:!$('#rpBox').hidden}));
ok('按「▶ 複習」：直接用 Role Play 演最久沒複習的對話（d14，演上次的角色 B）',F12.on&&F12.id==='d14'&&F12.me==='B'&&F12.box,JSON.stringify(F12));
await pg.click('#rpEnd');await sleep(300);await pg.click('#dlgBack');await sleep(300);
const F13=await E(()=>{const g=id=>{const c=document.querySelector(`.dlg-card[data-d="${id}"]`);const e=c&&c.querySelector('.rp-badge');return e?e.textContent:''};return {d14:g('d14'),d02:g('d02'),d03:g('d03'),d05:g('d05'),stat:document.querySelector('#dialogBody .word-stats').textContent}});
ok('情境列表：到期的標「🎭 待複習」，還沒到期的標「🎭 下次 '+md(5)+'」，沒有排程的不標',F13.d14==='🎭 待複習'&&F13.d02==='🎭 待複習'&&F13.d03==='🎭 下次 '+md(5)&&F13.d05===''&&/已練習/.test(F13.stat),JSON.stringify(F13));
// 今日學習的 Role Play 步驟優先複習到期的對話
await E(()=>{store.settings.flowCfg={rev:0,new:0,sent:0,situ:0,rp:1};save()});
await pg.click('#navToday');await sleep(300);await pg.click('#todayBody .flow-start');await sleep(600);
const F14=await E(()=>({on:RP.on,id:RP.d&&RP.d.id,bar:$('#flowBar').textContent}));
await rpRun(pg,null,null,88);await sleep(1300);await pg.click('#flowBar [data-flow="next"]');await sleep(400);
const F15=await E(()=>({bar:$('#flowBar').textContent,s:store.rpSched.d14,rp:todayLog().rp}));
ok('今日學習的 Role Play 步驟：優先演到期最久的對話（d14）；演完（88%）後這一步完成，d14 排到 7 天後',F14.on&&F14.id==='d14'&&/Role Play 0／1/.test(F14.bar)&&/今天的學習完成了/.test(F15.bar)&&F15.s.iv===7&&F15.s.due===iso(7),JSON.stringify([F14,F15]));
await pg.click('#flowBar [data-flow="end"]');await sleep(300);
// 接續（rpResume）照常
await E(()=>{rpStart(DLG_BY.d02,'A');const m=rpMine();rpGo(m[1],false)});await sleep(300);
await pg.click('#navToday');await sleep(300);
const F16=await E(()=>{const t=[...document.querySelectorAll('#todayBody .task')].find(x=>/Role Play/.test(x.textContent));return {t:t&&t.textContent,res:!!document.querySelector('#todayBody [data-go="rpres"]')}});
await pg.click('#todayBody [data-go="rpdue"]');await sleep(600);
const F17=await E(()=>({on:RP.on,id:RP.d&&RP.d.id,n:RP.n,m:rpMine()[1]}));
await E(()=>rpOff());await pg.click('#navStats');await sleep(300);
const F18=await E(()=>({t:document.querySelector('#statsBody').textContent.match(/Role Play 已演[^（]*/)[0],n:Object.keys(store.rpDone).filter(k=>DLG_BY[k]).length}));
ok('進行到一半的 Role Play：今日頁照常顯示「繼續」；「▶ 複習」最久到期的同一段對話時接著上次的句子演；統計頁 Role Play 已演照常',/繼續：/.test(F16.t)&&F16.res&&F17.on&&F17.id==='d02'&&F17.n===F17.m&&F18.n===4&&new RegExp('Role Play 已演\\s*'+F18.n+' /').test(F18.t),JSON.stringify([F16,F17,F18]));
ok('F 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 備份匯出 → 匯入：新欄位都保留；被竄改的值整理掉 ----------
{const {ctx,pg,errs,E}=await open();
const G0=await E(()=>{store.rpSched={d14:{due:day(3),iv:3,piv:0,last:day(),best:78,sc:78,n:1,me:'B'}};store.settings.flowCfg={new:10,ph:5,rp:1};store.settings.bkLater=day(3);store.dailyLog={[day()]:{quiz:3,qok:2,qng:1,rquiz:1,rsay:1,flow:1}};store.studyDays=[day()];save();return __canon({rp:store.rpSched,cfg:store.settings.flowCfg,later:store.settings.bkLater,log:store.dailyLog})});
await pg.click('#navStats');await sleep(300);
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
const G1=await E(x=>__canon({rp:x.rpSched,cfg:x.settings.flowCfg,later:x.settings.bkLater,log:x.dailyLog}),ex.progress);
await E(()=>{delete store.rpSched;delete store.settings.flowCfg;delete store.settings.bkLater;store.dailyLog={};delete store.lastBackupAt;save()});
await imp(pg,ex);
const G2=await E(()=>({v:__canon({rp:store.rpSched,cfg:store.settings.flowCfg,later:store.settings.bkLater,log:store.dailyLog}),at:store.lastBackupAt}));
ok('匯出的備份檔包含新欄位（Role Play 排程、今日學習設定、稍後提醒、每日新計數）；匯入後全部還原，上次備份＝備份檔的時間',G1===G0&&G2.v===G0&&G2.at===ex.exportedAt,JSON.stringify([G0,G1,G2]).slice(0,600));
const X='<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const bad=JSON.parse(JSON.stringify(ex));bad.progress.rpSched={[X]:{due:iso(-1)},d14:{due:X,iv:3},d02:{due:iso(-1)+X,iv:999,best:X,me:X,sc:'50'},d03:'x'};bad.progress.settings.flowCfg={sent:'10',new:999,rp:1,[X]:1};bad.progress.settings.bkLater=X;bad.progress.lastBackupAt=X;
await imp(pg,bad);
for(const n of ['#navToday','#navStats','#navDialogs']){await pg.click(n);await sleep(300)}
const G3=await E(()=>({x:window.__xss||0,rp:__canon(store.rpSched),cfg:JSON.stringify(store.settings.flowCfg),later:store.settings.bkLater,at:store.lastBackupAt,badge:(document.querySelector('.dlg-card[data-d="d02"] .rp-badge')||{}).textContent}));
ok('匯入被竄改的備份檔：新欄位整理成正確型別（不合法的對話、日期、數字、設定都丟掉或修正），畫面不會執行任何程式碼',G3.x===0&&G3.rp===await E(o=>__canon(o),{d02:{due:iso(-1),iv:60,last:iso(-1),best:0,n:0,me:'B',sc:50}})&&G3.cfg==='{"rp":1}'&&G3.later===undefined&&G3.at===undefined&&G3.badge==='🎭 待複習',JSON.stringify(G3));
ok('G 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- H. 小手機（360×640）＋特大字＋深色模式：版面不會撐破、按鈕不會被擠扁 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme();
 WORDS.filter(x=>!x.b).slice(0,30).forEach(x=>{store.wordStatus[x.w]='known'});store.studyDays=[day(-9),day(-2),day()];
 store.dailyLog={[day()]:{new:12,review:30,sent:4,quiz:9,qok:7,qng:2,rp:1,flow:1},[day(-9)]:{new:20,review:5}};
 store.rpSched={d14:{due:day(-3),iv:1,last:day(-4),best:60,n:1,sc:60,me:'B'},d03:{due:day(9),iv:14,last:day(-5),best:92,n:2,sc:92,me:'B'}};
 store.settings.flowCfg={ph:5,radio:5,rp:1};save();page('today');renderToday()});
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(300);
const chk=(sel)=>E(sel=>{const vw=document.documentElement.clientWidth,out=[];for(const el of document.querySelectorAll(sel)){if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;const r=el.getBoundingClientRect();out.push({t:el.textContent.trim().slice(0,14),l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height),lines:__lines(el),fs:parseFloat(getComputedStyle(el).fontSize),c:__contrast(el),w:Math.round(r.width)})}return {vw,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,out}},sel);
const fit=(m,minH=40)=>m.ovw<=0&&m.out.length>0&&m.out.every(x=>x.l>=0&&x.r<=m.vw&&x.lines===1&&x.h>=minH&&x.c>=4.5);
const H1=await chk('#todayBody .fcg-t, #todayBody .fcg-btns button, #todayBody .bk-r-btns button, #todayBody .wk-mini-t button, #todayBody [data-go="rpdue"], #todayBody .flow-start');
ok('今日頁（小手機＋特大字＋深色）：⚙️ 設定、備份提醒、Role Play 待複習、最近 7 天的按鈕都在畫面內、文字一行、高度至少 40px、深色對比足夠；沒有左右捲動',fit({...H1,out:H1.out.filter(x=>!/開始今天/.test(x.t))})&&H1.out.some(x=>/開始今天/.test(x.t)&&x.r<=H1.vw),JSON.stringify(H1));
const H2=await E(()=>{const vw=document.documentElement.clientWidth;return [...document.querySelectorAll('#todayBody .fcg-row')].map(r=>{const s=r.querySelector('span'),q=r.querySelector('select'),a=q.getBoundingClientRect(),fs=parseFloat(getComputedStyle(q).fontSize);return {t:s.textContent,lines:__lines(s),sw:Math.round(a.width),sr:Math.round(a.right),fs,ok:__lines(s)<=2&&a.width>=fs*4&&a.right<=vw&&a.height>=40&&__contrast(s)>=4.5&&__contrast(q)>=4.5}})});
ok('「調整今日學習」每一列：項目名稱最多兩行、下拉選單至少 4 個字寬且不超出畫面、選單高度至少 40px、深色對比足夠',H2.length===7&&H2.every(x=>x.ok),JSON.stringify(H2));
const H3=await chk('#todayBody .wk-chips span, #todayBody .fcg-est, #todayBody .bk-remind small');
ok('最近 7 天小卡、預估時間、備份提醒說明：不超出畫面，深色模式文字清楚',H3.ovw<=0&&H3.out.length>=5&&H3.out.every(x=>x.r<=H3.vw&&x.c>=4.5),JSON.stringify(H3).slice(0,400));
// 今日學習進度列（新的步驟名稱）
await pg.click('#todayBody .flow-start');await sleep(400);
const fbm=()=>E(()=>{const bar=$('#flowBar'),t=bar.querySelector('.fb-t'),b=t.querySelector('b');const fs=parseFloat(getComputedStyle(b).fontSize);const sm=t.querySelector('small');return {h:Math.round(bar.getBoundingClientRect().height),vh:innerHeight,tw:Math.round(t.getBoundingClientRect().width),fs,bl:__lines(b),sl:sm?__lines(sm):0,btn:[...bar.querySelectorAll('button')].map(x=>x.textContent+':'+__lines(x)),t:bar.textContent}});
/* 字型不同的電腦量到的高度不同（GitHub 測試機約多 8px），所以和原本就有說明文字的「句子跟讀」那一步比較，不寫死像素 */
const fbOk=m=>m.h<=m.vh*0.25&&m.tw>=m.fs*7&&m.bl<=2&&m.sl<=2&&m.btn.length>0&&m.btn.every(x=>/:1$/.test(x));
const steps=[];for(let k=0;k<8;k++){const m=await fbm();steps.push(m);if(/Role Play/.test(m.t))break;await E(()=>{FLOW.i++;flowGo()});await sleep(400)}
const sentH=(steps.find(m=>/句子跟讀/.test(m.t))||{h:0}).h,newSt=steps.filter(m=>/片語|無線電用語|Role Play/.test(m.t));
ok('進度列顯示新的步驟（💬 片語、📻 無線電用語、🎭 Role Play）時也不會擠成一字一行：按鈕文字一行、說明最多兩行、不比原本的「句子跟讀」那一步高、不超過畫面的 1/4',newSt.length===3&&sentH>0&&steps.every(fbOk)&&newSt.every(m=>m.h<=sentH+2),JSON.stringify(steps.map(m=>[m.h,m.tw,m.bl,m.sl,m.btn.join('|'),m.t.slice(0,30)])));
await E(()=>{rpOff();flowEnd()});
// 統計頁
await pg.click('#navStats');await sleep(500);
const H4=await E(()=>{const vw=document.documentElement.clientWidth,wk=document.querySelector('#statsBody .wk'),st=document.querySelector('#statsBody .st-box');const cells=[...wk.children].map(c=>c.getBoundingClientRect());const wr=wk.getBoundingClientRect();return {ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,wk:cells.every(r=>r.right<=wr.right+0.5&&r.left>=wr.left-0.5),wkr:Math.round(wr.right),st:Math.round(st.getBoundingClientRect().right),vw,last:__lines($('#backupBody .bk-last')),c:[...wk.querySelectorAll('b,.wk-n')].concat([...st.querySelectorAll('.st-top span,.st-leg span')]).map(__contrast),bg:getComputedStyle(wk).backgroundColor}});
ok('統計頁（小手機＋特大字＋深色）：每週摘要的表格和儲存空間不超出畫面、「上次備份」一行、深色對比足夠',H4.ovw<=0&&H4.wk&&H4.wkr<=H4.vw&&H4.st<=H4.vw&&H4.last===1&&H4.c.every(c=>c>=4.5)&&H4.bg!=='rgb(244, 248, 255)',JSON.stringify(H4));
// 情境列表的標籤、Role Play 完成畫面
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await sleep(200);
const H5=await E(()=>{const vw=document.documentElement.clientWidth;return [...document.querySelectorAll('#dialogBody .rp-badge')].map(e=>{const r=e.getBoundingClientRect(),c=e.closest('.dlg-card').getBoundingClientRect();return {t:e.textContent,ok:r.right<=c.right&&r.right<=vw&&__lines(e)===1&&__contrast(e)>=4.5}}).concat([{t:'ovw',ok:document.scrollingElement.scrollWidth<=document.scrollingElement.clientWidth}])});
const H6=await rpRun(pg,'d14','B',72);
const H7=await E(()=>{const e=$('#rpTop .rp-next-rev'),r=e.getBoundingClientRect();return {r:Math.round(r.right),vw:document.documentElement.clientWidth,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,c:__contrast(e),c2:__contrast(e.querySelector('small'))}});
ok('情境列表的「🎭 待複習／下次」標籤和 Role Play 完成畫面的「📅 下次複習」：不超出畫面、深色對比足夠',H5.length===3&&H5.every(x=>x.ok)&&/3 天後/.test(H6.top)&&H7.r<=H7.vw&&H7.ovw<=0&&H7.c>=4.5&&H7.c2>=4.5,JSON.stringify([H5,H7]));
ok('H 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p27.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
