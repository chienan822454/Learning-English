const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8787);
(async()=>{const b=await launch();/* V5.27.2：自動重新載入只用在 iPhone／iPad（Safari 引擎），所以這個測試模擬 iPhone 的瀏覽器 */
const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/129.0.2792.84 Version/17.0 Mobile/15E148 Safari/604.1'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{window.__sess=[];
 class FakeSR{constructor(){this.no=window.__sess.length;this.deaf=this.no>0;this.results=[];this.running=false;window.__sess.push(this)}
  start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},80)}
  stop(){setTimeout(()=>{if(this.running){this.running=false;this.onend&&this.onend()}},50)}abort(){this.running=false}
  hear(t){if(!this.running||this.deaf)return;this.results.push(Object.assign([{transcript:t}],{isFinal:true}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;window.__speak=t=>{window.__sess.filter(x=>x.running).forEach(s=>s.hear(t))}});
await pg.goto('http://localhost:8787/');await sleep(700);await pg.click('#navPractice');await pg.click('#next');await pg.click('#next');await sleep(200);
const res=()=>pg.textContent('#result');const idle=()=>pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent),null,{timeout:13000}).catch(()=>{});
async function att(){await pg.click('#check');await sleep(400);await pg.evaluate(()=>window.__speak(document.querySelector('#english').textContent));await sleep(300);if(/停止/.test(await pg.textContent('#check'))){await sleep(2300);await pg.click('#check')}await idle();await sleep(150);return /相似度 100%/.test(await res())}
const pos0=await pg.textContent('#progress');
const a1=await att();
await pg.click('#record');await pg.waitForFunction(()=>REC.state==='recording');await sleep(700);await pg.click('#record');await pg.waitForFunction(()=>REC.state==='idle'&&!!REC.url);
const a2=await att();const flag=await pg.evaluate(()=>sessionStorage.getItem('e5k_sr_once'));const btn=!!(await pg.$('#result .rec-reload'));
ok('第 1 次 🎤 成功；錄音後第 2 次遇到聽不到的辨識器：顯示重新啟動、並記住這支手機的限制',a1&&!a2&&flag==='1'&&btn,`第1次 ${a1}｜第2次 ${a2}｜記住 ${flag}`);
await pg.click('#check');await pg.waitForLoadState('load');await sleep(1800);
const msg=await res();const pos1=await pg.textContent('#progress');const vis=await pg.evaluate(()=>!document.querySelector('.panel').hidden);
ok('之後按 🎤：自動重新載入，回到句子頁同一句並提示再按一次',vis&&pos1===pos0&&/已重新啟動/.test(msg),pos0+' → '+pos1+'｜'+msg);
const r=[];for(let n=0;n<3;n++)r.push(await att());ok('重新載入後 🎤 連續 3 次成功',r.every(Boolean),r.map(x=>x?'✓':'✗').join(''));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_sr4.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
