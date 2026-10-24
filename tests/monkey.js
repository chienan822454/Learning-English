const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8797);
(async()=>{const b=await launch();const ctx=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const pg=await ctx.newPage();require('./common').wfAuto(pg);
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),20)});
await pg.goto('http://localhost:8797/');await sleep(1000);
const bad=[];const scan=async(where)=>{const t=await pg.evaluate(()=>document.body.innerText);for(const p of ['undefined','NaN','[object','Infinity'])if(t.includes(p))bad.push(where+': '+p)};
await pg.click('#navToday');await sleep(300);await scan('今日');
const goes=await pg.evaluate(()=>[...document.querySelectorAll('#todayBody [data-go]')].map(b=>b.dataset.go));
for(const g of goes){await pg.click('#navToday');await sleep(200);const el=await pg.$(`#todayBody [data-go="${g}"]`);if(el&&g!=='backup'){await el.click();await sleep(400);await scan('今日→'+g)}}
await pg.click('#navPractice');await sleep(200);const units=await pg.evaluate(()=>[...document.querySelectorAll('#unit option')].map(o=>o.value));
for(const u of units){await pg.selectOption('#unit',u);await sleep(100);for(const id of ['#play','#showZh','#next','#prev','#fav','#fav'])await pg.click(id);await scan('句子 '+u)}
await pg.click('#known');await pg.click('#known');await pg.click('#openList');await sleep(200);await pg.fill('#search','pump');await pg.dispatchEvent('#search','input');await sleep(200);const row=await pg.$('#rows .row');if(row)await row.click();
await pg.click('#navWords');await sleep(300);const books=await pg.evaluate(()=>[...document.querySelectorAll('#wordBook option')].map(o=>o.value));const states=await pg.evaluate(()=>[...document.querySelectorAll('#wordState option')].map(o=>o.value));
for(const bk of books)for(const st of states){await pg.click('#bookChips [data-b="'+(bk)+'"]');await pg.selectOption('#wordState',st)}
await pg.click('#bookChips [data-b="'+('all')+'"]');await pg.selectOption('#wordState','all');const topics=await pg.evaluate(()=>[...document.querySelectorAll('#wordTopic option')].map(o=>o.value));for(const t of topics){await pg.selectOption('#wordTopic',t);await scan('主題 '+t)}await pg.selectOption('#wordTopic','all');
await pg.click('#skipVar');await sleep(200);await scan('含詞形');await pg.click('#skipVar');
for(const a of ['play','slow','ex','fav','known','fav','known']){const el=await pg.$(`#wordRows [data-act="${a}"]`);if(el)await el.click()}
await pg.click('#wordMore');await pg.click('#dailyStart');await sleep(300);await scan('今日新字');await pg.click('#reviewStart');await pg.click('#cardMode');await sleep(300);
const cb=await pg.evaluate(()=>[...document.querySelectorAll('#wordCard [data-ca]')].map(b=>b.dataset.ca));for(const ca of cb){if(ca==='list'||ca==='auto')continue;const el=await pg.$(`#wordCard [data-ca="${ca}"]`);if(el)await el.click()}await scan('單字卡');
await pg.click('#navPhrases');await sleep(300);for(const c of ['all','daily','work','ce'])await pg.selectOption('#phCat',c);for(const s of ['all','new','fav','due','known'])await pg.selectOption('#phState',s);await pg.selectOption('#phState','all');
for(const a of ['play','ex','slow','fav','known','fav','known']){const el=await pg.$(`#phRows [data-a="${a}"]`);if(el)await el.click()}await scan('片語');
await pg.click('#navQuiz');await sleep(200);const qb=await pg.evaluate(()=>[...document.querySelectorAll('#quizBook option')].map(o=>o.value));const qm=await pg.evaluate(()=>[...document.querySelectorAll('#quizMode option')].map(o=>o.value));const qbad=[];
for(const bk of qb)for(const m of qm){await pg.selectOption('#quizType','word');await pg.selectOption('#quizBook',bk);await pg.selectOption('#quizMode',m);await pg.click('#newQuiz');await sleep(80);if(!(await pg.textContent('#quizQ')).trim())qbad.push(bk+'/'+m);const o=await pg.$('#quizOpts button');if(o&&m!=='dict')await o.click();else if(m==='dict'){const i=await pg.$('#dictIn');if(i){await i.fill('test');await pg.click('#dictGo')}}await scan('測驗 '+bk+'/'+m)}
for(const t of ['phrase','sentence']){await pg.selectOption('#quizType',t);for(let n=0;n<3;n++){await pg.click('#newQuiz');await sleep(60);const o=await pg.$('#quizOpts button');if(o)await o.click()}await scan('測驗 '+t)}
await pg.click('#navStats');await sleep(300);await scan('統計');for(const th of ['dark','light','auto'])await pg.selectOption('#themeSel',th);await pg.click('#voiceTest');
ok('今日頁按鈕',true,goes.join(','));ok('句子頁全部單元 '+units.length+' 個',true);ok('單字頁 冊×狀態×主題 全組合',true,books.length+'×'+states.length+'×'+topics.length);
ok('測驗：每個範圍×題型都有題目（'+qb.length+'×'+qm.length+'）',qbad.length===0,qbad.join(','));
ok('畫面沒有出現 undefined／NaN 等錯誤文字',bad.length===0,bad.slice(0,5).join(' ｜ '));
ok('沒有 JavaScript 錯誤',errs.length===0,[...new Set(errs)].slice(0,5).join(' ｜ '));
fs.writeFileSync('results_monkey.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
