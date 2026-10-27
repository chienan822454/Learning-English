const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8840);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5)});
await pg.goto('http://localhost:8840/');await sleep(800);
const ST=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('english5000v5')));
// 1 change then reload immediately
await pg.evaluate(()=>{setStatus('apple','known')});await pg.reload();await sleep(700);ok('標記已熟後立刻重新整理：紀錄仍保存',(await ST()).wordKnown.includes('apple'));
// 2 change then go background immediately
await pg.evaluate(()=>{toggleFav('banana');Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
ok('收藏後立刻切到背景：紀錄立即保存',(await ST()).wordFav.includes('banana'));await pg.evaluate(()=>Object.defineProperty(document,'hidden',{value:false,configurable:true}));
// 3 many quick changes -> one write
const n=await pg.evaluate(async()=>{let c=0;const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='english5000v5')c++;return o.call(this,k,v)};for(let i=0;i<20;i++)toggleFav('w'+i);await new Promise(r=>setTimeout(r,500));Storage.prototype.setItem=o;return c});
ok('連續 20 次操作合併成 1 次存檔（不卡頓）',n===1,n+' 次');
// 4 import not overwritten by pending save
await pg.reload();await sleep(600);
const bk={app:'english-5000',schemaVersion:3,exportedAt:new Date().toISOString(),progress:{wordKnown:['zzz'],wordFav:[],fav:[],known:[],wordStatus:{},reviewDue:{},settings:{dailyGoal:20},wordKeyVersion:3}};fs.writeFileSync('/tmp/imp.json',JSON.stringify(bk));
await pg.evaluate(()=>{page('stats');renderBackup();toggleFav('pending-change')});await pg.setInputFiles('#bkImport','/tmp/imp.json');await pg.waitForLoadState('load');await sleep(1500);
const s=await ST();ok('匯入時尚未寫入的舊變更不會蓋掉匯入的紀錄',s.wordKnown.join()==='zzz'&&!s.wordFav.includes('pending-change'));
// 5 next sentence does not write
const w=await pg.evaluate(async()=>{let c=0;const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='english5000v5')c++;return o.call(this,k,v)};page('practice');document.querySelector('#play').click();document.querySelector('#showZh').click();await new Promise(r=>setTimeout(r,400));Storage.prototype.setItem=o;return c});
ok('只播放、看中文不會觸發存檔',w===0,w+' 次');
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_save.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
