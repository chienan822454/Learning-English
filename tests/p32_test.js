// V5.34.0：今日學習「🧩 句型」步驟、「句子練習用 🀄 中翻英」、意思回想統計（今天回想過的字記住、統計頁、每週摘要、今日頁小卡）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8903);
(async()=>{const b=await launch();
/* 朗讀：記下念了什麼；語音辨識：測試用 window.__speak 念出內容；版面：文字行數、對比 */
const stub=()=>{window.__said=[];
 const V=[{name:'Test US',lang:'en-US',voiceURI:'t-en',default:true,localService:true},{name:'Test TW',lang:'zh-TW',voiceURI:'t-zh',default:false,localService:true}];
 window.SpeechSynthesisUtterance=function(t){this.text=t;this.lang='';this.rate=1;this.voice=null};
 speechSynthesis.getVoices=()=>V;
 speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
  say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f));
 window.__lines=el=>{const f=parseFloat(getComputedStyle(el).fontSize);const rg=document.createRange();rg.selectNodeContents(el);const ys=[...rg.getClientRects()].filter(q=>q.width>0&&q.height>0).map(q=>q.top).sort((x,y)=>x-y);let n=0,last=-1e9;for(const y of ys){if(y-last>f*0.6){n++;last=y}}return n};
 window.__canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
 window.__contrast=el=>{const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};let bg=null;for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0.5){bg=c;break}}bg=bg||{r:255,g:255,b:255};const fg=rgb(getComputedStyle(el).color);const a=lum(fg),z=lum(bg);return Math.round((Math.max(a,z)+0.05)/(Math.min(a,z)+0.05)*10)/10}};
async function open(vp,extra){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone'],acceptDownloads:true},extra||{}));await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8903/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}
const iso=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
const bar=pg=>pg.evaluate(()=>{const e=document.getElementById('flowBar');return e&&!e.hidden?e.textContent:''});
/* 在句子頁的單元選單自己選一個單元（和手指選一樣：會記成「句子跟讀」用的範圍） */
const setUnit=(E,u)=>E(u=>{const el=$('#unit');el.value=u;el.dispatchEvent(new Event('change'))},u);
/* 按 🎤、念出 heard，等評分結束 */
async function speak(pg,heard){await pg.click('#check');await sleep(150);await pg.evaluate(t=>window.__speak(t),heard);await pg.waitForFunction(()=>/開始念/.test(document.querySelector('#check').textContent)&&/相似度/.test(document.querySelector('#result').textContent),null,{timeout:12000}).catch(()=>{});await sleep(100);
 return pg.evaluate(()=>{const r=document.querySelector('#result');return {t:r.textContent,score:+((/相似度 (\d+)%/.exec(r.textContent)||[])[1])}})}
const say=async pg=>{const en=await pg.evaluate(()=>cur().en);return speak(pg,en.replace(/[.,?!]/g,'').toLowerCase())};
/* 意思回想評分：先翻面再按 ✓／◐／✗（known／learning／new） */
const mrGrade=async(pg,g)=>{await pg.evaluate(()=>{window.__cardAt=0});await pg.click('#wordCard [data-ca="reveal"]');await sleep(100);await pg.evaluate(()=>{window.__cardAt=0});await pg.click(`#wordCard [data-ca="g-${g}"]`);await sleep(120)};
/* 句子頁的練習方式（看中文說英文？暫存標記？切換鈕、畫面、存檔） */
const zf=E=>E(()=>({on:store.settings.zhFirst===true,tmp:store.settings.zfFlow,seg:[...document.querySelectorAll('#zfSeg [data-zf]')].map(x=>x.getAttribute('aria-pressed')).join(','),cls:$('.sentence').classList.contains('zf-on'),mask:!$('#zfMask').hidden,ls:(JSON.parse(localStorage.getItem('english5000v5')).settings||{}).zhFirst===true,u:$('#unit').value,bar:(()=>{const e=document.getElementById('flowBar');return e&&!e.hidden?e.textContent:''})()}));
/* 每週摘要表格的每一列 */
const wkRowsOf=E=>E(()=>{const g=document.querySelector('#statsBody .wk');if(!g)return {};const c=[...g.children],rows={};for(let k=3;k<c.length;k+=3)rows[c[k].textContent]=[c[k+1].textContent.trim(),c[k+2].textContent.trim()];return rows});
const IMP='p32_import.json';
async function imp(pg,obj){fs.writeFileSync(IMP,JSON.stringify(obj));await pg.click('#navStats');await sleep(300);await pg.setInputFiles('#bkImport',IMP);await pg.waitForLoadState('load');await sleep(1600);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});fs.rmSync(IMP,{force:true})}
const NF=(()=>{const vm=require('vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('site/data.js','utf8'),ctx);return (ctx.window.FRAMES||[]).reduce((a,f)=>a+f.items.length,0)})();

// ---------- A. 沒有調整時和原本一樣；設定面板的新項目 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{const ws=WORDS.filter(x=>!x.b&&x.k<=5).slice(0,8).map(x=>x.w);ws.forEach(w=>{store.wordStatus[w]='known';store.reviewDue[w]=day(-1);store.wordKnown.push(w)});save();renderToday()});
const A=await E(()=>({plan:JSON.stringify(flowPlan()),cfg:'flowCfg' in store.settings,btn:$('#todayBody .flow-start').textContent,okk:JSON.stringify(flowCfgOk()),get:JSON.stringify(flowCfgGet())}));
ok('沒有調整過：今日學習和原本完全一樣（複習 8 → 新字 20 → 句子跟讀 → CE 情境題，約 12 分鐘）；新的「句型」「中翻英」預設都是 0（不做／關）',A.plan==='[{"k":"review","n":8},{"k":"new","n":20},{"k":"sent","n":5},{"k":"situ","n":1}]'&&!A.cfg&&/複習單字 8 → 學新單字 20 → 句子跟讀 → CE 情境題，約 12 分鐘/.test(A.btn)&&/"fr":\[0,5,10\]/.test(A.okk)&&/"zf":\[0,1\]/.test(A.okk)&&/"fr":0/.test(A.get)&&/"zf":0/.test(A.get),JSON.stringify(A));
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
const A2=await E(()=>{const row=k=>{const s=$(`#todayBody select[data-fc="${k}"]`);return s?{t:s.closest('.fcg-row').querySelector('span').textContent,v:s.value,o:[...s.options].map(o=>o.value+'='+o.textContent)}:null};return {sel:[...document.querySelectorAll('#todayBody select[data-fc]')].map(s=>s.dataset.fc+'='+s.value).join(','),fr:row('fr'),zf:row('zf'),est:$('#todayBody .fcg-est').textContent,zfn:!!$('#todayBody .fcg-zf')}});
await pg.click('#todayBody .fcg-btns [data-go="flowcfg"]');await sleep(200);
const A3=await E(()=>({cfg:'flowCfg' in store.settings,ls:JSON.parse(localStorage.getItem('english5000v5')).settings.flowCfg===undefined}));
ok('「⚙️ 調整今日學習」：句子跟讀下面多了「🧩 句型」（不做／5 句／10 句，預設不做），最後一列「句子練習用 🀄 中翻英」（關／開，預設關）；只看不改不會存任何設定',A2.sel==='rev=1,mr=0,new=20,ph=0,sent=5,fr=0,radio=0,situ=1,rp=0,zf=0'&&A2.fr&&A2.fr.t==='🧩 句型'&&JSON.stringify(A2.fr.o)===JSON.stringify(['0=不做','5=5 句','10=10 句'])&&A2.zf&&A2.zf.t==='句子練習用 🀄 中翻英'&&JSON.stringify(A2.zf.o)===JSON.stringify(['0=關','1=開'])&&/預估約 12 分鐘/.test(A2.est)&&!A2.zfn&&!A3.cfg&&A3.ls,JSON.stringify([A2,A3]));
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(200);
await pg.selectOption('#todayBody select[data-fc="fr"]','5');await sleep(150);
const A4=await E(()=>({cfg:JSON.stringify(store.settings.flowCfg),plan:flowPlan().map(s=>s.k+s.n).join(','),est:$('#todayBody .fcg-est').textContent,btn:$('#todayBody .flow-start').textContent,t:$('#todayBody .fcg-t').textContent,sec:flowSec('fr'),lab:JSON.stringify(flowLabel('fr'))}));
ok('選「🧩 句型 5 句」：排在句子跟讀後面（複習 8 → 新字 20 → 句子跟讀 → 句型 5 → CE 情境題）；每句約 40 秒，預估 12 → 15 分鐘；按鈕立刻更新、⚙️ 顯示 ●',A4.cfg==='{"fr":5}'&&A4.plan==='review8,new20,sent5,fr5,situ1'&&A4.sec===40&&A4.lab==='["🧩","句型","🎤 念對或按「✓ 我會說了」"]'&&/預估約 15 分鐘：複習單字 8 → 學新單字 20 → 句子跟讀 → 句型 5 → CE 情境題/.test(A4.est)&&/句子跟讀 → 句型 5 → CE 情境題，約 15 分鐘/.test(A4.btn)&&/●/.test(A4.t),JSON.stringify(A4));
await pg.selectOption('#todayBody select[data-fc="fr"]','10');await sleep(150);
const A5=await E(()=>({plan:flowPlan().map(s=>s.k+s.n).join(','),est:$('#todayBody .fcg-est').textContent}));
await pg.selectOption('#todayBody select[data-fc="fr"]','0');await sleep(150);
const A6=await E(()=>({cfg:'flowCfg' in store.settings,t:$('#todayBody .fcg-t').textContent}));
ok('選「10 句」：預估約 19 分鐘；改回「不做」刪除設定（和原本一樣，⚙️ 沒有 ●）',A5.plan==='review8,new20,sent5,fr10,situ1'&&/預估約 19 分鐘/.test(A5.est)&&!A6.cfg&&!/●/.test(A6.t),JSON.stringify([A5,A6]));
await pg.selectOption('#todayBody select[data-fc="zf"]','1');await sleep(150);
const A7=await E(()=>({cfg:JSON.stringify(store.settings.flowCfg),plan:flowPlan().map(s=>s.k+s.n).join(','),note:($('#todayBody .fcg-zf')||{}).textContent||'',btn:$('#todayBody .flow-start').textContent,t:$('#todayBody .fcg-t').textContent}));
ok('選「句子練習用 🀄 中翻英：開」：步驟和時間不變，預估時間下面說明「句子跟讀用看中文說英文練習，做完就換回原本的練習方式」；⚙️ 顯示 ●',A7.cfg==='{"zf":1}'&&A7.plan==='review8,new20,sent5,situ1'&&/🀄 句子跟讀：用「看中文說英文」練習，做完這一步就換回原本的練習方式/.test(A7.note)&&/約 12 分鐘/.test(A7.btn)&&/●/.test(A7.t),JSON.stringify(A7));
await pg.selectOption('#todayBody select[data-fc="fr"]','5');await sleep(150);
const A8=await E(()=>($('#todayBody .fcg-zf')||{}).textContent||'');
await pg.selectOption('#todayBody select[data-fc="sent"]','0');await pg.selectOption('#todayBody select[data-fc="fr"]','0');await sleep(150);
const A9=await E(()=>($('#todayBody .fcg-zf')||{}).textContent||'');
await pg.click('#todayBody .fcg-btns [data-go="flowreset"]');await sleep(200);
const A10=await E(()=>({cfg:'flowCfg' in store.settings,plan:flowPlan().map(s=>s.k+s.n).join(',')}));
ok('說明跟著設定變：句子跟讀＋句型都做時寫「句子跟讀、句型」；兩步都不做時說明「中翻英只用在句子跟讀和句型」；「恢復預設」全部回到原本',/🀄 句子跟讀、句型：用「看中文說英文」練習，做完這兩步就換回原本的練習方式/.test(A8)&&/中翻英只用在「句子跟讀」和「句型」，目前的設定沒有這兩步/.test(A9)&&!A10.cfg&&A10.plan==='review8,new20,sent5,situ1',JSON.stringify([A8,A9,A10]));
ok('A 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 「🧩 句型」步驟：練得最少的句型、計數、回到這一步 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);await setUnit(E,'ce');
/* 句型 1 已經會說 3 句、其他句型 🎤 念對過，只有句型 7 完全沒練過 */
await E(()=>{store.settings.hideKnown=false;$('#hideKnown').checked=false;['f:fr01:0','f:fr01:1','f:fr01:2'].forEach(id=>store.known.push(id));
 store.frSay={fr02:4,fr03:1,fr04:2,fr05:2,fr06:2,fr08:2,fr09:2,fr10:2,fr11:2,fr12:2};store.settings.flowCfg={rev:0,new:0,sent:0,situ:0,fr:5};save();page('today');renderToday()});
const B0=await E(()=>({plan:flowPlan().map(s=>s.k+s.n).join(','),btn:$('#todayBody .flow-start').textContent,stat:frStat().map(p=>p.id+':'+p.n+'/'+p.left).join(' ')}));
await pg.click('#todayBody .flow-start');await sleep(600);
const B1=await E(()=>({page:!$('.panel').hidden,u:$('#unit').value,unit:store.settings.unit,learn:store.settings.learnUnit,hk:$('#hideKnown').checked,hks:store.settings.hideKnown,all:pool.every(s=>s.frame==='fr07'),n:pool.length,box:!$('#frBox').hidden,sel:$('#frSel').value,src:cur().src,fu:FLOW.fu,bar:$('#flowBar').textContent}));
ok('今日學習只排「🧩 句型 5」：打開句子頁的句型替換，輪到練得最少的句型 7（會說了的句數＋🎤 念對次數都是 0；句型 1 會說了 3 句、其他句型念對過）',B0.plan==='fr5'&&/句型 5，約 3 分鐘/.test(B0.btn)&&B1.page&&B1.u==='fr07'&&B1.all&&B1.n===7&&B1.box&&B1.sel==='fr07'&&B1.src==='frame'&&B1.fu==='fr07'&&/今日學習 1／1/.test(B1.bar)&&/🧩 句型 0／5/.test(B1.bar)&&/🎤 念對或按「✓ 我會說了」/.test(B1.bar),JSON.stringify({B0,B1}));
ok('和句子跟讀一樣只看還沒會說的句子（打開「只看未會說」）；不改「句子跟讀」用的範圍（自己選的「精選・CE 工作」）',B1.hk&&B1.hks===true&&B1.learn==='ce'&&B1.unit==='fr07',JSON.stringify(B1));
await pg.click('#known');await sleep(1300);
let fb=await bar(pg);
const B2=await E(()=>({ids:todayLog().sentIds||[]}));
ok('句型的句子按「✓ 我會說了」：🧩 句型 1／5（每日紀錄記下句子編號）',/🧩 句型 1／5/.test(fb)&&B2.ids.some(x=>/^f:fr07:/.test(x)),JSON.stringify({fb,B2}));
let r=await say(pg);await sleep(1300);fb=await bar(pg);
const B3=await E(()=>({fsay:todayLog().fsay,say:store.frSay.fr07,ls:JSON.parse(localStorage.getItem('english5000v5')).frSay}));
ok('🎤 念對（90% 以上）：🧩 句型 2／5；每日紀錄 fsay＋1、這個句型的練習次數＋1（也存進手機）',r.score>=90&&/🧩 句型 2／5/.test(fb)&&B3.fsay===1&&B3.say===1&&B3.ls&&B3.ls.fr07===1,JSON.stringify({r,fb,B3}));
r=await speak(pg,'hello there');await sleep(1300);fb=await bar(pg);
ok('🎤 沒念對（低於 90%）：不算',r.score<90&&/🧩 句型 2／5/.test(fb),JSON.stringify({r,fb}));
const B4=await E(()=>{const f0=flowVal('fr',todayLog()),s0=flowVal('sent',todayLog());logMark('sent','c1',true);const f1=flowVal('fr',todayLog()),s1=flowVal('sent',todayLog());logMark('sent','c1',false);return {f0,f1,s0,s1}});
ok('不是句型的句子按「✓ 我會說了」：只算句子跟讀，不算句型',B4.f1===B4.f0&&B4.s1===B4.s0+1,JSON.stringify(B4));
/* 換去演 Role Play（句子頁換成對話），句型 7 也不再是練得最少的：回到這一步還是句型 7、同一句 */
const at=await E(()=>cur().id);
await E(()=>{store.frSay.fr07=50;save();rpStart(DLG_BY.d14,'B')});await sleep(500);
const B5a=await E(()=>({u:$('#unit').value,rp:RP.on}));
await pg.click('#flowBar [data-flow="go"]');await sleep(500);
const B5=await E(()=>({u:$('#unit').value,id:cur().id,rp:RP.on,page:!$('.panel').hidden}));
ok('換去做別的（Role Play）後按「回到這一步」：回到同一個句型、同一句（就算現在別的句型練得比較少）',B5a.rp&&B5a.u==='d14'&&!B5.rp&&B5.page&&B5.u==='fr07'&&B5.id===at,JSON.stringify([B5a,B5,at]));
await E(()=>frSwitch('fr02'));await sleep(300);
await pg.click('#navToday');await sleep(300);await pg.click('#flowBar [data-flow="go"]');await sleep(500);
const B6=await E(()=>({u:$('#unit').value}));
ok('自己在句型框換了別的句型（句型 2）：回到這一步時不會被換回去',B6.u==='fr02',JSON.stringify(B6));
for(let k=0;k<3;k++){await pg.click('#known');await sleep(350)}
await sleep(1100);fb=await bar(pg);
ok('做完 5 句：「🧩 句型 5／5 ✅」，最後一步按鈕「完成 ▶」',/🧩 句型 5／5 ✅/.test(fb)&&/完成 ▶/.test(fb),fb);
await pg.click('#flowBar [data-flow="next"]');await sleep(400);fb=await bar(pg);
const B7=await E(()=>({done:localStorage.getItem('e5k_flow_done')===day(),flow:todayLog().flow}));
ok('按「完成 ▶」：今天的學習完成了（記在每日紀錄，和其他步驟一樣）',/今天的學習完成了/.test(fb)&&B7.done&&B7.flow===1,JSON.stringify({fb,B7}));
await E(()=>flowEnd());
ok('B 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. 句型 10 句、全部會說了、沒有句型資料 ----------
{const {ctx,pg,errs,E}=await open();let r,fb;
await E(()=>{store.frSay={fr01:3,fr02:3,fr03:3,fr04:3,fr06:3,fr07:3,fr08:3,fr09:3,fr10:3,fr11:3,fr12:3};store.settings.flowCfg={rev:0,new:0,sent:0,situ:0,fr:10};save();renderToday()});
await pg.click('#todayBody .flow-start');await sleep(600);
const C1=await E(()=>({u:$('#unit').value,fr:cur().frame,first:pool.findIndex(s=>s.frame==='fr05')===i,n:pool.length,sel:$('#frSel').value,bar:$('#flowBar').textContent,fu:FLOW.fu,fr0:FLOW.fr}));
ok('「句型 10 句」：一個句型最多 8 句不夠，打開全部句型（🧩 句型替換），從練得最少的句型 5 的第一句開始',C1.u==='frame'&&C1.fr==='fr05'&&C1.first&&C1.n===NF&&C1.sel==='frame'&&C1.fu==='frame'&&C1.fr0==='fr05'&&/🧩 句型 0／10/.test(C1.bar),JSON.stringify(C1));
for(let k=0;k<6;k++){await pg.click('#next');await sleep(120)}
const C2=await E(()=>cur().frame);
ok('句型 5 的 6 句練完，接著是句型 6',C2==='fr06',C2);
await E(()=>{flowEnd();ALLS.filter(s=>s.src==='frame').forEach(s=>{if(!store.known.includes(s.id))store.known.push(s.id)});store.settings.hideKnown=true;$('#hideKnown').checked=true;store.settings.flowCfg={rev:0,new:0,sent:0,situ:0,fr:5};save();page('today');renderToday()});
await pg.click('#todayBody .flow-start');await sleep(600);
const C3=await E(()=>({u:$('#unit').value,hk:$('#hideKnown').checked,hks:store.settings.hideKnown,src:cur().src,n:pool.length,note:$('#unitNote').hidden?'':$('#unitNote').textContent,bar:$('#flowBar').textContent}));
ok('句型的句子都會說了：打開練得最少的句型 5、這次全部顯示（「只看未會說」設定不變），不會跳出「都已標記會說了」改顯示精選句子',C3.u==='fr05'&&!C3.hk&&C3.hks===true&&C3.src==='frame'&&C3.n===6&&!C3.note&&/🧩 句型 0／5/.test(C3.bar),JSON.stringify(C3));
r=await say(pg);await sleep(1300);fb=await bar(pg);
ok('都會說了也可以用 🎤 練：念對算 1 句（🧩 句型 1／5）',r.score>=90&&/🧩 句型 1／5/.test(fb),JSON.stringify({r,fb}));
await E(()=>flowEnd());
const C4=await E(()=>{const F0=window.FRAMES;window.FRAMES=[];store.settings.flowCfg={fr:5};const o={plan:flowPlan().map(s=>s.k).join(','),nothing:flowNothing('fr'),has:frHas(),pick:frPick(5)};FCG_OPEN=true;renderToday();o.row=!!$('#todayBody select[data-fc="fr"]');FCG_OPEN=false;window.FRAMES=F0;delete store.settings.flowCfg;save();renderToday();return o});
ok('沒有句型資料時：不顯示「🧩 句型」設定、不排這一步（不會卡住）',!/fr/.test(C4.plan)&&C4.nothing&&!C4.has&&C4.pick===null&&!C4.row,JSON.stringify(C4));
ok('C 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 句子跟讀 → 句型 的順序；之後的句子跟讀回到自己選的範圍 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navPractice');await sleep(200);await setUnit(E,'life');
await E(()=>{store.settings.flowCfg={rev:0,new:0,sent:5,fr:5,situ:0};save();page('today');renderToday()});
const D0=await E(()=>flowPlan().map(s=>s.k+s.n).join(','));
await pg.click('#todayBody .flow-start');await sleep(600);
const D1=await E(()=>({u:$('#unit').value,bar:$('#flowBar').textContent}));
await pg.click('#flowBar [data-flow="skip"]');await sleep(600);
const D2=await E(()=>({u:$('#unit').value,learn:store.settings.learnUnit,unit:store.settings.unit,bar:$('#flowBar').textContent}));
ok('順序：句子跟讀（自己選的「精選・生活」）→ 句型（今日學習 2／2，打開句型替換）',D0==='sent5,fr5'&&D1.u==='life'&&/今日學習 1／2/.test(D1.bar)&&/句子跟讀 0／5/.test(D1.bar)&&/^fr\d+$/.test(D2.u)&&D2.unit===D2.u&&D2.learn==='life'&&/今日學習 2／2/.test(D2.bar)&&/🧩 句型 0／5/.test(D2.bar),JSON.stringify([D0,D1,D2]));
await pg.click('#flowBar [data-flow="end"]');await sleep(300);
await pg.reload();await sleep(1300);
const D3=await E(()=>({u:$('#unit').value,learn:store.settings.learnUnit}));
await pg.click('#todayBody .flow-start');await sleep(600);
const D4=await E(()=>({u:$('#unit').value,bar:$('#flowBar').textContent,src:cur().src}));
ok('之後再做「句子跟讀」：句子頁停在今日學習打開的句型，但句子跟讀回到自己選的範圍（精選・生活），不會變成練句型',/^fr\d+$/.test(D3.u)&&D3.learn==='life'&&D4.u==='life'&&/句子跟讀 0／5/.test(D4.bar)&&D4.src==='core',JSON.stringify([D3,D4]));
await E(()=>flowEnd());
await pg.click('#navPractice');await sleep(200);await setUnit(E,'fr03');
await E(()=>{store.settings.flowCfg={rev:0,new:0,situ:0};save();page('today');renderToday()});
await pg.click('#todayBody .flow-start');await sleep(600);
const D5=await E(()=>({u:$('#unit').value,learn:store.settings.learnUnit,plan:FLOW.steps.map(s=>s.k).join(','),bar:$('#flowBar').textContent,src:cur().src}));
ok('沒有開新選項時和原本一樣：自己在單元選單選的句型（句型 3），今日學習的句子跟讀照樣用它',D5.u==='fr03'&&D5.learn==='fr03'&&D5.plan==='sent'&&/句子跟讀 0／5/.test(D5.bar)&&D5.src==='frame',JSON.stringify(D5));
await E(()=>flowEnd());
ok('D 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 「句子練習用 🀄 中翻英」 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>{store.settings.flowCfg={rev:0,new:0,sent:5,fr:5,situ:1};save();renderToday()});
await pg.click('#todayBody .flow-start');await sleep(600);
const E0=await zf(E);
ok('沒有開「中翻英」：今日學習的句子跟讀照原本「看英文跟讀」，不會改練習方式',!E0.on&&E0.tmp===undefined&&E0.seg==='true,false'&&!E0.cls&&/句子跟讀 0／5/.test(E0.bar),JSON.stringify(E0));
await E(()=>flowEnd());
await E(()=>{store.settings.flowCfg={rev:0,new:0,sent:5,fr:5,situ:1,zf:1};save();page('today');renderToday()});
await pg.click('#todayBody .flow-start');await sleep(600);
const E1=await zf(E);
ok('開了「句子練習用 🀄 中翻英」：今日學習打開句子跟讀時切到看中文說英文（英文先藏起來、切換鈕顯示 🀄 中翻英），記下暫存標記',E1.on&&E1.tmp===1&&E1.seg==='false,true'&&E1.cls&&E1.mask&&/句子跟讀 0／5/.test(E1.bar),JSON.stringify(E1));
await pg.click('#known');await sleep(1300);
const E2=await zf(E);
ok('看中文說英文時按「✓ 我會說了」照常計數（句子跟讀 1／5）',E2.on&&/句子跟讀 1／5/.test(E2.bar),JSON.stringify(E2));
await pg.reload();await sleep(1300);await pg.click('#flowBar [data-flow="go"]');await sleep(500);
const E3=await zf(E);
ok('做到一半重新開啟 App：還在句子跟讀這一步，仍是看中文說英文',E3.on&&E3.tmp===1&&E3.cls&&/今日學習 1／3/.test(E3.bar),JSON.stringify(E3));
await pg.click('#flowBar [data-flow="skip"]');await sleep(600);
const E4=await zf(E);
ok('下一步「🧩 句型」：也用看中文說英文',E4.on&&E4.tmp===1&&E4.cls&&/^fr\d+$/.test(E4.u)&&/🧩 句型 0／5/.test(E4.bar),JSON.stringify(E4));
await pg.click('#flowBar [data-flow="skip"]');await sleep(700);
const E5=await zf(E);
await pg.click('#navPractice');await sleep(300);
const E5b=await zf(E);
ok('離開這兩步（下一步 CE 情境題）：換回原本的「看英文跟讀」，設定和暫存標記都刪除（手機裡的存檔也一樣）',!E5.on&&E5.tmp===undefined&&!E5.ls&&/CE 情境題/.test(E5.bar)&&!E5b.cls&&E5b.seg==='true,false',JSON.stringify([E5,E5b]));
await pg.click('#flowBar [data-flow="end"]');await sleep(300);
/* 原本就是看中文說英文 */
await pg.click('#zfSeg [data-zf="1"]');await sleep(200);
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
const E6=await zf(E);
await pg.click('#flowBar [data-flow="end"]');await sleep(400);
const E7=await zf(E);
ok('原本就是「看中文說英文」：今日學習不用切換、不記暫存標記；結束後一樣是看中文說英文',E6.on&&E6.tmp===undefined&&E7.on&&E7.tmp===undefined&&E7.ls,JSON.stringify([E6,E7]));
await pg.click('#navPractice');await sleep(200);await pg.click('#zfSeg [data-zf="0"]');await sleep(200);
/* 進行中自己按「👂 跟讀」 */
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
const E8=await zf(E);
await pg.click('#zfSeg [data-zf="0"]');await sleep(300);
const E9=await zf(E);
await pg.click('#flowBar [data-flow="skip"]');await sleep(600);
const E10=await zf(E);
await pg.click('#flowBar [data-flow="end"]');await sleep(400);
const E11=await zf(E);
ok('今日學習進行中自己按「👂 跟讀」：以自己按的為準——下一步「句型」不再切換，結束後也維持看英文跟讀',E8.on&&E8.tmp===1&&!E9.on&&E9.tmp===undefined&&!E10.on&&/🧩 句型/.test(E10.bar)&&!E11.on&&!E11.ls,JSON.stringify([E8,E9,E10,E11]));
/* 進行中自己按「🀄 中翻英」 */
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
await pg.click('#zfSeg [data-zf="1"]');await sleep(300);
const E12=await zf(E);
await pg.click('#flowBar [data-flow="end"]');await sleep(400);
const E13=await zf(E);
ok('今日學習進行中自己按「🀄 中翻英」：結束後維持看中文說英文（以自己按的為準）',E12.on&&E12.tmp===undefined&&E13.on&&E13.ls,JSON.stringify([E12,E13]));
await pg.click('#zfSeg [data-zf="0"]');await sleep(200);
/* 按 ✕ 結束 */
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
const E14=await zf(E);
await pg.click('#flowBar [data-flow="end"]');await sleep(500);
const E15=await zf(E);
ok('在句子跟讀按 ✕ 結束今日學習：換回看英文跟讀',E14.on&&E14.tmp===1&&!E15.on&&E15.tmp===undefined&&!E15.ls,JSON.stringify([E14,E15]));
/* App 開著過了午夜 */
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
const E16=await zf(E);
await E(()=>{FLOW.day='2000-01-01'});await sleep(1600);
const E17=await zf(E);
ok('App 開著過了午夜（今日學習自動結束）：換回看英文跟讀',E16.on&&!E17.on&&E17.tmp===undefined&&!E17.bar,JSON.stringify([E16,E17]));
/* 做到一半關掉，隔天才打開 */
await pg.click('#navToday');await sleep(200);await pg.click('#todayBody .flow-start');await sleep(600);
const E18=await zf(E);
await E(()=>{const f=JSON.parse(localStorage.getItem('e5k_flow'));f.day='2000-01-01';localStorage.setItem('e5k_flow',JSON.stringify(f))});
await pg.reload();await sleep(1500);
const E19=await zf(E);
ok('今日學習做到一半關掉、隔天才打開：開啟時就換回看英文跟讀（存檔也一樣）',E18.on&&E18.tmp===1&&!E19.on&&E19.tmp===undefined&&!E19.ls,JSON.stringify([E18,E19]));
ok('E 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. 意思回想：今天回想過的字（重新開啟也記得、隔天清掉、不會越存越多） ----------
{const {ctx,pg,errs,E}=await open();
const W=await E(()=>WORDS.filter(x=>!x.b&&x.k===1&&/^[a-z]+$/.test(x.w)&&x.w.length>=3).slice(0,30).map(x=>x.w));
await E(W=>{store.reviewStage=store.reviewStage||{};W.forEach((w,k)=>{store.wordStatus[w]='known';store.reviewStage[w]=2;store.reviewDue[w]=day(5+k);store.wordKnown.push(w)});save()},W);
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(400);
const F0=await E(()=>cardPool.map(x=>x.w));
for(const g of ['known','learning','new'])await mrGrade(pg,g);
await sleep(400);
const F1=await E(()=>({t:store.mrToday,ls:JSON.parse(localStorage.getItem('english5000v5')).mrToday}));
ok('意思回想評分 3 張：今天回想過的字存在 store.mrToday（今天的日期＋這 3 個字），也存進手機',F0.length===20&&F1.t&&F1.t.d===iso(0)&&JSON.stringify(F1.t.w)===JSON.stringify(F0.slice(0,3))&&F1.ls&&JSON.stringify(F1.ls.w)===JSON.stringify(F0.slice(0,3)),JSON.stringify([F0.slice(0,3),F1]));
await pg.click('#navStats');await sleep(400);
const F1s=await E(()=>[...document.querySelectorAll('#statsBody .mr-st > div')].map(d=>d.querySelector('span').textContent+'='+d.querySelector('b').textContent));
ok('統計頁「🧠 意思回想」：今天 3、最近 7 天 3、意思不熟 2（按了 ◐ 和 ✗ 的字）',JSON.stringify(F1s)===JSON.stringify(['今天=3','最近 7 天=3','意思不熟=2']),JSON.stringify(F1s));
await pg.reload();await sleep(1300);
await pg.click('#navWords');await sleep(300);await pg.click('#meanStart');await sleep(400);
const F2=await E(()=>({pool:cardPool.map(x=>x.w),done:[...mrDone()]}));
ok('重新開啟 App 後還記得：「🧠 意思回想」先出今天還沒回想過的字（剛剛的 3 個不會又出現）',F2.done.length===3&&F0.slice(0,3).every(w=>F2.done.includes(w)&&!F2.pool.includes(w))&&F2.pool.length===20,JSON.stringify(F2));
await E(()=>{store.mrToday={d:day(-1),w:['apple','go']};save();flushSave()});
await pg.reload();await sleep(1300);
const F3=await E(()=>{const t=store.mrToday,done=[...mrDone()];save();flushSave();return {t,done,ls:'mrToday' in JSON.parse(localStorage.getItem('english5000v5'))}});
ok('隔天：昨天的清單在開啟時就清掉（下次存檔就不在手機裡），今天從頭開始',F3.t===undefined&&F3.done.length===0&&!F3.ls,JSON.stringify(F3));
const F4=await E(()=>{const d=mrDone();for(let k=0;k<650;k++)d.add('w'+k);mrTodaySave();return {n:store.mrToday.w.length,mem:mrDone().size,first:store.mrToday.w[0],last:store.mrToday.w[599],d:store.mrToday.d===day()}});
ok('只存今天的清單，而且最多 600 個字（保留最近的），不會越存越多',F4.n===600&&F4.mem===600&&F4.first==='w50'&&F4.last==='w649'&&F4.d,JSON.stringify(F4));
ok('F 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- G. 統計頁、每週摘要、今日頁「最近 7 天」 ----------
{const {ctx,pg,errs,E}=await open();
const W=await E(()=>WORDS.filter(x=>!x.b&&x.k===1).slice(0,2).map(x=>x.w).concat(WORDS.find(x=>x.b&&x.k!==7).w));
await E(([W,D])=>{store.dailyLog={[D[0]]:{mr:7,review:3},[D[3]]:{mr:5},[D[9]]:{mr:4,new:2}};store.studyDays=[D[0],D[3],D[9]];store.meanWeak={[W[0]]:{n:1,last:D[0],ok:0},[W[1]]:{n:2,last:D[3],ok:1},[W[2]]:{n:1,last:D[0],ok:0},zzqxv:{n:1,last:D[0],ok:0}};save()},[W,[0,1,2,3,4,5,6,7,8,9].map(k=>iso(-k))]);
await pg.click('#navStats');await sleep(400);
const G1=await E(()=>{const m=$('#statsBody .mr-st');return {h:($('#mrStat')||{}).textContent,cells:m?[...m.children].map(d=>d.querySelector('span').textContent+'='+d.querySelector('b').textContent):[],prev:($('#mrStat')||{}).previousElementSibling&&$('#mrStat').previousElementSibling.previousElementSibling&&$('#mrStat').previousElementSibling.previousElementSibling.textContent,last:[...document.querySelectorAll('#statsBody h3')].pop().textContent,txt:$('#statsBody').innerText}});
const G1w=await wkRowsOf(E);
const G1v=await E(()=>{store.settings.skipVar=false;renderStats();const r=[...document.querySelectorAll('#statsBody .mr-st > div')].map(d=>d.querySelector('span').textContent+'='+d.querySelector('b').textContent);delete store.settings.skipVar;renderStats();return r});
ok('統計頁「🧠 意思回想」（在單字複習答對率後面）：今天 7、最近 7 天 12（今天 7＋3 天前 5）、意思不熟 2 個（不存在的字不算；和單字頁一樣只學原形時不算詞形，取消只學原形時 3 個）',/🧠 意思回想/.test(G1.h)&&JSON.stringify(G1.cells)===JSON.stringify(['今天=7','最近 7 天=12','意思不熟=2'])&&/單字複習答對率/.test(G1.prev||'')&&JSON.stringify(G1v)===JSON.stringify(['今天=7','最近 7 天=12','意思不熟=3']),JSON.stringify([G1,G1v]).slice(0,600));
ok('每週摘要多一列「意思回想」（在複習單字後面）：最近 7 天 12 個 ▲、前 7 天 4 個',JSON.stringify(G1w['意思回想'])===JSON.stringify(['12 個 ▲','4 個'])&&Object.keys(G1w).indexOf('意思回想')===Object.keys(G1w).indexOf('複習單字')+1,JSON.stringify(G1w));
ok('統計頁最後一個標題仍是「💽 儲存空間」；畫面沒有 NaN／undefined',/儲存空間/.test(G1.last)&&!/NaN|undefined|Infinity/.test(G1.txt),G1.last);
await pg.click('#navToday');await sleep(300);
const G2=await E(()=>[...document.querySelectorAll('#todayBody .wk-chips span')].map(s=>s.textContent.trim()));
ok('今日頁「📅 最近 7 天」小卡：意思回想 12 ▲（排在複習後面）',G2.includes('意思回想 12 ▲')&&G2.indexOf('意思回想 12 ▲')===G2.findIndex(c=>/^複習 /.test(c))+1,JSON.stringify(G2));
await E(D=>{store.dailyLog={[D[0]]:{review:3},[D[9]]:{new:2}};delete store.meanWeak;save()},[0,1,2,3,4,5,6,7,8,9].map(k=>iso(-k)));
await pg.click('#navStats');await sleep(400);
const G3=await E(()=>({h:!!$('#mrStat'),cards:!!$('#statsBody .mr-st'),note:$('#mrStat')&&$('#mrStat').nextElementSibling.textContent}));
const G3w=await wkRowsOf(E);
await pg.click('#navToday');await sleep(300);
const G3c=await E(()=>[...document.querySelectorAll('#todayBody .wk-chips span')].map(s=>s.textContent.trim()));
ok('兩週都沒有意思回想：每週摘要不顯示這一列、今日頁小卡也沒有；統計頁說明怎麼開始（還沒有紀錄）',!('意思回想' in G3w)&&'複習單字' in G3w&&!G3c.some(c=>/意思回想/.test(c))&&G3.h&&!G3.cards&&/還沒有紀錄：在「單字」頁按「🧠 意思回想」/.test(G3.note),JSON.stringify([G3,G3w,G3c]));
await E(D=>{store.dailyLog={[D[0]]:{review:3},[D[9]]:{mr:4}};save()},[0,1,2,3,4,5,6,7,8,9].map(k=>iso(-k)));
await pg.click('#navStats');await sleep(400);
const G4=await E(()=>[...document.querySelectorAll('#statsBody .mr-st > div')].map(d=>d.querySelector('span').textContent+'='+d.querySelector('b').textContent));
const G4w=await wkRowsOf(E);
ok('只有前 7 天做過：每週摘要顯示「0 個 ▼／4 個」，統計頁三個數字都是 0',JSON.stringify(G4w['意思回想'])===JSON.stringify(['0 個 ▼','4 個'])&&JSON.stringify(G4)===JSON.stringify(['今天=0','最近 7 天=0','意思不熟=0']),JSON.stringify([G4,G4w]));
const G5=await E(()=>{store.dailyLog={};for(let k=0;k<60;k++)store.dailyLog[day(-k)]={mr:5,review:9,new:3,sent:2};store.meanWeak={};WORDS.slice(0,800).forEach(x=>{store.meanWeak[x.w]={n:1,last:day(),ok:0}});const t=performance.now();for(let k=0;k<20;k++){mrStatHtml();wkData();frPick(5)}return Math.round(performance.now()-t)});
ok('統計很快：意思回想統計＋每週資料＋挑句型（60 天紀錄、800 個意思不熟）各算 20 次 '+G5+' 毫秒（< 400）',G5<400,String(G5));
ok('G 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- H. 備份匯出 → 匯入：新欄位保留；被竄改的值整理掉 ----------
{const {ctx,pg,errs,E}=await open();
const H0=await E(()=>{store.settings.flowCfg={fr:10,zf:1};store.frSay={fr03:2,fr11:5};store.mrToday={d:day(),w:['go','open']};store.studyDays=[day()];store.wordStatus.go='known';save();return __canon({cfg:store.settings.flowCfg,say:store.frSay,mt:store.mrToday})});
await pg.click('#navStats');await sleep(300);
let [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
const H1=await E(x=>__canon({cfg:x.settings.flowCfg,say:x.frSay,mt:x.mrToday}),ex.progress);
await E(()=>{delete store.settings.flowCfg;delete store.frSay;delete store.mrToday;save()});
await imp(pg,ex);
const H2=await E(()=>({v:__canon({cfg:store.settings.flowCfg,say:store.frSay,mt:store.mrToday}),done:[...mrDone()].join(),btn:$('#todayBody .flow-start')?$('#todayBody .flow-start').textContent:''}));
ok('匯出的備份檔包含新欄位（今日學習的句型、中翻英設定、各句型 🎤 念對次數、今天回想過的字）；匯入後全部還原',H1===H0&&H2.v===H0&&H2.done==='go,open',JSON.stringify([H0,H1,H2]));
/* 今日學習暫時切到中翻英時匯出 */
await E(()=>{store.settings.zhFirst=true;store.settings.zfFlow=1;save()});
[dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bkExport')]);const ex2=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
await E(()=>{delete store.settings.zhFirst;delete store.settings.zfFlow;save()});
await imp(pg,ex2);
const H3=await E(()=>({on:store.settings.zhFirst===true,tmp:store.settings.zfFlow,ls:JSON.parse(localStorage.getItem('english5000v5')).settings}));
ok('今日學習暫時切到中翻英時匯出：備份檔記下暫存標記；匯入後（沒有進行中的今日學習）換回原本的看英文跟讀',ex2.progress.settings.zfFlow===1&&ex2.progress.settings.zhFirst===true&&!H3.on&&H3.tmp===undefined&&!H3.ls.zhFirst&&!('zfFlow' in H3.ls),JSON.stringify(H3).slice(0,300));
const X='<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const bad=JSON.parse(JSON.stringify(ex));bad.progress.settings.flowCfg={fr:7,zf:'1',[X]:1,sent:10};bad.progress.frSay={fr03:'5',fr99x:3,[X]:1,fr04:-2,fr05:2.7,fr06:'x'};bad.progress.mrToday={d:iso(0),w:['go',X,5,'go','open',{}]};bad.progress.settings.zfFlow='yes';
await imp(pg,bad);
for(const n of ['#navToday','#navStats','#navWords']){await pg.click(n);await sleep(300)}
const H4=await E(()=>({x:window.__xss||0,cfg:JSON.stringify(store.settings.flowCfg),say:__canon(store.frSay),mt:JSON.stringify(store.mrToday),zf:'zfFlow' in store.settings,proto:Object.getPrototypeOf(store.frSay)===Object.prototype}));
ok('匯入被竄改的備份檔：句型數量、中翻英設定、念對次數、今天回想過的字、暫存標記都整理成正確型別（不合法的丟掉），畫面不會執行任何程式碼',H4.x===0&&H4.cfg==='{"sent":10}'&&H4.say==='{"fr03":5,"fr05":2}'&&H4.proto&&H4.mt===JSON.stringify({d:iso(0),w:['go','open']})&&!H4.zf,JSON.stringify(H4));
const bad2=JSON.parse(JSON.stringify(ex));bad2.progress.mrToday={d:iso(-1),w:['go']};bad2.progress.frSay='x';bad2.progress.settings.flowCfg={fr:0,zf:0};
await imp(pg,bad2);
const H5=await E(()=>({mt:'mrToday' in store,say:'frSay' in store,cfg:JSON.stringify(store.settings.flowCfg)}));
ok('匯入昨天的「今天回想過的字」不會留下；念對次數格式錯誤整個丟掉；設定值 0 照原本保留（0＝不做／關）',!H5.mt&&!H5.say&&H5.cfg==='{"fr":0,"zf":0}',JSON.stringify(H5));
ok('H 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- I. 小手機（360×640）＋特大字＋深色模式：版面不會撐破、按鈕不會被擠扁 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
await E(()=>{store.settings.fontScale='1.3';applyFont();store.settings.theme='dark';applyTheme();
 store.dailyLog={[day()]:{new:12,review:30,sent:4,mr:9,quiz:9,qok:7,qng:2,rp:1,flow:1},[day(-9)]:{new:20,review:5,mr:3}};store.studyDays=[day(-9),day()];
 store.meanWeak={go:{n:1,last:day(),ok:0}};store.settings.flowCfg={rev:0,new:0,sent:5,fr:5,situ:0,zf:1};save();page('today');renderToday()});
await pg.click('#todayBody [data-go="flowcfg"]');await sleep(300);
const chk=(sel)=>E(sel=>{const vw=document.documentElement.clientWidth,out=[];for(const el of document.querySelectorAll(sel)){if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;const r=el.getBoundingClientRect();out.push({t:el.textContent.trim().slice(0,14),l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height),lines:__lines(el),c:__contrast(el)})}return {vw,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,out}},sel);
const I1=await E(()=>{const vw=document.documentElement.clientWidth;return [...document.querySelectorAll('#todayBody .fcg-row')].map(r=>{const s=r.querySelector('span'),q=r.querySelector('select'),a=q.getBoundingClientRect(),fs=parseFloat(getComputedStyle(q).fontSize);return {t:s.textContent,lines:__lines(s),sw:Math.round(a.width),sh:Math.round(a.height),sr:Math.round(a.right),ok:__lines(s)<=2&&a.width>=fs*4&&a.right<=vw&&a.height>=40&&__contrast(s)>=4.5&&__contrast(q)>=4.5}})});
ok('「調整今日學習」10 列（含 🧩 句型、句子練習用 🀄 中翻英）：名稱最多兩行、選單至少 4 個字寬、不超出畫面、高度至少 40px、深色對比足夠',I1.length===10&&I1.every(x=>x.ok)&&I1.some(x=>x.t==='🧩 句型')&&I1.some(x=>x.t==='句子練習用 🀄 中翻英'),JSON.stringify(I1));
const I2=await chk('#todayBody .fcg-zf, #todayBody .fcg-est, #todayBody .wk-chips span, #todayBody .flow-start');
ok('中翻英說明、預估時間、最近 7 天小卡（含意思回想）、開始按鈕：不超出畫面，深色模式文字清楚；沒有左右捲動',I2.ovw<=0&&I2.out.length>=6&&I2.out.every(x=>x.l>=0&&x.r<=I2.vw)&&I2.out.filter(x=>!/開始今天/.test(x.t)).every(x=>x.c>=4.5)&&I2.out.some(x=>/意思回想/.test(x.t)),JSON.stringify(I2).slice(0,600));
await pg.click('#todayBody .fcg-btns [data-go="flowcfg"]');await sleep(200);
await pg.click('#todayBody .flow-start');await sleep(600);
const fbm=()=>E(()=>{const bar=$('#flowBar'),t=bar.querySelector('.fb-t'),b=t.querySelector('b');const fs=parseFloat(getComputedStyle(b).fontSize);const sm=t.querySelector('small');return {h:Math.round(bar.getBoundingClientRect().height),vh:innerHeight,tw:Math.round(t.getBoundingClientRect().width),fs,bl:__lines(b),sl:sm?__lines(sm):0,btn:[...bar.querySelectorAll('button')].map(x=>x.textContent+':'+__lines(x)+':'+Math.round(x.getBoundingClientRect().height)),t:bar.textContent}});
const fbOk=m=>m.h<=m.vh*0.25&&m.tw>=m.fs*7&&m.bl<=2&&m.sl<=2&&m.btn.length>0&&m.btn.every(x=>/:1:(\d+)$/.test(x)&&+/:(\d+)$/.exec(x)[1]>=40);
const m1=await fbm();
await pg.click('#flowBar [data-flow="skip"]');await sleep(600);
const m2=await fbm();
const I3=await E(()=>{const vw=document.documentElement.clientWidth,fb=$('#frBox').getBoundingClientRect(),sg=$('#zfSeg').getBoundingClientRect();return {vw,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,box:!$('#frBox').hidden&&fb.right<=vw+0.5&&fb.left>=-0.5,seg:sg.right<=vw+0.5,zf:$('.sentence').classList.contains('zf-on')}});
ok('進度列「🧩 句型」：按鈕文字一行、高度至少 40px、說明最多兩行、不比句子跟讀那一步高、不超過畫面的 1/4；句子頁（句型框、看中文說英文）沒有左右捲動',fbOk(m1)&&fbOk(m2)&&m2.h<=m1.h+2&&/🧩 句型 0／5/.test(m2.t)&&/句子跟讀/.test(m1.t)&&I3.ovw<=0&&I3.box&&I3.seg&&I3.zf,JSON.stringify([m1,m2,I3]));
await E(()=>flowEnd());
await pg.click('#navStats');await sleep(500);
const I4=await E(()=>{const vw=document.documentElement.clientWidth,m=$('#statsBody .mr-st'),wr=m.getBoundingClientRect();const cells=[...m.children].map(d=>{const r=d.getBoundingClientRect(),b=d.querySelector('b'),s=d.querySelector('span');return {t:d.textContent,l:Math.round(r.left),r:Math.round(r.right),lb:__lines(b),ls:__lines(s),cb:__contrast(b),cs:__contrast(s)}});const p=m.nextElementSibling,h=$('#mrStat');return {vw,ovw:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,wr:Math.round(wr.right),cells,pc:__contrast(p),hc:__contrast(h),bg:getComputedStyle(m.firstElementChild).backgroundColor}});
ok('統計頁「🧠 意思回想」（小手機＋特大字＋深色）：三格都在畫面內、數字一行、說明最多兩行、深色對比足夠；沒有左右捲動',I4.ovw<=0&&I4.wr<=I4.vw&&I4.cells.length===3&&I4.cells.every(c=>c.l>=0&&c.r<=I4.vw&&c.lb===1&&c.ls<=2&&c.cb>=4.5&&c.cs>=4.5)&&I4.pc>=4.5&&I4.hc>=4.5&&I4.bg!=='rgb(244, 240, 255)',JSON.stringify(I4));
const I5=await E(()=>{const vw=document.documentElement.clientWidth,wk=document.querySelector('#statsBody .wk'),wr=wk.getBoundingClientRect(),rows=[...wk.children];const k=rows.findIndex(c=>c.textContent==='意思回想');return {k,in:rows.slice(k,k+3).every(c=>{const r=c.getBoundingClientRect();return r.right<=wr.right+0.5&&r.left>=wr.left-0.5}),wr:Math.round(wr.right),vw,c:rows.slice(k,k+3).map(__contrast)}});
ok('每週摘要的「意思回想」那一列在表格內、深色對比足夠',I5.k>0&&I5.in&&I5.wr<=I5.vw&&I5.c.every(c=>c>=4.5),JSON.stringify(I5));
ok('I 部分沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p32.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
