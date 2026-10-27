const fs=require('fs');global.window={};eval(fs.readFileSync(process.argv[2],'utf8'));
/* V5.20.0：單字例句在 data-ex.js，驗證前先合併 */
{const exf=process.argv[2].replace(/data\.js$/,'data-ex.js');if(fs.existsSync(exf)){eval(fs.readFileSync(exf,'utf8'));const ex=window.WORD_EX||{};window.WORDS.forEach(x=>{const e=ex[x.w];if(e){x.ex=e[0];x.exz=e[1]}})}}
const W=window.WORDS,T=window.TOPICS,MG=window.MERGED||{};const M={};W.forEach(x=>M[x.w]=x);
const R=[];const ok=(n,p,i='')=>{R.push({name:n,pass:!!p,info:String(i)});console.log((p?'PASS':'FAIL')+' | '+n+(i!==''?' | '+i:''))};
const main=W.filter(x=>x.k!==7&&x.k!==8),base=main.filter(x=>!x.b),ce=W.filter(x=>x.k===7),job=W.filter(x=>x.k===8),forms=W.filter(x=>x.b);
ok('原形 = 5000',base.length===5000,base.length);
ok('原形不重複 = 5000',new Set(base.map(x=>x.w.toLowerCase())).size===5000);
for(const k of [1,2,3,4,5])ok(`第 ${k} 冊原形 = 1000`,base.filter(x=>x.k===k).length===1000,base.filter(x=>x.k===k).length);
ok('沒有第 6 冊',!W.some(x=>x.k===6));
ok('CE 不計入 5000',ce.every(x=>x.ce)&&base.every(x=>!x.ce),'CE '+ce.length+'（原形 '+ce.filter(x=>!x.b).length+'）');
ok('職場英文不計入 5000（第 8 類、都是原形）',job.every(x=>x.job&&!x.b&&!x.ce)&&base.every(x=>!x.job)&&W.filter(x=>x.job).every(x=>x.k===8),'職場英文 '+job.length);
{const MG4=window.MERGED4||{};ok('V5.21 併入新原形的舊字都已是詞形',Object.keys(MG4).every(o=>M[o]&&M[o].b===MG4[o]&&M[MG4[o]]&&!M[MG4[o]].b),Object.keys(MG4).length+' 筆')}
{const MG5=window.MERGED5||{};ok('V5.22 改為詞形的舊原形都已是詞形',Object.keys(MG5).length>0&&Object.keys(MG5).every(o=>M[o]&&M[o].b===MG5[o]&&M[MG5[o]]&&!M[MG5[o]].b),Object.keys(MG5).length+' 筆')}
{const TO=W.filter(x=>x.toeic),rk=TO.map(x=>x.toeic);ok('TOEIC 多益：TSL 1,250 字全收（App 1,247 字；resume／résumé、salesperson／salespeople、graphic／graphics 各算一字）、排名不重複',TO.length===1247&&new Set(rk).size===1247&&Math.min(...rk)===1&&Math.max(...rk)===1250,TO.length+' 字');
ok('TOEIC 多益的字都不是詞形、都有例句',TO.every(x=>!x.b&&x.ex&&x.exz));
const DV=W.filter(x=>x.v);ok('衍生字與英式用字都是 5000 原形的詞形（v：d／u）',DV.length>0&&DV.every(x=>(x.v==='d'||x.v==='u')&&x.b&&M[x.b]&&!M[x.b].b&&M[x.b].k<=5),DV.length+' 個');
ok('音標寫法統一（不用 ʌ、ɡ、ɜ、tʃ、dʒ）',W.every(x=>!/[ʌɡɜ]|tʃ|dʒ/.test(x.p)),W.filter(x=>/[ʌɡɜ]|tʃ|dʒ/.test(x.p)).map(x=>x.w).slice(0,5).join(','))}
ok('所有詞形都找得到原形，且原形本身不是詞形',forms.every(x=>M[x.b]&&!M[x.b].b),forms.length+' 個詞形');
ok('詞形與原形同冊',forms.filter(x=>x.k!==7).every(x=>M[x.b].k===x.k));
ok('相關字都存在',W.every(x=>(x.f||[]).every(r=>M[r])));
ok('主題代碼有效',W.every(x=>(x.t||[]).every(t=>T[t])));
const bad=v=>v==null||String(v).trim()===''||/待補|undefined|null/i.test(String(v));
for(const [f,n] of [['p','IPA'],['pos','詞性'],['zh','中文'],['ex','英文例句'],['exz','中文例句']])ok(n+' 無空白',W.every(x=>!bad(x[f])),W.filter(x=>bad(x[f])).map(x=>x.w).slice(0,5).join(','));
ok('IPA 字元合法',W.every(x=>/^[a-zæðŋɑɔəɛɜɡɪʃʊʌʒʤʧˈˌθ' .\-]+$/.test(x.p)));
ok('例句不重複',new Set(W.map(x=>x.ex)).size===W.length);
ok('編號不重複',new Set(W.map(x=>x.r)).size===W.length);
ok('原形編號 1–5000 連續',base.map(x=>x.r).sort((a,b)=>a-b).every((v,i)=>v===i+1));
const irr=['is','are','was','were','been','has','had','does','did','went','gone','said','made','got','took','came','gave','children','men','women','feet','teeth','people','better','best','worse','worst'];
ok('不規則詞形已不是原形',irr.every(w=>!M[w]||M[w].b));
ok('縮寫已不是原形',!base.some(x=>x.pos==='contr.'));
const uk=['colour','centre','favourite','behaviour','organisation','realise','labour','theatre','honour','favour','defence','offence','programme','grey','mum','whilst','amongst'];
ok('英式拼法改為美式的變體',uk.every(w=>M[w]&&M[w].b));
ok('搜尋英式拼法可找到美式原形',['colour','centre'].every(w=>M[w]&&M[M[w].b]));
ok('併入對照表的舊字都已是詞形',Object.keys(MG).every(o=>M[o]&&M[o].b===MG[o]),Object.keys(MG).length+' 筆');
ok('CE 縮寫都標示 abbr. 與英文全名（V5.25.0 起超過 27 個）',ce.filter(x=>x.acr).length>27&&ce.filter(x=>x.acr).every(x=>x.pos==='abbr.'&&/（[A-Za-z]/.test(x.zh)),ce.filter(x=>x.acr).length+' 個');
ok('所有單字都有主題，詞形跟著原形（V5.25.0）',W.every(x=>(x.t||[]).length>0)&&forms.every(x=>JSON.stringify(x.t||[])===JSON.stringify(M[x.b].t||[])),W.filter(x=>!(x.t||[]).length).map(x=>x.w).slice(0,5).join(','));
ok('主題 19 類、基本用字不和其他主題混用',Object.keys(T).length===19&&W.every(x=>!(x.t||[]).includes('basic')||x.t.length===1));
ok('每筆例句含該字或其詞形',W.every(x=>{const w=x.w.toLowerCase(),e=' '+x.ex.toLowerCase().replace(/[^a-z0-9'+ -]/g,' ')+' ';const c=[w,w+'s',w+'es',w+'ed',w+'d',w+'ing',w.slice(0,-1)+'ing',w.slice(0,-1)+'ied',w.slice(0,-1)+'ies',w+w.slice(-1)+'ed',w+w.slice(-1)+'ing',w+'er',w+'est',w+'ly',...W.filter(y=>y.b===x.w).map(y=>y.w.toLowerCase()),x.b||'##'];return c.some(t=>e.includes(' '+t+' ')||e.includes(' '+t+"'")||e.includes('-'+t+' ')||e.includes(' '+t+'-'))}));
fs.writeFileSync(process.argv[3]||'results_data.json',JSON.stringify(R,null,1));
