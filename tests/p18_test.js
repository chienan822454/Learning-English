// V5.27.0：CE 縮寫 DSP（Drill Scenario Procedure）、FOC（Facility Operations Center）
// V5.27.1：地點名稱改為 TWDC（原本的機房代號不寫在測試裡，用 base64 比對）
const {serve,launch,sleep,R,ok,fs}=require('./common');const srv=serve(()=>'site',8886);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.addInitScript(()=>{window.__said=[];speechSynthesis.speak=u=>{window.__said.push(u.text);setTimeout(()=>u.onend&&u.onend(),20)};speechSynthesis.cancel=()=>{}});
const E=(f,a)=>pg.evaluate(f,a);
await pg.goto('http://localhost:8886/');await sleep(1200);await pg.waitForFunction(()=>typeof EX_READY!=='undefined'&&EX_READY,null,{timeout:15000}).catch(()=>{});
ok('版本號 '+process.env.VER,(await pg.textContent('#appVer')).includes(process.env.VER)&&('V'+await E(()=>APP_VERSION))===process.env.VER);
const C=await E(()=>{const by=w=>WORDS.find(x=>x.w===w);const f=(w,full)=>{const x=by(w);return !!x&&x.k===7&&x.ce===1&&x.acr===1&&x.pos==='abbr.'&&x.zh.includes('（'+full+'）')&&!!x.p&&new RegExp('\\b'+w+'\\b').test(x.ex||'')&&!!x.exz&&(x.t||[]).length>=1&&(x.t||[]).length<=2};
  const ce=WORDS.filter(x=>x.k===7);return {dsp:f('DSP','Drill Scenario Procedure'),foc:f('FOC','Facility Operations Center'),n:ce.length,acr:ce.filter(x=>x.acr).length,zh:[by('DSP')&&by('DSP').zh,by('FOC')&&by('FOC').zh],job:WORDS.filter(x=>x.k===8).length,toeic:WORDS.filter(x=>x.toeic).length,uniq:new Set(WORDS.map(x=>x.r)).size===WORDS.length}});
ok('CE 縮寫新增 DSP（演練情境程序，Drill Scenario Procedure）：音標、詞性、中文、例句、主題都有',C.dsp,C.zh[0]);
ok('CE 縮寫新增 FOC（設施維運中心，Facility Operations Center）：音標、詞性、中文、例句、主題都有',C.foc,C.zh[1]);
ok('CE 專業字 '+C.n+' 個、縮寫 '+C.acr+' 個（各多 2 個）；職場英文 '+C.job+' 字、編號不重複',C.n>=233&&C.acr>=52&&C.job>=730&&C.uniq,JSON.stringify(C));
await pg.click('#navWords');await sleep(300);
await pg.click('#bookChips [data-b="7"]');await sleep(300);
ok('單字頁 CE：清單字數依字庫（含 DSP、FOC）',await E(()=>+$('#wordCount').textContent===WORDS.filter(x=>x.k===7&&!(skipV()&&x.b&&x.k!==7)).length));
for(const [q,w,zh] of [['foc','FOC','設施維運中心'],['dsp','DSP','演練情境程序']]){
  await pg.fill('#wordSearch',q);await pg.dispatchEvent('#wordSearch','input');await sleep(400);
  ok('搜尋 '+w+'：找得到，有中文與例句',await E(([w,zh])=>{const r=document.querySelector('#wordRows [data-w="'+w+'"]');return !!r&&r.textContent.includes(zh)&&!!r.querySelector('.ex')},[w,zh]));
  await E(()=>{window.__said=[]});await pg.click('#wordRows [data-w="'+w+'"] [data-act="ex"]');await sleep(100);
  ok(w+' 的例句可以播放',await E(w=>window.__said[0]===BY_WORD[w].ex,w));
}
await pg.fill('#wordSearch','');await pg.dispatchEvent('#wordSearch','input');await sleep(200);await pg.click('#bookChips [data-b="all"]');await sleep(200);
ok('對話與情境題裡的 FOC 不變（例：向 FOC 回報異常事件）',await E(()=>DIALOGS.some(d=>d.t.includes('FOC'))&&SITQ.some(q=>q.opts.some(o=>/\bFOC\b/.test(o))||q.sit.includes('FOC'))));
// V5.27.1：地點名稱改為 TWDC
{const OLD=new RegExp(Buffer.from('VFBFXHMqLT9ccyowPzM=','base64').toString(),'i');
 // 掃描：測試用的網站資料夾＋（GitHub 自動測試時）整個專案的檔案（不含 tests、.git）
 const SKIP=new Set(['tests','.git','node_modules']);
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(SKIP.has(e.name)?[]:walk(d+'/'+e.name)):[d+'/'+e.name]);
 const roots=['site'].concat(process.env.GITHUB_WORKSPACE?[process.env.GITHUB_WORKSPACE]:[]);
 const txt=roots.flatMap(walk).filter(f=>/\.(js|html|css|md|csv|json|webmanifest|txt|ya?ml)$/i.test(f));
 const bad=txt.filter(f=>OLD.test(fs.readFileSync(f,'utf8')));
 const need=['index.html','app.js','data.js','data-ex.js','sw.js'].every(n=>txt.some(f=>f.endsWith('/'+n)));
 ok('V5.27.1：網站與專案的文字檔都沒有原本的機房代號，改為 TWDC（'+txt.length+' 個檔案）',bad.length===0&&need,bad.join(',')||String(txt.length));
 const L=await E(src=>{const re=new RegExp(src,'i');const all=JSON.stringify([DIALOGS,SITQ,PHRASES,SENTENCES])+JSON.stringify(WORDS.map(x=>[x.zh,x.ex,x.exz]));return {old:re.test(all),dlg:DIALOGS.filter(d=>/TWDC/.test(d.desc+JSON.stringify(d.roles)+JSON.stringify(d.lines))).length,ph:PHRASES.some(p=>/\bat TWDC\b/.test(p.ex))}},OLD.source);
 ok('V5.27.1：字庫（對話、片語、句子、情境題、單字例句）只用 TWDC',!L.old&&L.dlg>=10&&L.ph,JSON.stringify(L));
 await pg.click('#navDialogs');await sleep(300);
 const H=await E(()=>({h:document.querySelector('#dialogPage h2').textContent,intro:(document.querySelector('#dialogBody .muted')||{}).textContent||''}));
 ok('V5.27.1：情境對話頁標題與說明顯示 TWDC',/TWDC/.test(H.h)&&/TWDC CE 現場常用/.test(H.intro),H.h+' ／ '+H.intro.slice(0,30));
 await pg.click('.dlg-card[data-d="d02"]');await sleep(300);
 const O=await E(()=>({n:document.querySelectorAll('.dlg-line').length,tw:/TWDC/.test(document.querySelector('#dialogBody').textContent)}));
 ok('V5.27.1：打開對話正常（向 FOC 回報異常事件：12 句，畫面顯示 TWDC）',O.n===12&&O.tw,JSON.stringify(O));
}
ok('沒有 JavaScript 錯誤',errs.length===0,errs.join(' | '));
fs.writeFileSync('results_p18.json',JSON.stringify(R,null,1));await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
