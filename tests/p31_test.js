// V5.34.0：🎤 縮寫和編號的念法（別名、一個一個字母念、字母數字編號；逐字回饋顏色和分數一致；一般句子分數不變）、句子關鍵字補強（多字 CE 字的複數、縮寫全名、句型替換、沒有關鍵字的對話句）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8902);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];window.__rate=[];speechSynthesis.speak=u=>{window.__said.push(u.text);window.__rate.push(u.rate);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
  say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f))};
async function open(vp){const ctx=await b.newContext({viewport:vp||{width:390,height:844},permissions:['microphone']});await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[],cons=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))cons.push(m.text())});pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8902/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,cons,E:(f,a)=>pg.evaluate(f,a)}}
// 句子頁換成指定的句子（測試用）
const setSent=(E,en)=>E(en=>{page('practice');pool=[{id:'t:'+en.length,en,zh:'（測試句）',keys:[],src:'core'}];i=0;render()},en);
// 按 🎤、念出 heard（fin=false：還沒結束的辨識結果），等評分結束
async function speak(pg,heard,fin){await pg.click('#check');await sleep(150);await pg.evaluate(([t,f])=>window.__speak(t,f!==false),[heard,fin]);await pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent)&&/相似度/.test(document.querySelector('#result').textContent),null,{timeout:12000}).catch(()=>{});await sleep(100);
 return pg.evaluate(()=>{const r=document.querySelector('#result');return {t:r.textContent,score:+((/相似度 (\d+)%/.exec(r.textContent)||[])[1]),ok:[...r.querySelectorAll('.sw-line .sw-ok')].map(x=>x.textContent),miss:[...r.querySelectorAll('.sw-line .sw-miss')].map(x=>x.textContent),extra:(r.querySelector('.sw-extra')||{}).textContent||'',pass:(r.querySelector('.rp-pass')||{}).textContent||''}})}
// 不開麥克風，直接算相似度和逐字回饋（和 srResult 同一套）
const SCORE=`window.__sc=(en,h)=>{const a=scTok(en),H=scHeard(h),score=a.length?Math.round(scMatch(a,H)/a.length*100):0;const d=document.createElement('div');d.innerHTML=swFeedback(en,h,score);return {score,miss:[...d.querySelectorAll('.sw-miss')].map(x=>x.textContent),ok:[...d.querySelectorAll('.sw-ok')].map(x=>x.textContent),extra:(d.querySelector('.sw-extra')||{}).textContent||'',html:d.innerHTML}}`;

// ---------- A. 🎤 縮寫被聽成別的字（別名） ----------
{const {ctx,pg,errs,cons,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
await pg.click('#navPractice');await sleep(200);
await setSent(E,'Apply LOTO before you open the panel.');
let r=await speak(pg,'apply lotto before you open the panel');
ok('LOTO 被聽成 lotto：LOTO 是綠色、相似度 100%，「另外聽到」不會列出 lotto',r.score===100&&r.miss.length===0&&r.ok.includes('LOTO')&&!r.extra,JSON.stringify(r));
r=await speak(pg,'apply low toe before you open the panel');
const r2=await speak(pg,'apply lo-to before you open the panel');
ok('LOTO 被聽成 low toe、lo-to 也算對（100%，沒有「另外聽到」）',r.score===100&&!r.extra&&r2.score===100&&!r2.extra,JSON.stringify({r,r2}));
r=await speak(pg,'apply bass guitar before you open the panel');
ok('句子裡沒有 BAS：bass guitar 不會讓 LOTO 算對（LOTO 紅色、86%，另外聽到 bass、guitar）',r.score===86&&r.miss.join('|')==='LOTO'&&/bass、guitar/.test(r.extra),JSON.stringify(r));
await E(SCORE);
const AL=await E(()=>[['Check the BAS screen.','check the bass screen'],['Call the SOC now.','call the sock now'],['I already opened an IcM.','i already opened an icm'],['I already opened an IcM.','i already opened an i c m'],['I already opened an IcM.','I already opened an I see M'],['Please call the FOC.','please call the f o c'],['Please call the FOC.','please call the F oh C'],['Check EPMS now.','check e p m s now'],['Check EPMS now.','check E PM S now'],['Is the CRAC running?','is the crack running'],['Call the NOC.','call the knock'],['The VESDA is in alarm.','the vesta is in alarm']].map(([en,h])=>[en,h,window.__sc(en,h)]));
ok('別名表：BAS ← bass、SOC ← sock、IcM ← icm／i c m／I see M、FOC ← f o c／F oh C、EPMS ← e p m s／E PM S、CRAC ← crack、NOC ← knock、VESDA ← vesta 都是 100%、沒有「另外聽到」',AL.every(x=>x[2].score===100&&!x[2].miss.length&&!x[2].extra),JSON.stringify(AL.filter(x=>x[2].score!==100||x[2].extra).map(x=>[x[1],x[2].score,x[2].extra])));
const NO=await E(()=>[['He plays bass guitar.','he plays bass guitar',100],['Wear warm socks.','wear warm sock',67],['The lotto ticket is on the desk.','the lotto ticket is on the desk',100],['Apply LOTO first.','apply bass first',67],['Check the BAS screen.','check the lotto screen',75],['Call the SOC now.','call the soccer now',75]].map(([en,h,want])=>[en,h,want,window.__sc(en,h).score]));
ok('別名只在句子裡有那個縮寫時才算：一般句子（bass guitar、socks、lotto ticket）照原本評分；別的縮寫的別名不算（bass ≠ LOTO、lotto ≠ BAS、soccer ≠ SOC）',NO.every(x=>x[2]===x[3]),JSON.stringify(NO));
ok('A 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- B. 🎤 一個一個字母念的縮寫、編號 ----------
{const {ctx,pg,errs,cons,E}=await open();
await pg.click('#navPractice');await sleep(200);
await setSent(E,'UPS-2A went on bypass at 3:40 p.m.');
let r=await speak(pg,'u p s 2 a went on bypass at 3 40 pm');
ok('u p s 2 a：UPS-2A 是綠色、相似度 100%，不再列出「另外聽到：u、p、s」',r.score===100&&r.ok.includes('UPS-2A')&&!r.extra,JSON.stringify(r));
r=await speak(pg,'u p s two a went on bypass at three forty p.m.');
ok('u p s two a（數字念成英文）也一樣 100%',r.score===100&&!r.extra,JSON.stringify(r));
await setSent(E,'Breaker 9 on PDU-B3 tripped.');
r=await speak(pg,'breaker 9 on p d u b 3 tripped');
ok('p d u b 3：PDU-B3 是綠色、100%、沒有「另外聽到」',r.score===100&&r.ok.includes('PDU-B3')&&!r.extra,JSON.stringify(r));
await setSent(E,'Correction: the breaker is 52-8, not 52-3.');
r=await speak(pg,'correction the breaker is 52 8 not 52 3');
await E(SCORE);
const N=await E(()=>['correction the breaker is fifty two eight not fifty two three','correction the breaker is five two eight not five two three'].map(h=>window.__sc('Correction: the breaker is 52-8, not 52-3.',h).score));
ok('52 8、fifty two eight、five two eight 都對到 52-8（100%）',r.score===100&&r.ok.includes('52-8,')&&N.every(x=>x===100),JSON.stringify({r,N}));
// 立即評分：還沒結束的辨識結果裡字都到齊了就評分
await setSent(E,'UPS-2A went on bypass.');
r=await speak(pg,'u p s 2 a went on bypass',false);
ok('立即評分（辨識還沒結束）：u p s 2 a went on bypass 一到齊就評分 100%',r.score===100&&!r.miss.length,JSON.stringify(r));
const C=await E(()=>[['Racks B10 to B14.','racks b 1 0 to b 1 4'],['Racks B10 to B14.','racks be 10 to be 14'],['One open WO for CHWP-02.','one open w o for c h w p 0 2'],['One open WO for CHWP-02.','one open double you oh for chwp zero two'],['Please check a UPS now.','please check a u p s now'],['The UPS-2A input is fine.','the you p s 2 a input is fine'],['Breaker 9 on PDU-C2 tripped.','breaker 9 on p d u see 2 tripped'],['The CE tech is at TWDC.','the c e tech is at t w d c'],['The leak is near CRAH-3.','the leak is near c r a h 3']].map(([en,h])=>[en,h,window.__sc(en,h)]));
ok('任何位置的字母都能合起來（a u p s、u p s 2 a）；字母的念法也算（be 10 → B10、double you oh → WO、you p s → UPS、see 2 → C2）；CHWP-02、CRAH-3、TWDC 也一樣 100%',C.every(x=>x[2].score===100&&!x[2].extra),JSON.stringify(C.filter(x=>x[2].score!==100||x[2].extra).map(x=>[x[1],x[2].score,x[2].miss,x[2].extra])));
const ALL=await E(()=>{const A=WORDS.filter(x=>x.acr),bad=[];A.forEach(x=>{const en='Please check the '+x.w+' B now.',h='please check the '+x.w.toLowerCase().split('').join(' ')+' b now',s=window.__sc(en,h);if(s.score!==100||s.miss.length||s.extra)bad.push(x.w+':'+s.score)});return {n:A.length,bad}});
ok('字表裡全部 '+ALL.n+' 個縮寫（acr:1）一個一個字母念（後面再接一個字母 B）都是 100%、綠色、沒有「另外聽到」',ALL.n>=70&&ALL.bad.length===0,JSON.stringify(ALL));
ok('別名表和自動產生的念法：別名只用在字表裡有的縮寫；一個一個字母念適用全部縮寫（PM 和 p.m. 同字，不另外加）',await E(()=>{const X=scxInit();return Object.keys(X.alias).every(k=>X.A.has(k.toLowerCase()))&&X.A.has('loto')&&X.A.has('icm')&&!X.A.has('pm')&&X.A.size>=WORDS.filter(x=>x.acr).length}));
// 顏色和分數一致：縮寫、編號句子一個一個字母念
const P=await E(()=>{const S=ALLS.filter(s=>/\b[A-Z]{2,}|\b[A-Z]+[a-z]?[A-Z]\b/.test(s.en)).filter((s,k)=>k%3===0).slice(0,120),bad=[];let n=0,reds=0;
 S.forEach((s,k)=>{const h=s.en.replace(/\b[A-Za-z]*[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b/g,m=>m.replace(/-/g,'').split('').join(' ')).split(/\s+/).filter((x,j)=>(j+k)%4!==2).join(' ');
  const a=scTok(s.en),H=scHeard(h),score=a.length?Math.round(scMatch(a,H)/a.length*100):0;const d=document.createElement('div');d.innerHTML=swFeedback(s.en,h,score);const miss=d.querySelectorAll('.sw-miss').length;n++;reds+=miss;
  const wrong=[...d.querySelectorAll('.sw-ok,.sw-miss')].filter(el=>{const t=scTok(el.textContent),all=t.every(x=>H.has(x));return el.classList.contains('sw-ok')?!all:all});
  if((score===100)!==(miss===0)||wrong.length)bad.push(s.en+' → '+score+'% '+wrong.map(e=>e.textContent).join(','))});return {n,reds,bad}});
ok(P.n+' 個有縮寫、編號的句子（字母一個一個念、漏念幾個字）：綠色的字都是相似度算到的字、紅色的字都沒算到；100% 時沒有紅字',P.n>=60&&P.reds>0&&P.bad.length===0,JSON.stringify(P).slice(0,400));
ok('B 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- C. 一般句子分數不變（前後比較：V5.34.0 新增的部分關掉＝V5.33.1 原本的評分） ----------
{const {ctx,pg,errs,cons,E}=await open();
const CMP=await E(()=>{const on=scXtra,X=scxInit(),mix=t=>/[a-z]/.test(t)&&/\d/.test(t);
 const run=(en,h)=>{const a=scTok(en),H=scHeard(h),score=a.length?Math.round(scMatch(a,H)/a.length*100):0;return [score,swFeedback(en,h,score),[...H].sort().join(' ')]};
 const norm=s=>s.toLowerCase().replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim(),ins=['bass','lotto','sock','u p s','i see m','b 3','f oh c','low toe','e pm s','see 2'];
 const AC=/\b[A-Za-z]*[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b/g,ALI={LOTO:'lotto',BAS:'bass',SOC:'sock',IcM:'i see m',FOC:'f oh c',EPMS:'e pm s',UPS:'you p s',WO:'double you oh'};
 const S=ALLS.filter((s,k)=>k%9===0||(s.src!=='word'&&k%3===0));const P=[];
 S.forEach((s,k)=>{const w=norm(s.en).split(' ');const c=w.map((x,j)=>[x,j]).filter(([x])=>/^[a-z]{3,}$/.test(x));const sp=c.length?c[k%c.length][1]:-1;
  [w.join(' '),s.en,w.filter((x,j)=>(j+k)%3!==1).join(' '),w.map((x,j)=>j===k%w.length?x+'s':x).join(' '),w.map((x,j)=>j%4===1?'um '+x:x).join(' '),w.map((x,j)=>j===sp?x.split('').join(' '):x).join(' '),
   w.slice(0,1).concat(ins[k%ins.length],w.slice(1),ins[(k+3)%ins.length]).join(' '),s.en.replace(AC,m=>m.replace(/-/g,'').split('').join(' ')),s.en.replace(AC,m=>m.split('-').map(x=>ALI[x]||x).join(' '))].forEach(h=>P.push([s.en,h]))});
 const plainS=new Set(),out={sent:S.length,pairs:P.length,plain:0,same:0,acr:0,better:0,worse:0,diff:[],worseEx:[]};
 try{
  P.forEach(([en,h])=>{const plain=!scTok(en).some(t=>X.A.has(t)||mix(t));scXtra=()=>[];const b=run(en,h);scXtra=on;const a=run(en,h);
   if(plain){plainS.add(en);out.plain++;if(a[0]===b[0]&&a[1]===b[1])out.same++;else if(out.diff.length<5)out.diff.push([en,h,b[0],a[0]])}
   else{out.acr++;if(a[0]>b[0])out.better++;else if(a[0]<b[0]){out.worse++;out.worseEx.push([en,h,b[0],a[0]])}}})
 }finally{scXtra=on}
 out.plainSent=plainS.size;return out});
ok('前後比較：'+CMP.sent+' 個真的句子 × 9 種模擬辨識結果（照念、漏念、念錯、加 um、字母拼出來、插入 bass／lotto／u p s…、縮寫一個一個字母念、縮寫念成別名）：沒有縮寫和編號的句子（'+CMP.plainSent+' 句、'+CMP.plain+' 組）分數和逐字回饋跟 V5.33.1 完全一樣',CMP.plain>3000&&CMP.same===CMP.plain&&CMP.diff.length===0,JSON.stringify({sent:CMP.sent,plain:CMP.plain,same:CMP.same,diff:CMP.diff}));
ok('前後比較：有縮寫或編號的句子（'+CMP.acr+' 組）分數只會一樣或變高（變高 '+CMP.better+' 組、變低 0 組）',CMP.acr>200&&CMP.better>50&&CMP.worse===0,JSON.stringify({acr:CMP.acr,better:CMP.better,worse:CMP.worse,ex:CMP.worseEx.slice(0,3)}));
ok('C 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- D. Role Play：和句子頁同一套評分（只透過 scHeard） ----------
{const {ctx,pg,errs,cons,E}=await open();
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d02"]');await sleep(200);await pg.click('#dlgRpB');await sleep(500);
await E(()=>{store.settings.rpLevel='hint';rpStart(DLG_BY.d02,'B',3,{},true)});await sleep(300);
let r=await speak(pg,'u p s 2 a went on bypass at 3 40 pm');
const RP1=await E(()=>({inBox:!!document.querySelector('#rpSpeak #result .sw-line'),sc:RP.sc[RP.n],n:RP.n}));
ok('Role Play（d02 你演 B）：「UPS-2A went on bypass…」念成 u p s 2 a… 也是 100%、全部綠色、通過',RP1.inBox&&RP1.n===3&&r.score===100&&RP1.sc===100&&!r.miss.length&&/通過/.test(r.pass),JSON.stringify({r,RP1}));
await E(()=>{rpStart(DLG_BY.d11,'B',3,{},true)});await sleep(300);
await pg.selectOption('#rpLevel','free');await sleep(200);
r=await speak(pg,'got it i am checking the trend on the bass now');
ok('Role Play 自由回答（d11）：重點句型「I\'m checking the trend on the BAS now.」的 BAS 念成 bass 也算說到重點句型，通過',/有說到重點句型/.test(r.pass)&&r.score===100,JSON.stringify(r));
r=await speak(pg,'got it i am checking the trend on the lotto now');
ok('Role Play 自由回答：別的縮寫的別名（lotto）不算 BAS，還沒說到重點句型',/還沒說到重點句型/.test(r.pass),JSON.stringify(r));
await E(()=>{store.settings.rpLevel='hint';save();rpOff()});
ok('D 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- E. 關鍵字：多字 CE 字的複數、CE 縮寫的全名（對話句） ----------
{const {ctx,pg,errs,cons,E}=await open();
const K=await E(()=>{const by=id=>(ALLS.find(s=>s.id===id)||{}).keys||[];return {wo:by('d:d01:5'),ct:by('d:d70:8'),sp:by('d:d36:4'),bp:by('d:d52:11'),pt:by('d:d52:9'),tray:by('d:d37:4'),fan:by('d:d51:5'),pm:by('d:d18:0'),gl:KX['work order']&&KX['work order'].pos+' '+KX['work order'].zh}});
ok('多字 CE 字的複數也找得到：open work orders → work order（中文「工單（縮寫 WO）」）、cooling towers → cooling tower、sump pumps → sump pump、blanking panels → blanking panel、perforated tiles、cable trays、exhaust fans',K.wo.join()==='work order'&&/工單（縮寫 WO）/.test(K.gl)&&K.ct.join()==='cooling tower'&&K.sp[0]==='sump pump'&&K.bp[0]==='blanking panel'&&K.pt[0]==='perforated tile'&&K.tray[0]==='cable tray'&&K.fan[0]==='exhaust fan',JSON.stringify(K));
ok('CE 縮寫的全名當多字 CE 字（排在縮寫的位置）：「the PM work order」的關鍵字是 work order、PM',K.pm.join('|')==='work order|PM',JSON.stringify(K.pm));
// 和逐一比對全部 CE 字（含全名、複數）的結果相同（p21 的檢查改成這一套）
const same=await E(()=>{const C=WORDS.filter(x=>x.k===7&&!x.b),seen=new Set(C.map(x=>x.w.toLowerCase())),ce=C.map((x,k)=>[x.w,x.w.toLowerCase(),k,0]);C.forEach((x,k)=>{const m=x.acr&&/（([A-Za-z][^）；，]*)/.exec(x.zh||''),e=m?m[1].toLowerCase().replace(/[^a-z0-9-]/g,' ').split(' ').filter(Boolean).join(' '):'';if(e.includes(' ')&&!seen.has(e)){seen.add(e);ce.push([e,e,k,1])}});ce.sort((a,b)=>a[2]-b[2]||a[3]-b[3]);ce.forEach(c=>{const p=c[1].split(' '),z=p.pop();c[1]=[c[1]].concat(p.length?[z+'s',z+'es'].concat(/[^aeiou]y$/.test(z)?[z.slice(0,-1)+'ies']:[]).map(v=>p.concat(v).join(' ')):[]).map(v=>' '+v+' ')});let diff=0,tot=0;const ds=dlgSentences();DIALOGS.forEach(d=>d.lines.forEach((L,n)=>{const low=' '+L.en.toLowerCase().replace(/[^a-z0-9-]/g,' ')+' ';const old=kwDedupe(ce.filter(c=>c[1].some(v=>low.includes(v))).map(c=>c[0])).slice(0,2);const nw=ds.find(s=>s.id==='d:'+d.id+':'+n).keys;tot++;if(old.some((k,j)=>nw[j]!==k))diff++}));return [diff,tot]});
ok('對話句的 CE 關鍵字和逐一比對全部 CE 字（含全名、複數）的結果相同（'+same[1]+' 句）',same[0]===0&&same[1]>=800,JSON.stringify(same));
await pg.click('#navPractice');await sleep(200);
const S=await E(()=>{const s=ALLS.find(s=>s.id==='d:d01:5');pool=[s];i=0;render();const kw=$('#keywords');return {hid:kw.hidden,t:kw.textContent,keys:s.keys}});
ok('句子頁：「Good. What about open work orders?」顯示關鍵字 work order 和中文「工單」',!S.hid&&/work order/.test(S.t)&&/工單/.test(S.t),JSON.stringify(S));
ok('E 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- F. 關鍵字：句型替換（和對話句一樣先找 CE 字，再用 kwFill 補） ----------
{const {ctx,pg,errs,cons,E}=await open();
const F=await E(()=>{const S=ALLS.filter(s=>s.src==='frame'),by=en=>(S.find(s=>s.en===en)||{}).keys||[];
 return {n:S.length,no:S.filter(s=>!s.keys.length).map(s=>s.en),wo:by('Do you want me to open a work order?'),pdu:by('PDU-B3 is back to normal.'),leak:by('The leak detection panel is clear.'),ct:by('Can you check the water level in the cooling tower basin?'),
  prefix:S.filter(s=>{const c=kwCE(s.en);return c.some((k,j)=>s.keys[j]!==k)}).map(s=>s.en),gloss:S.every(s=>s.keys.every(k=>(WMAP[k]&&WMAP[k].zh)||(KX[k]&&KX[k].zh)))}});
ok('句型替換 '+F.n+' 句都有關鍵字、都查得到中文：open a work order → work order；PDU-B3 → PDU；leak detection panel → leak detection；cooling tower basin → cooling tower',F.no.length===0&&F.gloss&&F.wo[0]==='work order'&&F.pdu[0]==='PDU'&&F.leak[0]==='leak detection'&&F.ct[0]==='cooling tower',JSON.stringify(F));
ok('句型替換的關鍵字前面就是 CE 字（和對話句同一套 kwCE），不足 2 個才用 kwFill 補',F.prefix.length===0,JSON.stringify(F.prefix));
ok('F 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

// ---------- G. 關鍵字：原本沒有關鍵字的對話句最多補 1 個 ----------
{const {ctx,pg,errs,cons,E}=await open();
const G=await E(()=>{const D=ALLS.filter(s=>s.src==='dialog'),by=id=>(D.find(s=>s.id===id)||{}).keys||[],gl=k=>(WMAP[k]&&WMAP[k].zh)||(KX[k]&&KX[k].pos+' '+KX[k].zh)||'';
 const ids=['d:d04:6','d:d10:2','d:d17:4','d:d31:3','d:d53:10','d:d66:6'];
 return {n:D.length,no:D.filter(s=>!s.keys.length).map(s=>s.en),got:ids.map(id=>[id,by(id),by(id).map(gl)]),basic:ids.some(id=>by(id).some(k=>WMAP[k]&&(WMAP[k].t||[]).includes('basic'))),
  allGloss:ALLS.filter(s=>/^(dialog|radio|frame)$/.test(s.src)).every(s=>s.keys.every(k=>WMAP[k]||KX[k])),radioNo:ALLS.filter(s=>s.src==='radio'&&!s.keys.length).length}});
const g=Object.fromEntries(G.got.map(x=>[x[0],x[1].join('|')+'='+x[2].join('|')]));
ok('沒有關鍵字的對話句補 1 個：CHWP-02 → CHWP、UPS-2B → UPS、B as in bravo → Bravo（字母代碼）、K as in kilo → Kilo、shut it down → shut down（片語）、get started（片語）；都有中文、不是基本字',/^CHWP=冰水泵/.test(g['d:d04:6'])&&/^UPS=不斷電系統/.test(g['d:d66:6'])&&/^Bravo=字母代碼 B/.test(g['d:d10:2'])&&/^Kilo=字母代碼 K/.test(g['d:d31:3'])&&/^shut down=片語 停機/.test(g['d:d17:4'])&&/^get started=片語 開始/.test(g['d:d53:10'])&&G.got.every(x=>x[1].length===1)&&!G.basic,JSON.stringify(g));
ok('還是沒有關鍵字的對話句只剩 '+G.no.length+' 句（只有很基本的字、數字或編號）；全部對話句、無線電句、句型句的關鍵字都查得到中文；無線電句不變（1 句沒有）',G.no.length<=17&&G.allGloss&&G.radioNo===1,JSON.stringify({no:G.no,radioNo:G.radioNo}));
// 速度：開啟 App 時建立對話句和句型句
const T=await E(()=>{const m=f=>{const a=[];for(let k=0;k<7;k++){const t=performance.now();f();a.push(performance.now()-t)}a.sort((x,y)=>x-y);return a[3]};return {dlg:m(dlgSentences),fr:m(frameSents)}});
ok('開啟 App 時建立對話句（'+T.dlg.toFixed(1)+' ms）和句型句（'+T.fr.toFixed(1)+' ms）很快',T.dlg<40&&T.fr<15,JSON.stringify(T));
await pg.click('#navPractice');await sleep(200);
const S=await E(()=>{const s=ALLS.find(s=>s.id==='d:d10:2');pool=[s];i=0;render();const kw=$('#keywords');return {hid:kw.hidden,t:kw.textContent}});
ok('句子頁：「UPS-1B. B as in bravo.」顯示關鍵字 Bravo 和「字母代碼 B（無線電拼字）」',!S.hid&&/Bravo/.test(S.t)&&/字母代碼 B（無線電拼字）/.test(S.t),JSON.stringify(S));
ok('G 部分沒有 JavaScript 錯誤（含 console 錯誤）',!errs.length&&!cons.length,errs.concat(cons).join(' | '));await ctx.close()}

fs.writeFileSync('results_p31.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
