// V5.20.0：字體大小、單字例句延後載入
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8877);
(async()=>{const b=await launch();
const mk=async(opts={})=>{const ctx=await b.newContext(Object.assign({viewport:{width:375,height:740}},opts.delayEx!==undefined?{serviceWorkers:'block'}:{}));const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
 await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20);speechSynthesis.cancel=()=>{}});
 if(opts.delayEx!==undefined)await ctx.route('**/data-ex.js',async r=>{if(opts.delayEx<0){await r.abort();return}await new Promise(z=>setTimeout(z,opts.delayEx));await r.continue()});
 return {ctx,pg,errs}};
const E=(pg,f,a)=>pg.evaluate(f,a);
// ---------- 字體大小 ----------
{const {ctx,pg,errs}=await mk();await pg.goto('http://localhost:8877/');await sleep(900);
 ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER));
 const fsz=()=>E(pg,()=>({en:parseFloat(getComputedStyle(document.querySelector('#english')).fontSize),btn:parseFloat(getComputedStyle(document.querySelector('#play')).fontSize),nav:parseFloat(getComputedStyle(document.querySelector('#navToday')).fontSize),body:parseFloat(getComputedStyle(document.body).fontSize)}));
 const f1=await fsz();ok('預設字體「標準」',await E(pg,()=>$('#fontSel').value==='1'&&!localStorage.getItem('e5k_fs')),JSON.stringify(f1));
 await pg.click('#navStats');await pg.selectOption('#fontSel','1.15');await sleep(100);const f2=await fsz();
 ok('選「大」：句子、按鈕字體放大 1.15 倍，底部選單不變',Math.abs(f2.en/f1.en-1.15)<0.02&&Math.abs(f2.btn/f1.btn-1.15)<0.02&&f2.nav===f1.nav,JSON.stringify(f2));
 ok('設定保存（紀錄＋開啟時套用用的小設定）',await E(pg,()=>store.settings.fontScale==='1.15'&&localStorage.getItem('e5k_fs')==='1.15'));
 await pg.reload();await sleep(900);
 ok('重新開啟後仍是「大」',await E(pg,()=>$('#fontSel').value==='1.15'&&getComputedStyle(document.documentElement).getPropertyValue('--fs').trim()==='1.15'));
 await pg.click('#navStats');await pg.selectOption('#fontSel','1.3');await sleep(100);const f3=await fsz();
 ok('選「特大」：放大 1.3 倍',Math.abs(f3.en/f1.en-1.3)<0.02,JSON.stringify(f3));
 const over=[];const chk=async n=>{await sleep(120);const r=await E(pg,()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(r>0)over.push(n+':'+r)};
 await pg.click('#navToday');await chk('今日');await pg.click('#navPractice');await chk('句子');await pg.click('#navWords');await chk('單字');await pg.click('#cardMode');await chk('單字卡');await pg.click('#navPhrases');await chk('片語');
 await pg.click('#navDialogs');await chk('對話');await pg.click('.dlg-card[data-d="d24"]');await chk('對話內容');await pg.click('#dlgRpB');await sleep(300);await chk('Role Play');
 await pg.click('#navQuiz');for(const t of ['word','situ','liszh','dcloze','wrongmix']){await pg.selectOption('#quizType',t);await chk('測驗 '+t)}await E(pg,()=>openWrongBook());await chk('錯題本');await pg.click('#navStats');await chk('統計');
 ok('「特大」時所有頁面都沒有左右超出畫面（寬 375）',over.length===0,over.join(', '));
 await pg.selectOption('#fontSel','1');await sleep(100);ok('改回「標準」：清除開啟時套用的設定',await E(pg,()=>!localStorage.getItem('e5k_fs')&&getComputedStyle(document.documentElement).getPropertyValue('--fs').trim()==='1'));
 ok('下拉選單不會比畫面寬（選項文字很長時也一樣）',await E(pg,()=>[...document.querySelectorAll('select')].every(x=>getComputedStyle(x).minWidth==='0px'&&getComputedStyle(x).maxWidth==='100%')));
 await pg.click('#navQuiz');await pg.selectOption('#quizType','word');await pg.selectOption('#quizMode','dict');
 await E(pg,()=>{runQuiz();$('#quizMode').value='en';runQuiz()});await sleep(200);
 ok('聽寫題連續快速出題不會出錯',errs.length===0,errs.join(' | '));
 await E(pg,()=>{$('#quizMode').value='dict';runQuiz()});await sleep(100);
 const w=await E(pg,()=>{const t=$('#quizQ').textContent;return t});await pg.fill('#dictIn','zzz');await pg.press('#dictIn','Enter');await sleep(150);
 ok('聽寫題仍可作答（Enter 送出、按鈕停用）',/正確答案/.test(await pg.textContent('#quizMsg'))&&await E(pg,()=>$('#dictIn').disabled&&$('#dictGo').disabled));
 ok('字體設定沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
// ---------- 單字例句延後載入 ----------
{const {ctx,pg,errs}=await mk({delayEx:1500});
 await pg.goto('http://localhost:8877/');await sleep(700);
 const s0=await E(pg,()=>({ready:EX_READY,today:!!document.querySelector('#todayBody [data-go="new"]'),every:$('#unit option[value="every"]').textContent,go:(WORDS.find(x=>x.w==='go')||{}).ex}));
 ok('例句還沒載入時：今日學習已經可以用',s0.ready===false&&s0.today&&new RegExp('（'+require('./common').dataCounts().noEx+'）').test(s0.every)&&!s0.go,JSON.stringify(s0));
 /* V5.32.0：多益長例句（data-ex2.js）在單字例句之後才下載，等兩個都載入 */
 await pg.waitForFunction(()=>EX_READY&&(typeof EX2_READY==='undefined'||EX2_READY),null,{timeout:20000}).catch(()=>{});await sleep(200);
 const s1=await E(pg,()=>({ready:EX_READY,every:$('#unit option[value="every"]').textContent,go:(WORDS.find(x=>x.w==='go')||{}).ex,n:ALLS.length,order:(()=>{const n2=ALLS.filter(s=>s.src==='word2').length;return ALLS[110].src+','+ALLS[110+window.WORDS.length].src+','+ALLS[110+window.WORDS.length+n2].src})()}));
 {const C=require('./common').dataCounts();ok('例句載入後：自動補進 '+C.words+' 句單字例句和 '+C.ex2+' 句多益長例句（全部 '+C.total+' 句、順序正確）',s1.ready&&new RegExp('（'+C.total+'）').test(s1.every)&&!!s1.go&&s1.n===C.total&&s1.order==='word,word2,phrase',JSON.stringify(s1))}
 await E(pg,()=>{store.settings.unit='w1';store.settings.pos.w1=5;saveNow()});await pg.reload();await sleep(400);
 const mid=await E(pg,()=>({ready:EX_READY,pos:store.settings.pos.w1}));await sleep(1800);
 const after=await E(pg,()=>({ready:EX_READY,u:$('#unit').value,i,id:cur().id,pos:store.settings.pos.w1}));
 ok('上次停在單字例句單元：載入期間不會蓋掉位置，載入後回到同一句',mid.ready===false&&mid.pos===5&&after.ready&&after.u==='w1'&&after.i===5&&after.id.startsWith('w:')&&after.pos===5,JSON.stringify([mid,after]));
 await E(pg,()=>{sessionStorage.setItem('e5k_go','practice');sessionStorage.setItem('e5k_sr','1')});await pg.reload();await sleep(2400);
 ok('重新啟動麥克風後（例句單元）：提示保留、回到同一句',/麥克風已重新啟動/.test(await pg.textContent('#result'))&&await E(pg,()=>i===5&&cur().id.startsWith('w:')));
 await pg.click('#navWords');await pg.click('#cardMode');await sleep(200);ok('單字卡有例句',await E(pg,()=>!!document.querySelector('#wordCard .card-ex')));
 ok('延後載入沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
{const {ctx,pg,errs}=await mk({delayEx:-1});
 await pg.goto('http://localhost:8877/');await sleep(10500);
 ok('例句檔下載失敗（重試 3 次）：今日學習顯示提醒，其他功能照常',/單字例句還沒下載完成/.test(await pg.textContent('#todayBody'))&&await E(pg,()=>!EX_READY&&EX_FAIL));
 await pg.click('#navPractice');await E(pg,()=>{const u=$('#unit');u.value='all';u.onchange()});await pg.click('#next');ok('下載失敗時精選句子仍可練習',await E(pg,()=>cur().src==='core'&&i===1));
 await pg.click('#navQuiz');await pg.selectOption('#quizType','word');await pg.selectOption('#quizMode','cloze');let okq=0;for(let k=0;k<5;k++){await pg.click('#newQuiz');await sleep(40);if((await pg.textContent('#quizQ')).trim().length>0&&(await pg.$$('#quizOpts button')).length===4)okq++}
 ok('沒有例句時「例句填空」改出其他題型，不會出空白題',okq===5,okq+'/5');
 ok('下載失敗情況沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));await ctx.close()}
fs.writeFileSync('results_p11.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
