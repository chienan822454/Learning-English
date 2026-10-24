// V5.23.0：TOEIC 多益章節、補齊職場英文、衍生字與英式用字、例句改用原形、音標寫法統一
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8882);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();require('./common').wfAuto(pg);const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);const ready=()=>pg.waitForFunction(()=>window.EX_READY===true||(typeof EX_READY!=='undefined'&&EX_READY),null,{timeout:15000}).catch(()=>{});
await pg.goto('http://localhost:8882/');await sleep(1200);await ready();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const d=await E(()=>{const by={};WORDS.forEach(x=>by[x.w]=x);const base=WORDS.filter(x=>!x.b&&x.k<=5);const T=WORDS.filter(x=>x.toeic);
 return {base:base.length,books:[1,2,3,4,5].map(k=>base.filter(x=>x.k===k).length),nT:T.length,rk:new Set(T.map(x=>x.toeic)).size,cats:{book:T.filter(x=>x.k<=5).length,ce:T.filter(x=>x.k===7).length,job:T.filter(x=>x.k===8).length},
  job:WORDS.filter(x=>x.k===8).length,jobAllT:WORDS.filter(x=>x.k===8).every(x=>(x.toeic||x.bsl||x.acr)&&x.job&&!x.b&&x.ex),
  newJ:['mister','e-book','merchandise','ice cream','waiter','careless','renowned'].filter(w=>by[w]&&by[w].k===8&&by[w].toeic&&by[w].ex).length,
  mapped:['resume','pants','cafe','headquarters','generator','vacation'].filter(w=>by[w]&&by[w].toeic).length,
  happily:by.happily&&[by.happily.b,by.happily.v,by.happily.k===by.happy.k],petrol:by.petrol&&[by.petrol.b,by.petrol.v],
  ipa:WORDS.filter(x=>/[ʌɡɜ]|tʃ|dʒ/.test(x.p)).length,
  ex:[/\bassign\b/i.test(by.assign.ex),/\bstair\b/i.test(by.stair.ex),/\bwake up\b/i.test((PHRASES.find(p=>p.p==='wake up')||{}).ex||''),/\bbe good at\b/i.test((PHRASES.find(p=>p.p==='be good at')||{}).ex||'')],
  bn:bookName(by.vacation)}});
ok('仍是 5000 個原形、每冊 1000',d.base===5000&&d.books.every(n=>n===1000),JSON.stringify(d.books));
ok('TOEIC 多益 1247 字（TSL 1,250 字全收）、排名不重複（5000 裡、CE、職場英文都有）',d.nT===1247&&d.rk===1247&&d.cats.book>500&&d.cats.ce>0&&d.cats.job>500,JSON.stringify([d.nT,d.cats]));
ok('職場英文補齊：都是多益字（V5.26 起另有商用字、V5.32 起另有常用縮寫）、都有例句（mister、e-book、merchandise、ice cream、waiter…）',d.job>=500&&d.jobAllT&&d.newJ===7,JSON.stringify([d.job,d.newJ]));
ok('TOEIC 字對應到 App 已有的字（résumé→resume、pant→pants、café→cafe…）',d.mapped===6,String(d.mapped));
ok('衍生字 happily 掛在 happy 下面（同冊）',JSON.stringify(d.happily)===JSON.stringify(['happy','d',true]),JSON.stringify(d.happily));
ok('英式用字 petrol 對應美式 gas',JSON.stringify(d.petrol)===JSON.stringify(['gas','u']),JSON.stringify(d.petrol));
ok('音標寫法統一（沒有 ʌ、ɡ、ɜ、tʃ、dʒ）',d.ipa===0,String(d.ipa));
ok('例句改用原形（assign、stair、wake up、be good at）',d.ex.every(Boolean),JSON.stringify(d.ex));
ok('單字資訊顯示多益排名（vacation：多益 #2）',/多益 #2/.test(d.bn),d.bn);
// 單字頁：TOEIC 章節
await pg.click('#navWords');await sleep(200);await pg.click('#bookChips [data-b="'+('toeic')+'"]');await sleep(300);
const wp=await E(()=>({cnt:$('#wordCount').textContent,opt:$('#wordBook option[value="toeic"]').textContent,first:[...document.querySelectorAll('#wordRows .word-card')].slice(0,3).map(e=>e.dataset.w),badge:[...document.querySelectorAll('#wordRows .word-rank')].slice(0,3).map(e=>e.textContent)}));
ok('單字頁「TOEIC 多益（1247）」：1247 字',wp.cnt==='1247'&&wp.opt==='TOEIC 多益（1247）',JSON.stringify(wp));
ok('依多益常用程度排列（mister 多益 1、vacation 多益 2）',wp.first[0]==='mister'&&wp.first[1]==='vacation'&&wp.badge[0]==='多益 1'&&wp.badge[1]==='多益 2',JSON.stringify(wp));
ok('今日新字選 TOEIC：從最常用的多益字開始',await E(()=>toeicSort(WORDS.filter(x=>statusOf(x.w)==='new'&&inBook(x,'toeic')&&!(skipV()&&x.b&&x.k!==7)),'toeic')[0].w==='mister'));
await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(250);ok('「全部」仍是 5000 個原形',await E(()=>$('#wordCount').textContent)==='5000');
const srch=async q=>{await pg.fill('#wordSearch',q);await pg.dispatchEvent('#wordSearch','input');await sleep(400)};
await srch('happy');ok('happy 的單字卡顯示「衍生字 happily」',await E(()=>{const r=document.querySelector('#wordRows [data-w="happy"]');return !!r&&/衍生字/.test(r.textContent)&&/happily/.test(r.textContent)}));
await srch('petrol');ok('搜尋 petrol：顯示「英式用字，相關美式字 gas」',await E(()=>{const r=document.querySelector('#wordRows [data-w="petrol"]');return !!r&&/英式用字/.test(r.textContent)&&/gas/.test(r.textContent)}));
await srch('gas');ok('gas 的單字卡列出英式用字 petrol',await E(()=>{const r=document.querySelector('#wordRows [data-w="gas"]');return !!r&&/英式用字/.test(r.textContent)&&/petrol/.test(r.textContent)}));
await srch('merchandise');ok('搜尋新的多益字 merchandise：有中文與例句',await E(()=>{const r=document.querySelector('#wordRows [data-w="merchandise"]');return !!r&&!!r.querySelector('.ex')&&!!r.querySelector('.zh').textContent.trim()}));
await srch('');
// 測驗
await pg.click('#navQuiz');await pg.selectOption('#quizType','word');await pg.selectOption('#quizBook','toeic');await sleep(200);
ok('單字測驗可選「TOEIC 多益」，1247 題都來自多益字',await E(()=>quizPool().length===1247&&quizPool().every(x=>x.toeic)&&$('#quizBook option[value="toeic"]').textContent==='TOEIC 多益（1247）')&&(await pg.$$('#quizOpts button, #dictIn')).length>0);
// 句子頁
await pg.click('#navPractice');await pg.selectOption('#unit','wt');await sleep(300);
ok('句子頁「TOEIC 多益例句」1247 句，從 mister 開始',/(^|\s)1 \/ 1247$/.test((await pg.textContent('#progress')).trim())&&await E(()=>cur().keys[0]==='mister'&&$('#unit option[value="wt"]').textContent==='TOEIC 多益例句（1247）'),await pg.textContent('#progress'));
// 統計
await pg.click('#navStats');await sleep(300);ok('統計頁顯示「TOEIC 多益」進度',/TOEIC 多益/.test(await pg.textContent('#statsBody')));
// V5.23.1：主題數字跟著冊別變、今日新字也套用主題
await pg.click('#navWords');await sleep(200);
const WORDS_EL_ALL=t=>t.allEl;const TC=async()=>E(()=>{const sel=$('#wordTopic'),o=sel.querySelector('option[value="el"]');const n=+((o.textContent.match(/（(\d+)）/)||[])[1]);const want=WORDS.filter(x=>(x.t||[]).includes('el')&&inBook(x,$('#wordBook').value)&&!(skipV()&&x.b&&x.k!==7)).length;return {n,want,label:o.textContent,topic:sel.value,cnt:+$('#wordCount').textContent,allEl:WORDS.filter(x=>(x.t||[]).includes('el')).length}});
await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(250);
const t0=await TC();ok('主題數字依目前範圍：「全部（5000 原形）」時「電力」的數字＝5000 原形裡的電力字',t0.n===t0.want&&t0.n>0&&t0.n<WORDS_EL_ALL(t0),JSON.stringify(t0));
await pg.selectOption('#wordTopic','el');await sleep(250);
const t1=await TC();ok('選「電力」後，清單字數和主題後面的數字一樣',t1.cnt===t1.n&&t1.topic==='el',JSON.stringify(t1));
await pg.click('#bookChips [data-b="'+('1')+'"]');await sleep(250);
const t2=await TC();ok('換成「第 1 冊」：保留「電力」，數字變成第 1 冊的電力字，清單字數一致',t2.topic==='el'&&t2.n===t2.want&&t2.cnt===t2.n&&t2.n<t1.n,JSON.stringify(t2));
await pg.click('#dailyStart');await sleep(300);
const dn=await E(()=>({n:cardPool.length,ok:cardPool.every(x=>(x.t||[]).includes('el')&&x.k===1&&!x.b&&statusOf(x.w)==='new'),want:Math.min(+$('#dailyGoal').value||20,WORDS.filter(x=>(x.t||[]).includes('el')&&x.k===1&&!x.b&&statusOf(x.w)==='new').length)}));
ok('今日新字套用主題：第 1 冊＋電力只出第 1 冊電力的新字',dn.n>0&&dn.ok&&dn.n===dn.want,JSON.stringify(dn));
await E(()=>renderWords());await sleep(200);
await pg.selectOption('#wordTopic','all');await sleep(200);await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(200);
await pg.click('#dailyStart');await sleep(300);
ok('主題選「全部主題」時，今日新字和原本一樣（全部 5000 原形）',await E(()=>cardPool.length>0&&cardPool.every(x=>!x.b&&x.k<=5&&statusOf(x.w)==='new')));
await E(()=>renderWords());await sleep(200);
await pg.click('#bookChips [data-b="'+('7')+'"]');await sleep(250);
const t3=await TC();ok('選「CE 專業字」：電力的數字＝CE 裡的電力字',t3.n===t3.want&&t3.n>0,JSON.stringify(t3));
await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(200);
await pg.click('#skipVar');await sleep(300);const t4=await TC();
await pg.click('#skipVar');await sleep(300);const t5=await TC();
ok('切換「只學原形」時主題數字跟著更新',t4.n===t4.want&&t5.n===t5.want&&t4.n>=t5.n&&await E(()=>skipV()),JSON.stringify([t4.n,t5.n]));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p14.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
