const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8868);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,permissions:['microphone']});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];const V=[{name:'Samantha',lang:'en-US',voiceURI:'sam',default:true,localService:true},{name:'Alex',lang:'en-US',voiceURI:'alex',default:false,localService:true}];speechSynthesis.getVoices=()=>V;window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};let sp=false;Object.defineProperty(speechSynthesis,'speaking',{get:()=>sp});speechSynthesis.speak=u=>{sp=true;window.__said.push({t:u.text,v:u.voice&&u.voice.name,r:u.rate});setTimeout(()=>{sp=false;u.onend&&u.onend()},60)};speechSynthesis.cancel=()=>{sp=false};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
 say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f))});
await pg.goto('http://localhost:8868/');await sleep(900);
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await pg.evaluate(()=>APP_VERSION))===process.env.VER);
// ---- 1. 🎤 評分：數字、時間、縮寫、連字號 ----
const lineOf=async re=>pg.evaluate(src=>{const r=new RegExp(src);for(const d of DIALOGS)for(let n=0;n<d.lines.length;n++)if(r.test(d.lines[n].en))return {id:d.id,n,en:d.lines[n].en};return null},re);
const go=async L=>{await pg.evaluate(L=>{page('practice');const u=document.querySelector('#unit');u.value=L.id;u.onchange();i=pool.findIndex(s=>s.id==='d:'+L.id+':'+L.n);render()},L);await sleep(150)};
const speakScore=async(t,fin=true)=>{await pg.click('#check');await sleep(150);await pg.evaluate(([t,f])=>window.__speak(t,f),[t,fin]);await sleep(350);const r=await pg.textContent('#result');return {s:(/相似度 (\d+)%/.exec(r)||[])[1],miss:await pg.$$eval('#result .sw-miss',e=>e.map(x=>x.textContent))}};
const cases=[['52-3\\. It feeds UPS-2A','feeder breaker fifty two three it feeds ups 2 a input'],['2:15 a\\.m\\.',null],["What's",null],['CHWP-02',null],['10 a\\.m\\.',null]];
const spoken=en=>en.toLowerCase().replace(/what's/g,'what is').replace(/let's/g,'let us').replace(/i'm/g,'i am').replace(/2:15/g,'two fifteen').replace(/10 a\.m\./g,'ten am').replace(/a\.m\./g,'am').replace(/chwp-02/g,'chwp zero two').replace(/-/g,' ').replace(/[^a-z0-9' ]/g,' ');
for(const [re,heard] of cases){const L=await lineOf(re);if(!L){ok('找得到測試句 '+re,false);continue}await go(L);const h=heard||spoken(L.en);const r=await speakScore(h);
 ok(`🎤 念法不同也算對：「${L.en}」← 「${h.trim().replace(/\s+/g,' ')}」`,r.s==='100'&&r.miss.length===0,'相似度 '+r.s+'% 漏：'+r.miss.join(','))}
{const L=await lineOf('UPS-2A');await go(L);const r=await speakScore('feeder breaker');ok('漏念的字仍會標紅、分數降低',+r.s<50&&r.miss.length>=3,r.s+'% '+r.miss.join(','))}
{const L=await lineOf('2:15 a\\.m\\.');await go(L);await pg.click('#check');await sleep(150);await pg.evaluate(t=>window.__speak(t,false),spoken(L.en));await sleep(350);ok('整句（含數字）都聽到就立刻評分',/相似度 100%/.test(await pg.textContent('#result')))}
{await pg.evaluate(()=>{const u=document.querySelector('#unit');u.value='all';u.onchange();i=0;render()});await sleep(100);const r=await speakScore('good morning how are you today');ok('一般句子評分不受影響',r.s==='100',r.s)}
// ---- 2. Role Play：按鈕在同一畫面 ----
await pg.click('#navDialogs');await sleep(150);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');
let worst=0,wid='';for(const id of await pg.evaluate(()=>DIALOGS.map(d=>d.id))){await pg.evaluate(id=>rpStart(DLG_BY[id],'B',3,{},true),id);await sleep(60);const y=await pg.evaluate(()=>{window.scrollTo(0,0);const r=document.querySelector('#check').getBoundingClientRect();return r.bottom});if(y>worst){worst=y;wid=id}}
ok('全部情境的 Role Play：🎤 按鈕都在第一個畫面內（不用往下捲）',worst<=844-60,'最低位置 '+Math.round(worst)+'px（'+wid+'）');
await pg.screenshot({path:'/tmp/t5/p7_rp.png'});
// ---- 2b. 連續模式 ----
const D=await pg.evaluate(()=>DLG_BY.d14);
await pg.evaluate(()=>rpOff());await pg.evaluate(()=>{page('dialogs');DLG.cur=DLG_BY.d14;renderDialog(DLG.cur)});await sleep(100);await pg.click('#dlgRpB');await sleep(500);
await pg.check('#rpAuto');ok('連續模式設定會保存',await pg.evaluate(()=>store.settings.rpAuto===true));
await pg.click('#check');await sleep(150);await pg.evaluate(t=>window.__speak(t),D.lines[1].en.toLowerCase());await sleep(300);
ok('連續模式：念到 80% 以上顯示即將自動下一句',/自動下一句/.test(await pg.textContent('#result')));
await sleep(1500+600);let n=await pg.evaluate(()=>RP.n);ok('1.5 秒後自動下一句並念出對方台詞',n===3&&(await pg.evaluate(()=>window.__said.map(x=>x.t))).includes(D.lines[2].en),'RP.n='+n);
await sleep(1300);ok('對方說完自動開始聆聽（不用按 🎤）',/停止聆聽/.test(await pg.textContent('#check')));
await pg.evaluate(t=>window.__speak(t),'something else entirely');await sleep(2200);
ok('念得不好（低於 80%）不會自動跳下一句',await pg.evaluate(()=>RP.n)===3);
await pg.click('#check');await sleep(150);await pg.evaluate(t=>window.__speak(t),spoken(D.lines[3].en));await sleep(2000);
ok('重念到 80% 以上就自動下一句',await pg.evaluate(()=>RP.n)===5);
await pg.uncheck('#rpAuto');await sleep(1500);ok('關閉連續模式後不會自動聆聽',!/停止聆聽/.test(await pg.textContent('#check')));
await pg.click('#rpEnd');await sleep(200);
ok('結束 Role Play 後 🎤／🎙 回到句子頁原位',await pg.evaluate(()=>!!document.querySelector('.panel #check')&&!!document.querySelector('.panel #record')&&!!document.querySelector('.panel #recMsg')&&!!document.querySelector('.panel #result')));
// ---- 4. 新測驗答錯 → 複習 ----
await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','lisen');await sleep(150);
const wrongPick=async()=>pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;const s=ALLS.find(x=>x.en===t);const b=[...document.querySelectorAll('#quizOpts button')].find(b=>b.textContent!==s.zh);b.click();return s.id});
await pg.evaluate(()=>window.__said=[]);await pg.click('#newQuiz');await sleep(150);
let id1=await wrongPick();await sleep(200);
ok('聽力題答錯：加入「測驗答錯的句子」',await pg.evaluate(id=>store.lsWrong&&store.lsWrong[id]===1,id1)&&/測驗答錯的句子/.test(await pg.textContent('#quizMsg')));
// 標過會說的句子 → 排入今天複習
await pg.evaluate(()=>{const s=ALLS.find(x=>x.src==='core');store.known.push(s.id);save();window.__known=s.id;document.querySelector('#quizSRange').value='cd'});
let tries=0,id2=null;while(tries<200){await pg.evaluate(()=>window.__said=[]);await pg.click('#newQuiz');await sleep(30);const t=await pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;return ALLS.find(x=>x.en===t).id});if(t===await pg.evaluate(()=>window.__known)){id2=await wrongPick();break}tries++}
if(!id2){await pg.evaluate(()=>{qWrongMark(window.__known,false)});id2=await pg.evaluate(()=>window.__known)}
await sleep(200);ok('標過「會說」的句子答錯：排入今天的 🔁 待複習',await pg.evaluate(id=>isSDue(id)&&store.lsWrong[id]>=1,id2));
await pg.selectOption('#quizSRange','wrong');await sleep(150);
const qs=new Set();for(let k=0;k<8;k++){await pg.evaluate(()=>window.__said=[]);await pg.click('#newQuiz');await sleep(40);qs.add(await pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;return ALLS.find(x=>x.en===t).id}))}
ok('「📕 只練答錯的句子」只出答錯的題目',[...qs].every(x=>x===id1||x===id2),[...qs].join(','));
ok('只練答錯時選項仍有 4 個',(await pg.$$('#quizOpts button')).length===4);
// 答對移除
for(let k=0;k<6;k++){const left=await pg.evaluate(()=>Object.keys(store.lsWrong).length);if(!left)break;await pg.evaluate(()=>window.__said=[]);await pg.click('#newQuiz');await sleep(40);if(/沒有答錯/.test(await pg.textContent('#quizQ')))break;await pg.evaluate(()=>{const t=window.__said[window.__said.length-1].t;const s=ALLS.find(x=>x.en===t);[...document.querySelectorAll('#quizOpts button')].find(b=>b.textContent===s.zh).click()});await sleep(60)}
ok('答對後從答錯清單移除，清空後顯示「沒有答錯的句子」',await pg.evaluate(()=>Object.keys(store.lsWrong).length)===0&&(await pg.click('#newQuiz'),await sleep(80),/沒有答錯的句子/.test(await pg.textContent('#quizQ'))));
// 看中文聽選英文答錯
await pg.selectOption('#quizSRange','cd');await pg.selectOption('#quizType','liszh');await sleep(150);
const id3=await pg.evaluate(()=>{const zh=document.querySelector('.lz-zh').textContent;const ens=[...document.querySelectorAll('.lz-en')].map(e=>e.textContent);const k=ens.findIndex(e=>!ALLS.some(x=>x.en===e&&x.zh===zh));document.querySelector(`.lz-pick[data-k="${k}"]`).click();const ok=ens.find(e=>ALLS.some(x=>x.en===e&&x.zh===zh));return ALLS.find(x=>x.en===ok&&x.zh===zh).id});await sleep(150);
ok('看中文聽選英文答錯也加入答錯清單',await pg.evaluate(id=>!!store.lsWrong[id],id3));
// 對話填空
await pg.selectOption('#quizType','dcloze');await sleep(150);ok('對話填空有「只練答錯的對話句」選單',!(await pg.evaluate(()=>document.querySelector('#quizDcOpts').hidden)));
const DCHIT="(()=>{const q=document.querySelector('.dc-q');if(!q)return null;const t=q.textContent.replace(/^[AB]\\s*/,'');const p=t.split('_____');const c=[];DIALOGS.forEach(d=>d.lines.forEach((l,n)=>{if(!l.en.startsWith(p[0]))return;const rest=l.en.slice(p[0].length);for(let j=1;j<=rest.length;j++){const a=rest.slice(0,j);if(p.join(a)===l.en){c.push({id:'d:'+d.id+':'+n,ans:a});break}}}));const o=[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent.toLowerCase());const m=c.filter(x=>o.includes(x.ans.toLowerCase()));return m[0]||c[0]||null})()";
const id4=await pg.evaluate(DCHIT+";(()=>{const h="+DCHIT+";[...document.querySelectorAll('#quizOpts button')].find(b=>b.textContent.toLowerCase()!==h.ans.toLowerCase()).click();return h.id})()");await sleep(150);
ok('對話填空答錯加入答錯清單',await pg.evaluate(id=>!!store.lsWrong[id],id4));
await pg.selectOption('#quizDcRange','wrong');await sleep(150);
const dcIds=new Set();for(let k=0;k<6;k++){await pg.click('#newQuiz');await sleep(40);dcIds.add(await pg.evaluate("("+DCHIT+"||{}).id"))}
const wl=await pg.evaluate(()=>Object.keys(store.lsWrong).filter(k=>k.startsWith('d:')));
ok('「只練答錯的對話句」只出答錯的對話句',[...dcIds].every(x=>wl.includes(x)),[...dcIds].join(','));
await pg.selectOption('#quizType','word');await sleep(100);ok('切到單字測驗時隱藏對話填空選單',await pg.evaluate(()=>document.querySelector('#quizDcOpts').hidden&&document.querySelector('#quizSOpts').hidden));
// 句子頁單元
await pg.click('#navPractice');await sleep(100);await pg.selectOption('#unit','lsw');await sleep(200);
const prog=await pg.textContent('#progress');const n2=await pg.evaluate(()=>Object.keys(store.lsWrong).length);
ok('句子頁「📕 測驗答錯的句子」可跟讀練習',new RegExp('/ '+n2+'$').test(prog.trim())&&await pg.evaluate(()=>!!store.lsWrong[cur().id]),prog+'（清單 '+n2+' 句）');
// 備份
ok('備份包含答錯清單',await pg.evaluate(()=>{const o=JSON.parse(localStorage.getItem('english5000v5'));return !!o.lsWrong&&Object.keys(o.lsWrong).length>0}));
// ---- 3. 情境題選項長度 ----
const bal=await pg.evaluate(()=>{let longest=0,shortest=0,bad=0;SITQ.forEach(q=>{const L=q.opts.map(o=>o.length),c=L[q.ans],o=L.filter((_,k)=>k!==q.ans);if(c>Math.max(...o))longest++;if(c<Math.min(...o))shortest++;const avg=o.reduce((a,b)=>a+b,0)/3;if(Math.abs(c-avg)/avg>.25)bad++});return {longest,shortest,bad,n:SITQ.length}});
ok('情境題：正確答案不常是最長的選項（'+bal.n+' 題中 ≤'+Math.floor(bal.n/4)+' 題）',bal.n>=80&&bal.longest<=bal.n/4&&bal.shortest>=Math.ceil(bal.n*0.175)&&bal.bad===0,JSON.stringify(bal));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p7.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
