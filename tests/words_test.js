const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8796);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8796/');await sleep(1000);await pg.click('#navWords');await sleep(400);
const cnt=async(book,q='')=>{await pg.click('#bookChips [data-b="'+(book)+'"]');await pg.fill('#wordSearch',q);await pg.dispatchEvent('#wordSearch','input');await sleep(250);return +(await pg.textContent('#wordCount'))};
ok('全部（只學原形）= 5000',await cnt('all')===5000);
const bk=[];for(const k of ['1','2','3','4','5'])bk.push(await cnt(k));ok('第 1–5 冊各 1000 原形',bk.every(n=>n===1000),bk.join('/'));
ok('單字頁沒有第 6 冊選項',!(await pg.$('#wordBook option[value="6"]')));
{const nCE=await pg.evaluate(()=>WORDS.filter(x=>x.k===7).length);ok('CE 專業字與縮寫：'+nCE+' 個（V5.27.2 起 CE 的詞形也顯示）',nCE>=127&&await cnt('7')===nCE)}
await cnt('all','ups');const t1=await pg.textContent('#wordRows');ok('搜尋「ups」找到 UPS 縮寫與 ups and downs',/UPS/.test(t1)&&/不斷電系統/.test(t1)&&/起伏/.test(t1));
await cnt('all','colour');ok('搜尋英式「colour」顯示相關的美式字 color（V5.27.2 起標示「英式用字」）',/英式用字，相關美式字\s*color/.test(await pg.textContent('#wordRows')));
await cnt('all','went');ok('搜尋「went」顯示原形 go',/原形\s*go/.test(await pg.textContent('#wordRows')));
await cnt('all','go');ok('原形 go 列出詞形（含 went）',/詞形[^]*went/.test(await pg.textContent('#wordRows')));
await cnt('5','forklift');ok('新原形 forklift 在第 5 冊',(await pg.textContent('#wordRows')).includes('堆高機'));
await cnt('all','');await pg.click('#navQuiz');await sleep(300);const opts=await pg.evaluate(()=>[...document.querySelectorAll('#quizBook option')].map(o=>o.value));ok('測驗範圍：第 1–5 冊＋CE＋職場英文＋TOEIC 多益＋答錯本',JSON.stringify(opts)===JSON.stringify(['all','1','2','3','4','5','7','8','toeic','wrong']));
await pg.selectOption('#quizBook','7');await pg.selectOption('#quizMode','en');await pg.click('#newQuiz');await sleep(300);ok('CE 測驗可出題',(await pg.textContent('#quizQ')).trim().length>0);
await pg.click('#navStats');await sleep(400);const st=await pg.textContent('#statsBody');ok('統計頁：第 1–5 冊＋CE 字',/第 5 冊/.test(st)&&/CE 字/.test(st)&&!/第 6 冊/.test(st));
await pg.click('#navPractice');await pg.selectOption('#unit','w7');await sleep(300);{const nCEs=await pg.evaluate(()=>WORDS.filter(x=>x.k===7).length);ok('句子頁 CE 例句 '+nCEs+' 句',nCEs>=131&&new RegExp('/ '+nCEs+'$').test((await pg.textContent('#progress')).trim()))}
await pg.selectOption('#unit','every');await sleep(300);{const C=require('./common').dataCounts();ok('全部句子 '+C.total+' 句',new RegExp('/ '+C.total+'$').test((await pg.textContent('#progress')).trim()),await pg.textContent('#progress'))}
await pg.click('#navWords');await sleep(200);
fs.writeFileSync('/tmp/old_backup.json',JSON.stringify({app:'english-5000',version:'5.15',progress:{fav:[],known:[],wordFav:['colour'],wordKnown:['went'],wordStatus:{went:'known'},reviewDue:{children:'2026-10-25'},settings:{dailyGoal:20},wordKeyVersion:2}}));
await pg.evaluate(()=>{page('stats');renderBackup()});await pg.setInputFiles('#bkImport','/tmp/old_backup.json');await pg.waitForLoadState('load');await sleep(2000);
const s=await pg.evaluate(()=>JSON.parse(localStorage.getItem('english5000v5')));ok('匯入 V5.15 備份：自動轉移到原形',s.wordKnown.includes('go')&&s.wordFav.includes('color')&&s.reviewDue.child==='2026-10-25'&&s.wordKeyVersion>=4);
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_words.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
