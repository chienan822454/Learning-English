const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8775);
(async()=>{const b=await launch();const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{navigator.audioSession={type:'auto',state:'inactive'};window.__ttsSpeak=0;speechSynthesis.speak=u=>{window.__ttsSpeak++;setTimeout(()=>u.onend&&u.onend(),30)}});
await pg.goto('http://localhost:8775/');await sleep(800);await pg.click('#navPractice');await pg.click('#next');await pg.click('#next');await sleep(200);
const t0=await pg.evaluate(()=>navigator.audioSession.type);
await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');const t1=await pg.evaluate(()=>navigator.audioSession.type);await sleep(800);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url);
await pg.click('#mine');await sleep(300);await pg.click('#play');await sleep(300);const t2=await pg.evaluate(()=>navigator.audioSession.type);
ok('開始錄音時把手機音訊設為「播放＋錄音」，播放後仍保持',t0==='auto'&&t1==='play-and-record'&&t2==='play-and-record',t0+' → '+t1+' → '+t2);
const dg=await pg.evaluate(()=>REC.diag);ok('錄音診斷顯示音訊模式',/音訊模式 play-and-record/.test(dg),dg);
// silent: both methods empty -> reload button
await pg.evaluate(()=>{window.wavBlob=()=>({blob:new Blob([new Uint8Array(100)],{type:'audio/wav'}),secs:1.2,peak:0});const MR=window.MediaRecorder;window.MediaRecorder=class extends MR{constructor(s,o){super(s,o);const f=()=>{};Object.defineProperty(this,'ondataavailable',{set(){},get(){return f}})}};window.MediaRecorder.isTypeSupported=MR.isTypeSupported});
await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(800);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle',null,{timeout:6000});await sleep(200);
const m=await pg.textContent('#recMsg');const hasBtn=await pg.$('#recMsg .rec-reload');ok('錄到靜音：顯示說明與「重新啟動麥克風」按鈕',/沒有收到聲音|沒有錄到聲音/.test(m)&&!!hasBtn,m.replace(/\s+/g,' ').slice(0,80));
const pos=await pg.textContent('#progress');await hasBtn.click();await pg.waitForLoadState('load');await sleep(1500);
const vis=await pg.evaluate(()=>!document.querySelector('.panel').hidden);const pos2=await pg.textContent('#progress');
ok('按「重新啟動麥克風」：重新載入後回到句子頁同一句',vis&&pos===pos2,pos+' → '+pos2);
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_sess.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
