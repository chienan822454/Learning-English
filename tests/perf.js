// 效能量測：模擬中階手機（CPU 降速 4 倍），並使用大量學習紀錄（最壞情況）
const {serve,launch,sleep,fs}=require('./common');const SITE=process.argv[2]||'site',OUT=process.argv[3]||'perf.json',PORT=+(process.argv[4]||8820);
const srv=serve(()=>SITE,PORT);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5);addEventListener('load',()=>{window.__loadAt=performance.now()})});
// 準備重度使用者紀錄
await pg.goto(`http://localhost:${PORT}/`);await sleep(800);
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('english5000v5'));const base=WORDS.filter(x=>!x.b&&!x.ce).map(x=>x.w);const d=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.toISOString().slice(0,10)};
 s.wordKnown=base.slice(0,3000);s.wordStatus={};base.slice(0,3000).forEach(w=>s.wordStatus[w]='known');base.slice(3000,4000).forEach(w=>s.wordStatus[w]='learning');
 s.reviewDue={};base.slice(0,4000).forEach((w,i)=>s.reviewDue[w]=d((i%40)-10));s.reviewStage={};base.slice(0,4000).forEach((w,i)=>s.reviewStage[w]=i%5);
 s.wordFav=base.filter((w,i)=>i%10===0);s.wrongWords={};base.slice(0,300).forEach(w=>s.wrongWords[w]=2);
 const ids=SENTENCES.map(x=>x.id).concat(WORDS.slice(0,2500).map(x=>'w:'+x.w));s.known=ids.slice(0,2000);s.fav=ids.slice(0,300);s.sDue={};s.sStage={};s.known.forEach((id,i)=>{s.sDue[id]=d((i%30)-5);s.sStage[id]=1});
 s.phKnown=PHRASES.slice(0,150).map(x=>x.id);s.phFav=PHRASES.slice(0,40).map(x=>x.id);s.pDue={};s.pStage={};s.phKnown.forEach((id,i)=>{s.pDue[id]=d(i%20-3);s.pStage[id]=1});
 s.studyDays=Array.from({length:200},(_,i)=>d(-i));s.dailyLog={};for(let i=0;i<200;i++)s.dailyLog[d(-i)]={new:10,review:20,sent:5};localStorage.setItem('english5000v5',JSON.stringify(s));Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap')).forEach(k=>localStorage.removeItem(k))});
const cdp=await ctx.newCDPSession(pg);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const runs={};const add=(k,v)=>{(runs[k]=runs[k]||[]).push(v)};
const T=async(fn,arg)=>pg.evaluate(async([f,a])=>{const t=performance.now();await (new Function('a','return ('+f+')(a)'))(a);return performance.now()-t},[fn.toString(),arg]);
for(let rep=0;rep<3;rep++){
 await pg.reload({waitUntil:'load'});await sleep(400);add('開啟 App（載入到可操作）',await pg.evaluate(()=>window.__loadAt));
 add('今日頁',await T(()=>{renderToday()}));
 add('切到句子頁',await T(()=>{page('practice');render()}));
 add('句子單元切換：全部句子（6822）',await T(()=>{const u=document.querySelector('#unit');u.value='every';u.onchange()}));
 add('句子單元切換：待複習句子',await T(()=>{const u=document.querySelector('#unit');u.value='sdue';u.onchange()}));
 add('下一句',await T(()=>{document.querySelector('#next').click()}));
 add('切到單字頁（第一次顯示）',await T(()=>{document.querySelector('#navWords').click()}));
 add('單字搜尋：每打一個字（"st"）',await T(()=>{const s=document.querySelector('#wordSearch');s.value='st';wordShown=60;renderWords()}));
 add('單字搜尋：中文「檢查」',await T(()=>{const s=document.querySelector('#wordSearch');s.value='檢查';wordShown=60;renderWords()}));
 await T(()=>{const s=document.querySelector('#wordSearch');s.value='';renderWords()});
 add('篩選：冊別切換',await T(()=>{const s=document.querySelector('#wordBook');s.value='3';s.dispatchEvent(new Event('change'))}));
 add('篩選：狀態「待複習」',await T(()=>{const s=document.querySelector('#wordState');s.value='review';s.dispatchEvent(new Event('change'))}));
 add('篩選：狀態「收藏」',await T(()=>{const s=document.querySelector('#wordState');s.value='fav';s.dispatchEvent(new Event('change'))}));
 await T(()=>{const s=document.querySelector('#wordState');s.value='all';s.dispatchEvent(new Event('change'));const b=document.querySelector('#wordBook');b.value='all';b.dispatchEvent(new Event('change'))});
 add('單字列表：標記已熟（重畫列表）',await T(()=>{document.querySelector('#wordRows [data-act="known"]').click()}));
 add('今日新字（開啟單字卡）',await T(()=>{document.querySelector('#dailyStart').click()}));
 add('今日複習（開啟單字卡）',await T(()=>{document.querySelector('#reviewStart').click()}));
 add('測驗：出 10 題（看英文選中文）',await T(()=>{page('quiz');document.querySelector('#quizType').value='word';document.querySelector('#quizBook').value='all';document.querySelector('#quizMode').value='en';for(let k=0;k<10;k++)wordQuiz()}));
 add('測驗：出 10 題（看中文選英文）',await T(()=>{document.querySelector('#quizMode').value='zh';for(let k=0;k<10;k++)wordQuiz()}));
 add('測驗：出 10 題（答錯本）',await T(()=>{document.querySelector('#quizBook').value='wrong';document.querySelector('#quizMode').value='en';for(let k=0;k<10;k++)wordQuiz()}));
 add('統計頁',await T(()=>{document.querySelector('#navStats').click()}));
 add('片語頁',await T(()=>{document.querySelector('#navPhrases').click()}));
 add('句子表（開啟）',await T(()=>{page('practice');document.querySelector('#openList').click()}));
}
const med=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];const out={};for(const k in runs)out[k]=Math.round(med(runs[k]));
const ls=await pg.evaluate(()=>({store:(localStorage.getItem('english5000v5')||'').length,snaps:Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_snap')).reduce((a,k)=>a+localStorage.getItem(k).length,0)}));
out['（儲存）學習紀錄大小 KB']=Math.round(ls.store/1024);out['（儲存）自動備份大小 KB']=Math.round(ls.snaps/1024);
fs.writeFileSync(OUT,JSON.stringify({ms:out,errs},null,1));for(const k in out)console.log(String(out[k]).padStart(6)+'  '+k);console.log('errors',errs.length,errs.slice(0,3));
await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
