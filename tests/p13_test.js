// V5.22.0：補入日常字、單字問題修正（lying、stairs…）、更多變化形改為詞形（紀錄轉移 MERGED5）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8881);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);const ready=()=>pg.waitForFunction(()=>window.EX_READY===true||(typeof EX_READY!=='undefined'&&EX_READY),null,{timeout:15000}).catch(()=>{});
// 先放入 V5.21 的學習紀錄（含之後會改成詞形、被移除的字）
await pg.goto('http://localhost:8881/');await sleep(900);
await E(()=>{const s=JSON.parse(localStorage.getItem('english5000v5'));s.wordKeyVersion=4;s.wordStatus={allowed:'known',allow:'learning',working:'learning',stairs:'review',inter:'known',lying:'learning'};s.wordKnown=['allowed','inter'];s.wordFav=['stairs','guys'];s.reviewDue={working:'2026-10-25',work:'2026-10-28',stairs:'2026-10-21'};s.reviewStage={working:3,work:1};s.wrongWords={hits:2,hit:1,lying:1};delete s.migratedV5;delete s.migBackupV5;localStorage.setItem('english5000v5',JSON.stringify(s))});
await pg.reload();await sleep(1200);await ready();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const d=await E(()=>{const by={};WORDS.forEach(x=>by[x.w]=x);const base=WORDS.filter(x=>!x.b&&x.k<=5);const nw=['onion','tomato','supermarket','downstairs','hers','theirs','refrigerator','kilometer','oh','hey','wow','tv','t-shirt','quotation','unconscious'];
 return {base:base.length,books:[1,2,3,4,5].map(k=>base.filter(x=>x.k===k).length),nw:nw.filter(w=>by[w]&&!by[w].b&&by[w].k>=1&&by[w].k<=5&&by[w].ex&&by[w].exz).length,nwN:nw.length,tv:by.tv&&by.tv.d,ts:by['t-shirt']&&by['t-shirt'].d,
  forms:[by.boiling&&by.boiling.b,by.bent&&by.bent.b,by["ma'am"]&&by["ma'am"].b,by.upwards&&by.upwards.b,by.downwards&&by.downwards.b],hw:['lying','hits','bits','beings','ups','stairs'].map(w=>by[w]&&by[w].b),
  stair:!!(by.stair&&!by.stair.b&&by.stair.k<=5),gone:['inter','ultra'].filter(w=>by[w]).length,conv:['allowed','working','guys','shown','others'].map(w=>by[w]&&by[w].b),
  formBook:['allowed','working','stairs','hits','boiling',"ma'am"].every(w=>by[w]&&by[by[w].b]&&by[w].k===by[by[w].b].k),ex:['boiling','bent',"ma'am",'allowed','stairs'].every(w=>by[w]&&by[w].ex&&by[w].exz),ups:by.UPS&&by.UPS.ce}});
ok('仍是 5000 個原形、每冊 1000',d.base===5000&&d.books.every(n=>n===1000),JSON.stringify(d.books));
ok('補入日常字（onion、supermarket、hers、kilometer、oh、TV…）且有例句',d.nw===d.nwN,d.nw+'/'+d.nwN);
ok('TV、T-shirt 以大寫顯示',d.tv==='TV'&&d.ts==='T-shirt',d.tv+' '+d.ts);
ok("新增詞形：boiling→boil、bent→bend、ma'am→madam、upwards→upward、downwards→downward",JSON.stringify(d.forms)===JSON.stringify(['boil','bend','madam','upward','downward']),JSON.stringify(d.forms));
ok('單字問題：lying、hits、bits、beings、ups、stairs 改為原形的詞形',JSON.stringify(d.hw)===JSON.stringify(['lie','hit','bit','being','up','stair']),JSON.stringify(d.hw));
ok('stair 是原形；inter、ultra（不是獨立的英文字）已移除；CE 的 UPS 不受影響',d.stair&&d.gone===0&&d.ups,JSON.stringify([d.stair,d.gone]));
ok('變化形改為詞形（allowed→allow、working→work、guys→guy、shown→show、others→other）',JSON.stringify(d.conv)===JSON.stringify(['allow','work','guy','show','other']),JSON.stringify(d.conv));
ok('詞形與原形同冊、都有例句',d.formBook&&d.ex);
// 紀錄轉移
const m=await E(()=>({v:store.wordKeyVersion,n:store.migratedV5,bk:!!store.migBackupV5,allow:store.wordStatus.allow,allowedOld:store.wordStatus.allowed,known:store.wordKnown.includes('allow')&&!store.wordKnown.includes('allowed'),work:[store.wordStatus.work,store.reviewDue.work,store.reviewStage.work,store.wordStatus.working],stair:[store.wordStatus.stair,store.reviewDue.stair],fav:store.wordFav.includes('stair')&&store.wordFav.includes('guy')&&!store.wordFav.includes('stairs')&&!store.wordFav.includes('guys'),lie:store.wordStatus.lie,wrong:[store.wrongWords.hit,store.wrongWords.lie,store.wrongWords.hits],inter:[store.wordStatus.inter,store.wordKnown.includes('inter')]}));
ok('紀錄轉移：已熟不降級（allowed 已熟 → allow 已熟）',m.allow==='known'&&!m.allowedOld&&m.known,JSON.stringify([m.allow,m.allowedOld,m.known]));
ok('學習中、複習日期取最早、複習階段取最高（working→work）',m.work[0]==='learning'&&m.work[1]==='2026-10-25'&&m.work[2]===3&&!m.work[3],JSON.stringify(m.work));
ok('收藏、狀態與複習日期轉移（stairs→stair、guys→guy、lying→lie）',m.fav&&m.stair[0]==='review'&&m.stair[1]==='2026-10-21'&&m.lie==='learning',JSON.stringify([m.stair,m.lie]));
ok('答錯次數相加（hits 2＋hit 1 → 3；lying→lie）',m.wrong[0]===3&&m.wrong[1]===1&&!m.wrong[2],JSON.stringify(m.wrong));
ok('轉移前的紀錄另存一份（migBackupV5），紀錄版本 ≥ 5',m.bk&&m.n>=5&&m.v>=5,JSON.stringify([m.n,m.v]));
ok('被移除的字（inter）學習紀錄保留不刪',m.inter[0]==='known'&&m.inter[1]);
await pg.reload();await sleep(900);ok('重新開啟不會重複轉移',await E(()=>store.wordKeyVersion>=5&&store.wordStatus.allow==='known'&&store.wrongWords.hit===3&&store.reviewStage.work===3));
// 單字頁
await pg.click('#navWords');await sleep(200);await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(250);
ok('單字頁「全部」仍是 5000 個原形',await E(()=>$('#wordCount').textContent)==='5000');
const srch=async q=>{await pg.fill('#wordSearch',q);await pg.dispatchEvent('#wordSearch','input');await sleep(400)};
await srch('supermarket');ok('搜尋新字 supermarket 可以找到，有例句',await E(()=>{const r=document.querySelector('#wordRows [data-w="supermarket"]');return !!r&&!!r.querySelector('.ex')}));
await srch('tv');ok('搜尋 tv 可以找到 TV',await E(()=>{const r=document.querySelector('#wordRows [data-w="tv"]');return !!r&&/TV/.test(r.textContent)}));
await srch('allowed');ok('搜尋舊原形 allowed 會顯示，並連到原形 allow',await E(()=>{const r=document.querySelector('#wordRows [data-w="allowed"]');return !!r&&/allow/.test(r.textContent)}));
await srch('ups');ok('搜尋 ups：CE 的 UPS（不斷電系統）與 ups and downs 都找得到',await E(()=>{const t=$('#wordRows').textContent;return /不斷電系統/.test(t)&&/起伏/.test(t)}));
await srch('');
// 今日新字、句子
ok('今日新字可抽到新字，不會抽到已改為詞形的字',await E(()=>{const p=WORDS.filter(x=>statusOf(x.w)==='new'&&inBook(x,'all')&&!(skipV()&&x.b&&x.k!==7));return p.some(x=>x.w==='onion')&&p.some(x=>x.w==='supermarket')&&!p.some(x=>x.w==='allowed'||x.w==='working'||x.w==='stairs')}));
ok('句子頁「單字例句」有新字的例句',await E(()=>wordSents().some(s=>s.keys[0]==='onion'&&s.book>=1&&s.book<=5)&&wordSents().some(s=>s.keys[0]==='boiling')));
// 匯入 V5.21 的備份（含舊原形的紀錄）→ 自動轉移
await E(()=>{const p={wordKeyVersion:4,wordStatus:{working:'known'},wordKnown:['working'],wordFav:['stairs'],fav:[],known:[],settings:{dailyGoal:20}};writeProgress(p,'測試匯入')});
await pg.waitForLoadState('load');await sleep(1500);
ok('匯入 V5.21 備份：紀錄自動轉移（working→work、stairs→stair）',await E(()=>store.wordStatus.work==='known'&&store.wordKnown.includes('work')&&!store.wordStatus.working&&store.wordFav.includes('stair')&&store.wordKeyVersion>=5));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p13.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
