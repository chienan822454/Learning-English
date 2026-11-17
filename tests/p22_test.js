// V5.30.0：新增 10 段 CE 情境對話（d51–d60）與對話用到的 CE 專業字
const {serve,launch,sleep,R,ok,fs,dataCounts}=require('./common');const srv=serve(()=>'site',8891);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['microphone']});await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));
const E=(f,a)=>pg.evaluate(f,a);
await pg.goto('http://localhost:8891/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const DC=dataCounts();
const N=await E(()=>{const nd=DIALOGS.filter(d=>+d.id.slice(1)>50&&+d.id.slice(1)<=60);return {n:DIALOGS.length,nd:nd.length,ids:nd.map(d=>d.id).join(','),fmt:nd.every(d=>d.lines.length===12&&d.t&&d.te&&d.desc&&/（你）/.test(d.roles.B)&&d.lines.every(l=>(l.s==='A'||l.s==='B')&&l.en&&l.zh)),keys:nd.every(d=>d.keys.length>=5&&d.keys.length<=6&&d.keys.every(k=>d.lines.some(l=>l.en.includes(k.en)))),photo:nd.every(d=>d.lines.every(l=>!/photo|picture|camera|video/i.test(l.en))),dup:(()=>{const c={};DIALOGS.forEach(d=>d.lines.forEach(l=>c[l.en]=(c[l.en]||0)+1));return nd.reduce((s,d)=>s+d.lines.filter(l=>c[l.en]>1).length,0)})(),titles:nd.map(d=>d.t)}});
ok('情境對話 50 → '+N.n+' 段（新增 d51–d60），每段 12 句、B 是你的角色、中英文都有',N.n===DC.dn&&N.n>=60&&N.nd===10&&N.ids==='d51,d52,d53,d54,d55,d56,d57,d58,d59,d60'&&N.fmt,JSON.stringify({n:N.n,ids:N.ids}));
ok('新對話的重點句型都出現在對話裡（5–6 個）；沒有拍照內容；沒有和其他對話重複的句子',N.keys&&N.photo&&N.dup===0,JSON.stringify({keys:N.keys,photo:N.photo,dup:N.dup}));
ok('新對話主題：冷媒洩漏、機櫃熱點、客戶用電需求、標示不符、熱影像、預動式灑水、化學品洩漏、卸貨收貨、施工後驗收、事件後檢討',N.titles.length===10&&/冷媒/.test(N.titles[0])&&/過熱|熱點/.test(N.titles[1])&&/用電/.test(N.titles[2])&&/標示/.test(N.titles[3])&&/熱影像/.test(N.titles[4])&&/灑水/.test(N.titles[5])&&/洩漏/.test(N.titles[6])&&/收貨/.test(N.titles[7])&&/驗收|缺失/.test(N.titles[8])&&/檢討/.test(N.titles[9]),N.titles.join('、'));
// 對話頁
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');
const L=await E(()=>({cards:document.querySelectorAll('.dlg-card').length,stat:(document.querySelector('#dialogBody .word-stats')||{}).textContent||'',radio:!!document.querySelector('.radio-card')}));
ok('對話頁列出 '+DC.dn+' 個情境（共 '+DC.dl+' 句），無線電用語卡片仍在最上方',L.cards===DC.dn&&new RegExp('/ '+DC.dn).test(L.stat)&&new RegExp(String(DC.dl)).test(L.stat)&&L.radio,JSON.stringify(L));
await pg.click('.dlg-card[data-d="d51"]');await sleep(300);
const D1=await E(()=>({t:$('#dialogBody .dlg-title').textContent,lines:document.querySelectorAll('#dialogBody .dlg-line').length,keys:document.querySelectorAll('#dialogBody .dlg-key').length}));
await pg.click('#dialogBody .dlg-btns button[data-play="0"]');await sleep(150);
const said=await E(()=>window.__said.slice(-1)[0]),first=await E(()=>DLG_BY.d51.lines[0].en);
ok('打開新對話（d51）：12 句、重點句型都顯示，🔊 可以播放第一句',D1.lines===12&&D1.keys>=5&&said===first,JSON.stringify(D1));
// 句子頁
await E(()=>{const u=$('#unit');u.value='d55';u.onchange&&u.onchange()});await sleep(300);
const U=await E(()=>({opt:!!document.querySelector('#unit option[value="d60"]'),n:pool.length,src:pool.every(s=>s.dlg==='d55')}));
ok('句子頁可以選新對話（對話 51–60），每段 12 句可以跟讀',U.opt&&U.n===12&&U.src,JSON.stringify(U));
// Role Play
await E(()=>rpStart(DLG_BY.d57,'B'));await sleep(800);
const RPs=await E(()=>({on:RP.on,id:RP.d&&RP.d.id,me:RP.me,box:!$('#rpBox').hidden}));
await E(()=>rpOff());await sleep(200);
ok('新對話可以 Role Play（d57 化學品洩漏，我演 B）',RPs.on&&RPs.id==='d57'&&RPs.me==='B'&&RPs.box,JSON.stringify(RPs));
// CE 專業字
const C=await E(()=>{const nw=WORDS.filter(x=>x.k===7&&x.r>7627&&x.r<=7646);const z={};WORDS.filter(x=>x.k===7).forEach(x=>z[x.zh]=(z[x.zh]||0)+1);return {n:nw.length,all:WORDS.filter(x=>x.k===7).length,ok:nw.every(x=>x.p&&x.zh&&x.ex&&x.exz&&x.t&&x.t.length&&x.ce===1),acr:nw.filter(x=>x.acr).every(x=>/（[A-Za-z].+）/.test(x.zh)),dupZh:Object.values(z).filter(v=>v>1).length,list:nw.map(x=>x.w)}});
ok('新對話用到的 CE 專業字 +'+C.n+'（共 '+C.all+' 個）：都有音標、中文、例句、主題；縮寫附英文全名；中文不重複',C.n>=5&&C.ok&&C.acr&&C.dupZh===0,JSON.stringify(C).slice(0,300));
// 點字查詢：新對話裡的新 CE 字
const pick=await E(()=>{const nw=WORDS.filter(x=>x.k===7&&x.r>7627&&x.r<=7646&&!/[ -]/.test(x.w));for(const x of nw){for(const d of DIALOGS.filter(d=>+d.id.slice(1)>50&&+d.id.slice(1)<=60)){const l=d.lines.find(l=>new RegExp('\\b'+x.w+'\\b').test(l.en));if(l)return {w:x.w,d:d.id}}}return null});
let LK=null;
if(pick){await pg.click('#navDialogs');await sleep(200);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="'+pick.d+'"]');await sleep(300);
 const pt=await E(w=>{for(const el of document.querySelectorAll('.dlg-en')){const n=el.firstChild;if(!n||n.nodeType!==3)continue;const m=new RegExp('\\b'+w+'\\b').exec(n.data);if(!m)continue;el.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+w.length);const q=r.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}}return null},pick.w);
 if(pt){await pg.mouse.click(pt.x,pt.y);await sleep(250)}
 LK=await E(()=>{const p=document.querySelector('#lkPop');return p&&!p.hidden?{w:(p.querySelector('.lk-w b')||{}).textContent,zh:(p.querySelector('.lk-zh')||{}).textContent}:null})}
ok('新對話裡點新的 CE 字（'+(pick&&pick.w)+'）查得到中文',!!pick&&!!LK&&LK.w.toLowerCase()===pick.w.toLowerCase()&&!!LK.zh,JSON.stringify({pick,LK}));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p22.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
