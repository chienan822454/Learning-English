const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8776);
(async()=>{const b=await launch();
async function setup(opts){const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(o=>{window.__sess=[];
  class FakeSR{constructor(){this.no=window.__sess.length;this.deaf=(o.onlyFirst&&this.no>0)||o.allDeaf;this.results=[];this.running=false;window.__sess.push(this)}
   start(){if(o.hang)return;if(this.running){const e=new Error('x');e.name='InvalidStateError';throw e}this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},80);
    if(!this.continuous)setTimeout(()=>this.end(),3000)}
   stop(){setTimeout(()=>this.end(),50)}abort(){this.running=false}
   end(){if(!this.running)return;this.running=false;this.onend&&this.onend()}
   hear(text,final=true){if(!this.running||this.deaf)return;const r=Object.assign([{transcript:text}],{isFinal:final});if(this.results.length&&!this.results[this.results.length-1].isFinal)this.results[this.results.length-1]=r;else this.results.push(r);this.onresult&&this.onresult({results:this.results.slice(),resultIndex:this.results.length-1})}}
  window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;
  window.__speak=(t,f=true)=>{const s=window.__sess.find(x=>x.running);if(s)s.hear(t,f)}},opts);
 await pg.goto('http://localhost:8776/');await sleep(700);await pg.click('#navPractice');return {pg,ctx,errs}}
const btn=pg=>pg.textContent('#check'),res=pg=>pg.textContent('#result');
async function attempt(pg,say=true){await pg.click('#check');await sleep(400);if(say)await pg.evaluate(()=>window.__speak(document.querySelector('#english').textContent));await pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent),null,{timeout:13000}).catch(()=>{});await sleep(150);return /相似度 100%/.test(await res(pg))}
// 1 iPhone-like: only first recognizer hears
{const {pg,ctx,errs}=await setup({onlyFirst:true});let r=[];for(let n=0;n<5;n++){r.push(await attempt(pg));if(n===1){await pg.click('#play');await sleep(300)}if(n===2){await pg.click('#next');await sleep(300)}}
 const ns=await pg.evaluate(()=>window.__sess.length);const d=await res(pg);
 ok('模擬 iPhone（每頁只有第一個辨識器聽得到）：連續 5 次都成功',r.every(Boolean)&&ns===1,r.map(x=>x?'✓':'✗').join('')+'｜辨識器 '+ns+' 個｜'+d.slice(d.indexOf('診斷'),d.indexOf('診斷')+70));
 // TTS / other speech between attempts ignored
 await pg.evaluate(()=>window.__speak('Something unrelated spoken by the app'));await sleep(200);const ok6=await attempt(pg);ok('兩次之間聽到的其他聲音（例如朗讀）不會算進下一次',ok6);
 // phone ends background session; new one deaf -> reload button
 await pg.evaluate(()=>window.__sess[0].end());await sleep(200);await pg.click('#check');await sleep(400);await pg.evaluate(()=>window.__speak('hello'));await sleep(3000);await pg.click('#check');await sleep(2000);
 const m=await res(pg);const hb=await pg.$('#result .rec-reload');ok('手機結束背景辨識、新的聽不到：顯示「重新啟動麥克風」',!!hb&&/開始念/.test(await btn(pg)),m.replace(/\s+/g,' ').slice(0,70));
 ok('沒有 JavaScript 錯誤（iPhone 模擬）',errs.length===0,errs.join(';'));await ctx.close()}
// 2 normal browser
{const {pg,ctx,errs}=await setup({});let r=[];for(let n=0;n<5;n++)r.push(await attempt(pg));ok('一般瀏覽器：連續 5 次都成功',r.every(Boolean),r.map(x=>x?'✓':'✗').join(''));
 // user stop with interim only
 await pg.click('#check');await sleep(300);await pg.evaluate(()=>window.__speak('the system',false));await sleep(300);await pg.click('#check');await sleep(2000);ok('只聽到一半就按停止：用已聽到的內容評分',/相似度/.test(await res(pg))&&/開始念/.test(await btn(pg)));
 // silence 10s
 await pg.click('#check');await sleep(10800);ok('沒說話：10 秒自動結束並提示',/沒有辨識到/.test(await res(pg))&&/開始念/.test(await btn(pg)));
 // recording stops recognizer, then 🎤 again works
 await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(700);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url);
 const alive=await pg.evaluate(()=>window.__sess.filter(s=>s.running).length);const r2=await attempt(pg);ok('錄音會先關閉背景辨識；錄完再按 🎤 仍可辨識',alive===0&&r2);
 ok('沒有 JavaScript 錯誤（一般）',errs.length===0,errs.join(';'));await ctx.close()}
// 3 hang
{const {pg,ctx,errs}=await setup({hang:true});await pg.click('#check');await sleep(5600);ok('辨識器完全沒反應：5 秒自動重設',/沒有回應/.test(await res(pg))&&/開始念/.test(await btn(pg)));await ctx.close()}
fs.writeFileSync('results_sr3.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
