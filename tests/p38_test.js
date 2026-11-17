// V6.5.0：🌱 常用字根 104 個——資料檢查（例字在字庫裡、標得出字根、拆解、Big5）、字根頁（入口、搜尋、猜字根、展開、例字、記住了、篩選）、
// 單字卡與意思回想卡的字根、字根測驗（不會有兩個正確答案、正確率）、下載中／下載失敗／舊的 data-more.js、匯入整理、小手機與深色
// V6.6.0 起：新字根先看說明再作答、多了「用字根猜字義」、答錯時已記住的字根排入今天複習（不再改回還沒記住）；其餘新功能在 p39
// V6.7.0：字根 105 個（新增 pel / puls＝rt105，插在字母順序的位置，舊字根的編號不變）；字根數用 NR
const {launch,sleep,R,ok,fs}=require('./common');const http=require('http'),path=require('path'),vm=require('vm');
const PORT=8909,U='http://localhost:8909/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
/* 測試用網站：BLOCK＝讓檔案下載失敗；STALE＝data-more.js（沒有 ?v=）送出沒有 ROOTS 的舊版；LOG 記下完整網址 */
let BLOCK={},STALE=false;const LOG=[],MISS=[];
const NR=105;  /* 字根數（V6.7.0 新增 pel / puls） */
const stale=()=>fs.readFileSync('site/data-more.js','utf8').split('\n').filter(l=>!l.startsWith('window.ROOTS=')).join('\n');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(BLOCK[p]){q.socket.destroy();return}LOG.push(q.url);if(p.endsWith('/'))p+='index.html';
 if(STALE&&p==='/data-more.js'&&!/\?v=/.test(q.url)){s.writeHead(200,{'content-type':'application/javascript'});return s.end(stale())}
 const f=path.join('site',p);if(!fs.existsSync(f)){MISS.push(p);s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(PORT);
(async()=>{const b=await launch();
const open=async(o={})=>{const ctx=await b.newContext(Object.assign({viewport:{width:390,height:844},serviceWorkers:'block'},o.ctx||{}));const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),5)};speechSynthesis.cancel=()=>{}});
 if(o.init)await pg.addInitScript(o.init);
 await pg.goto(U);await pg.waitForFunction(()=>typeof ALLS!=='undefined'&&document.readyState==='complete',null,{timeout:30000});
 if(o.wait!==false)await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY&&EX_READY,null,{timeout:40000});
 await sleep(200);return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}};
const noOv=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
const cards=pg=>pg.evaluate(()=>[...document.querySelectorAll('#rootList .rt-card')].map(c=>c.dataset.rt));

/* ===== A. 資料 ===== */
{const c={window:{}};for(const f of ['data.js','data-ex.js','data-more.js'])vm.runInNewContext(fs.readFileSync(path.join('site',f),'utf8'),c);const w=c.window,RT=w.ROOTS||[];
 const M={};w.WORDS.forEach(x=>{if(!M[x.w])M[x.w]=x});
 const ids=RT.map(r=>r.id);
 ok('data-more.js 有 '+NR+' 個字根（ROOTS），編號 rt001～rt'+NR+' 都有、不重複；原本的 rt001～rt104 照順序（舊編號不變，新字根用新編號插在字母順序的位置）；字根依字母排序、不重複',RT.length===NR&&ids.slice().sort().every((v,k)=>v==='rt'+String(k+1).padStart(3,'0'))&&ids.filter(v=>+v.slice(2)<=104).every((v,k)=>v==='rt'+String(k+1).padStart(3,'0'))&&new Set(RT.map(r=>r.r)).size===NR&&RT.every((r,k)=>!k||RT[k-1].r.localeCompare(r.r)<0),RT.length);
 const bad=[];const ws=r=>(r.w||[]).concat((r.x||[]).map(x=>x[0]));
 RT.forEach(r=>{
  if(!['L','G','LG'].includes(r.o))bad.push(r.id+' 來源');
  if(!r.m||/^；|；$/.test(r.m)||!r.e||!/^[ -~]+$/.test(r.e))bad.push(r.id+' 意思');
  if(!Array.isArray(r.f)||!r.f.length||!r.f.every(f=>/^[a-z]{2,8}$/.test(f)))bad.push(r.id+' 拼法');
  if(!Array.isArray(r.w)||r.w.length>6||ws(r).length<3||new Set(ws(r)).size!==ws(r).length)bad.push(r.id+' 例字數');
  r.w.forEach(x=>{if(!M[x]||M[x].b)bad.push(r.id+' 不在字庫 '+x)});
  (r.x||[]).forEach(x=>{if(!Array.isArray(x)||x.length!==3||!x[1]||!x[2]||M[x[0]])bad.push(r.id+' 字庫外例字 '+x)});
  ws(r).forEach(x=>{if(!r.f.some(f=>x.toLowerCase().includes(f)))bad.push(r.id+' 標不出字根 '+x)});
  const bw=String(r.b||'').split('：')[0];if(!ws(r).includes(bw)||!(r.f.some(f=>r.b.includes(f))||r.b.includes('(s)')))bad.push(r.id+' 拆解 '+bw)});
 ok('每個字根：來源、中英文意思、拼法正確；3 個以上例字（字庫裡的例字最多 6 個、都是字庫裡的原形，不重複）；每個例字都標得出字根；拆解的字在例字裡',bad.length===0,bad.slice(0,8).join(' | ')||RT.reduce((n,r)=>n+ws(r).length,0)+' 個例字');
 const B=new Set();const d=new TextDecoder('big5');for(let a=0x81;a<=0xfe;a++)for(const t of [[0x40,0x7e],[0xa1,0xfe]])for(let c2=t[0];c2<=t[1];c2++){const ch=d.decode(new Uint8Array([a,c2]));if(ch.length===1&&ch!=='\ufffd')B.add(ch)}
 const nb=[];RT.forEach(r=>[r.m,r.b,r.t||''].concat((r.x||[]).map(x=>x[2])).forEach(s=>{for(const ch of s)if(ch.charCodeAt(0)>127&&!B.has(ch))nb.push(r.id+':'+ch)}));
 ok('字根的中文都能用 Big5 編碼',nb.length===0&&B.size>13000,nb.slice(0,8).join(' '));
 const all=JSON.stringify(RT);ok('字根資料沒有簡體用語（信息、軟件、視頻、默認、屏幕、質量、網絡）',!/信息|軟件|視頻|默認|屏幕|質量|網絡|服務器/.test(all));
 ok('大的資料都用 JSON.parse 格式（ROOTS）',/^window\.ROOTS=JSON\.parse\('/m.test(fs.readFileSync('site/data-more.js','utf8')));
}

/* ===== B. 字根頁 ===== */
{const {ctx,pg,errs,E}=await open();
 await pg.click('#navWords');await sleep(300);
 const e1=await E(()=>{const b=$('#rootOpen').getBoundingClientRect(),s=$('#wordSearch').getBoundingClientRect(),f=$('#wfToggle').getBoundingClientRect();return {vis:!!$('#rootOpen').offsetParent,same:Math.abs(b.top-s.top)<6&&Math.abs(b.top-f.top)<6,right:b.right<=innerWidth,inW:Math.round(s.width),t:$('#rootOpen').textContent}});
 ok('單字頁搜尋列有「🌱 字根」按鈕（和搜尋、篩選同一排、在畫面內）',e1.vis&&e1.same&&e1.right&&/字根/.test(e1.t)&&e1.inW>=100,JSON.stringify(e1));
 await pg.click('#rootOpen');await sleep(300);
 const p1=await E(()=>({vis:!$('#rootPage').hidden,words:$('#wordPage').hidden,nav:(document.querySelector('nav button.active')||{}).id,prog:$('#rtProg').textContent,n:document.querySelectorAll('#rootList .rt-card').length,open:document.querySelectorAll('#rootList .rt-card.open').length,back:$('#rtBack').textContent}));
 ok('打開字根頁：列出 '+NR+' 個字根、顯示「已記住 0 個」，底部選單仍標示「單字」，返回按鈕是「← 返回單字」',p1.vis&&p1.words&&p1.nav==='navWords'&&p1.prog.includes('共 '+NR+' 個')&&/已記住 0/.test(p1.prog)&&p1.n===NR&&p1.open===0&&/返回單字/.test(p1.back),JSON.stringify(p1));
 ok('字根頁沒有左右超出畫面',await noOv(pg));
 const pv=await E(()=>{const c=document.querySelector('#rootList .rt-card[data-rt="rt078"]');return {r:c.querySelector('.rt-r').textContent,m:c.querySelector('.rt-m').textContent,hl:[...c.querySelectorAll('.rt-pv .rt-hl')].map(b=>b.textContent)}});
 ok('收起來的字根卡：字根、中文意思、前 3 個例字（標出字根）',pv.r==='spec / spect / spic'&&pv.m==='看'&&pv.hl.length===3&&pv.hl.every(h=>/^spe?c?t?$|^spect$|^spec$/.test(h)),JSON.stringify(pv));
 /* 搜尋 */
 const srch=async q=>{await pg.fill('#rtSearch',q);await sleep(150);return {c:await cards(pg),note:await E(()=>(document.querySelector('#rootList .rt-note')||{}).textContent||'')}};
 let s1=await srch('看');ok('搜尋中文「看」：找到 spec 和 vid 兩個字根',s1.c.includes('rt078')&&s1.c.includes('rt101')&&s1.c.length<=6,s1.c.join());
 s1=await srch('inspect');ok('搜尋例字「inspect」：找到 spec',JSON.stringify(s1.c)==='["rt078"]',s1.c.join());
 s1=await srch('檢查');ok('搜尋例字的中文「檢查」：找到 spec',s1.c.includes('rt078'),s1.c.join());
 s1=await srch('spectator');ok('搜尋字根頁沒有的字「spectator」：列出這個字裡「可能」有的字根（spect），並說明僅供參考',s1.c.includes('rt078')&&/可能/.test(s1.note)&&/僅供參考/.test(s1.note),JSON.stringify(s1));
 s1=await srch('zzzz');ok('找不到時顯示說明',s1.c.length===0&&/找不到/.test(await E(()=>$('#rootList').textContent)));
 s1=await srch('');ok('清除搜尋：回到 '+NR+' 個',s1.c.length===NR);
 /* 展開 */
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(200);
 const o1=await E(()=>{const c=document.querySelector('#rootList .rt-card.open');const r=ROOTS.find(x=>x.id==='rt078');return {id:c&&c.dataset.rt,exp:c.querySelector('.rt-head').getAttribute('aria-expanded'),b:c.querySelector('.rt-b').textContent,o:c.querySelector('.rt-o').textContent,rows:c.querySelectorAll('.rt-w').length,want:r.w.length+(r.x||[]).length,zh:c.querySelector('.rt-w .rt-wz').textContent,wz:BY_WORD.inspect.zh,hl:c.querySelector('.rt-w .rt-hl').textContent,ex:!!c.querySelector('.rt-w .rt-ex'),tip:(c.querySelector('.rt-tip')||{}).textContent||'',top:Math.round(c.getBoundingClientRect().top)}});
 ok('點字根展開：拆解（inspect：in＋spect…）、來源（拉丁文）、每個例字一行（中文來自字庫、標出字根、有例句）、提醒',o1.id==='rt078'&&o1.exp==='true'&&/inspect：in（往裡面）＋ spect（看）/.test(o1.b)&&o1.o==='拉丁文'&&o1.rows===o1.want&&o1.zh.includes(o1.wz)&&o1.hl==='spect'&&o1.ex&&/💡/.test(o1.tip),JSON.stringify(o1));
 ok('展開的字根在畫面上',o1.top>=0&&o1.top<844);
 await E(()=>{window.__said=[]});await pg.click('#rootList .rt-card.open [data-rtsay="inspect"]');await pg.click('#rootList .rt-card.open [data-rtsayall]');await sleep(100);
 const said=await E(()=>window.__said);ok('🔊 念例字：單一例字、全部例字',said[0]==='inspect'&&/^inspect, inspection, /.test(said[1]||''),JSON.stringify(said));
 ok('展開後沒有左右超出畫面',await noOv(pg));
 await pg.click('#rootList [data-rtx="rt101"]');await sleep(200);
 ok('點另一個字根：只展開那一個',JSON.stringify(await E(()=>[...document.querySelectorAll('#rootList .rt-card.open')].map(c=>c.dataset.rt)))==='["rt101"]');
 await pg.click('#rootList [data-rtx="rt101"]');await sleep(150);ok('再點一次收起來',await E(()=>!document.querySelector('#rootList .rt-card.open')));
 /* 記住了 */
 await pg.click('#rootList [data-rtx="rt078"]');await sleep(150);await pg.click('#rootList [data-rtk="rt078"]');await sleep(200);
 const k1=await E(()=>({k:store.rootKnown,prog:$('#rtProg').textContent,mark:!!document.querySelector('#rootList .rt-card[data-rt="rt078"] .rt-k'),btn:document.querySelector('#rootList [data-rtk="rt078"]').textContent,day:store.studyDays.includes(day())}));
 ok('按「✓ 記住了」：記在學習紀錄、顯示 ✓、已記住 1 個、按鈕變成「改成還沒記住」、算今天有學習',JSON.stringify(k1.k)==='["rt078"]'&&/已記住 1/.test(k1.prog)&&k1.mark&&/還沒記住/.test(k1.btn)&&k1.day,JSON.stringify(k1));
 await pg.click('#rtFilter [data-rf="known"]');await sleep(150);const f1=await cards(pg);
 await pg.click('#rtFilter [data-rf="todo"]');await sleep(150);const f2=await cards(pg);
 await pg.click('#rtFilter [data-rf="all"]');await sleep(150);
 ok('篩選：已記住 1 個、還沒記住 '+(NR-1)+' 個',JSON.stringify(f1)==='["rt078"]'&&f2.length===NR-1&&!f2.includes('rt078'),f1.length+'/'+f2.length);
 await pg.reload();await pg.waitForFunction(()=>typeof MORE_READY!=='undefined'&&MORE_READY,null,{timeout:40000});await sleep(200);
 ok('重新開啟後仍記得已記住的字根',await E(()=>JSON.stringify(store.rootKnown)==='["rt078"]'));
 /* 例字 → 單字卡 → 字根 */
 await pg.click('#navWords');await sleep(200);await pg.click('#rootOpen');await sleep(200);await pg.click('#rootList [data-rtx="rt078"]');await sleep(150);
 await pg.click('#rootList .rt-card.open [data-rtw="inspect"]');await sleep(300);
 const c1=await E(()=>({vis:!$('#wordCard').hidden&&!$('#wordPage').hidden,w:cardPool[cardIndex]&&cardPool[cardIndex].w,chip:!!document.querySelector('#wordCard .rt-chips')}));
 ok('點例字：打開這個字的單字卡（還沒翻面時不顯示字根）',c1.vis&&c1.w==='inspect'&&!c1.chip,JSON.stringify(c1));
 await pg.click('#wordCard [data-ca="reveal"]');await sleep(200);
 const c2=await E(()=>[...document.querySelectorAll('#wordCard .rt-chip')].map(b=>[b.dataset.rtgo,b.textContent]));
 ok('單字卡翻面後顯示字根「🌱 字根 spect 看」',JSON.stringify(c2)==='[["rt078","spect 看"]]',JSON.stringify(c2));
 await pg.click('#wordCard .rt-chip');await sleep(300);
 const c3=await E(()=>({vis:!$('#rootPage').hidden,open:[...document.querySelectorAll('#rootList .rt-card.open')].map(c=>c.dataset.rt),back:$('#rtBack').textContent}));
 ok('點單字卡的字根：回到字根頁並展開那個字根',c3.vis&&JSON.stringify(c3.open)==='["rt078"]'&&/返回單字/.test(c3.back),JSON.stringify(c3));
 await pg.click('#rtBack');await sleep(200);
 ok('「← 返回單字」回到剛才的單字卡',await E(()=>!$('#wordPage').hidden&&!$('#wordCard').hidden&&cardPool[cardIndex].w==='inspect'));
 const multi=await E(()=>{const x=BY_WORD.telephone,y=WORDS.find(v=>!v.b&&v.zh&&!rtOfWord(v.w).length&&v.k===1);openCards([x]);cardReveal=true;showCard();const a=[...document.querySelectorAll('#wordCard .rt-chip')].map(b=>b.dataset.rtgo);openCards([y]);cardReveal=true;showCard();return {a,none:!document.querySelector('#wordCard .rt-chips'),y:y.w}});
 ok('一個字有兩個字根時都顯示（telephone：phon、tele）；不是例字的字不顯示字根',JSON.stringify(multi.a.slice().sort())==='["rt059","rt087"]'&&multi.none,JSON.stringify(multi));
 const mr=await E(()=>{mrStart([BY_WORD.inspect],'btn');const a=!!document.querySelector('#wordCard .rt-chips');cardReveal=true;showCard();return {before:a,after:[...document.querySelectorAll('#wordCard .rt-chip')].map(b=>b.dataset.rtgo)}});
 ok('意思回想卡：翻面前不顯示字根，翻面後顯示',!mr.before&&JSON.stringify(mr.after)==='["rt078"]',JSON.stringify(mr));
 await E(()=>{MR.on=false});
 /* 小手機＋特大字＋深色 */
 ok('沒有 JavaScript 錯誤（字根頁）',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs,E}=await open({ctx:{viewport:{width:360,height:740},colorScheme:'dark'},init:()=>{localStorage.setItem('e5k_fs','1.3')}});
 await E(()=>{store.settings.fontScale='1.3';applyFont()});await pg.click('#navWords');await sleep(200);
 const w1=await E(()=>({ov:document.documentElement.scrollWidth-innerWidth,r:Math.round($('#rootOpen').getBoundingClientRect().right),s:Math.round($('#wordSearch').getBoundingClientRect().width),fit:$('#rootOpen').scrollWidth<=$('#rootOpen').clientWidth+1}));
 ok('小手機＋特大字：單字頁的「🌱 字根」按鈕在畫面內、文字沒有超出，搜尋框還有空間',w1.ov<=0&&w1.r<=360&&w1.fit&&w1.s>=90,JSON.stringify(w1));
 await pg.click('#rootOpen');await sleep(200);await pg.click('#rootList [data-rtx="rt081"]');await sleep(200);
 const w2=await E(()=>{const els=[...document.querySelectorAll('#rootPage button, #rootPage input, #rootList .rt-w, #rootList .rt-b, #rootList .rt-tip')].filter(e=>e.offsetParent);return {ov:document.documentElement.scrollWidth-innerWidth,out:els.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+0.5}).length,n:els.length,dark:document.documentElement.classList.contains('dark'),bg:getComputedStyle(document.querySelector('#rootList .rt-card')).backgroundColor}});
 ok('小手機＋特大字＋深色：字根頁（展開後）沒有超出畫面，深色卡片背景',w2.ov<=0&&w2.out===0&&w2.n>10&&w2.dark&&w2.bg!=='rgb(255, 255, 255)',JSON.stringify(w2));
 ok('沒有 JavaScript 錯誤（小手機）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== C. 字根測驗 ===== */
{const {ctx,pg,errs,E}=await open();
 await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','roots');await sleep(300);
 const q0=await E(()=>({teach:!!document.querySelector('#quizOpts [data-rtstart]'),q:$('#quizQ').textContent}));
 if(q0.teach)await pg.click('#quizOpts [data-rtstart]');await sleep(150);
 const q1=await E(()=>({q:$('#quizQ').textContent,n:document.querySelectorAll('#quizOpts button[data-k]').length}));
 ok('測驗類型「🌱 字根測驗」：新字根先看說明，按「開始作答」後出題（4 個選項）',q0.teach&&/新字根/.test(q0.q)&&/🌱 字根測驗/.test(q1.q)&&q1.n===4,JSON.stringify({q0,q1}));
 const chk=await E(()=>{const sen=m=>m.split('；'),bad=[],kinds={};
  for(let t=0;t<150;t++){rootQuiz();const st=document.querySelector('#quizOpts [data-rtstart]');if(st){kinds.teach=(kinds.teach||0)+1;st.click()}
   const r=ROOTS.find(x=>x.id===RT.last),tag=$('#quizQ small').textContent,opts=[...document.querySelectorAll('#quizOpts button[data-k]')].map(b=>b.textContent);
   const kind=/看字根選意思/.test(tag)?'rm':/看意思選字根/.test(tag)?'mr':/用字根猜字義/.test(tag)?'wm':'wr';kinds[kind]=(kinds[kind]||0)+1;
   if(opts.length!==4||new Set(opts).size!==4)bad.push('選項數 '+opts.join('/'));
   if(kind==='wm'){if(opts.filter(o=>o===RT.cq.a).length!==1)bad.push('猜字義答案 '+RT.cq.w);continue}
   const os=opts.map(o=>kind==='rm'?ROOTS.filter(x=>x.m===o):ROOTS.filter(x=>x.r===o));
   if(os.some(a=>a.length!==1&&kind!=='rm'))bad.push('選項對不到字根');
   const right=kind==='rm'?r.m:r.r;if(opts.filter(o=>o===right).length!==1)bad.push('正確答案 '+right);
   os.forEach((a,k)=>{if(opts[k]===right)return;a.forEach(o=>{if(sen(o.m).some(s=>sen(r.m).includes(s)))bad.push('意思重疊 '+r.r+'/'+o.r);if(o.f.some(f=>r.f.includes(f)))bad.push('拼法相同 '+r.r+'/'+o.r)})});
   if(kind==='wr'){const w=$('#quizQ .rt-q').textContent.toLowerCase();if(rtOfWord(w).length!==1||!rtWords(r).map(x=>x.toLowerCase()).includes(w))bad.push('單字 '+w);os.forEach((a,k)=>{if(opts[k]!==right&&a[0].f.some(f=>w.includes(f)))bad.push('拼字在單字裡 '+w+'/'+a[0].r)})}}
  return {bad:[...new Set(bad)].slice(0,8),kinds}});
 ok('出 150 題：四種題目都有，選項不重複、只有一個正確答案（意思重疊、拼法相同的字根不會同時出；找字根題的單字只屬於一個字根，選項的拼字不在單字裡）',chk.bad.length===0&&chk.kinds.rm>10&&chk.kinds.mr>10&&chk.kinds.wr>10&&chk.kinds.wm>10&&chk.kinds.teach>0,JSON.stringify(chk));
 /* 答錯：已記住的字根仍是已記住，排入今天複習（V6.6.0） */
 await E(()=>{store.rootKnown=ROOTS.map(r=>r.id);save();rootQuiz()});
 const id=await E(()=>RT.last);
 await E(()=>{const b=[...document.querySelectorAll('#quizOpts button[data-k]')];b.find(x=>x.textContent!==RT.cq.a).click()});await sleep(200);
 const w1=await E(i=>({kn:store.rootKnown.includes(i),n:store.rootKnown.length,msg:$('#quizMsg').textContent,qs:store.qStat.root,go:!!document.querySelector('#quizMsg [data-rtgo]'),due:(store.rtDue||{})[i],today:day()}),id);
 ok('答錯：顯示正確答案、字根說明和拆解；已記住的字根仍是已記住、排入今天複習；記在字根測驗的正確率',w1.kn&&w1.n===NR&&/正確答案/.test(w1.msg)&&/🧩/.test(w1.msg)&&/排入今天複習/.test(w1.msg)&&w1.due===w1.today&&w1.qs[1]===1&&w1.go,JSON.stringify(w1));
 await E(()=>{rootQuiz()});await E(()=>{const b=[...document.querySelectorAll('#quizOpts button[data-k]')];b.find(x=>x.textContent===RT.cq.a).click()});await sleep(150);
 ok('答對：記在正確率',await E(()=>store.qStat.root[0]===1&&/答對了/.test($('#quizMsg').textContent)));
 await pg.click('#quizMsg [data-rtgo]');await sleep(300);
 const g=await E(()=>({vis:!$('#rootPage').hidden,open:[...document.querySelectorAll('#rootList .rt-card.open')].map(c=>c.dataset.rt),nav:(document.querySelector('nav button.active')||{}).id,back:$('#rtBack').textContent,last:RT.last}));
 ok('答題後「🌱 看這個字根」：打開字根頁並展開，底部選單標示「測驗」，返回按鈕是「← 返回測驗」',g.vis&&JSON.stringify(g.open)===JSON.stringify([g.last])&&g.nav==='navQuiz'&&/返回測驗/.test(g.back),JSON.stringify(g));
 await pg.click('#rtBack');await sleep(200);ok('「← 返回測驗」回到測驗頁',await E(()=>!$('#quiz').hidden&&$('#quizType').value==='roots'));
 await pg.click('#navStats');await sleep(300);
 ok('統計頁「各題型正確率」有「字根測驗」',await E(()=>/字根測驗/.test($('#statsBody').textContent)));
 await pg.click('#navWords');await sleep(150);await pg.click('#rootOpen');await sleep(200);await pg.click('#rtQuiz');await sleep(300);
 ok('字根頁的「🧠 字根測驗」：到測驗頁出字根題',await E(()=>!$('#quiz').hidden&&$('#quizType').value==='roots'&&/字根測驗/.test($('#quizQ').textContent)));
 ok('沒有 JavaScript 錯誤（字根測驗）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== D. 下載中、下載失敗、舊的 data-more.js ===== */
{BLOCK['/data-more.js']=1;const {ctx,pg,errs,E}=await open({wait:false});
 await pg.click('#navWords');await sleep(100);await pg.click('#rootOpen');await sleep(200);
 const d0=await E(()=>$('#rootList').textContent);
 await pg.waitForFunction(()=>MORE_FAIL===true,null,{timeout:40000}).catch(()=>{});await sleep(200);
 const d1=await E(()=>({t:$('#rootList').textContent,btn:!!document.querySelector('#rootList [data-rtretry]')}));
 ok('字根資料還沒下載完：顯示「下載中」；下載失敗：顯示「下載失敗」和「🔄 重新下載」',/下載中/.test(d0)&&/下載失敗/.test(d1.t)&&d1.btn,JSON.stringify({d0,d1}));
 delete BLOCK['/data-more.js'];await pg.click('#rootList [data-rtretry]');
 await pg.waitForFunction(n=>document.querySelectorAll('#rootList .rt-card').length===n,NR,{timeout:30000}).catch(()=>{});
 ok('按「🔄 重新下載」：下載完自動顯示 '+NR+' 個字根',await E(n=>document.querySelectorAll('#rootList .rt-card').length===n,NR));
 ok('沒有 JavaScript 錯誤（下載失敗）',errs.length===0,errs.join(' | '));await ctx.close()}
{BLOCK['/data-more.js']=1;const {ctx,pg,errs,E}=await open({wait:false});
 await pg.click('#navQuiz');await sleep(100);await pg.selectOption('#quizType','roots');await sleep(200);
 const t0=await E(()=>$('#quizQ').textContent);
 delete BLOCK['/data-more.js'];await E(()=>moreNeed());
 await pg.waitForFunction(()=>document.querySelectorAll('#quizOpts button[data-k]').length===4||!!document.querySelector('#quizOpts [data-rtstart]'),null,{timeout:30000}).catch(()=>{});
 ok('字根測驗：資料還沒下載完先顯示下載中，下載完自動出題（新字根先看說明）',/字根測驗/.test(t0)&&/(下載|載入)/.test(t0)&&await E(()=>document.querySelectorAll('#quizOpts button[data-k]').length===4||!!document.querySelector('#quizOpts [data-rtstart]')),t0.slice(0,80));
 ok('沒有 JavaScript 錯誤（測驗下載中）',errs.length===0,errs.join(' | '));await ctx.close()}
{STALE=true;LOG.length=0;const {ctx,pg,errs,E}=await open();
 const s0=await E(()=>!window.ROOTS&&MORE_READY);
 await pg.click('#navWords');await sleep(100);await pg.click('#rootOpen');
 await pg.waitForFunction(n=>document.querySelectorAll('#rootList .rt-card').length===n,NR,{timeout:30000}).catch(()=>{});
 ok('新版程式配到舊的 data-more.js（沒有字根）：用新網址重新下載，字根頁照常顯示',s0&&LOG.some(u=>/^\/data-more\.js\?v=/.test(u))&&await E(n=>document.querySelectorAll('#rootList .rt-card').length===n,NR),JSON.stringify(LOG.filter(u=>/data-more/.test(u))));
 STALE=false;ok('沒有 JavaScript 錯誤（舊資料）',errs.length===0,errs.join(' | '));await ctx.close()}

/* ===== E. 學習紀錄與備份 ===== */
{const {ctx,pg,errs,E}=await open();
 const n=await E(()=>({a:normStore({rootKnown:['rt001','bad','rt001',5,'rt104']}).rootKnown,b:'rootKnown' in normStore({rootKnown:'x'}),c:'rootKnown' in normStore({rootKnown:[]}),bk:checkBackup(JSON.stringify({app:'english-5000',fmt:6,progress:{rootKnown:'x',known:[]}})).err||'',ok:!checkBackup(JSON.stringify({app:'english-5000',fmt:6,progress:{rootKnown:['rt002'],known:[]}})).err}));
 ok('讀取／匯入學習紀錄時整理已記住的字根（只留 rt001 格式、不重複）；格式不對的備份檔不匯入',JSON.stringify(n.a)==='["rt001","rt104"]'&&!n.b&&!n.c&&/rootKnown/.test(n.bk)&&n.ok,JSON.stringify(n));
 ok('沒有 JavaScript 錯誤（紀錄）',errs.length===0,errs.join(' | '));await ctx.close()}

ok('測試期間只有圖示檔可能找不到（沒有其他 404）',MISS.every(p=>/^\/icon-\d+\.png$/.test(p)),[...new Set(MISS)].join(' '));
fs.writeFileSync('results_p38.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
