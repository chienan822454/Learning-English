// V5.33.0：句子頁「🀄 看中文說英文」、「🧩 句型替換」（12 個 CE 工作句型、82 句）
const {serve,launch,sleep,R,ok,fs,dataCounts}=require('./common');const srv=serve(()=>'site',8897);
(async()=>{const b=await launch();
/* 朗讀：記下念了什麼（文字、語言、速度）；有英文和中文語音（window.__noZh＝沒有中文語音的手機）；語音辨識：測試用 window.__speak 念出內容 */
const stub=()=>{window.__said=[];
 const V=[{name:'Test US',lang:'en-US',voiceURI:'t-en',default:true,localService:true},{name:'Test TW',lang:'zh-TW',voiceURI:'t-zh',default:false,localService:true}];
 window.SpeechSynthesisUtterance=function(t){this.text=t;this.lang='';this.rate=1;this.voice=null};
 speechSynthesis.getVoices=()=>window.__noZh?V.slice(0,1):V;
 speechSynthesis.speak=u=>{window.__said.push({t:u.text,l:u.lang,r:u.rate,at:Date.now(),en:(()=>{const e=document.querySelector('#english');return !!e&&getComputedStyle(e).display!=='none'})()});setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
  say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f));
 /* 版面：文字實際排成幾行、文字和背景的對比 */
 window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};
 window.__contrast=el=>{const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};let bg=null;for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0.5){bg=c;break}}bg=bg||{r:255,g:255,b:255};const fg=rgb(getComputedStyle(el).color);const a=lum(fg),z=lum(bg);return Math.round((Math.max(a,z)+0.05)/(Math.min(a,z)+0.05)*10)/10}};
async function open(vp,extra,route,noWait){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone']},extra||{}));await ctx.addInitScript(stub);if(route)await route(ctx);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8897/');await sleep(900);if(!noWait)await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
/* 句子頁目前的樣子 */
const view=E=>E(()=>{const vis=s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&!!e.getClientRects().length};const kw=$('#keywords');
 return {id:cur().id,src:cur().src,keys:cur().keys.length,en:vis('#english'),zh:vis('#chinese'),mask:vis('#zfMask'),hint:vis('#zfHintTxt'),kw:vis('#keywords'),kwh:!!kw&&!kw.previousElementSibling.hidden,box:vis('#frBox'),seg:[...document.querySelectorAll('#zfSeg [data-zf]')].map(x=>x.getAttribute('aria-pressed')).join(','),showZh:$('#showZh').textContent,res:$('#result').textContent,prog:$('#progress').textContent,u:$('#unit').value,said:window.__said.length}});
const setUnit=(E,u)=>E(u=>{const el=$('#unit');el.value=u;el.dispatchEvent(new Event('change'))},u);
/* 按 🎤、念出 heard，等評分結束 */
async function speak(pg,heard){await pg.click('#check');await sleep(150);const lis=await pg.textContent('#result');await pg.evaluate(t=>window.__speak(t),heard);await pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent)&&/相似度/.test(document.querySelector('#result').textContent),null,{timeout:12000}).catch(()=>{});await sleep(100);
 return pg.evaluate(lis=>{const r=document.querySelector('#result');return {lis,t:r.textContent,score:+((/相似度 (\d+)%/.exec(r.textContent)||[])[1]),ok:[...r.querySelectorAll('.sw-line .sw-ok')].map(x=>x.textContent),miss:[...r.querySelectorAll('.sw-line .sw-miss')].map(x=>x.textContent)}},lis)}
/* 點句子裡的一個英文字（點字查詢） */
async function tapWord(pg,sel,word){const p=await pg.evaluate(([sel,word])=>{for(const el of document.querySelectorAll(sel)){const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){const m=new RegExp('(^|[^A-Za-z])('+word+')(?![A-Za-z])').exec(n.data);if(m){el.scrollIntoView({block:'center'});const k=m.index+m[1].length;const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+word.length);const q=r.getBoundingClientRect();return {x:q.left+Math.min(q.width/2,4),y:q.top+q.height/2}}}}return null},[sel,word]);if(p){await pg.mouse.click(p.x,p.y);await sleep(250)}return p}
const flowBar=E=>E(()=>{const e=document.getElementById('flowBar');return e&&!e.hidden?e.textContent:''});
const C=dataCounts();
const NF=(()=>{const vm=require('vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('site/data.js','utf8'),ctx);return (ctx.window.FRAMES||[]).reduce((a,f)=>a+f.items.length,0)})();

// ---------- A. 🧩 句型替換：句子、單元、句型框 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});
const D=await E(()=>{const F=window.FRAMES,S=ALLS.filter(s=>s.src==='frame'),ids=S.map(s=>s.id);
 const expect=[];F.forEach(f=>f.items.forEach((it,n)=>expect.push('f:'+f.id+':'+n+'|'+it.en)));
 return {nf:F.length,n:S.length,idsOk:S.map(s=>s.id+'|'+s.en).join('\n')===expect.join('\n'),uniq:new Set(ALLS.map(s=>s.id)).size===ALLS.length,
  frameOk:S.every(s=>s.frame===s.id.split(':')[1]&&s.zh&&s.en),label:SRC_LABEL.frame,
  opts:[...document.querySelectorAll('#unit option')].filter(o=>o.value==='frame'||/^fr\d+$/.test(o.value)).map(o=>o.value+'='+o.textContent),
  every:$('#unit option[value="every"]').textContent,total:ALLS.length,
  keys:S.filter(s=>s.keys.length).length,gloss:S.every(s=>s.keys.every(k=>(WMAP[k]&&WMAP[k].zh)||(KX[k]&&KX[k].zh))),
  fills:S.filter(s=>{const it=frItem(s);return !it||frSpans(s.en,it.fill).length!==it.fill.length}).map(s=>s.id),
  ex:[exNeeded('frame'),exNeeded('fr01')]}});
ok('句子清單有 '+D.nf+' 個句型、'+D.n+' 句「句型替換」（V6.1.0 起 24 個句型）：每句的代號固定（f:句型:第幾句）、和 FRAMES 的順序一樣，所有句子代號不重複',D.nf>=24&&D.n===NF&&NF>=158&&D.idsOk&&D.uniq&&D.frameOk&&D.label==='句型替換',JSON.stringify({nf:D.nf,n:D.n,idsOk:D.idsOk,uniq:D.uniq}));
ok('單元選單：「🧩 句型替換（'+NF+'）」和每個句型（例如「句型 1・回報警報（8）」、「句型 24・說明位置（6）」）；「全部句子」的總數含句型的句子',D.opts.length===D.nf+1&&D.opts[0]==='frame=🧩 句型替換（'+NF+'）'&&D.opts[1]==='fr01=句型 1・回報警報（8）'&&D.opts[24]==='fr24=句型 24・說明位置（6）'&&D.opts[12]==='fr12=句型 12・先後順序（6）'&&D.every===`全部句子（${D.total}）`&&D.total===C.total+('fr' in C?0:NF),JSON.stringify({opts:D.opts,every:D.every,total:D.total,dc:C.total}));
ok('句型的句子有「③ 關鍵字」（'+D.keys+'/'+D.n+' 句；查得到中文），填進空格的字在每一句都找得到，不需要等單字例句下載',D.keys>=D.n*0.95&&D.gloss&&D.fills.length===0&&D.ex.join()==='false,false',JSON.stringify({keys:D.keys,gloss:D.gloss,fills:D.fills,ex:D.ex}));
await pg.click('#navPractice');await sleep(200);
let V=await view(E);
ok('一般句子沒有句型框；預設是「👂 看英文跟讀」（英文顯示、中文藏起來，和原本一樣）',!V.box&&V.seg==='true,false'&&V.en&&!V.zh&&!V.mask&&V.showZh==='👁 看中文',JSON.stringify(V));
await pg.selectOption('#unit','frame');await sleep(300);
const B1=await E(()=>({prog:$('#progress').textContent,box:!$('#frBox').hidden,sel:$('#frSel').value,nsel:$('#frSel').options.length,sel0:$('#frSel').options[0].textContent,pat:$('#frPat').textContent,blanks:document.querySelectorAll('#frPat .fr-blank').length,zh:$('#frZh').textContent,tip:$('#frTip').textContent,rec:!$('#frRec').hidden&&$('#frRec').textContent,marks:[...document.querySelectorAll('#english mark.fr-fill')].map(m=>m.textContent),en:$('#english').textContent,cur:cur().en}));
ok('選「🧩 句型替換」：句子上方有句型框（英文句型 3 個空格、中文句型、用法說明），句子裡填進空格的字（high temperature、AHU-5、Hall B）用黃底標出',B1.prog==='句型替換 1 / '+NF&&B1.box&&B1.sel==='frame'&&B1.nsel===25&&B1.sel0==='全部句型（'+NF+'）'&&/^We have a （空格） alarm on （空格） in （空格）\.$/.test(B1.pat)&&B1.blanks===3&&B1.zh==='（空格）的（空格）有（空格）警報。'&&B1.tip==='回報警報：警報種類＋設備＋地點'&&B1.marks.join('|')==='high temperature|AHU-5|Hall B'&&B1.en===B1.cur,JSON.stringify(B1));
ok('句型框有一行建議：搭配「🀄 看中文說英文」練習',/看中文說英文/.test(B1.rec||''),B1.rec);
await E(()=>{window.__said=[]});
await tapWord(pg,'#english','temperature');
const LK=await E(()=>{const p=$('#lkPop');return p&&!p.hidden?{w:p.querySelector('.lk-w b').textContent,zh:p.querySelector('.lk-zh').textContent,said:window.__said.map(x=>x.t)}:null});
ok('句型的句子一樣可以點字查詢：點「temperature」（黃底標示的字裡）顯示「溫度」並念出來',!!LK&&LK.w==='temperature'&&/溫度/.test(LK.zh)&&LK.said[0]==='temperature',JSON.stringify(LK));
await pg.keyboard.press('Escape');await sleep(100);
await pg.selectOption('#frSel','fr03');await sleep(300);
const B2=await E(()=>({u:$('#unit').value,unit:store.settings.unit,learn:store.settings.learnUnit,prog:$('#progress').textContent,all:pool.every(s=>s.frame==='fr03'),n:pool.length,pat:$('#frPat').textContent,sel:$('#frSel').value,id:cur().id}));
ok('句型框換成「句型 3・設備狀態」：只練這個句型的 8 句（單元選單也跟著換，記住這個選擇）',B2.u==='fr03'&&B2.unit==='fr03'&&B2.learn==='fr03'&&B2.prog==='句型替換 1 / 8'&&B2.all&&B2.n===8&&/^（空格） is （空格）\.$/.test(B2.pat)&&B2.sel==='fr03'&&B2.id==='f:fr03:0',JSON.stringify(B2));
await E(()=>{window.__said=[]});
const seen=new Set();let prev=await E(()=>cur().id),same=0,other=0;
for(let k=0;k<12;k++){await pg.click('#frAgain');await sleep(60);const id=await E(()=>cur().id);if(id===prev)same++;if(!/^f:fr03:/.test(id))other++;seen.add(id);prev=id}
const B3=await E(()=>({said:window.__said.length,focus:document.activeElement&&document.activeElement.id}));
ok('「🔀 換一句」：每次換成同一個句型的另一句（12 次都不重複上一句、都是句型 3），不會自動念英文',same===0&&other===0&&seen.size>=4&&B3.said===0,JSON.stringify({same,other,seen:seen.size,B3}));
const pos=await E(()=>({i,id:cur().id}));
await setUnit(E,'all');await sleep(200);await setUnit(E,'fr03');await sleep(200);
const B4=await E(()=>({i,id:cur().id}));
ok('換到別的單元再回來：停在剛才練的那一句',B4.id===pos.id,JSON.stringify({pos,B4}));
// 全部句子：句型的句子也有句型框；一般句子沒有
await setUnit(E,'every');await sleep(300);
const B5=await E(()=>{const k=pool.findIndex(s=>s.id==='f:fr07:4');i=k;render();const a={box:!$('#frBox').hidden,sel:$('#frSel').value,marks:[...document.querySelectorAll('#english mark')].map(m=>m.textContent).join('|'),prog:$('#progress').textContent};i=0;render();a.box0=!$('#frBox').hidden;a.marks0=document.querySelectorAll('#english mark').length;return a});
ok('「全部句子」裡的句型句子也顯示句型框（選單停在它的句型 7），其他句子不顯示',B5.box&&B5.sel==='fr07'&&B5.marks==='a false alarm'&&/^句型替換 \d+ \/ \d+$/.test(B5.prog)&&!B5.box0&&B5.marks0===0,JSON.stringify(B5));
// 收藏、會說了、複習排程、🎤
await setUnit(E,'fr05');await sleep(200);
await pg.click('#fav');await sleep(100);await pg.click('#known');await sleep(150);
const B6=await E(()=>{const id='f:fr05:0';return {fav:store.fav.includes(id),known:store.known.includes(id),due:store.sDue[id],stage:store.sStage[id],d3:day(3),log:(todayLog().sentIds||[]).includes(id),favTxt:$('#fav').textContent,known2:$('#known').textContent}});
ok('句型的句子可以「☆ 收藏」、「✓ 我會說了」（今日計數照常，句子複習排在 3 天後）',B6.fav&&B6.known&&B6.due===B6.d3&&B6.stage===1&&B6.log&&/★/.test(B6.favTxt)&&/已會說/.test(B6.known2),JSON.stringify(B6));
await E(()=>{store.sDue['f:fr05:0']=day();save();filter();render()});
const B7=await E(()=>({rev:!$('#sReview').hidden}));
await pg.click('#sOk');await sleep(150);
const B8=await E(()=>({stage:store.sStage['f:fr05:0'],due:store.sDue['f:fr05:0'],d7:day(7)}));
ok('句型的句子到期時出現「🔁 這句到期複習」，按「✓ 還會說」排到 7 天後',B7.rev&&B8.stage===2&&B8.due===B8.d7,JSON.stringify({B7,B8}));
await E(()=>{window.__said=[]});
const sh0=await E(()=>todayLog().shadow||0);
const en5=await E(()=>{i=pool.findIndex(s=>s.id==='f:fr05:2');render();return cur().en});
let r=await speak(pg,en5.replace(/[.,?!]/g,'').toLowerCase());
const sh1=await E(()=>todayLog().shadow||0);
ok('句型的句子用 🎤 念：逐字回饋全部綠色、相似度 100%，今日「句子跟讀」計數 +1',r.score===100&&r.miss.length===0&&r.ok.length>=8&&sh1===sh0+1,JSON.stringify({r,sh0,sh1}));
// 一開始就是句型單元（重新開啟 App）：句型框照常出現
await pg.reload();await sleep(1200);
const B9s=await E(()=>({u:$('#unit').value,id:cur().id,box:!$('#frBox').hidden,marks:document.querySelectorAll('#english mark.fr-fill').length}));
await pg.click('#navPractice');await sleep(300);
const B9=await E(()=>({u:$('#unit').value,id:cur().id,box:!$('#frBox').hidden,marks:document.querySelectorAll('#english mark.fr-fill').length,sel:$('#frSel').value}));
ok('重新開啟 App：回到上次的句型（句型 5）和同一句，句型框和黃底標示都在（開啟時第一次顯示就有）',B9s.u==='fr05'&&B9s.id==='f:fr05:2'&&B9s.box&&B9s.marks===2&&B9.u==='fr05'&&B9.id==='f:fr05:2'&&B9.box&&B9.marks===2&&B9.sel==='fr05',JSON.stringify({B9s,B9}));
// 收藏單元只有一句句型句子：「換一句」切到那個句型
await E(()=>{store.fav=['f:fr02:3'];save()});await setUnit(E,'fav');await sleep(200);
await pg.click('#frAgain');await sleep(300);
const B10=await E(()=>({u:$('#unit').value,id:cur().id}));
ok('在「我的收藏」裡按「🔀 換一句」：切到同一個句型（句型 2），換成另一句',B10.u==='fr02'&&/^f:fr02:/.test(B10.id)&&B10.id!=='f:fr02:3',JSON.stringify(B10));
const NK=await E(()=>({mem:'zhFirst' in store.settings,ls:/zhFirst/.test(localStorage.getItem('english5000v5')||'')}));
ok('沒有切換過練習方式：學習紀錄（備份檔）不會多出新欄位',!NK.mem&&!NK.ls,JSON.stringify(NK));
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 🀄 看中文說英文 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);
await setUnit(E,'all');await sleep(200);
await pg.click('#showZh');await sleep(100);
let V=await view(E);
ok('「👂 看英文跟讀」時「👁 看中文」照原本顯示中文',V.en&&V.zh&&V.showZh==='👁 看中文',JSON.stringify(V));
await E(()=>{window.__said=[]});
await pg.click('#zfSeg [data-zf="1"]');await sleep(500);
V=await view(E);
const S1=await E(()=>({set:store.settings.zhFirst,ls:JSON.parse(localStorage.getItem('english5000v5')).settings.zhFirst,btn:[$('#zfHint').textContent,$('#zfShow').textContent]}));
ok('切到「🀄 看中文說英文」：中文顯示、英文藏起來（只有「💡 提示」和「👁 看英文」），③ 關鍵字也先藏起來；這個設定會記住',V.seg==='false,true'&&V.zh&&!V.en&&V.mask&&!V.kw&&!V.kwh&&S1.set===true&&S1.ls===true&&S1.btn.join('|')==='💡 提示|👁 看英文',JSON.stringify({V,S1}));
const RZ=await E(()=>({zh:cur().zh,b:($('#result .zf-rzh')||{}).textContent}));
ok('切換後不會自動念英文；🎤 下面也顯示這句中文和「按 🎤 用英文說出來」（小手機捲到 🎤 也看得到題目）；「👁 看中文」改成「👁 看英文」',V.said===0&&RZ.b==='🀄 '+RZ.zh&&/按「🎤 開始念」用英文說出來/.test(V.res)&&V.showZh==='👁 看英文',JSON.stringify({V,RZ}));
await pg.click('#zfHint');await sleep(100);
const H=await E(()=>({t:$('#zfHintTxt').textContent,want:rpHintText(cur().en),vis:!$('#zfHintTxt').hidden,en:getComputedStyle($('#english')).display,btn:$('#zfHint').textContent,pr:$('#zfHint').getAttribute('aria-pressed')}));
ok('按「💡 提示」：顯示每個字的第一個字母（和 Role Play 的提示一樣），英文還是藏著',H.vis&&H.t===H.want&&/_/.test(H.t)&&H.en==='none'&&H.btn==='💡 收起提示'&&H.pr==='true',JSON.stringify(H));
await pg.click('#zfShow');await sleep(100);
V=await view(E);
ok('按「👁 看英文」：英文和 ③ 關鍵字出現，提示框收起來；「👁 看英文」變成「🙈 藏英文」',V.en&&V.zh&&!V.mask&&V.keys>0&&V.kw&&V.kwh&&V.showZh==='🙈 藏英文',JSON.stringify(V));
await pg.click('#showZh');await sleep(100);
const V2=await view(E);
ok('按「🙈 藏英文」可以再藏起來重新練',!V2.en&&V2.mask&&!V2.kw&&V2.showZh==='👁 看英文',JSON.stringify(V2));
await E(()=>{window.__said=[]});
await pg.click('#next');await sleep(150);
V=await view(E);
ok('「下一句 →」：新的句子一樣先看中文、英文藏著，不會自動念',V.prog==='精選 2 / 110'&&V.zh&&!V.en&&V.mask&&!V.hint&&V.said===0,JSON.stringify(V));
await pg.click('#play');await sleep(150);
const P=await E(()=>({said:window.__said.map(x=>x.t),en:cur().en,vis:getComputedStyle($('#english')).display}));
ok('想先聽也可以：「🔊 播放句子」照常念英文（英文仍然藏著）',P.said[0]===P.en&&P.vis==='none',JSON.stringify(P));
// 🎤：說英文 → 顯示英文、逐字回饋、計數
const sh0=await E(()=>todayLog().shadow||0);
const en=await E(()=>cur().en);
let r=await speak(pg,en.replace(/[.,?!]/g,'').toLowerCase());
V=await view(E);
const sh1=await E(()=>todayLog().shadow||0);
const zh2=await E(()=>cur().zh);
ok('按 🎤 時說明「請用英文說出（這句中文）」；念完自動顯示英文，逐字回饋全部綠色、相似度 100%，今日「句子跟讀」計數 +1',r.lis==='🎧 正在聆聽…請用英文說出「'+zh2+'」（說完會自動評分）'&&r.score===100&&r.miss.length===0&&V.en&&!V.mask&&V.kw===(V.keys>0)&&sh1===sh0+1,JSON.stringify({r,V,sh0,sh1}));
await pg.click('#next');await sleep(150);
const en2=await E(()=>cur().en);const w2=en2.split(/\s+/);
r=await speak(pg,w2.slice(0,Math.max(1,w2.length-2)).join(' ').replace(/[.,?!]/g,'').toLowerCase());
V=await view(E);
ok('只說出一部分：英文顯示，沒念到的字在結果裡標紅（可以點來聽），相似度不到 100%',V.en&&r.miss.length>=1&&r.score<100&&r.score>0,JSON.stringify({r,V}));
await pg.click('#known');await sleep(150);
const K=await E(()=>({known:store.known.includes(cur().id),en:getComputedStyle($('#english')).display}));
ok('看過英文後按「✓ 我會說了」：照常記錄，英文不會又被藏起來',K.known&&K.en!=='none',JSON.stringify(K));
await E(()=>{const k=cur().id;store.known=store.known.filter(x=>x!==k);save()});
// 每一種句子單元都可以用
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});
const U={};
for(const [u,lab] of [['all','精選'],['w1','單字例句'],['pall','片語例句'],['dall','對話句'],['radio','無線電用語'],['wt2','多益長例句'],['frame','句型替換'],['every','精選']]){
 await E(()=>{window.__said=[]});await setUnit(E,u);await sleep(150);
 const a=await view(E);await pg.click('#zfShow');await sleep(60);const c=await view(E);
 U[u]={ok:a.zh&&!a.en&&a.mask&&a.said===0&&a.prog.startsWith(lab+' ')&&c.en&&!c.mask,prog:a.prog}}
ok('精選、單字例句、片語例句、對話句、無線電、多益長例句、句型替換、全部句子：都是先看中文、英文藏著，按「👁 看英文」才顯示',Object.values(U).every(x=>x.ok),JSON.stringify(U));
// 句型＋看中文說英文
await setUnit(E,'fr01');await sleep(200);
const F1=await E(()=>({box:!$('#frBox').hidden,rec:$('#frRec').hidden,pat:$('#frPat').textContent,order:['#frBox','#chinese','#zfMask'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().top)),en:getComputedStyle($('#english')).display}));
await pg.click('#zfHint');await sleep(80);
const F2=await E(()=>({hint:$('#zfHintTxt').textContent,marks:[...document.querySelectorAll('#zfHintTxt mark')].map(m=>m.textContent)}));
ok('句型＋看中文說英文：句型框在最上面、接著中文、再來是提示框（英文藏著）；建議那一行不再顯示；提示裡填空的部分也標出來',F1.box&&F1.rec&&F1.order[0]<F1.order[1]&&F1.order[1]<F1.order[2]&&F1.en==='none'&&F2.hint==='W_ h___ a h___ t__________ a____ o_ AHU-5 i_ H___ B.'&&F2.marks.join('|')==='h___ t__________|AHU-5|H___ B',JSON.stringify({F1,F2}));
// 重新開啟 App：仍是看中文說英文
await pg.reload();await sleep(1200);
const V0=await E(()=>({on:$('.sentence').classList.contains('zf-on'),rev:$('.sentence').classList.contains('zf-rev'),zh:$('#chinese').hidden,mask:$('#zfMask').hidden}));
await pg.click('#navPractice');await sleep(300);
V=await view(E);
ok('重新開啟 App：仍然是「🀄 看中文說英文」，第一句也是英文藏著（開啟時第一次顯示就是）',V0.on&&!V0.rev&&!V0.zh&&!V0.mask&&V.seg==='false,true'&&V.zh&&!V.en&&V.mask&&V.u==='fr01'&&V.box,JSON.stringify({V0,V}));
for(const n of ['#navToday','#navWords','#navStats']){await pg.click(n);await sleep(150)}
const OP=await E(()=>({sent:getComputedStyle($('.sentence')).display,panel:getComputedStyle($('.panel')).display,seg:!!$('#zfSeg').getClientRects().length}));
await pg.click('#navPractice');await sleep(200);
ok('看中文說英文時切到今日、單字、統計頁：句子卡片和切換鈕不會出現在其他頁',OP.sent==='none'&&OP.panel==='none'&&!OP.seg,JSON.stringify(OP));
const BK=await E(()=>makeBackup().progress.settings.zhFirst);
ok('備份檔裡記著這個練習方式',BK===true,String(BK));
// 切回看英文跟讀
await pg.click('#zfSeg [data-zf="0"]');await sleep(500);
V=await view(E);
const S2=await E(()=>({mem:'zhFirst' in store.settings,ls:/zhFirst/.test(localStorage.getItem('english5000v5')||''),res:$('#result').textContent}));
ok('切回「👂 看英文跟讀」：英文顯示、中文藏起來、③ 關鍵字出現，和原本完全一樣（學習紀錄裡的設定也移除）',V.seg==='true,false'&&V.en&&!V.zh&&!V.mask&&V.kw&&V.showZh==='👁 看中文'&&!S2.mem&&!S2.ls&&S2.res==='按下後朗讀上面的英文句子',JSON.stringify({V,S2}));
ok('B 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 自動播放（看中文說英文） ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);await setUnit(E,'fr03');await sleep(200);
await pg.click('#zfSeg [data-zf="1"]');await sleep(150);
await E(()=>{window.__said=[];i=0;render()});
const s0=await E(()=>({en:cur().en,zh:cur().zh,id:cur().id}));
await pg.click('#autoPlay');await sleep(500);
const A1=await E(()=>({said:window.__said.slice(),q:$('#zfQ').textContent,en:getComputedStyle($('#english')).display,btn:$('#autoPlay').textContent}));
await pg.waitForFunction(n=>window.__said.length>=n,3,{timeout:15000}).catch(()=>{});
const A2=await E(()=>({said:window.__said.slice(),en:getComputedStyle($('#english')).display}));
await pg.waitForFunction(id=>cur().id!==id,s0.id,{timeout:8000}).catch(()=>{});await sleep(150);
const A3=await E(()=>({id:cur().id,en:getComputedStyle($('#english')).display,said:window.__said.length,mask:!$('#zfMask').hidden}));
const gap=A2.said.length>=2?A2.said[1].at-A2.said[0].at:0;
ok('自動播放：先念中文（英文藏著、提示框顯示「換你用英文說說看」），停幾秒讓你自己說，再顯示英文並念英文（正常＋慢速），接著下一句（英文又藏起來）',A1.said.length===1&&A1.said[0].t===s0.zh&&/^zh/.test(A1.said[0].l)&&!A1.said[0].en&&/換你用英文說說看/.test(A1.q)&&A1.en==='none'&&A1.btn==='⏸ 停止自動'&&A2.said[1].t===s0.en&&/^en/.test(A2.said[1].l)&&A2.said[1].en&&A2.said[2].t===s0.en&&A2.said[2].r<1&&gap>=2500&&A3.id!==s0.id&&A3.en==='none'&&A3.mask,JSON.stringify({A1,A2:A2.said.map(x=>[x.t.slice(0,20),x.l,x.r,x.en]),gap,A3}));
await pg.click('#autoPlay');await sleep(200);
const A4=await E(()=>({on:autoOn,q:$('#zfQ').textContent,btn:$('#autoPlay').textContent}));
ok('按「⏸ 停止自動」：停止，提示框回到「用英文說說看」',!A4.on&&A4.q==='🗣 用英文說說看'&&A4.btn==='▶ 自動播放',JSON.stringify(A4));
// 停頓時按「下一句 →」：自動播放停止（和原本一樣），之後也不會再念上一句的英文
await E(()=>{window.__said=[];i=0;render()});
await pg.click('#autoPlay');await sleep(600);await pg.click('#next');await sleep(5500);
const NX=await E(()=>({said:window.__said.map(x=>x.t),id:cur().id,on:autoOn,btn:$('#autoPlay').textContent,en:getComputedStyle($('#english')).display,q:$('#zfQ').textContent}));
ok('自動播放停頓時按「下一句 →」：自動播放停止，之後不會再念上一句的英文；新的句子英文藏著',!NX.on&&NX.btn==='▶ 自動播放'&&NX.id==='f:fr03:1'&&NX.said.join('|')===s0.zh&&NX.en==='none'&&NX.q==='🗣 用英文說說看',JSON.stringify(NX));
// 停頓時句子被換掉（例如長例句下載完重新排列）：不念上一句的英文，從現在這一句重新開始
await E(()=>{window.__said=[];i=0;render()});
const s1=await E(()=>ALLS.find(s=>s.id==='f:fr03:1'));
await pg.click('#autoPlay');await sleep(600);await E(()=>{i=1;render()});
await pg.waitForFunction(()=>window.__said.filter(x=>/^en/.test(x.l)).length>=1,null,{timeout:20000}).catch(()=>{});
const NY=await E(()=>({said:window.__said.map(x=>x.t),id:cur().id,on:autoOn}));
await E(()=>{if(autoOn)stopAuto()});await sleep(100);
ok('自動播放停頓時句子被換掉：不會念上一句的英文，改從現在這一句（先念中文）重新開始',NY.on&&NY.id==='f:fr03:1'&&!NY.said.includes(s0.en)&&NY.said[0]===s0.zh&&NY.said[1]===s1.zh&&NY.said[2]===s1.en,JSON.stringify(NY));
// 沒有中文語音的手機：只顯示中文，一樣停頓
await E(()=>{window.__noZh=true;window.__said=[];i=0;render()});
await pg.click('#autoPlay');const t0=Date.now();
await pg.waitForFunction(()=>window.__said.length>=1,null,{timeout:15000}).catch(()=>{});
const N1=await E(()=>({said:window.__said.slice(),en:getComputedStyle($('#english')).display}));
await pg.click('#autoPlay');await sleep(100);
ok('沒有中文語音的手機：不念中文，停頓後才顯示並念英文',N1.said.length>=1&&N1.said[0].t===s0.en&&N1.said[0].en&&Date.now()-t0>=2500,JSON.stringify({N1:N1.said.map(x=>[x.t,x.l]),ms:Date.now()-t0}));
// 看英文跟讀的自動播放和原本一樣：一開始就念英文
await pg.click('#zfSeg [data-zf="0"]');await sleep(150);
await E(()=>{window.__noZh=false;window.__said=[];i=0;render()});
await pg.click('#autoPlay');await sleep(400);
const N2=await E(()=>({said:window.__said.map(x=>x.t),en:cur().en}));
await pg.click('#autoPlay');await sleep(100);
ok('「👂 看英文跟讀」的自動播放和原本一樣：一開始就念英文',N2.said[0]===N2.en,JSON.stringify(N2));
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 今日學習的「句子跟讀」 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);await setUnit(E,'fr01');await sleep(200);
await pg.click('#zfSeg [data-zf="1"]');await sleep(150);
await E(()=>{store.settings.flowCfg={rev:0,new:0,situ:0,sent:5};save()});
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody [data-go="flow"]');await sleep(500);
let V=await view(E);let fb=await flowBar(E);
ok('今日學習（只做句子跟讀）：到句子頁，用上次選的句型（句型 1）、看中文說英文，進度 0／5',V.u==='fr01'&&V.src==='frame'&&V.zh&&!V.en&&/句子跟讀 0／5/.test(fb),JSON.stringify({V,fb}));
let en=await E(()=>cur().en);
let r=await speak(pg,en.replace(/[.,?!]/g,'').toLowerCase());await sleep(1300);
fb=await flowBar(E);
ok('看中文說英文用 🎤 念對：今日學習進度 1／5',r.score===100&&/句子跟讀 1／5/.test(fb),JSON.stringify({score:r.score,fb}));
await pg.click('#known');await sleep(1300);fb=await flowBar(E);
V=await view(E);
ok('按「✓ 我會說了」：進度 2／5，換下一句（英文又藏起來）',/句子跟讀 2／5/.test(fb)&&!V.en&&V.mask,JSON.stringify({fb,V}));
await pg.click('#zfSeg [data-zf="0"]');await sleep(150);
en=await E(()=>cur().en);
r=await speak(pg,en.replace(/[.,?!]/g,'').toLowerCase());await sleep(1300);fb=await flowBar(E);
ok('換回看英文跟讀也照常計數：進度 3／5',r.score===100&&/句子跟讀 3／5/.test(fb),JSON.stringify({score:r.score,fb}));
// 句型單元＋只看未會說：全部會說了 → 照原本提示
await E(()=>{pool.forEach(s=>{if(!store.known.includes(s.id))store.known.push(s.id)});save();filter();render()});
const EM=await E(()=>({note:$('#unitNote').hidden?'':$('#unitNote').textContent,src:cur().src}));
ok('這個句型都標記會說了（只看未會說）：照原本提示並先顯示精選句子',/都已標記「會說了」/.test(EM.note)&&EM.src==='core',JSON.stringify(EM));
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. Role Play 不受影響 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);await pg.click('#zfSeg [data-zf="1"]');await sleep(150);
await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d14"]');await sleep(200);await pg.click('#dlgRpB');await sleep(600);
const P1=await E(()=>({seg:getComputedStyle($('#zfSeg')).display,sent:$('.sentence').hidden,zf:$('.sentence').classList.contains('zf-on'),rpEn:!!$('#rpEn'),box:!$('#rpBox').hidden,check:!!document.querySelector('#rpSpeak #check')}));
const r=await speak(pg,'hi i am on rounds i found a tripped breaker on msb 1');
const P2=await E(()=>({pass:(document.querySelector('#rpSpeak .rp-pass')||{}).textContent||'',zf:$('.sentence').classList.contains('zf-on')}));
ok('Role Play 進行中：不顯示練習方式切換，Role Play 畫面、🎤 評分和原本一樣',P1.seg==='none'&&P1.sent&&!P1.zf&&P1.rpEn&&P1.box&&P1.check&&r.score>=80&&/通過/.test(P2.pass)&&!P2.zf,JSON.stringify({P1,r:r.score,P2}));
await pg.click('#rpEnd');await sleep(300);await pg.click('#navPractice');await sleep(300);
const V=await view(E);
ok('結束 Role Play 回到句子頁：仍是看中文說英文（英文藏著）',V.seg==='false,true'&&V.zh&&!V.en&&V.mask,JSON.stringify(V));
ok('E 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. 版面：360×640＋特大字＋深色、底部選單與進度列 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme()});
await pg.click('#navPractice');await sleep(200);await setUnit(E,'fr12');await sleep(200);
await pg.click('#zfSeg [data-zf="1"]');await sleep(200);
await pg.click('#zfHint');await sleep(100);
const M=async()=>E(()=>{const se=document.scrollingElement,q=s=>[...document.querySelectorAll(s)];const tap=e=>{const r=e.getBoundingClientRect();return r.width>=40&&r.height>=40};
 const btns=q('#zfSeg button,#zfMask button,#frAgain').filter(e=>e.getClientRects().length);
 return {ovw:se.scrollWidth-se.clientWidth,n:btns.length,one:btns.map(e=>window.__lines(e)),tap:btns.every(tap)&&tap($('#frSel')),
  inside:q('#frBox,#zfMask,#chinese,#zfSeg').filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),
  cut:btns.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)}});
const L1=await M();
ok('360×640＋特大字＋深色：句型框、中文、提示框都不會撐出橫向捲動；切換鈕、提示／看英文、換一句都是一行字、按得到的範圍至少 40×40px',L1.ovw<=0&&L1.n===5&&L1.one.every(x=>x===1)&&L1.tap&&L1.inside&&L1.cut.length===0,JSON.stringify(L1));
const DK=await E(()=>({box:getComputedStyle($('#frBox')).backgroundColor,mask:getComputedStyle($('#zfMask')).backgroundColor,on:getComputedStyle(document.querySelector('#zfSeg [aria-pressed="true"]')).backgroundColor,c:['#chinese','#frPat','#frZh','#frTip','#zfQ','#zfHintTxt','#zfSeg [aria-pressed="false"]','#frAgain'].map(s=>window.__contrast(document.querySelector(s)))}));
ok('深色模式：句型框、提示框是深色底，文字對比都夠（≥ 4.5）；選中的練習方式是藍底',DK.box!=='rgb(255, 250, 240)'&&DK.mask!=='rgb(246, 249, 254)'&&DK.on==='rgb(47, 105, 213)'&&DK.c.every(x=>x>=4.5),JSON.stringify(DK));
await pg.click('#zfShow');await sleep(100);
const L2=await M();
ok('顯示英文後（長句子＋特大字）也不會撐出橫向捲動',L2.ovw<=0&&await E(()=>{const r=$('#english').getBoundingClientRect();return r.right<=innerWidth&&r.left>=0}),JSON.stringify(L2));
// 今日學習進度列＋底部選單：最下面的按鈕捲得到進度列上面
await E(()=>{store.settings.flowCfg={rev:0,new:0,situ:0,sent:5};save()});
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody [data-go="flow"]');await sleep(500);
await E(()=>{const k=pool.findIndex(s=>s.src==='frame');if(k>=0){i=k;render()}});
await E(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));await sleep(200);
const BL=await E(()=>({next:Math.round($('#next').getBoundingClientRect().bottom),lim:Math.round(bottomLimit()),bar:!!$('#flowBar')&&!$('#flowBar').hidden,box:!$('#frBox').hidden}));
ok('有今日學習進度列時，捲到最下面「下一句 →」在進度列和底部選單上面（不會被蓋住）',BL.bar&&BL.box&&BL.next<=BL.lim,JSON.stringify(BL));
await E(()=>window.scrollTo(0,0));
const TOP=await E(()=>{const r=$('#zfSeg').getBoundingClientRect();return {t:r.top,b:r.bottom,lim:bottomLimit()}});
ok('練習方式切換在頁面上方，不會被底部選單或進度列蓋住',TOP.b<=TOP.lim&&TOP.t>=0,JSON.stringify(TOP));
ok('F 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// iPhone 實際可見範圍（390×686）、標準字：看英文跟讀的 🎤 和 🎙 不用往下捲
{const {ctx,pg,errs,E}=await open({width:390,height:686});
await pg.click('#navPractice');await sleep(300);
const S=await E(()=>({nav:Math.round(document.querySelector('nav').getBoundingClientRect().top),y:['#check','#record'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().bottom)),seg:Math.round($('#zfSeg').getBoundingClientRect().height),one:[...document.querySelectorAll('#zfSeg button')].map(e=>window.__lines(e))}));
ok('加了練習方式切換後，句子頁的 🎤 和 🎙 仍然不用往下捲就按得到（離底部選單至少 40px）；切換鈕一行字',S.y.every(y=>y<=S.nav-40)&&S.seg>=40&&S.one.every(x=>x===1),JSON.stringify(S));
ok('版面測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 單字例句還沒下載、開啟速度 ----------
{const {ctx,pg,errs,E}=await open(null,{serviceWorkers:'block'},async c=>{await c.route('**/data-ex.js*',r=>r.abort())},true);
await pg.waitForFunction(()=>EX_FAIL,null,{timeout:20000}).catch(()=>{});
await pg.click('#navPractice');await sleep(200);await setUnit(E,'frame');await sleep(200);
const G=await E(()=>({fail:EX_FAIL,prog:$('#progress').textContent,note:$('#unitNote').hidden?'':$('#unitNote').textContent,src:cur().src,pos:store.settings.pos.frame}));
await pg.click('#next');await sleep(100);
const G2=await E(()=>({pos:store.settings.pos.frame}));
ok('單字例句下載失敗時，句型替換照常可以練，也會記住位置',G.fail&&G.prog==='句型替換 1 / '+NF&&!G.note&&G.src==='frame'&&G2.pos===1,JSON.stringify({G,G2}));
const T=await E(()=>{const t=performance.now();for(let k=0;k<10;k++)frameSents();return (performance.now()-t)/10});
ok('開啟 App 時建立 '+NF+' 句句型句子很快（平均 '+T.toFixed(1)+' ms）',T<60,T.toFixed(2)+' ms');
ok('G 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p28.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
