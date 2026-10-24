// V5.28.0：速度（每日自動備份、單字清單局部更新）、Role Play 接續、按鈕放大、片語填空支援變化形；內容改寫（情境題、例句、同義字中文、音標）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8889);
(async()=>{const b=await launch();
const stub=()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}};
async function open(vp){const ctx=await b.newContext({viewport:vp||{width:390,height:844},permissions:['microphone']});await ctx.addInitScript(stub);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept().catch(()=>{}));await pg.goto('http://localhost:8889/');await sleep(900);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});return {ctx,pg,errs,E:(f,a)=>pg.evaluate(f,a)}}

// ---------- A. 每日自動備份 ----------
{const {ctx,pg,errs,E}=await open();
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
// 大量紀錄＋舊格式的 2 份備份
await E(()=>{const s=JSON.parse(localStorage.getItem('english5000v5'));const base=WORDS.filter(x=>!x.b&&x.k<=5).map(x=>x.w);s.wordKnown=base.slice(0,3000);s.wordStatus={};base.slice(0,3000).forEach(w=>s.wordStatus[w]='known');s.reviewDue={};base.slice(0,3000).forEach((w,i)=>s.reviewDue[w]='2026-12-0'+(1+i%9));
 localStorage.setItem('english5000v5',JSON.stringify(s));
 localStorage.setItem('english5000v5_snaps',JSON.stringify([{date:'2026-01-02',savedAt:'',version:'5.27.2',progress:s},{date:'2026-01-01',savedAt:'',version:'5.27.2',progress:{wordKnown:['apple']}}]));
 localStorage.setItem('english5000v5_snaps_date','2026-01-02');Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')||k==='english5000v5_snaps_idx').forEach(k=>localStorage.removeItem(k))});
await pg.reload();await sleep(1200);
const S=await E(()=>{const t=todayStr();const keys=Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap_')).sort();return {old:localStorage.getItem('english5000v5_snaps'),keys,meta:snapMeta().map(x=>x.date),today:t,sameRaw:localStorage.getItem('english5000v5_snap_'+t)!==null&&JSON.parse(localStorage.getItem('english5000v5_snap_'+t)).wordKnown.length===3000,sum:(snapMeta()[0]||{}).summary}});
ok('每日自動備份改為每天一個鍵：舊格式自動轉換，今天的備份直接存開啟時的原始紀錄（3000 個已熟單字）',S.old===null&&S.keys.length===3&&S.meta[0]===S.today&&S.meta.includes('2026-01-01')&&S.sameRaw&&S.sum&&S.sum.wordKnown>=3000,JSON.stringify({keys:S.keys,meta:S.meta,sum:S.sum}));
const T=await E(()=>{localStorage.setItem('english5000v5_snaps_date','2000-01-01');const t=todayStr();localStorage.removeItem('english5000v5_snap_'+t);localStorage.setItem('english5000v5_snaps_idx',JSON.stringify(snapMeta().filter(x=>x.date!==t)));
 const raw=localStorage.getItem('english5000v5');let big=0;const P=JSON.parse,St=JSON.stringify;JSON.parse=function(x){if(typeof x==='string'&&x.length>20000)big++;return P.apply(JSON,arguments)};JSON.stringify=function(){const r=St.apply(JSON,arguments);if(typeof r==='string'&&r.length>20000)big++;return r};
 const t0=performance.now();takeSnapshot(raw,store);const ms=performance.now()-t0;JSON.parse=P;JSON.stringify=St;return {ms:Math.round(ms),big,has:localStorage.getItem('english5000v5_snap_'+t)===raw,n:snapMeta().length}});
ok('每天第一次開啟的自動備份不再解析、重新產生完整備份（大型字串處理 0 次）',T.big===0&&T.has&&T.n===3,JSON.stringify(T));
await pg.click('#navStats');await sleep(400);
const RB=await E(()=>[...document.querySelectorAll('#backupBody [data-snap]')].length);
await E(()=>{const btn=document.querySelectorAll('#backupBody [data-snap]')[2];btn&&btn.click()});await pg.waitForLoadState('load');await sleep(1500);
const RS=await E(()=>JSON.parse(localStorage.getItem('english5000v5')).wordKnown.join());
ok('統計頁列出 3 份自動備份，還原最舊的一份（舊格式轉換過來的）正確',RB===3&&RS==='apple',RB+' 份｜還原後 '+RS);
ok('自動備份測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- B. 單字清單局部更新 ----------
{const {ctx,pg,errs,E}=await open();
await pg.click('#navWords');await sleep(400);
const W0=await E(()=>{const c=document.querySelectorAll('#wordRows .word-card');c[1].dataset.mark='keep';c[5].dataset.mark='keep';return {n:c.length,fav:+$('#wordFavN').textContent,w:c[0].dataset.w}});
await pg.click('#wordRows .word-card >> nth=0 >> [data-act="fav"]');await sleep(200);
const W1=await E(w=>{const c=[...document.querySelectorAll('#wordRows .word-card')];return {n:c.length,kept:c.filter(x=>x.dataset.mark==='keep').length,star:c[0].querySelector('[data-act="fav"]').textContent,fav:+$('#wordFavN').textContent,isFav:store.wordFav.includes(w)}},W0.w);
ok('按 ☆ 只更新那一張卡（其他卡沒有重畫），星號與「收藏」數字跟著變',W1.n===W0.n&&W1.kept===2&&W1.star==='★'&&W1.fav===W0.fav+1&&W1.isFav,JSON.stringify([W0,W1]));
await pg.click('#wordRows .word-card >> nth=0 >> [data-act="known"]');await sleep(200);
const W2=await E(w=>({kept:[...document.querySelectorAll('#wordRows .word-card')].filter(x=>x.dataset.mark==='keep').length,cls:document.querySelector('#wordRows .word-card').className,st:statusOf(w),kn:+$('#wordKnownN').textContent}),W0.w);
ok('按 ○ 標記已熟：只更新那一張卡，「已熟」數字跟著變',W2.kept===2&&/status-known/.test(W2.cls)&&W2.st==='known'&&W2.kn>=1,JSON.stringify(W2));
await pg.click('#wordMore');await sleep(300);
const W3=await E(()=>({n:document.querySelectorAll('#wordRows .word-card').length,kept:[...document.querySelectorAll('#wordRows .word-card')].filter(x=>x.dataset.mark==='keep').length,more:!$('#wordMore').hidden,same:[...document.querySelectorAll('#wordRows .word-card')].map(x=>x.dataset.w).join()===_wl.slice(0,160).map(x=>x.w).join()}));
ok('「顯示更多」只加上新的 100 張卡（原本的卡沒有重畫），順序正確',W3.n===160&&W3.kept===2&&W3.same,JSON.stringify(W3));
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(300);
const W4a=await E(()=>document.querySelectorAll('#wordRows .word-card').length);
await pg.click('#wordRows .word-card >> nth=0 >> [data-act="fav"]');await sleep(300);
const W4=await E(()=>({n:document.querySelectorAll('#wordRows .word-card').length,cnt:$('#wordCount').textContent}));
ok('篩選「收藏」時取消收藏：那張卡從清單移除（整個清單重新整理）',W4a===1&&W4.n===0&&W4.cnt==='0',W4a+' → '+JSON.stringify(W4));
await pg.click('#wordPage .word-stats [data-st="fav"]');await sleep(200);
ok('單字清單測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- C. Role Play 接續 ----------
{const {ctx,pg,errs,E}=await open();
await E(()=>rpStart(DLG_BY.d02,'B'));await sleep(800);await E(()=>{clearTimeout(RP.autoT);rpNav(1)});await sleep(800);
const n1=await E(()=>RP.n);
await pg.click('#navWords');await sleep(300);
await pg.click('#navDialogs');await sleep(400);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await sleep(200);
const ban=await E(()=>{const r=document.querySelector('#dialogBody .rp-resume');return r?r.textContent:''});
ok('切到其他頁後，對話頁最上方顯示「上次的 Role Play」與「繼續」（第 2／6 句）',/上次的 Role Play/.test(ban)&&/第 2／6 句/.test(ban),ban.slice(0,60));
await pg.click('#dialogBody [data-rpresume]');await sleep(900);
const R1=await E(()=>({on:RP.on,n:RP.n,id:RP.d&&RP.d.id,page:!$('.panel').hidden||!$('#rpBox').hidden,res:$('#result').textContent}));
ok('按「繼續」：回到同一段對話的同一句',R1.on&&R1.n===n1&&R1.id==='d02'&&/繼續上次的 Role Play/.test(R1.res),JSON.stringify(R1));
await pg.click('#navToday');await sleep(300);
await pg.reload();await sleep(1200);
const tk=await E(()=>{const t=[...document.querySelectorAll('#todayBody .task')].find(x=>/Role Play/.test(x.textContent));return t?t.textContent:''});
ok('關掉 App 再打開：今日頁的 Role Play 任務顯示「繼續」',/繼續：/.test(tk)&&/第 2／6 句/.test(tk),tk.slice(0,70));
await pg.click('#todayBody [data-go="rpres"]');await sleep(900);
const R2=await E(()=>({on:RP.on,n:RP.n}));
ok('從今日頁按「繼續」也回到同一句',R2.on&&R2.n===n1,JSON.stringify(R2));
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await sleep(200);await pg.click('.dlg-card[data-d="d02"]');await sleep(300);
const dbtn=await E(()=>{const x=$('#dlgRpRes');return x?x.textContent:''});
ok('情境頁也有「▶ 繼續上次的 Role Play」按鈕',/繼續上次的 Role Play/.test(dbtn)&&/第 2／6 句/.test(dbtn),dbtn);
await pg.click('#dlgRpRes');await sleep(800);await pg.click('#rpEnd');await sleep(400);
const after=await E(()=>({ban:!!document.querySelector('#dialogBody .rp-resume'),btn:!!$('#dlgRpRes'),ls:localStorage.getItem('e5k_rp_resume')}));
ok('主動按「✕ 結束」：不再顯示「繼續」',!after.btn&&after.ls===null,JSON.stringify(after));
await E(()=>rpStart(DLG_BY.d03,'B'));await sleep(600);
for(let k=0;k<8;k++){const fin=await E(()=>RP.fin);if(fin)break;await E(()=>{clearTimeout(RP.autoT);rpNav(1)});await sleep(500)}
const fin=await E(()=>({fin:RP.fin,ls:localStorage.getItem('e5k_rp_resume')}));
ok('演完整段：不再顯示「繼續」',fin.fin&&fin.ls===null,JSON.stringify(fin));
ok('Role Play 接續測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- D. 按鈕放大 ----------
{const {ctx,pg,errs,E}=await open({width:360,height:640});
const sz=sel=>E(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]},sel);
await pg.click('#navWords');await sleep(400);
/* V5.29.0：只學原形等選項收進「篩選」，先展開再量 */
await pg.click('#wfToggle');await sleep(150);
const wa=await sz('#wordRows .word-card .wc-head .word-actions button'),ex=await sz('#wordRows .word-card .ex-btns button'),chip=await sz('#bookChips button'),st=await sz('#wordPage .word-stats button'),sk=await sz('#wordPage .skipv');
const ovw=await E(()=>document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth);
// 看不到的延伸範圍：按到按鈕外面一點點（上下 4–5px、左右 5px）也算按到這個按鈕
const hit=(sel,pts)=>E(([s,pts])=>{const e=document.querySelector(s);if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return pts.map(([fx,dx,fy,dy])=>{const t=document.elementFromPoint(r.left+r.width*fx+dx,r.top+r.height*fy+dy);return !!t&&(t===e||e.contains(t))})},[sel,pts]);
const UD=[[.5,0,0,-4],[.5,0,1,4]],LR=[[0,-5,.5,0],[1,5,.5,0]];
const hWord=await hit('#wordRows .word-card .wc-head .word-actions button[data-act="fav"]',UD),hEx=await hit('#wordRows .word-card .ex-btns button',LR),hRel=await hit('#wordRows .word-card .rel a',[[.5,0,0,-3],[.5,0,1,3]]);
const cardH=await E(()=>{const c=[...document.querySelectorAll('#wordRows .word-card')].slice(0,40).map(e=>e.getBoundingClientRect().height);return Math.round(c.reduce((a,b)=>a+b,0)/c.length)});
await pg.click('#navDialogs');await sleep(300);if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d02"]');await sleep(300);
const dl=await sz('#dialogBody .dlg-btns button'),dk=await sz('#dialogBody .dlg-key button'),mini=await sz('#dlgBack');
const hDlg=await hit('#dialogBody .dlg-btns button',[[.5,0,0,-3],[0,-2,.5,0],[1,2,.5,0]]);
await E(()=>rpStart(DLG_BY.d02,'B'));await sleep(700);
const lv=await sz('#rpLevel'),hk=await sz('#rpBox .rp-auto');
await E(()=>{rpOff();store.wrongWords={apple:2};save();openWrongBook()});await sleep(300);
const wb=await sz('#wrongBody [data-wbdel]');
const S={wordBtn:wa,exBtn:ex,chip,stat:st,skipv:sk,dlgLine:dl,dlgKey:dk,mini,rpLevel:lv,rpAuto:hk,wbDel:wb};
const okSz=(v,w,h)=>v&&v[0]>=w&&v[1]>=h;
ok('常用的小按鈕都放大（單字卡 🔊🐢☆○ 至少 35×34、例句 💬 與對話 🔊🐢 至少 36×34，原本約 34×28；選單與勾選至少 36 高）',okSz(wa,35,34)&&okSz(ex,36,34)&&okSz(dl,36,34)&&okSz(dk,44,38)&&okSz(chip,0,38)&&okSz(st,0,38)&&okSz(sk,0,36)&&okSz(mini,0,36)&&okSz(lv,0,40)&&okSz(hk,0,36)&&okSz(wb,40,36),JSON.stringify(S));
const allT=a=>Array.isArray(a)&&a.length>0&&a.every(Boolean);
ok('按得到的範圍比按鈕大（單字卡按鈕上下各多 4px 以上、💬 左右各多 5px、相關字連結上下多 3px、對話按鈕上方與左右）',allT(hWord)&&allT(hEx)&&allT(hDlg)&&(hRel===null||allT(hRel)),JSON.stringify({hWord,hEx,hRel,hDlg}));
ok('按鈕放大後單字卡沒有變高（小手機平均 ≤ 152px；V5.27.2 約 151px）',cardH<=152,String(cardH));
ok('按鈕放大後，小手機（360 寬）單字頁沒有左右捲動',ovw<=0,String(ovw));
ok('按鈕放大測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- E. 片語填空 ----------
{const {ctx,pg,errs,E}=await open();
const PQ=await E(()=>{const all=PHRASES.filter(x=>phraseRe(x.p).test(x.ex)).length;const old=PHRASES.filter(x=>new RegExp('\\b'+x.p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(x.ex)).length;
 const ex={};[3,7,36,48,103,159].forEach(id=>{const x=PHRASES[id-1];ex[x.p]=(x.ex.match(phraseRe(x.p))||[''])[0]});return {all,old,n:PHRASES.length,ex}});
ok('片語填空：例句用變化形或中間插入受詞的片語也能出題（'+PQ.old+' → '+PQ.all+' / '+PQ.n+'）',PQ.all===PQ.n&&PQ.all>PQ.old&&PQ.ex['look for']==='looking for'&&PQ.ex['pick up']==='pick you up'&&PQ.ex['make sense']==='makes sense'&&PQ.ex['fill someone in']==='fill me in',JSON.stringify(PQ));
await pg.click('#navQuiz');await sleep(200);await pg.selectOption('#quizType','phrase');await pg.selectOption('#quizMode','cloze');await sleep(200);
let seen=0,tries=0;for(;tries<60&&seen<5;tries++){await pg.click('#newQuiz');await sleep(40);const q=await E(()=>document.querySelector('#quizQ').innerHTML);if(/class="blank"/.test(q))seen++}
ok('片語測驗選「填空」時都出成填空題（不再改成看中文）',seen===5,'填空 '+seen+' 題／'+tries+' 次');
ok('片語填空測試沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

// ---------- F. 內容改寫（情境題、同義字中文、例句、音標） ----------
{const {ctx,pg,errs,E}=await open();
await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
const C=await E(()=>{
 // 情境題：只看用字（不看情境）猜答案，留一題交叉驗證；隨便猜是 25%
 const toks=s=>new Set((s.toLowerCase().match(/[a-z']+/g)||[]));const cc={},dc={};const add=(m,t,d)=>t.forEach(w=>m[w]=(m[w]||0)+d);
 SITQ.forEach(q=>q.opts.forEach((o,i)=>add(i===q.ans?cc:dc,toks(o),1)));let hit=0;
 SITQ.forEach(q=>{q.opts.forEach((o,i)=>add(i===q.ans?cc:dc,toks(o),-1));const sc=q.opts.map(o=>[...toks(o)].reduce((s,w)=>s+Math.log(((cc[w]||0)+1)/((dc[w]||0)+3)),0));if(sc.indexOf(Math.max(...sc))===q.ans)hit++;q.opts.forEach((o,i)=>add(i===q.ans?cc:dc,toks(o),1))});
 const pos=SITQ.filter(q=>/第[一二三四]句|最後一句/.test(q.why)).length;
 // 同一冊（以及多益章節）沒有中文完全相同的兩個字
 const dupIn=list=>{const m={};list.forEach(x=>m[x.zh]=(m[x.zh]||0)+1);return Object.values(m).filter(n=>n>1).length};
 const books=[...new Set(WORDS.map(x=>x.k))];const dupBook=books.reduce((s,k)=>s+dupIn(WORDS.filter(x=>x.k===k)),0),dupToeic=dupIn(WORDS.filter(x=>x.toeic));
 // 例句：很短的例句、he／she
 const ex=Object.values(WORD_EX).map(v=>v[0]);const short=ex.filter(e=>(e.match(/[A-Za-z']+/g)||[]).length<3).length;
 const cnt=r=>ex.reduce((s,e)=>s+(e.toLowerCase().match(r)||[]).length,0);const he=cnt(/\b(he|his|him|himself)\b/g),she=cnt(/\b(she|her|hers|herself)\b/g);
 const P=w=>(WORDS.find(x=>x.w===w)||{}).p;
 return {cue:Math.round(hit/SITQ.length*1000)/10,n:SITQ.length,pos,dupBook,dupToeic,short,he,she,ipa:{before:P('before'),enjoy:P('enjoy'),enjoyed:P('enjoyed'),enjoyable:P('enjoyable'),yourself:P('yourself'),export:P('export'),transfer:P('transfer'),transferred:P('transferred'),unfair:P('unfair')}}});
ok('情境題：只看選項用字猜答案的命中率 ≤ 35%（V5.27.2 是 50%，隨便猜 25%）；解說不用「第一句」',C.cue<=35&&C.n>=120&&C.pos===0,JSON.stringify({cue:C.cue,n:C.n,pos:C.pos}));
ok('同義字：同一冊、多益章節裡沒有中文完全一樣的兩個字（V5.27.2 有 300 多個）',C.dupBook===0&&C.dupToeic===0,JSON.stringify({dupBook:C.dupBook,dupToeic:C.dupToeic}));
ok('例句：只有 1–2 個字的例句減少（V5.27.2 是 81 句，≤ 50）；she 的次數至少是 he 的一半（V5.27.2 約 0.42）',C.short<=50&&C.she>=C.he*0.5,JSON.stringify({short:C.short,he:C.he,she:C.she}));
const I=C.ipa;
ok('音標：字首不重讀、詞形一致（before bɪˈfɔr、enjoy／enjoyed／enjoyable 都是 ɪn-、yourself 重音在 -self、export／transfer 動詞重音）',I.before==='bɪˈfɔr'&&I.enjoy==='ɪnˈʤɔɪ'&&I.enjoyed==='ɪnˈʤɔɪd'&&I.enjoyable==='ɪnˈʤɔɪəbəl'&&I.yourself==='jərˈsɛlf'&&I.export==='ɪkˈspɔrt'&&I.transfer==='trænsˈfər'&&I.transferred==='trænsˈfərd'&&I.unfair==='ənˈfɛr',JSON.stringify(I));
ok('內容檢查沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}

fs.writeFileSync('results_p20.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
