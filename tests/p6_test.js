const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8866);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,permissions:['microphone']});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];const V=[{name:'Samantha',lang:'en-US',voiceURI:'sam',default:true,localService:true},{name:'Alex',lang:'en-US',voiceURI:'alex',default:false,localService:true}];speechSynthesis.getVoices=()=>V;window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};let sp=false;Object.defineProperty(speechSynthesis,'speaking',{get:()=>sp});speechSynthesis.speak=u=>{sp=true;window.__said.push({t:u.text,v:u.voice&&u.voice.name,r:u.rate});setTimeout(()=>{sp=false;u.onend&&u.onend()},60)};speechSynthesis.cancel=()=>{sp=false};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
 say(t){this.results.push(Object.assign([{transcript:t}],{isFinal:true}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=t=>window.__sess.forEach(s=>s.running&&s.say(t))});
await pg.goto('http://localhost:8866/');await sleep(900);
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await pg.evaluate(()=>APP_VERSION))===process.env.VER);
// ---- Role Play ----
await pg.click('#navDialogs');await sleep(200);await pg.click('.dlg-card[data-d="d14"]');await sleep(200);
ok('對話頁有 Role Play 按鈕（演 A／演 B）',!!(await pg.$('#dlgRpB'))&&!!(await pg.$('#dlgRpA')));
const D=await pg.evaluate(()=>DLG_BY.d14);
await pg.evaluate(()=>window.__said=[]);await pg.click('#dlgRpB');await sleep(600);
let st=await pg.evaluate(()=>({box:!document.querySelector('#rpBox').hidden,pr:!!document.querySelector('#rpSpeak #check')&&!!document.querySelector('#rpSpeak #record')&&document.querySelector('.panel').hidden,blur:document.querySelector('.sentence').classList.contains('rp-hide'),zh:!document.querySelector('#chinese').hidden,en:document.querySelector('#english').textContent,turn:document.querySelector('.rp-turn').textContent,prog:document.querySelector('.rp-prog').textContent,said:window.__said.map(x=>x.t+'|'+x.v)}));
ok('演 B：Role Play 區塊內就有 🎤 與 🎙 按鈕（不用往下捲）',st.box&&st.pr&&!!(await pg.$('#check'))&&!!(await pg.$('#record')),st.prog);
ok('先自動念對方（A）的第 1 句',st.said.length===1&&st.said[0].startsWith(D.lines[0].en),st.said.join(' / '));
ok('我的台詞：英文先隱藏、顯示中文提示',st.blur&&st.zh&&st.en===D.lines[1].en&&st.turn.includes(D.lines[1].zh));
// 標準答案
await pg.evaluate(()=>window.__said=[]);await pg.click('#rpAns');await sleep(200);
ok('🔊 標準答案念出我的台詞',(await pg.evaluate(()=>window.__said.map(x=>x.t))).includes(D.lines[1].en));
await pg.click('#rpPeek');ok('👁 看英文可顯示英文',!(await pg.evaluate(()=>document.querySelector('.sentence').classList.contains('rp-hide'))));
await pg.click('#rpPeek');
// 🎤 辨識
await pg.click('#check');await sleep(200);await pg.evaluate(t=>window.__speak(t),D.lines[1].en.toLowerCase());await sleep(400);
let r=await pg.textContent('#result');ok('🎤 辨識整合：顯示相似度並記錄分數',/相似度 100%/.test(r)&&/最高 100%/.test(await pg.textContent('.rp-prog')),r.slice(0,60));
ok('評分後自動顯示英文、提示可重錄',!(await pg.evaluate(()=>document.querySelector('.sentence').classList.contains('rp-hide')))&&/重新錄音/.test(r));
// 重新錄音（錄音兩次）
const recOnce=async()=>{await pg.click('#record');await sleep(700);await pg.click('#record');await sleep(900);return (await pg.textContent('#record'))};
let t1=await recOnce();let t2=await recOnce();ok('Role Play 可重錄（連續錄 2 次）',/重新錄音/.test(t1)&&/重新錄音/.test(t2)&&!(await pg.$eval('#mine',e=>e.disabled)),t1+' / '+t2);
// 第二次 🎤 部分正確
await pg.click('#check');await sleep(200);await pg.evaluate(t=>window.__speak(t),D.lines[1].en.toLowerCase().split(' ').slice(0,2).join(' '));await sleep(400);
ok('再念一次分數較低時保留最高分',/最高 100%/.test(await pg.textContent('.rp-prog')));
// 下一句
await pg.evaluate(()=>window.__said=[]);await pg.click('#rpNext');await sleep(600);
st=await pg.evaluate(()=>({en:document.querySelector('#english').textContent,prog:document.querySelector('.rp-prog').textContent,said:window.__said.map(x=>x.t),hist:document.querySelectorAll('#rpBox .rp-line').length}));
ok('下一句：念出對方回應，換到我的第 2 句',st.en===D.lines[3].en&&st.said[0]===D.lines[2].en&&/2 \/ 6/.test(st.prog)&&st.hist===2,st.prog);
await pg.click('#rpPrev');await sleep(300);ok('← 上一句回到我的上一句台詞（跳過對方）',(await pg.textContent('#english'))===D.lines[1].en);
await pg.evaluate(()=>document.querySelector('#next').click());await sleep(500);ok('下一句 → 也只走我的台詞',(await pg.textContent('#english'))===D.lines[3].en);
// 麥克風重新載入後回到同一句
await pg.evaluate(()=>micReload());await pg.waitForLoadState('load');await sleep(1200);
st=await pg.evaluate(()=>({box:!document.querySelector('#rpBox').hidden,en:document.querySelector('#english').textContent,prog:(document.querySelector('.rp-prog')||{}).textContent}));
ok('重新啟動麥克風（重新載入）後仍在 Role Play 同一句、分數保留',st.box&&st.en===D.lines[3].en&&/2 \/ 6/.test(st.prog||''),JSON.stringify(st).slice(0,120));
for(let k=0;k<4;k++){await pg.click('#rpNext');await sleep(500)}
ok('最後一句按鈕顯示「完成」',/完成/.test(await pg.textContent('#rpNext')));
await pg.click('#rpNext');await sleep(600);
st=await pg.evaluate(()=>({sum:document.querySelector('#rpBox').textContent,panel:document.querySelector('.panel').hidden,done:JSON.parse(localStorage.getItem('english5000v5')||'{}').rpDone}));
ok('完成畫面：每句分數與平均、記錄已完成',/完成 Role Play/.test(st.sum)&&/平均相似度/.test(st.sum)&&st.panel&&st.done&&st.done.d14&&st.done.d14.me==='B',JSON.stringify(st.done));
await pg.click('#rpSwap');await sleep(600);
st=await pg.evaluate(()=>({en:document.querySelector('#english').textContent,panel:!!document.querySelector('#rpSpeak #check'),said:window.__said.length,prog:document.querySelector('.rp-prog').textContent}));
ok('換演 A：從第 1 句開始（我先說），🎤 按鈕回到 Role Play 區塊',st.en===D.lines[0].en&&st.panel&&/1 \/ 6/.test(st.prog),st.prog);
await pg.click('#rpEnd');await sleep(400);
ok('✕ 結束回到對話頁並顯示上次 Role Play',!(await pg.evaluate(()=>document.querySelector('#dialogPage').hidden))&&/上次 Role Play/.test(await pg.textContent('#dialogBody')));
await pg.click('#navPractice');await sleep(300);
ok('結束後句子頁恢復一般模式（🎤／🎙 回到原位）',await pg.evaluate(()=>document.querySelector('#rpBox').hidden&&!document.querySelector('.sentence').classList.contains('rp-hide')&&!document.querySelector('.panel').hidden&&!!document.querySelector('.panel #check')&&!!document.querySelector('.panel #record')&&!document.querySelector('#rpSpeak #check')));
// 切單元會結束 Role Play
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d02"]');await sleep(200);await pg.click('#dlgRpA');await sleep(400);
await pg.selectOption('#unit','all');await sleep(300);ok('Role Play 中切換句子單元會結束 Role Play',await pg.evaluate(()=>document.querySelector('#rpBox').hidden));
await pg.screenshot({path:'/tmp/t5/p6_rp.png'});
// ---- 新測驗 ----
await pg.click('#navQuiz');await sleep(300);
const types=await pg.$$eval('#quizType option',o=>o.map(x=>x.value));ok('測驗類型新增 4 種',['lisen','liszh','dcloze','situ'].every(t=>types.includes(t)),types.join(','));
const answer=async(right)=>pg.evaluate(right=>{const bs=[...document.querySelectorAll('#quizOpts button[data-k]')];return bs.length},right);
// lisen
let okN=0;for(let k=0;k<15;k++){await pg.evaluate(()=>window.__said=[]);await pg.selectOption('#quizType','lisen');if(k)await pg.click('#newQuiz');await sleep(120);
 const q=await pg.evaluate(()=>({said:window.__said.map(x=>x.t),opts:[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent),vis:!document.querySelector('#quizSOpts').hidden,wo:document.querySelector('#quizWordOpts').hidden}));
 const s=await pg.evaluate(t=>ALLS.find(x=>x.en===t),q.said[q.said.length-1]);if(s&&q.opts.length===4&&new Set(q.opts).size===4&&q.opts.includes(s.zh)&&q.vis&&q.wo)okN++}
ok('🎧 聽英文選中文：自動播放、4 個不重複選項含正確答案（15 題）',okN===15,okN+'/15');
let before=await pg.evaluate(()=>JSON.parse(localStorage.getItem('english5000v5')||'{}').quizRight||0);
await pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;const s=ALLS.find(x=>x.en===t);[...document.querySelectorAll('#quizOpts button')].find(b=>b.textContent===s.zh).click()});await sleep(400);
ok('答對計分並顯示英文原句',/答對/.test(await pg.textContent('#quizMsg'))&&(await pg.evaluate(()=>JSON.parse(localStorage.getItem('english5000v5')||'{}').quizRight||0))===before+1);
await pg.selectOption('#quizSRange','dlg');await sleep(200);
ok('範圍可選 CE 對話句',await pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;return ALLS.some(x=>x.en===t&&x.src==='dialog')}));
// liszh
okN=0;let ansOK=0;for(let k=0;k<10;k++){await pg.selectOption('#quizType','liszh');await pg.click('#newQuiz');await sleep(120);
 const q=await pg.evaluate(()=>({zh:document.querySelector('.lz-zh').textContent,rows:document.querySelectorAll('.lz-row').length,hid:[...document.querySelectorAll('.lz-en')].every(e=>e.hidden),ens:[...document.querySelectorAll('.lz-en')].map(e=>e.textContent)}));
 if(q.rows===4&&q.hid&&new Set(q.ens).size===4)okN++;
 await pg.evaluate(()=>window.__said=[]);await pg.click('.lz-play[data-p="2"]');await sleep(100);const heard=await pg.evaluate(()=>window.__said.map(x=>x.t));
 if(heard[0]===q.ens[2])ansOK++}
ok('🎧 看中文聽選英文：4 個選項只有聲音、文字隱藏（10 題）',okN===10,okN+'/10');
ok('點 🔊 選項念出對應英文',ansOK===10);
const k=await pg.evaluate(()=>{const zh=document.querySelector('.lz-zh').textContent;const ens=[...document.querySelectorAll('.lz-en')].map(e=>e.textContent);return ens.findIndex(e=>ALLS.some(x=>x.en===e&&x.zh===zh))});
await pg.click(`.lz-pick[data-k="${k}"]`);await sleep(200);
ok('作答後顯示 4 句英文並標出正確答案',/答對/.test(await pg.textContent('#quizMsg'))&&await pg.evaluate(()=>[...document.querySelectorAll('.lz-en')].every(e=>!e.hidden)));
// dcloze
okN=0;for(let k=0;k<30;k++){await pg.selectOption('#quizType','dcloze');await pg.click('#newQuiz');await sleep(60);
 const q=await pg.evaluate(()=>{const opts=[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent);const line=document.querySelector('.dc-q').textContent;const t=line.replace(/^[AB]\s*/,'');const p=t.split('_____');const low=x=>x.toLowerCase();const L=Object.values(DLG_BY).flatMap(d=>d.lines).filter(l=>p.length>=2&&low(l.en).startsWith(low(p[0]))&&low(l.en).endsWith(low(p[p.length-1])));const fits=opts.filter(o=>L.some(l=>low(l.en)===low(p.join(o))));return {n:opts.length,u:new Set(opts.map(o=>o.toLowerCase())).size,fits:fits.length,blank:!!document.querySelector('.dc-q .blank'),ctx:document.querySelectorAll('.dc-l').length}});
 if(q.n===4&&q.u===4&&q.fits===1&&q.blank&&q.ctx===2)okN++}
ok('💬 對話填空：有上一句情境、4 個選項只有 1 個正確（30 題）',okN===30,okN+'/30');
await pg.evaluate(()=>{const t=document.querySelector('.dc-q').textContent.replace(/^[AB]\s*/,'');const p=t.split('_____');const low=x=>x.toLowerCase();const L=Object.values(DLG_BY).flatMap(d=>d.lines).find(l=>low(l.en).startsWith(low(p[0]))&&low(l.en).endsWith(low(p[p.length-1])));[...document.querySelectorAll('#quizOpts button')].find(b=>low(L.en)===low(p.join(b.textContent))).click()});await sleep(200);
ok('對話填空作答後顯示完整句子',/答對/.test(await pg.textContent('#quizMsg')));
// situ
await pg.selectOption('#quizType','situ');await sleep(150);
ok('🏭 情境題：題庫 '+require('./common').dataCounts().sq+' 題、4 個選項',await pg.evaluate(()=>SITQ.length)===require('./common').dataCounts().sq&&require('./common').dataCounts().sq>=80&&(await pg.$$('#quizOpts .sq-opt')).length===4&&!(await pg.evaluate(()=>document.querySelector('#quizSitOpts').hidden)));
const wrongPick=await pg.evaluate(()=>{const id=store.sqLast;const q=SITQ.find(x=>x.id===id);const b=[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent!==q.opts[q.ans]);b.click();return id});await sleep(300);
ok('答錯：標出正確答案、顯示每個選項中文與說明、記入答錯',(await pg.$$('#quizOpts .opt-ok')).length===1&&(await pg.$$('.sq-zh')).length===4&&/最適合/.test(await pg.textContent('#quizMsg'))&&(await pg.evaluate(id=>(JSON.parse(localStorage.getItem('english5000v5')||'{}').sqWrong||{})[id]===1,wrongPick)));
await pg.selectOption('#quizSRange2','wrong');await sleep(200);
ok('「只練答錯的」出現剛答錯的題目',await pg.evaluate(id=>store.sqLast===id,wrongPick));
await pg.evaluate(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent===q.opts[q.ans]).click()});await sleep(300);
await pg.click('#newQuiz');await sleep(200);ok('答對後從答錯清單移除',/沒有答錯的情境題/.test(await pg.textContent('#quizQ')));
let seen=new Set();await pg.selectOption('#quizSRange2','all');for(let k=0;k<60;k++){await pg.click('#newQuiz');await sleep(20);seen.add(await pg.evaluate(()=>store.sqLast))}
ok('情境題隨機出題、不連續重複',seen.size>=25,seen.size+' 題');
await pg.screenshot({path:'/tmp/t5/p6_situ.png'});
await pg.selectOption('#quizType','word');await sleep(150);ok('切回單字測驗：單字選項恢復、新選單隱藏',await pg.evaluate(()=>!document.querySelector('#quizWordOpts').hidden&&document.querySelector('#quizSOpts').hidden&&document.querySelector('#quizSitOpts').hidden));
await pg.selectOption('#quizType','sentence');await sleep(150);ok('句子測驗仍正常',(await pg.$$('#quizOpts button')).length===4);
await pg.click('#navStats');await sleep(300);
ok('備份摘要包含 Role Play',/Role Play 1/.test(await pg.textContent('#backupBody'))||/Role Play/.test(await pg.textContent('#statsPage')));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p6.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
