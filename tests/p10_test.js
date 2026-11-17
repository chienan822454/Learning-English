// V5.18.0：我的錯題本、Role Play 難度、分題型統計
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8873);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['microphone']});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await ctx.addInitScript(()=>{window.__said=[];const V=[{name:'Samantha',lang:'en-US',voiceURI:'sam',default:true,localService:true},{name:'Alex',lang:'en-US',voiceURI:'alex',default:false,localService:true}];speechSynthesis.getVoices=()=>V;window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};let sp=null;Object.defineProperty(speechSynthesis,'speaking',{get:()=>!!sp});
 speechSynthesis.speak=u=>{window.__said.push(u.text);sp=u;setTimeout(()=>{if(sp===u){sp=null;u.onend&&u.onend()}},60)};speechSynthesis.cancel=()=>{const u=sp;sp=null;if(u)setTimeout(()=>u.onend&&u.onend(),0)};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
 say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f))});
await pg.goto('http://localhost:8873/');await sleep(900);
const E=(f,a)=>pg.evaluate(f,a);
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
// ---------- 分題型統計 ----------
await pg.click('#navQuiz');
const answer=async(right)=>E(r=>{const bs=[...document.querySelectorAll('#quizOpts button[data-ok],#quizOpts button[data-k]')];if(!bs.length)return false;let b=null;if(bs[0].dataset.ok!==undefined)b=bs.find(x=>(x.dataset.ok==='true')===r);return b?(b.click(),true):false},right);
await pg.selectOption('#quizType','word');await pg.selectOption('#quizBook','1');await pg.selectOption('#quizMode','en');
for(let k=0;k<3;k++){await pg.click('#newQuiz');await sleep(40);await answer(true)}for(let k=0;k<2;k++){await pg.click('#newQuiz');await sleep(40);await answer(false)}
await pg.selectOption('#quizMode','zh');for(let k=0;k<6;k++){await pg.click('#newQuiz');await sleep(40);await answer(k<1)}
await pg.selectOption('#quizType','sentence');for(let k=0;k<2;k++){await pg.click('#newQuiz');await sleep(40);await answer(true)}
await pg.selectOption('#quizType','phrase');await pg.selectOption('#quizMode','en');for(let k=0;k<2;k++){await pg.click('#newQuiz');await sleep(40);await answer(false)}
await pg.selectOption('#quizType','situ');for(let k=0;k<2;k++){await pg.click('#newQuiz');await sleep(40);await E(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent!==q.opts[q.ans]).click()})}
const qs=await E(()=>store.qStat);
ok('各題型分開記錄答對／答錯',JSON.stringify(qs['w-en'])==='[3,2]'&&JSON.stringify(qs['w-zh'])==='[1,5]'&&JSON.stringify(qs.sentence)==='[2,0]'&&qs.phrase[1]===2&&qs.situ[1]===2,JSON.stringify(qs));
await pg.click('#navStats');await sleep(300);const st=await pg.textContent('#statsBody');
ok('統計頁顯示各題型正確率',/各題型正確率/.test(st)&&/單字：看英文選中文/.test(st)&&/3 \/ 5（60%）/.test(st)&&/句子測驗/.test(st)&&/CE 情境題/.test(st));
ok('標出最弱的題型（至少 5 題才比較）',/最弱的題型：單字：看中文選英文（正確率 17%）/.test(st),(st.match(/最弱的題型[^）]*）/)||[''])[0]);
ok('統計頁顯示 Role Play 與錯題本數量',/Role Play 已演/.test(st)&&/錯題本/.test(st)&&/單字 \d+、句子 \d+、情境題 2/.test(st));
// ---------- 我的錯題本 ----------
await E(()=>{store.lsWrong={'d:d02:3':1,[ALLS.find(s=>s.src==='core').id]:2};save()});
await pg.click('#statsBody [data-openwb]');await sleep(200);
const W=await E(()=>({vis:!$('#wrongPage').hidden,cards:[...document.querySelectorAll('.wb-cards b')].map(b=>b.textContent),rows:document.querySelectorAll('#wrongBody .wb-row').length,mix:!!$('#wbMix')}));
const nW=await E(()=>Object.keys(store.wrongWords||{}).filter(w=>WMAP[w]).length);
ok('錯題本：單字、句子、情境題三類數量與清單',W.vis&&W.cards.join(',')===nW+',2,2'&&W.rows===nW+4&&W.mix,JSON.stringify(W));
ok('錯題本清單：單字顯示「還要答對 N 次」、句子顯示來源',/還要答對 \d+ 次/.test(await pg.textContent('#wrongBody'))&&/對話：/.test(await pg.textContent('#wrongBody')));
await E(()=>window.__said=[]);await pg.click('#wrongBody [data-wbsay] >> nth=0');await sleep(100);ok('錯題本 🔊 可播放',(await E(()=>window.__said)).length===1);
await pg.click('#wbMix');await sleep(200);
ok('全部錯題混合練習：切到測驗並出題',await E(()=>$('#quizType').value==='wrongmix'&&/錯題本混合練習/.test($('#quizQ').textContent)&&document.querySelectorAll('#quizOpts button, #dictIn').length>0));
const kinds=new Set();for(let k=0;k<40;k++){await pg.click('#newQuiz');await sleep(30);kinds.add(await E(()=>document.querySelector('.sq-opt')?'q':document.querySelector('#dictIn')||document.querySelector('#quizOpts button[data-ok]')?'w':'s'))}
ok('混合練習會出到三種錯題（單字、句子、情境題）',kinds.size===3,[...kinds].join(','));
// 答對移出：情境題
let before=await E(()=>Object.keys(store.sqWrong).length);for(let k=0;k<120&&before>0;k++){await pg.click('#newQuiz');await sleep(30);const isQ=await E(()=>!!document.querySelector('.sq-opt'));if(isQ){await E(()=>{const q=SITQ.find(x=>x.id===store.sqLast);[...document.querySelectorAll('#quizOpts .sq-opt')].find(b=>b.textContent===q.opts[q.ans]).click()});await sleep(60);before=await E(()=>Object.keys(store.sqWrong).length)}}
ok('混合練習答對情境題後移出錯題本',before===0);
await pg.click('#openWB');await sleep(200);const n1=await E(()=>document.querySelectorAll('#wrongBody .wb-row').length);await pg.click('#wrongBody [data-wbdel] >> nth=0');await sleep(150);
ok('錯題本 ✕ 可手動移除',await E(()=>document.querySelectorAll('#wrongBody .wb-row').length)===n1-1);
await pg.click('#wrongBody [data-wbgo="sp"]');await sleep(200);ok('錯題本 › 句子「跟讀」：句子頁只列答錯的句子',await E(()=>$('#unit').value==='lsw'&&!!store.lsWrong[cur().id]));
await pg.click('#navToday');await sleep(200);ok('今日學習只顯示一個「我的錯題本」任務',(await pg.$$('#todayBody [data-go="wrongbook"]')).length===1&&!(await pg.$('#todayBody [data-go="lsw"]'))&&!(await pg.$('#todayBody [data-go="wrong"]')));
await E(()=>{store.wrongWords={};store.lsWrong={};store.sqWrong={};save()});await E(()=>openWrongBook());ok('沒有錯題時顯示空的提示',/目前沒有錯題/.test(await pg.textContent('#wrongBody'))&&!(await pg.$('#wbMix')));
await pg.click('#wbBack');await sleep(150);ok('錯題本「返回」：回到打開錯題本的頁面（V5.27.2 起；這裡是從今日頁打開）',await E(()=>!$('#todayPage').hidden));
await pg.click('#navQuiz');await sleep(150);await E(()=>openWrongBook());await pg.click('#wbBack');await sleep(150);ok('錯題本從測驗頁打開：「返回測驗」回到測驗',await E(()=>!$('#quiz').hidden));
await pg.selectOption('#quizType','wrongmix');await sleep(100);ok('錯題本空的時混合練習顯示提示',/錯題本是空的/.test(await pg.textContent('#quizQ')));
// ---------- Role Play 難度 ----------
await pg.click('#navDialogs');if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d14"]');await pg.click('#dlgRpB');await sleep(400);
const D=await E(()=>DLG_BY.d14);
ok('預設難度「提示（首字母）」：英文只顯示每個字的第一個字母',await E(()=>rpLevel()==='hint'&&$('#rpLevel').value==='hint'&&$('#rpEn').classList.contains('rp-hint')&&/^H_,? /.test($('#rpEn').textContent)&&!$('#rpEn').classList.contains('rp-blur')),await pg.textContent('#rpEn'));
ok('提示保留設備編號與縮寫（MSB-1 等）',/MSB-1/.test(await pg.textContent('#rpEn')));
await pg.click('#rpPeek');ok('💡 提示：再按一次顯示完整英文',(await pg.textContent('#rpEn'))===D.lines[1].en);
await pg.selectOption('#rpLevel','hard');await sleep(150);ok('挑戰：只看中文（英文模糊）',await E(()=>$('#rpEn').classList.contains('rp-blur')&&store.settings.rpLevel==='hard'));
await pg.click('#rpPeek');ok('挑戰時 💡 先給首字母',await E(()=>$('#rpEn').classList.contains('rp-hint')));
await pg.selectOption('#rpLevel','read');await sleep(150);ok('跟讀：直接顯示英文',(await pg.textContent('#rpEn'))===D.lines[1].en);
await pg.click('#check');await sleep(150);await E(t=>window.__speak(t),'hi i am on rounds');await sleep(400);
ok('跟讀／提示／挑戰：低於 80% 不算通過',/再試一次/.test(await pg.textContent('#result'))&&!(await E(()=>RP.ok&&RP.ok[RP.n])));
await pg.click('#check');await sleep(150);await E(t=>window.__speak(t),D.lines[1].en.toLowerCase().replace(/-/g,' '));await sleep(400);
ok('念到 80% 以上：顯示通過並記錄 ✅',/通過/.test(await pg.textContent('#result'))&&/✅/.test(await pg.textContent('.rp-prog')));
// 自由回答：找有重點句型的句子
const kn=await E(()=>{const d=DLG_BY.d14;for(const n of rpMine()){const k=rpKey(d,n);if(k&&n>1)return {n,k:k.en}}return null});
await pg.selectOption('#rpLevel','free');await sleep(150);
if(kn){await E(n=>rpGo(n,false),kn.n);await sleep(200);
 ok('自由回答：顯示必說重點句型',(await pg.textContent('.rp-key')).includes(kn.k),kn.k);
 await pg.click('#check');await sleep(150);await E(t=>window.__speak(t),'okay '+kn.k.toLowerCase()+' thanks');await sleep(400);
 ok('自由回答：有說到重點句型就通過（其他字不同也可以）',/有說到重點句型/.test(await pg.textContent('#result'))&&await E(n=>!!RP.ok[n],kn.n),(await pg.textContent('#result')).slice(0,80))}
else ok('d14 有重點句型可測',false);
const nk=await E(()=>{const d=DLG_BY.d14;for(const n of rpMine())if(!rpKey(d,n))return n;return null});
if(nk!=null){await E(n=>rpGo(n,false),nk);await sleep(200);ok('自由回答：沒有重點句型的句子，相似度 60% 以上就通過',/60%/.test(await pg.textContent('.rp-key')))}
// 完成畫面
await E(()=>rpGo(rpMine()[rpMine().length-1],false));await pg.click('#rpNext');await sleep(500);
const sum=await pg.textContent('#rpBox');ok('完成畫面：顯示難度、通過句數、用了提示的句子',/難度：自由回答/.test(sum)&&/通過 \d+ 句/.test(sum)&&/用了提示/.test(sum),sum.slice(0,120));
ok('完成紀錄包含難度與通過數',await E(()=>{const r=store.rpDone.d14;return r.lv==='free'&&r.of===6&&r.pass>=2}),JSON.stringify(await E(()=>store.rpDone.d14)));
await pg.click('#rpBackD');await sleep(200);ok('對話頁顯示上次 Role Play 的難度與通過數',/自由回答，通過 \d\/6/.test(await pg.textContent('#dialogBody')));
// 重新載入後保留難度與通過紀錄
await pg.click('#dlgRpB');await sleep(300);await pg.click('#check');await sleep(150);await E(t=>window.__speak(t),D.lines[1].en.toLowerCase().replace(/-/g,' '));await sleep(400);
await E(()=>micReload());await pg.waitForLoadState('load');await sleep(1300);
ok('重新啟動麥克風後：難度與通過標記保留',await E(()=>RP.on&&rpLevel()==='free'&&!!RP.ok[RP.n]));
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p10.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
