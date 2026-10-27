const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8791);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
 /* 模擬 iPhone 連續辨識：未確認的結果會一直「長大」（接在同一段後面），確認後才開新的一段 */
 grow(t,fin){const last=this.results[this.results.length-1];if(last&&!last.isFinal){const nt=last[0].transcript+' '+t;this.results[this.results.length-1]=Object.assign([{transcript:nt}],{isFinal:fin})}else this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}
 confirm(){const last=this.results[this.results.length-1];if(last&&!last.isFinal){this.results[this.results.length-1]=Object.assign([{transcript:last[0].transcript}],{isFinal:true});this.onresult&&this.onresult({results:this.results.slice()})}}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__grow=(t,f)=>window.__sess.forEach(s=>s.running&&s.grow(t,f));window.__confirm=()=>window.__sess.forEach(s=>s.running&&s.confirm())});
await pg.goto('http://localhost:8791/');await sleep(700);await pg.click('#navPractice');
const S='good morning how are you today';
const idle=()=>pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent),null,{timeout:12000}).catch(()=>{});
const busy=()=>pg.evaluate(()=>/停止/.test(document.querySelector('#check').textContent));
const res=async()=>(await pg.textContent('#result')).replace(/\s+/g,' ');
// 1 interim growing: half -> keep listening; full -> instant
await pg.click('#check');await sleep(300);await pg.evaluate(()=>window.__grow('good morning how',false));await sleep(300);const b1=await busy();
const t0=Date.now();await pg.evaluate(()=>window.__grow('are you today',false));await idle();const dt=Date.now()-t0;const r1=await res();
ok('整句都聽到（手機尚未確認）就立刻評分；只聽到一半時繼續聽',b1&&/相似度 100%/.test(r1)&&dt<800,'一半時仍在聽='+b1+'｜整句後 '+dt+' ms 出結果');
// 2 next attempt appended into same still-growing result
await pg.click('#check');await sleep(300);await pg.evaluate(s=>window.__grow(s,false),S);await idle();const r2=await res();
ok('下一次的話被接在同一段未確認結果後面：仍正確擷取',/相似度 100%/.test(r2),r2.slice(r2.indexOf('辨識到'),r2.indexOf('辨識到')+45));
// 3 phone confirms between attempts, then new segment
await pg.evaluate(()=>window.__confirm());await sleep(200);
const rr=[];for(let n=0;n<3;n++){await pg.click('#check');await sleep(300);await pg.evaluate(([s,f])=>window.__grow(s,f),[S,n%2===0]);await idle();rr.push(/相似度 100%/.test(await res()));if(n%2===1){await pg.evaluate(()=>window.__confirm());await sleep(100)}}
ok('確認／未確認交錯：連續 3 次都正確',rr.every(Boolean),rr.map(x=>x?'✓':'✗').join(''));
// 4 half then stop
await pg.click('#check');await sleep(300);await pg.evaluate(()=>window.__grow('good morning',false));await sleep(200);await pg.click('#check');await idle();const r4=await res();
ok('只念一半就按停止：用已聽到的內容評分',/相似度/.test(r4)&&!/相似度 100%/.test(r4),r4.slice(r4.indexOf('相似度'),r4.indexOf('相似度')+8));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_fast.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
