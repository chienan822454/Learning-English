const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8792);
(async()=>{const b=await launch();const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{window.__sess=[];const allDeaf=sessionStorage.getItem('e5k_rl')!==null;
 class F{constructor(){this.no=window.__sess.length;this.deaf=allDeaf||this.no>0;this.results=[];this.running=false;window.__sess.push(this)}
  start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
  hear(t){if(!this.running||this.deaf)return;this.results.push(Object.assign([{transcript:t}],{isFinal:true}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=t=>window.__sess.forEach(s=>s.hear(t))});
await pg.goto('http://localhost:8792/');await sleep(700);await pg.click('#navPractice');
const idle=()=>pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent),null,{timeout:13000}).catch(()=>{});
async function att(){await pg.click('#check');await sleep(300);await pg.evaluate(()=>window.__speak(document.querySelector('#english').textContent));await sleep(2700);if(/停止/.test(await pg.textContent('#check')))await pg.click('#check');await idle();await sleep(150);return (await pg.textContent('#result')).replace(/\s+/g,' ')}
await att();
await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(600);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url);
const t2=await att();ok('非重新載入時聽不到：仍提供「重新啟動麥克風」',!!(await pg.$('#result .rec-reload'))&&!/無法修復/.test(t2));
await pg.click('#result .rec-reload');await pg.waitForLoadState('load');await sleep(1500);
const t3=await att();ok('重新載入後仍聽不到：顯示「瀏覽器辨識卡住」說明',/無法修復/.test(t3)&&/Safari/.test(t3)&&!(await pg.$('#result .rec-reload')));
const n0=await pg.evaluate(()=>performance.timeOrigin);await att();const n1=await pg.evaluate(()=>performance.timeOrigin);ok('卡住後再按 🎤 不會一直重新載入',n0===n1);
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_stuck.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
