// V5.25.0：主題分類補齊（19 類，所有單字都有主題、詞形跟著原形）、CE 專業字擴充
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8884);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();require('./common').wfAuto(pg);const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);
await pg.goto('http://localhost:8884/');await sleep(1200);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
// 主題
const T=await E(()=>{const base=WORDS.filter(x=>!x.b&&x.k<=5);return {codes:Object.keys(TOPICS),base:base.length,tagged:base.filter(x=>(x.t||[]).length).length,all:WORDS.filter(x=>(x.t||[]).length).length,n:WORDS.length,formsInherit:WORDS.filter(x=>x.b).every(x=>JSON.stringify(x.t||[])===JSON.stringify((BY_WORD[x.b]||{}).t||[])),basicAlone:WORDS.every(x=>!(x.t||[]).includes('basic')||x.t.length===1),opts:[...document.querySelectorAll('#wordTopic option')].length,max:Math.max(...WORDS.map(x=>(x.t||[]).length))}});
ok('主題 10 → 19 類（新增電腦與網路、商業與金錢、數字與數量、地點與方向、飲食、天氣與自然、學習與語言、社會與公共事務、基本用字）',T.codes.length===19&&['it','biz','num','place','food','nature','learn','society','basic'].every(c=>T.codes.includes(c))&&T.opts===20,JSON.stringify(T.codes));
ok('所有單字都有主題（5000 原形 902 → 5000；CE、職場英文、詞形也都有）',T.tagged===T.base&&T.all===T.n&&T.max<=3,JSON.stringify([T.tagged,T.base,T.all,T.n]));
ok('詞形的主題跟著原形；「基本用字」不和其他主題混用',T.formsInherit&&T.basicAlone);
await pg.click('#navWords');await sleep(300);
for(const [code,w] of [['food','onion'],['basic','the'],['it','password'],['el','electricity'],['nature','rain'],['biz','money']]){await pg.selectOption('#wordTopic',code);await sleep(250);
 const r=await E(([c,w])=>({cnt:+$('#wordCount').textContent,label:$('#wordTopic option[value="'+c+'"]').textContent,has:WORDS.filter(x=>(x.t||[]).includes(c)&&inBook(x,$('#wordBook').value)&&!(skipV()&&x.b&&x.k!==7)).some(x=>x.w===w)}),[code,w]);
 ok(`主題「${r.label.replace(/（.*/,'')}」：清單字數和選單數字一致，含 ${w}`,r.cnt>0&&r.label.includes('（'+r.cnt+'）')&&r.has,JSON.stringify(r))}
await pg.click('#bookChips [data-b="1"]');await sleep(250);await pg.selectOption('#wordTopic','food');await sleep(250);
const f1=await E(()=>({cnt:+$('#wordCount').textContent,label:$('#wordTopic option[value="food"]').textContent}));
await pg.click('#dailyStart');await sleep(300);
const dn=await E(()=>({n:cardPool.length,ok:cardPool.every(x=>(x.t||[]).includes('food')&&x.k===1&&!x.b)}));
ok('第 1 冊＋飲食：數字一致；今日新字只出第 1 冊的飲食新字',f1.cnt>0&&f1.label.includes('（'+f1.cnt+'）')&&dn.n>0&&dn.ok,JSON.stringify([f1,dn]));
await E(()=>renderWords());await pg.selectOption('#wordTopic','all');await sleep(200);await pg.click('#bookChips [data-b="all"]');await sleep(200);
// CE 專業字
const C=await E(()=>{const ce=WORDS.filter(x=>x.k===7);const by=w=>WORDS.find(x=>x.w===w);return {n:ce.length,acr:ce.filter(x=>x.acr).length,acrOk:ce.filter(x=>x.acr).every(x=>x.pos==='abbr.'&&/（[A-Za-z]/.test(x.zh)),has:['STS','RPP','PUE','EPO','VESDA','arc flash','raised floor','cooling tower','hot work','confined space','fire watch','thermal runaway'].filter(w=>{const x=by(w);return x&&x.k===7&&x.ce&&x.ex&&x.exz&&(x.t||[]).length}),noFOC:(!by('FOC')||by('FOC').zh.includes('Facility Operations Center'))&&(!by('DSP')||by('DSP').zh.includes('Drill Scenario Procedure')),photo:ce.filter(x=>/photo|picture|camera|video/i.test(x.ex||'')).map(x=>x.w)}});
ok('CE 專業字擴充（131 → '+C.n+'）：STS、RPP、PUE、EPO、VESDA、arc flash、raised floor、cooling tower、hot work、confined space、fire watch、thermal runaway…',C.n>=220&&C.has.length===12&&C.noFOC&&C.photo.length===0,JSON.stringify(C));
ok('CE 縮寫都標示 abbr. 與英文全名（27 → '+C.acr+'）',C.acr>27&&C.acrOk,String(C.acr));
await pg.click('#bookChips [data-b="7"]');await sleep(300);ok('單字頁 CE：清單字數依字庫',await E(()=>+$('#wordCount').textContent===WORDS.filter(x=>x.k===7&&!(skipV()&&x.b&&x.k!==7)).length));
await pg.fill('#wordSearch','sts');await pg.dispatchEvent('#wordSearch','input');await sleep(400);
ok('搜尋 STS：找得到，有中文與例句',await E(()=>{const r=document.querySelector('#wordRows [data-w="STS"]');return !!r&&/靜態轉換開關/.test(r.textContent)&&!!r.querySelector('.ex')}));
await E(()=>{window.__said=[]});await pg.click('#wordRows [data-w="STS"] [data-act="ex"]');await sleep(100);
ok('CE 新字的例句可以播放',await E(()=>window.__said[0]===BY_WORD.STS.ex));
await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(200);await pg.click('#bookChips [data-b="all"]');await sleep(200);
await pg.click('#navPractice');await pg.selectOption('#unit','w7');await sleep(300);
ok('句子頁「CE 專業字例句」包含新字',await E(()=>pool.length===WORDS.filter(x=>x.k===7).length&&pool.some(s=>s.keys[0]==='VESDA')));
await pg.click('#navQuiz');await pg.selectOption('#quizType','word');await pg.selectOption('#quizBook','7');await sleep(200);
ok('單字測驗「CE 專業字與縮寫」包含新字',await E(()=>quizPool().length===WORDS.filter(x=>x.k===7&&x.zh&&!(skipV()&&x.b&&x.k!==7)).length&&quizPool().some(x=>x.w==='PUE')));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p16.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
