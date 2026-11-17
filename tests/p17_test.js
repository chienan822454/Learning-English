// V5.26.0：商用英文（職場英文）、Email／會議片語 80 個、情境對話 +10 段、CE 情境題 +40 題
const {serve,launch,sleep,R,ok,fs,dataCounts}=require('./common');const srv=serve(()=>'site',8885);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);
await pg.goto('http://localhost:8885/');await sleep(1200);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
// 商用英文
const BZ=await E(()=>{const j=WORDS.filter(x=>x.k===8),bz=j.filter(x=>x.bsl);return {job:j.length,bz:bz.length,acr:j.filter(x=>x.acr&&!x.bsl&&!x.toeic).length,ok:bz.every(x=>x.job&&!x.toeic&&!x.b&&x.ex&&x.exz&&(x.t||[]).length),opt:$('#wordBook option[value="8"]').textContent,qopt:$('#quizBook option[value="8"]').textContent,has:['stakeholder','benchmark','milestone','procurement'].filter(w=>j.some(x=>x.w===w&&x.bsl)).length}});
ok('商用英文加入職場英文（多益 581＋商用 '+BZ.bz+'＋V5.32 常用縮寫 '+BZ.acr+'），都有例句與主題',BZ.bz>=140&&BZ.ok&&BZ.job===581+BZ.bz+BZ.acr&&BZ.has===4,JSON.stringify(BZ));
ok('職場英文標示「多益＋商用」（單字頁、測驗）',BZ.opt==='職場英文（多益＋商用，'+BZ.job+'）'&&BZ.qopt===BZ.opt,BZ.opt+' ／ '+BZ.qopt);
await pg.click('#navWords');await sleep(300);
await pg.click('#bookChips [data-b="8"]');await sleep(300);ok('單字頁「職場」：清單字數＝多益＋商用',await E(()=>+$('#wordCount').textContent===WORDS.filter(x=>x.k===8).length));
await pg.click('#bookChips [data-b="toeic"]');await sleep(300);ok('TOEIC 多益章節仍是 1247 字（商用字不算多益）',await E(()=>$('#wordCount').textContent)==='1247');
await pg.click('#bookChips [data-b="all"]');await sleep(200);
await pg.fill('#wordSearch','stakeholder');await pg.dispatchEvent('#wordSearch','input');await sleep(400);
ok('搜尋商用英文 stakeholder：找得到，標示「職場」',await E(()=>{const r=document.querySelector('#wordRows [data-w="stakeholder"]');return !!r&&r.querySelector('.word-rank').textContent==='職場'&&!!r.querySelector('.ex')}));
await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(200);
// Email／會議片語
const P=await E(()=>({n:PHRASES.length,mail:PHRASES.filter(p=>p.cat==='mail').length,inEx:PHRASES.filter(p=>p.cat==='mail').every(p=>p.ex.toLowerCase().includes(p.p.toLowerCase())),uniq:new Set(PHRASES.map(p=>p.p.toLowerCase())).size===PHRASES.length,ids:new Set(PHRASES.map(p=>p.id)).size===PHRASES.length}));
ok('片語新增「Email／會議」80 個（共 '+P.n+' 個），例句都含片語、不重複',P.mail===80&&P.n===310&&P.inEx&&P.uniq&&P.ids,JSON.stringify(P));
await pg.click('#navPhrases');await sleep(300);await pg.selectOption('#phCat','mail');await sleep(300);
const pp=await E(()=>({cnt:$('#phCount').textContent,total:$('#phTotal').textContent,rank:[...document.querySelectorAll('#phRows .word-rank')].slice(0,3).map(e=>e.textContent)}));
ok('片語頁選「Email／會議」：80 個、標示分類；標題顯示共 310 個',pp.cnt==='80'&&pp.total==='共 310 個'&&pp.rank.every(t=>t==='Email／會議'),JSON.stringify(pp));
await E(()=>{window.__said=[]});await pg.click('#phRows .word-card [data-a="ex"]');await sleep(100);
ok('Email／會議片語可以播放例句',await E(()=>window.__said.length===1&&PHRASES.some(p=>p.cat==='mail'&&p.ex===window.__said[0])));
await pg.selectOption('#phCat','all');
await pg.click('#navPractice');await sleep(200);await pg.selectOption('#unit','pmail');await sleep(300);
ok('句子頁「片語例句・Email／會議（80）」可以跟讀',/(^|\s)1 \/ 80$/.test((await pg.textContent('#progress')).trim())&&await E(()=>cur().src==='phrase'&&cur().cat==='mail'&&$('#unit option[value="pmail"]').textContent.includes('（80）')&&$('#phUnits').label==='片語例句（310）'),await pg.textContent('#progress'));
await pg.click('#navQuiz');await pg.selectOption('#quizType','phrase');await sleep(200);
ok('片語測驗包含 Email／會議片語',await E(()=>PHRASES.length===310));
// 情境對話
const DC=dataCounts();
await pg.click('#navDialogs');await sleep(300);
ok('情境對話 30 → 40 段（RMA 叫修、新人導覽、訪客參觀、電池更換、柴油補給、颱風、地震、停機維護、動火作業、侷限空間）',DC.dn>=40&&(await pg.$$('.dlg-card')).length===DC.dn&&await E(()=>DIALOGS.slice(30,40).every(d=>d.lines.length===12&&d.keys.length>=5&&d.keys.every(k=>d.lines.some(l=>l.en.includes(k.en))))),String(DC.dn));
await pg.click('.dlg-card[data-d="d39"]');await sleep(300);
ok('新對話可以打開（12 句）',await E(()=>document.querySelectorAll('#dialogBody .dlg-bub').length===12),await E(()=>document.querySelectorAll('#dialogBody .dlg-bub').length));
ok('新對話沒有現場拍照內容（除了「禁止拍照」的提醒）',await E(()=>DIALOGS.slice(30).every(d=>d.lines.every(l=>!/photo|picture|camera|video/i.test(l.en)||/no photo|not allowed|don't take|do not take|can't take|cannot take|no pictures/i.test(l.en)))));
await pg.click('#navPractice');await sleep(200);await pg.selectOption('#unit','dall');await sleep(300);
ok('句子頁「對話句・全部」含新對話（'+DC.dl+' 句）',new RegExp('/ '+DC.dl+'$').test((await pg.textContent('#progress')).trim())&&DC.dl>=480,await pg.textContent('#progress'));
// 情境題
const Q=await E(()=>{const n=SITQ.slice(80,120);return {n:SITQ.length,ids:n.map(q=>q.id).join(','),ans:[0,1,2,3].map(a=>n.filter(q=>q.ans===a).length),topics:[...new Set(n.map(q=>q.topic))]}});
ok('CE 情境題 80 → 120 題（新題答案位置平均）',Q.n>=120&&/^q81,.*q120$/.test(Q.ids)&&Q.ans.every(c=>c===10),JSON.stringify([Q.n,Q.ans,Q.topics]));
await pg.click('#navQuiz');await pg.selectOption('#quizType','situ');await sleep(200);
let seenNew=false;for(let k=0;k<60&&!seenNew;k++){await pg.click('#newQuiz');await sleep(30);seenNew=await E(()=>{const t=document.querySelector('#quizQ').textContent;return SITQ.slice(80).some(q=>t.includes(q.sit))})}
ok('情境題測驗會出到新題目',seenNew);
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p17.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
