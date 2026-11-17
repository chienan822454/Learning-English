const {serve,launch,sleep,R,ok,fs}=require('./common');const PORT=8765;const srv=serve(()=>'site',PORT);
(async()=>{const b=await launch();
 async function newPage(init){const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>{errs.push('DIALOG:'+d.message());d.dismiss()});
  await pg.addInitScript(()=>{window.__tracks=[];const g=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await g(c);window.__tracks.push(...s.getTracks());return s};});
  if(init)await pg.addInitScript(init);await pg.goto(`http://localhost:${PORT}/index.html`);await pg.waitForTimeout(800);await pg.click('#navPractice');return {pg,ctx,errs}}
 const live=pg=>pg.evaluate(()=>window.__tracks.filter(t=>t.readyState==='live').length);
 {const {pg,ctx,errs}=await newPage();
  for(let n=1;n<=5;n++){await pg.click('#record');
   let st=await pg.waitForFunction(()=>REC.state==='recording',null,{timeout:4000}).then(()=>true).catch(()=>false);
   if(!st){ok(`錄音 ${n}：開始`,false,await pg.textContent('#record'));continue}
   await sleep(1200);await pg.click('#record');
   let done=await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url&&!document.querySelector('#mine').disabled,null,{timeout:5000}).then(()=>true).catch(()=>false);
   const info=await pg.evaluate(async()=>({size:(await (await fetch(REC.url)).blob()).size,live:window.__tracks.filter(t=>t.readyState==='live').length,btn:document.querySelector('#record').textContent}));
   await pg.click('#mine');
   const played=await pg.evaluate(()=>new Promise(res=>{const p=REC.player;if(!p){res('no-player');return}let t0=Date.now();(function chk(){if(p.currentTime>0.2)res('playing '+p.currentTime.toFixed(2)+'s');else if(Date.now()-t0>3000)res('not-playing');else setTimeout(chk,100)})()}));
   const dg=await pg.evaluate(()=>REC.diag);ok(`錄音 ${n} → 停止 → 播放`,done&&info.size>0&&info.live<=1&&played.startsWith('playing'),`檔案 ${info.size} bytes、${played}、按鈕「${info.btn.trim()}」、${dg}`);await sleep(300)}
  ok('連續錄音沿用同一個麥克風（只取得 1 次）',await pg.evaluate(()=>window.__tracks.length)===1,'共取得 '+await pg.evaluate(()=>window.__tracks.length)+' 次');await pg.evaluate(()=>{REC.keepMs=500;recKeep()});await sleep(900);ok('閒置後自動關閉麥克風',await live(pg)===0);
  await pg.click('#compare');await sleep(500);ok('「範例→我」可按',errs.length===0,errs.join(';'));
  await pg.click('#record');await pg.click('#record',{force:true});await pg.click('#record',{force:true});await sleep(1500);
  if(await pg.evaluate(()=>REC.state)==='recording'){await pg.click('#record');await sleep(1500)}
  let s2=await pg.evaluate(()=>REC.state);ok('連點錄音鈕不會卡住、最多只開 1 個麥克風',s2==='idle'&&await live(pg)<=1,s2);
  await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(500);await pg.click('#next');await sleep(800);
  let s3=await pg.evaluate(()=>({st:REC.state,url:REC.url,mine:document.querySelector('#mine').disabled}));ok('錄音中切換下一句：停止、清除舊錄音',s3.st==='idle'&&!s3.url&&s3.mine&&await live(pg)<=1,JSON.stringify(s3));
  await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(800);await pg.click('#record');ok('切換句子後仍可再錄音',await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:4000}).then(()=>true).catch(()=>false));
  await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(600);
  await pg.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(1500);
  let s4=await pg.evaluate(()=>({st:REC.state,url:!!REC.url}));await pg.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true})});
  ok('錄音中切到背景：自動停止並保留錄音',s4.st==='idle'&&s4.url,JSON.stringify(s4));
  ok('過程中沒有 JavaScript 錯誤',errs.length===0,errs.join(' ; '));await ctx.close()}
 {const {pg,ctx,errs}=await newPage(()=>{window.__deny=true;const g=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=c=>window.__deny?Promise.reject(new DOMException('denied','NotAllowedError')):g(c)});
  await pg.click('#record');await sleep(600);let m=await pg.evaluate(()=>({msg:document.querySelector('#recMsg').textContent,dis:document.querySelector('#record').disabled}));
  ok('麥克風權限被拒：顯示說明、按鈕恢復',/權限/.test(m.msg)&&!m.dis,m.msg.slice(0,30)+'…');await pg.evaluate(()=>window.__deny=false);
  await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording',null,{timeout:4000});await sleep(800);await pg.click('#record');
  ok('允許權限後不用重新整理即可錄音',await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:4000}).then(()=>true).catch(()=>false));ok('權限測試沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));await ctx.close()}
 {const {pg,ctx,errs}=await newPage(()=>{window.MediaRecorder=undefined;window.AudioContext=undefined;window.webkitAudioContext=undefined});await pg.click('#record');await sleep(400);let m=await pg.textContent('#recMsg');
  ok('瀏覽器不支援錄音：顯示說明',/不支援/.test(m),m.slice(0,30)+'…');ok('不支援測試沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));await ctx.close()}
 {const {pg,ctx}=await newPage();await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(800);
  await pg.evaluate(()=>{REC.stream.getTracks()[0].onended()});let r1=await pg.waitForFunction(()=>REC.state==='idle',null,{timeout:4000}).then(()=>true).catch(()=>false);
  await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(600);await pg.click('#record');let r=await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:4000}).then(()=>true).catch(()=>false);
  ok('麥克風中途被系統中斷：自動停止、可再錄',r1&&r);
  const dg=await pg.evaluate(()=>REC.diag);ok('兩種方式同時收音：都有聲音時採用 WAV',/採用 WAV/.test(dg)&&/MediaRecorder \d+ KB/.test(dg),dg);
  await pg.evaluate(()=>{window.wavBlob=()=>({blob:new Blob([new Uint8Array(100)],{type:'audio/wav'}),secs:1.5,peak:0})});
  for(let n=0;n<3;n++){await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(1500);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:6000})}
  const dg2=await pg.evaluate(()=>REC.diag);const sz=await pg.evaluate(async()=>(await (await fetch(REC.url)).blob()).size);ok('模擬 iPhone：WAV 是靜音時自動改用 MediaRecorder（連續 3 次）',/採用 MediaRecorder/.test(dg2)&&sz>2000,dg2+'、檔案 '+sz+' bytes');await ctx.close()}
 {const {pg,ctx,errs}=await newPage(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined});let res=[];
  for(let n=1;n<=3;n++){await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording',null,{timeout:4000});await sleep(1500);await pg.click('#record');
   let d=await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url,null,{timeout:6000}).then(()=>true).catch(()=>false);res.push(d&&await pg.evaluate(async()=>(await (await fetch(REC.url)).blob()).size)>0)}
  ok('沒有 Web Audio 時改用 MediaRecorder：連續 3 次',res.every(Boolean)&&/採用 MediaRecorder/.test(await pg.evaluate(()=>REC.diag)),JSON.stringify(res)+' '+errs.join(';'));await ctx.close()}
 fs.writeFileSync('results_rec.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
