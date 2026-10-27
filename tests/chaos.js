// 隨機操作測試：每個種子用全新的瀏覽器資料，隨機點按鈕、選選單、輸入文字、重新載入；記錄所有 JavaScript 錯誤與畫面異常文字
const {serve,launch,sleep,fs}=require('./common');const PORT=+process.env.PORT||8899;const srv=serve(()=>'site2',PORT);
const seeds=(process.env.SEEDS||'1,2,3').split(',').map(Number),STEPS=+process.env.STEPS||250;
function rng(s){return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff}}
(async()=>{const b=await launch();const all=[];
for(const seed of seeds){const R=rng(seed);const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();
 const errs=[];const log=[];pg.on('pageerror',e=>errs.push({step:log.length,msg:e.message,stack:(e.stack||'').split('\n').slice(0,3).join(' | ')}));pg.on('dialog',d=>d.accept().catch(()=>{}));
 await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),30)};speechSynthesis.cancel=()=>{};
  const words=['good morning','the ups alarm cleared','fifty two three','what is going on','hello','i am on rounds'];
  class F{constructor(){this.results=[];this.running=false}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart();if(Math.random()<.8)setTimeout(()=>{if(!this.running)return;this.results.push(Object.assign([{transcript:words[Math.floor(Math.random()*words.length)]}],{isFinal:Math.random()<.7}));this.onresult&&this.onresult({results:this.results.slice()})},300)},40)}stop(){this.running=false;setTimeout(()=>this.onend&&this.onend(),30)}abort(){this.running=false;setTimeout(()=>this.onend&&this.onend(),10)}}
  window.webkitSpeechRecognition=F;window.SpeechRecognition=F});
 await pg.goto(`http://localhost:${PORT}/`);await sleep(900);
 const bad=new Set();
 for(let step=0;step<STEPS;step++){
  const r=R();
  try{
   if(r<0.03){log.push('reload');await pg.reload();await sleep(700);continue}
   if(r<0.05){log.push('visibility hidden/visible');await pg.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});continue}
   const els=await pg.evaluate(()=>{const out=[];document.querySelectorAll('button,select,input,[data-go],.dlg-card,.dlg-bub,.row,label.importBtn').forEach((e,k)=>{const r=e.getBoundingClientRect();const st=getComputedStyle(e);if(e.closest('[hidden]')||st.display==='none'||st.visibility==='hidden'||r.width<2||r.height<2||e.disabled)return;if(e.type==='file'||e.id==='install'||e.closest('label.importBtn'))return;e.setAttribute('data-ck',k);out.push({k,tag:e.tagName,type:e.type||'',id:e.id,txt:(e.innerText||e.value||'').slice(0,24)})});return out});
   if(!els.length){log.push('no elements');continue}
   const e=els[Math.floor(R()*els.length)];const sel=`[data-ck="${e.k}"]`;
   if(e.tag==='SELECT'){const opts=await pg.$$eval(sel+' option',o=>o.map(x=>x.value));const v=opts[Math.floor(R()*opts.length)];log.push(`select ${e.id}=${v}`);await pg.selectOption(sel,v,{timeout:2000})}
   else if(e.tag==='INPUT'&&(e.type==='text'||e.type==='search'||e.type==='')){const t=['pump','ups','你好','','zzzz','a'][Math.floor(R()*6)];log.push(`type ${e.id}="${t}"`);await pg.fill(sel,t,{timeout:2000});await pg.dispatchEvent(sel,'input');await pg.keyboard.press('Enter')}
   else{log.push(`click ${e.id||e.tag}「${e.txt.replace(/\s+/g,' ')}」`);await pg.click(sel,{timeout:2000})}
   await sleep(60+Math.floor(R()*200));
   if(step%10===0){const t=await pg.evaluate(()=>document.body.innerText);for(const p of ['undefined','NaN','[object Object]','Infinity'])if(t.includes(p))bad.add(p+' @step '+step+' after '+log[log.length-1]);
    const okStore=await pg.evaluate(()=>{try{JSON.parse(localStorage.getItem('english5000v5')||'{}');return true}catch(e){return false}});if(!okStore)bad.add('store JSON broken @'+step)}
  }catch(ex){log.push('  (action failed: '+String(ex.message).split('\n')[0].slice(0,80)+')')}
 }
 const res={seed,errors:errs.map(x=>({...x,around:log.slice(Math.max(0,x.step-4),x.step+1)})),bad:[...bad]};all.push(res);
 console.log(`seed ${seed}: JS errors ${errs.length}, screen issues ${bad.size}`);errs.slice(0,4).forEach(x=>console.log('  ERR',x.msg,'|',x.stack.slice(0,200),'\n     steps:',log.slice(Math.max(0,x.step-4),x.step+1).join(' → ')));[...bad].slice(0,4).forEach(x=>console.log('  BAD',x));
 await ctx.close()}
fs.writeFileSync('/tmp/chaos_'+(process.env.TAG||'run')+'.json',JSON.stringify(all,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
