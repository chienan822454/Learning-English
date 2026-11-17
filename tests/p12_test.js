// V5.21.0：補入核心高頻字、變化形改為詞形（紀錄轉移）、移除冷門字、職場英文（第 8 類）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8880);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);const ready=()=>pg.waitForFunction(()=>window.EX_READY===true||(typeof EX_READY!=='undefined'&&EX_READY),null,{timeout:15000}).catch(()=>{});
// 先放入 V5.20 的學習紀錄（含之後會改成詞形、被移除的字）
await pg.goto('http://localhost:8880/');await sleep(900);
await E(()=>{const s=JSON.parse(localStorage.getItem('english5000v5'));s.wordKeyVersion=3;s.wordStatus={accompanied:'known',buyers:'learning',bitcoin:'known',okay:undefined};s.wordKnown=['accompanied','bitcoin'];s.wordFav=['circumstances'];s.reviewDue={buyers:'2026-10-20'};s.reviewStage={buyers:2};s.wrongWords={accompanied:2,backed:1};delete s.migratedV4;delete s.migBackupV4;localStorage.setItem('english5000v5',JSON.stringify(s))});
await pg.reload();await sleep(1200);await ready();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const d=await E(()=>{const by={};WORDS.forEach(x=>by[x.w]=x);const base=WORDS.filter(x=>!x.b&&x.k<=5);return {base:base.length,books:[1,2,3,4,5].map(k=>base.filter(x=>x.k===k).length),acc:by.accompany&&!by.accompany.b&&by.accompany.k,okay:by.okay&&!by.okay.b&&by.okay.k,th:by.thirteen&&by.thirteen.k,accd:by.accompanied&&by.accompanied.b,buyers:by.buyers&&by.buyers.b,backed:by.backed&&by.backed.b,gone:['bitcoin','anime','knight'].filter(w=>by[w]).length,job:WORDS.filter(x=>x.k===8).length,jobOk:WORDS.filter(x=>x.k===8).every(x=>x.job&&!x.b&&x.ex),ex:!!(by.accompany||{}).ex}});
ok('仍是 5000 個原形、每冊 1000',d.base===5000&&d.books.every(n=>n===1000),JSON.stringify(d.books));
ok('補入核心高頻字（accompany、okay、thirteen…）且有例句',d.acc>=1&&d.okay>=1&&d.th>=1&&d.ex,JSON.stringify([d.acc,d.okay,d.th]));
ok('變化形改為詞形（accompanied→accompany、buyers→buyer、backed→back）',d.accd==='accompany'&&d.buyers==='buyer'&&d.backed==='back');
ok('冷門字已移除（bitcoin、anime、knight）',d.gone===0);
const N8=d.job;ok('職場英文 '+N8+' 字（第 8 類、都有例句；V5.21 起至少 247）',N8>=247&&d.jobOk,String(N8));
// 紀錄轉移
const m=await E(()=>({v:store.wordKeyVersion,n:store.migratedV4,bk:!!store.migBackupV4,acc:store.wordStatus.accompany,accOld:store.wordStatus.accompanied,known:store.wordKnown.includes('accompany')&&!store.wordKnown.includes('accompanied'),buyer:[store.wordStatus.buyer,store.reviewDue.buyer,store.reviewStage.buyer],fav:store.wordFav.includes('circumstance')&&!store.wordFav.includes('circumstances'),wrong:[store.wrongWords.accompany,store.wrongWords.back],btc:store.wordStatus.bitcoin,btcK:store.wordKnown.includes('bitcoin')}));
ok('學習紀錄轉移到新原形：已熟、學習中、複習日期與階段、收藏、答錯次數',m.v>=4&&m.acc==='known'&&!m.accOld&&m.known&&m.buyer[0]==='learning'&&m.buyer[1]==='2026-10-20'&&m.buyer[2]===2&&m.fav&&m.wrong[0]===2&&m.wrong[1]===1,JSON.stringify(m));
ok('轉移前的紀錄另存一份（migBackupV4）',m.bk&&m.n>=4,String(m.n));
ok('被移除的字，學習紀錄保留不刪',m.btc==='known'&&m.btcK);
await pg.reload();await sleep(900);ok('重新開啟不會重複轉移',await E(()=>store.wordKeyVersion>=4&&store.wordStatus.accompany==='known'&&store.wrongWords.accompany===2));
// 單字頁：職場英文
await pg.click('#navWords');await sleep(200);await pg.click('#bookChips [data-b="'+('8')+'"]');await sleep(250);
const wp=await E(()=>({cnt:$('#wordCount').textContent,opt:$('#wordBook option[value="8"]').textContent,badge:[...document.querySelectorAll('#wordRows .word-rank')].slice(0,5).map(e=>e.textContent),first:(document.querySelector('#wordRows .word-card')||{}).dataset}));
ok('單字頁「職場英文」：'+N8+' 字、標示「職場」',wp.cnt===String(N8)&&wp.opt.includes('職場英文（多益＋商用，'+N8+'）')&&wp.badge.every(t=>t==='職場'),JSON.stringify(wp));
await pg.click('#bookChips [data-b="'+('all')+'"]');await sleep(200);ok('「全部」仍只算 5000 原形（不含 CE 與職場英文）',await E(()=>$('#wordCount').textContent)==='5000');
await pg.fill('#wordSearch','technician');await pg.dispatchEvent('#wordSearch','input');await sleep(400);ok('搜尋可以找到職場英文的字',await E(()=>!!document.querySelector('#wordRows [data-w="technician"]')));await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(300);
await pg.fill('#wordSearch','accompanied');await pg.dispatchEvent('#wordSearch','input');await sleep(400);ok('搜尋舊的變化形（accompanied）會顯示，並連到原形',await E(()=>!!document.querySelector('#wordRows [data-w="accompanied"]')&&/accompany/.test(document.querySelector('#wordRows [data-w="accompanied"]').textContent)));await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(300);
// 今日新字不含職場英文
ok('今日新字（全部範圍）不會抽到職場英文或 CE 字',await E(()=>WORDS.filter(x=>statusOf(x.w)==='new'&&inBook(x,'all')).every(x=>!x.job&&!x.ce)));
// 測驗
await pg.click('#navQuiz');await pg.selectOption('#quizType','word');await pg.selectOption('#quizBook','8');await sleep(150);
ok('單字測驗可選「職場英文」，題目都來自職場英文',await E(()=>quizPool().length===WORDS.filter(x=>x.k===8).length&&quizPool().every(x=>x.k===8))&&(await pg.$$('#quizOpts button, #dictIn')).length>0);
// 句子頁
await pg.click('#navPractice');await pg.selectOption('#unit','w8');await sleep(300);
ok('句子頁「職場英文例句」'+N8+' 句可跟讀',new RegExp('/ '+N8+'$').test((await pg.textContent('#progress')).trim())&&(await E(()=>$('#unit option[value="w8"]').textContent)).includes('（'+N8+'）')&&await E(()=>cur().src==='word'&&cur().book===8),await pg.textContent('#progress'));
await pg.selectOption('#unit','wall');await sleep(300);ok('「單字例句・全部」不含職場英文與 CE',await E(()=>pool.every(s=>s.book<=5)));
// 統計
await pg.click('#navStats');await sleep(300);ok('統計頁顯示「職場英文」進度',/職場英文/.test(await pg.textContent('#statsBody')));
// 匯入 V5.20 的備份（含舊變化形的紀錄）→ 自動轉移
await E(()=>{const p={wordKeyVersion:3,wordStatus:{farmers:'known'},wordKnown:['farmers'],wordFav:[],fav:[],known:[],settings:{dailyGoal:20}};writeProgress(p,'測試匯入')});
await pg.waitForLoadState('load');await sleep(1500);
ok('匯入舊版備份：變化形的紀錄自動轉移到新原形（farmers→farmer）',await E(()=>store.wordStatus.farmer==='known'&&store.wordKnown.includes('farmer')&&!store.wordStatus.farmers&&store.wordKeyVersion>=4));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p12.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
