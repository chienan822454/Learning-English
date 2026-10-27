// V5.27.2：全面檢查後的除蟲（程式審查＋手機畫面實測＋字庫檢查）
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),crypto=require('crypto');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
let ROOT='site';const DELAY={};const LOG=[];
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';LOG.push(q.url);const f=path.join(ROOT,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}const send=()=>{s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(s)};DELAY[p]?setTimeout(send,DELAY[p]):send()}).listen(8888);
const U='http://localhost:8888/',VER=process.env.VER;
const sha12=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0,12);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
async function open(opt={},init,url){const ctx=await b.newContext(Object.assign({viewport:{width:390,height:844}},opt));if(init!==false)await ctx.addInitScript(init||stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.__dlg=[];pg.on('dialog',d=>{pg.__dlg.push(d.message());d.accept().catch(()=>{})});await pg.goto(url||U);await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
const navTop=pg=>pg.evaluate(()=>document.querySelector('nav').getBoundingClientRect().top);

// ---------- A. 一般手機（390×844） ----------
{const {ctx,pg,errs,E}=await open({permissions:['microphone','clipboard-read','clipboard-write']});
ok('版本號 '+VER,(await pg.textContent('#appVer')).includes(VER)&&('V'+await E(()=>APP_VERSION))===VER);
const A11=await E(()=>({sel:['unit','wordTopic','wordState','dailyGoal','phCat','phState','quizType','quizMode','quizBook','themeSel','fontSel','search','wordSearch','phSearch'].filter(id=>{const e=document.getElementById(id);return e&&!e.getAttribute('aria-label')}),en:document.querySelector('#english').getAttribute('lang')}));
ok('選單與搜尋框都有名稱（讀屏軟體唸得出來）；英文句子標示 lang="en"',A11.sel.length===0&&A11.en==='en',JSON.stringify(A11));
await pg.click('#navDialogs');await sleep(300);
const DC=await E(()=>{const c=document.querySelector('.dlg-card');return {role:c.getAttribute('role'),tab:c.tabIndex}});
await pg.focus('.dlg-card');await pg.keyboard.press('Enter');await sleep(300);
ok('情境卡可以用鍵盤開啟（移到卡片按 Enter）',DC.role==='button'&&DC.tab===0&&!!(await pg.$('#dlgBack')),JSON.stringify(DC));
await pg.click('#dlgBack');await sleep(200);
// 空的句子範圍
await pg.click('#navPractice');await sleep(200);await pg.selectOption('#unit','sdue');await sleep(300);
const EU=await E(()=>({u:$('#unit').value,note:$('#unitNote').hidden?'':$('#unitNote').textContent,prog:$('#progress').textContent}));
ok('空的句子範圍（待複習）：提示「目前沒有到期要複習的句子，先顯示精選句子」（原本默默換成精選句子，沒有說明）',/沒有到期要複習/.test(EU.note)&&/先顯示精選句子/.test(EU.note)&&/^精選/.test(EU.prog),JSON.stringify(EU));
await pg.selectOption('#unit','fav');await sleep(300);
const EF=await E(()=>({u:$('#unit').value,note:$('#unitNote').hidden?'':$('#unitNote').textContent}));
await pg.selectOption('#unit','all');await sleep(200);EF.after=await E(()=>$('#unitNote').hidden?'':$('#unitNote').textContent);
ok('空的句子範圍（我的收藏）：提示還沒有收藏的句子；換回有句子的範圍時提示消失',/還沒有收藏/.test(EF.note)&&EF.after==='',JSON.stringify(EF));
// 今日計數
for(let k=0;k<10;k++){await pg.click('#known');await sleep(50)}
const L1=await E(()=>({sent:todayLog().sent||0,known:store.known.length}));
await pg.click('#known');await sleep(100);const L2=await E(()=>({sent:todayLog().sent||0,known:store.known.length}));
ok('今日計數：「✓ 我會說了」來回點 10 次不會灌水（0）；真的標記 1 句才算 1',L1.sent===0&&L1.known===0&&L2.sent===1&&L2.known===1,JSON.stringify([L1,L2]));
await pg.click('#navPhrases');await sleep(300);
for(let k=0;k<6;k++){await pg.click('#phRows .word-card [data-a="known"]');await sleep(60)}
const P1=await E(()=>({ph:todayLog().ph||0,k:store.phKnown.length}));
ok('今日計數：片語 ○ 來回點不會灌水',P1.ph===0&&P1.k===0,JSON.stringify(P1));
// 單字頁數字
await pg.click('#navWords');await sleep(300);
await E(()=>{toggleFav('the');toggleFav(WORDS.find(x=>x.k===7).w);renderWords()});await sleep(200);
await pg.click('#bookChips [data-b="1"]');await sleep(300);const fv=await E(()=>+$('#wordFavN').textContent);
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(300);const fl=await E(()=>+$('#wordCount').textContent);
ok('單字頁「收藏」數字跟著冊別（第 1 冊收藏 1 個，點下去也是 1 個；原本顯示全部冊別的 2）',fv===1&&fl===1,fv+' / '+fl);
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(200);
await pg.click('#bookChips [data-b="7"]');await sleep(300);
const CE=await E(()=>({cnt:+$('#wordCount').textContent,all:WORDS.filter(x=>x.k===7).length,forms:WORDS.filter(x=>x.k===7&&x.b).map(x=>x.w)}));
ok('CE 專業字的詞形（'+CE.forms.join('、')+'）不再被「只學原形」藏起來：CE 清單 '+CE.all+' 個都看得到',CE.cnt===CE.all&&CE.forms.length>=4,JSON.stringify(CE));
await pg.click('#bookChips [data-b="all"]');await sleep(200);const lab1=await pg.textContent('#bookChips [data-b="all"]');
await E(()=>{store.settings.skipVar=false;renderWords()});await sleep(200);const lab2=await pg.textContent('#bookChips [data-b="all"]');
await E(()=>{store.settings.skipVar=true;renderWords()});await sleep(200);
ok('取消「只學原形」時，「全部 5000」按鈕改成「全部＋詞形」（清單含詞形，數字不再對不上）',lab1==='全部 5000'&&lab2==='全部＋詞形',lab1+' → '+lab2);
// 沒有結果的說明
await pg.fill('#wordSearch','qqqzzz');await pg.dispatchEvent('#wordSearch','input');await sleep(400);const ew=await pg.textContent('#wordRows');
await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(300);
await pg.click('#navPhrases');await sleep(200);await pg.fill('#phSearch','qqqzzz');await pg.dispatchEvent('#phSearch','input');await sleep(400);const ep=await pg.textContent('#phRows');
await pg.fill('#phSearch','');await pg.dispatchEvent('#phSearch','input');await sleep(300);
await pg.click('#navPractice');await sleep(200);await pg.click('#openList');await sleep(200);await pg.fill('#search','qqqzzz');await pg.dispatchEvent('#search','input');await sleep(400);const el=await pg.textContent('#rows');
await pg.fill('#search','the');await pg.dispatchEvent('#search','input');await sleep(500);const el2=await pg.textContent('#rows');await pg.fill('#search','');await pg.click('#back1');await sleep(200);
ok('沒有結果時顯示「找不到…」（單字、片語、句子表）；句子表超過 150 句時說明只顯示前 150 句',/找不到符合「qqqzzz」的單字/.test(ew)&&/找不到符合「qqqzzz」的片語/.test(ep)&&/找不到符合「qqqzzz」的句子/.test(el)&&/先顯示前 150 句/.test(el2),[ew.slice(0,24),ep.slice(0,24),el.slice(0,24),el2.slice(0,30)].join(' | '));
// 備份訊息只在統計頁
await pg.click('#navStats');await sleep(400);await E(()=>backupMsg('測試訊息'));await pg.click('#navWords');await sleep(300);
ok('備份訊息只出現在統計頁（不會出現在單字頁）',!(await E(()=>{const w=$('#wordBackupMsg');return !!w&&!w.hidden})));
// 錯題本
await E(()=>{store.wrongWords={apple:2,water:2};save()});await pg.click('#navStats');await sleep(400);await E(()=>openWrongBook());await sleep(300);
const WB=await E(()=>({act:[...document.querySelectorAll('nav button.active')].map(b=>b.id).join(),back:$('#wbBack').textContent}));
await pg.click('#wrongBody [data-wbdel]');await sleep(200);const afterDel=await E(()=>Object.keys(store.wrongWords).length);const undo=!!(await pg.$('#wrongBody [data-wbundo]'));
if(undo){await pg.click('#wrongBody [data-wbundo]');await sleep(200)}const afterUndo=await E(()=>Object.keys(store.wrongWords).length);
await pg.click('#wbBack');await sleep(300);const backTo=await E(()=>!$('#statsPage').hidden);
ok('錯題本：從統計頁打開時「統計」維持亮起、返回回到統計；✕ 移除後可以「↩️ 復原」',WB.act==='navStats'&&/返回統計/.test(WB.back)&&afterDel===1&&undo&&afterUndo===2&&backTo,JSON.stringify({WB,afterDel,undo,afterUndo,backTo}));
// 單字卡連點
await pg.click('#navWords');await sleep(300);await E(()=>openCards(WORDS.filter(x=>!x.b&&x.k===1&&statusOf(x.w)==='new').slice(0,5)));await sleep(500);
const w0=await E(()=>cardPool.slice(0,2).map(x=>x.w));await pg.dblclick('#wordCard [data-ca="g-known"]');await sleep(300);
const st=await E(w=>w.map(x=>statusOf(x)),w0);await sleep(400);await pg.click('#wordCard [data-ca="g-known"]');await sleep(200);const st2=await E(w=>statusOf(w),w0[1]);
ok('單字卡「✓ 已熟」連點兩下只評分目前這張（下一張還沒看到不會被評分）',st[0]==='known'&&st[1]==='new'&&st2==='known',JSON.stringify(w0)+' '+JSON.stringify(st)+' '+st2);
await E(()=>renderWords());
// 測驗選項
const QO=await E(()=>{const pool=WORDS.filter(x=>!x.b&&x.k<=5);let bad=[];for(let t=0;t<400;t++){const x=pool[Math.floor(Math.random()*pool.length)];const o=pickOpts(x,pool);const xs=zhSenses(x.zh);for(const y of o){if((x.p&&y.p===x.p)||y.zh===x.zh||zhSenses(y.zh).some(s=>xs.includes(s))||y.b===x.w||x.b===y.w)bad.push(x.w+'/'+y.w)}if(new Set(o.map(y=>y.zh)).size<o.length||o.length<3)bad.push('dup/short '+x.w)}
 const th=WORDS.find(x=>x.w==='there'),tr=WORDS.find(x=>x.w==='their');let hom=0;if(th&&tr&&th.p===tr.p)for(let t=0;t<60;t++)if(pickOpts(th,pool).some(y=>y.w==='their'))hom++;
 const kn=WORDS.find(x=>x.w==='know');let own=0;if(kn)for(let t=0;t<60;t++)if(pickOpts(kn,WORDS.filter(y=>!y.b||y.k===7).concat(WORDS.filter(y=>y.b==='know'))).some(y=>y.b==='know'))own++;
 return {bad:bad.slice(0,5),nb:bad.length,hom,homPair:!!(th&&tr&&th.p===tr.p),own}});
ok('單字測驗選項：不會出現同音字（there／their）、答案自己的詞形（know／knew）、中文意思重疊或重複的選項（抽 400 題）',QO.nb===0&&QO.hom===0&&QO.homPair&&QO.own===0,JSON.stringify(QO));
const SQd=await E(()=>{let d=0;for(let t=0;t<150;t++){quiz();const z=[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent);if(new Set(z).size<z.length||z.length<4)d++}return d});
ok('句子測驗（看英文選中文）：4 個中文選項都不一樣（抽 150 題）',SQd===0,String(SQd));
const LZ=await E(()=>{const all=ALLS.filter(s=>s.src!=='dialog');let d=0;for(let t=0;t<200;t++){const x=all[Math.floor(Math.random()*all.length)];const o=qNear(x,all,'en',3);if(o.some(y=>y.zh===x.zh))d++}return d});
ok('聽力題（看中文選英文）：其他選項的中文不會和題目一樣',LZ===0,String(LZ));
// 安裝按鈕
const INS=await E(async()=>{const er=[];window.addEventListener('unhandledrejection',e=>er.push(String(e.reason)));let n=0;const ev=new Event('beforeinstallprompt');ev.prompt=()=>{n++;return n>1?Promise.reject(new Error('InvalidStateError')):Promise.resolve()};window.dispatchEvent(ev);const shown=!$('#install').hidden;$('#install').click();await new Promise(r=>setTimeout(r,50));$('#install').click();await new Promise(r=>setTimeout(r,50));return {shown,hidden:$('#install').hidden,n,er,bar:!!document.getElementById('errBar')}});
ok('「安裝 APP」按一次後收起，再按也不會出現紅色錯誤',INS.shown&&INS.hidden&&INS.n===1&&!INS.er.length&&!INS.bar,JSON.stringify(INS));
const SE=await E(()=>new Promise(r=>{const o=speechSynthesis.speak;speechSynthesis.speak=u=>setTimeout(()=>u.onerror&&u.onerror({error:'synthesis-failed'}),10);say('hello',1,1,()=>{speechSynthesis.speak=o;r('done')});setTimeout(()=>{speechSynthesis.speak=o;r('timeout')},4000)}));
ok('朗讀失敗時仍會繼續下一步（例如「⇄ 範例→我」會接著播放自己的錄音）',SE==='done',SE);
// iPhone 放大、深色模式對比
await pg.click('#navStats');await sleep(400);
const FZ=await E(()=>['#wordTopic','#wordState','#dailyGoal','#bkPaste'].map(s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):0}));
ok('iPhone 點選單或備份文字框時不會放大畫面（字級都 ≥ 16px）',FZ.every(v=>v>=16),JSON.stringify(FZ));
await E(()=>{store.settings.theme='dark';applyTheme()});await sleep(150);
const CT=await E(()=>{const L=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};const bg=e=>{while(e){const c=getComputedStyle(e).backgroundColor;if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c;e=e.parentElement}return 'rgb(255,255,255)'};const cr=e=>{const a=L(getComputedStyle(e).color),z=L(bg(e));return Math.round((Math.max(a,z)+.05)/(Math.min(a,z)+.05)*10)/10};return ['.panel h2','#statsPage h3','.hk'].map(s=>{const e=document.querySelector(s);return e?cr(e):0})});
await E(()=>{store.settings.theme='auto';applyTheme()});
ok('深色模式：標題與選項文字的對比 ≥ 4.5（原本約 2.6）',CT.every(v=>v>=4.5),JSON.stringify(CT));
// 錄音中切頁
await pg.click('#navPractice');await sleep(200);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording',null,{timeout:6000}).catch(()=>{});const r0=await E(()=>REC.state);
await pg.click('#navWords');await sleep(2200);const r1=await E(()=>({st:REC.state,live:!!(REC.stream&&REC.stream.getTracks().some(t=>t.readyState==='live'))}));
ok('錄音中切到其他頁：自動停止錄音並關閉麥克風（原本會一直錄）',r0==='recording'&&r1.st==='idle'&&!r1.live,r0+' → '+JSON.stringify(r1));
ok('一般手機測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 沒有朗讀功能的瀏覽器（LINE 等 App 內建瀏覽器） ----------
{const {ctx,pg,errs,E}=await open({},()=>{try{delete window.speechSynthesis;delete window.SpeechSynthesisUtterance}catch(e){}Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined,configurable:true})});
const T=await E(()=>({today:document.querySelector('#todayBody').children.length,bar:!!document.getElementById('errBar')}));
await pg.click('#navWords');await sleep(400);const words=await E(()=>!$('#wordPage').hidden&&document.querySelectorAll('#wordRows .word-card').length);
await pg.click('#wordRows .word-card [data-act="play"]');await sleep(300);await pg.click('#wordRows .word-card [data-act="play"]');await sleep(300);
ok('瀏覽器沒有朗讀功能時 App 照常開啟（今日頁、單字頁可用）；按播放提示改用 Safari／Chrome（只提示一次）',T.today>0&&!T.bar&&words>0&&pg.__dlg.length===1&&/用瀏覽器開啟/.test(pg.__dlg[0]||''),JSON.stringify({T,words,dlg:pg.__dlg}));
ok('沒有朗讀功能時沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. Android Chrome 的語音辨識：念完一句就結束（不支援連續辨識） ----------
{const {ctx,pg,errs,E}=await open({permissions:['microphone']},()=>{window.__sess=[];speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);
 class A{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},60)}
  stop(){if(this.running){this.running=false;setTimeout(()=>this.onend&&this.onend(),30)}}abort(){if(this.running){this.running=false;setTimeout(()=>this.onend&&this.onend(),10)}}
  hear(t){if(!this.running)return;this.results.push(Object.assign([{transcript:t}],{isFinal:true}));this.onresult&&this.onresult({results:this.results.slice()});this.running=false;setTimeout(()=>this.onend&&this.onend(),40)}
  silence(){if(!this.running)return;this.onerror&&this.onerror({error:'no-speech'});this.running=false;setTimeout(()=>this.onend&&this.onend(),40)}}
 window.SpeechRecognition=A;window.webkitSpeechRecognition=A;window.__speak=t=>window.__sess.filter(s=>s.running).forEach(s=>s.hear(t));window.__silent=()=>window.__sess.filter(s=>s.running).forEach(s=>s.silence())});
let navs=0;pg.on('framenavigated',f=>{if(f===pg.mainFrame())navs++});
await pg.click('#navPractice');await sleep(300);
const idle=()=>pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent),null,{timeout:13000}).catch(()=>{});
const res=[];for(let k=0;k<6;k++){const silent=k===1||k===3;await pg.click('#check');await sleep(500);if(navs)break;if(silent)await E(()=>window.__silent());else await E(()=>window.__speak(document.querySelector('#english').textContent));await sleep(2900);if(/停止/.test(await pg.textContent('#check')))await pg.click('#check');await idle();await sleep(200);res.push(silent?'－':(/相似度 100%/.test(await pg.textContent('#result'))?'✓':'✗'))}
ok('Android Chrome：🎤 念一句就結束、有一次沒聽到也不會每按兩次就重新載入網頁（連按 6 次）',navs===0&&res.length===6&&res.filter(x=>x==='✓').length===4,'重新載入 '+navs+' 次｜'+res.join(''));
ok('Android 語音辨識測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 匯入被竄改的備份檔：不會執行任何程式碼，欄位整理成正確型別 ----------
{const {ctx,pg,errs,E}=await open();
const X='<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const bk=await E(X=>{const t=day();const p=JSON.parse(JSON.stringify(store));p.settings.dailyGoal=X;p.dailyLog={[t]:{new:X}};p.quizRight=X;p.wordStatus={the:X,to:'known'};p.reviewDue={to:X,of:t};p.rpDone={d01:{of:X,avg:X,d:t}};p.lsWrong={'d:d01:0':X};p.wordKnown=['to'];return JSON.stringify({app:'english-5000',version:'5.27.1',schemaVersion:3,progress:p})},X);
await pg.click('#navStats');await sleep(400);
await E(t=>{const d=document.querySelector('.bk-paste');if(d)d.open=true;$('#bkPaste').value=t},bk);
await pg.click('#bkPasteGo').catch(async()=>{await E(()=>{const b=[...document.querySelectorAll('#backupBody button')].find(b=>/匯入/.test(b.textContent)&&/貼上/.test(b.closest('details')?'貼上':''));b&&b.click()})});
await pg.waitForLoadState('load');await sleep(1600);
for(const n of ['#navToday','#navStats','#navWords','#navDialogs']){await pg.click(n);await sleep(400)}
await E(()=>openWrongBook());await sleep(300);await pg.click('#navDialogs');await sleep(200);await pg.click('.dlg-card[data-d="d01"]');await sleep(300);
const S=await E(()=>({x:window.__xss||0,goal:store.settings.dailyGoal,ws:store.wordStatus,rd:store.reviewDue,qr:store.quizRight,rp:store.rpDone.d01,log:store.dailyLog[day()]||{},ls:store.lsWrong,known:store.wordKnown}));
ok('匯入被竄改的備份檔（8 個欄位藏了網頁程式碼）：畫面不會執行任何程式碼；數字、日期、狀態整理成正確型別，其他紀錄照常匯入',S.x===0&&S.goal===20&&!S.ws.the&&S.ws.to==='known'&&!S.rd.to&&!!S.rd.of&&S.qr===0&&S.rp.of===0&&S.rp.avg===null&&!('new' in S.log)&&!Object.keys(S.ls).length&&S.known.includes('to'),JSON.stringify(S).slice(0,400));
ok('匯入測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 兩個分頁（或 App＋瀏覽器）同時開 ----------
{const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(stub);const A=await ctx.newPage(),B=await ctx.newPage();const errs=[];[A,B].forEach(p=>p.on('pageerror',e=>errs.push(e.message)));
await A.goto(U);await sleep(1200);await B.goto(U);await sleep(1500);let nB=0;B.on('framenavigated',f=>{if(f===B.mainFrame())nB++});
await A.evaluate(()=>{WORDS.filter(x=>!x.b&&x.k===1).slice(0,50).forEach(x=>setStatus(x.w,'known'));saveNow()});await sleep(2200);
await B.click('#navWords');await sleep(400);await B.click('#wordRows .word-card [data-act="fav"]');await sleep(900);
const kn=await A.evaluate(()=>{const s=JSON.parse(localStorage.getItem('english5000v5'));return {known:Object.values(s.wordStatus).filter(v=>v==='known').length,fav:s.wordFav.length}});
ok('兩個分頁同時開：A 標記 50 個已熟後，舊的 B 分頁會先重新載入，B 再按收藏也不會把 A 的 50 個蓋掉',kn.known>=50&&kn.fav===1&&nB>=1,JSON.stringify(kn)+'｜B 重新載入 '+nB+' 次');
await sleep(2500);const nB2=nB;await sleep(2000);
ok('兩個分頁不會互相一直重新載入',nB===nB2&&errs.length===0,'B '+nB+' 次｜'+errs.join(' | '));await ctx.close()}

// ---------- F. 儲存空間不足 ----------
{const {ctx,pg,errs,E}=await open();
const F=await E(async()=>{const big=n=>({wordKnown:[],pad:'x'.repeat(n)});Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap')).forEach(k=>localStorage.removeItem(k));let lo=100000,hi=1800000;
 // 用 3 份自動備份（V5.28.0 起每天一個鍵）把空間塞到只剩很少
 const put=n=>{try{['2026-01-03','2026-01-02','2026-01-01'].forEach(d=>localStorage.removeItem('english5000v5_snap_'+d));['2026-01-03','2026-01-02','2026-01-01'].forEach(d=>localStorage.setItem('english5000v5_snap_'+d,JSON.stringify(big(n))));localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(['2026-01-03','2026-01-02','2026-01-01'].map(d=>({date:d,summary:{}}))));return true}catch(e){return false}};
 while(hi-lo>40){const m=Math.floor((lo+hi)/2);if(put(m))lo=m;else hi=m}put(lo);
 const before=snapMeta().length;
 WORDS.filter(x=>!x.b&&x.k===2).slice(0,300).forEach(x=>{store.wordFav.push(x.w)});saveNow();
 const saved=JSON.parse(localStorage.getItem('english5000v5')).wordFav.length,after=snapMeta().length;
 return {before,saved,after,want:store.wordFav.length}});
ok('儲存空間不足時：自動清掉最舊的每日自動備份，學習紀錄照樣存好（不跳出「空間不足」）',F.before===3&&F.saved===F.want&&F.after<3&&pg.__dlg.length===0,JSON.stringify(F)+' '+JSON.stringify(pg.__dlg));
await E(()=>{Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap')).forEach(k=>localStorage.removeItem(k));const s=JSON.parse(localStorage.getItem('english5000v5'));s.pad='y'.repeat(1200000);localStorage.setItem('english5000v5',JSON.stringify(s));['2026-01-02','2026-01-01'].forEach(d=>localStorage.setItem('english5000v5_snap_'+d,JSON.stringify({wordKnown:['a'],pad:'z'.repeat(1200000)})));localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(['2026-01-02','2026-01-01'].map(d=>({date:d,summary:{}}))))});
await pg.reload();await sleep(1500);
const SN=await E(()=>({n:snapMeta().length,total:Object.keys(localStorage).reduce((a,k)=>a+localStorage.getItem(k).length,0)}));
ok('學習紀錄很大時，每日自動備份會少存幾份，留空間給學習紀錄（總用量 < 4M 字元）',SN.n>=1&&SN.n<3&&SN.total<4e6,JSON.stringify(SN));
ok('儲存空間測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 小手機（360×640）與大字體 ----------
{const {ctx,pg,errs,E}=await open({viewport:{width:360,height:640}},()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),1300);speechSynthesis.cancel=()=>{};Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true})});
await pg.click('#navDialogs');await sleep(300);await pg.click('.dlg-card[data-d="d02"]');await sleep(400);await pg.click('#dlgPlayAll');
const vis=[];let last=-1;for(let k=0;k<8;k++){await pg.waitForFunction(l=>DLG.playing>=0&&DLG.playing!==l,last,{timeout:5000}).catch(()=>{});last=await E(()=>DLG.playing);await sleep(900);vis.push(await E(()=>{const e=document.querySelector('#dialogBody .dlg-now');if(!e)return -1;const r=e.getBoundingClientRect(),nt=document.querySelector('nav').getBoundingClientRect().top;return Math.max(0,Math.min(r.bottom,nt)-Math.max(r.top,0))/r.height}))}
await E(()=>dlgStop());const seen=vis.filter(v=>v>=0);
ok('對話「▶ 播放整段」：正在念的那一句完整出現在畫面上（不會被底部選單擋住）',seen.length>=7&&seen.every(v=>v>=.95),seen.map(v=>Math.round(v*100)).join(','));
await E(()=>{store.settings.fontScale='1.3';applyFont()});await sleep(200);
await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d02"]');await sleep(300);await pg.click('#dlgRpB');await sleep(1500);
const rp=[];for(let k=0;k<5;k++){rp.push(await E(()=>{const c=document.querySelector('#check').getBoundingClientRect(),t=document.querySelector('#rpBox .rp-turn').getBoundingClientRect(),nt=document.querySelector('nav').getBoundingClientRect().top;return Math.round(nt-c.bottom)+'/'+Math.round(t.top)}));await E(()=>{RP.autoT&&clearTimeout(RP.autoT);rpNav(1)});await sleep(1300)}
ok('Role Play（360×640、特大字）：每一句「輪到你」和 🎤 都在畫面內（原本每句都捲回最上面）',rp.every(s=>+s.split('/')[0]>=0&&+s.split('/')[1]>=0),rp.join(' '));
await E(()=>{rpOff&&rpOff();store.settings.fontScale='1';applyFont()});
await pg.click('#navQuiz');await sleep(300);await pg.selectOption('#quizType','situ');await sleep(300);
const QV=[];for(let k=0;k<3;k++){await E(()=>window.scrollTo(0,0));await pg.click('#quizOpts button');await sleep(300);QV.push(await E(()=>{const n=document.querySelector('#newQuiz').getBoundingClientRect(),m=document.querySelector('#quizMsg').getBoundingClientRect(),nt=document.querySelector('nav').getBoundingClientRect().top;return n.bottom<=nt&&m.top>=0}));await pg.click('#newQuiz');await sleep(300)}
ok('小手機作答後：答對／答錯的說明和「下一題」自動出現在畫面內（情境題）',QV.every(Boolean),JSON.stringify(QV));
const sy=await E(()=>window.scrollY);ok('按「下一題」回到題目位置',sy===0,String(sy));
await E(()=>{store.settings.fontScale='1.3';applyFont()});await pg.click('#navWords');await sleep(300);
const OV=[];for(const w of ['telecommunication','recommendation','responsibility','congratulations']){if(!await E(w=>!!BY_WORD[w],w))continue;await E(w=>openCards([BY_WORD[w]]),w);await sleep(250);OV.push(w+':'+await E(()=>document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth))}
await E(()=>{store.settings.fontScale='1';applyFont();renderWords()});
ok('長的單字（telecommunication 等）在單字卡上不會超出畫面、不會左右捲動（360 寬、特大字）',OV.length>=3&&OV.every(s=>+s.split(':')[1]<=0),OV.join(' '));
await pg.click('#navStats');await sleep(400);await pg.click('#bkCopy');await sleep(400);
const cm=await E(()=>({msg:$('#backupMsg').textContent,paste:($('#bkPaste')||{}).value||''}));
let clip='';{const c3=await b.newContext({permissions:['clipboard-read','clipboard-write']});const p3=await c3.newPage();await p3.goto(U+'manifest.webmanifest');try{clip=await p3.evaluate(()=>navigator.clipboard.readText())}catch(e){clip='ERR '+e.message}await c3.close()}
const okCopy=/^✅/.test(cm.msg)?(()=>{try{return JSON.parse(clip).app==='english-5000'}catch(e){return false}})():/^❌/.test(cm.msg);
ok('「📋 複製備份內容」在不支援新式剪貼簿的瀏覽器：真的複製成功才顯示成功，也不會偷偷填進貼上框',okCopy&&cm.paste==='',cm.msg.slice(0,40)+'｜剪貼簿 '+clip.slice(0,30));
ok('小手機測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- H. 錄音：手機音訊一直不啟動時不會卡住 ----------
{const {ctx,pg,errs,E}=await open({permissions:['microphone']},()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);const C=window.AudioContext||window.webkitAudioContext;if(C){const r=C.prototype.resume;C.prototype.resume=function(){return new Promise(()=>{})};Object.defineProperty(C.prototype,'state',{get(){return 'suspended'},configurable:true})}});
await pg.click('#navPractice');await sleep(300);await pg.click('#record');await sleep(2600);
const RS=await E(()=>({st:REC.state,btn:document.querySelector('#record').textContent,dis:document.querySelector('#record').disabled}));
ok('錄音時手機音訊一直不啟動：最多等 1.5 秒就開始錄音（原本卡在「⏳ 開啟麥克風…」）',RS.st==='recording'&&!RS.dis,JSON.stringify(RS));
await pg.click('#record');await sleep(800);
ok('錄音保護測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- I. 深色模式：開啟時就是深色（不會先閃白） ----------
{const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(stub);await ctx.addInitScript(()=>{try{localStorage.setItem('e5k_theme','dark')}catch(e){}});const pg=await ctx.newPage();DELAY['/app.js']=1800;
await pg.goto(U,{waitUntil:'commit'});await sleep(600);const early=await pg.evaluate(()=>({dark:document.documentElement.classList.contains('dark'),app:typeof APP_VERSION!=='undefined'})).catch(e=>({err:String(e)}));
delete DELAY['/app.js'];await sleep(2500);
ok('深色模式：程式還沒載入前畫面就已經是深色（原本先閃一下白色）',early.dark===true&&early.app===false,JSON.stringify(early));await ctx.close()}

// ---------- J. 統計頁在例句載入後更新 ----------
{const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(stub);await ctx.addInitScript(()=>{if(!window.__once){window.__once=1;try{if(!sessionStorage.getItem('t_go')){sessionStorage.setItem('t_go','1');sessionStorage.setItem('e5k_go','stats');sessionStorage.setItem('e5k_msg','x')}}catch(e){}}});const pg=await ctx.newPage();DELAY['/data-ex.js']=2500;await pg.goto(U);await sleep(700);
const s0=await pg.evaluate(()=>({ex:EX_READY,stats:!document.querySelector('#statsPage').hidden,t:document.querySelector('#statsBody').textContent.match(/\d+ \/ (\d+)/g)}));delete DELAY['/data-ex.js'];
await pg.waitForFunction(()=>EX_READY,null,{timeout:15000}).catch(()=>{});await sleep(400);
const s1=await pg.evaluate(()=>({ex:EX_READY,html:document.querySelector('#statsBody').innerHTML.includes('/ '+ALLS.length)}));
ok('統計頁在單字例句載入後更新句子總數（原本停在載入前的數字）',s0.stats&&s0.ex===false&&s1.ex&&s1.html,JSON.stringify([s0.ex,s1]));await ctx.close()}

// ---------- K. 更新：字庫和版本不符時先不更新；回到「今日」頁時套用新版 ----------
{const NX='/tmp/t5/p19next';fs.rmSync(NX,{recursive:true,force:true});fs.cpSync('site',NX,{recursive:true});
 const sw=fs.readFileSync(path.join('site','sw.js'),'utf8');
 const bump=(v,bad)=>{fs.writeFileSync(path.join(NX,'app.js'),fs.readFileSync(path.join('site','app.js'),'utf8').replace(/const APP_VERSION='[^']+'/,`const APP_VERSION='${v}'`));fs.writeFileSync(path.join(NX,'index.html'),fs.readFileSync(path.join('site','index.html'),'utf8').replace(/id="appVer">V[^<]+</,`id="appVer">V${v}<`));
  fs.writeFileSync(path.join(NX,'sw.js'),sw.replace(/const C='[^']+'/,`const C='english-5000-v${v.replace(/\./g,'-')}'`).replace(/'data\.js':'[0-9a-f]{12}'/,bad?"'data.js':'000000000000'":"'data.js':'"+sha12(path.join('site','data.js'))+"'"))};
 const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 ROOT='site';await pg.goto(U);await sleep(1500);await pg.reload();await sleep(1500);
 const KS=()=>pg.evaluate(()=>caches.keys());const AV=()=>pg.evaluate(()=>APP_VERSION).catch(()=>'?');
 bump('9.9.8',true);ROOT=NX;LOG.length=0;await pg.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{}));await sleep(3500);
 const retried=LOG.some(u=>/data\.js\?v=/.test(u));await pg.reload();await sleep(1500);const v1=await AV();
 ok('新版的字庫和版本記錄不符（伺服器還在送舊檔）：先換網址重抓一次，還是不符就先不更新，繼續用目前版本',retried&&v1===VER.slice(1),'重抓 '+retried+'｜目前 '+v1);
 bump('9.9.9',false);await pg.click('#navWords');await sleep(300);await pg.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{}));
 for(let k=0;k<30;k++){await sleep(300);if((await KS()).includes('english-5000-v9-9-9'))break}await sleep(1500);
 const mid=await AV();await pg.click('#navToday');await pg.waitForLoadState('load').catch(()=>{});await sleep(2500);const v2=await AV();
 ok('有新版本時在單字頁先不打斷；回到「今日」頁就自動套用新版',mid===VER.slice(1)&&v2==='9.9.9',mid+' → '+v2);
 ROOT='site';ok('更新測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p19.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
