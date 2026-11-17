const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8870);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['microphone']});let pg=await ctx.newPage();const errs=[];
const hook=p=>{p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept())};hook(pg);
await ctx.addInitScript(()=>{window.__ev=[];window.__said=[];const V=[{name:'Samantha',lang:'en-US',voiceURI:'sam',default:true,localService:true},{name:'Alex',lang:'en-US',voiceURI:'alex',default:false,localService:true}];speechSynthesis.getVoices=()=>V;window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};let sp=null;Object.defineProperty(speechSynthesis,'speaking',{get:()=>!!sp});
 speechSynthesis.speak=u=>{window.__said.push(u.text);window.__ev.push('speak:'+u.text);sp=u;setTimeout(()=>{if(sp===u){sp=null;u.onend&&u.onend()}},120)};speechSynthesis.cancel=()=>{window.__ev.push('cancel');const u=sp;sp=null;if(u)setTimeout(()=>u.onend&&u.onend(),0)};
 window.__sess=[];class F{constructor(){this.results=[];this.running=false;window.__sess.push(this)}start(){this.running=true;setTimeout(()=>{this.onstart&&this.onstart();this.onaudiostart&&this.onaudiostart()},50)}stop(){}abort(){this.running=false}
 say(t,fin=true){this.results.push(Object.assign([{transcript:t}],{isFinal:fin}));this.onresult&&this.onresult({results:this.results.slice()})}}
 window.webkitSpeechRecognition=F;window.SpeechRecognition=F;window.__speak=(t,f)=>window.__sess.forEach(s=>s.running&&s.say(t,f))});
await pg.goto('http://localhost:8870/');await sleep(900);
const E=(f,a)=>pg.evaluate(f,a);
// R1-1 / R3-2 逐句跟讀 → 重新啟動麥克風 → 回到同一個對話、同一句
await E(()=>{store.settings.unit='ce';save()});await pg.click('#navDialogs');await pg.click('.dlg-card[data-d="d07"]');await sleep(100);await pg.click('#dlgShadow');await sleep(100);await pg.click('#next');await pg.click('#next');
const before=await E(()=>cur().id);await E(()=>{localStorage.setItem('e5k_sr_once','1');micReload()});await pg.waitForLoadState('load');await sleep(1200);
ok('逐句跟讀時重新啟動麥克風：回到同一個對話的同一句',await E(()=>cur().id)===before&&await E(()=>$('#unit').value)==='d07',before+' → '+await E(()=>cur().id));
// R1-2 IPA for acronyms
await E(()=>{const u=$('#unit');u.value='w7';u.onchange();i=pool.findIndex(s=>s.keys.includes('UPS'));render()});
ok('關鍵字卡：UPS 顯示縮寫的音標（不是 ups and downs）',/juˌpiˈɛs/.test(await pg.textContent('#keywords'))&&!/əps/.test(await pg.textContent('#keywords')),(await pg.textContent('#keywords')).slice(0,60));
// R1-3 recognizer flag only per session
ok('「每次載入只能辨識一次」標記不再永久保存（舊版留下的標記會清除）',await E(()=>localStorage.getItem('e5k_sr_once'))===null);
// R1-4 curly apostrophe
await E(()=>{const u=$('#unit');u.value='dall';u.onchange();i=pool.findIndex(s=>/Don't|don't/.test(s.en));render()});const ln=await E(()=>cur().en);
await pg.click('#check');await sleep(150);await E(t=>window.__speak(t),ln.replace(/'/g,'\u2019'));await sleep(400);
{const rt=await pg.textContent('#result');ok('🎤 辨識結果用彎引號（Don’t）也算對',/相似度 100%/.test(rt),ln+' => '+rt.slice(0,160))}
// R1-10 constructor
await pg.click('#check');await sleep(150);await E(()=>window.__speak('the road is under constructor'));await sleep(400);
ok('🎤 聽到 constructor 這類字不會出錯',/相似度/.test(await pg.textContent('#result'))&&!errs.some(e=>/split/.test(e)));
// R1-6 連播 3 次後按下一句
await E(()=>{const u=$('#unit');u.value='all';u.onchange();i=0;render()});const s0=await E(()=>cur().en);await pg.click('#repeat');await sleep(50);await pg.click('#next');const s1=await E(()=>cur().en);await E(()=>window.__said=[]);await sleep(900);
ok('連播 3 次時按下一句：不會繼續念上一句',!(await E(()=>window.__said)).includes(s0),JSON.stringify(await E(()=>window.__said)).slice(0,80));
// R1-7 只看未會說 停在同一句
await E(()=>{store.known=SENTENCES.slice(0,5).map(s=>s.id);STV++;save();i=20;render()});const id20=await E(()=>cur().id);await pg.check('#hideKnown');await sleep(100);
ok('勾「只看未會說」時停在同一句',await E(()=>cur().id)===id20);await pg.uncheck('#hideKnown');ok('取消時也停在同一句',await E(()=>cur().id)===id20);
// R1-9 搜尋結果點已會說的句子
await pg.check('#hideKnown');await pg.click('#openList');await pg.fill('#search','morning');await pg.dispatchEvent('#search','input');await sleep(300);
const tgt=await E(()=>{const r=[...document.querySelectorAll('#rows .row')];return r.length?r[0].dataset.k:null});
if(tgt!==null){await E(()=>{const s=listRes[0];if(!store.known.includes(s.id)){store.known.push(s.id);STV++;save()}});await pg.click('#rows .row');await sleep(200);ok('只看未會說時，從句子表點已會說的句子會打開那一句',await E(()=>cur().id===listRes[0].id))}else ok('句子表搜尋有結果',false);
await pg.uncheck('#hideKnown');
// R1-5 sentence quiz counts once
await pg.click('#navQuiz');await pg.selectOption('#quizType','sentence');await sleep(100);const q0=await E(()=>(store.quizRight||0)+(store.quizWrong||0));
for(let k=0;k<4;k++)await pg.click('#quizOpts button >> nth=0');ok('句子測驗：同一題重複點只計一次',await E(()=>(store.quizRight||0)+(store.quizWrong||0))===q0+1);
// R2-4 nav to quiz: listening question speech not cancelled
await pg.selectOption('#quizType','lisen');await sleep(100);await pg.click('#navStats');await sleep(100);await E(()=>window.__ev=[]);await pg.click('#navQuiz');await sleep(60);
const ev=await E(()=>window.__ev);ok('從底部選單進測驗：聽力題第一題的發音不會被取消',ev.length>0&&ev[ev.length-1].startsWith('speak:'),ev.join(' , ').slice(0,90));
// R2-6 Today quiz shortcut syncs controls
await pg.click('#navToday');await sleep(200);await E(()=>{const g=document.querySelector('#todayBody [data-go="quiz"]');g&&g.click()});await sleep(200);
ok('今日 › 測驗：單字測驗選單正確（冊別顯示、句子範圍隱藏）',await E(()=>$('#quizType').value==='word'&&!$('#quizBook').hidden&&$('#quizSOpts').hidden&&$('#quizDcOpts').hidden&&$('#quizSitOpts').hidden));
// R2-7 Today phrase review clears search
await pg.click('#navPhrases');await pg.fill('#phSearch','zzz');await pg.dispatchEvent('#phSearch','input');await sleep(300);await pg.click('#navToday');await sleep(200);
await E(()=>{const g=document.querySelector('#todayBody [data-go="ph"]');g&&g.click()});await sleep(300);ok('今日 › 片語：清除舊的片語搜尋',await E(()=>$('#phSearch').value==='')&&(await pg.$$('#phRows .row, #phRows > *')).length>0);
// R2-2 不熟 then regrade logs review
await E(()=>{const w=WORDS.find(x=>!x.b&&statusOf(x.w)==='new').w;window.__w=w;store.dailyLog={};setStatus(w,'new');setStatus(w,'learning')});
ok('單字標「不熟」後再評一次：記為複習、不重複算新字',await E(()=>{const L=store.dailyLog[day()]||{};return (L.new||0)===1&&(L.review||0)===1}),JSON.stringify(await E(()=>store.dailyLog[day()])));
// R2-1 daily goal persists
await pg.click('#navWords');if(await pg.$eval('#wfPanel',e=>e.hidden).catch(()=>false))await pg.click('#wfToggle');await pg.selectOption('#dailyGoal','50');await sleep(100);await pg.reload();await sleep(1200);
ok('每日新字目標重新開啟後仍是 50',await E(()=>$('#dailyGoal').value)==='50'&&await E(()=>store.settings.dailyGoal)===50);
// R2-3 auto play stops when recording
await pg.click('#navPractice');await pg.click('#autoPlay');await sleep(150);await pg.click('#record');await sleep(800);
ok('自動播放中按 🎙 錄音：自動播放停止、錄音繼續',await E(()=>!autoOn&&REC.state==='recording'));await pg.click('#record');await sleep(800);
// R2-5 card auto play stops on new deck
await pg.click('#navWords');await pg.click('#cardMode');await sleep(200);await E(()=>{const b=document.querySelector('#wordCard [data-ca="auto"]');b&&b.click()});await sleep(200);await pg.click('#reviewStart');await sleep(200);
ok('單字卡自動播放中開新的牌組：自動播放停止、從第 1 張開始',await E(()=>!cardAuto&&cardIndex===0));
// R3-1 finished role play then 句子
await pg.click('#navDialogs');if(await pg.$('#dlgBack'))await pg.click('#dlgBack');await pg.click('.dlg-card[data-d="d03"]');await pg.click('#dlgRpB');await sleep(400);
for(let k=0;k<6;k++){await pg.click('#rpNext');await sleep(300)}ok('Role Play 完成畫面',/完成 Role Play/.test(await pg.textContent('#rpBox')));
await pg.click('#navPractice');await sleep(200);ok('完成後按「句子」：Role Play 結束、句子頁正常',await E(()=>!RP.on&&$('#rpBox').hidden&&!$('.panel').hidden));
const c1=await E(()=>cur().id);await pg.click('#next');ok('下一句可以用',await E(()=>cur().id)!==c1);
// R3-1b active role play then nav 句子: stays RP screen
await pg.click('#navDialogs');await pg.click('#dlgRpB');await sleep(300);await pg.click('#navWords');await pg.click('#navDialogs');await pg.click('#dlgRpB');await sleep(300);await pg.click('#navToday');await sleep(100);
ok('Role Play 中切到別頁會結束 Role Play',await E(()=>!RP.on));
await pg.click('#navDialogs');await pg.click('#dlgRpB');await sleep(300);await E(()=>page('practice'));ok('Role Play 進行中顯示句子頁：仍是 Role Play 畫面（不會多出一套按鈕）',await E(()=>RP.on&&$('.panel').hidden&&!$('#rpBox').hidden));
// R3-4 hideKnown disabled during RP and restored
ok('Role Play 中「只看未會說」不能切換',await E(()=>$('#hideKnown').disabled));await E(()=>{store.settings.hideKnown=true;save()});await pg.click('#rpEnd');await sleep(200);
ok('結束後「只看未會說」恢復成原本設定',await E(()=>!$('#hideKnown').disabled&&$('#hideKnown').checked===true));await E(()=>{store.settings.hideKnown=false;$('#hideKnown').checked=false;save()});
// R3-5 role A first line
await pg.click('#dlgRpA');await sleep(300);await E(()=>window.__said=[]);await pg.click('#rpHear');await sleep(300);
ok('我演 A 第一句按「再聽對方」不會念出自己的答案',(await E(()=>window.__said)).length===0&&/先開口/.test(await pg.textContent('#result')));await pg.click('#rpEnd');
// R3-9 play all label
await pg.click('[data-play="0"]');await sleep(30);await pg.click('#dlgPlayAll');await sleep(100);ok('單句播放中按「播放整段」會開始播放整段',await E(()=>DLG.run)&&/停止/.test(await pg.textContent('#dlgPlayAll')));
await pg.click('#dlgDone');await sleep(100);ok('播放中標記已練習：按鈕仍顯示「停止」',/停止/.test(await pg.textContent('#dlgPlayAll'))===(await E(()=>DLG.run)));await E(()=>dlgStop());
// R3-7 shadow when all lines known
await pg.check('#hideKnown').catch(()=>{});await E(()=>{$('#hideKnown').checked=true;store.known=store.known.concat(DLG_BY.d06.lines.map((l,n)=>'d:d06:'+n));STV++;save();DLG.cur=DLG_BY.d06;page('dialogs');renderDialog(DLG.cur)});await pg.click('#dlgShadow');await sleep(200);
ok('逐句跟讀：對話句都會說了仍顯示這段對話',await E(()=>cur().dlg==='d06'));await E(()=>{$('#hideKnown').checked=false;filter()});
// R3-6 dialogue cloze
await pg.click('#navQuiz');await pg.selectOption('#quizType','dcloze');let leak=0,cap=0;
for(let k=0;k<200;k++){await pg.click('#newQuiz');const r=await E(()=>{const q=document.querySelector('.dc-q').textContent;const opts=[...document.querySelectorAll('#quizOpts button')].map(b=>b.textContent);const t=q.replace(/^[AB]\s*/,'');const p=t.split('_____');let ans=null;DIALOGS.forEach(d=>d.lines.forEach(l=>{if(!ans&&l.en.startsWith(p[0])&&l.en.endsWith(p[p.length-1])&&p.length===2)ans=l.en.slice(p[0].length,l.en.length-p[1].length)}));const caps=opts.filter(o=>/^[A-Z][a-z]+$/.test(o)).length;return {leak:ans?new RegExp('\\b'+ans+'\\b').test(t):false,cap:caps===1}});if(r.leak)leak++;if(r.cap)cap++}
ok('對話填空：答案不會出現在題目其他地方、選項不會只有答案是大寫開頭（200 題）',leak===0&&cap===0,'露出 '+leak+'、大寫 '+cap);
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p8.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
