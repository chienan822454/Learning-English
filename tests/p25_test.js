// V5.32.0：常用縮寫、點字查詢（人名地名、補充字典、序數、字母、編號）、句子關鍵字、多益長例句分檔
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8894);
const crypto=require('crypto');
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
async function open(vp,extra,route){const ctx=await b.newContext(Object.assign({viewport:vp||{width:390,height:844},permissions:['microphone']},extra||{}));await ctx.addInitScript(stub);if(route)await route(ctx);const pg=await ctx.newPage();const errs=[],reqs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('request',r=>{if(/data/.test(r.url()))reqs.push(r.url().replace(/^.*\//,''))});pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8894/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,reqs,E:(f,a)=>pg.evaluate(f,a)}}
async function tapWord(pg,sel,word){const p=await pg.evaluate(([sel,word])=>{for(const el of document.querySelectorAll(sel)){const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){if(n.parentElement.closest('small'))continue;const m=new RegExp('(^|[^A-Za-z])('+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z])').exec(n.data);if(m){el.scrollIntoView({block:'center'});const k=m.index+m[1].length;const r=document.createRange();r.setStart(n,k);r.setEnd(n,k+word.length);const q=r.getBoundingClientRect();return {x:q.left+Math.min(q.width/2,4),y:q.top+q.height/2}}}}return null},[sel,word]);if(p){await pg.mouse.click(p.x,p.y);await sleep(250)}return p}
const pop=pg=>pg.evaluate(()=>{const p=document.querySelector('#lkPop');if(!p||p.hidden)return null;return {w:(p.querySelector('.lk-w b')||{}).textContent||'',tag:(p.querySelector('.lk-tag')||{}).textContent||'',zh:(p.querySelector('.lk-zh')||{}).textContent||'',base:[...p.querySelectorAll('.lk-base')].map(x=>x.textContent).join('｜'),said:window.__said.slice(-1)[0]}});
const site=f=>fs.readFileSync('site/'+f);

// ---------- A. 版本、常用縮寫 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const A=await E(()=>{const L=['AC','DC','kV','CT','RH','CHW','SOC','HR','CEO','ID','PDF','USB','GPS','AI','MRT'];return {miss:L.filter(w=>!BY_WORD[w]),bad:L.filter(w=>{const x=BY_WORD[w];return !x||!x.acr||!x.p||!x.zh||!x.ex||!x.exz||!x.ex.includes(w)||(x.k===7)!==!!x.ce||(x.k===8)!==!!x.job}),n7:WORDS.filter(x=>x.k===7).length,n8:WORDS.filter(x=>x.k===8).length,ce:L.filter(w=>BY_WORD[w]&&BY_WORD[w].k===7).join(',')}});
ok('常用縮寫 +15 加進單字表：CE 專業字 7 個（AC、DC、kV、CT、RH、CHW、SOC）、職場英文 8 個（HR、CEO、ID、PDF、USB、GPS、AI、MRT），都有音標、中文、例句',A.miss.length===0&&A.bad.length===0&&A.n7===354&&A.n8===738&&A.ce==='AC,DC,kV,CT,RH,CHW,SOC',JSON.stringify(A));
const K=await E(()=>['UPS','HR','kV','CHW'].map(w=>phonKK(BY_WORD[w].p)).join(' '));
ok('縮寫的 KK 音標照字母念（HR、kV、CHW）',/ˋɑr/.test(K)&&/ˋvi/.test(K)&&/ˋdʌbəlju/.test(K),K);
// ---------- B. 點字查詢 ----------
const T=await E(()=>{const f=(w,p,n)=>{const r=lkFind(w,p||null,n||null);return !r?'—':r.extra?[r.extra.tag||'',r.extra.w,r.extra.zh].join('|'):r.x?(r.base?r.base.w:r.x.w):'parts'};
 return {HR:f('HR'),CTs:f('CTs'),IDs:f('IDs'),gent:f('gentlemen'),tp:f('Taipei'),ny:f('York','New'),chen:f('Chen'),tony:f("Tony's"),fl:f('flickering'),loaf:f('loaves'),su:f("startup's"),t10:f('tenth'),t20:f('twentieth'),B:f('B'),code:f('FM-4410'),nt:f('NT'),uk:f('UK'),comm:f('comm')}});
ok('點字查詢找得到新縮寫與詞形：HR、CTs→CT、IDs→ID、gentlemen→gentleman',T.HR==='HR'&&T.CTs==='CT'&&T.IDs==='ID'&&T.gent==='gentleman',JSON.stringify(T));
ok('人名地名：Taipei→地名 台北、New York→紐約、Chen→姓氏 陳、Tony\'s→人名、UK→英國',/^地名\|Taipei\|台北/.test(T.tp)&&/^地名\|New York\|紐約/.test(T.ny)&&/^姓氏\|Chen\|.*陳/.test(T.chen)&&/^人名\|Tony\|/.test(T.tony)&&/^地名\|UK\|英國/.test(T.uk),JSON.stringify([T.tp,T.ny,T.chen,T.tony,T.uk]));
ok('補充字典：flickering→flicker、loaves→loaf、startup\'s→startup、comm（通訊）',/^補充字\|flicker\|閃爍/.test(T.fl)&&/^補充字\|loaf\|/.test(T.loaf)&&/^補充字\|startup\|/.test(T.su)&&/^補充字\|comm\|通訊/.test(T.comm),JSON.stringify([T.fl,T.loaf,T.su,T.comm]));
ok('序數（tenth 第十、twentieth 第二十）、字母代號（B：無線電念 Bravo）、編號（FM-4410）、NT$ 新台幣',/^序數\|tenth\|第十（ten/.test(T.t10)&&/^序數\|twentieth\|第二十/.test(T.t20)&&/^字母\|B\|.*Bravo/.test(T.B)&&/^編號\|FM-4410\|/.test(T.code)&&/新台幣/.test(T.nt),JSON.stringify([T.t10,T.t20,T.B,T.code,T.nt]));
// 句子頁實際點字
await pg.click('#navPractice');await sleep(300);
const sid=await E(()=>{const s=ALLS.find(s=>/\bTaipei\b/.test(s.en)&&/^w/.test(s.id))||ALLS.find(s=>/\bTaipei\b/.test(s.en));pool=[s];i=0;render();return s.en});
await tapWord(pg,'#english','Taipei');let P=await pop(pg);
ok('句子頁點「Taipei」：顯示「地名」標籤和「台北」，並念出 Taipei',P&&P.w==='Taipei'&&P.tag==='地名'&&/台北/.test(P.zh)&&P.said==='Taipei',JSON.stringify({sid,P}));
await pg.keyboard.press('Escape');await sleep(100);
await E(()=>{const s=ALLS.find(s=>/\bflickering\b/.test(s.en));pool=[s];i=0;render()});
await tapWord(pg,'#english','flickering');P=await pop(pg);
ok('點「flickering」（單字表沒有的字）：顯示補充字 flicker 的意思、詞性，說明你點的是 flickering，並念出 flickering',P&&P.w==='flicker'&&P.tag==='補充字'&&/閃爍/.test(P.zh)&&/flickering/.test(P.base)&&P.said==='flickering',JSON.stringify(P));
await pg.keyboard.press('Escape');
// ---------- C. 全部句子都查得到 ----------
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});
const M=await E(()=>{const miss={};let n=0;const re=/[A-Za-z][A-Za-z0-9'’.\-]*[A-Za-z0-9]|[A-Za-z]/g;for(const s of ALLS){const t=String(s.en||''),tk=t.match(re)||[];for(let k=0;k<tk.length;k++){let w=tk[k];if(!/^(a\.m\.|p\.m\.)$/i.test(w))w=w.replace(/\.+$/,'');if(!w)continue;n++;if(!lkFind(w,tk[k-1],tk[k+1]))miss[w]=(miss[w]||0)+1}}return {n,miss:Object.keys(miss)}});
ok('全部句子（含對話、無線電、多益長例句）的每個英文字，點了都查得到意思（人名地名、代號也有說明）',M.n>70000&&M.miss.length===0,JSON.stringify({n:M.n,miss:M.miss.slice(0,20)}));
// ---------- D. 關鍵字 ----------
const KW=await E(()=>{const d=ALLS.filter(s=>s.src==='dialog'),r=ALLS.filter(s=>s.src==='radio');const kn=s=>s.keys.filter(k=>WMAP[k]||KX[k]).length===s.keys.length;
 return {d:d.length,dk:d.filter(s=>s.keys.length).length,r:r.length,rk:r.filter(s=>s.keys.length).length,allKnown:d.concat(r).every(kn),dup:d.filter(s=>s.keys.length===2&&(' '+s.keys[1].toLowerCase()+' ').includes(' '+s.keys[0].toLowerCase()+' ')).length,mop:(r.find(s=>/MOP/.test(s.en))||{}).keys}});
ok('對話句與無線電句補上「③ 關鍵字」：對話句 95% 以上、無線電句 29/30 有關鍵字；關鍵字都查得到中文；MOP 不會變成 mop（拖把）',KW.dk/KW.d>=0.95&&KW.rk>=29&&KW.allKnown&&KW.dup===0&&KW.mop&&KW.mop.includes('MOP'),JSON.stringify(KW));
await pg.click('#navPractice');await sleep(200);
const S=await E(()=>{const s=ALLS.find(s=>s.id==='r:3');pool=[s];i=0;render();const kw=$('#keywords');return {hid:kw.hidden,t:kw.textContent}});
ok('句子頁：無線電句「Say again, please…」的關鍵字顯示「Say again」和「無線電用語 請再說一次」',!S.hid&&/Say again/.test(S.t)&&/無線電用語/.test(S.t)&&/再說一次/.test(S.t),JSON.stringify(S));
const S2=await E(()=>{const s=ALLS.find(s=>s.src==='dialog'&&/technical support/.test(s.en));pool=[s];i=0;render();const kw=$('#keywords');return {hid:kw.hidden,t:kw.textContent,keys:s.keys}});
ok('句子頁：原本沒有關鍵字的對話句（technical support）現在顯示關鍵字和中文',!S2.hid&&S2.keys.length>0&&S2.t.length>3,JSON.stringify(S2));
ok('縮寫、查詢、關鍵字測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 多益長例句分檔 ----------
{const ex=site('data-ex.js').toString(),ex2=site('data-ex2.js').toString(),sw=site('sw.js').toString();
const h=f=>crypto.createHash('sha1').update(site(f)).digest('hex').slice(0,12);
ok('多益長例句移到 data-ex2.js：data-ex.js 變小（不含長例句），兩個檔的 SHA-1 都登記在離線快取清單',!/WORD_EX2/.test(ex)&&/window\.WORD_EX2=/.test(ex2)&&sw.includes("'data-ex.js':'"+h('data-ex.js')+"'")&&sw.includes("'data-ex2.js':'"+h('data-ex2.js')+"'")&&sw.includes("'data.js':'"+h('data.js')+"'"),JSON.stringify({ex:ex.length,ex2:ex2.length}));
const {ctx,pg,errs,reqs,E}=await open();
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});
const X=await E(()=>({n:ALLS.filter(s=>s.src==='word2').length,lab:$('#unit option[value="wt2"]').textContent,media:!!(BY_WORD.media&&BY_WORD.media.ex2),every:$('#unit option[value="every"]').textContent}));
const ia=reqs.indexOf('data-ex.js'),ib=reqs.indexOf('data-ex2.js');
ok('開啟順序：先載入單字例句（data-ex.js），之後才下載多益長例句（data-ex2.js）；長例句 1247 句都補進句子清單',ia>=0&&ib>ia&&X.n===1247&&/1247/.test(X.lab)&&X.media,JSON.stringify({reqs,X}));
ok('分檔測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// 長例句下載較慢時選「📖 多益長例句」：先顯示載入中，下載完自動出現句子
{const {ctx,pg,errs,E}=await open(null,{serviceWorkers:'block'},async c=>{await c.route('**/data-ex2.js*',async r=>{await new Promise(z=>setTimeout(z,3500));await r.continue()})});
await pg.click('#navPractice');await sleep(200);
await E(()=>{$('#unit').value='wt2';$('#unit').dispatchEvent(new Event('change'))});await sleep(300);
const before=await E(()=>({ready:EX2_READY,lab:$('#unit option[value="wt2"]').textContent}));
await pg.waitForFunction(()=>EX2_READY,null,{timeout:20000}).catch(()=>{});await sleep(400);
const after=await E(()=>({prog:$('#progress').textContent,en:$('#english').textContent,src:cur().src}));
ok('長例句還在下載時選「📖 多益長例句」：顯示（載入中），下載完自動顯示第一句',!before.ready&&/載入中/.test(before.lab)&&after.src==='word2'&&/多益長例句 1 \/ 1247/.test(after.prog),JSON.stringify({before,after}));
ok('慢速下載測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// 長例句下載失敗：顯示下載失敗，其他功能照常
{const {ctx,pg,errs,E}=await open(null,{serviceWorkers:'block'},async c=>{await c.route('**/data-ex2.js*',r=>r.abort())});
await pg.waitForFunction(()=>EX2_FAIL,null,{timeout:20000}).catch(()=>{});
const F=await E(()=>({fail:EX2_FAIL,lab:$('#unit option[value="wt2"]').textContent,ex:EX_READY,w:ALLS.filter(s=>s.src==='word').length}));
ok('長例句下載失敗（重試 3 次後）：選單顯示（下載失敗），單字例句照常可以用',F.fail&&/下載失敗/.test(F.lab)&&F.ex&&F.w>5000,JSON.stringify(F));
ok('下載失敗測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p25.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
