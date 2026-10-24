const APP_VERSION='5.32.0';
const HTML_VER=(document.getElementById('appVer')||{}).textContent||'';
/* V5.27.2：瀏覽器沒有朗讀功能（例如 LINE、Facebook 等 App 內建瀏覽器）時改用替代物件，App 其他功能照常；按播放時提示改用 Safari／Chrome */
const TTS_OK=!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
if(!TTS_OK){
  const def=(k,v)=>{
    try{
      Object.defineProperty(window,k,{value:v,configurable:true,writable:true})
    }catch(e){
      try{
        window[k]=v
      }catch(x){}
    }
  };
  if(!window.SpeechSynthesisUtterance)def('SpeechSynthesisUtterance',function(t){
    this.text=t
  });
  if(!window.speechSynthesis)def('speechSynthesis',{speaking:false,pending:false,paused:false,onvoiceschanged:null,getVoices:()=>[],cancel(){},pause(){},resume(){},addEventListener(){},removeEventListener(){},speak(u){
    ttsNote();
    setTimeout(()=>{
      try{
        u.onerror&&u.onerror({error:'not-supported'})
      }catch(e){}
    },0)
  }})
}
function ttsNote(){
  if(window.__ttsNoted)return;
  window.__ttsNoted=1;
  setTimeout(()=>alert('⚠️ 這個瀏覽器不支援英文朗讀（常見於 LINE、Facebook 等 App 內建的瀏覽器）。\n請按右上角「⋯」選「用瀏覽器開啟」，改用 Safari 或 Chrome。'),0)
}
try{
  localStorage.removeItem('e5k_sr_once')
}catch(e){}
/* ===== V5.16.14 學習紀錄：安全載入＋每日自動備份 ===== */
const STORE_KEY='english5000v5',SNAP_KEY='english5000v5_snaps',PRE_KEY='english5000v5_before_restore',BACKUP_SCHEMA=3;
function lsGet(k){
  try{
    return localStorage.getItem(k)
  }catch(e){
    return null
  }
}
function lsSet(k,v){
  try{
    localStorage.setItem(k,v);
    return true
  }catch(e){
    return false
  }
}
/* V5.28.0：每日自動備份改成「每天一個鍵」：直接保存開啟時讀到的原始紀錄文字，另外記一份小的索引（日期、摘要）。
   開啟 App 時不必再解析、重新產生 3 份完整備份（大量紀錄的手機每天第一次開啟約快 0.8 秒）。舊格式第一次開啟時自動轉換。 */
const SNAP_PFX='english5000v5_snap_',SNAP_IDX=SNAP_KEY+'_idx';
function snapIdx(){
  try{
    const a=JSON.parse(lsGet(SNAP_IDX)||'null');
    if(Array.isArray(a))return a.filter(x=>x&&typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date))
  }catch(e){}
  return []
}
function snapIdxSave(a){
  return lsSet(SNAP_IDX,JSON.stringify(a))
}
function snapDel(date){
  try{
    localStorage.removeItem(SNAP_PFX+date)
  }catch(e){}
}
function snapMigrate(){
  const old=lsGet(SNAP_KEY);
  if(old==null)return;
  let a=[];
  try{
    a=JSON.parse(old)
  }catch(e){}
  a=(Array.isArray(a)?a:[]).filter(x=>x&&x.progress&&typeof x.progress==='object'&&typeof x.date==='string').slice(0,3);
  /* 先移除舊格式（釋放空間），再一份一份寫成新格式 */
  try{
    localStorage.removeItem(SNAP_KEY);
    localStorage.removeItem(SNAP_KEY+'_meta')
  }catch(e){}
  const idx=snapIdx().filter(m=>!a.some(x=>x.date===m.date));
  a.forEach(x=>{
    if(lsSet(SNAP_PFX+x.date,JSON.stringify(x.progress)))idx.push({date:x.date,savedAt:x.savedAt||'',version:x.version||'',summary:progSummary(x.progress)})
  });
  idx.sort((p,q)=>q.date.localeCompare(p.date));
  while(idx.length>3)snapDel(idx.pop().date);
  snapIdxSave(idx)
}
function snapList(){
  snapMigrate();
  return snapIdx().map(m=>{
    try{
      const p=JSON.parse(lsGet(SNAP_PFX+m.date)||'null');
      return p&&typeof p==='object'&&!Array.isArray(p)?{date:m.date,savedAt:m.savedAt,version:m.version,progress:p}:null
    }catch(e){
      return null
    }
  }).filter(Boolean)
}
function todayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function hasProgress(p){
  return !!p&&['fav','known','wordFav','wordKnown','phKnown','phFav','studyDays'].some(k=>Array.isArray(p[k])&&p[k].length)||!!p&&['wordStatus','reviewDue','wrongWords','sDue','pDue'].some(k=>p[k]&&typeof p[k]==='object'&&Object.keys(p[k]).length)
}
/* 每天第一次開啟時保存一份（保留最近 3 天），在任何轉移或修改之前。raw＝開啟時讀到的原始紀錄文字 */
function takeSnapshot(raw,p){
  const t=todayStr();
  if(lsGet(SNAP_KEY+'_date')===t)return;
  if(!hasProgress(p)||!raw)return;
  snapMigrate();
  let idx=snapIdx();
  if(idx.some(x=>x.date===t)){
    lsSet(SNAP_KEY+'_date',t);
    return
  }
  idx.unshift({date:t,savedAt:new Date().toISOString(),version:APP_VERSION,summary:progSummary(p)});
  while(idx.length>3)snapDel(idx.pop().date);
  /* 自動備份最多用約 3.4M 字元，留空間給學習紀錄本身（瀏覽器上限約 5M） */
  const size=d=>(lsGet(SNAP_PFX+d)||'').length;
  let total=raw.length+idx.slice(1).reduce((s,x)=>s+size(x.date),0);
  while(idx.length>2&&total+raw.length*2>3.4e6){
    const x=idx.pop();
    total-=size(x.date);
    snapDel(x.date)
  }
  while(idx.length){
    if(lsSet(SNAP_PFX+t,raw)){
      snapIdxSave(idx);
      lsSet(SNAP_KEY+'_date',t);
      return
    }
    if(idx.length<=2)break;
    snapDel(idx.pop().date)
  }
  snapIdxSave(idx.filter(x=>x.date!==t));
  lsSet(SNAP_KEY+'_date',t)
}
function snapMeta(){
  snapMigrate();
  return snapIdx().map(m=>({date:m.date,summary:m.summary&&typeof m.summary==='object'?m.summary:{}}))
}
/* V5.27.2：讀取或匯入學習紀錄時，把每個欄位整理成正確的型別（數字、日期、狀態），
   損毀或被竄改的備份檔不會讓畫面出錯，也不會在畫面上執行任何程式碼 */
const _isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const _num=v=>{
  v=Number(v);
  return isFinite(v)?v:undefined
};
const _date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):undefined;
const _id=v=>typeof v==='number'&&isFinite(v)||typeof v==='string'&&v.length<200?v:undefined;
function _map(o,f){
  const r={};
  if(_isObj(o))for(const k of Object.keys(o)){
    const v=f(o[k],k);
    if(v!==undefined)r[k]=v
  }
  return r
}
function normStore(s){
  s=(s&&typeof s==='object'&&!Array.isArray(s))?s:{};
  ['fav','known','wordFav','wordKnown','phFav','phKnown'].forEach(k=>{
    if(Array.isArray(s[k]))s[k]=s[k].filter(v=>_id(v)!==undefined);else if(k[0]!=='p'||s[k]!=null)s[k]=[]
  });
  if(s.studyDays!=null)s.studyDays=Array.isArray(s.studyDays)?s.studyDays.map(_date).filter(Boolean):[];
  const ST={new:1,learning:1,review:1,known:1};
  s.wordStatus=_map(s.wordStatus,v=>ST[v]?v:undefined);
  s.reviewDue=_map(s.reviewDue,_date);
  ['sDue','pDue'].forEach(k=>{
    if(s[k]!=null)s[k]=_map(s[k],_date)
  });
  ['reviewStage','sStage','pStage','wrongWords','lsWrong','sqWrong'].forEach(k=>{
    if(s[k]!=null)s[k]=_map(s[k],_num)
  });
  if(s.dailyLog!=null)s.dailyLog=_map(s.dailyLog,(L,d)=>_date(d)?_map(L,(v,k)=>/Ids$/.test(k)?(Array.isArray(v)?v.filter(x=>_id(x)!==undefined):undefined):_num(v)):undefined);
  if(s.dlgDone!=null)s.dlgDone=_map(s.dlgDone,v=>_date(v)||(v?day0():undefined));
  if(s.rpDone!=null)s.rpDone=_map(s.rpDone,v=>_isObj(v)?{d:_date(v.d)||day0(),me:v.me==='A'?'A':'B',avg:typeof v.avg==='number'&&isFinite(v.avg)?v.avg:null,lv:/^[a-z0-9]{1,12}$/.test(v.lv||'')?v.lv:undefined,pass:_num(v.pass)||0,of:_num(v.of)||0}:undefined);
  if(s.qStat!=null)s.qStat=_map(s.qStat,v=>Array.isArray(v)?[_num(v[0])||0,_num(v[1])||0]:undefined);
  ['quizRight','quizWrong'].forEach(k=>{
    if(s[k]!=null)s[k]=_num(s[k])||0
  });
  if(s.lastExport!=null&&!_date(s.lastExport))delete s.lastExport;
  if(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings))s.settings={dailyGoal:20};
  const g=+s.settings.dailyGoal;
  s.settings.dailyGoal=[10,20,30,50].includes(g)?g:20;
  if(s.settings.theme!=null&&!['auto','light','dark'].includes(s.settings.theme))s.settings.theme='auto';
  /* V5.29.0：每日複習上限、音標顯示、iPhone 加入主畫面提示 */
  if(s.settings.reviewCap!=null&&![0,50,100,200].includes(s.settings.reviewCap))delete s.settings.reviewCap;
  if(s.settings.phon!=null&&!['ipa','kk'].includes(s.settings.phon))delete s.settings.phon;
  if(s.settings.iosTip!=null&&s.settings.iosTip!=='never'&&!_date(s.settings.iosTip))delete s.settings.iosTip;
  if(s.settings.pos!=null)s.settings.pos=_map(s.settings.pos,v=>_num(v)>=0?Math.floor(_num(v)):undefined);
  /* V5.32.0：今日學習自訂、Role Play 複習排程、上次備份時間、備份提醒延後（整理成正確型別） */
  v532Norm(s);
  return s
}
function day0(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function dlgSentences(){
  const out=[];
  const W=window.WORDS||[];
  /* V5.29.0 速度：CE 字先依第一個字分組，每句只掃一次（原本每句逐一比對全部 CE 字，開啟 App 時約多花 0.1 秒） */
  const first=new Map();
  W.filter(x=>x.k===7&&!x.b).forEach((x,k)=>{
    const p=x.w.toLowerCase().split(' ');
    if(!first.has(p[0]))first.set(p[0],[]);
    first.get(p[0]).push([x.w,p,k])
  });
  (window.DIALOGS||[]).forEach(d=>d.lines.forEach((L,n)=>{
    const t=L.en.toLowerCase().replace(/[^a-z0-9-]/g,' ').split(' ').filter(Boolean);
    const hit=new Set();
    t.forEach((w,j)=>{
      const cs=first.get(w);
      if(cs)cs.forEach(c=>{
        if(c[1].every((p,q)=>t[j+q]===p))hit.add(c)
      })
    });
    /* V5.32.0：去掉被較長關鍵字包含的字（leak／leak detection）；不到 2 個時，補上句子裡較進階的字 */
    const keys=kwDedupe([...hit].sort((a,b)=>a[2]-b[2]).map(c=>c[0])).slice(0,2);
    const tk=L.en.replace(/[^A-Za-z0-9'-]/g,' ').split(' ').filter(Boolean);
    if(keys.length<2)kwFill(tk,keys,2,true);
    if(!keys.length)kwFill(tk,keys,1,true,300);
    out.push({id:'d:'+d.id+':'+n,en:L.en,zh:L.zh,keys,src:'dialog',dlg:d.id,who:L.s,kzh:d.t})
  }));
  return out
}
/* V5.29.0：無線電用語練習句（句子頁可以聽、跟讀、用 🎤 評分） */
function radioSents(){
  /* V5.32.0：關鍵字＝句子裡的無線電用語（Copy、Say again…）＋較進階的字 */
  const R=window.RADIO||{},KXo=window.KEYX=window.KEYX||{};
  const pro=(R.pro||[]).map(p=>[p.en.replace(/[.?!]+$/,''),p.zh.replace(/。$/,'')]);
  return (R.sent||[]).map(r=>{
    const low=' '+r.en.toLowerCase().replace(/[^a-z0-9' -]/g,' ').replace(/\s+/g,' ')+' ',keys=[];
    pro.forEach(([en,zh])=>{
      if(keys.length<2&&low.includes(' '+en.toLowerCase()+' ')){
        keys.push(en);
        KXo[en]=KXo[en]||{p:'',pos:'無線電用語',zh}
      }
    });
    if(/I spell/i.test(r.en))(R.abc||[]).map(v=>[r.en.search(new RegExp('(^|[^A-Za-z])'+v[1]+'([^A-Za-z]|$)')),v]).filter(h=>h[0]>=0).sort((p,q)=>p[0]-q[0]).forEach(([n,v])=>{
      if(keys.length<2){
        keys.push(v[1]);
        KXo[v[1]]=KXo[v[1]]||{p:'',pos:'字母代碼',zh:v[0]+'（無線電拼字）'}
      }
    });
    const tk=r.en.replace(/[^A-Za-z0-9'-]/g,' ').split(' ').filter(Boolean);
    if(keys.length<2)kwFill(tk,keys,2,true);
    if(!keys.length)kwFill(tk,keys,1,true,300);
    return {id:'r:'+r.id,en:r.en,zh:r.zh,keys,src:'radio'}
  })
}
/* V5.29.0：多益第二個例句（較長的職場例句），例句檔載入後補進句子清單 */
function wordSents2(){
  return WORDS.filter(x=>x.ex2).map(x=>({id:'x:'+x.w,en:x.ex2,zh:x.exz2,keys:[x.w],src:'word2',book:x.k,toeic:x.toeic}))
}
function loadStore(){
  let raw=lsGet(STORE_KEY)||lsGet('english5000v3'),s=null;
  if(raw){
    try{
      s=JSON.parse(raw)
    }catch(e){
      s=null;
      const kept=lsSet('english5000v5_corrupt_'+Date.now(),raw);
      const sn=snapList()[0];
      if(sn){
        s=JSON.parse(JSON.stringify(sn.progress));
        window.__storeNote='⚠️ 學習紀錄檔案損毀，已自動改用 '+sn.date+' 的自動備份。'
      }else window.__storeNote='⚠️ 學習紀錄檔案損毀，無法讀取；'+(kept?'原始內容已另存，':'')+'請匯入備份檔。';
      s=normStore(s);
      raw=JSON.stringify(s);
      lsSet(STORE_KEY,raw)
    }
  }
  s=normStore(s);
  try{
    takeSnapshot(raw,s)
  }catch(e){}
  return s
}
const $=s=>document.querySelector(s), store=loadStore();
store.wordFav=store.wordFav||[];
store.wordKnown=store.wordKnown||[];
store.wordStatus=store.wordStatus||{};
store.reviewDue=store.reviewDue||{};
store.settings=store.settings||{dailyGoal:20};
/* V5.20.0：單字例句另外放在 data-ex.js，開啟後才載入；載入前句子清單先不含單字例句 */
function wordSents(){
  return WORDS.filter(x=>x.ex).map(x=>({id:'w:'+x.w,en:x.ex,zh:x.exz,keys:[x.w],src:'word',book:x.k,toeic:x.toeic}))
}
let EX_READY=WORDS.length>0&&WORDS.every(x=>x.ex);
let EX_FAIL=false;
const ALLS=[...SENTENCES.map(s=>Object.assign({src:'core'},s)),...wordSents(),...PHRASES.map(x=>({id:'p:'+x.id,en:x.ex,zh:x.exz,keys:[x.p],kzh:x.zh,src:'phrase',cat:x.cat})),...dlgSentences(),...radioSents()];
const SRC_LABEL={core:'精選',word:'單字例句',phrase:'片語例句',dialog:'對話句',word2:'多益長例句',radio:'無線電用語'};
/* 需要單字例句才完整的句子單元（例句載入前不保存這些單元的位置） */
function exNeeded(u){
  return !/^(all|life|ce|pall|pdaily|pwork|pce|pmail|dall|d\d\d|radio)$/.test(u||'')
}
function inUnit(s,u){
  if(u==='every')return true;
  if(u==='lsw')return !!(store.lsWrong&&store.lsWrong[s.id]);
  if(u==='dall')return s.src==='dialog';
  if(/^d\d\d$/.test(u))return s.dlg===u;
  if(u==='all')return s.src==='core';
  if(u==='life'||u==='ce')return s.src==='core'&&s.cat===u;
  if(u==='sdue')return isSDue(s.id);
  if(u==='wall')return s.src==='word'&&s.book<=5;
  if(/^w[1-8]$/.test(u))return s.src==='word'&&s.book===+u[1];
  if(u==='wt')return s.src==='word'&&!!s.toeic;
  if(u==='wt2')return s.src==='word2';
  if(u==='radio')return s.src==='radio';
  if(u==='pall')return s.src==='phrase';
  if(/^p(daily|work|ce|mail)$/.test(u))return s.src==='phrase'&&s.cat===u.slice(1);
  if(u==='fav')return cset('fav').has(s.id);
  return s.src==='core'
}
let pool=ALLS.filter(s=>s.src==='core'),i=0,slow=false,voices=[],deferred;/* V5.16.16 效能：存檔延後 0.25 秒合併成一次（離開、切到背景、重新載入前一定立刻存）；
   已熟／收藏等清單改用快取查詢，避免每次在數千筆陣列裡逐一比對 */
let STV=0,_svT=0,_svLock=false;
const _cs={};
/* V5.27.2：空間不足時依序清掉：損毀檔備份 → 匯入前備份 → 最舊的每日自動備份，再存一次 */
function freeSpaceFor(txt){
  const steps=[()=>{
    let n=0;
    try{
      Object.keys(localStorage).filter(k=>k.startsWith('english5000v5_corrupt_')).forEach(k=>{
        localStorage.removeItem(k);
        n++
      })
    }catch(e){}
    return n
  },()=>lsGet(PRE_KEY)!=null?(localStorage.removeItem(PRE_KEY),1):0];
  for(const f of steps){
    try{
      if(f()&&lsSet(STORE_KEY,txt))return true
    }catch(e){}
  }
  try{
    if(lsGet(SNAP_KEY)!=null){
      localStorage.removeItem(SNAP_KEY);
      localStorage.removeItem(SNAP_KEY+'_meta');
      if(lsSet(STORE_KEY,txt))return true
    }
  }catch(e){}
  let idx=snapIdx();
  while(idx.length){
    snapDel(idx.pop().date);
    snapIdxSave(idx);
    if(lsSet(STORE_KEY,txt))return true
  }
  return false
}
function saveNow(){
  clearTimeout(_svT);
  _svT=0;
  if(_svLock)return;
  const txt=JSON.stringify(store);
  if(lsSet(STORE_KEY,txt)||freeSpaceFor(txt)){
    window.__quotaWarned=0;
    return
  }
  if(!window.__quotaWarned){
    window.__quotaWarned=1;
    setTimeout(()=>alert('⚠️ 手機儲存空間不足，學習紀錄無法儲存。請到「統計 › 資料備份」匯出備份檔，並清理瀏覽器空間。'),0)
  }
}
const save=()=>{
  STV++;
  if(!_svT&&!_svLock)_svT=setTimeout(saveNow,250)
};
function saveLock(){
  clearTimeout(_svT);
  _svT=0;
  _svLock=true
}
const flushSave=()=>{
  if(_svT)saveNow()
};
addEventListener('pagehide',flushSave);
/* V5.27.2：另一個分頁（或加入主畫面的 App）更新了學習紀錄：這邊不再存檔，重新載入讀最新的紀錄 */
let _stale=false;
addEventListener('storage',e=>{
  if(e.key!==STORE_KEY||!e.newValue||(_svLock&&!_stale))return;
  if(e.newValue===JSON.stringify(store))return;
  saveLock();
  _stale=true;
  if(!document.hidden)syncReload()
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&_stale)syncReload()
});
function syncReload(){
  try{
    const now=Date.now(),a=JSON.parse(sessionStorage.getItem('e5k_syncN')||'[]').filter(t=>now-t<20000);
    if(a.length>=3){
      if(!window.__syncWarned){
        window.__syncWarned=1;
        alert('⚠️ 另一個分頁（或 App）也開著 English 5000 並在更新學習紀錄。這個分頁先暫停存檔，請關閉其他分頁後重新整理。')
      }
      return
    }
    a.push(now);
    sessionStorage.setItem('e5k_syncN',JSON.stringify(a))
  }catch(x){}
  location.reload()
}
addEventListener('beforeunload',flushSave);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)flushSave()
});
function debounce(f,ms){
  let t;
  return()=>{
    clearTimeout(t);
    t=setTimeout(f,ms)
  }
}
function cset(k){
  const a=store[k]||[];
  const c=_cs[k];
  if(c&&c.v===STV&&c.a===a&&c.n===a.length)return c.s;
  const st=new Set(a);
  _cs[k]={v:STV,a,n:a.length,s:st};
  return st
}
function voiceLoad(){
  voices=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
  if(window.fillVoices)setTimeout(()=>{
    try{
      fillVoices()
    }catch(e){}
  },0)
}
function pickVoice(){
  let pref=store.settings&&store.settings.voice;
  let v=voices.find(x=>x.voiceURI===pref);
  if(v)return v;
  const us=voices.filter(x=>/en[-_]US/i.test(x.lang));
  const good=/Samantha|Aria|Jenny|Google US English|Ava|Allison|Zira/i;
  return us.find(x=>good.test(x.name))||us[0]||voices[0]
}
speechSynthesis.onvoiceschanged=voiceLoad;
voiceLoad();
let sayTok=0;
function say(t,rate=1,times=1,done){
  speechSynthesis.cancel();
  const tok=++sayTok;
  let n=0;
  function go(){
    if(tok!==sayTok)return;
    const u=new SpeechSynthesisUtterance(t);
    u.lang='en-US';
    u.rate=rate;
    const pv=pickVoice();
    if(pv){
      u.voice=pv;
      u.lang=pv.lang
    }
    let fin=false;
    const next=()=>{
      if(fin||tok!==sayTok)return;
      fin=true;
      if(++n<times)setTimeout(go,250);else done&&done()
    };
    u.onend=next;
    /* V5.27.2：朗讀失敗（沒有語音、引擎忙碌）也要往下走，例如「⇄ 範例→我」仍會播放自己的錄音 */
    u.onerror=e=>{
      if(e&&(e.error==='interrupted'||e.error==='canceled'))return;
      next()
    };
    speechSynthesis.speak(u);
    setTimeout(()=>{
      if(!speechSynthesis.speaking&&!speechSynthesis.pending)next()
    },Math.max(2500,t.length*140/rate))
  }
  go()
}
function cur(){
  return pool[i]||SENTENCES[0]
}
const WMAP={};
WORDS.forEach(x=>WMAP[x.w]=x);
function dispW(w){
  let x=WMAP[w];
  return x&&x.d?x.d:w
}
const KX=window.KEYX||{};
function ipaFor(w){
  let k=w.toLowerCase(),x=WMAP[w]||KX[w]||WMAP[k]||KX[k];
  return x?x.p:''
}
function render(){
  let s=cur();
  if(typeof lkClose==='function')lkClose();
  if(window.voiceOnRender)window.voiceOnRender(s.id);
  $('#english').textContent=s.en;
  $('#chinese').textContent=s.zh;
  $('#chinese').hidden=true;
  $('#progress').textContent=`${SRC_LABEL[s.src]||'句子'} ${i+1} / ${pool.length}`;
  if(store.settings.pos){
    const uk=$('#unit').value;
    if(exOk(uk)&&store.settings.pos[uk]!==i){
      store.settings.pos[uk]=i;
      save()
    }
  }
  $('#fav').textContent=(store.fav.includes(s.id)?'★':'☆')+' 收藏';
  $('#known').textContent=(store.known.includes(s.id)?'✓ 已會說':'✓ 我會說了');
  $('#sReview').hidden=!isSDue(s.id);
  $('#result').textContent='按下後朗讀上面的英文句子';
  if(window.rpRender)window.rpRender(s);
  {
    const kw=$('#keywords'),kh=kw&&kw.previousElementSibling,emp=!(s.keys&&s.keys.length);
    if(kw)kw.hidden=emp;
    if(kh&&kh.tagName==='H2')kh.hidden=emp
  }
  $('#keywords').innerHTML=s.keys.map(w=>`<div class="key"><div><strong>${dispW(w)}</strong><span>${ipaFor(w)?'/ '+esc(phon(ipaFor(w)))+' /':''}</span><span class="kzh">${esc((WMAP[w]&&WMAP[w].zh)||(KX[w]&&KX[w].pos+' '+KX[w].zh)||s.kzh||'')}</span></div><button data-word="${w}">🔊</button></div>`).join('')
}
function toggle(k){
  let id=cur().id,a=store[k],n=a.indexOf(id);
  n<0?a.push(id):a.splice(n,1);
  if(k==='known'){
    if(n<0)srsSet('s',id,1);else srsDel('s',id)
  }
  save();
  filter();
  render()
}
function filter(){
  let u=$('#unit').value,hk=$('#hideKnown').checked,kn=cset('known');
  pool=u==='search'?searchPool.slice():ALLS.filter(s=>inUnit(s,u)).filter(s=>!(hk&&kn.has(s.id)&&!isSDue(s.id)));
  if(u==='wt')pool.sort((p,q)=>p.toeic-q.toeic);
  i=Math.min(i,Math.max(0,pool.length-1));
  if(!pool.length){
    /* V5.27.2：這個範圍沒有句子時明確提示（原本默默換成精選句子，沒有任何說明） */
    const EMPTY={sdue:'🎉 目前沒有到期要複習的句子。',lsw:'🎉 目前沒有測驗答錯的句子。',fav:'目前還沒有收藏的句子（在句子下方按「☆ 收藏」）。',search:'找不到符合的句子。'};
    const msg=EMPTY[u]||(exNeeded(u)&&!EX_READY?(EX_FAIL?'單字例句下載失敗（網路不穩），請連上網路後重新開啟 App。':'單字例句還在下載，請稍等幾秒再選一次。'):hk?'這個範圍的句子都已標記「會說了」（目前勾選「只看未會說」）。':'這個範圍目前沒有句子。');
    pool=ALLS.filter(s=>s.src==='core');
    i=0;
    let rp=false;
    try{
      rp=RP.on
    }catch(e){}
    if(!rp){
      unitNote(msg+'先顯示精選句子。');
      filter.noted=true
    }
  }else if(filter.noted){
    filter.noted=false;
    unitNote('')
  }
}
function unitNote(t){
  const el=$('#unitNote');
  if(!el)return;
  el.textContent=t||'';
  el.hidden=!t;
  clearTimeout(unitNote.t);
  if(t)unitNote.t=setTimeout(()=>{
    el.hidden=true
  },9000)
}
$('#play').onclick=()=>say(cur().en,slow?.67:1);
$('#slow').onclick=()=>{
  slow=!slow;
  $('#slow').textContent='🐢 慢速：'+(slow?'開':'關');
  say(cur().en,slow?.67:1)
};
$('#showZh').onclick=()=>$('#chinese').hidden=!$('#chinese').hidden;
$('#repeat').onclick=()=>say(cur().en,slow?.67:1,3);
$('#prev').onclick=()=>{
  if(window.rpNav&&window.rpNav(-1))return;
  i=(i-1+pool.length)%pool.length;
  render()
};
$('#next').onclick=()=>{
  if(window.rpNav&&window.rpNav(1))return;
  i=(i+1)%pool.length;
  render()
};
$('#fav').onclick=()=>toggle('fav');
$('#known').onclick=()=>{
  const id=cur().id;
  let was=store.known.includes(id);
  toggle('known');
  markStudy();
  logMark('sent',id,!was)
};
store.settings.pos=store.settings.pos||{};
$('#unit').onchange=()=>{
  if(window.rpOff)window.rpOff();
  unitNote('');
  let u=$('#unit').value;
  if(u!=='search')store.settings.unit=u;
  /* V5.31.1：記住最後一個一般的句子範圍（今日學習的「句子跟讀」用） */
  if(!/^(sdue|lsw|fav|search)$/.test(u))store.settings.learnUnit=u;
  i=store.settings.pos[u]||0;
  save();
  filter();
  render()
};
/* V5.16.20：重新篩選時盡量停在同一句 */
function refilter(){
  const id=cur().id;
  filter();
  const k=pool.findIndex(s=>s.id===id);
  if(k>=0)i=k
}
$('#hideKnown').onchange=()=>{
  store.settings.hideKnown=$('#hideKnown').checked;
  save();
  refilter();
  render()
};
$('#keywords').onclick=e=>{
  let w=e.target.dataset.word;
  if(w)say(w,.85)
};
$('#result').addEventListener('click',e=>{
  let b=e.target.closest('[data-say]');
  if(b)say(b.dataset.say,.75)
});/* ===== V5.16：語音模組（錄音＋辨識）=====
   每次錄音都是新的 session：重新取得麥克風、新的 MediaRecorder、新的 chunks；
   停止後關閉麥克風、釋放舊的錄音網址；任何失敗都會把按鈕恢復成可再按的狀態。 */
const VOICE={sr:null,srTimer:null,srBusy:false,lastId:null};
const REC={state:'idle',seq:0,stream:null,mr:null,parts:[],type:'',url:null,sid:null,timer:null,guard:null,idle:null,done:0,player:null,maxMs:30000,keepMs:60000,ctx:null,src:null,proc:null,bufs:[],rate:0,mic:'',diag:'',n:0};
/* V5.16.6 錄音：同時用 MediaRecorder 與 Web Audio(WAV) 兩種方式收音，自動採用有聲音的那一個；
   麥克風在錄完後保留 60 秒，連續錄音時沿用，不再每次重新取得（iPhone 重新取得常會變成靜音）。 */
const RAC=window.AudioContext||window.webkitAudioContext;
/* V5.16.7：iPhone 播放聲音後會把網頁切成「只播放」模式，之後麥克風只收到靜音。
   第一次用麥克風起，就把網頁音訊設為「播放＋錄音」模式並保持，播放後仍可收音。 */
function audioSessPR(){
  try{
    if(navigator.audioSession&&navigator.audioSession.type!=='play-and-record')navigator.audioSession.type='play-and-record'
  }catch(e){}
}
function audioSessInfo(){
  try{
    return navigator.audioSession?('音訊模式 '+navigator.audioSession.type+(navigator.audioSession.state?'/'+navigator.audioSession.state:'')):'音訊模式 不支援設定'
  }catch(e){
    return '音訊模式 ?'
  }
}
function micReload(){
  try{
    saveNow();
    sessionStorage.setItem('e5k_rl',String(Date.now()));
    store.settings.pos=store.settings.pos||{};
    const uv=$('#unit').value;
    if(uv&&uv!=='search')store.settings.unit=uv;
    store.settings.pos[uv]=i;
    saveNow();
    sessionStorage.setItem('e5k_go','practice')
  }catch(e){}
  location.reload()
}
function recMsg(t,kind,reload){
  const el=$('#recMsg');
  if(!el)return;
  el.textContent=t||'';
  el.className='rec-msg'+(kind?' '+kind:'');
  el.hidden=!t;
  if(reload){
    const b=document.createElement('button');
    b.className='mini rec-reload';
    b.textContent='🔄 重新啟動麥克風（重新載入，回到同一句）';
    b.onclick=micReload;
    el.appendChild(document.createElement('br'));
    el.appendChild(b)
  }
}
function recUI(st){
  REC.state=st;
  const b=$('#record');
  if(!b)return;
  b.disabled=(st==='starting'||st==='stopping');
  b.textContent={idle:REC.url?'🎙 重新錄音':'🎙 開始錄音',starting:'⏳ 開啟麥克風…',recording:'■ 停止錄音',stopping:'⏳ 處理中…'}[st]||'🎙 開始錄音';
  b.classList.toggle('rec-on',st==='recording');
  const can=!!REC.url&&st==='idle';
  $('#mine').disabled=!can;
  $('#compare').disabled=!can
}
function recNodes(){
  if(REC.proc){
    try{
      REC.proc.onaudioprocess=null;
      REC.proc.disconnect()
    }catch(e){}
  }
  if(REC.src){
    try{
      REC.src.disconnect()
    }catch(e){}
  }
  REC.proc=REC.src=null;
  if(REC.ctx){
    const c=REC.ctx;
    REC.ctx=null;
    try{
      c.close().catch(()=>{})
    }catch(e){}
  }
}
function recRelease(){
  recNodes();
  clearTimeout(REC.timer);
  clearTimeout(REC.guard);
  clearTimeout(REC.idle);
  REC.timer=REC.guard=REC.idle=null;
  if(REC.stream){
    try{
      REC.stream.getTracks().forEach(t=>{
        t.onended=null;
        t.stop()
      })
    }catch(e){}
  }
  REC.stream=null
}
function recKeep(){
  recNodes();
  clearTimeout(REC.timer);
  clearTimeout(REC.guard);
  REC.timer=REC.guard=null;
  clearTimeout(REC.idle);
  REC.idle=setTimeout(()=>{
    if(REC.state==='idle')recRelease()
  },REC.keepMs)
}
function recStopPlayback(){
  try{
    if(REC.player){
      REC.player.pause()
    }
  }catch(e){}
  try{
    if(window.speechSynthesis&&(speechSynthesis.speaking||speechSynthesis.pending))speechSynthesis.cancel()
  }catch(e){}
}
function recErrText(e){
  const n=(e&&e.name)||'';
  if(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError')return '🚫 麥克風權限被拒絕。iPhone：設定 › Safari › 麥克風 › 允許（或網址列「aA › 網站設定 › 麥克風」）；Chrome：網址列左側 🔒 › 麥克風 › 允許。改好後再按一次「錄音」。';
  if(n==='NotFoundError'||n==='DevicesNotFoundError')return '🎙 找不到麥克風，請確認手機或耳機麥克風可用。';
  if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')return '🎙 麥克風正被其他 App 或通話使用，請關閉後再按一次「錄音」。';
  return '⚠️ 無法開始錄音（'+(n||(e&&e.message)||'未知錯誤')+'），請再按一次「錄音」重試。'
}
function recSupported(){
  if(!window.isSecureContext&&location.hostname!=='localhost')return '⚠️ 錄音需要 https 網址（請用 GitHub Pages 網址開啟）。';
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return '⚠️ 這個瀏覽器不支援麥克風錄音，請改用 Safari（iPhone）或 Chrome（Android）。';
  if(!RAC&&!window.MediaRecorder)return '⚠️ 這個瀏覽器不支援錄音功能，請更新 iOS／瀏覽器，或改用 Safari／Chrome。';
  return ''
}
function recLive(){
  const s=REC.stream;
  if(!s)return false;
  const t=s.getAudioTracks()[0];
  return !!t&&t.readyState==='live'&&!t.muted&&t.enabled!==false
}
function wavBlob(bufs,rate){
  let n=0;
  bufs.forEach(b=>n+=b.length);
  const out=16000,ratio=rate>out?rate/out:1,len=Math.floor(n/ratio),sr=Math.round(rate/ratio);
  const all=new Float32Array(n);
  let o=0;
  bufs.forEach(b=>{
    all.set(b,o);
    o+=b.length
  });
  const pcm=new Int16Array(len);
  let peak=0;
  for(let k=0;k<len;k++){
    const st=Math.floor(k*ratio),en=Math.min(n,Math.floor((k+1)*ratio));
    let sum=0,c=0;
    for(let j=st;j<en;j++){
      sum+=all[j];
      c++
    }
    let v=c?sum/c:all[st]||0;
    if(Math.abs(v)>peak)peak=Math.abs(v);
    v=Math.max(-1,Math.min(1,v));
    pcm[k]=v<0?v*0x8000:v*0x7fff
  }
  const buf=new ArrayBuffer(44+len*2),dv=new DataView(buf),ws=(p,s)=>{
    for(let k=0;k<s.length;k++)dv.setUint8(p+k,s.charCodeAt(k))
  };
  ws(0,'RIFF');
  dv.setUint32(4,36+len*2,true);
  ws(8,'WAVE');
  ws(12,'fmt ');
  dv.setUint32(16,16,true);
  dv.setUint16(20,1,true);
  dv.setUint16(22,1,true);
  dv.setUint32(24,sr,true);
  dv.setUint32(28,sr*2,true);
  dv.setUint16(32,2,true);
  dv.setUint16(34,16,true);
  ws(36,'data');
  dv.setUint32(40,len*2,true);
  new Int16Array(buf,44).set(pcm);
  return {blob:new Blob([buf],{type:'audio/wav'}),secs:len/sr,peak}
}
async function recStart(){
  if(REC.state!=='idle')return;
  const bad=recSupported();
  if(bad){
    recMsg(bad,'warn');
    return
  }
  srKill();
  recStopPlayback();
  clearTimeout(REC.idle);
  audioSessPR();
  let ctx=null;
  if(RAC){
    try{
      ctx=new RAC();
      if(ctx.resume)ctx.resume().catch(()=>{})
    }catch(e){
      ctx=null
    }
  }
  const my=++REC.seq;
  REC.done=0;
  REC.sid=cur().id;
  recUI('starting');
  recMsg('');
  let stream;
  if(recLive()){
    stream=REC.stream;
    REC.mic='沿用'
  }else{
    if(REC.stream)recRelease();
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true})
    }catch(e){
      if(ctx){
        try{
          ctx.close()
        }catch(x){}
      }
      if(my===REC.seq){
        recRelease();
        recUI('idle');
        recMsg(recErrText(e),'warn')
      }
      return
    }
    REC.mic='新取得'
  }
  if(my!==REC.seq||REC.state!=='starting'){
    if(ctx){
      try{
        ctx.close()
      }catch(x){}
    }
    if(REC.stream!==stream)stream.getTracks().forEach(t=>t.stop());
    return
  }
  REC.stream=stream;
  stream.getTracks().forEach(t=>t.onended=()=>{
    if(my===REC.seq&&REC.state==='recording')recStop();else if(REC.stream===stream)REC.stream=null
  });
  let started=0;
  REC.parts=[];
  REC.mr=null;
  REC.bufs=[];
  REC.rate=0;
  REC.ctx=ctx;
  try{
    if(window.MediaRecorder){
      const parts=REC.parts;
      const mt=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
      const r=mt?new MediaRecorder(stream,{mimeType:mt}):new MediaRecorder(stream);
      REC.type=r.mimeType||mt||'';
      r.ondataavailable=e=>{
        if(e.data&&e.data.size)parts.push(e.data)
      };
      r.onstop=()=>{
        r.__stopped=true;
        if(my===REC.seq&&REC.state==='stopping')recFinish(my)
      };
      r.onerror=()=>{
        r.__err=true
      };
      REC.mr=r;
      r.start(1000);
      started++
    }
  }catch(e){
    REC.mr=null
  }
  try{
    if(ctx){
      if(ctx.state!=='running'){
        /* V5.27.2：最多等 1.5 秒（部分手機的音訊會一直等不到，按鈕卡在「開啟麥克風…」） */
        try{
          await Promise.race([ctx.resume(),new Promise(r=>setTimeout(r,1500))])
        }catch(e){}
      }
      if(my!==REC.seq)return;
      const src=ctx.createMediaStreamSource(stream);
      const proc=(ctx.createScriptProcessor||ctx.createJavaScriptNode).call(ctx,4096,1,1);
      const bufs=REC.bufs;
      proc.onaudioprocess=e=>{
        if(my===REC.seq&&REC.state==='recording')bufs.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      REC.src=src;
      REC.proc=proc;
      REC.rate=ctx.sampleRate;
      started++
    }
  }catch(e){
    recNodes()
  }
  if(!started){
    recFail(my,'⚠️ 無法開始錄音，請再按一次「錄音」重試。');
    return
  }
  recUI('recording');
  recMsg('🔴 錄音中…念完後按「■ 停止錄音」（最長 '+REC.maxMs/1000+' 秒）','on');
  REC.timer=setTimeout(()=>{
    if(my===REC.seq&&REC.state==='recording')recStop()
  },REC.maxMs)
}
function recStop(){
  if(REC.state==='starting'){
    REC.seq++;
    recRelease();
    recUI('idle');
    recMsg('已取消錄音。');
    return
  }
  if(REC.state!=='recording')return;
  const my=REC.seq;
  recUI('stopping');
  clearTimeout(REC.timer);
  const r=REC.mr;
  if(r&&r.state!=='inactive'){
    try{
      r.stop()
    }catch(e){}
    REC.guard=setTimeout(()=>recFinish(my),4000)
  }else{
    REC.guard=setTimeout(()=>recFinish(my),150)
  }
}
function recFinish(my){
  if(my!==REC.seq||REC.done===my)return;
  REC.done=my;
  const bufs=REC.bufs,parts=REC.parts,type=REC.type||(parts[0]&&parts[0].type)||'audio/mp4',hadWav=!!REC.proc||bufs.length>0,hadMr=!!REC.mr,rate=REC.rate;
  REC.bufs=[];
  REC.parts=[];
  REC.mr=null;
  recKeep();
  const w=hadWav&&bufs.length?wavBlob(bufs,rate):null;
  const mb=hadMr?new Blob(parts,{type}):null;
  const wavOk=w&&w.secs>=0.3&&w.peak>=0.004,mrOk=mb&&mb.size>2000;
  let blob=null,use='',warn='';
  if(wavOk){
    blob=w.blob;
    use='WAV'
  }else if(mrOk){
    blob=mb;
    use='MediaRecorder'
  }else if(w&&w.secs>=0.3){
    blob=w.blob;
    use='WAV';
    warn='（聲音非常小，可能沒有收到聲音）'
  }else if(mb&&mb.size>0){
    blob=mb;
    use='MediaRecorder';
    warn='（檔案很小，可能沒有收到聲音）'
  }
  const tk=REC.stream&&REC.stream.getAudioTracks()[0];
  REC.diag='MediaRecorder '+(mb?Math.round(mb.size/1024)+' KB':'無')+'｜WAV '+(w?w.secs.toFixed(1)+' 秒 音量 '+Math.round(w.peak*100)+'%':'無')+'｜採用 '+(use||'無')+'｜麥克風 '+REC.mic+(tk?(tk.muted?' 靜音中':'')+(tk.readyState!=='live'?' 已結束':''):'')+'｜'+audioSessInfo();
  const silent=!wavOk&&!mrOk;
  if(silent){
    recRelease()
  }
  if(!blob){
    recUI('idle');
    recMsg('⚠️ 沒有錄到聲音。手機可能暫時停止提供麥克風聲音，請按下方按鈕重新啟動。\n（診斷：'+REC.diag+'）','warn',true);
    return
  }
  if(REC.url){
    try{
      URL.revokeObjectURL(REC.url)
    }catch(e){}
  }
  REC.url=URL.createObjectURL(blob);
  REC.n++;
  recUI('idle');
  if(silent)recMsg('⚠️ 第 '+REC.n+' 次錄音沒有收到聲音（音量 0%）。手機可能暫時停止提供麥克風聲音，請按下方按鈕重新啟動後再錄。\n（診斷：'+REC.diag+'）','warn',true);else recMsg('✅ 第 '+REC.n+' 次錄好了：按「▶ 我的聲音」或「⇄ 範例→我」；想再錄就按「🎙 重新錄音」。'+warn+'\n（診斷：'+REC.diag+'）',warn?'warn':'ok')
}
function recFail(my,msg){
  if(my!==REC.seq)return;
  REC.done=my;
  try{
    if(REC.mr&&REC.mr.state!=='inactive')REC.mr.stop()
  }catch(e){}
  REC.mr=null;
  recRelease();
  REC.parts=[];
  REC.bufs=[];
  recUI('idle');
  recMsg(msg,'warn')
}
function recDiscard(){
  if(REC.state==='recording'||REC.state==='starting'||REC.state==='stopping'){
    REC.seq++;
    try{
      if(REC.mr&&REC.mr.state!=='inactive')REC.mr.stop()
    }catch(e){}
    REC.mr=null;
    recKeep();
    REC.parts=[];
    REC.bufs=[]
  }
  recStopPlayback();
  if(REC.url){
    try{
      URL.revokeObjectURL(REC.url)
    }catch(e){}
    REC.url=null
  }
  REC.sid=null;
  recUI('idle');
  recMsg('')
}
function recPlay(){
  if(!REC.url||REC.state!=='idle')return;
  if(!REC.player)REC.player=new Audio();
  const p=REC.player;
  try{
    p.pause()
  }catch(e){}
  p.src=REC.url;
  try{
    p.load()
  }catch(e){}
  const pr=p.play();
  if(pr&&pr.catch)pr.catch(()=>recMsg('⚠️ 無法播放錄音，請確認手機不是靜音模式，或再錄一次。','warn'))
}
$('#record').onclick=()=>{
  if(REC.state==='recording'||REC.state==='starting')recStop();else recStart()
};
$('#mine').onclick=()=>{
  recStopPlayback();
  recPlay()
};
$('#compare').onclick=()=>{
  if(!REC.url||REC.state!=='idle')return;
  recStopPlayback();
  say(cur().en,1,1,()=>recPlay())
};
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(REC.state==='recording'||REC.state==='starting')recStop();else if(REC.state==='idle')recRelease();
    srKill()
  }
});
/* 跟讀辨識：每次新建 SpeechRecognition；再按一次停止；10 秒自動停止；結束後按鈕一定恢復 */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
/* V5.27.2：「每次載入只能辨識一次、要重新載入」是 iPhone／iPad（Safari 引擎）的限制；Android Chrome 每念完一句辨識就會結束，屬於正常，不用重新載入 */
const SR_WEBKIT=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||(/Safari\//.test(navigator.userAgent)&&!/Chrome\/|Chromium\/|Edg\/|OPR\/|Android/.test(navigator.userAgent));
function srBtn(on){
  const b=$('#check');
  if(b){
    b.textContent=on?'■ 停止聆聽':'🎤 開始念，幫我檢查';
    b.classList.toggle('rec-on',on)
  }
}
function srErrText(c){
  return({'not-allowed':'🚫 麥克風或語音辨識權限被拒絕。iPhone 需開啟：設定 › 一般 › 鍵盤 › 啟用聽寫，並允許 Safari 使用麥克風。','service-not-allowed':'🚫 語音辨識服務未開啟。iPhone：設定 › 一般 › 鍵盤 › 啟用聽寫。','no-speech':'🤔 沒有聽到聲音，請靠近麥克風再按一次。','audio-capture':'🎙 找不到麥克風，或麥克風正被其他 App 使用。','network':'📶 語音辨識需要網路，請確認連線後再試。','aborted':'已停止聆聽。'})[c]||('無法辨識：'+c+'，請再按一次重試。')
}
/* V5.16.19：🎤 評分 — 數字、時間、縮寫、連字號名稱都能對上（例：2:15 ↔ two fifteen、What's ↔ what is、UPS-2A ↔ UPS 2 A） */
const SC_NUM=Object.assign(Object.create(null),{zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90});
const SC_CON=Object.assign(Object.create(null),{"what's":"what is","that's":"that is","it's":"it is","there's":"there is","here's":"here is","where's":"where is","who's":"who is","how's":"how is","he's":"he is","she's":"she is","let's":"let us","i'm":"i am","you're":"you are","we're":"we are","they're":"they are","i'll":"i will","you'll":"you will","we'll":"we will","they'll":"they will","it'll":"it will","that'll":"that will","i've":"i have","you've":"you have","we've":"we have","they've":"they have","i'd":"i would","you'd":"you would","we'd":"we would","don't":"do not","doesn't":"does not","didn't":"did not","can't":"can not","won't":"will not","isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not","haven't":"have not","hasn't":"has not","hadn't":"had not","shouldn't":"should not","couldn't":"could not","wouldn't":"would not","mustn't":"must not","cannot":"can not","okay":"ok"});
function scTok(text){
  let t=String(text||'').toLowerCase().replace(/[’‘`]/g,"'");
  t=t.replace(/\b([ap])\.\s?m\b\.?/g,' $1m ').replace(/\bo\.k\.?/g,' ok ');
  t=t.replace(/[a-z]+'[a-z]+/g,w=>SC_CON[w]||w.replace(/'/g,''));
  let raw=t.replace(/[^a-z0-9]+/g,' ').split(' ').filter(Boolean),out=[];
  raw.forEach(w=>{
    const c=SC_CON[w];
    if(c){
      out.push(...c.split(' '));
      return
    }
    if(w==='hundred'){
      out.push('hundred');
      return
    }
    if(w in SC_NUM){
      out.push(String(SC_NUM[w]));
      return
    }
    out.push(/^\d+$/.test(w)?String(parseInt(w,10)):w)
  });
  const t1=[];
  for(let k=0;k<out.length;k++){
    const a=out[k],b=out[k+1];
    if(/^\d+$/.test(a)&&+a>=20&&+a<=90&&+a%10===0&&b&&/^[1-9]$/.test(b)){
      t1.push(String(+a+ +b));
      k++
    }else t1.push(a)
  }
  const m=[];
  for(let k=0;k<t1.length;k++){
    const a=t1[k],b=t1[k+1];
    if(a==='hundred'&&m.length&&/^\d$/.test(m[m.length-1])){
      let v=+m.pop()*100;
      if(b&&/^\d+$/.test(b)&&+b<100){
        v+=+b;
        k++
      }
      m.push(String(v))
    }else m.push(a)
  }
  return m
}
function scHeard(text){
  const toks=scTok(text);
  const H=new Set(toks);
  const nz=x=>/^\d+$/.test(x)?String(parseInt(x,10)):x;
  for(let k=0;k+1<toks.length;k++)H.add(nz(toks[k]+toks[k+1]));
  for(let k=0;k<toks.length;k++){
    if(toks[k].length!==1)continue;
    let j=k,s='';
    while(j<toks.length&&toks[j].length===1){
      s+=toks[j];
      j++
    }
    if(j-k>=2)H.add(nz(s));
    k=j-1
  }
  toks.forEach(x=>{
    if(/^\d{3,4}$/.test(x)){
      H.add(x.slice(0,-2).replace(/^0+(?=\d)/,''));
      H.add(String(+x.slice(-2)))
    }
  });
  return H
}
function scMatch(want,H){
  return want.filter(x=>H.has(x)).length
}
function srResult(heard){
  const a=scTok(cur().en),H=scHeard(heard),hit=scMatch(a,H),score=a.length?Math.round(hit/a.length*100):0;
  /* V5.32.0：逐字回饋（和相似度用同一套斷字；紅色的字可以點來聽） */
  $('#result').innerHTML=swFeedback(cur().en,heard,score);
  if(window.rpScore)window.rpScore(score,heard);
  if(score>=90)bumpLog('shadow')
}
/* V5.16.5：iPhone 語音辨識常常只有第一次有效。改為「沿用同一個辨識器」與「重新建立」兩種方式輪替：
   某種方式聽不到時，下一次自動換另一種；並顯示診斷事件，方便回報。 */
/* V5.16.8：iPhone 語音辨識每次載入網頁通常只能啟動一次。改為「背景持續辨識」：
   第一次按 🎤 啟動一個連續辨識，之後每次按 🎤 只擷取按下後聽到的內容，不重新啟動辨識器。
   若手機仍結束了背景辨識、新的又聽不到，就顯示「重新啟動麥克風」。 */
VOICE.n=0;
VOICE.sess=null;
VOICE.att=null;
VOICE.trace=[];
VOICE.sessN=0;
function srT(n){
  VOICE.trace.push(n+' '+((Date.now()-VOICE.t0)/1000).toFixed(1)+'s')
}
function srEv(n){
  if(VOICE.att)srT(n)
}
const SR_RELOAD='<br><button class="mini rec-reload" onclick="micReload()">🔄 重新啟動麥克風（重新載入，回到同一句）</button>';
function srDiag(a){
  const dur=(Date.now()-VOICE.t0)/1000;
  const deaf=!a.got&&dur>=2.5;
  return '<br><small class="muted">診斷：'+esc(VOICE.trace.join('、')||'沒有任何事件')+'｜背景辨識 #'+(a.sess?a.sess.__no:'-')+'（'+a.how+'）｜第 '+a.n+' 次｜'+esc(audioSessInfo())+(srJustReloaded()?'｜剛重新載入':'')+'</small>'+(deaf?(srJustReloaded()&&!VOICE.heard?SR_STUCK:'<br><small>麥克風有開啟但沒有辨識到內容。如果你有念出聲音，請按下方按鈕重新啟動。</small>'+SR_RELOAD):'')
}
function srAbort(){
  clearTimeout(VOICE.srTimer);
  clearTimeout(VOICE.srGuard);
  VOICE.att=null;
  if(VOICE.srBusy){
    VOICE.srBusy=false;
    srBtn(false)
  }
}
function srKill(){
  srAbort();
  clearTimeout(VOICE.idleT);
  const s=VOICE.sess;
  VOICE.sess=null;
  if(s){
    s.__dead=true;
    try{
      s.abort()
    }catch(e){}
  }
}
function srJustReloaded(){
  try{
    const t=+sessionStorage.getItem('e5k_rl')||0;
    return Date.now()-t<5*60*1000
  }catch(e){
    return false
  }
}
const SR_STUCK='<br><b>⚠️ 重新載入後語音辨識仍然聽不到，這是瀏覽器本身的辨識功能暫時卡住，重新載入網頁無法修復。</b><br><small>請試：① 從 iPhone 多工畫面把 Edge 完全滑掉再重開；② 或改用 Safari 開啟（實測 Safari 可連續使用）。「🎙 錄音」與「⇄ 範例→我」不受影響，可以先用錄音對比發音。</small>';
function srOnce(){
  try{
    return sessionStorage.getItem('e5k_sr_once')==='1'
  }catch(e){
    return false
  }
}
function srReload(){
  $('#result').textContent='🔄 這支手機每次載入網頁只能啟動一次語音辨識，正在重新啟動麥克風（約 1 秒，回到同一句）…';
  try{
    sessionStorage.setItem('e5k_sr','1')
  }catch(e){}
  setTimeout(micReload,300)
}
/* V5.16.10：整句的字都聽到了就立刻評分，不必等手機確認（約快 3 秒） */
function srNorm(x){
  return String(x||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim()
}
function srAll(t){
  const want=scTok(cur().en),H=scHeard(t);
  return want.length>0&&want.every(w=>H.has(w))
}
function srSession(){
  const r=new SR();
  r.lang='en-US';
  r.continuous=true;
  r.interimResults=true;
  r.maxAlternatives=1;
  VOICE.sessN++;
  r.__no=VOICE.sessN;
  r.__len=0;
  r.__alive=false;
  r.__dead=false;
  r.onstart=()=>{
    r.__alive=true;
    srEv('start')
  };
  r.onaudiostart=()=>{
    r.__alive=true;
    srEv('audio')
  };
  r.onsoundstart=()=>srEv('sound');
  r.onspeechstart=()=>srEv('speech');
  r.onresult=e=>{
    r.__alive=true;
    r.__len=e.results.length;
    r.__heardSince=true;
    let full='';
    for(let k=0;k<e.results.length;k++)full+=e.results[k][0].transcript+' ';
    full=srNorm(full);
    r.__full=full;
    const a=VOICE.att;
    if(!a||a.sess!==r)return;
    let t='',fin=false;
    if(full.startsWith(a.base)){
      t=full.slice(a.base.length).trim();
      fin=!!(e.results.length&&e.results[e.results.length-1].isFinal)
    }else{
      for(let k=a.from;k<e.results.length;k++){
        t+=e.results[k][0].transcript+' ';
        if(e.results[k].isFinal)fin=true
      }
      t=srNorm(t)
    }
    if(!t)return;
    if(!a.got)srT('result');
    a.got=t;
    if(fin||srAll(t)){
      if(!fin)srT('all-words');
      srDone(a)
    }else $('#result').innerHTML='🎧 聽到：<i>'+esc(t)+'</i>'
  };
  r.onerror=e=>{
    srEv('error:'+e.error);
    const a=VOICE.att;
    if(a&&a.sess===r&&/not-allowed|service-not-allowed|audio-capture|network/.test(e.error))srDone(a,srErrText(e.error))
  };
  r.onend=()=>{
    srEv('end');
    r.__dead=true;
    if(VOICE.sess===r)VOICE.sess=null;
    const a=VOICE.att;
    if(a&&a.sess===r)srDone(a)
  };
  return r
}
function srDone(a,why){
  if(VOICE.att!==a)return;
  srT('finish');
  clearTimeout(VOICE.srTimer);
  clearTimeout(VOICE.srGuard);
  VOICE.att=null;
  VOICE.srBusy=false;
  srBtn(false);
  if(a.got){
    if(a.sess)a.sess.__heard=true;
    VOICE.heard=true
  }else if((Date.now()-VOICE.t0)/1000>=2.5&&a.sess){
    if((a.how==='沿用'&&!a.sess.__heardSince)||!a.sess.__heard){
      a.sess.__dead=true;
      try{
        a.sess.abort()
      }catch(e){}
      if(VOICE.sess===a.sess)VOICE.sess=null
    }
    if(SR_WEBKIT&&a.sess.__no>=2&&!a.sess.__heard){
      try{
        sessionStorage.setItem('e5k_sr_once','1')
      }catch(e){}
    }
  }
  if(a.got){
    srResult(a.got);
    $('#result').insertAdjacentHTML('beforeend',srDiag(a));
    return
  }
  $('#result').innerHTML=esc(why||'🤔 這次沒有辨識到內容，請再按一次「🎤 開始念」。')+srDiag(a)
}
if(SR){
  $('#check').onclick=()=>{
    if(VOICE.srBusy){
      const a=VOICE.att;
      if(!a){
        srAbort();
        return
      }
      srT('user-stop');
      clearTimeout(VOICE.srTimer);
      clearTimeout(VOICE.srGuard);
      VOICE.srGuard=setTimeout(()=>srDone(a,a.got?'':'已停止聆聽。（念完後請稍等 1～2 秒再按停止，或直接等它自動評分）'),1500);
      return
    }
    if(REC.state==='recording'||REC.state==='starting')recStop();
    recStopPlayback();
    if(REC.state==='idle')recRelease();
    audioSessPR();
    VOICE.n++;
    VOICE.t0=Date.now();
    VOICE.trace=[];
    let s=VOICE.sess,how='沿用';
    if(SR_WEBKIT&&(!s||s.__dead)&&VOICE.sessN>=1&&srOnce()&&!(srJustReloaded()&&!VOICE.heard)){
      srReload();
      return
    }
    if(!s||s.__dead){
      how='新開';
      try{
        s=srSession()
      }catch(e){
        $('#result').textContent='⚠️ 無法啟動語音辨識，請重新整理後再試。';
        return
      }
      VOICE.sess=s
    }
    s.__heardSince=false;
    const a={sess:s,from:s.__len,base:s.__full||'',got:'',how,n:VOICE.n};
    VOICE.att=a;
    VOICE.srBusy=true;
    srBtn(true);
    $('#result').textContent='🎧 正在聆聽…請念出上面的句子（念完會自動評分）';
    if(how==='新開'){
      try{
        s.start()
      }catch(e){
        srT('start-fail:'+(e.name||e.message));
        s.__dead=true;
        VOICE.sess=null;
        srDone(a,'⚠️ 語音辨識啟動失敗（'+(e.name||e.message)+'），請再按一次。');
        return
      }
      VOICE.srGuard=setTimeout(()=>{
        if(VOICE.att===a&&!s.__alive){
          s.__dead=true;
          try{
            s.abort()
          }catch(e){}
          if(VOICE.sess===s)VOICE.sess=null;
          srDone(a,'⚠️ 語音辨識沒有回應，已自動重設。請再按一次「🎤 開始念」，或按下方按鈕重新啟動麥克風。')
        }
      },5000)
    }
 else srT('standby');
    VOICE.srTimer=setTimeout(()=>{
      if(VOICE.att===a){
        srT('10s');
        srDone(a)
      }
    },10000);
    clearTimeout(VOICE.idleT);
    VOICE.idleT=setTimeout(()=>{
      if(!VOICE.srBusy)srKill()
    },180000)
  }
}
else{
  $('#check').onclick=()=>{
    $('#result').textContent='⚠️ 此瀏覽器不支援語音辨識，建議使用 Safari、Chrome 或 Edge。錄音對比功能仍可使用。'
  }
}
window.voiceOnRender=id=>{
  if(REC.sid&&REC.sid!==id)recDiscard();
  if(VOICE.srBusy&&VOICE.lastId&&VOICE.lastId!==id)srAbort();
  if(VOICE.lastId!==id)sayTok++;
  VOICE.lastId=id
};
let wbFrom='quiz';
function page(name){
  if(name!=='practice'&&window.rpOff)window.rpOff();
  /* V5.27.2：離開句子頁時停止錄音與語音辨識（原本麥克風會一直開著） */
  if(name!=='practice'){
    try{
      if(REC.state==='recording'||REC.state==='starting')recStop();
      if(VOICE.srBusy)srAbort();
      clearTimeout(REC.leaveT);
      REC.leaveT=setTimeout(()=>{
        if(REC.state==='idle'&&$('.panel').hidden)recRelease()
      },1500)
    }catch(e){}
  }
  const pr=name==='practice';
  $('.panel').hidden=!pr;
  $('.sentence').hidden=!pr;
  $('.topline').hidden=!pr;
  $('.tip').hidden=!pr;
  $('#sentenceList').hidden=name!=='list';
  $('#wordPage').hidden=name!=='words';
  $('#quiz').hidden=name!=='quiz';
  $('#phrasePage').hidden=name!=='phrases';
  $('#statsPage').hidden=name!=='stats';
  $('#todayPage').hidden=name!=='today';
  $('#dialogPage').hidden=name!=='dialogs';
  const wp=$('#wrongPage');
  if(wp)wp.hidden=name!=='wrongbook';
  if(name!=='dialogs'&&typeof dlgStop==='function'&&(DLG.run||DLG.playing>=0))dlgStop();
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const nn=name==='list'?'practice':name==='wrongbook'?wbFrom:name;
  let nb=$('#nav'+nn[0].toUpperCase()+nn.slice(1));
  if(nb)nb.classList.add('active');
  if(pr&&window.rpAfterPage)window.rpAfterPage();
  window.scrollTo(0,0);
  /* V5.27.2：有新版本在等待時，回到「今日」頁就套用（原本要等 App 切到背景） */
  if(name==='today'&&window.__swGo)setTimeout(()=>{
    try{
      if(REC.state==='idle'&&!VOICE.srBusy&&!RP.on&&!DLG.run&&!autoOn&&!cardAuto)window.__swGo()
    }catch(e){}
  },0)
}
$('#navPractice').onclick=()=>{
  page('practice');
  refilter();
  render()
};
$('#navWords').onclick=()=>{
  page('words');
  wordShown=60;
  renderWords()
};
$('#openList').onclick=()=>{
  page('list');
  list()
};
$('#navQuiz').onclick=()=>{
  page('quiz');
  quiz()
};
/* V5.27.2：小手機作答後，答對／答錯的說明和「下一題」常在底部選單下面；作答後自動捲到看得到的位置 */
let _qrv=0;
function quizReveal(){
  const m=$('#quizMsg'),nx=$('#newQuiz'),nv=document.querySelector('nav');
  if(!m||!nx||$('#quiz').hidden)return;
  const t=m.textContent.trim();
  if(!/^[✅❌]/.test(t)||_qrv)return;
  _qrv=1;
  const top=bottomLimit();
  const over=nx.getBoundingClientRect().bottom-(top-10);
  if(over>0)window.scrollBy(0,Math.min(over,Math.max(0,m.getBoundingClientRect().top-70)))
}
$('#quiz').addEventListener('click',()=>setTimeout(quizReveal,30));
$('#quiz').addEventListener('keyup',e=>{
  if(e.key==='Enter')setTimeout(quizReveal,30)
});
$('#back1').onclick=$('#back2').onclick=()=>{
  page('practice');
  refilter();
  render()
};
let listRes=[],searchPool=[];
function list(){
  let q=$('#search').value.trim().toLowerCase();
  const all=q?ALLS.filter(s=>s.en.toLowerCase().includes(q)||s.zh.includes(q)):pool;
  listRes=all.slice(0,150);
  $('#rows').innerHTML=(q?(all.length?(all.length>150?`<p class="muted">找到 ${all.length} 句，先顯示前 150 句；輸入更多字可以縮小範圍。</p>`:''):`<p class="muted empty-note">找不到符合「${esc(q)}」的句子。</p>`):'<p class="muted">目前分類的句子（最多顯示 150 句）。輸入關鍵字可搜尋全部 '+ALLS.length+' 句。</p>')+listRes.map((s,k)=>`<div class="row" data-k="${k}"><b>${esc(s.en)}</b><small>${esc(s.zh)}　·　${SRC_LABEL[s.src]}${store.known.includes(s.id)?'　✓':''}</small></div>`).join('')
}
$('#rows').onclick=e=>{
  let r=e.target.closest('.row');
  if(!r)return;
  let s=listRes[+r.dataset.k],k=pool.indexOf(s);
  if(k<0){
    searchPool=listRes.slice();
    let o=$('#unit').querySelector('option[value=search]');
    if(!o){
      o=document.createElement('option');
      o.value='search';
      $('#unit').prepend(o)
    }
    o.textContent='🔎 搜尋結果（'+searchPool.length+'）';
    $('#unit').value='search';
    filter();
    k=pool.indexOf(s);
    if(k<0)k=0
  }
  i=k;
  page('practice');
  render()
};
$('#search').oninput=debounce(list,150);
function quiz(){
  qCur='';
  const SQ=pool.length>=4?pool:ALLS;
  let s=SQ[Math.floor(Math.random()*SQ.length)];
  /* V5.27.2：選項的中文不重複（原本偶爾會出現兩個一樣的中文） */
  const seen=new Set([s.zh]),oth=[];
  for(let t=0;t<200&&oth.length<3;t++){
    const y=SQ[Math.floor(Math.random()*SQ.length)];
    if(y.id===s.id||seen.has(y.zh))continue;
    seen.add(y.zh);
    oth.push(y)
  }
  let opts=[s,...oth].sort(()=>Math.random()-.5);
  $('#quizQ').textContent=s.en;
  $('#quizOpts').innerHTML=opts.map(x=>`<button data-ok="${x.id===s.id}">${esc(x.zh)}</button>`).join('');
  $('#quizMsg').textContent='';
  let done=false;
  $('#quizOpts').onclick=e=>{
    if(e.target.tagName==='BUTTON'&&!done){
      done=true;
      let ok=e.target.dataset.ok==='true';
      e.target.classList.add(ok?'opt-ok':'opt-bad');
      if(!ok){
        const c=$('#quizOpts').querySelector('[data-ok=true]');
        if(c)c.classList.add('opt-ok')
      }
      $('#quizMsg').textContent=ok?'✅ 答對了！':'❌ 正確答案是綠色那一個';
      store[ok?'quizRight':'quizWrong']=(store[ok?'quizRight':'quizWrong']||0)+1;
      qStat('sentence',ok);
      bumpLog('quiz');
      markStudy();
      save()
    }
  }
}
$('#newQuiz').onclick=quiz;
/* ===== V5.1 5000 單字模組（以單字為鍵，避免字庫調整後進度錯位） ===== */
(function migrate(){
  if(store.wordKeyVersion>=2)return;
  const mapR=r=>(window.V4_WORDS||[])[r-1];
  const conv=a=>(a||[]).map(x=>typeof x==='number'?mapR(x):x).filter(Boolean);
  store.wordFav=conv(store.wordFav);
  store.wordKnown=conv(store.wordKnown);
  const st={},due={};
  Object.keys(store.wordStatus||{}).forEach(k=>{
    const w=/^\d+$/.test(k)?mapR(+k):k;
    if(w)st[w]=store.wordStatus[k]
  });
  Object.keys(store.reviewDue||{}).forEach(k=>{
    const w=/^\d+$/.test(k)?mapR(+k):k;
    if(w)due[w]=store.reviewDue[k]
  });
  store.wordStatus=st;
  store.reviewDue=due;
  store.wordKeyVersion=2;
  save()
})();
/* V5.16.12：字庫 QA 後，詞形（went、colour、don't…）併入原形；把舊紀錄轉移到原形。
   已熟不降級、收藏保留、取最早的複習日期、答錯次數相加；轉移前的紀錄另存在 migBackupV3。 */
(function migrateV3(){
  if(store.wordKeyVersion>=3)return;
  const MG=window.MERGED||{};
  const RK={new:0,learning:1,review:2,known:3};
  store.reviewStage=store.reviewStage||{};
  store.wrongWords=store.wrongWords||{};
  const snap={wordFav:store.wordFav,wordKnown:store.wordKnown,wordStatus:store.wordStatus,reviewDue:store.reviewDue,reviewStage:store.reviewStage,wrongWords:store.wrongWords};
  let moved=0;
  const touched=Object.keys(MG).some(o=>store.wordFav.includes(o)||store.wordKnown.includes(o)||store.wordStatus[o]||store.reviewDue[o]||store.reviewStage[o]||store.wrongWords[o]);
  if(touched)store.migBackupV3=JSON.parse(JSON.stringify(snap));
  Object.keys(MG).forEach(o=>{
    const n=MG[o];
    if(!n||n===o)return;
    let hit=false;
    const fi=store.wordFav.indexOf(o);
    if(fi>=0){
      store.wordFav.splice(fi,1);
      if(!store.wordFav.includes(n))store.wordFav.push(n);
      hit=true
    }
    const oldKnown=store.wordKnown.includes(o)||store.wordStatus[o]==='known';
    const ki=store.wordKnown.indexOf(o);
    if(ki>=0){
      store.wordKnown.splice(ki,1);
      hit=true
    }
    const so=store.wordStatus[o];
    if(so){
      const sn=store.wordStatus[n];
      if(!sn||(RK[so]||0)>(RK[sn]||0))store.wordStatus[n]=so;
      delete store.wordStatus[o];
      hit=true
    }
    if(oldKnown){
      store.wordStatus[n]='known';
      if(!store.wordKnown.includes(n))store.wordKnown.push(n)
    }
    const dO=store.reviewDue[o];
    if(dO){
      const dN=store.reviewDue[n];
      store.reviewDue[n]=dN&&dN<dO?dN:dO;
      delete store.reviewDue[o];
      hit=true
    }
    const sg=store.reviewStage[o];
    if(sg!=null){
      store.reviewStage[n]=Math.max(store.reviewStage[n]||0,sg);
      delete store.reviewStage[o];
      hit=true
    }
    const ww=store.wrongWords[o];
    if(ww){
      store.wrongWords[n]=(store.wrongWords[n]||0)+ww;
      delete store.wrongWords[o];
      hit=true
    }
    if(hit)moved++
  });
  store.wordKeyVersion=3;
  store.migratedV3=moved;
  save()
})();
/* V5.21.0：補入核心高頻原形後，部分原本當成原形的變化形（accompanied、buyers…）改為新原形的詞形（MERGED4）；
   V5.22.0：再把 allowed、working、stairs、lying… 等變化形改為原形的詞形（MERGED5）。
   紀錄轉移到原形（已熟不降級、收藏保留、取最早的複習日期、複習階段取最高、答錯次數相加）；轉移前的紀錄另存在 migBackupV4／migBackupV5。
   換掉的冷門字只是不再顯示，學習紀錄保留不刪。 */
function mergeWordKeys(ver,MG){
  if(store.wordKeyVersion>=ver)return;
  MG=MG||{};
  const RK={new:0,learning:1,review:2,known:3};
  store.reviewStage=store.reviewStage||{};
  store.wrongWords=store.wrongWords||{};
  const touched=Object.keys(MG).some(o=>store.wordFav.includes(o)||store.wordKnown.includes(o)||store.wordStatus[o]||store.reviewDue[o]||store.reviewStage[o]!=null||store.wrongWords[o]);
  if(touched)store['migBackupV'+ver]=JSON.parse(JSON.stringify({wordFav:store.wordFav,wordKnown:store.wordKnown,wordStatus:store.wordStatus,reviewDue:store.reviewDue,reviewStage:store.reviewStage,wrongWords:store.wrongWords}));
  let moved=0;
  Object.keys(MG).forEach(o=>{
    const n=MG[o];
    if(!n||n===o)return;
    let hit=false;
    const fi=store.wordFav.indexOf(o);
    if(fi>=0){
      store.wordFav.splice(fi,1);
      if(!store.wordFav.includes(n))store.wordFav.push(n);
      hit=true
    }
    const oldKnown=store.wordKnown.includes(o)||store.wordStatus[o]==='known';
    const ki=store.wordKnown.indexOf(o);
    if(ki>=0){
      store.wordKnown.splice(ki,1);
      hit=true
    }
    const so=store.wordStatus[o];
    if(so){
      const sn=store.wordStatus[n];
      if(!sn||(RK[so]||0)>(RK[sn]||0))store.wordStatus[n]=so;
      delete store.wordStatus[o];
      hit=true
    }
    if(oldKnown){
      store.wordStatus[n]='known';
      if(!store.wordKnown.includes(n))store.wordKnown.push(n)
    }
    const dO=store.reviewDue[o];
    if(dO){
      const dN=store.reviewDue[n];
      store.reviewDue[n]=dN&&dN<dO?dN:dO;
      delete store.reviewDue[o];
      hit=true
    }
    const sg=store.reviewStage[o];
    if(sg!=null){
      store.reviewStage[n]=Math.max(store.reviewStage[n]||0,sg);
      delete store.reviewStage[o];
      hit=true
    }
    const ww=store.wrongWords[o];
    if(ww){
      store.wrongWords[n]=(store.wrongWords[n]||0)+ww;
      delete store.wrongWords[o];
      hit=true
    }
    if(hit)moved++
  });
  store.wordKeyVersion=ver;
  store['migratedV'+ver]=moved;
  save()
}
mergeWordKeys(4,window.MERGED4);
mergeWordKeys(5,window.MERGED5);
const BY_WORD={};
WORDS.forEach(x=>BY_WORD[x.w]=x);
const _dayC={t:0,v:{}};
function day(n=0){
  const now=Date.now();
  if(now-_dayC.t>30000){
    _dayC.t=now;
    _dayC.v={}
  }
  const c=_dayC.v[n];
  if(c)return c;
  let d=new Date();
  d.setDate(d.getDate()+n);
  return _dayC.v[n]=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function statusOf(w){
  if(store.wordStatus[w])return store.wordStatus[w];
  if(cset('wordKnown').has(w))return 'known';
  return 'new'
}
function isDue(w){
  return !!store.reviewDue[w]&&store.reviewDue[w]<=day()
}
/* V5.16.13：例句用的是詞形（例如 sprained、buried）時也要標出，避免例句填空直接露出答案 */
function hlForms(w){
  const v=(typeof VS!=='undefined'&&VS[w])||[],l=w.slice(-1),c=w.slice(0,-1);
  return [w,...v,w+'s',w+'es',w+'ed',w+'d',w+'ing',c+'ing',c+'ied',c+'ies',w+l+'ed',w+l+'ing',w+'er',w+'est'].filter((t,k,a)=>t&&a.indexOf(t)===k).sort((a,b)=>b.length-a.length)
}
const _hlC=new Map();
function hl(x){
  if(!x.ex)return '';
  const k=x.w+'\u0001'+x.ex;
  const c=_hlC.get(k);
  if(c!==undefined)return c;
  const r=hl0(x);
  _hlC.set(k,r);
  return r
}
function hl0(x){
  const e=esc(x.ex);
  const fs=hlForms(x.w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
  return r.test(e)?e.replace(r,'$1<mark>$2</mark>'):e
}
const ST_LABEL={new:'新字',learning:'學習中',review:'待複習',known:'已熟'};
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* V5.29.0：複習間隔延長到 60、120、240 天（原本最長 30 天：學完 5000 字後每天約 210–240 個到期，延長後約 70–100 個）。
   「◐ 模糊」和測驗答錯：往前退兩級（原本從頭來）；「✗ 不熟」：從頭開始 */
const INTERVALS=[1,3,7,14,30,60,120,240];
const REVIEW_BATCH=20;
function reviewCap(){
  const c=store.settings.reviewCap;
  return c===0?0:[50,100,200].includes(c)?c:100
}
function setStatus(w,s,nolog){
  store.reviewStage=store.reviewStage||{};
  let st=store.reviewStage[w]||0;
  let prev=statusOf(w),wasDue=isDue(w);
  if(!nolog){
    if(prev==='new'&&!store.wordStatus[w])bumpLog('new');else if(wasDue){
      bumpLog('review');
      /* V5.29.0：記錄複習時記得或忘記（統計頁的複習答對率） */
      bumpLog(s==='known'?'rok':'rng')
    }
  }
  store.wordStatus[w]=s;
  store.wordKnown=store.wordKnown.filter(x=>x!==w);
  if(s==='known'){
    store.wordKnown.push(w);
    st=Math.min(st+1,INTERVALS.length-1);
    store.reviewDue[w]=day(INTERVALS[st])
  }else if(s==='learning'){
    st=Math.max(0,st-2);
    store.reviewDue[w]=day(INTERVALS[0])
  }else{
    st=0;
    store.reviewDue[w]=day()
  }
  store.reviewStage[w]=st;
  markStudy();
  save()
}
function toggleFav(w){
  let a=store.wordFav,n=a.indexOf(w);
  n<0?a.push(w):a.splice(n,1);
  save()
}
let wordShown=60,cardIndex=0,cardPool=[],cardReveal=false;
/* V5.21.0：「全部」只算 5000 原形（不含 CE 專業字與職場英文）
   V5.23.0：TOEIC 多益章節＝TOEIC Service List 的字（在 5000、CE 或職場英文裡都算），依多益常用程度排列 */
function inBook(x,book){
  return book==='all'?!x.ce&&!x.job:book==='toeic'?!!x.toeic:x.k==+book
}
function toeicSort(a,book){
  return book==='toeic'?a.slice().sort((p,q)=>(p.toeic||9999)-(q.toeic||9999)):a
}
function skipV(){
  return store.settings.skipVar!==false
}
function wordFiltered(){
  let q=$('#wordSearch').value.trim().toLowerCase(),book=$('#wordBook').value,st=$('#wordState').value,tp=$('#wordTopic').value;
  return toeicSort(WORDS.filter(x=>(!q||x.w.toLowerCase().includes(q)||(x.zh&&x.zh.includes(q)))&&(q||!skipV()||!x.b||x.k===7)&&(tp==='all'||(x.t||[]).includes(tp))&&((q&&book==='all')||inBook(x,book))&&(st==='all'||(st==='fav'&&cset('wordFav').has(x.w))||(st==='review'&&isDue(x.w))||(st==='wrong'&&!!(store.wrongWords||{})[x.w])||(st==='zh'&&x.zh)||(st!=='fav'&&st!=='review'&&st!=='zh'&&st!=='wrong'&&statusOf(x.w)===st))),q?'all':book)
}
/* V5.27.2：「已熟／待複習／收藏」的數字和清單用同樣的範圍（冊別、主題、只學原形），點下去的字數會一致 */
function wordStats(n){
  $('#wordCount').textContent=n;
  const book=$('#wordBook').value,tp=$('#wordTopic').value,sv=skipV(),fv=cset('wordFav');
  const B=WORDS.filter(x=>inBook(x,book)&&!(sv&&x.b&&x.k!==7)&&(tp==='all'||(x.t||[]).includes(tp)));
  $('#wordKnownN').textContent=B.filter(x=>statusOf(x.w)==='known').length;
  $('#wordFavN').textContent=B.filter(x=>fv.has(x.w)).length;
  $('#wordDueN').textContent=B.filter(x=>isDue(x.w)).length
}
function renderWords(){
  if(cardAuto)stopAuto();
  syncWordTools();
  let a=wordFiltered();
  $('#wordRows').hidden=false;
  $('#wordCard').hidden=true;
  wordStats(a.length);
  /* V5.24.0：單字卡精簡——🔊 🐢 ☆ ○ 放在單字那一行，💬 放在例句框右邊（卡片高度少約 35%） */
  _wl=a;
  const tb=$('#wordBook').value==='toeic'&&!$('#wordSearch').value.trim(),fv=cset('wordFav');
  $('#wordRows').innerHTML=a.slice(0,wordShown).map(x=>wordRowHtml(x,tb,fv)).join('');
  if(!a.length)$('#wordRows').innerHTML=`<p class="muted empty-note">${$('#wordSearch').value.trim()?'找不到符合「'+esc($('#wordSearch').value.trim())+'」的單字。':'這個範圍目前沒有符合條件的單字。'}可以換冊別、主題或狀態看看。</p>`;
  $('#wordMore').hidden=wordShown>=a.length
}
/* V5.28.0：單字卡的 HTML 獨立出來，局部更新與「顯示更多」共用 */
var _wl=[];
function wordRowHtml(x,tb,fv){
    const st=statusOf(x.w);
    return `<div class="word-card status-${st}" data-w="${esc(x.w)}"><span class="word-main"><span class="wc-head"><span class="word-rank">${tb&&x.toeic?'多益 '+x.toeic:x.ce?'CE':x.job?'職場':'#'+x.r}</span><strong>${esc(dispW(x.w))}</strong><em class="pos">${esc(x.pos||'')}</em><small>${x.p?'/ '+esc(phon(x.p))+' /':''}</small><span class="word-actions"><button data-act="play" aria-label="發音">🔊</button><button data-act="slow" aria-label="慢速發音">🐢</button><button data-act="fav" aria-label="收藏">${fv.has(x.w)?'★':'☆'}</button><button data-act="known" aria-label="標記已熟">${st==='known'?'✓':'○'}</button></span></span><span class="zh">${x.zh?esc(x.zh):'<i>中文待補（下一批）</i>'}</span>${relHtml(x)}${x.ex?`<span class="ex ex2">${hl(x)}<br><small>${esc(x.exz)}</small><span class="ex-btns"><button data-act="ex" aria-label="播放例句">💬</button></span></span>`:''}</span></div>`
}
function wordTb(){
  return $('#wordBook').value==='toeic'&&!$('#wordSearch').value.trim()
}
/* 只更新一張卡：狀態篩選是「全部」時清單內容不會變，只換掉這張卡並更新上方數字；其他篩選才整個重畫 */
function refreshWordRow(row,w){
  const x=BY_WORD[w];
  if(!row||!x||$('#wordState').value!=='all'){
    renderWords();
    return
  }
  row.outerHTML=wordRowHtml(x,wordTb(),cset('wordFav'));
  wordStats(_wl.length)
}
function showCard(){
  let x=cardPool[cardIndex];
  if(typeof lkClose==='function')lkClose();
  window.__cardAt=Date.now();
  if(!x){
    const fin=window.__cardDone;
    window.__cardDone=0;
    const left=window.__cardKind==='review'?WORDS.filter(y=>isDue(y.w)).length:0,cap=reviewCap(),rv=todayLog().review||0;
    $('#wordCard').innerHTML=(fin?`<b>🎉 完成了！這一組 ${fin} 個單字都看過了。</b>`:'<b>目前沒有符合條件的單字。</b>')+(left?`<p class="muted">還有 ${left} 個字到期${cap&&rv>=cap?`；今天已複習 ${rv} 個，達到每日上限 ${cap} 個，可以留到明天`:''}。</p>`:'')+'<div class="card-actions end2">'+(left?`<button data-ca="more" class="primary">🔁 再複習 ${Math.min(left,REVIEW_BATCH)} 個</button>`:'')+'<button data-ca="list">返回列表</button></div>';
    return
  }
  let s=statusOf(x.w);
  $('#wordCard').innerHTML=`<div class="meta">${cardIndex+1} / ${cardPool.length} · ${bookName(x)} · ${ST_LABEL[s]}${store.reviewDue[x.w]?(store.reviewDue[x.w]<=day()?' · 已到期':' · 下次複習 '+store.reviewDue[x.w].slice(5)):''}</div><div class="big${dispW(x.w).length>=15?' xlong':dispW(x.w).length>=12?' long':''}" lang="en">${esc(dispW(x.w))}</div><div class="phon">${x.p?'/ '+esc(phon(x.p))+' /':''} <em class="pos">${esc(x.pos||'')}</em></div>${relHtml(x)}<div class="reveal">${cardReveal?(x.zh?esc(x.zh):'<i>中文待補</i>'):'<button data-ca="reveal">👁 先想意思，再點我看中文</button>'}</div>${x.ex?`<div class="card-ex"><div class="en">${hl(x)}</div>${cardReveal?`<div class="zhx">${esc(x.exz)}</div>`:''}<div class="exbtn"><button data-ca="ex">💬 例句</button><button data-ca="exslow">🐢 慢速例句</button></div></div>`:''}${x.ex2?`<div class="card-ex ex2b"><div class="lbl">📖 多益例句</div><div class="en" lang="en">${hlx(x,x.ex2)}</div>${cardReveal?`<div class="zhx">${esc(x.exz2)}</div>`:''}<div class="exbtn"><button data-ca="ex2">💬 例句</button><button data-ca="ex2slow">🐢 慢速例句</button></div></div>`:''}<div class="card-actions"><button data-ca="play">🔊 正常</button><button data-ca="slow">🐢 慢速</button><button data-ca="fav">${store.wordFav.includes(x.w)?'★ 已收藏':'☆ 收藏'}</button></div><div class="card-actions grade"><button data-ca="g-new" class="g1">✗ 不熟</button><button data-ca="g-learning" class="g2">◐ 模糊</button><button data-ca="g-known" class="g3">✓ 已熟</button></div><div class="card-actions"><button data-ca="auto" class="${cardAuto?'primary':''}">${cardAuto?'⏸ 停止自動':'▶ 自動播放'}</button></div><div class="card-actions"><button data-ca="prev">← 上一字</button><button data-ca="list">列表</button><button data-ca="next">下一字 →</button></div>`;
  if(!cardAuto)say(x.w,1)
}
function openCards(a){
  stopAuto();
  window.__cardKind='';
  cardPool=a;
  cardIndex=0;
  cardReveal=false;
  $('#wordRows').hidden=true;
  $('#wordMore').hidden=true;
  $('#wordCard').hidden=false;
  showCard();
  window.scrollTo({top:0,behavior:'smooth'})
}
['wordSearch','wordBook','wordState','wordTopic'].forEach(id=>$('#'+id).addEventListener(id==='wordSearch'?'input':'change',id==='wordSearch'?debounce(()=>{
  wordShown=60;
  renderWords()
},150):()=>{
  if(id==='wordBook')updTopicCounts();
  wordShown=60;
  renderWords()
}));
$('#wordMore').onclick=()=>{
  const from=wordShown,box=$('#wordRows');
  wordShown+=100;
  /* V5.28.0：只加上新的 100 張卡（原本整個清單重畫，越按越慢） */
  if(!_wl.length||box.hidden||!box.querySelector('.word-card')){
    renderWords();
    return
  }
  box.insertAdjacentHTML('beforeend',_wl.slice(from,wordShown).map(x=>wordRowHtml(x,wordTb(),cset('wordFav'))).join(''));
  $('#wordMore').hidden=wordShown>=_wl.length
};
$('#wordRows').onclick=e=>{
  let jp=e.target.closest('[data-jump]');
  if(jp){
    openCards([BY_WORD[jp.dataset.jump]]);
    return
  }
  let b=e.target.closest('button'),row=e.target.closest('.word-card');
  if(!row)return;
  let w=row.dataset.w;
  if(!b){
    openCards([BY_WORD[w]]);
    return
  }
  let a=b.dataset.act;
  if(a==='play')say(w,1);
  if(a==='slow')say(w,.62);
  if(a==='ex')say(BY_WORD[w].ex,.9);
  if(a==='fav'){
    toggleFav(w);
    refreshWordRow(row,w)
  }
  if(a==='known'){
    setStatus(w,statusOf(w)==='known'?'learning':'known');
    refreshWordRow(row,w)
  }
};
$('#cardMode').onclick=()=>openCards(wordFiltered());
/* V5.24.0：冊別改成一排按鈕（點一下就換；原本的選單留在背景，其他功能照常讀取它的值）；
   「已熟／待複習／收藏」可以直接點，只列出那一類（再點「顯示 N 字」回到全部） */
function syncWordTools(){
  const b=$('#wordBook').value,s=$('#wordState').value;
  wfMark();
  /* V5.27.2：取消「只學原形」時，「全部」也包含詞形，標示跟著改 */
  const ca=$('#bookChips [data-b="all"]');
  if(ca)ca.textContent=skipV()?'全部 5000':'全部＋詞形';
  document.querySelectorAll('#bookChips [data-b]').forEach(x=>x.classList.toggle('on',x.dataset.b===b));
  document.querySelectorAll('#wordPage .word-stats [data-st]').forEach(x=>x.classList.toggle('on',s!=='all'&&x.dataset.st===s))
}
$('#bookChips').onclick=e=>{
  const c=e.target.closest('[data-b]');
  if(!c)return;
  const sel=$('#wordBook');
  sel.value=c.dataset.b;
  sel.dispatchEvent(new Event('change'));
  if(c.scrollIntoView)c.scrollIntoView({block:'nearest',inline:'nearest'})
};
$('#wordPage .word-stats').onclick=e=>{
  const c=e.target.closest('[data-st]');
  if(!c)return;
  const sel=$('#wordState'),v=c.dataset.st==='all'||sel.value===c.dataset.st?'all':c.dataset.st;
  sel.value=v;
  sel.dispatchEvent(new Event('change'))
};
/* V5.16.20：每日新字目標從紀錄還原（原本重新開啟後會變回 20） */
$('#dailyGoal').value=String([10,20,30,50].includes(+store.settings.dailyGoal)?+store.settings.dailyGoal:20);
$('#dailyGoal').onchange=()=>{
  store.settings.dailyGoal=+$('#dailyGoal').value||20;
  save()
};
$('#dailyStart').onclick=()=>{
  let g=+$('#dailyGoal').value||20;
  store.settings.dailyGoal=g;
  save();
  /* V5.23.1：今日新字依單字頁選的冊別＋主題（例如「第 1 冊」＋「電力」只出第 1 冊電力的新字） */
  let book=$('#wordBook').value,tp=$('#wordTopic').value;
  let a=toeicSort(WORDS.filter(x=>statusOf(x.w)==='new'&&inBook(x,book)&&!(skipV()&&x.b&&x.k!==7)&&(tp==='all'||(x.t||[]).includes(tp))),book);
  /* V5.31.1：選的冊別／主題已經沒有新字時，改出其他冊別的新字，並說明 */
  if(!a.length&&(book!=='all'||tp!=='all')){
    a=WORDS.filter(x=>statusOf(x.w)==='new'&&!(skipV()&&x.b&&x.k!==7));
    if(a.length)backupMsg&&setTimeout(()=>{
      const m=$('#wordBackupMsg');
      if(m){
        m.textContent='目前選的冊別／主題已經沒有新字，改出其他冊別的新字。';
        m.className='rec-msg';
        m.hidden=false;
        setTimeout(()=>{
          m.hidden=true
        },6000)
      }
    },0)
  }
  openCards(a.slice(0,g))
};
/* V5.29.0：一次複習 20 個；最早到期（最久沒複習）、階段最低的先出；做完可以「再複習 20 個」 */
function reviewQueue(){
  const st=store.reviewStage||{},rd=store.reviewDue;
  return qShuffle(WORDS.filter(x=>isDue(x.w))).sort((a,b)=>(rd[a.w]<rd[b.w]?-1:rd[a.w]>rd[b.w]?1:0)||((st[a.w]||0)-(st[b.w]||0)))
}
$('#reviewStart').onclick=()=>{
  openCards(reviewQueue().slice(0,REVIEW_BATCH));
  window.__cardKind='review'
};
$('#wordCard').onclick=e=>{
  let jp=e.target.closest('[data-jump]');
  if(jp){
    stopAuto();
    openCards([BY_WORD[jp.dataset.jump]]);
    return
  }
  let b=e.target.closest('button');
  if(!b)return;
  let a=b.dataset.ca,x=cardPool[cardIndex];
  if(a==='auto'){
    cardAuto?stopAuto():startCardAuto();
    return
  }
  if(a!=='fav')stopAuto();
  if(a==='list'){
    renderWords();
    return
  }
  if(a==='more'){
    $('#reviewStart').click();
    return
  }
  if(!x)return;
  if(a==='play')say(x.w,1);
  if(a==='slow')say(x.w,.62);
  if(a==='ex')say(x.ex,.95);
  if(a==='exslow')say(x.ex,.65);
  if(a==='ex2')say(x.ex2,.95);
  if(a==='ex2slow')say(x.ex2,.65);
  if(a==='reveal'){
    cardReveal=true;
    showCard();
    return
  }
  if(a==='fav'){
    toggleFav(x.w)
  }
  if(a&&a.startsWith('g-')){
    /* V5.27.2：連點兩下不會把下一張還沒看到的卡也評分 */
    if(Date.now()-(window.__cardAt||0)<350)return;
    setStatus(x.w,a.slice(2));
    /* V5.31.1：上方「已熟／待複習」數字跟著更新 */
    try{
      wordStats(+$('#wordCount').textContent||0)
    }catch(e){}
    cardIndex++;
    cardReveal=false;
    if(cardIndex>=cardPool.length){
      window.__cardDone=cardPool.length;
      cardPool=[];
      cardIndex=0
    }
    showCard();
    return
  }
  if(a==='next'){
    cardIndex=(cardIndex+1)%cardPool.length;
    cardReveal=false;
    showCard();
    return
  }
  if(a==='prev'){
    cardIndex=(cardIndex-1+cardPool.length)%cardPool.length;
    cardReveal=false;
    showCard();
    return
  }
  if(a==='fav'){
    let el=b;
    el.textContent=store.wordFav.includes(x.w)?'★ 已收藏':'☆ 收藏'
  }
};
/* ===== V5.16.14 進度備份與還原 =====
   匯出：app / version / schemaVersion / exportedAt / summary / progress，匯出前先自我檢查。
   匯入：檢查 JSON、是否為 English 5000 備份、是否有 progress、格式版本、各欄位型別；
         有問題一律不動目前紀錄。匯入或還原前先把目前紀錄存到「復原點」，可隨時復原。 */
function progSummary(p){
  p=p||{};
  const st=p.wordStatus&&typeof p.wordStatus==='object'?p.wordStatus:{};
  const n=a=>Array.isArray(a)?a.length:0,o=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).length:0;
  const known=new Set([...(Array.isArray(p.wordKnown)?p.wordKnown:[]),...Object.keys(st).filter(k=>st[k]==='known')]);
  return {wordKnown:known.size,learning:Object.values(st).filter(v=>v==='learning').length,review:o(p.reviewDue),wordFav:n(p.wordFav),wrong:o(p.wrongWords),sentKnown:n(p.known),sentFav:n(p.fav),phKnown:n(p.phKnown),phFav:n(p.phFav),dlg:o(p.dlgDone),rp:o(p.rpDone),days:n(p.studyDays)}
}
function sumText(s){
  return `已熟單字 ${s.wordKnown}、學習中 ${s.learning}、複習排程 ${s.review}、收藏單字 ${s.wordFav}、答錯本 ${s.wrong}、會說的句子 ${s.sentKnown}、收藏句子 ${s.sentFav}、已會片語 ${s.phKnown}、收藏片語 ${s.phFav}、情境對話 ${s.dlg||0}、Role Play ${s.rp||0}、學習天數 ${s.days}`
}
function fmtTime(t){
  try{
    const d=new Date(t);
    if(isNaN(d))return '未知';
    return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')
  }catch(e){
    return '未知'
  }
}
function makeBackup(){
  return {app:'english-5000',version:APP_VERSION,schemaVersion:BACKUP_SCHEMA,exportedAt:new Date().toISOString(),summary:progSummary(store),progress:JSON.parse(JSON.stringify(store))}
}
function checkBackup(text){
  let obj;
  try{
    obj=JSON.parse(text)
  }catch(e){
    return {err:'這不是有效的備份檔（JSON 格式錯誤，檔案可能損毀或沒有完整下載）。'}
  }
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return {err:'這不是 English 5000 的備份檔。'};
  if(obj.app!=='english-5000')return {err:'這不是 English 5000 的備份檔。'};
  const p=obj.progress;
  if(!p||typeof p!=='object'||Array.isArray(p))return {err:'備份檔裡沒有學習進度（progress）。'};
  const sv=obj.schemaVersion==null?(p.wordKeyVersion>=3?3:2):Number(obj.schemaVersion);
  if(!(sv>=1)||Math.floor(sv)!==sv)return {err:'無法辨識備份檔的格式版本。'};
  if(sv>BACKUP_SCHEMA)return {err:`這個備份來自較新版本的 App（格式 ${sv}），請先更新 App 再匯入。`};
  const arr=['fav','known','wordFav','wordKnown','phFav','phKnown','studyDays'],objs=['wordStatus','reviewDue','reviewStage','wrongWords','sDue','sStage','pDue','pStage','settings','dailyLog','dlgDone','rpDone','sqWrong','lsWrong','qStat'];
  for(const k of arr)if(p[k]!=null&&!Array.isArray(p[k]))return {err:`備份檔內容不正確（${k} 格式錯誤）。`};
  for(const k of objs)if(p[k]!=null&&(typeof p[k]!=='object'||Array.isArray(p[k])))return {err:`備份檔內容不正確（${k} 格式錯誤）。`};
  if(!arr.concat(objs).some(k=>p[k]!=null))return {err:'備份檔裡沒有任何學習紀錄。'};
  return {obj,p,sv}
}
let bmTimer;
function backupMsg(t,kind){
  const el=$('#backupMsg');
  if(el){
    el.textContent=t;
    el.className='rec-msg'+(kind?' '+kind:' ok');
    el.hidden=!t
  }
  const w=null;
  clearTimeout(bmTimer);
  bmTimer=setTimeout(()=>{
    [el,w].forEach(e=>{
      if(e)e.hidden=true
    })
  },15000)
}
function writeProgress(p,note){
  const pre=JSON.stringify({savedAt:new Date().toISOString(),version:APP_VERSION,summary:progSummary(store),progress:store});
  /* V5.31.1：學習紀錄很大時，空間不夠存「復原點」：先清掉最舊的每日自動備份再試（要還原的那份已經讀進來了） */
  let ok=lsSet(PRE_KEY,pre);
  if(!ok){
    const idx=snapIdx();
    while(!ok&&idx.length){
      snapDel(idx.pop().date);
      snapIdxSave(idx);
      ok=lsSet(PRE_KEY,pre)
    }
  }
  if(!ok){
    backupMsg('❌ 手機儲存空間不足，無法先保存目前紀錄，已取消。目前的紀錄沒有變動。','warn');
    return false
  }
  saveLock();
  const np=normStore(JSON.parse(JSON.stringify(p)));
  if(!(np.wordKeyVersion>=2))np.wordKeyVersion=0;else if(np.wordKeyVersion<3)np.wordKeyVersion=2;
  const nt=JSON.stringify(np);
  if(!lsSet(STORE_KEY,nt)&&!freeSpaceFor(nt)){
    _svLock=false;
    backupMsg('❌ 手機儲存空間不足，無法寫入，目前的紀錄沒有變動。','warn');
    return false
  }
  try{
    sessionStorage.setItem('e5k_msg',note);
    sessionStorage.setItem('e5k_go','stats')
  }catch(e){}
  location.reload();
  return true
}
async function importBackupText(text){
  const r=checkBackup(text);
  if(r.err){
    backupMsg('❌ 無法匯入：'+r.err+'目前的紀錄沒有變動。','warn');
    return false
  }
  const s=progSummary(r.p),c=progSummary(store),when=fmtTime(r.obj.exportedAt);
  if(!confirm(`要匯入這個備份嗎？\n\n備份時間：${when}（App ${r.obj.version||'舊版'}）\n備份內容：${sumText(s)}\n\n目前紀錄：${sumText(c)}\n\n匯入會取代目前紀錄。目前紀錄會先保存為「復原點」，之後可以按「↩️ 復原到匯入前」還原。`)){
    backupMsg('已取消匯入，目前的紀錄沒有變動。');
    return false
  }
  return writeProgress(r.p,`✅ 已匯入 ${when} 的備份。（${sumText(s)}）`)
}
function restoreFrom(p,label){
  if(!confirm(`要還原到「${label}」嗎？\n\n內容：${sumText(progSummary(p))}\n\n目前紀錄會先保存為「復原點」，之後可以再復原。`))return false;
  return writeProgress(p,`✅ 已還原到「${label}」。`)
}
function exportBackup(share){
  const b=bkStamp(makeBackup()),txt=JSON.stringify(b,null,1);
  const chk=checkBackup(txt);
  if(chk.err){
    backupMsg('❌ 匯出失敗：備份檔自我檢查沒有通過（'+chk.err+'）','warn');
    return
  }
  const d=new Date(),name='english-5000-backup-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'.json';
  const done=how=>{
    store.lastExport=day();
    store.lastExportName=name;
    bkMark(b.exportedAt);
    save();
    if($('#statsPage')&&!$('#statsPage').hidden)renderBackup();
    backupMsg(`✅ ${how}：${name}（${sumText(b.summary)}）`+(how.includes('分享')?'\n之後要匯入時：按「📥 匯入備份檔」→ 檔案視窗下方點「瀏覽」→「最近項目」，或在上方搜尋 english-5000。':''))
  };
  const dl=()=>{
    const blob=new Blob([txt],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    done('已下載備份檔')
  };
  if(share&&navigator.canShare&&window.File){
    try{
      const f=new File([txt],name,{type:'application/json'});
      if(navigator.canShare({files:[f]})){
        navigator.share({files:[f],title:'English 5000 學習紀錄備份'}).then(()=>done('已分享／儲存備份檔')).catch(e=>{
          if(e&&e.name==='AbortError')backupMsg('已取消分享。');else dl()
        });
        return
      }
    }catch(e){}
  }
  dl()
}
function backupText(){
  const b=bkStamp(makeBackup());
  return JSON.stringify(b)
}
async function copyBackup(){
  const txt=backupText();
  const chk=checkBackup(txt);
  if(chk.err){
    backupMsg('❌ 複製失敗：'+chk.err,'warn');
    return
  }
  let okc=false;
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(txt);
      okc=true
    }
  }catch(e){}
  if(!okc){
    /* V5.27.2：用暫時的文字框複製（原本的文字框收起來時選不到內容，卻顯示「已複製」） */
    const ta=document.createElement('textarea');
    ta.value=txt;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    try{
      ta.focus();
      ta.select();
      ta.setSelectionRange(0,txt.length);
      okc=ta.selectionEnd-ta.selectionStart===txt.length&&document.execCommand('copy')
    }catch(e){
      okc=false
    }
    ta.remove()
  }
  if(okc){
    store.lastExport=day();
    bkMark();
    save();
    backupMsg('✅ 已複製備份內容（'+Math.round(txt.length/1024)+' KB）。可以貼到「備忘錄」或傳給自己保存；還原時把整段內容貼到下方「貼上備份內容」再按匯入。')
  }else backupMsg('❌ 這個瀏覽器不允許自動複製，請改用「💾 匯出備份檔」。','warn')
}
function renderBackup(){
  const box=$('#backupBody');
  if(!box)return;
  const s=progSummary(store),le=store.lastExport;
  const pre=(()=>{
    try{
      return JSON.parse(lsGet(PRE_KEY)||'null')
    }catch(e){
      return null
    }
  })();
  const snaps=snapMeta();
  const canShare=!!(navigator.canShare&&window.File);
  box.innerHTML=`<p class="muted">學習紀錄只存在這支手機的瀏覽器裡。清除瀏覽資料、換手機或換瀏覽器前，請先匯出備份檔。</p>
 <div class="bk-sum"><b>目前紀錄</b><small>${esc(sumText(s))}</small><small class="bk-last">${bkLastHtml()}</small></div>
 <div class="grid2"><button id="bkExport" class="primary">💾 匯出備份檔</button>${canShare?'<button id="bkShare">📤 分享／存到「檔案」</button>':''}<label class="importBtn bk-import">📥 匯入備份檔<input id="bkImport" type="file" hidden></label><button id="bkCopy">📋 複製備份內容</button>${pre&&pre.progress?`<button id="bkUndo">↩️ 復原到 ${esc(fmtTime(pre.savedAt))} 匯入／還原前</button>`:''}</div>
 <p class="muted bk-hint">📁 <b>找不到備份檔？</b>按「📥 匯入備份檔」後，在檔案視窗下方點「瀏覽」→「最近項目」，或在上方搜尋 <b>english-5000</b>；也可到「我的 iPhone」或 iCloud Drive 找（用 Edge 存的檔案常在「我的 iPhone › Edge」）。${store.lastExportName?'<br>上次匯出的檔名：<b>'+esc(store.lastExportName)+'</b>':''}</p>
 <div id="backupMsg" class="rec-msg" role="status" aria-live="polite" hidden></div>
 <details class="bk-paste"><summary>📝 貼上備份內容匯入（不用檔案）</summary><textarea id="bkPaste" aria-label="備份內容" rows="4" placeholder="把「📋 複製備份內容」複製的整段文字貼在這裡"></textarea><button id="bkPasteGo">匯入貼上的內容</button></details>
 <h3>自動備份（每天第一次開啟時保存，保留 3 天）</h3>${snaps.length?snaps.map((x,k)=>`<div class="bk-row"><span><b>${esc(x.date)}</b><small>${esc(sumText(x.summary))}</small></span><button data-snap="${k}">還原</button></div>`).join(''):'<p class="muted">還沒有自動備份（明天開啟時會自動建立）。</p>'}`;
  $('#bkExport').onclick=()=>exportBackup(false);
  $('#bkCopy').onclick=copyBackup;
  $('#bkPasteGo').onclick=()=>{
    const t=$('#bkPaste').value.trim();
    if(!t){
      backupMsg('請先把備份內容貼到上方的框裡。','warn');
      return
    }
    importBackupText(t)
  };
  const sh=$('#bkShare');
  if(sh)sh.onclick=()=>exportBackup(true);
  $('#bkImport').onchange=async e=>{
    const f=e.target.files&&e.target.files[0];
    e.target.value='';
    if(!f)return;
    let t;
    try{
      t=await f.text()
    }catch(x){
      backupMsg('❌ 無法讀取檔案，目前的紀錄沒有變動。','warn');
      return
    }
    importBackupText(t)
  };
  const u=$('#bkUndo');
  if(u)u.onclick=()=>restoreFrom(pre.progress,fmtTime(pre.savedAt)+' 匯入／還原前的紀錄');
  box.querySelectorAll('[data-snap]').forEach(b=>b.onclick=()=>{
    const m=snaps[+b.dataset.snap];
    const x=snapList().find(y=>y.date===m.date);
    if(!x){
      backupMsg('❌ 找不到這份自動備份，請重新開啟統計頁。','warn');
      return
    }
    restoreFrom(x.progress,x.date+' 自動備份')
  })
}
/* V5.24.0：匯出／匯入進度統一放在「統計 › 資料備份與還原」（單字頁的兩個按鈕已移除） */
/* 單字測驗：英→中、中→英、聽音選字（只使用已有中文的單字） */
function lev(a,b){
  if(Math.abs(a.length-b.length)>3)return 9;
  let d=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){
    let p=d[0];
    d[0]=i;
    for(let j=1;j<=b.length;j++){
      let t=d[j];
      d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));
      p=t
    }
  }
  return d[b.length]
}
/* V5.27.2：中文意思拆成幾個義項（去掉括號說明），用來排除「意思重疊」的選項 */
const _senseC=new Map();
function zhSenses(z){
  let r=_senseC.get(z);
  if(!r){
    r=String(z||'').replace(/（[^）]*）|\([^)]*\)/g,'').split(/[；;]/).map(s=>s.trim()).filter(Boolean);
    _senseC.set(z,r)
  }
  return r
}
function pickOpts(x,pool,n=3){
  let p1=(x.pos||'').split('/')[0];
  const xs=zhSenses(x.zh),dw=dispW(x.w).toLowerCase();
  /* V5.27.2：排除同音字（聽發音題會變成兩個正確答案）、答案自己的詞形、和答案共用一個中文義項的字、顯示文字相同的字 */
  let cand=pool.filter(y=>y.w!==x.w&&y.zh!==x.zh&&!(x.p&&y.p===x.p)&&y.b!==x.w&&x.b!==y.w&&!(x.b&&y.b===x.b)&&(y._dl||(y._dl=dispW(y.w).toLowerCase()))!==dw&&!(y._zs||(y._zs=zhSenses(y.zh))).some(s=>xs.includes(s)));
 /* V5.16.16 效能：只對「開頭字母相同、字尾相同或長度相近」的候選字計算拼字相似度，其餘隨機抽樣，結果與原本相同等級的相近選項 */
  if(cand.length>500){
    const a=x.w[0],e2=x.w.slice(-2),L=x.w.length;
    const near=[],rest=[];
    for(const y of cand){
      if(y.w[0]===a||y.w.slice(-2)===e2)near.push(y);else rest.push(y)
    }
    for(let k=rest.length-1;k>0;k--){
      const j=Math.floor(Math.random()*(k+1));
      [rest[k],rest[j]]=[rest[j],rest[k]]
    }
    cand=near.concat(rest.slice(0,Math.max(150,500-near.length)))
  }
  let sc=cand.map(y=>{
    let s=Math.random()*1.5;
    if((y.pos||'').split('/')[0]===p1)s+=3;
    if(y.w[0]===x.w[0])s+=1;
    if(y.w.slice(0,3)===x.w.slice(0,3))s+=2;
    let L=lev(x.w,y.w);
    if(L<=2)s+=3;else if(L<=3)s+=1.5;
    if(Math.abs(y.w.length-x.w.length)<=1)s+=.5;
    return [s,y]
  }).sort((a,b)=>b[0]-a[0]);
  /* 選項的中文、英文都不重複 */
  const out=[],sz=new Set([x.zh]),sw=new Set([dw]);
  for(const y of sc.slice(0,12).map(v=>v[1]).sort(()=>Math.random()-.5).concat(sc.slice(12).map(v=>v[1]))){
    const yw=dispW(y.w).toLowerCase();
    if(sz.has(y.zh)||sw.has(yw))continue;
    sz.add(y.zh);
    sw.add(yw);
    out.push(y);
    if(out.length>=n)break
  }
  return out
}
const _qpC={};
function quizPool(){
  let book=$('#quizBook').value;
  if(book==='wrong'){
    const ws=store.wrongWords||{};
    return WORDS.filter(x=>ws[x.w])
  }
  const k=book+'|'+skipV();
  if(_qpC[k])return _qpC[k];
  let p=WORDS.filter(x=>x.zh);
  p=p.filter(x=>inBook(x,book)&&!(skipV()&&x.b&&x.k!==7));
  return _qpC[k]=p
}
function quizResult(x,ok,extra='',mode){
  qStat('w-'+(mode||'en'),ok);
  store.wrongWords=store.wrongWords||{};
  if(ok){
    $('#quizMsg').innerHTML=`✅ 答對了！ ${esc(dispW(x.w))}｜${esc(x.zh)}${x.ex?'<br><small>'+esc(x.ex)+'</small>':''}`;
    store.quizRight=(store.quizRight||0)+1;
    if(store.wrongWords[x.w]){
      store.wrongWords[x.w]--;
      if(store.wrongWords[x.w]<=0)delete store.wrongWords[x.w]
    }
  }else{
    $('#quizMsg').innerHTML=`❌ 正確答案：${esc(dispW(x.w))}｜${esc(x.zh)}${extra}<br><small>已加入複習與答錯單字本</small>`;
    setStatus(x.w,'learning',true);
    store.quizWrong=(store.quizWrong||0)+1;
    store.wrongWords[x.w]=(store.wrongWords[x.w]||0)+2
  }
  bumpLog('quiz');
  markStudy();
  save();
  say(x.w,1)
}
function wordQuiz(fx){
  if(fx&&!fx.w)fx=null;
  qCur='';
  let pool=fx?[fx]:quizPool();
  let book=fx?'wrong':$('#quizBook').value;
  if(book==='wrong'&&!pool.length){
    $('#quizQ').innerHTML='🎉 答錯單字本是空的';
    $('#quizOpts').innerHTML='';
    $('#quizMsg').textContent='';
    return
  }
  /* V5.27.2：答錯單字本的錯誤選項只用原形字（原本可能出現答案自己的變化形） */
  let base=book==='wrong'?(window.__baseW=window.__baseW||WORDS.filter(y=>!y.b||y.k===7)):pool;
  if(pool.length<1||base.length<4){
    $('#quizQ').textContent='此範圍題目不足';
    $('#quizOpts').innerHTML='';
    return
  }
  let mode=$('#quizMode').value;
  if(fx||mode==='mix')mode=['en','zh','listen','cloze','dict'][Math.floor(Math.random()*5)];
  let x=pool[Math.floor(Math.random()*pool.length)];
  if(mode==='cloze'&&!x.ex)mode='en';
  $('#quizMsg').textContent='';
  if(mode==='dict'){
    $('#quizQ').innerHTML=`🎧 聽寫：聽發音，拼出單字 <button id="quizReplay">再聽</button> <button id="quizSlow">🐢 慢速</button><br><small>提示：${esc(x.zh)}（${x.w.length} 個字母，開頭 ${esc(x.w[0])}）</small>`;
    $('#quizOpts').innerHTML=`<input id="dictIn" aria-label="聽寫答案" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="輸入你聽到的單字"><button id="dictGo" class="primary">確認</button>`;
    say(x.w,.85);
    /* V5.20.1：按鈕在出題當下就綁定（原本延後綁定，連續快速按「下一題」時可能出錯） */
    const inp=$('#dictIn'),gob=$('#dictGo');
    $('#quizReplay').onclick=()=>say(x.w,.85);
    $('#quizSlow').onclick=()=>say(x.w,.6);
    const go=()=>{
      let v=inp.value.trim().toLowerCase().replace(/[’]/g,"'");
      if(!v)return;
      inp.disabled=true;
      gob.disabled=true;
      quizResult(x,v===x.w.toLowerCase(),`<br><small>你寫的是：${esc(v)}</small>`,'dict')
    };
    gob.onclick=go;
    inp.onkeydown=e=>{
      if(e.key==='Enter')go()
    };
    setTimeout(()=>{
      if(document.body.contains(inp)&&!inp.disabled)inp.focus()
    },0);
    $('#quizOpts').onclick=null;
    return
  }
  let opts=[x,...pickOpts(x,base)].sort(()=>Math.random()-.5);
  if(mode==='en'){
    $('#quizQ').innerHTML=`${esc(dispW(x.w))} <small>${x.p?'/'+esc(phon(x.p))+'/':''}</small>`
  }else if(mode==='zh'){
    $('#quizQ').innerHTML=esc(x.zh)
  }else if(mode==='cloze'){
    $('#quizQ').innerHTML=hl(x).replace(/<mark>.*?<\/mark>/,'<span class="blank">_____</span>')+`<br><small>${esc(x.exz)}</small>`
  }else{
    $('#quizQ').innerHTML='🔊 聽發音，選出單字 <button id="quizReplay">再聽</button>';
    say(x.w,.9);
    setTimeout(()=>{
      let r=$('#quizReplay');
      if(r)r.onclick=()=>say(x.w,.75)
    },0)
  }
  $('#quizOpts').innerHTML=opts.map(o=>`<button data-ok="${o.w===x.w}">${mode==='en'?esc(o.zh):esc(dispW(o.w))}</button>`).join('');
  let done=false;
  $('#quizOpts').onclick=e=>{
    let b=e.target.closest('button');
    if(!b||done)return;
    done=true;
    let ok=b.dataset.ok==='true';
    b.classList.add(ok?'opt-ok':'opt-bad');
    if(!ok)$('#quizOpts').querySelector('[data-ok=true]').classList.add('opt-ok');
    quizResult(x,ok,'',mode)
  }
}
function runQuiz(){
  let t=$('#quizType').value;
  /* V5.27.2：新題目：作答後的自動捲動重設，回到題目位置 */
  _qrv=0;
  if(!$('#quiz').hidden&&window.scrollY>0)window.scrollTo(0,0);
  if(window.P6QUIZ&&window.P6QUIZ[t])return window.P6QUIZ[t]();
  t==='word'?wordQuiz():t==='phrase'?phraseQuiz():quiz()
}
$('#newQuiz').onclick=runQuiz;
['quizType','quizMode','quizBook'].forEach(id=>$('#'+id).onchange=()=>{
  let t=$('#quizType').value;
  /* V5.32.0：片語測驗也有聽寫（拼字）題，不再停用這個選項 */
  $('#quizWordOpts').hidden=t!=='word'&&t!=='phrase';
  $('#quizBook').hidden=t!=='word';
  const sr=$('#quizSOpts');
  if(sr)sr.hidden=t!=='lisen'&&t!=='liszh';
  const s2=$('#quizSitOpts');
  if(s2)s2.hidden=t!=='situ';
  const s3=$('#quizDcOpts');
  if(s3)s3.hidden=t!=='dcloze';
  runQuiz()
});
$('#navQuiz').onclick=()=>{
  page('quiz');
  runQuiz()
};

/* ===== V5.11：學習紀錄、片語、統計、聲音設定 ===== */
function markStudy(){
  store.studyDays=store.studyDays||[];
  let t=day();
  if(!store.studyDays.includes(t)){
    store.studyDays.push(t);
    if(store.studyDays.length>400)store.studyDays=store.studyDays.slice(-400);
    save()
  }
}
function streak(){
  let d=new Set(store.studyDays||[]),n=0,off=d.has(day())?0:-1;
  while(d.has(day(off-n)))n++;
  return n
}
store.phFav=store.phFav||[];
store.phKnown=store.phKnown||[];
/* V5.26.0：新增「Email／會議」分類 */
const PH_CAT={daily:'日常',work:'工作',ce:'CE 現場',mail:'Email／會議'};
let phShown=40;
function phFiltered(){
  let q=$('#phSearch').value.trim().toLowerCase(),c=$('#phCat').value,st=$('#phState').value;
  return PHRASES.filter(x=>(!q||x.p.toLowerCase().includes(q)||x.zh.includes(q)||x.ex.toLowerCase().includes(q))&&(c==='all'||x.cat===c)&&(st==='all'||(st==='fav'&&store.phFav.includes(x.id))||(st==='due'&&isPDue(x.id))||(st==='known'&&store.phKnown.includes(x.id))||(st==='new'&&!store.phKnown.includes(x.id))))
}
function renderPhrases(){
  let a=phFiltered();
  $('#phCount').textContent=a.length;
  $('#phKnownN').textContent=store.phKnown.length;
  /* V5.24.0：片語卡精簡——🔊 ☆ ○ 放在片語那一行，💬 🐢 放在例句框右邊 */
  $('#phRows').innerHTML=a.slice(0,phShown).map(x=>`<div class="word-card ${store.phKnown.includes(x.id)?'status-known':'status-new'}" data-id="${x.id}"><span class="word-main"><span class="wc-head"><span class="word-rank">${PH_CAT[x.cat]}</span><strong>${esc(x.p)}</strong><span class="word-actions"><button data-a="play" aria-label="片語發音">🔊</button><button data-a="fav" aria-label="收藏">${store.phFav.includes(x.id)?'★':'☆'}</button>${isPDue(x.id)?'<button data-a="pok" class="g3">✓還會</button><button data-a="pno" class="g1">✗忘了</button>':`<button data-a="known" aria-label="標記已會">${store.phKnown.includes(x.id)?'✓':'○'}</button>`}</span></span><span class="zh">${esc(x.zh)}${isPDue(x.id)?' <em class="duetag">待複習</em>':''}</span><span class="ex ex2">${esc(x.ex)}<br><small>${esc(x.exz)}</small><span class="ex-btns"><button data-a="ex" aria-label="播放例句">💬</button><button data-a="slow" aria-label="慢速例句">🐢</button></span></span></span></div>`).join('');
  if(!a.length){
    const st=$('#phState').value,q=$('#phSearch').value.trim();
    $('#phRows').innerHTML=`<p class="muted empty-note">${q?'找不到符合「'+esc(q)+'」的片語。':st==='due'?'🎉 今天到期的片語都複習完了。':'這個範圍目前沒有片語。'}</p>`
  }
  $('#phMore').hidden=phShown>=a.length
}
['phSearch','phCat','phState'].forEach(id=>$('#'+id).addEventListener(id==='phSearch'?'input':'change',id==='phSearch'?debounce(()=>{
  phShown=40;
  renderPhrases()
},150):()=>{
  phShown=40;
  renderPhrases()
}));
$('#phMore').onclick=()=>{
  phShown+=60;
  renderPhrases()
};
$('#phRows').onclick=e=>{
  let b=e.target.closest('button'),row=e.target.closest('.word-card');
  if(!b||!row)return;
  let id=+row.dataset.id,x=PHRASES[id-1],a=b.dataset.a;
  if(a==='play')say(x.p,.95);
  if(a==='ex')say(x.ex,.95);
  if(a==='slow')say(x.ex,.65);
  const tg=k=>{
    let arr=store[k],n=arr.indexOf(id);
    n<0?arr.push(id):arr.splice(n,1);
    save();
    renderPhrases()
  };
  if(a==='fav')tg('phFav');
  if(a==='known'){
    let was=store.phKnown.includes(id);
    if(was)srsDel('p',id);else srsSet('p',id,1);
    tg('phKnown');
    markStudy();
    logMark('ph',id,!was)
  }
  if(a==='pok'){
    srsSet('p',id,srsStage('p',id)+1);
    bumpLog('prev');
    markStudy();
    save();
    renderPhrases()
  }
  if(a==='pno'){
    srsDel('p',id);
    store.phKnown=store.phKnown.filter(v=>v!==id);
    bumpLog('prev');
    markStudy();
    save();
    renderPhrases()
  }
};
$('#navPhrases').onclick=()=>{
  page('phrases');
  phShown=40;
  renderPhrases()
};
function bar(n,t){
  let pc=t?Math.round(n/t*100):0;
  return `<div class="bar"><span style="width:${pc}%"></span></div><small>${n} / ${t}（${pc}%）</small>`
}
/* ===== V5.18.0 分題型統計 ===== */
const QT_LABEL={'w-en':'單字：看英文選中文','w-zh':'單字：看中文選英文','w-listen':'單字：聽發音選單字','w-cloze':'單字：例句填空','w-dict':'單字：聽寫拼字','phrase':'片語測驗','p-dict':'片語：聽寫拼字','sentence':'句子測驗','lisen':'聽英文句子選中文','liszh':'看中文聽選英文','dcloze':'對話填空','situ':'CE 情境題','radio':'無線電代號與數字','pairs':'發音辨別'};
let qCur='';
function qStat(type,ok){
  store.qStat=store.qStat&&typeof store.qStat==='object'&&!Array.isArray(store.qStat)?store.qStat:{};
  const v=Array.isArray(store.qStat[type])?store.qStat[type]:[0,0];
  v[ok?0:1]=(+v[ok?0:1]||0)+1;
  store.qStat[type]=v;
  if(!store.qStatSince)store.qStatSince=day()
}
function qStatHtml(){
  const st=store.qStat||{};
  const rows=Object.keys(QT_LABEL).filter(k=>Array.isArray(st[k])&&st[k][0]+st[k][1]>0);
  let weak=null;
  rows.forEach(k=>{
    const n=st[k][0]+st[k][1],acc=st[k][0]/n;
    if(n>=5&&(!weak||acc<weak.acc))weak={k,acc}
  });
  const rp=Object.values(store.rpDone||{}).filter(x=>x&&typeof x==='object');
  const rpS=rp.map(x=>x.avg).filter(x=>typeof x==='number');
  const rpAvg=rpS.length?Math.round(rpS.reduce((s,x)=>s+x,0)/rpS.length):null;
  const W=wbData();
  return `<h3>各題型正確率 <small class="muted">${store.qStatSince?'（'+esc(store.qStatSince)+' 起）':'（V5.18.0 起統計）'}</small></h3>`+(rows.length?rows.map(k=>`<div class="stat-row${weak&&weak.k===k?' qs-weak':''}"><b>${QT_LABEL[k]}${weak&&weak.k===k?' ⚠️':''}</b>${bar(st[k][0],st[k][0]+st[k][1])}</div>`).join(''):'<p class="muted">還沒有資料：做測驗後會依題型統計正確率。</p>')+(weak?`<p class="qs-tip">⚠️ 最弱的題型：${QT_LABEL[weak.k]}（正確率 ${Math.round(weak.acc*100)}%），建議多練習。</p>`:'')+`<h3>情境對話與 Role Play</h3><div class="stat-row"><b>對話已練習</b>${bar(Object.keys(store.dlgDone||{}).filter(k=>DLG_BY[k]).length,DIALOGS.length)}</div><div class="stat-row"><b>Role Play 已演</b>${bar(Object.keys(store.rpDone||{}).filter(k=>DLG_BY[k]).length,DIALOGS.length)}</div><p class="muted">Role Play 平均相似度 ${rpAvg!=null?rpAvg+'%':'—'}</p><h3>📕 錯題本</h3><p class="muted">單字 ${W.words.length}、句子 ${W.sents.length}、情境題 ${W.situs.length}${W.phr&&W.phr.length?'、片語 '+W.phr.length:''} <button class="mini" data-openwb="1">打開錯題本</button></p>`
}
function renderStats(){
  let r=store.quizRight||0,w=store.quizWrong||0,tot=r+w;
  const sv=skipV();
  const inB=(x,b)=>inBook(x,String(b))&&!(sv&&x.b&&x.k!==7);
  let books=[1,2,3,4,5,7,8,'toeic'].map(b=>{
    let a=WORDS.filter(x=>inB(x,b));
    if(!a.length)return '';
    let k=a.filter(x=>statusOf(x.w)==='known').length;
    return `<div class="stat-row"><b>${b===7?'CE 字':b===8?'職場英文':b==='toeic'?'TOEIC 多益':'第 '+b+' 冊'}</b>${bar(k,a.length)}</div>`
  }).join('');
  let allW=WORDS.filter(x=>inB(x,'all')),allK=allW.filter(x=>statusOf(x.w)==='known').length;
  let learning=WORDS.filter(x=>statusOf(x.w)==='learning').length,due=WORDS.filter(x=>isDue(x.w)).length;
  $('#statsBody').innerHTML=`<div class="stat-cards"><div><b>${streak()}</b><span>連續學習天數</span></div><div><b>${(store.studyDays||[]).length}</b><span>累計學習天數</span></div><div><b>${tot?Math.round(r/tot*100)+'%':'—'}</b><span>測驗正確率（${r}/${tot}）</span></div></div>${wkHtml()}<h3>單字（已熟）${sv?'<small class="muted">　只計原形</small>':''}</h3>${books}<div class="stat-row"><b>合計</b>${bar(allK,allW.length)}</div><p class="muted">學習中 ${learning} 字 · 今日待複習 ${due} 字</p><h3>片語</h3><div class="stat-row"><b>已會</b>${bar(store.phKnown.length,PHRASES.length)}</div><p class="muted">待複習片語 ${PHRASES.filter(x=>isPDue(x.id)).length} 個</p><h3>句子</h3><div class="stat-row"><b>會說了</b>${bar(store.known.length,ALLS.length)}</div><p class="muted">待複習句子 ${ALLS.filter(s=>isSDue(s.id)).length} 句</p>`+statsExtraHtml()+qStatHtml()+stHtml()
}
$('#statsBody').addEventListener('click',e=>{
  if(e.target.closest('[data-openwb]'))openWrongBook()
});
$('#navStats').onclick=()=>{
  page('stats');
  renderStats();
  fillVoices();
  verCheck();
  renderBackup()
};
function fillVoices(){
  let sel=$('#voiceSel');
  if(!sel)return;
  let cur=pickVoice();
  sel.innerHTML=voices.length?voices.map(v=>`<option value="${esc(v.voiceURI)}"${cur&&v.voiceURI===cur.voiceURI?' selected':''}>${esc(v.name)}（${esc(v.lang)}）</option>`).join(''):'<option>此裝置沒有可用的英文語音</option>'
}
$('#voiceSel').onchange=e=>{
  store.settings.voice=e.target.value;
  save();
  say('Hello, this is my new voice.',1)
};
$('#voiceTest').onclick=()=>say('Please check the system status.',1);

/* ===== V5.13：今日學習、答錯單字本、備份提醒、深色模式 ===== */
function bumpLog(k){
  store.dailyLog=store.dailyLog||{};
  let t=day();
  let L=store.dailyLog[t]=store.dailyLog[t]||{};
  L[k]=(L[k]||0)+1;
  let ks=Object.keys(store.dailyLog).sort();
  if(ks.length>60)delete store.dailyLog[ks[0]];
  save()
}
/* V5.27.2：「標記會說／已會」的今日計數記住是哪幾項；同一天取消標記會扣回 */
function logMark(k,id,on){
  store.dailyLog=store.dailyLog||{};
  const t=day(),L=store.dailyLog[t]=store.dailyLog[t]||{},ik=k+'Ids';
  const a=Array.isArray(L[ik])?L[ik]:(L[ik]=[]);
  const n=a.indexOf(id);
  if(on&&n<0){
    a.push(id);
    L[k]=(L[k]||0)+1
  }else if(!on&&n>=0){
    a.splice(n,1);
    L[k]=Math.max(0,(L[k]||0)-1)
  }
  let ks=Object.keys(store.dailyLog).sort();
  if(ks.length>60)delete store.dailyLog[ks[0]];
  save()
}
function todayLog(){
  return (store.dailyLog||{})[day()]||{}
}
function task(icon,title,done,goal,btn,id,note=''){
  let ok=goal&&done>=goal;
  let pc=goal?Math.min(100,Math.round(done/goal*100)):0;
  return `<div class="task ${ok?'task-done':''}"><div class="task-top"><span class="task-ic">${icon}</span><div class="task-t"><b>${title}</b><small>${goal?`${Math.min(done,goal)} / ${goal}`:note}${ok?' ✅':''}</small></div><button class="primary" data-go="${id}">${btn}</button></div>${goal?`<div class="bar"><span style="width:${pc}%"></span></div>`:''}</div>`
}
/* V5.17.0：今日學習建議的 Role Play — 先選還沒演過的情境，都演過就選最久沒演的 */
function rpSuggest(){
  const done=store.rpDone||{};
  return DIALOGS.find(d=>!done[d.id])||DIALOGS.slice().sort((x,y)=>String(done[x.id].d).localeCompare(String(done[y.id].d)))[0]||{t:'',id:''}
}
function renderToday(){
  let sdue=ALLS.filter(s=>isSDue(s.id)).length,pdue=PHRASES.filter(x=>isPDue(x.id)).length;
  const rpSug=rpSuggest(),wb=wbData();
  let L=todayLog(),due=WORDS.filter(x=>isDue(x.w)).length,g=store.settings.dailyGoal||20;
  let d=new Date(),wd='日一二三四五六'[d.getDay()];
  let dueDone=L.review||0;
  let backup='';
  /* V5.32.0：有學習進度、14 天沒備份（或從沒備份）才提醒；可以「稍後提醒」（7 天） */
  backup=bkRemindHtml();
  $('#todayBody').innerHTML=`<div class="today-head"><div><b>${d.getMonth()+1} 月 ${d.getDate()} 日（${wd}）</b><small>連續學習 ${streak()} 天</small></div><div class="ring"><b>${['new','review','sent','ph','quiz','srev','prev','rp'].reduce((s,k)=>s+(L[k]||0),0)}</b><small>今日完成</small></div></div>${flowBtnHtml()}${flowCfgHtml()}${iosTipHtml()}${backup}
${(()=>{
  /* V5.29.0：每日複習上限（到期的字太多時分幾天消化） */
  const cap=reviewCap(),goal=cap?Math.min(cap,dueDone+due):dueDone+due,over=cap&&dueDone>=cap&&due>0;
  return task('🔁','複習到期單字',dueDone,goal,due?(over?'再複習':'開始複習'):'已完成','review',due?'':'今天沒有到期的字')+(over?`<p class="muted task-note">今天已複習 ${dueDone} 個，達到每日上限；剩下 ${due} 個明天再複習。</p>`:cap&&due>cap-dueDone?`<p class="muted task-note">到期 ${due} 個，今天先複習 ${cap-dueDone} 個（每日上限 ${cap} 個，可在統計頁調整）。</p>`:'')
})()}
${task('🆕','學新單字',L.new||0,g,'開始','new')}
${task('🗣','句子跟讀（標記會說）',L.sent||0,10,'開始','sent')}
${task('💬','片語（標記已會）',L.ph||0,5,'開始','ph')}
${sdue?task('🔁','複習句子（到期）',L.srev||0,(L.srev||0)+sdue,'開始','srev'):''}
${pdue?task('🔁','複習片語（到期）',L.prev||0,(L.prev||0)+pdue,'開始','prev'):''}
${task('🧠','測驗',L.quiz||0,10,'開始','quiz')}
${(()=>{
  const r=rpResume();
  return r?task('🎭','Role Play（繼續：'+esc(r.d.t)+'，'+esc(rpResumeLabel(r))+'）',L.rp||0,1,'繼續','rpres'):task('🎭','Role Play（建議：'+esc(rpSug.t)+'）',L.rp||0,1,'開始','rp')
})()}${rpDueHtml()}
${task('🏭','CE 情境題',L.situ||0,5,'開始','situ')}
${wb.total?task('📕','我的錯題本',0,0,'打開','wrongbook',`單字 ${wb.words.length}、句子 ${wb.sents.length}、情境題 ${wb.situs.length}${wb.phr&&wb.phr.length?'、片語 '+wb.phr.length:''}，共 ${wb.total} 題`):''}
${wkMiniHtml()}<p class="muted">每日新字數量可在「單字」頁的「篩選」裡調整（目前 ${g} 字）。</p>${EX_FAIL?'<p class="rec-msg warn">⚠️ 單字例句還沒下載完成（網路不穩）。請連上網路後重新開啟 App；其他功能可以正常使用。</p>':''}`
}
$('#todayBody').onclick=e=>{
  let b=e.target.closest('[data-go]');
  if(!b)return;
  todayGo(b.dataset.go)
};
/* V5.29.0：今日頁的各項任務改成函式（一鍵今日學習也用它切換） */
function todayGo(g){
  if(g==='flow'){
    flowStale();
    if(FLOW&&FLOW.i<FLOW.steps.length)flowGo();else flowStart();
    return
  }
  if(g==='iostip'||g==='iostipnever'){
    store.settings.iosTip=g==='iostip'?day():'never';
    save();
    renderToday();
    return
  }
  if(g==='review'){
    page('words');
    renderWords();
    $('#reviewStart').click()
  }
else if(g==='srev'){
    page('practice');
    $('#unit').value='sdue';
    i=0;
    filter();
    render()
  }
else if(g==='prev'){
    $('#navPhrases').click();
    $('#phSearch').value='';
    $('#phCat').value='all';
    $('#phState').value='due';
    phShown=40;
    renderPhrases()
  }
else if(g==='new'){
    page('words');
    renderWords();
    $('#dailyStart').click()
  }
else if(g==='sent'){
    page('practice');
    /* V5.31.1：從「複習句子」過來時句子頁還停在待複習範圍，在那裡按「✓」反而會取消已會說 */
    if(/^(sdue|lsw|fav|search)$/.test($('#unit').value)){
      const lu=store.settings.learnUnit,nu=lu&&[...$('#unit').options].some(o=>o.value===lu)&&!/^(sdue|lsw|fav|search)$/.test(lu)?lu:'all';
      $('#unit').value=nu;
      store.settings.unit=nu;
      i=(store.settings.pos&&store.settings.pos[nu])||0;
      save();
      filter()
    }
    if(!$('#hideKnown').checked){
      $('#hideKnown').checked=true;
      store.settings.hideKnown=true;
      save();
      filter()
    }
    render()
  }
else if(g==='ph'){
    $('#navPhrases').click();
    $('#phSearch').value='';
    $('#phCat').value='all';
    $('#phState').value='new';
    phShown=40;
    renderPhrases()
  }
else if(g==='quiz'){
    page('quiz');
    $('#quizType').value='word';
    if($('#quizBook').value==='wrong')$('#quizBook').value='all';
    $('#quizType').onchange()
  }
else if(g==='wrong'){
    page('quiz');
    $('#quizType').value='word';
    $('#quizBook').value='wrong';
    $('#quizMode').value='mix';
    $('#quizType').onchange()
  }
else if(g==='wrongbook'){
    openWrongBook()
  }
else if(g==='rp'){
    const d=rpSuggest();
    page('dialogs');
    if(DLG_BY[d.id]){
      DLG.cur=DLG_BY[d.id];
      renderDialog(DLG.cur)
    }else renderDialogs()
  }
else if(g==='situ'||g==='sqw'){
    page('quiz');
    $('#quizType').value='situ';
    $('#quizSRange2').value=g==='sqw'?'wrong':'all';
    $('#quizType').onchange()
  }
else if(g==='lsw'){
    page('quiz');
    $('#quizType').value='lisen';
    $('#quizSRange').value='wrong';
    $('#quizType').onchange()
  }
else if(g==='rpres'){
    if(!rpResumeGo()){
      page('dialogs');
      renderDialogs()
    }
  }
else if(g==='backup'){
    exportBackup(false);
    setTimeout(renderToday,300)
  }
};
$('#navToday').onclick=()=>{
  page('today');
  renderToday()
};
function applyTheme(){
  let m=store.settings.theme||'auto';
  let dark=m==='dark'||(m==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',dark);
  try{
    if(m==='auto')localStorage.removeItem('e5k_theme');else localStorage.setItem('e5k_theme',m)
  }catch(e){}
  let mc=document.querySelector('meta[name=theme-color]');
  if(mc)mc.content=dark?'#0f1a2b':'#2f69d5'
}
$('#themeSel').value=store.settings.theme||'auto';
$('#themeSel').onchange=e=>{
  store.settings.theme=e.target.value;
  save();
  applyTheme()
};
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
applyTheme();
/* V5.20.0 字體大小：標準／大／特大；同時存一份在 e5k_fs，開啟時在畫面出現前就套用 */
const FS_OK=['1','1.15','1.3'];
function applyFont(){
  let v=String(store.settings.fontScale||'1');
  if(!FS_OK.includes(v))v='1';
  document.documentElement.style.setProperty('--fs',v);
  try{
    if(v==='1')localStorage.removeItem('e5k_fs');else localStorage.setItem('e5k_fs',v)
  }catch(e){}
  const s=$('#fontSel');
  if(s)s.value=v
}
$('#fontSel').onchange=e=>{
  store.settings.fontScale=e.target.value;
  save();
  applyFont()
};
applyFont();

/* ===== V5.14：句子／片語複習排程、片語測驗、CE 專業字、自動播放、詞形與相關字、主題 ===== */
store.sStage=store.sStage||{};
store.sDue=store.sDue||{};
store.pStage=store.pStage||{};
store.pDue=store.pDue||{};
function srsStage(k,id){
  return (store[k+'Stage']||{})[id]||0
}
function srsSet(k,id,st){
  st=Math.max(1,Math.min(st,INTERVALS.length-1));
  store[k+'Stage'][id]=st;
  store[k+'Due'][id]=day(INTERVALS[st]);
  save()
}
function srsDel(k,id){
  delete store[k+'Stage'][id];
  delete store[k+'Due'][id];
  save()
}
function isSDue(id){
  return !!(store.sDue&&store.sDue[id]&&store.sDue[id]<=day()&&cset('known').has(id))
}
function isPDue(id){
  return !!(store.pDue&&store.pDue[id]&&store.pDue[id]<=day()&&cset('phKnown').has(id))
}
(function migrate514(){
  if(store.srsV===514)return;
  store.known.forEach((id,n)=>{
    if(!store.sDue[id]){
      store.sStage[id]=1;
      store.sDue[id]=day(1+n%7)
    }
  });
  store.phKnown.forEach((id,n)=>{
    if(!store.pDue[id]){
      store.pStage[id]=1;
      store.pDue[id]=day(1+n%7)
    }
  });
  store.srsV=514;
  save()
})();
$('#sOk').onclick=()=>{
  let id=cur().id;
  srsSet('s',id,srsStage('s',id)+1);
  bumpLog('srev');
  markStudy();
  filter();
  render()
};
$('#sNo').onclick=()=>{
  let id=cur().id;
  srsDel('s',id);
  store.known=store.known.filter(v=>v!==id);
  bumpLog('srev');
  markStudy();
  save();
  filter();
  render()
};
const VS={};
WORDS.forEach(x=>{
  if(x.b)(VS[x.b]=VS[x.b]||[]).push(x.w)
});
function bookName(x){
  return (x.ce?'CE 專業字':x.job?'職場英文':'#'+x.r+' · 第 '+x.k+' 冊')+(x.toeic?' · 多益 #'+x.toeic:'')
}
function chip(w){
  return `<a data-jump="${esc(w)}">${esc(dispW(w))}</a>`
}
function relHtml(x){
  let h='';
  /* V5.23.0：衍生字（happily←happy）與英式用字（petrol＝gas）分開顯示 */
  if(x.b)h+=`<span class="rel">${x.v==='d'?'衍生自':x.v==='u'?'英式用字，相關美式字':'原形'} ${chip(x.b)}</span>`;
  if(VS[x.w]){
    const g={f:[],d:[],u:[]};
    VS[x.w].forEach(w=>{
      const y=WMAP[w];
      g[y&&(y.v==='d'||y.v==='u')?y.v:'f'].push(w)
    });
    if(g.f.length)h+=`<span class="rel">詞形 ${g.f.map(chip).join('、')}</span>`;
    if(g.d.length)h+=`<span class="rel">衍生字 ${g.d.map(chip).join('、')}</span>`;
    if(g.u.length)h+=`<span class="rel">英式用字 ${g.u.map(chip).join('、')}</span>`
  }
  if(x.f)h+=`<span class="rel">相關字 ${x.f.map(chip).join('、')}</span>`;
  return h?`<div class="rels">${h}</div>`:''
}
/* V5.23.1：主題後面的數字依目前選的範圍計算（冊別＋「只學原形」），和清單顯示的字數一致；換冊時保留已選的主題 */
function updTopicCounts(){
  const book=$('#wordBook').value,sv=skipV(),n={};
  WORDS.forEach(x=>{
    if(x.t&&inBook(x,book)&&!(sv&&x.b&&x.k!==7))x.t.forEach(k=>{
      n[k]=(n[k]||0)+1
    })
  });
  const sel=$('#wordTopic'),cur=sel.value||'all';
  sel.innerHTML='<option value="all">全部主題</option>'+Object.entries(TOPICS).map(([k,v])=>`<option value="${k}">${v}（${n[k]||0}）</option>`).join('');
  sel.value=cur
}
updTopicCounts();
$('#skipVar').checked=skipV();
$('#skipVar').onchange=()=>{
  store.settings.skipVar=$('#skipVar').checked;
  save();
  updTopicCounts();
  wordShown=60;
  renderWords()
};
/* 自動播放 */
let autoOn=false,cardAuto=false,autoTok=0;
function zhVoice(){
  let vs=speechSynthesis.getVoices();
  return vs.find(v=>/zh[-_](TW|HK)/i.test(v.lang))||vs.find(v=>/^zh/i.test(v.lang))||vs.find(v=>/^cmn/i.test(v.lang))
}
function speakCb(t,rate,lang,cb){
  let done=false;
  const fin=()=>{
    if(done)return;
    done=true;
    cb&&cb()
  };
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t);
  u.rate=rate;
  if(lang==='zh'){
    let v=zhVoice();
    if(!v){
      fin();
      return
    }
    u.voice=v;
    u.lang=v.lang
  }else{
    const pv=pickVoice();
    u.lang='en-US';
    if(pv){
      u.voice=pv;
      u.lang=pv.lang
    }
  }
  u.onend=fin;
  u.onerror=fin;
  speechSynthesis.speak(u);
  setTimeout(fin,Math.max(2500,t.length*(lang==='zh'?300:110)/rate+1800))
}
function steps(list,tok,cb){
  let k=0;
  const nx=()=>{
    if(tok!==autoTok)return;
    if(k>=list.length){
      cb&&cb();
      return
    }
    let s=list[k++];
    if(s.wait){
      setTimeout(nx,s.wait);
      return
    }
    speakCb(s.t,s.r||1,s.l,()=>setTimeout(nx,350))
  };
  nx()
}
function stopAuto(){
  autoTok++;
  if(autoOn){
    autoOn=false;
    $('#autoPlay').textContent='▶ 自動播放';
    $('#autoPlay').classList.remove('primary')
  }
  if(cardAuto){
    cardAuto=false;
    if(!$('#wordCard').hidden&&cardPool.length)showCard()
  }
  try{
    speechSynthesis.cancel()
  }catch(e){}
}
function autoSentence(){
  if(!autoOn)return;
  if($('.panel').hidden){
    stopAuto();
    return
  }
  let s=cur(),tok=autoTok,rep=+(store.settings.autoRep||2);
  let L=[{t:s.en,r:1}];
  if(rep>=2)L.push({wait:500},{t:s.en,r:.7});
  if(store.settings.autoZh)L.push({wait:300},{t:s.zh,l:'zh'});
  L.push({wait:1200});
  steps(L,tok,()=>{
    if(tok!==autoTok||!autoOn)return;
    i=(i+1)%pool.length;
    render();
    autoSentence()
  })
}
$('#autoPlay').onclick=()=>{
  if(autoOn){
    stopAuto();
    return
  }
  stopAuto();
  autoOn=true;
  $('#autoPlay').textContent='⏸ 停止自動';
  $('#autoPlay').classList.add('primary');
  autoSentence()
};
function startCardAuto(){
  stopAuto();
  cardAuto=true;
  cardReveal=true;
  showCard();
  cardStep()
}
function cardStep(){
  if(!cardAuto||$('#wordCard').hidden||$('#wordPage').hidden||!cardPool.length){
    stopAuto();
    return
  }
  let x=cardPool[cardIndex],tok=autoTok;
  let L=[{t:x.w,r:1},{wait:400},{t:x.w,r:.65}];
  if(store.settings.autoZh)L.push({wait:300},{t:x.zh.replace(/（.*?）/g,''),l:'zh'});
  if(x.ex)L.push({wait:400},{t:x.ex,r:.95});
  L.push({wait:1200});
  steps(L,tok,()=>{
    if(tok!==autoTok||!cardAuto)return;
    cardIndex=(cardIndex+1)%cardPool.length;
    cardReveal=true;
    showCard();
    cardStep()
  })
}
/* V5.16.20：在「捕獲階段」先停止自動播放，避免把按鈕剛開始的發音取消；錄音、標記、收藏、複習、換單元也會停止句子自動播放 */
$('nav').addEventListener('click',e=>{
  if(e.target.closest('button'))stopAuto()
},true);
document.addEventListener('click',e=>{
  if(autoOn&&e.target.closest('#prev,#next,#play,#slow,#repeat,#check,#record,#mine,#compare,#known,#fav,#sOk,#sNo,#openList'))stopAuto()
},true);
['unit','hideKnown'].forEach(id=>$('#'+id).addEventListener('change',()=>{
  if(autoOn)stopAuto()
}));
$('#autoZh').checked=!!store.settings.autoZh;
$('#autoZh').onchange=()=>{
  store.settings.autoZh=$('#autoZh').checked;
  save()
};
$('#autoRep').value=String(store.settings.autoRep||2);
$('#autoRep').onchange=()=>{
  store.settings.autoRep=+$('#autoRep').value;
  save()
};
/* 片語測驗 */
/* V5.28.0：片語填空可以對到變化形（looking for、makes sense、called off）
   和中間插入受詞的片語（pick you up、fill me in、bring it up）；原本只認一模一樣的寫法，25 個片語不會出填空題 */
const _phRe=new Map();
let _formsOf=null;
function phForms(w){
  if(!_formsOf){
    _formsOf={};
    WORDS.forEach(y=>{
      if(y.b&&!y.v)(_formsOf[y.b]=_formsOf[y.b]||[]).push(y.w.toLowerCase())
    })
  }
  const l=w.slice(-1),c=w.slice(0,-1),out=new Set([w,w+'s',w+'es',w+'ed',w+'d',w+'ing',w+l+'ed',w+l+'ing',...(_formsOf[w]||[])]);
  if(l==='e')out.add(c+'ing');
  if(l==='y'){
    out.add(c+'ies');
    out.add(c+'ied')
  }
  return [...out]
}
function phraseRe(p){
  let re=_phRe.get(p);
  if(re)return re;
  const E=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const ANY=/^(someone|somebody|sb|something|sth|one's|someone's|oneself)$/i;
  /* 中間的 a／an／the 可有可無（make a mistake → makes mistakes），最後一個字可以是複數（action items） */
  const words=String(p).trim().split(/\s+/).map(w=>w.replace(/[.,!?;:]+$/,'')).filter(Boolean).filter((w,i,a)=>!(i>0&&i<a.length-1&&/^(a|an|the)$/i.test(w)));
  const parts=words.map((w,i)=>{
    if(ANY.test(w))return "[A-Za-z'’]+(?:\\s+[A-Za-z'’]+)?";
    const lw=w.toLowerCase(),last=i===words.length-1&&i>0&&/^[a-z]+$/.test(lw);
    const alts=i===0&&words.length>1&&/^[a-z]+$/.test(lw)?phForms(lw):last?[lw,lw+'s',lw+'es',...(lw.endsWith('y')?[lw.slice(0,-1)+'ies']:[])]:[lw];
    return '(?:'+alts.map(E).sort((a,b)=>b.length-a.length).join('|')+')'
  });
  re=new RegExp('\\b'+parts.join("(?:\\s+[A-Za-z'’]+){0,2}?\\s+")+'(?![A-Za-z])','i');
  _phRe.set(p,re);
  return re
}
function phraseQuiz(){
  qCur='';
  let mode=$('#quizMode').value;
  /* V5.32.0：聽寫（拼字）是真的聽寫題（pdQuiz）；綜合也會出聽寫 */
  if(mode==='mix')mode=['en','zh','cloze','listen','dict'][Math.floor(Math.random()*5)];
  if(mode==='dict')return pdQuiz();
  let x=PHRASES[Math.floor(Math.random()*PHRASES.length)];
  let re=phraseRe(x.p);
  if(mode==='cloze'&&!re.test(x.ex))mode='zh';
  let same=PHRASES.filter(y=>y.id!==x.id&&y.cat===x.cat&&y.zh!==x.zh).sort(()=>Math.random()-.5).slice(0,3);
  let opts=[x,...same].sort(()=>Math.random()-.5);
  $('#quizMsg').textContent='';
  if(mode==='en')$('#quizQ').innerHTML=esc(x.p);else if(mode==='zh')$('#quizQ').innerHTML=esc(x.zh);else if(mode==='cloze')$('#quizQ').innerHTML=esc(x.ex).replace(re,'<span class="blank">_____</span>')+`<br><small>${esc(x.exz)}</small>`;else{
    $('#quizQ').innerHTML='🔊 聽片語，選出正確的片語 <button id="quizReplay">再聽</button>';
    say(x.p,.9);
    setTimeout(()=>{
      let r=$('#quizReplay');
      if(r)r.onclick=()=>say(x.p,.7)
    },0)
  }
  $('#quizOpts').innerHTML=opts.map(o=>`<button data-ok="${o.id===x.id}">${mode==='en'?esc(o.zh):esc(o.p)}</button>`).join('');
  let done=false;
  $('#quizOpts').onclick=e=>{
    let b=e.target.closest('button');
    if(!b||done)return;
    done=true;
    let ok=b.dataset.ok==='true';
    b.classList.add(ok?'opt-ok':'opt-bad');
    if(!ok)$('#quizOpts').querySelector('[data-ok=true]').classList.add('opt-ok');
    store[ok?'quizRight':'quizWrong']=(store[ok?'quizRight':'quizWrong']||0)+1;
    qStat('phrase',ok);
    if(!ok&&store.phKnown.includes(x.id)){
      store.pDue[x.id]=day();
      store.pStage[x.id]=1
    }
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案：'} ${esc(x.p)}｜${esc(x.zh)}<br><small>${esc(x.ex)}</small>${!ok&&store.phKnown.includes(x.id)?'<br><small>已排入今天複習</small>':''}`;
    bumpLog('quiz');
    markStudy();
    save();
    say(x.p,.95)
  }
}
/* ===== V5.16.17 Priority 5：TWDC CE 情境對話 ===== */
const DIALOGS=window.DIALOGS||[];
const DLG_BY={};
DIALOGS.forEach(d=>DLG_BY[d.id]=d);
store.dlgDone=store.dlgDone&&typeof store.dlgDone==='object'&&!Array.isArray(store.dlgDone)?store.dlgDone:{};
const DLG={cur:null,zh:false,slow:false,tok:0,playing:-1,run:false};
function dlgVoices(){
  const b=pickVoice();
  const others=voices.filter(v=>!b||v.voiceURI!==b.voiceURI);
  const us=others.filter(v=>/en[-_]US/i.test(v.lang));
  return {A:us[0]||others[0]||b||null,B:b||null}
}
function sayV(t,rate,v,done){
  try{
    speechSynthesis.cancel()
  }catch(e){}
  const u=new SpeechSynthesisUtterance(t);
  u.lang='en-US';
  u.rate=rate;
  if(v){
    u.voice=v;
    u.lang=v.lang
  }
  let fin=false;
  const end=()=>{
    if(fin)return;
    fin=true;
    done&&done()
  };
  u.onend=end;
  u.onerror=end;
  speechSynthesis.speak(u);/* 保護：部分手機不會觸發 onend */
  setTimeout(()=>{
    if(!speechSynthesis.speaking)end()
  },Math.max(2500,t.length*140/rate))
}
function dlgStop(){
  DLG.tok++;
  DLG.playing=-1;
  DLG.run=false;
  try{
    speechSynthesis.cancel()
  }catch(e){}
  dlgMark();
  const b=$('#dlgPlayAll');
  if(b)b.textContent='▶ 播放整段'
}
function dlgMark(){
  document.querySelectorAll('#dialogBody .dlg-line').forEach(el=>el.classList.toggle('dlg-now',+el.dataset.n===DLG.playing))
}
function dlgPlayLine(d,n,rate,done){
  const L=d.lines[n];
  if(!L){
    done&&done();
    return
  }
  const V=dlgVoices();
  DLG.playing=n;
  dlgMark();
  const el=document.querySelector(`#dialogBody .dlg-line[data-n="${n}"]`);
  if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',behavior:'smooth'});
  sayV(L.en,rate,L.s==='A'?V.A:V.B,()=>{
    if(DLG.playing===n){
      DLG.playing=-1;
      dlgMark()
    }
    done&&done()
  })
}
function dlgPlayAll(){
  const d=DLG.cur;
  if(!d)return;
  if(DLG.run){
    dlgStop();
    return
  }
  dlgStop();
  const tok=++DLG.tok;
  DLG.run=true;
  const rate=DLG.slow?.7:.95;
  $('#dlgPlayAll').textContent='■ 停止';
  let n=0;
  const next=()=>{
    if(tok!==DLG.tok)return;
    if(n>=d.lines.length){
      DLG.playing=-1;
      DLG.run=false;
      dlgMark();
      const pb=$('#dlgPlayAll');
      if(pb)pb.textContent='▶ 播放整段';
      return
    }
    dlgPlayLine(d,n++,rate,()=>{
      if(tok===DLG.tok)setTimeout(next,450)
    })
  };
  next()
}
function renderDialogs(){
  const box=$('#dialogBody');
  if(!box)return;
  dlgStop();
  if(DLG.cur){
    renderDialog(DLG.cur);
    return
  }
  const done=Object.keys(store.dlgDone).filter(k=>DLG_BY[k]).length;
  const rres=rpResume();
  box.innerHTML=(rres?`<div class="rp-resume"><span>🎭 上次的 Role Play：<b>${esc(rres.d.t)}</b><small>（${esc(rpResumeLabel(rres))}）</small></span><button class="primary" data-rpresume="1">▶ 繼續</button></div>`:'')+`<p class="muted">TWDC CE 現場常用的 ${DIALOGS.length} 個情境。點一個情境開始：先聽整段、再逐句跟讀；B 是你的角色。</p><div class="word-stats"><span>已練習 <b>${done}</b> / ${DIALOGS.length}</span><span>共 <b>${DIALOGS.reduce((a,d)=>a+d.lines.length,0)}</b> 句</span></div>`+radioCardHtml()+
 DIALOGS.map((d,k)=>`<div class="dlg-card${store.dlgDone[d.id]?' dlg-done':''}" data-d="${esc(d.id)}" role="button" tabindex="0"><span class="dlg-no">${k+1}</span><span class="dlg-main"><b>${esc(d.t)}${rpBadge(d.id)}</b> <small>${esc(d.te)}</small><small class="dlg-desc">${esc(d.desc)}</small></span><span class="dlg-tick">${store.dlgDone[d.id]?'✓':'›'}</span></div>`).join('')
}
function renderDialog(d){
  const box=$('#dialogBody');
  const dn=store.dlgDone[d.id];
  box.innerHTML=`<button id="dlgBack" class="mini">← 情境列表</button><h3 class="dlg-title">${esc(d.t)} <small>${esc(d.te)}</small></h3><p class="dlg-sit">${esc(d.desc)}</p>
 <div class="dlg-roles"><span class="dlg-a">A　${esc(d.roles.A)}</span><span class="dlg-b">B　${esc(d.roles.B)}</span></div>
 <div class="grid2 dlg-tools"><button id="dlgPlayAll" class="primary">${DLG.run?'■ 停止':'▶ 播放整段'}</button><button id="dlgSlow">🐢 慢速：${DLG.slow?'開':'關'}</button><button id="dlgZh">👁 ${DLG.zh?'隱藏中文':'顯示中文'}</button><button id="dlgShadow">🗣 逐句跟讀／錄音</button>${(()=>{
  const r=rpResume();
  return r&&r.d.id===d.id?`<button id="dlgRpRes" class="primary span2">▶ 繼續上次的 Role Play（${esc(rpResumeLabel(r))}）</button>`:''
})()}<button id="dlgRpB" class="rp-btn">🎭 Role Play：我演 B</button><button id="dlgRpA" class="rp-btn">🎭 Role Play：我演 A</button></div>${store.rpDone[d.id]?`<p class="muted rp-last">上次 Role Play：${esc(store.rpDone[d.id].d)}，演 ${esc(store.rpDone[d.id].me)}${store.rpDone[d.id].lv&&RP_LV[store.rpDone[d.id].lv]?'，'+RP_LV[store.rpDone[d.id].lv].replace(/（.*$/,''):''}${store.rpDone[d.id].of?'，通過 '+(+store.rpDone[d.id].pass||0)+'/'+store.rpDone[d.id].of:''}${store.rpDone[d.id].avg!=null?'，平均 '+store.rpDone[d.id].avg+'%':''}</p>`:''}
 <div class="dlg-lines">${d.lines.map((L,n)=>`<div class="dlg-line dlg-${L.s==='A'?'a':'b'}" data-n="${n}"><div class="dlg-bub"><b class="dlg-who">${L.s}</b><span class="dlg-en">${esc(L.en)}</span><span class="dlg-zh"${DLG.zh?'':' hidden'}>${esc(L.zh)}</span></div><span class="dlg-btns"><button data-play="${n}" aria-label="播放">🔊</button><button data-slow="${n}" aria-label="慢速">🐢</button></span></div>`).join('')}</div>
 <h3>重點句型 KEY PHRASES</h3><div class="dlg-keys">${(d.keys||[]).map(k=>`<div class="dlg-key"><span><b>${esc(k.en)}</b><small>${esc(k.zh)}</small></span><button data-say="${esc(k.en)}" aria-label="播放">🔊</button></div>`).join('')}</div>
 <button id="dlgDone" class="wide ${dn?'g3':''}">${dn?'✓ 已練習（'+esc(dn)+'）— 再按一次取消':'✓ 標記這個情境已練習'}</button>
 <div class="grid2 bottom"><button id="dlgPrev">← 上一個情境</button><button id="dlgNext">下一個情境 →</button></div>`;
  window.scrollTo(0,0);
  $('#dlgBack').onclick=()=>{
    DLG.cur=null;
    renderDialogs()
  };
  $('#dlgPlayAll').onclick=dlgPlayAll;
  $('#dlgSlow').onclick=()=>{
    DLG.slow=!DLG.slow;
    $('#dlgSlow').textContent='🐢 慢速：'+(DLG.slow?'開':'關')
  };
  $('#dlgZh').onclick=()=>{
    DLG.zh=!DLG.zh;
    box.querySelectorAll('.dlg-zh').forEach(e=>e.hidden=!DLG.zh);
    $('#dlgZh').textContent='👁 '+(DLG.zh?'隱藏中文':'顯示中文')
  };
  const rr=$('#dlgRpRes');
  if(rr)rr.onclick=()=>rpResumeGo();
  $('#dlgRpB').onclick=()=>rpStart(d,'B');
  $('#dlgRpA').onclick=()=>rpStart(d,'A');
  $('#dlgShadow').onclick=()=>{
    dlgStop();
    const u=$('#unit');
    u.value=d.id;
    store.settings.unit=d.id;
    save();
    page('practice');
    i=0;
    filter();
    if(!pool.some(s=>s.dlg===d.id)){
      $('#hideKnown').checked=false;
      filter()
    }
    render()
  };
  $('#dlgDone').onclick=()=>{
    if(store.dlgDone[d.id])delete store.dlgDone[d.id];else{
      store.dlgDone[d.id]=day();
      markStudy();
      bumpLog('dlg')
    }
    save();
    renderDialog(d)
  };
  const k=DIALOGS.indexOf(d);
  $('#dlgPrev').onclick=()=>{
    dlgStop();
    DLG.cur=DIALOGS[(k-1+DIALOGS.length)%DIALOGS.length];
    renderDialog(DLG.cur)
  };
  $('#dlgNext').onclick=()=>{
    dlgStop();
    DLG.cur=DIALOGS[(k+1)%DIALOGS.length];
    renderDialog(DLG.cur)
  }
}
$('#dialogBody').addEventListener('keydown',e=>{
  const c=e.target.closest('.dlg-card');
  if(c&&(e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    c.click()
  }
});
[['unit','練習範圍'],['wordTopic','主題'],['wordState','單字狀態'],['dailyGoal','每日新字數量'],['phCat','片語分類'],['phState','片語狀態'],['quizType','測驗類型'],['quizMode','出題方式'],['quizBook','測驗範圍'],['quizSRange','句子範圍'],['quizDcRange','對話範圍'],['quizSRange2','題目範圍'],['autoRep','自動播放次數'],['themeSel','外觀'],['fontSel','字體大小'],['voiceSel','英文語音'],['search','搜尋句子'],['wordSearch','搜尋單字'],['phSearch','搜尋片語'],['dictIn','聽寫答案'],['bkPaste','備份內容']].forEach(([id,l])=>{
  const el=document.getElementById(id);
  if(el&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',l)
});
$('#dialogBody').addEventListener('click',e=>{
  if(e.target.closest('[data-rpresume]')){
    if(!rpResumeGo())renderDialogs();
    return
  }
  if(e.target.closest('[data-radio]')){
    renderRadio();
    return
  }
  const rs=e.target.closest('[data-rsay]');
  if(rs){
    dlgStop();
    say(rs.dataset.rsay,.85);
    return
  }
  const c=e.target.closest('.dlg-card');
  if(c){
    DLG.cur=DLG_BY[c.dataset.d];
    renderDialog(DLG.cur);
    return
  }
  const p=e.target.closest('[data-play]'),sl=e.target.closest('[data-slow]'),k=e.target.closest('[data-say]');
  if(p||sl){
    dlgStop();
    DLG.tok++;
    dlgPlayLine(DLG.cur,+(p||sl).dataset[p?'play':'slow'],p?(DLG.slow?.7:.95):.6);
    return
  }
  if(k){
    dlgStop();
    sayV(k.dataset.say,DLG.slow?.7:.9,dlgVoices().B);
    return
  }
  const bub=e.target.closest('.dlg-bub');
  if(bub&&!DLG.zh){
    const z=bub.querySelector('.dlg-zh');
    /* V5.29.0：點英文字查意思時，這一句的中文顯示出來（已顯示就不收起） */
    if(z&&!(e.target.closest('.dlg-en')&&!z.hidden&&lkWordAt(e)))z.hidden=!z.hidden
  }
});
function updEveryLabel(){
  const ev=$('#unit option[value="every"]');
  if(ev)ev.textContent=`全部句子（${ALLS.length}）`;
  /* V5.21.0：CE 專業字與職場英文的數量依字庫自動顯示 */
  const n7=WORDS.filter(x=>x.k===7).length,n8=WORDS.filter(x=>x.k===8).length;
  const s7=ALLS.filter(s=>s.src==='word'&&s.book===7).length,s8=ALLS.filter(s=>s.src==='word'&&s.book===8).length;
  const set=(sel,t)=>{
    const o=$(sel);
    if(o)o.textContent=t
  };
  set('#wordBook option[value="7"]',`CE 專業字與縮寫（${n7}）`);
  /* V5.26.0：職場英文＝多益字＋商用英文 */
  set('#wordBook option[value="8"]',`職場英文（多益＋商用，${n8}）`);
  set('#quizBook option[value="8"]',`職場英文（多益＋商用，${n8}）`);
  /* V5.26.0：片語數量依字庫顯示 */
  const nP=PHRASES.length,pc=c=>PHRASES.filter(p=>p.cat===c).length;
  const pg=$('#phUnits');
  if(pg)pg.label=`片語例句（${nP}）`;
  set('#phTotal',`共 ${nP} 個`);
  set('#unit option[value="pall"]',`片語例句・全部（${nP}）`);
  [['daily','日常'],['work','工作'],['ce','CE 現場'],['mail','Email／會議']].forEach(([c,t])=>set(`#unit option[value="p${c}"]`,`片語例句・${t}（${pc(c)}）`));
  set('#unit option[value="w7"]',`CE 專業字例句（${s7||n7}）`);
  set('#unit option[value="w8"]',`職場英文例句（${s8||n8}）`);
  /* V5.23.0：TOEIC 多益章節 */
  const nT=WORDS.filter(x=>x.toeic).length,sT=ALLS.filter(s=>s.src==='word'&&s.toeic).length;
  set('#wordBook option[value="toeic"]',`TOEIC 多益（${nT}）`);
  set('#quizBook option[value="toeic"]',`TOEIC 多益（${nT}）`);
  set('#unit option[value="wt"]',`TOEIC 多益例句（${sT||nT}）`);
  /* V5.29.0 */
  const s2=ALLS.filter(s=>s.src==='word2').length,nR=ALLS.filter(s=>s.src==='radio').length;
  set('#unit option[value="wt2"]',s2?`📖 多益長例句（${s2}）`:(EX_FAIL||EX2_FAIL)?'📖 多益長例句（下載失敗）':'📖 多益長例句（載入中）');
  set('#unit option[value="radio"]',`📻 無線電用語（${nR}）`)
}
$('#navDialogs').onclick=()=>{
  page('dialogs');
  renderDialogs()
};
/* ===== V5.16.18 Priority 6：Role Play（用句子頁的 🎤 辨識與 🎙 錄音） =====
   V5.16.19：🎤／🎙 按鈕移進 Role Play 區塊（不用往下捲）；連續模式：對方說完自動開始聆聽、念到 80% 以上自動下一句 */
store.rpDone=store.rpDone&&typeof store.rpDone==='object'&&!Array.isArray(store.rpDone)?store.rpDone:{};
const RP={on:false,d:null,me:'B',n:-1,sc:{},peek:false,tok:0,fin:false,docked:false,autoT:null};
function rpMine(){
  return RP.d?RP.d.lines.map((L,n)=>L.s===RP.me?n:-1).filter(n=>n>=0):[]
}
function rpSave(){
  try{
    if(RP.on)sessionStorage.setItem('e5k_rp',JSON.stringify({id:RP.d.id,me:RP.me,n:RP.n,sc:RP.sc,ok:RP.ok||{},help:RP.help||{}}));else sessionStorage.removeItem('e5k_rp')
  }catch(e){}
  /* V5.28.0：進行中的 Role Play 另存一份（7 天內有效），切到其他頁或關掉 App 後可以「繼續」 */
  try{
    if(RP.on&&!RP.fin&&RP.d)localStorage.setItem(RP_RES,JSON.stringify({id:RP.d.id,me:RP.me,n:RP.n,sc:RP.sc,ok:RP.ok||{},help:RP.help||{},t:Date.now()}));else if(RP.on&&RP.fin)localStorage.removeItem(RP_RES)
  }catch(e){}
}
const RP_RES='e5k_rp_resume';
function rpResume(){
  try{
    const r=JSON.parse(localStorage.getItem(RP_RES)||'null');
    if(!r||!DLG_BY[r.id]||!(Date.now()-r.t<7*864e5))return null;
    const d=DLG_BY[r.id],me=r.me==='A'?'A':'B',mine=d.lines.map((L,n)=>L.s===me?n:-1).filter(n=>n>=0),k=mine.indexOf(+r.n);
    if(k<0)return null;
    return {d,me,n:+r.n,k:k+1,of:mine.length,sc:r.sc&&typeof r.sc==='object'?r.sc:{},ok:r.ok&&typeof r.ok==='object'?r.ok:{},help:r.help&&typeof r.help==='object'?r.help:{}}
  }catch(e){
    return null
  }
}
function rpResumeClear(){
  try{
    localStorage.removeItem(RP_RES)
  }catch(e){}
}
function rpResumeGo(){
  const r=rpResume();
  if(!r)return false;
  rpStart(r.d,r.me,r.n,r.sc,true,{ok:r.ok,help:r.help});
  $('#result').textContent='👉 繼續上次的 Role Play：按「🎤 開始念」說出你的台詞（可以按「🔁 再聽對方」）';
  return true
}
function rpResumeLabel(r){
  return '演 '+r.me+'，第 '+r.k+'／'+r.of+' 句'
}
function rpVoice(s){
  const V=dlgVoices();
  return s==='A'?V.A:V.B
}
function rpAutoOn(){
  return !!(store.settings&&store.settings.rpAuto)
}
function rpNodes(){
  const r=$('#record');
  return [$('#check'),$('#result'),r&&r.parentElement,$('#recMsg')].filter(Boolean)
}
function rpDock(on){
  const sp=$('#rpSpeak');
  if(!sp)return;
  if(on&&!RP.docked){
    const ns=rpNodes();
    let ph=$('#rpPH');
    if(!ph){
      ph=document.createElement('span');
      ph.id='rpPH';
      ph.hidden=true;
      ns[0].before(ph)
    }
    ns.forEach(n=>sp.appendChild(n));
    RP.docked=true
  }
 else if(!on&&RP.docked){
    const ph=$('#rpPH');
    if(ph)ph.after(...rpNodes());
    RP.docked=false
  }
}
function rpShowPractice(show){
  $('.sentence').hidden=!show;
  $('.panel').hidden=!show;
  $('.tip').hidden=!show;
  const hk=$('#hideKnown');
  if(hk)hk.disabled=!show
}
/* V5.16.20：Role Play 進行中回到句子頁時維持 Role Play 畫面；已完成的 Role Play 直接結束 */
window.rpAfterPage=()=>{
  if(!RP.on)return;
  if(RP.fin)rpOff();else rpShowPractice(false)
};
function rpStart(d,me,n,sc,resume,st){
  if(!d)return;
  dlgStop();
  RP.on=true;
  RP.fin=false;
  RP.d=d;
  RP.me=me==='A'?'A':'B';
  RP.sc=sc||{};
  RP.ok=st&&st.ok||{};
  RP.help=st&&st.help||{};
  const hk=$('#hideKnown');
  if(hk)hk.checked=false;
  $('#unit').value=d.id;
  page('practice');
  filter();
  const mine=rpMine();
  rpGo(n!=null&&mine.includes(n)?n:mine[0],!resume)
}
function rpGo(n,speak){
  clearTimeout(RP.autoT);
  RP.n=n;
  RP.peek=rpInitPeek();
  RP.fin=false;
  RP.tok++;
  const k=pool.findIndex(s=>s.id==='d:'+RP.d.id+':'+n);
  if(k>=0)i=k;
  rpSave();
  render();
  rpScroll();
  if(speak)rpPartner()
}
/* V5.27.2：每一句都讓「輪到你」和 🎤 出現在畫面上（原本每句都捲回最上面，小手機或大字體要一直往下捲） */
function rpScroll(){
  window.scrollTo(0,0);
  const t=document.querySelector('#rpBox .rp-turn'),c=$('#check'),nv=document.querySelector('nav');
  if(!t||!c)return;
  const top=bottomLimit();
  const over=c.getBoundingClientRect().bottom-(top-12);
  if(over>0)window.scrollTo(0,Math.min(over,Math.max(0,t.getBoundingClientRect().top-8)))
}
function rpPartnerLines(n){
  const mine=rpMine();
  const k=mine.indexOf(n);
  const from=k>0?mine[k-1]+1:0;
  const out=[];
  for(let j=from;j<n;j++)out.push(j);
  return out
}
function rpMark(j){
  document.querySelectorAll('#rpBox .rp-line').forEach(e=>e.classList.toggle('dlg-now',+e.dataset.n===j))
}
function rpPlay(list,done){
  clearTimeout(RP.autoT);
  const t=++RP.tok;
  let q=0;
  if(VOICE.srBusy)srAbort();
  recStopPlayback();
  const nx=()=>{
    if(t!==RP.tok||!RP.on)return;
    if(q>=list.length){
      rpMark(-1);
      done&&done();
      return
    }
    const j=list[q++],L=RP.d.lines[j];
    rpMark(j);
    sayV(L.en,DLG.slow?.75:.95,rpVoice(L.s),()=>setTimeout(nx,250))
  };
  nx()
}
function rpListenAuto(){
  const n=RP.n,t=RP.tok;
  clearTimeout(RP.autoT);
  RP.autoT=setTimeout(()=>{
    if(!RP.on||RP.fin||RP.n!==n||RP.tok!==t||VOICE.srBusy||REC.state!=='idle')return;
    const s=VOICE.sess;
    if(s&&!s.__dead&&SR){
      $('#check').click()
    }else{
      const r=$('#result');
      if(r)r.textContent='👉 輪到你了：按「🎤 開始念」（連續模式要先按一次 🎤，之後就會自動聆聽）'
    }
  },1000)
}
function rpPartner(){
  rpPlay(rpPartnerLines(RP.n),()=>{
    const r=$('#result');
    if(!RP.on||RP.fin)return;
    if(r)r.textContent='👉 輪到你了：看中文提示，按「🎤 開始念」說出你的台詞';
    if(rpAutoOn())rpListenAuto()
  })
}
function rpOff(){
  if(!RP.on)return;
  clearTimeout(RP.autoT);
  rpDock(false);
  RP.on=false;
  RP.fin=false;
  RP.tok++;
  try{
    speechSynthesis.cancel()
  }catch(e){}
  rpSave();
  const b=$('#rpBox');
  if(b){
    b.hidden=true;
    ['#rpTop','#rpBottom'].forEach(s=>{
      const e=$(s);
      if(e)e.innerHTML=''
    })
  }
  rpShowPractice(true);
  const se=$('.sentence');
  if(se)se.classList.remove('rp-hide');
  document.body.classList.remove('rp-mode');
  const hk=$('#hideKnown');
  if(hk&&hk.checked!==!!store.settings.hideKnown){
    hk.checked=!!store.settings.hideKnown;
    refilter()
  }
}
function rpAvg(){
  const v=rpMine().map(n=>RP.sc[n]).filter(x=>typeof x==='number');
  return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null
}
function rpProg(){
  const mine=rpMine(),k=mine.indexOf(RP.n);
  return `你的台詞 ${k+1} / ${mine.length}${RP.sc[RP.n]!=null?'｜這句最高 '+RP.sc[RP.n]+'%':''}${RP.ok&&RP.ok[RP.n]?' ✅':''}`
}
/* V5.18.0：Role Play 難度 — 跟讀（看英文）／提示（首字母）／挑戰（只看中文）／自由回答（說到重點句型就過） */
const RP_LV={read:'跟讀（看英文）',hint:'提示（首字母）',hard:'挑戰（只看中文）',free:'自由回答（說到重點句型）'};
function rpLevel(){
  const v=store.settings&&store.settings.rpLevel;
  return RP_LV[v]?v:'hint'
}
function rpInitPeek(){
  const lv=rpLevel();
  return lv==='read'?2:lv==='hint'?1:0
}
function rpHintText(en){
  return String(en).split(/(\s+)/).map(w=>{
    if(/^\s*$/.test(w)||/\d/.test(w)||/[A-Z][^A-Z]*[A-Z]/.test(w))return w;
    let seen=false;
    return w.replace(/[A-Za-z]/g,c=>{
      if(!seen){
        seen=true;
        return c
      }
      return '_'
    })
  }).join('')
}
function rpNormTxt(x){
  return String(x).toLowerCase().replace(/[\u2019']/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim()
}
function rpKey(d,n){
  const L=' '+rpNormTxt(d.lines[n].en)+' ';
  let best=null;
  (d.keys||[]).forEach(k=>{
    const kn=rpNormTxt(k.en);
    if(kn&&L.includes(' '+kn+' ')&&(!best||kn.length>rpNormTxt(best.en).length))best=k
  });
  return best
}
function rpEnHtml(en){
  return RP.peek>=2?esc(en):RP.peek===1?esc(rpHintText(en)):esc(en)
}
function rpPeekSet(v){
  v=v===true?2:v===false?0:Math.max(0,Math.min(2,+v||0));
  RP.peek=v;
  const e=$('#rpEn');
  if(e){
    const s=cur();
    e.innerHTML=rpEnHtml(s.en);
    e.classList.toggle('rp-blur',v===0);
    e.classList.toggle('rp-hint',v===1)
  }
  const se=$('.sentence');
  if(se)se.classList.toggle('rp-hide',v<2);
  const p=$('#rpPeek');
  if(p)p.textContent=v<2?'💡 提示':'🙈 隱藏英文'
}
function rpRender(s){
  const box=$('#rpBox');
  if(!box)return;
  if(!RP.on){
    box.hidden=true;
    return
  }
  if(RP.fin){
    rpOff();
    render();
    return
  }
  const m=/^d:(d\d\d):(\d+)$/.exec(s.id||'');
  if(!m||m[1]!==RP.d.id||RP.d.lines[+m[2]].s!==RP.me){
    rpOff();
    render();
    return
  }
  RP.n=+m[2];
  const d=RP.d,mine=rpMine(),k=mine.indexOf(RP.n),other=RP.me==='A'?'B':'A',key=rpKey(d,RP.n);
  document.body.classList.add('rp-mode');
  const hist=[];
  for(let j=Math.max(0,RP.n-2);j<RP.n;j++)hist.push(j);
  box.hidden=false;
  rpShowPractice(false);
  rpDock(true);
  $('#rpTop').innerHTML=`<div class="rp-head"><span><b>🎭 Role Play：${esc(d.t)}</b><small>你演 ${RP.me}：${esc(d.roles[RP.me])}｜對方 ${other}：${esc(d.roles[other])}</small></span><button id="rpEnd" class="mini">✕ 結束</button></div>
 <div class="rp-progrow"><span class="rp-prog">${rpProg()}</span>${k>0?'<button id="rpPrev" class="mini">← 上一句</button>':''}</div>
 <div class="rp-hist">${RP.n>2?'<small class="muted">…（點對話框看中文）</small>':''}${hist.map(j=>{
    const L=d.lines[j];
    return `<div class="dlg-line rp-line dlg-${L.s==='A'?'a':'b'}" data-n="${j}"><div class="dlg-bub"><b class="dlg-who">${L.s}${L.s===RP.me?'（你）':''}</b><span class="dlg-en">${esc(L.en)}</span><span class="dlg-zh" hidden>${esc(L.zh)}</span></div><span class="dlg-btns"><button data-rpsay="${j}" aria-label="播放">🔊</button></span></div>`
  }).join('')}</div>
 <div class="rp-turn">🗣 輪到你（${RP.me}）說：<b>${esc(s.zh)}</b>${rpLevel()==='free'?(key?`<div class="rp-key">必說重點句型：<b>${esc(key.en)}</b><small>（${esc(key.zh)}）</small><br><small>其他部分用自己的話說就好</small></div>`:'<div class="rp-key"><small>這句沒有重點句型：意思說對、相似度 60% 以上就通過</small></div>'):''}<div id="rpEn" class="rp-en${RP.peek===0?' rp-blur':''}${RP.peek===1?' rp-hint':''}">${rpEnHtml(s.en)}</div></div>`;
  $('#rpBottom').innerHTML=`<div class="grid2 rp-tools"><button id="rpHear">🔁 再聽對方</button><button id="rpAns">🔊 標準答案</button><button id="rpPeek">${RP.peek<2?'💡 提示':'🙈 隱藏英文'}</button><button id="rpNext" class="primary">${k+1<mine.length?'下一句 →':'完成 ✓'}</button></div>
 <label class="rp-lv">難度 <select id="rpLevel">${Object.keys(RP_LV).map(v=>`<option value="${v}"${v===rpLevel()?' selected':''}>${RP_LV[v]}</option>`).join('')}</select></label>
 <label class="hk rp-auto"><input type="checkbox" id="rpAuto"${rpAutoOn()?' checked':''}> 連續模式：對方說完自動開始聆聽，通過後自動下一句</label>`;
  const se=$('.sentence');
  if(se)se.classList.toggle('rp-hide',RP.peek<2);
  $('#chinese').hidden=false;
  $('#result').textContent=rpPartnerLines(RP.n).length?'🔊 先聽對方說，再按「🎤 開始念」說出你的台詞':'👉 你先開口：按「🎤 開始念」說出你的台詞';
  $('#rpEnd').onclick=()=>{
    const dd=RP.d;
    /* 主動按「結束」：不保留接續 */
    rpOff();
    rpResumeClear();
    page('dialogs');
    DLG.cur=dd;
    renderDialog(dd)
  };
  const pv=$('#rpPrev');
  if(pv)pv.onclick=()=>rpNav(-1);
  $('#rpHear').onclick=()=>{
    const ls=rpPartnerLines(RP.n);
    if(!ls.length&&!RP.n){
      $('#result').textContent='👉 這句是你先開口，前面沒有對方的台詞';
      return
    }
    rpPlay(ls.length?ls:[RP.n-1],()=>{
      if(rpAutoOn())rpListenAuto()
    })
  };
  $('#rpAns').onclick=()=>{
    clearTimeout(RP.autoT);
    RP.tok++;
    if(VOICE.srBusy)srAbort();
    recStopPlayback();
    sayV(s.en,DLG.slow?.75:.9,rpVoice(RP.me))
  };
  $('#rpPeek').onclick=()=>{
    if(RP.peek<2){
      RP.help=RP.help||{};
      RP.help[RP.n]=true;
      rpPeekSet(RP.peek+1)
    }else rpPeekSet(rpInitPeek())
  };
  $('#rpLevel').onchange=e=>{
    store.settings.rpLevel=e.target.value;
    save();
    RP.peek=rpInitPeek();
    rpRender(cur())
  };
  $('#rpNext').onclick=()=>rpNav(1);
  $('#rpAuto').onchange=e=>{
    store.settings.rpAuto=e.target.checked;
    save();
    if(!e.target.checked)clearTimeout(RP.autoT)
  };
  box.querySelectorAll('[data-rpsay]').forEach(b=>b.onclick=()=>rpPlay([+b.dataset.rpsay]));
  box.querySelectorAll('.rp-line .dlg-bub').forEach(b=>b.onclick=e=>{
    const z=b.querySelector('.dlg-zh');
    /* V5.31.1：點英文字查意思時，中文只會顯示、不會被收起 */
    if(z&&!(e&&e.target.closest('.dlg-en')&&!z.hidden&&lkWordAt(e)))z.hidden=!z.hidden
  })
}
function rpNav(dir){
  if(!RP.on)return false;
  if(RP.fin){
    rpOff();
    return false
  }
  const mine=rpMine(),k=mine.indexOf(RP.n);
  if(dir>0){
    if(k+1<mine.length)rpGo(mine[k+1],true);else rpFinish()
  }else{
    if(k>0)rpGo(mine[k-1],false)
  }
  return true
}
function rpPassOf(score,heard){
  if(rpLevel()==='free'){
    const k=rpKey(RP.d,RP.n);
    if(k){
      const H=scHeard(heard||'');
      const ok=scTok(k.en).every(t=>H.has(t));
      return [ok,ok?'✅ 有說到重點句型「'+k.en+'」，通過！':'✗ 還沒說到重點句型「'+k.en+'」，再試一次']
    }
    return [score>=60,score>=60?'✅ 意思有說到（相似度 60% 以上），通過！':'✗ 相似度不到 60%，再試一次']
  }
  return [score>=80,score>=80?'✅ 通過（80% 以上）':'再試一次：相似度 80% 以上算通過']
}
function rpScore(score,heard){
  if(!RP.on||RP.fin)return;
  RP.sc[RP.n]=Math.max(RP.sc[RP.n]||0,score);
  const [pass,msg]=rpPassOf(score,heard);
  RP.ok=RP.ok||{};
  if(pass)RP.ok[RP.n]=true;
  rpPeekSet(2);
  const g=$('#rpBox .rp-prog');
  if(g)g.textContent=rpProg();
  rpSave();
  const r=$('#result');
  const auto=rpAutoOn()&&pass;
  if(r)r.insertAdjacentHTML('beforeend','<br><b class="rp-pass'+(pass?' ok':'')+'">'+esc(msg)+'</b>'+(auto?'<br><small>👍 連續模式：1.5 秒後自動下一句…</small>':'<br><small>可以按「🎙 重新錄音」或「🎤」再試一次；滿意就按「下一句 →」。</small>'));
  if(auto){
    const n=RP.n,t=RP.tok;
    clearTimeout(RP.autoT);
    RP.autoT=setTimeout(()=>{
      if(RP.on&&!RP.fin&&RP.n===n&&RP.tok===t&&!VOICE.srBusy&&REC.state==='idle')rpNav(1)
    },1500)
  }
}
function rpFinish(){
  clearTimeout(RP.autoT);
  const d=RP.d,mine=rpMine(),last=mine[mine.length-1],rest=[];
  for(let j=last+1;j<d.lines.length;j++)rest.push(j);
  RP.fin=true;
  rpSave();
  const avg=rpAvg(),said=mine.filter(n=>RP.sc[n]!=null).length,passN=mine.filter(n=>RP.ok&&RP.ok[n]).length,lv=rpLevel();
  store.rpDone[d.id]={d:day(),me:RP.me,avg:avg,lv:lv,pass:passN,of:mine.length};
  /* V5.32.0：依這次的平均相似度安排下次複習（沒有用 🎤 檢查就不改排程） */
  const rsq=rpSchedSet(d.id,avg,RP.me);
  markStudy();
  bumpLog('rp');
  save();
  rpDock(false);
  rpShowPractice(false);
  const box=$('#rpBox');
  box.hidden=false;
  $('#rpBottom').innerHTML='';
  $('#rpTop').innerHTML=`<div class="rp-head"><span><b>🎉 完成 Role Play：${esc(d.t)}</b><small>你演 ${RP.me}：${esc(d.roles[RP.me])}</small></span></div>
 <p class="rp-sum">難度：${RP_LV[lv]}｜你的台詞 ${mine.length} 句，通過 <b>${passN}</b> 句，用 🎤 檢查了 ${said} 句${avg!=null?'，平均相似度 <b>'+avg+'%</b>':''}。</p>${rpSchedHtml(rsq,d.id)}
 <div class="rp-scores">${mine.map(n=>`<div class="rp-sc"><span>${esc(d.lines[n].en)}${RP.help&&RP.help[n]?' <small class="muted">💡 用了提示</small>':''}</span><b>${RP.ok&&RP.ok[n]?'✅ ':''}${RP.sc[n]!=null?RP.sc[n]+'%':'—'}</b></div>`).join('')}</div>
 ${passN<mine.length?'<p class="muted">建議：沒通過的句子可以再演一次，或把難度調低一級。</p>':'<p class="muted">全部通過！可以試試更高的難度。</p>'}
 <div class="grid2 rp-tools"><button id="rpAgain" class="primary">🔁 再演一次</button><button id="rpSwap">🔄 換演 ${RP.me==='A'?'B':'A'}</button><button id="rpBackD" class="span2">← 回到對話</button></div>`;
  window.scrollTo(0,0);
  $('#rpAgain').onclick=()=>rpStart(d,RP.me);
  $('#rpSwap').onclick=()=>rpStart(d,RP.me==='A'?'B':'A');
  $('#rpBackD').onclick=()=>{
    rpOff();
    page('dialogs');
    DLG.cur=d;
    renderDialog(d)
  };
  if(rest.length)rpPlay(rest)
}
window.rpRender=rpRender;
window.rpNav=rpNav;
window.rpScore=rpScore;
window.rpOff=rpOff;
try{
  const rp=JSON.parse(sessionStorage.getItem('e5k_rp')||'null');
  const srNote=sessionStorage.getItem('e5k_sr')==='1';
  if(rp&&sessionStorage.getItem('e5k_go')==='practice'&&DLG_BY[rp.id])setTimeout(()=>{
    const note=srNote||/麥克風已重新啟動/.test($('#result').textContent);
    rpStart(DLG_BY[rp.id],rp.me,rp.n,rp.sc,true,{ok:rp.ok,help:rp.help});
    $('#result').textContent=note?'✅ 麥克風已重新啟動，請再按一次「🎤 開始念」。':'👉 繼續 Role Play：按「🎤 開始念」說出你的台詞'
  },0);else sessionStorage.removeItem('e5k_rp')
}catch(e){}

/* ===== V5.16.18 Priority 6：新測驗（聽力、對話填空、CE 情境題） ===== */
const SITQ=window.SITQ||[];
(function(){
  const o=document.querySelector('#quizType option[value="situ"]');
  if(o)o.textContent='🏭 CE 情境題（'+SITQ.length+' 題）'
})();
function qShuffle(a){
  a=a.slice();
  for(let k=a.length-1;k>0;k--){
    const j=Math.floor(Math.random()*(k+1));
    [a[k],a[j]]=[a[j],a[k]]
  }
  return a
}
function qRange(){
  const r=($('#quizSRange')||{}).value||'cd';
  const cd=ALLS.filter(s=>s.src==='core'||s.src==='dialog');
  if(r==='wrong'){
    const w=store.lsWrong||{};
    return {q:ALLS.filter(s=>w[s.id]),base:cd}
  }
  const q=r==='dlg'?ALLS.filter(s=>s.src==='dialog'):r==='all'?ALLS:cd;
  return {q,base:q}
}
function qEmpty(t){
  $('#quizQ').innerHTML=t;
  $('#quizOpts').innerHTML='';
  $('#quizMsg').textContent='';
  $('#quizOpts').onclick=null
}
/* V5.16.19：聽力題、對話填空答錯 → 加入「📕 測驗答錯的句子」；標過「會說」的句子排入今天的 🔁 待複習 */
function qWrongMark(id,ok){
  store.lsWrong=store.lsWrong&&typeof store.lsWrong==='object'?store.lsWrong:{};
  if(ok){
    if(store.lsWrong[id]){
      delete store.lsWrong[id];
      save();
      return '<br><small>已從「📕 測驗答錯的句子」移除</small>'
    }
    return ''
  }
  store.lsWrong[id]=(store.lsWrong[id]||0)+1;
  let note='已加入「📕 測驗答錯的句子」（句子頁、測驗都可以只練答錯的）';
  if(cset('known').has(id)){
    store.sDue=store.sDue||{};
    store.sStage=store.sStage||{};
    store.sDue[id]=day();
    store.sStage[id]=1;
    note='這句你標過「會說」，已排入今天的 🔁 待複習句子，也加入「📕 測驗答錯的句子」'
  }
  save();
  return '<br><small>'+note+'</small>'
}
function qNear(x,pool,key,n){
  const L=x[key].length;
  const c=pool.filter(y=>y.id!==x.id&&y[key]&&y[key]!==x[key]&&y.en!==x.en&&!(x.zh&&y.zh===x.zh));
  let near=c.filter(y=>Math.abs(y[key].length-L)<=Math.max(4,L*.35));
  if(near.length<n*3)near=c;
  const out=[];
  const seen=new Set([x[key]]);
  for(const y of qShuffle(near.length>400?near.slice(0,400).concat(qShuffle(near).slice(0,200)):near)){
    if(seen.has(y[key]))continue;
    seen.add(y[key]);
    out.push(y);
    if(out.length>=n)break
  }
  return out
}
function qCount(ok){
  store[ok?'quizRight':'quizWrong']=(store[ok?'quizRight':'quizWrong']||0)+1;
  if(qCur)qStat(qCur,ok);
  bumpLog('quiz');
  markStudy();
  save()
}
function qPick(opts,isOk,after){
  let done=false;
  $('#quizOpts').onclick=e=>{
    const b=e.target.closest('button[data-k]');
    if(!b||done)return;
    done=true;
    const ok=isOk(+b.dataset.k);
    b.classList.add(ok?'opt-ok':'opt-bad');
    if(!ok){
      const c=[...$('#quizOpts').querySelectorAll('button[data-k]')].find(x=>isOk(+x.dataset.k));
      if(c)c.classList.add('opt-ok')
    }
    qCount(ok);
    after(ok,+b.dataset.k)
  }
}
function lisEnQuiz(fx){
  if(fx&&!fx.en)fx=null;
  qCur='lisen';
  const R=qRange();
  if(!fx&&!R.q.length){
    qEmpty('🎉 沒有答錯的句子');
    return
  }
  const x=fx||R.q[Math.floor(Math.random()*R.q.length)];
  const opts=qShuffle([x,...qNear(x,fx?ALLS.filter(s=>s.src==='core'||s.src==='dialog'):R.base,'zh',3)]);
  const rate=()=>.9;
  $('#quizQ').innerHTML=`🎧 聽英文句子，選出正確的中文意思<br><button id="quizReplay">🔊 再聽</button> <button id="quizSlow">🐢 慢速</button>`;
  $('#quizMsg').textContent='';
  $('#quizOpts').innerHTML=opts.map((o,k)=>`<button data-k="${k}">${esc(o.zh)}</button>`).join('');
  say(x.en,rate());
  $('#quizReplay').onclick=()=>say(x.en,.9);
  $('#quizSlow').onclick=()=>say(x.en,.65);
  qPick(opts,k=>opts[k].id===x.id,ok=>{
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案如上（綠色）'}<br><b>${esc(x.en)}</b><br><small>${esc(x.zh)}${x.src==='dialog'?'｜'+esc(SRC_LABEL.dialog)+'：'+esc((DLG_BY[x.dlg]||{}).t||''):''}</small>`+qWrongMark(x.id,ok)
  })
}
function lisZhQuiz(){
  qCur='liszh';
  const R=qRange();
  if(!R.q.length){
    qEmpty('🎉 沒有答錯的句子');
    return
  }
  const x=R.q[Math.floor(Math.random()*R.q.length)];
  const opts=qShuffle([x,...qNear(x,R.base,'en',3)]);
  let sel=-1;
  $('#quizQ').innerHTML=`🎧 看中文，聽 4 個英文選項，選出意思相同的那一句<br><b class="lz-zh">${esc(x.zh)}</b>`;
  $('#quizMsg').textContent='先點 🔊 聽每個選項，再選答案。';
  $('#quizOpts').innerHTML=opts.map((o,k)=>`<div class="lz-row"><button class="lz-play" data-p="${k}">🔊 選項 ${k+1}</button><button class="lz-pick" data-k="${k}">選這個</button><span class="lz-en" hidden>${esc(o.en)}</span></div>`).join('');
  let done=false;
  $('#quizOpts').onclick=e=>{
    const p=e.target.closest('[data-p]');
    if(p){
      const k=+p.dataset.p;
      sel=k;
      $('#quizOpts').querySelectorAll('.lz-play').forEach(b=>b.classList.toggle('lz-on',+b.dataset.p===k));
      say(opts[k].en,.9);
      return
    }
    const b=e.target.closest('button[data-k]');
    if(!b||done)return;
    done=true;
    const k=+b.dataset.k,ok=opts[k].id===x.id;
    b.classList.add(ok?'opt-ok':'opt-bad');
    $('#quizOpts').querySelectorAll('.lz-en').forEach(s=>s.hidden=false);
    if(!ok){
      const c=$('#quizOpts').querySelector(`button[data-k="${opts.indexOf(x)}"]`);
      if(c)c.classList.add('opt-ok')
    }
    qCount(ok);
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案是選項 '+(opts.indexOf(x)+1)}<br><b>${esc(x.en)}</b><br><small>${esc(x.zh)}</small>`+qWrongMark(x.id,ok);
    say(x.en,.9)
  }
}
const DC_STOP=new Set('the a an and or but to of in on at for with from by is are was were be been am it its it\'s this that these those i you we they he she me us them my your our their can could will would should do does did have has had not no yes ok okay please there here what which who when where how just so if then than also all any some one two let\'s let i\'m you\'re we\'re that\'s don\'t can\'t won\'t i\'ll we\'ll you\'ll go get got up out now right sure thanks thank hi hello'.split(' '));
function dcWords(t){
  return (t.match(/[A-Za-z][A-Za-z0-9'-]*/g)||[]).filter(w=>w.length>=3&&!DC_STOP.has(w.toLowerCase()))
}
let _dcPool=null;
function dcPool(){
  if(_dcPool)return _dcPool;
  const ws=new Map();
  DIALOGS.forEach(d=>d.lines.forEach(L=>dcWords(L.en).forEach(w=>{
    const k=w.toLowerCase();
    if(!ws.has(k))ws.set(k,w)
  })));
  _dcPool=[...ws.values()];
  return _dcPool
}
function dcQuiz(){
  qCur='dcloze';
  if(!DIALOGS.length){
    $('#quizQ').textContent='沒有對話資料';
    $('#quizOpts').innerHTML='';
    return
  }
  let d,n,cand;
  const wOnly=($('#quizDcRange')||{}).value==='wrong';
  const wl=Object.keys(store.lsWrong||{}).map(id=>/^d:(d\d\d):(\d+)$/.exec(id)).filter(m=>m&&DLG_BY[m[1]]&&DLG_BY[m[1]].lines[+m[2]]&&dcWords(DLG_BY[m[1]].lines[+m[2]].en).length);
  if(wOnly&&!wl.length){
    qEmpty('🎉 沒有答錯的對話句');
    return
  }
  for(let t=0;t<30;t++){
    if(wOnly){
      const m=wl[Math.floor(Math.random()*wl.length)];
      d=DLG_BY[m[1]];
      n=+m[2]
    }else{
      d=DIALOGS[Math.floor(Math.random()*DIALOGS.length)];
      n=1+Math.floor(Math.random()*(d.lines.length-1))
    }
    cand=dcWords(d.lines[n].en);
    if(cand.length)break
  }
  const keyTxt=(d.keys||[]).map(k=>k.en.toLowerCase()).join(' ');
  const pref=cand.filter(w=>/^[A-Z0-9-]{2,}$/.test(w)||keyTxt.includes(w.toLowerCase()));
  const ans=(pref.length?pref:cand.sort((a,b)=>b.length-a.length).slice(0,3))[Math.floor(Math.random()*Math.min(3,(pref.length||Math.min(3,cand.length))))]||cand[0];
  const isAc=/^[A-Z0-9-]{2,}$/.test(ans);
  const lineLow=d.lines[n].en.toLowerCase();
  let pool=dcPool().filter(w=>w.toLowerCase()!==ans.toLowerCase()&&!new RegExp('\\b'+w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(lineLow)&&(/^[A-Z0-9-]{2,}$/.test(w)===isAc));
  let near=pool.filter(w=>Math.abs(w.length-ans.length)<=2);
  if(near.length<3)near=pool;
  const opts=qShuffle([ans,...qShuffle(near).slice(0,3)]);
  const L=d.lines[n],P=d.lines[n-1]||null;
  const re=new RegExp('\\b'+ans.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b');
  const reAll=new RegExp(re.source,'g');
  const blank=esc(L.en.replace(reAll,'\u0000')).split('\u0000').join('<span class="blank">_____</span>');
  $('#quizQ').innerHTML=`<small class="muted">💬 對話填空｜${esc(d.t)}</small><div class="dc-ctx">${P?`<div class="dc-l"><b>${P.s}</b> ${esc(P.en)}</div>`:'<div class="dc-l muted">（對話第一句）</div>'}<div class="dc-l dc-q"><b>${L.s}</b> ${blank}</div><small>${esc(L.zh)}</small></div>${P?'<button id="quizReplay">🔊 聽上一句</button>':''}`;
  $('#quizMsg').textContent='';
  const show=o=>/^[A-Z][a-z']+$/.test(o)?o.toLowerCase():o;
  $('#quizOpts').innerHTML=opts.map((o,k)=>`<button data-k="${k}">${esc(show(o))}</button>`).join('');
  const rb=$('#quizReplay');
  if(rb)rb.onclick=()=>say(P.en,.9);
  qPick(opts,k=>opts[k]===ans,ok=>{
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案：'+esc(ans)}<br><b>${esc(L.en)}</b><br><small>${esc(L.zh)}</small>`+qWrongMark('d:'+d.id+':'+n,ok);
    say(L.en,.9)
  })
}
function situQuiz(fq){
  if(fq&&!fq.opts)fq=null;
  qCur='situ';
  if(!SITQ.length){
    $('#quizQ').textContent='沒有情境題資料';
    $('#quizOpts').innerHTML='';
    return
  }
  const sw=store.sqWrong||{};
  const wrongIds=SITQ.filter(q=>sw[q.id]);
  const useWrong=($('#quizSRange2')||{}).value==='wrong';
  if(!fq&&useWrong&&!wrongIds.length){
    $('#quizQ').innerHTML='🎉 沒有答錯的情境題';
    $('#quizOpts').innerHTML='';
    $('#quizMsg').textContent='';
    return
  }
  const src=useWrong?wrongIds:SITQ;
  let q=fq||src[Math.floor(Math.random()*src.length)];
  if(!fq&&src.length>1&&q.id===store.sqLast)q=src[(src.indexOf(q)+1)%src.length];
  store.sqLast=q.id;
  const ord=qShuffle([0,1,2,3]);
  $('#quizQ').innerHTML=`<small class="muted">🏭 CE 情境題｜${esc(q.topic||'')}</small><div class="sq-sit">${esc(q.sit)}</div>`;
  $('#quizMsg').textContent='';
  $('#quizOpts').innerHTML=ord.map((o,k)=>`<button data-k="${k}" class="sq-opt">${esc(q.opts[o])}</button>`).join('');
  qPick(ord,k=>ord[k]===q.ans,(ok,k)=>{
    bumpLog('situ');
    store.sqWrong=store.sqWrong||{};
    if(ok)delete store.sqWrong[q.id];else store.sqWrong[q.id]=(store.sqWrong[q.id]||0)+1;
    save();
    $('#quizOpts').querySelectorAll('button[data-k]').forEach(b=>{
      const o=ord[+b.dataset.k];
      b.insertAdjacentHTML('beforeend',`<small class="sq-zh">${esc(q.zh[o])}</small>`)
    });
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 最適合的說法是綠色那一句'}<br><small>${esc(q.why)}</small><br><button id="sqSay">🔊 聽正確說法</button>`;
    const go=()=>say(q.opts[q.ans],.9);
    $('#sqSay').onclick=go;
    go()
  })
}
/* ===== V5.18.0 我的錯題本：整合答錯的單字、句子（聽力、對話填空）、情境題 ===== */
let _sBy=null;
function sById(id){
  if(!_sBy){
    _sBy={};
    ALLS.forEach(s=>_sBy[s.id]=s)
  }
  return _sBy[id]
}
function wbData(){
  const ww=store.wrongWords||{},ls=store.lsWrong||{},sq=store.sqWrong||{};
  const by=(x,y)=>y.n-x.n;
  const words=Object.keys(ww).filter(w=>WMAP[w]&&ww[w]>0).map(w=>({k:w,n:ww[w],x:WMAP[w]})).sort(by);
  const sents=Object.keys(ls).map(id=>({k:id,n:ls[id],s:sById(id)})).filter(o=>o.s).sort(by);
  const situs=Object.keys(sq).map(id=>({k:id,n:sq[id],q:SITQ.find(q=>q.id===id)})).filter(o=>o.q).sort(by);
  return {words,sents,situs,total:words.length+sents.length+situs.length}
}
function wbSrc(s){
  return s.src==='dialog'?'對話：'+((DLG_BY[s.dlg]||{}).t||''):(SRC_LABEL[s.src]||'句子')
}
function renderWrongBook(){
  const D=wbData(),box=$('#wrongBody');
  if(!box)return;
  const more=(arr,n)=>arr.length>n?`<p class="muted">…還有 ${arr.length-n} 項（練習時都會出現）</p>`:'';
  box.innerHTML=`<div class="stat-cards wb-cards${(D.phr||[]).length?' wb4':''}"><div><b>${D.words.length}</b><span>單字</span></div><div><b>${D.sents.length}</b><span>句子</span></div><div><b>${D.situs.length}</b><span>情境題</span></div>${(D.phr||[]).length?`<div><b>${D.phr.length}</b><span>片語</span></div>`:''}</div>`+
  (D.total?`<button id="wbMix" class="primary wide">▶ 全部錯題混合練習（${D.total} 題）</button>`:'<p class="wb-empty">🎉 目前沒有錯題。測驗答錯的題目會自動收集到這裡，答對後會移出。</p>')+
  (D.words.length?`<h3>單字（${D.words.length}）<button class="mini" data-wbgo="w">練習</button></h3><div class="wb-list">${D.words.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(dispW(o.k))}</b><small>${esc(o.x.zh||'')}</small></span><small class="wb-n">還要答對 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.k)}" aria-label="播放">🔊</button><button class="mini" data-wbdel="w|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.words,50)}`:'')+
  (D.sents.length?`<h3>句子（${D.sents.length}）<button class="mini" data-wbgo="s">聽力練習</button><button class="mini" data-wbgo="sp">跟讀</button></h3><div class="wb-list">${D.sents.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(o.s.en)}</b><small>${esc(o.s.zh)}｜${esc(wbSrc(o.s))}</small></span><small class="wb-n">錯 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.s.en)}" aria-label="播放">🔊</button><button class="mini" data-wbdel="s|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.sents,50)}`:'')+
  (D.situs.length?`<h3>情境題（${D.situs.length}）<button class="mini" data-wbgo="q">練習</button></h3><div class="wb-list">${D.situs.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(o.q.sit)}</b><small>正確說法：${esc(o.q.opts[o.q.ans])}</small></span><small class="wb-n">錯 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.q.opts[o.q.ans])}" aria-label="播放">🔊</button><button class="mini" data-wbdel="q|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.situs,50)}`:'')+
  pdWbHtml(D)+'<p class="muted">單字要再答對 2 次；句子、情境題和片語聽寫答對 1 次就會移出錯題本；也可以按 ✕ 手動移除。</p>';
  const mx=$('#wbMix');
  if(mx)mx.onclick=()=>{
    page('quiz');
    $('#quizType').value='wrongmix';
    $('#quizType').onchange()
  }
}
function openWrongBook(){
  const a=document.querySelector('nav button.active');
  wbFrom=a&&/^nav(Today|Quiz|Stats)$/.test(a.id)?a.id.slice(3).toLowerCase():'quiz';
  const bk=$('#wbBack');
  if(bk)bk.textContent={today:'← 返回今日',quiz:'← 返回測驗',stats:'← 返回統計'}[wbFrom];
  page('wrongbook');
  renderWrongBook()
}
$('#wrongBody').addEventListener('click',e=>{
  const g=e.target.closest('[data-wbgo]'),sy=e.target.closest('[data-wbsay]'),dl=e.target.closest('[data-wbdel]');
  if(sy){
    say(sy.dataset.wbsay,.9);
    return
  }
  if(dl){
    const [t,k]=dl.dataset.wbdel.split('|');
    const m=t==='w'?'wrongWords':t==='s'?'lsWrong':t==='p'?'phWrong':'sqWrong';
    /* V5.27.2：移除後顯示「復原」（原本按到就直接刪掉） */
    const old=store[m]&&store[m][k];
    if(store[m])delete store[m][k];
    save();
    renderWrongBook();
    if(old!=null)$('#wrongBody').insertAdjacentHTML('afterbegin',`<p class="rec-msg ok wb-undo">已移出錯題本。<button class="mini" data-wbundo="${esc(m)}|${esc(k)}|${+old}">↩️ 復原</button></p>`);
    return
  }
  const un=e.target.closest('[data-wbundo]');
  if(un){
    const [m,k,n]=un.dataset.wbundo.split('|');
    if(['wrongWords','lsWrong','sqWrong','phWrong'].includes(m)){
      store[m]=store[m]||{};
      store[m][k]=+n||1;
      save()
    }
    renderWrongBook();
    return
  }
  if(!g)return;
  const v=g.dataset.wbgo;
  if(v==='pd')return pdWrongGo();
  if(v==='sp'){
    page('practice');
    $('#unit').value='lsw';
    $('#unit').onchange();
    return
  }
  page('quiz');
  if(v==='w'){
    $('#quizType').value='word';
    $('#quizBook').value='wrong';
    $('#quizMode').value='mix'
  }else if(v==='s'){
    $('#quizType').value='lisen';
    $('#quizSRange').value='wrong'
  }else{
    $('#quizType').value='situ';
    $('#quizSRange2').value='wrong'
  }
  $('#quizType').onchange()
});
function wrongMixQuiz(){
  const D=wbData();
  if(!D.total){
    qEmpty('🎉 錯題本是空的，太棒了！');
    return
  }
  const all=[...D.words.map(o=>['w',o]),...D.sents.map(o=>['s',o]),...D.situs.map(o=>['q',o]),...(D.phr||[]).map(o=>['p',o])];
  let p=all[Math.floor(Math.random()*all.length)];
  if(all.length>1&&p[1].k===store.wbLast)p=all[(all.indexOf(p)+1)%all.length];
  store.wbLast=p[1].k;
  if(p[0]==='w')wordQuiz(p[1].x);else if(p[0]==='s')lisEnQuiz(p[1].s);else if(p[0]==='p')pdQuiz(p[1].x);else situQuiz(p[1].q);
  $('#quizQ').insertAdjacentHTML('afterbegin',`<small class="muted wb-tag">📕 錯題本混合練習（剩 ${D.total} 題）</small><br>`)
}
window.P6QUIZ={lisen:lisEnQuiz,liszh:lisZhQuiz,dcloze:dcQuiz,situ:situQuiz,wrongmix:wrongMixQuiz,radio:radioQuiz,pairs:pairsQuiz};
$('#openWB').onclick=openWrongBook;
$('#wbBack').onclick=()=>{
  if(wbFrom==='today')$('#navToday').click();else if(wbFrom==='stats')$('#navStats').click();else{
    page('quiz');
    runQuiz()
  }
};
['quizSRange','quizSRange2','quizDcRange'].forEach(id=>{
  const e=$('#'+id);
  if(e)e.onchange=runQuiz
});
(function(){
  const g=$('#dlgUnits');
  if(g&&DIALOGS.length){
    const n=ALLS.filter(x=>x.src==='dialog').length;
    g.innerHTML=`<option value="dall">對話句・全部（${n}）</option>`+DIALOGS.map((d,k)=>`<option value="${esc(d.id)}">對話 ${k+1}・${esc(d.t)}</option>`).join('')
  }else if(g)g.remove();
  updEveryLabel()
})();
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferred=e;
  $('#install').hidden=false
});
/* V5.27.2：安裝提示只能用一次；按過就收起按鈕（原本再按會出現紅色錯誤） */
$('#install').onclick=async()=>{
  const d=deferred;
  deferred=null;
  $('#install').hidden=true;
  if(d)try{
    await d.prompt()
  }catch(e){}
};
window.addEventListener('appinstalled',()=>{
  deferred=null;
  $('#install').hidden=true
});
if('serviceWorker'in navigator){
  let swReloaded=false,hadCtl=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadCtl||swReloaded)return;
    const go=()=>{
      if(swReloaded)return;
      swReloaded=true;
      location.reload()
    };
    const busy=REC.state!=='idle'||VOICE.srBusy||RP.on||DLG.run||autoOn||cardAuto||$('#todayPage').hidden;
    window.__swGo=go;
    if(!busy)go();else document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&REC.state==='idle')go()
    })
  });
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.update&&reg.update().catch(()=>{})
  }).catch(()=>{})
}
if(store.settings.unit&&[...$('#unit').options].some(o=>o.value===store.settings.unit))$('#unit').value=store.settings.unit;
$('#hideKnown').checked=!!store.settings.hideKnown;
i=(store.settings.pos||{})[$('#unit').value]||0;
filter();
render();
page('today');
renderToday();
try{
  const msg=sessionStorage.getItem('e5k_msg');
  if(sessionStorage.getItem('e5k_go')==='stats'){
    sessionStorage.removeItem('e5k_go');
    sessionStorage.removeItem('e5k_msg');
    page('stats');
    renderStats();
    fillVoices();
    verCheck();
    renderBackup();
    if(msg)backupMsg(msg)
  }
  if(window.__storeNote){
    page('stats');
    renderStats();
    renderBackup();
    backupMsg(window.__storeNote,'warn')
  }
}catch(e){}
try{
  if(sessionStorage.getItem('e5k_go')==='practice'){
    sessionStorage.removeItem('e5k_go');
    page('practice');
    if(sessionStorage.getItem('e5k_sr')==='1'){
      sessionStorage.removeItem('e5k_sr');
      $('#result').textContent='✅ 麥克風已重新啟動，請再按一次「🎤 開始念」。'
    }
  }
}catch(e){}
function verCheck(){
  const pv='V'+APP_VERSION,b=$('#appVer');
  const shown=HTML_VER;
  if(b)b.textContent=pv;
  const el=$('#verInfo');
  const put=c=>{
    if(!el)return;
    const want='english-5000-v'+APP_VERSION.replace(/\./g,'-'),list=c?c.split('、'):[];
    const app=list.filter(x=>!x.startsWith('english-5000-data-')),dat=list.filter(x=>x.startsWith('english-5000-data-'));
    const okc=app.length===1&&app[0]===want;
    el.innerHTML='程式版本 '+pv+'　畫面 '+esc(shown||'?')+'<br>離線快取 '+esc(app.join('、')||'（尚未建立）')+(dat.length?'<br>字庫快取 '+esc(dat.map(x=>x.slice(18)).join('、')):'')+((shown&&shown!==pv)||(c&&!okc)?'<br><b style="color:#c62828">⚠️ 版本不一致：請回到「今日」頁，或把 App 完全關閉後重新開啟</b>':'　✅ 一致')
  };
  if(window.caches&&caches.keys)caches.keys().then(k=>put(k.filter(x=>x.startsWith('english-5000')).join('、'))).catch(()=>put(''));else put('')
}
setTimeout(verCheck,0);
/* ===== V5.20.0 單字例句延後載入：先顯示畫面，再載入 data-ex.js（約 0.4 MB），載入後補進句子清單 ===== */
function mergeEx(ex){
  if(EX_READY||!ex)return;
  WORDS.forEach(x=>{
    const e=ex[x.w];
    if(e){
      x.ex=e[0];
      x.exz=e[1]
    }
  });
  const ws=wordSents();
  const at=ALLS.findIndex(s=>s.src!=='core');
  ALLS.splice(at<0?ALLS.length:at,0,...ws,...wordSents2());
  EX_READY=true;
  /* V5.32.0：多益長例句（data-ex2.js）在單字例句之後才下載；選了長例句單元就立刻下載 */
  setTimeout(()=>loadWordEx2(0),$('#unit').value==='wt2'?0:1500);
  EX_FAIL=false;
  _sBy=null;
  updEveryLabel();
  /* 目前的句子單元需要單字例句：回到這個單元保存的位置 */
  const u=$('#unit').value;
  if(exNeeded(u)&&u!=='wt2'&&!RP.on){
    const keep=$('#result').innerHTML,note=/麥克風已重新啟動/.test(keep);
    i=(store.settings.pos&&store.settings.pos[u])||0;
    filter();
    if(REC.state==='idle'&&!VOICE.srBusy){
      render();
      if(note)$('#result').innerHTML=keep
    }
  }
  if(!$('#todayPage').hidden)renderToday();
  if(!$('#wordPage').hidden&&$('#wordCard').hidden)renderWords();
  /* V5.27.2：統計頁的句子總數在例句載入後更新 */
  if(!$('#statsPage').hidden)renderStats()
}
function loadWordEx(tries){
  tries=tries||0;
  if(EX_READY)return;
  if(window.WORD_EX){
    mergeEx(window.WORD_EX);
    return
  }
  window.__wordEx=mergeEx;
  const s=document.createElement('script');
  s.src='data-ex.js';
  s.async=true;
  s.onerror=()=>{
    s.remove();
    if(tries<3)setTimeout(()=>loadWordEx(tries+1),1500*(tries+1));else{
      EX_FAIL=true;
      try{
        updEveryLabel()
      }catch(e){}
      if(!$('#todayPage').hidden)renderToday()
    }
  };
  document.body.appendChild(s)
}
/* 等頁面載入完成（load）後才開始下載例句檔：不和開啟時需要的檔案搶頻寬，瀏覽器也不會一直顯示「載入中」 */
if(document.readyState==='complete')setTimeout(()=>loadWordEx(0),0);else window.addEventListener('load',()=>setTimeout(()=>loadWordEx(0),0));
/* ===== V5.29.0 ===== */
/* 單字卡第二個例句：標出單字（含詞形） */
function hlx(x,t){
  const e=esc(t);
  const fs=hlForms(x.w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
  return r.test(e)?e.replace(r,'$1<mark>$2</mark>'):e
}

/* ---------- 9. 音標：IPA／KK（KK 由 App 的美式音標自動轉換，僅供參考） ---------- */
function phonKK(p){
  return String(p||'').split(' ').map(w=>{
    const nV=(w.match(/aɪ|aʊ|ɔɪ|eɪ|oʊ|ər|[iɪeɛæɑɔoʊuə]/g)||[]).length,noMark=!/[ˈˌ]/.test(w);
    let out='',mark='';
    const segs=w.split(/([ˈˌ])/),lastSeg=segs.length-1;
    segs.forEach((s,si)=>{
      if(s==='ˈ'){
        out+='ˋ';
        mark='p';
        return
      }
      if(s==='ˌ'){
        out+='ˏ';
        mark='s';
        return
      }
      let first=true;
      out+=s.replace(/aɪ|aʊ|ɔɪ|eɪ|oʊ|ər|[iɪeɛæɑɔoʊuə]/g,(v,off,str)=>{
        /* V5.31.1：次重音（ˌ）也算重讀；ər 後面接母音時，非重讀寫成 ər（battery ˋbætərɪ），重讀寫成 ɝ（hurry ˋhɝɪ） */
        const st=first&&(mark==='p'||mark==='s'||(noMark&&nV===1));
        first=false;
        if(v==='eɪ')return 'e';
        if(v==='oʊ')return 'o';
        if(v==='ər')return st?'ɝ':/[iɪeɛæɑɔoʊuəa]/.test(str[off+2]||'')?'ər':'ɚ';
        if(v==='ə'&&st&&(off<str.length-1||si<lastSeg))return 'ʌ';
        if(v==='i'&&!st&&nV>1&&si===lastSeg&&(off===str.length-1||/^[zd]$/.test(str.slice(off+1))))return 'ɪ';
        return v
      });
      mark=''
    });
    return out.replace(/ʤ/g,'dʒ').replace(/ʧ/g,'tʃ')
  }).join(' ')
}
function phon(p){
  return store.settings.phon==='kk'?phonKK(p):String(p||'')
}
function phonDemo(){
  const e=$('#phonDemo');
  if(e)e.textContent='範例：thirty /'+phon('ˈθərti')+'/、money /'+phon('ˈməni')+'/、agent /'+phon('ˈeɪʤənt')+'/'+(store.settings.phon==='kk'?'（KK 由 App 的美式音標自動轉換，僅供參考）':'')
}
(function(){
  const ps=$('#phonSel'),rc=$('#reviewCapSel');
  if(ps){
    ps.value=store.settings.phon==='kk'?'kk':'ipa';
    ps.onchange=()=>{
      store.settings.phon=ps.value==='kk'?'kk':'ipa';
      save();
      phonDemo()
    }
  }
  if(rc){
    rc.value=String(reviewCap());
    rc.onchange=()=>{
      store.settings.reviewCap=+rc.value;
      save()
    }
  }
  phonDemo()
})();

/* ---------- 12. 單字頁：篩選收起來（主題、狀態、只學原形、每日新字） ---------- */
function wfMark(){
  const t=$('#wfToggle');
  if(!t)return;
  const on=$('#wordTopic').value!=='all'||$('#wordState').value!=='all'||!skipV();
  t.classList.toggle('on',on);
  t.textContent=on?'篩選 ●':'篩選 ▾'
}
(function(){
  const t=$('#wfToggle'),p=$('#wfPanel');
  if(!t||!p)return;
  t.onclick=()=>{
    p.hidden=!p.hidden;
    t.setAttribute('aria-expanded',String(!p.hidden))
  };
  wfMark()
})();

/* ---------- 12. 統計頁：未來 7 天複習量、單字複習答對率 ---------- */
function statsExtraHtml(){
  const B=[0,0,0,0,0,0,0].map(()=>({w:0,s:0,p:0})),t0=day(),ds=[0,1,2,3,4,5,6].map(k=>day(k));
  const put=(r,key)=>{
    if(!r)return;
    const k=r<=t0?0:ds.indexOf(r);
    if(k>=0)B[k][key]++
  };
  const kn=cset('known'),pk=cset('phKnown'),phIds=new Set(PHRASES.map(x=>x.id));
  Object.entries(store.reviewDue||{}).forEach(([w,r])=>{
    if(BY_WORD[w])put(r,'w')
  });
  Object.entries(store.sDue||{}).forEach(([id,r])=>{
    if(kn.has(id)&&sById(id))put(r,'s')
  });
  Object.entries(store.pDue||{}).forEach(([id,r])=>{
    if(pk.has(+id)&&phIds.has(+id))put(r,'p')
  });
  const mx=Math.max(1,...B.map(b=>b.w+b.s+b.p)),wd='日一二三四五六';
  const rows=B.map((b,k)=>{
    const d=new Date();
    d.setDate(d.getDate()+k);
    const lab=k===0?'今天':k===1?'明天':(d.getMonth()+1)+'/'+d.getDate()+'（'+wd[d.getDay()]+'）',n=b.w+b.s+b.p;
    return `<div class="fc-row"><b>${lab}</b><span class="fc-bar"><i style="width:${Math.round(n/mx*100)}%"></i></span><small>${n?`單字 ${b.w}・句子 ${b.s}・片語 ${b.p}`:'—'}</small></div>`
  }).join('');
  const L=store.dailyLog||{};
  let ok=0,ng=0;
  for(let k=0;k<30;k++){
    const v=L[day(-k)];
    if(v){
      ok+=+v.rok||0;
      ng+=+v.rng||0
    }
  }
  return `<h3>未來 7 天要複習 <small class="muted">（今天含已過期）</small></h3><div class="fc">${rows}</div><h3>單字複習答對率 <small class="muted">（近 30 天，V5.29.0 起統計）</small></h3>`+(ok+ng?`<div class="stat-row"><b>記得</b>${bar(ok,ok+ng)}</div><p class="muted">複習到期單字時按「✓ 已熟」${ok} 次、「◐ 模糊／✗ 不熟」${ng} 次。答對率低於 8 成時，可以把每日新字調少一點。</p>`:'<p class="muted">還沒有紀錄：複習到期單字時按「✓ 已熟」「◐ 模糊」「✗ 不熟」就會開始統計。</p>')
}

/* ---------- 11. 資料保存：iPhone 提示加入主畫面、Android 請瀏覽器保留資料 ---------- */
function isStandalone(){
  try{
    return !!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches))
  }catch(e){
    return false
  }
}
function isIOS(){
  return /iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
}
var PERSIST=null;
(function(){
  try{
    if(navigator.storage&&navigator.storage.persisted)navigator.storage.persisted().then(p=>{
      PERSIST=p;
      if(!p&&navigator.storage.persist&&(isStandalone()||/Android/i.test(navigator.userAgent)))navigator.storage.persist().then(r=>{
        PERSIST=r
      }).catch(()=>{})
    }).catch(()=>{})
  }catch(e){}
})();
function iosTipHtml(){
  if(!isIOS()||isStandalone())return '';
  const t=store.settings.iosTip;
  if(t==='never'||(t&&t>day(-30)))return '';
  const ua=navigator.userAgent,how=/Line\/|FBAN|FBAV|Instagram/i.test(ua)?'請先用 Safari 開啟這個網址，再按「分享」⬆️ →「加入主畫面」':/CriOS|EdgiOS|FxiOS/i.test(ua)?'按瀏覽器的「分享」⬆️ →「加入主畫面」（iOS 16.4 以上；或用 Safari 開啟後加入）':'按 Safari 的「分享」⬆️ →「加入主畫面」';
  return `<div class="backup ios-tip"><b>📲 建議把 App 加入主畫面</b><small>用瀏覽器開網頁時，只要 7 天沒開這個網站，iPhone 可能清掉學習紀錄；加到主畫面的 App 不會。做法：${how}，之後從主畫面的圖示開啟。</small><div class="grid2"><button data-go="iostip">知道了</button><button data-go="iostipnever">不再提醒</button></div></div>`
}

/* ---------- 2. 一鍵「開始今天的學習」：複習 → 新字 → 句子跟讀 → CE 情境題 ---------- */
var FLOW_KEY='e5k_flow';
function flowLabel(k){
  return {review:['🔁','複習單字'],new:['🆕','學新單字'],sent:['🗣','句子跟讀','🎤 念對或按「✓ 我會說了」'],situ:['🏭','CE 情境題'],ph:['💬','片語','按 ○ 標記已會'],radio:['📻','無線電用語','🎤 念對或按 ✓'],rp:['🎭','Role Play','演完一段']}[k]
}
var FLOW=null,_flowT=0;
function flowLoad(){
  try{
    const f=JSON.parse(localStorage.getItem(FLOW_KEY)||'null');
    if(f&&f.day===day()&&Array.isArray(f.steps)&&f.base&&typeof f.i==='number')return f
  }catch(e){}
  return null
}
function flowSave(){
  try{
    if(FLOW)localStorage.setItem(FLOW_KEY,JSON.stringify(FLOW));else localStorage.removeItem(FLOW_KEY)
  }catch(e){}
}
function flowPlan(){
  /* V5.32.0：有自訂「今日學習」時照設定排；沒有設定時照原本的預設 */
  if(flowCfgOn())return flowPlanCfg();
  const L=todayLog(),cap=reviewCap(),due=WORDS.filter(x=>isDue(x.w)).length,g=store.settings.dailyGoal||20;
  const st=[];
  const rv=Math.min(REVIEW_BATCH,due,cap?Math.max(0,cap-(L.review||0)):due);
  if(rv>0)st.push({k:'review',n:rv});
  const nw=Math.max(0,g-(L.new||0));
  if(nw>0)st.push({k:'new',n:nw});
  st.push({k:'sent',n:5});
  st.push({k:'situ',n:1});
  return st
}
function flowStart(){
  const L=todayLog();
  FLOW={day:day(),i:0,steps:flowPlan(),base:flowBase(L)};
  flowSave();
  flowGo()
}
function flowProg(s){
  const L=todayLog(),v=flowVal(s.k,L);
  return Math.max(0,Math.min(s.n,v-(FLOW.base[s.k]||0)))
}
/* V5.31.1：App 開著過了午夜：昨天的今日學習結束（原本進度變 0 而且做不完） */
function flowStale(){
  if(FLOW&&FLOW.day!==day()){
    FLOW=null;
    flowSave();
    return true
  }
  return false
}
function flowDone(s){
  if(flowProg(s)>=s.n)return true;
  if(s.k==='review'&&!WORDS.some(x=>isDue(x.w)))return true;
  if(s.k==='new'&&!WORDS.some(x=>statusOf(x.w)==='new'&&!(skipV()&&x.b&&x.k!==7)))return true;
  if(flowNothing(s.k))return true;
  return false
}
function flowGo(){
  if(flowStale()){
    flowBar();
    if(!$('#todayPage').hidden)renderToday();
    return
  }
  if(!FLOW)return;
  while(FLOW.i<FLOW.steps.length&&flowDone(FLOW.steps[FLOW.i]))FLOW.i++;
  flowSave();
  if(FLOW.i<FLOW.steps.length){
    const k=FLOW.steps[FLOW.i].k;
    todayGo(k)
  }
  flowBar()
}
function flowEnd(){
  if(FLOW&&FLOW.i>=FLOW.steps.length){
    try{
      localStorage.setItem('e5k_flow_done',day())
    }catch(e){}
  }
  FLOW=null;
  flowSave();
  flowBar();
  if(!$('#todayPage').hidden)renderToday()
}
function flowSig(){
  if(!FLOW)return '';
  if(FLOW.i>=FLOW.steps.length)return 'end';
  const s=FLOW.steps[FLOW.i];
  return FLOW.i+'|'+flowProg(s)+'|'+flowDone(s)
}
function flowBar(){
  let el=$('#flowBar');
  flowStale();
  if(!FLOW){
    if(el)el.hidden=true;
    document.body.classList.remove('flow-on');
    clearInterval(_flowT);
    _flowT=0;
    return
  }
  if(!el){
    el=document.createElement('div');
    el.id='flowBar';
    el.className='flow-bar';
    el.setAttribute('role','status');
    document.body.appendChild(el);
    el.addEventListener('click',e=>{
      const b=e.target.closest('[data-flow]');
      if(!b||!FLOW)return;
      const a=b.dataset.flow;
      if(a==='next'||a==='skip'){
        FLOW.i++;
        flowGo()
      }else if(a==='go')flowGo();else if(a==='end')flowEnd()
    })
  }
  el.hidden=false;
  document.body.classList.add('flow-on');
  const n=FLOW.steps.length;
  if(FLOW.i>=n){
    el.innerHTML='<span class="fb-t"><b>🎉 今天的學習完成了！</b></span><button data-flow="end" class="primary">完成</button>';
    clearInterval(_flowT);
    _flowT=0
  }else{
    const s=FLOW.steps[FLOW.i],dn=flowDone(s),nx=FLOW.steps[FLOW.i+1],lb=flowLabel(s.k);
    const sub=dn?(nx?'下一步：'+flowLabel(nx.k)[1]:'最後一步完成'):(lb[2]||'');
    el.innerHTML=`<span class="fb-t"><small>今日學習 ${FLOW.i+1}／${n}${sub?'　'+sub:''}</small><b>${lb[0]} ${lb[1]} ${flowProg(s)}／${s.n}${dn?' ✅':''}</b></span>`+(dn?`<button data-flow="next" class="primary">${nx?'下一步 ▶':'完成 ▶'}</button>`:'<button data-flow="go">回到這一步</button><button data-flow="skip" class="fb-skip">略過</button>')+'<button data-flow="end" class="fb-x" aria-label="結束今日學習">✕</button>'
  }
  el.dataset.sig=flowSig();
  const nav=document.querySelector('nav');
  if(nav){
    const r=nav.getBoundingClientRect();
    el.style.bottom=Math.max(8,Math.round(window.innerHeight-r.top+8))+'px'
  }
  /* V5.31.1：頁面底部留出進度列的高度，最後的按鈕可以捲到進度列上面 */
  document.body.style.setProperty('--fbh',el.offsetHeight+'px')
  if(!_flowT&&FLOW&&FLOW.i<n)_flowT=setInterval(()=>{
    const b=$('#flowBar');
    if(flowStale()){
      flowBar();
      if(!$('#todayPage').hidden)renderToday();
      return
    }
    if(FLOW&&b&&b.dataset.sig!==flowSig())flowBar()
  },1000)
}
function flowBtnHtml(){
  if(typeof REVIEW_BATCH==='undefined')return '';
  flowStale();
  if(FLOW&&FLOW.i<FLOW.steps.length)return `<button class="primary wide flow-start" data-go="flow">▶ 繼續今天的學習<small>第 ${FLOW.i+1}／${FLOW.steps.length} 步：${flowLabel(FLOW.steps[FLOW.i].k)[1]}</small></button>`;
  const p=flowPlan();
  if(!p.length)return flowEmptyHtml();
  let fd='';
  try{
    fd=localStorage.getItem('e5k_flow_done')
  }catch(e){}
  if(fd===day())return `<button class="wide flow-start flow-done" data-go="flow">✅ 今天的學習完成了<small>想多練習：再練一輪（${p.map(s=>flowLabel(s.k)[1]).join(' → ')}）</small></button>`;
  return `<button class="primary wide flow-start" data-go="flow">▶ 開始今天的學習<small>${p.map(s=>flowLabel(s.k)[1]+flowAmt(s)).join(' → ')}，約 ${flowMin(p)} 分鐘</small></button>`
}
FLOW=flowLoad();
if(FLOW)setTimeout(()=>{
  flowBar();
  if(!$('#todayPage').hidden)renderToday()
},0);
window.addEventListener('resize',()=>{
  if(FLOW)flowBar()
});

/* ---------- 3. 點句子裡的英文字查意思（對話、句子頁、片語例句、單字卡例句） ---------- */
var LK=null;
function lkBuild(){
  if(LK)return;
  LK=new Map();
  WORDS.forEach(x=>{
    const k=x.w.toLowerCase(),o=LK.get(k);
    if(!o||(o.b&&!x.b))LK.set(k,x)
  })
}
function lkStems(w){
  /* V5.31.1：先試比較可能的原形（taped → tape、used → use、added → add、bigger → big） */
  const c=[];
  const sfx=st=>{
    if(/([b-df-hj-np-tv-z])\1$/.test(st))c.push(st,st.slice(0,-1));else if(/[b-df-hj-np-tv-z]$/.test(st))c.push(st+'e',st);else c.push(st,st+'e')
  };
  if(/ies$/.test(w))c.push(w.slice(0,-3)+'y');
  if(/ied$/.test(w))c.push(w.slice(0,-3)+'y');
  if(/ier$/.test(w))c.push(w.slice(0,-3)+'y');
  if(/iest$/.test(w))c.push(w.slice(0,-4)+'y');
  if(/ily$/.test(w))c.push(w.slice(0,-3)+'y');
  if(/ves$/.test(w))c.push(w.slice(0,-3)+'f',w.slice(0,-3)+'fe');
  if(/s$/.test(w))c.push(w.slice(0,-1));
  if(/es$/.test(w))c.push(w.slice(0,-2));
  if(/ed$/.test(w))sfx(w.slice(0,-2));
  if(/ing$/.test(w))sfx(w.slice(0,-3));
  if(/er$/.test(w))sfx(w.slice(0,-2));
  if(/est$/.test(w))sfx(w.slice(0,-3));
  if(/ly$/.test(w))c.push(w.slice(0,-2));
  return c
}
/* V5.31.1：單字表沒有收的不規則變化（am → be、sat → sit、shelves → shelf…）、稱謂與時間縮寫 */
var IRREG={"am":"be","analyses":"analysis","appendices":"appendix","arisen":"arise","arose":"arise","awoke":"awake","awoken":"awake","bitten":"bite","bled":"bleed","blew":"blow","borne":"bear","bred":"breed","burnt":"burn","crises":"crisis","drank":"drink","dreamed":"dream","dreamt":"dream","dug":"dig","eaten":"eat","farther":"far","farthest":"far","fled":"flee","flies":"fly","flown":"fly","forbade":"forbid","forgave":"forgive","forgiven":"forgive","gentlemen":"gentleman","froze":"freeze","halves":"half","hid":"hide","indices":"index","knives":"knife","lain":"lie","leaned":"lean","leant":"lean","leaped":"leap","leapt":"leap","learnt":"learn","lent":"lend","mice":"mouse","misled":"mislead","mistook":"mistake","overcame":"overcome","oversaw":"oversee","overseen":"oversee","phenomena":"phenomenon","rang":"ring","ridden":"ride","risen":"rise","rode":"ride","rung":"ring","sang":"sing","sank":"sink","sat":"sit","selves":"self","sewed":"sew","sewn":"sew","shaken":"shake","shelves":"shelf","shone":"shine","shook":"shake","shrank":"shrink","shrunk":"shrink","slid":"slide","sped":"speed","sprang":"spring","sprung":"spring","spun":"spin","sung":"sing","sunk":"sink","swam":"swim","swept":"sweep","swore":"swear","sworn":"swear","swum":"swim","swung":"swing","thieves":"thief","tore":"tear","undertaken":"undertake","undertook":"undertake","withdrawn":"withdraw","withdrew":"withdraw","wives":"wife","woken":"wake","wolves":"wolf"};
var LK_SPECIAL={'a.m.':['a.m.','上午'],'p.m.':['p.m.','下午'],'mr':['Mr.','先生（稱謂）'],'ms':['Ms.','女士（稱謂）'],'mrs':['Mrs.','太太（稱謂）'],'dr':['Dr.','醫生；博士（稱謂）'],'a.m':['a.m.','上午'],'p.m':['p.m.','下午'],'nt':['NT$','新台幣（New Taiwan dollar）'],'n/a':['N/A','不適用（not applicable）'],'twdc':['TWDC','本 App 對話裡的機房名稱（範例）']};
function lkOne(q){
  if(!q)return null;
  let x=LK.get(q)||LK.get(q.replace(/'s$/,''));
  if(!x&&IRREG[q])x=LK.get(IRREG[q]);
  if(!x)for(const c of lkStems(q)){
    if(LK.get(c)){
      x=LK.get(c);
      break
    }
  }
  return x||null
}
function lkFind(raw,prev,next){
  lkBuild();
  const norm=s=>String(s||'').toLowerCase().replace(/’/g,"'").replace(/^[-']+|[-']+$/g,'');
  const w=norm(raw),p=norm(prev),n=norm(next);
  if(!w)return null;
  const sp=LK_SPECIAL[w.replace(/\.$/,'')]||LK_SPECIAL[w];
  if(sp)return {extra:{w:sp[0],zh:sp[1]}};
  let x=null;
  /* 先找兩個字的 CE 用語（例如 load bank、cold aisle） */
  if(n&&LK.get(w+' '+n))x=LK.get(w+' '+n);else if(p&&LK.get(p+' '+w))x=LK.get(p+' '+w);
  if(!x)x=lkOne(w);
  if(!x){
    /* 無線電字母代碼（Bravo、Papa…）與常用說法（Roger…） */
    const R=window.RADIO||{},a=(R.abc||[]).find(v=>v[1].toLowerCase()===w);
    if(a)return {extra:{w:a[1],zh:'字母代碼：'+a[0]+'（無線電拼字用）'}};
    const pr=(R.pro||[]).find(v=>v.en.toLowerCase().replace(/[.?!]/g,'')===w);
    if(pr)return {extra:{w:pr.en.replace(/[.]$/,''),zh:pr.zh.replace(/。$/,'')+'（無線電用語）'}};
    /* 連字號複合字（year-end、full-time）與設備代號（PDU-B3 → PDU） */
    if(/-/.test(w)){
      const ps=w.split('-').filter(Boolean),f=ps.map(lkOne),hit=f.filter(Boolean);
      if(hit.length===1){
        const h=hit[0];
        return {x:h,base:h.b&&BY_WORD[h.b]?BY_WORD[h.b]:null,code:raw}
      }
      if(hit.length>=2)return {parts:ps.map((q,k)=>({q,x:f[k]})),raw}
    }
    /* V5.32.0：人名地名、補充字典、序數、字母代號、編號 */
    return lkExtra(w,p,n,raw)
  }
  return {x,base:x.b&&BY_WORD[x.b]?BY_WORD[x.b]:null}
}
var LK_HOST='#english, .dlg-en, #phRows .ex2, #wordCard .card-ex .en';
function lkWordAt(e){
  let node=null,off=0;
  try{
    if(document.caretPositionFromPoint){
      const p=document.caretPositionFromPoint(e.clientX,e.clientY);
      if(p){
        node=p.offsetNode;
        off=p.offset
      }
    }else if(document.caretRangeFromPoint){
      const r=document.caretRangeFromPoint(e.clientX,e.clientY);
      if(r){
        node=r.startContainer;
        off=r.startOffset
      }
    }
  }catch(err){}
  if(!node||node.nodeType!==3)return null;
  const host=node.parentElement&&node.parentElement.closest(LK_HOST);
  if(!host||node.parentElement.closest('small,button'))return null;
  const t=node.data,re=/[A-Za-z0-9'’+-]/;
  for(const m of t.matchAll(/\b([ap])\.\s?m\.?/gi)){
    if(off>=m.index&&off<=m.index+m[0].length)return {w:m[1].toLowerCase()+'.m.',prev:null,next:null}
  }
  let a=off,b=off;
  while(a>0&&re.test(t[a-1]))a--;
  while(b<t.length&&re.test(t[b]))b++;
  if(a===b||!/[A-Za-z]/.test(t.slice(a,b)))return null;
  /* 點到字的外面（例如句子後面的空白）不算 */
  try{
    const rg=document.createRange();
    rg.setStart(node,a);
    rg.setEnd(node,b);
    const rs=[...rg.getClientRects()];
    if(!rs.some(r=>e.clientX>=r.left-3&&e.clientX<=r.right+3&&e.clientY>=r.top-3&&e.clientY<=r.bottom+3))return null
  }catch(err){}
  const bef=t.slice(0,a).match(/([A-Za-z'’-]+)\s+$/),aft=t.slice(b).match(/^\s+([A-Za-z'’-]+)/);
  let rect=null;
  try{
    const rg=document.createRange();
    rg.setStart(node,a);
    rg.setEnd(node,b);
    rect=rg.getBoundingClientRect()
  }catch(err){}
  return {w:t.slice(a,b),prev:bef&&bef[1],next:aft&&aft[1],rect}
}
function lkPlace(rect){
  const el=$('#lkPop');
  if(!el||el.hidden)return;
  el.style.top='';
  el.style.bottom='';
  if(rect&&rect.top>innerHeight*.45){
    const h=document.querySelector('header'),t=Math.max(8,Math.round((h?h.getBoundingClientRect().bottom:0)+6));
    el.style.top=t+'px';
    el.style.bottom='auto'
  }
}
/* V5.31.1：底部選單或今日學習進度列的上緣（自動捲動要避開的位置） */
function bottomLimit(){
  const nv=document.querySelector('nav');
  let t=nv?nv.getBoundingClientRect().top:innerHeight;
  const fb=document.getElementById('flowBar');
  if(fb&&!fb.hidden){
    const r=fb.getBoundingClientRect();
    if(r.height)t=Math.min(t,r.top)
  }
  return t
}
function lkClose(){
  const el=$('#lkPop');
  if(el)el.hidden=true
}
function lkQuiet(){
  try{
    return REC.state!=='idle'||VOICE.srBusy||DLG.run||autoOn||cardAuto||RP.on
  }catch(e){
    return false
  }
}
function lkShow(r,raw){
  let el=$('#lkPop');
  if(!el){
    el=document.createElement('div');
    el.id='lkPop';
    el.className='lk-pop';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-label','查單字');
    document.body.appendChild(el);
    el.addEventListener('click',e=>{
      const b=e.target.closest('[data-lk]');
      if(!b)return;
      const a=b.dataset.lk,w=el.dataset.w,x=BY_WORD[w],form=el.dataset.form||w;
      if(a==='x')return lkClose();
      if(a==='sayraw'){
        say(el.dataset.say||'',1);
        return
      }
      if(!x)return;
      if(a==='play')say(form,1);
      if(a==='slow')say(form,.62);
      if(a==='fav'){
        toggleFav(x.w);
        b.textContent=store.wordFav.includes(x.w)?'★ 已收藏':'☆ 收藏'
      }
      if(a==='rev'&&statusOf(x.w)==='new'){
        setStatus(x.w,'learning');
        b.textContent='✓ 明天複習';
        b.disabled=true
      }
    })
  }
  if(!r){
    el.dataset.w='';
    el.innerHTML=`<button class="lk-x" data-lk="x" aria-label="關閉">✕</button><div class="lk-zh">單字表裡找不到「<span lang="en">${esc(raw)}</span>」（可能是人名、地名或代號）。</div>`;
    el.hidden=false;
    lkFocus(el);
    return
  }
  /* V5.31.1：稱謂、a.m./p.m.、無線電字母代碼與用語、連字號複合字（各部分的意思） */
  if(r.extra||r.parts){
    const head=r.extra?r.extra.w:r.raw;
    el.dataset.w='';
    el.dataset.say=(r.extra&&r.extra.say)||head;
    el.innerHTML=`<button class="lk-x" data-lk="x" aria-label="關閉">✕</button><div class="lk-w"><b lang="en">${esc(head)}</b>${r.extra&&r.extra.pos?' <em class="pos">'+esc(r.extra.pos)+'</em>':''}${r.extra&&r.extra.tag?' <span class="lk-tag">'+esc(r.extra.tag)+'</span>':''}</div>`+(r.extra?`<div class="lk-zh">${esc(r.extra.zh)}</div>`+(r.extra.note?`<div class="lk-base">${esc(r.extra.note)}</div>`:''):r.parts.map(q=>`<div class="lk-part"><b lang="en">${esc(q.q)}</b>　${q.x?esc(q.x.zh):'—'}</div>`).join(''))+'<div class="lk-btns"><button data-lk="sayraw">🔊 發音</button></div>';
    el.hidden=false;
    lkFocus(el);
    if(!lkQuiet())say(el.dataset.say||head,1);
    return
  }
  const x=r.x,t=r.base||x,st=statusOf(t.w);
  el.dataset.w=t.w;
  el.dataset.form=x.w;
  el.innerHTML=`<button class="lk-x" data-lk="x" aria-label="關閉">✕</button><div class="lk-w"><b lang="en">${esc(dispW(x.w))}</b> <span class="lk-p">${x.p?'/ '+esc(phon(x.p))+' /':''}</span> <em class="pos">${esc(x.pos||'')}</em></div><div class="lk-zh">${esc(x.zh)}</div>${r.base?`<div class="lk-base">原形 <b lang="en">${esc(dispW(t.w))}</b>　${esc(t.zh)}</div>`:''}${r.code&&r.code.toLowerCase()!==x.w.toLowerCase()?`<div class="lk-base">出現在「<span lang="en">${esc(r.code)}</span>」裡</div>`:''}<div class="lk-btns"><button data-lk="play">🔊 發音</button><button data-lk="slow">🐢 慢速</button><button data-lk="fav">${store.wordFav.includes(t.w)?'★ 已收藏':'☆ 收藏'}</button><button data-lk="rev"${st==='new'?'':' disabled'}>${st==='new'?'＋ 加入複習':st==='known'?'✓ 已熟':'✓ 學習中'}</button></div>`;
  el.hidden=false;
  lkFocus(el);
  if(!lkQuiet())say(x.w,1)
}
/* V5.31.1：查詢視窗可以用鍵盤操作（開啟時移到視窗、Esc 關閉並回到原來的位置）；讀屏軟體會念出內容 */
var _lkBack=null;
function lkFocus(el){
  el.setAttribute('tabindex','-1');
  el.setAttribute('aria-live','polite');
  if(!_lkBack||!el.contains(document.activeElement))_lkBack=document.activeElement;
  try{
    el.focus({preventScroll:true})
  }catch(e){}
}
document.addEventListener('keydown',e=>{
  const p=$('#lkPop');
  if(e.key==='Escape'&&p&&!p.hidden){
    lkClose();
    try{
      if(_lkBack&&_lkBack.focus)_lkBack.focus({preventScroll:true})
    }catch(err){}
  }
});
document.addEventListener('click',e=>{
  const pop=$('#lkPop');
  if(pop&&!pop.hidden&&pop.contains(e.target))return;
  const host=e.target.closest&&e.target.closest(LK_HOST);
  if(!host||e.target.closest('button,small,[data-jump]')||(RP.on&&host.id==='english')){
    if(pop&&!pop.hidden)lkClose();
    return
  }
  const at=lkWordAt(e);
  if(!at){
    if(pop&&!pop.hidden)lkClose();
    return
  }
  lkShow(lkFind(at.w,at.prev,at.next),at.w.replace(/[-.]+$/,''));
  lkPlace(at.rect)
});
window.addEventListener('scroll',()=>{
  const p=$('#lkPop');
  if(p&&!p.hidden&&Date.now()-(window.__lkAt||0)>400)lkClose()
},{passive:true});
document.addEventListener('click',()=>{
  window.__lkAt=Date.now()
},true);
/* 換頁時關閉查詢視窗、更新今日學習的進度條 */
var _pageV528=page;
page=function(name){
  lkClose();
  /* V5.31.1：換頁時停止自動播放（原本只有按底部選單才會停） */
  if((cardAuto||autoOn)&&typeof stopAuto==='function')stopAuto();
  _pageV528(name);
  if(FLOW)flowBar()
};
/* V5.31.1：App 一直開著或從背景回來、日期已經換了：補存當天的自動備份 */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  try{
    if(lsGet(SNAP_KEY+'_date')!==todayStr()){
      flushSave();
      takeSnapshot(lsGet(STORE_KEY),store)
    }
  }catch(e){}
  if(FLOW&&FLOW.day!==day()){
    FLOW=null;
    flowSave();
    flowBar();
    if(!$('#todayPage').hidden)renderToday()
  }
});

/* ---------- 4. 無線電用語：字母代碼、常用說法、唸代號、聽代號測驗 ---------- */
var RD_PFX=['UPS','PDU','ATS','MSB','RPP','STS','AHU','CRAH','CHWP','GEN'];
var RD_DIG=['zero','one','two','three','four','five','six','seven','eight','nine'];
var RD_CONF={A:'HJK',B:'DPV',C:'ZTG',D:'BTE',E:'BDG',F:'SX',G:'JZ',H:'AE',I:'Y',J:'AG',K:'AJ',L:'MN',M:'N',N:'M',O:'U',P:'BT',Q:'U',R:'L',S:'FX',T:'DP',U:'Q',V:'BZ',W:'U',X:'S',Y:'I',Z:'CV'};
function rdAbc(l){
  const r=((window.RADIO&&RADIO.abc)||[]).find(a=>a[0]===l);
  return r?r[1]:l
}
function rdCode(){
  const p=RD_PFX[Math.floor(Math.random()*RD_PFX.length)],L='ABCD'[Math.floor(Math.random()*4)],d=1+Math.floor(Math.random()*9),f=Math.floor(Math.random()*3);
  return f===0?p+'-'+d+L:f===1?p+'-'+L+d:p+'-0'+d
}
/* 唸法：設備名稱逐字母、後面的字母用字母代碼、數字一個一個唸（例：PDU-B3 → P D U, Bravo three） */
function rdSpoken(code){
  const [p,s]=code.split('-');
  return p.split('').join(' ')+', '+s.split('').map(c=>/\d/.test(c)?RD_DIG[+c]:rdAbc(c)).join(' ')
}
/* 全部用字母代碼拼出來（例：Papa Delta Uniform, Bravo Three） */
function rdSpelled(code){
  const [p,s]=code.split('-'),cap=t=>t[0].toUpperCase()+t.slice(1);
  return p.split('').map(rdAbc).join(' ')+', '+s.split('').map(c=>/\d/.test(c)?cap(RD_DIG[+c]):rdAbc(c)).join(' ')
}
function radioCardHtml(){
  if(!window.RADIO)return '';
  return '<div class="radio-card" data-radio="1" role="button" tabindex="0"><span class="dlg-no">📻</span><span class="dlg-main"><b>無線電用語</b> <small>Radio Basics</small><small class="dlg-desc">字母代碼 Alpha–Zulu、Copy／Say again／Stand by 等常用說法、設備代號和數字的唸法</small></span><span class="dlg-tick">›</span></div>'
}
var RD_CUR='';
function renderRadio(){
  const box=$('#dialogBody'),R=window.RADIO||{abc:[],pro:[],sent:[]};
  dlgStop();
  DLG.cur=null;
  box.innerHTML=`<button id="dlgBack" class="mini">← 情境列表</button><h3 class="dlg-title">📻 無線電用語 <small>Radio Basics</small></h3><p class="dlg-sit">用無線電或電話回報時，設備代號用字母代碼拼出來、數字一個一個唸，對方才不會聽錯（例如 B 和 D、15 和 50）。</p>
 <h3>字母代碼（點一下聽發音）</h3><div class="abc-grid">${R.abc.map(a=>`<button data-rsay="${esc(a[1])}"><b>${esc(a[0])}</b><span lang="en">${esc(a[1])}</span></button>`).join('')}</div>
 <h3>常用說法</h3><div class="dlg-keys">${R.pro.map(p=>`<div class="dlg-key"><span><b lang="en">${esc(p.en)}</b><small>${esc(p.zh)}</small></span><button data-rsay="${esc(p.en)}" aria-label="播放">🔊</button></div>`).join('')}</div>
 <h3>唸唸看</h3><div class="radio-drill"><div id="rdCode" class="rd-code" lang="en"></div><div id="rdSpell" class="muted" lang="en" hidden></div><div class="grid2"><button id="rdHear" class="primary">🔊 聽正確唸法</button><button id="rdNext">換一個</button></div><p class="muted">先自己唸一次，再按「聽正確唸法」對照。數字 15 和 50 容易聽錯，可以補一句 one-five、five-zero。</p></div>
 <div class="grid2 bottom"><button id="rdPractice">🗣 用 🎤 練習無線電句子（${R.sent.length} 句）</button><button id="rdQuiz">🧠 聽代號測驗</button></div>`;
  window.scrollTo(0,0);
  const next=()=>{
    RD_CUR=rdCode();
    $('#rdCode').textContent=RD_CUR;
    $('#rdSpell').hidden=true
  };
  next();
  $('#dlgBack').onclick=()=>renderDialogs();
  $('#rdNext').onclick=next;
  $('#rdHear').onclick=()=>{
    const s=rdSpelled(RD_CUR);
    $('#rdSpell').textContent=s+'（或 '+rdSpoken(RD_CUR)+'）';
    $('#rdSpell').hidden=false;
    say(s,.8)
  };
  $('#rdPractice').onclick=()=>{
    const u=$('#unit');
    u.value='radio';
    store.settings.unit='radio';
    save();
    page('practice');
    i=0;
    filter();
    if(!pool.some(s=>s.src==='radio')){
      $('#hideKnown').checked=false;
      filter()
    }
    render()
  };
  $('#rdQuiz').onclick=()=>{
    page('quiz');
    $('#quizType').value='radio';
    $('#quizType').onchange()
  }
}
$('#dialogBody').addEventListener('keydown',e=>{
  const c=e.target.closest('.radio-card');
  if(c&&(e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    renderRadio()
  }
});
function radioQuiz(){
  qCur='radio';
  let opts,ans,speak,note,head;
  if(Math.random()<.5){
    /* 設備代號：字母用字母代碼唸，選出寫法 */
    const code=rdCode(),[p,s]=code.split('-'),li=[...s].findIndex(c=>/[A-Z]/.test(c));
    const set=new Set([code]);
    if(li>=0)for(const c of qShuffle((RD_CONF[s[li]]||'BDPT').split(''))){
      if(set.size>=4)break;
      set.add(p+'-'+s.slice(0,li)+c+s.slice(li+1))
    }
    let g=0;
    while(set.size<4&&g++<40){
      const di=s.length-1-[...s].reverse().findIndex(c=>/\d/.test(c)),d=String((+s[di]+1+Math.floor(Math.random()*8))%10);
      set.add(p+'-'+s.slice(0,di)+d+s.slice(di+1))
    }
    opts=qShuffle([...set]);
    ans=code;
    speak=rdSpoken(code);
    head='📻 聽無線電：選出對方說的設備代號';
    note=`唸法：<b lang="en">${esc(speak)}</b>`+(li>=0?`（${esc(rdAbc(s[li]))}＝${esc(s[li])}）`:'')
  }else{
    /* -teen 和 -ty：15 和 50 */
    const T=[[13,30],[14,40],[15,50],[16,60],[17,70],[18,80],[19,90]];
    const k=Math.floor(Math.random()*T.length),pr=T[k],nb=T[(k+(Math.random()<.5?1:T.length-1))%T.length];
    const c=pr[Math.random()<.5?0:1];
    const tp=[[n=>`PDU-B3 is at ${n} percent load.`,n=>n+'%','PDU-B3 的負載是多少？'],[n=>`The vendor will arrive in ${n} minutes.`,n=>n+' 分鐘','廠商幾分鐘後到？'],[n=>`Phase A current is ${n} amps.`,n=>n+' A','A 相電流是多少？']][Math.floor(Math.random()*3)];
    opts=qShuffle([pr[0],pr[1],nb[0],nb[1]].map(tp[1]));
    ans=tp[1](c);
    speak=tp[0](c);
    head='📻 聽無線電：'+tp[2];
    note=`<b lang="en">${esc(speak)}</b><br><small>-teen（例如 fif-TEEN）重音在後面、尾音拉長；-ty（例如 FIF-ty）重音在前面。無線電上可以補一句 one-five 或 five-zero 確認。</small>`
  }
  $('#quizQ').innerHTML=`${head}<br><button id="quizReplay">🔊 再聽</button> <button id="quizSlow">🐢 慢速</button>`;
  $('#quizMsg').textContent='';
  $('#quizOpts').innerHTML=opts.map((o,k)=>`<button data-k="${k}" lang="en">${esc(o)}</button>`).join('');
  say(speak,.9);
  $('#quizReplay').onclick=()=>say(speak,.9);
  $('#quizSlow').onclick=()=>say(speak,.65);
  qPick(opts,k=>opts[k]===ans,ok=>{
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案：<b lang="en">'+esc(ans)+'</b>'}<br>${note}`
  })
}

/* ---------- 5. 發音辨別：成對練習（th／s、l／n、r／l、v／b、ship／sheep…） ---------- */
function pairsQuiz(){
  qCur='pairs';
  const P=window.PAIRS||[];
  if(!P.length){
    qEmpty('目前沒有發音辨別的題目');
    return
  }
  const pr=P[Math.floor(Math.random()*P.length)],tgt=pr[Math.random()<.5?0:1],opts=[pr[0],pr[1]];
  const ip=w=>{
    const x=WMAP[w];
    return x&&x.p?'/'+esc(phon(x.p))+'/':''
  },zh=w=>{
    const x=WMAP[w];
    return x?esc(String(x.zh).split('；')[0]):''
  };
  const lab=store.settings.phon==='kk'?pr[2].replace(/ər/g,'ɝ').replace(/ə/g,'ʌ'):pr[2];
  $('#quizQ').innerHTML=`👂 聽發音，選出你聽到的字 <small>（${esc(lab)}）</small><br><button id="quizReplay">🔊 再聽</button> <button id="quizSlow">🐢 慢速</button>`;
  $('#quizMsg').textContent='';
  $('#quizOpts').innerHTML=opts.map((w,k)=>`<button data-k="${k}" class="pair-opt" lang="en">${esc(w)}</button>`).join('');
  say(tgt,.85);
  $('#quizReplay').onclick=()=>say(tgt,.85);
  $('#quizSlow').onclick=()=>say(tgt,.6);
  qPick(opts,k=>opts[k]===tgt,ok=>{
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 你聽到的是 <b lang="en">'+esc(tgt)+'</b>'}<div class="pair-cmp">${opts.map(w=>`<div><span><b lang="en">${esc(w)}</b> ${ip(w)}<small>${zh(w)}</small></span><button data-psay="${esc(w)}" aria-label="播放 ${esc(w)}">🔊</button></div>`).join('')}</div>`
  })
}
$('#quizMsg').addEventListener('click',e=>{
  const b=e.target.closest('[data-psay]');
  if(b)say(b.dataset.psay,.8)
});
/* ===== V5.32.0 點字查詢補充（人名地名、補充字典、序數、字母、編號）、句子關鍵字、多益長例句分檔 ===== */
/* 句子關鍵字：從句子裡挑比較進階的字（職場字、排名較後的字）；開啟 App 建立句子清單時就會用到，所以不依賴後面才建立的變數 */
var KWM,KWX;
function kwMap(){
  if(KWM)return KWM;
  KWM=new Map();
  KWX=new Map();
  (window.WORDS||[]).forEach(x=>{
    const k=x.w.toLowerCase(),o=KWM.get(k);
    if(!o||(o.b&&!x.b))KWM.set(k,x);
    KWX.set(x.w,x)
  });
  return KWM
}
function kwDedupe(a){
  const l=a.map(k=>' '+String(k).toLowerCase()+' ');
  return a.filter((k,j)=>!l.some((o,m)=>m!==j&&o.length>l[j].length&&o.includes(l[j])))
}
function kwFill(toks,keys,max,ce,min){
  const M=kwMap(),have=new Set(),c=[];
  keys.forEach(k=>String(k).toLowerCase().split(/[\s-]+/).concat(String(k).toLowerCase()).forEach(x=>have.add(x)));
  const bad=/^(det|prep|pron|conj|aux|interj|contr|num)\./;
  toks.forEach(w0=>{
    const w=String(w0||'').toLowerCase().replace(/'s$/,'');
    if(!/^[a-z][a-z'-]*$/.test(w))return;
    let x=(/[A-Z]/.test(w0.slice(1))&&KWX.get(w0))||M.get(w);
    if(!x)for(const s of lkStems(w))if(M.get(s)){
      x=M.get(s);
      break
    }
    if(!x)return;
    if(x.b&&M.get(String(x.b).toLowerCase()))x=M.get(String(x.b).toLowerCase());
    const k=x.w.toLowerCase();
    if(have.has(k)||bad.test(x.pos||'')||(x.t||[]).includes('basic'))return;
    if(x.k===7&&!ce)return;
    const sc=x.k===7?20000:x.k===8?9000:x.r;
    if(sc<(min||900))return;
    have.add(k);
    c.push([sc,x.w])
  });
  c.sort((p,q)=>q[0]-p[0]).slice(0,Math.max(0,max-keys.length)).forEach(v=>keys.push(v[1]));
  return keys
}
/* 點字查詢：單字表找不到時，依序找人名地名、補充字典、序數、字母代號、編號 */
function lkGloss(q){
  const G=window.GLOSS||{},b=q.replace(/'s$/,'');
  if(G[q])return [q,G[q]];
  if(G[b])return [b,G[b]];
  for(const c of lkStems(b))if(G[c])return [c,G[c]];
  return null
}
function lkExtra(w,p,n,raw){
  const P=window.PROPER||{},q=w.replace(/'s$/,''),nb=(n||'').replace(/'s$/,'');
  const pr=(nb&&P[q+' '+nb])||(p&&P[p+' '+q])||P[q];
  if(pr)return {extra:{w:pr[0],tag:pr[1],zh:pr[2]}};
  const g=lkGloss(w);
  if(g)return {extra:{w:g[0],pos:g[1][0],zh:g[1][1],tag:'補充字',say:raw,note:g[0]!==q?'你點的是「'+raw+'」':''}};
  const ORD={first:'one',second:'two',third:'three',fifth:'five',eighth:'eight',ninth:'nine',twelfth:'twelve'};
  const ob=ORD[q]||(/ieth$/.test(q)?q.replace(/ieth$/,'y'):/th$/.test(q)?q.slice(0,-2):'');
  lkBuild();
  if(ob&&LK.get(ob)){
    const b=LK.get(ob),z=String(b.zh).split(/[；;（(]/)[0];
    return {extra:{w:raw,tag:'序數',zh:'第'+(/^[百千萬]$/.test(z)?'一'+z:z)+'（'+b.w+' 的序數）'}}
  }
  if(/^[b-hj-z]$/.test(q)){
    const R=window.RADIO||{},a=(R.abc||[]).find(v=>v[0].toLowerCase()===q),U=q.toUpperCase();
    return {extra:{w:U,tag:'字母',zh:'字母 '+U+'，常用來當代號（例如 '+U+' 路電源、'+U+' 機房）'+(a?'；無線電拼字念 '+a[1]:'')}}
  }
  if(/\d/.test(q)&&/[a-z]/.test(q))return {extra:{w:raw,tag:'編號',zh:'設備、零件、文件或位置的編號（不是英文單字）；用無線電報編號時，字母和數字一個一個念（例如 B12：Bravo、one、two）'}};
  return null
}
/* 多益長例句（data-ex2.js）：單字例句載入後才下載，第一次開啟、訊號差時，單字例句可以先用 */
var EX2_READY=false,EX2_FAIL=false;
function exOk(u){
  return u==='wt2'?EX2_READY:u==='every'?EX_READY&&EX2_READY:(EX_READY||!exNeeded(u))
}
function mergeEx2(ex2){
  if(EX2_READY||!ex2)return;
  WORDS.forEach(x=>{
    const e=ex2[x.w];
    if(e){
      x.ex2=e[0];
      x.exz2=e[1]
    }
  });
  let at=-1;
  ALLS.forEach((s,k)=>{
    if(s.src==='word')at=k
  });
  if(at<0){
    const f=ALLS.findIndex(s=>s.src!=='core');
    at=(f<0?ALLS.length:f)-1
  }
  ALLS.splice(at+1,0,...wordSents2());
  EX2_READY=true;
  EX2_FAIL=false;
  _sBy=null;
  updEveryLabel();
  const u=$('#unit').value;
  if((u==='wt2'||u==='every')&&!RP.on){
    if(u==='wt2'){
      i=(store.settings.pos&&store.settings.pos[u])||0;
      filter()
    }else refilter();
    if(REC.state==='idle'&&!VOICE.srBusy)render()
  }
  if(!$('#statsPage').hidden)renderStats()
}
function loadWordEx2(tries){
  tries=tries||0;
  if(EX2_READY||window.__ex2Loading)return;
  if(window.WORD_EX2){
    mergeEx2(window.WORD_EX2);
    return
  }
  window.__wordEx2=mergeEx2;
  window.__ex2Loading=true;
  const s=document.createElement('script');
  s.src='data-ex2.js';
  s.async=true;
  s.onload=()=>{
    window.__ex2Loading=false
  };
  s.onerror=()=>{
    s.remove();
    window.__ex2Loading=false;
    if(tries<3)setTimeout(()=>loadWordEx2(tries+1),1500*(tries+1));else{
      EX2_FAIL=true;
      try{
        updEveryLabel()
      }catch(e){}
    }
  };
  document.body.appendChild(s)
}
$('#unit').addEventListener('change',()=>{
  if($('#unit').value==='wt2'&&EX_READY)loadWordEx2(0)
});
/* ===== V5.32.0 🎤 逐字回饋、片語聽寫 ===== */
/* ---------- 1. 🎤 逐字回饋（句子頁、Role Play） ----------
   辨識結束後，句子的每個字標成念到（綠）或沒念到／聽錯（紅、波浪底線），另外聽到的字列在下面；點紅色的字聽發音，再點一次放慢。
   顏色和相似度用同一套斷字（scTok／scHeard：數字和英文數字、縮寫、a.m.／p.m.、連字號、大小寫、標點），綠色的字就是相似度算到的字；
   再用逐字對齊（編輯距離）找出紅字被聽成什麼、哪些是多出來的字。只用在 🎤 辨識結果，🎙 錄音不受影響。 */
/* 句子裡每個字（空白分開）對應到哪些評分用的字：逐字加長句子重新斷字，跨字合併（twenty five → 25、a. m. → am）也對得到 */
function swOwn(text){
  text=String(text||'');
  const words=[],re=/\S+/g;
  let m;
  while((m=re.exec(text)))words.push({w:m[0],s:m.index,e:m.index+m[0].length});
  let toks=[],own=[];
  words.forEach((w,i)=>{
    const now=scTok(text.slice(0,w.e));
    let c=0;
    while(c<toks.length&&c<now.length&&toks[c]===now[c])c++;
    const was=new Set([i]);
    for(let k=c;k<toks.length;k++)own[k].forEach(x=>was.add(x));
    const nown=own.slice(0,c);
    for(let k=c;k<now.length;k++)nown.push(new Set(was));
    if(now.length===c&&c<toks.length&&c>0)was.forEach(x=>nown[c-1].add(x));
    toks=now;
    own=nown
  });
  return {words,toks,own}
}
/* 逐項對齊（編輯距離）：回傳 [a 的位置, b 的位置]，-1 表示對到空位；dc＝略過 a 的代價、sc＝替換的代價 */
function e5Align(a,b,eq,dc,sc){
  const n=a.length,m=b.length,D=[];
  const del=x=>dc?dc(x):1,sub=(x,y)=>eq(a[x],b[y])?0:(sc?sc(x,y):1);
  for(let x=0;x<=n;x++)D.push(new Array(m+1).fill(0));
  for(let x=1;x<=n;x++)D[x][0]=D[x-1][0]+del(x-1);
  for(let y=1;y<=m;y++)D[0][y]=y;
  for(let x=1;x<=n;x++)for(let y=1;y<=m;y++)D[x][y]=Math.min(D[x-1][y-1]+sub(x-1,y-1),D[x-1][y]+del(x-1),D[x][y-1]+1);
  const out=[];
  let x=n,y=m;
  while(x>0||y>0){
    if(x>0&&y>0&&Math.abs(D[x][y]-D[x-1][y-1]-sub(x-1,y-1))<1e-9){
      out.push([x-1,y-1]);
      x--;
      y--
    }else if(x>0&&(y===0||Math.abs(D[x][y]-D[x-1][y]-del(x-1))<1e-9)){
      out.push([x-1,-1]);
      x--
    }else{
      out.push([-1,y-1]);
      y--
    }
  }
  return out.reverse()
}
/* 點紅字時念的字：去掉前後標點（a.m. 這類縮寫保留句點） */
function swSay(w){
  let s=String(w).replace(/^[^A-Za-z0-9]+/,'').replace(/[^A-Za-z0-9.]+$/,'');
  if(!/^(?:[A-Za-z]\.){2,}$/.test(s))s=s.replace(/\.+$/,'');
  return s||String(w)
}
/* Role Play「自由回答」：句子裡的重點句型（一定要念到的字）用黃底標出 */
function swKeyWords(T){
  try{
    if(!RP.on||rpLevel()!=='free')return null;
    const k=rpKey(RP.d,RP.n);
    if(!k)return null;
    const kt=rpNormTxt(k.en).split(' ').filter(Boolean),parts=[];
    T.words.forEach((w,i)=>rpNormTxt(w.w).split(' ').filter(Boolean).forEach(p=>parts.push([p,i])));
    for(let s=0;s+kt.length<=parts.length;s++){
      if(kt.length&&kt.every((t,j)=>parts[s+j][0]===t)){
        const r=new Set();
        for(let j=0;j<kt.length;j++)r.add(parts[s+j][1]);
        return r
      }
    }
  }catch(e){}
  return null
}
function swFeedback(en,heard,score){
  const T=swOwn(en),HD=swOwn(heard),H=scHeard(heard),a=T.toks,hs=HD.toks;
  /* 和 scMatch 相同：句子裡的字在辨識結果（含合併後的字）裡就算念到 */
  const hit=a.map(x=>H.has(x));
  /* 聽到的字有沒有用上：本身在句子裡，或和旁邊的字合起來在句子裡（U P S、b 3、215 → 2 15） */
  const want=new Set(a),used=hs.map(h=>want.has(h)),nz=x=>/^\d+$/.test(x)?String(parseInt(x,10)):x;
  for(let k=0;k+1<hs.length;k++)if(want.has(nz(hs[k]+hs[k+1])))used[k]=used[k+1]=true;
  for(let k=0;k<hs.length;k++){
    if(hs[k].length!==1)continue;
    let j=k,s='';
    while(j<hs.length&&hs[j].length===1){
      s+=hs[j];
      j++
    }
    if(j-k>=2&&want.has(nz(s)))for(let q=k;q<j;q++)used[q]=true;
    k=j-1
  }
  hs.forEach((h,k)=>{
    if(/^\d{3,4}$/.test(h)&&(want.has(h.slice(0,-2).replace(/^0+(?=\d)/,''))||want.has(String(+h.slice(-2)))))used[k]=true
  });
  /* 沒念到的字：對齊後同一個位置聽到的字（聽成） */
  const as=new Map();
  e5Align(a,hs,(x,y)=>x===y).forEach(([x,y])=>{
    if(x>=0&&y>=0&&!hit[x]&&!used[y])as.set(x,y)
  });
  const st=T.words.map(()=>({n:0,miss:0,as:[]}));
  T.own.forEach((ow,k)=>ow.forEach(i=>{
    const s=st[i];
    s.n++;
    if(hit[k])return;
    s.miss++;
    if(as.has(k))HD.own[as.get(k)].forEach(j=>{
      const w=HD.words[j].w;
      if(!s.as.includes(w))s.as.push(w)
    })
  }));
  const key=swKeyWords(T);
  let line='',last=0,nMiss=0,kMiss=0;
  T.words.forEach((w,i)=>{
    line+=esc(en.slice(last,w.s));
    last=w.e;
    const s=st[i],kc=key&&key.has(i)?' sw-key':'';
    if(kc&&!key.has(i-1))line+='<span class="sw-keyrun"><span class="e5-sr" lang="zh-Hant">重點句型：</span>';
    if(!s.n)line+=kc?`<span class="sw-key">${esc(w.w)}</span>`:esc(w.w);
    else if(!s.miss)line+=`<span class="sw-ok${kc}">${esc(w.w)}</span>`;
    else{
      nMiss++;
      if(kc)kMiss++;
      const say=swSay(w.w),hd=s.as.join(' ');
      line+=`<button type="button" class="sw-miss${kc}" data-sw="${esc(say)}" aria-label="${esc('沒念到：'+say+(hd?'（聽成 '+hd+'）':'')+'，點一下聽發音')}">${esc(w.w)}</button>`
    }
    if(kc&&!key.has(i+1))line+='</span>'
  });
  const ex=[];
  HD.words.forEach((w,i)=>{
    let n=0,u=0;
    HD.own.forEach((ow,k)=>{
      if(!ow.has(i))return;
      n++;
      if(used[k])u++
    });
    if(n&&!u&&!ex.includes(w.w))ex.push(w.w)
  });
  /* 自由回答：重點句型（黃底）一定要念到，其他字可以用自己的話說 */
  const note=!key?'紅色的字再練一次（點紅色的字聽發音，再點一次放慢）':kMiss?'自由回答：黃底的重點句型一定要念到，紅色的字再練一次（點紅色的字聽發音）':'自由回答：黃底的重點句型都念到了，其他字可以用自己的話說（點紅色的字聽發音）';
  return `<div class="sw-line" lang="en">${line}</div><b>相似度 ${score}%</b>`+(nMiss?`<br><small class="sw-note">${note}</small>`:a.length?'<br><small>👍 全部都有念到！</small>':'')+(ex.length?`<br><small class="sw-extra">另外聽到：<span lang="en">${esc(ex.slice(0,8).join('、'))}${ex.length>8?'…':''}</span></small>`:'')+`<br><small class="muted">辨識到：${esc(heard)}</small>`
}
var SW_TAP={w:'',t:0,n:0};
$('#result').addEventListener('click',e=>{
  const b=e.target.closest('[data-sw]');
  if(!b)return;
  const w=b.dataset.sw,now=Date.now();
  SW_TAP.n=SW_TAP.w===w&&now-SW_TAP.t<8000?SW_TAP.n+1:0;
  SW_TAP.w=w;
  SW_TAP.t=now;
  /* Role Play 連續模式：點紅字練習時先不要自動跳下一句 */
  try{
    if(RP.on&&RP.autoT){
      clearTimeout(RP.autoT);
      RP.autoT=null;
      document.querySelectorAll('#result small').forEach(s=>{
        if(/自動下一句/.test(s.textContent))s.textContent='⏸ 已暫停自動下一句：練好後按「下一句 →」'
      })
    }
  }catch(err){}
  document.querySelectorAll('#result .sw-on').forEach(x=>x.classList.remove('sw-on'));
  b.classList.add('sw-on');
  say(w,SW_TAP.n%2?.6:1,1,()=>b.classList.remove('sw-on'))
});

/* ---------- 2. 片語聽寫（拼字） ----------
   聽片語（🔊 一般、🐢 慢速；出題時自動念一次），看中文提示，輸入聽到的片語（Enter 送出；「不會，看答案」直接看答案）。
   不分大小寫，多的空白、標點、彎引號都不影響；fill someone in 這類有代換字的片語寫 fill me in 或 fill in 都算對；be good at 可以不寫 be。
   答錯時標出漏寫、拼錯的字母和多寫的字。結果記在「片語：聽寫拼字」（qStat 'p-dict'），答錯的片語收進錯題本（store.phWrong：片語 id → 答錯次數），
   錯題本有「片語聽寫」清單、聽寫練習，混合練習也會出聽寫題；答對 1 次移出。 */
var PD={last:null,wrongOnly:false,kT:0};
var PH_BY=Object.create(null);
PHRASES.forEach(x=>{
  PH_BY[x.id]=x
});
function pdNorm(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘‛ʼ`´′]/g,"'").replace(/'/g,'').replace(/[^a-z0-9]+/g,' ').trim()
}
/* 比較寫法用（保留撇號、連字號）：答對但寫法和標準不同時，提示標準寫法 */
function pdStd(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘‛ʼ`´′]/g,"'").replace(/[^a-z0-9'\- ]+/g,' ').replace(/\s+/g,' ').trim()
}
var PD_SLOT=Object.assign(Object.create(null),{someone:'p',somebody:'p',sb:'p',something:'t',sth:'t',"one's":'o',"someone's":'o',"somebody's":'o',"sb's":'o',oneself:'r'});
var PD_ALT={p:['someone','somebody','sb','me','you','him','her','us','them'],t:['something','sth','it','this','that','them'],o:['ones','someones','somebodys','sbs','my','your','his','her','our','their','its'],r:['oneself','myself','yourself','himself','herself','ourselves','themselves','itself']};
/* 片語 → 比對樣式：(to) 可省略、in/on 擇一、someone 等代換字可省略或換成代名詞、開頭的 be 可省略 */
function pdPat(p){
  const raw=String(p||'').trim().split(/\s+/),E=[];
  raw.forEach((r,k)=>{
    let opt=false;
    if(/^\(.+\)$/.test(r)){
      opt=true;
      r=r.slice(1,-1)
    }
    const lw=r.toLowerCase().replace(/[’‘]/g,"'"),slot=PD_SLOT[lw];
    if(slot){
      E.push({d:r,opt:true,slot:true,alts:PD_ALT[slot].map(v=>[v])});
      return
    }
    if(k===0&&lw==='be'&&raw.length>1){
      E.push({d:r,opt:true,alts:[['be']]});
      return
    }
    const alts=r.split('/').map(pdNorm).filter(Boolean).map(v=>v.split(' '));
    if(alts.length)E.push({d:r,opt,alts})
  });
  return E
}
function pdMatch(E,U){
  const memo=new Map();
  const go=(e,u)=>{
    if(e===E.length)return u===U.length;
    const k=e+','+u;
    if(memo.has(k))return memo.get(k);
    const el=E[e];
    const r=(el.opt&&go(e+1,u))||el.alts.some(v=>v.every((t,j)=>U[u+j]===t)&&go(e+1,u+v.length));
    memo.set(k,r);
    return r
  };
  return go(0,0)
}
function pdCheck(x,typed){
  const U=pdNorm(typed).split(' ').filter(Boolean);
  return U.length>0&&pdMatch(pdPat(x.p),U)
}
/* 顯示用的字：空白、連字號分開，保留原本的大小寫和撇號 */
function pdCanon(p){
  const out=[];
  pdPat(p).forEach(el=>String(el.d).split('-').forEach((t,j)=>{
    const n=pdNorm(t);
    if(n)out.push({d:t,n,sep:j?'-':' ',opt:el.opt,alts:el.slot?new Set(el.alts.map(v=>v[0])):null})
  }));
  return out
}
function pdTyped(s){
  const out=[];
  String(s||'').normalize('NFKC').trim().split(/\s+/).forEach(w=>w.split('-').forEach((t,j)=>{
    const n=pdNorm(t);
    if(n)out.push({d:t,n,sep:j?'-':' '})
  }));
  return out
}
function pdLev(a,b){
  const d=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){
    let p=d[0];
    d[0]=i;
    for(let j=1;j<=b.length;j++){
      const t=d[j];
      d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));
      p=t
    }
  }
  return d[b.length]
}
/* 一個字的字母比對：正確寫法裡漏掉或寫錯的字母（紅底）、你寫的字裡多的或錯的字母（刪除線） */
function pdCharDiff(c,t){
  const A=[...c],B=[...t],n=A.length,m=B.length,k=ch=>ch.toLowerCase().replace(/[’‘]/g,"'"),L=[];
  for(let i=0;i<=n;i++)L.push(new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=k(A[i])===k(B[j])?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const ka=new Array(n).fill(false),kb=new Array(m).fill(false);
  let i=0,j=0;
  while(i<n&&j<m){
    if(k(A[i])===k(B[j])){
      ka[i]=kb[j]=true;
      i++;
      j++
    }else if(L[i+1][j]>=L[i][j+1])i++;
    else j++
  }
  const h=(X,keep,cls)=>{
    let o='',run='';
    const flush=()=>{
      if(run)o+=`<b class="${cls}">${esc(run)}</b>`;
      run=''
    };
    X.forEach((ch,q)=>{
      if(!keep[q]&&/[A-Za-z0-9]/.test(ch))run+=ch;
      else{
        flush();
        o+=esc(ch)
      }
    });
    flush();
    return o
  };
  return [h(A,ka,'pd-need'),h(B,kb,'pd-wrong')]
}
/* 答錯時的比對：上面一行是正確寫法（漏寫的字紅色波浪線、拼錯的字母紅底），下面一行是你寫的（多寫的字、錯的字母刪除線） */
function pdDiff(p,typed){
  const C=pdCanon(p),T=pdTyped(typed),eq=(c,t)=>c.n===t.n||!!(c.alts&&c.alts.has(t.n));
  const al=e5Align(C,T,eq,x=>C[x].opt?.01:1,(x,y)=>{
    const a=C[x].n,b=T[y].n;
    return .5+.5*Math.min(1,pdLev(a,b)/Math.max(a.length,b.length,1))
  });
  const cr=[],tr=[],miss=[],fix=[],extra=[];
  al.forEach(([x,y])=>{
    const c=x>=0?C[x]:null,t=y>=0?T[y]:null;
    if(c&&t){
      if(eq(c,t)){
        cr.push([c.sep,`<span class="pd-w pd-ok">${esc(c.d)}</span>`]);
        tr.push([t.sep,`<span class="pd-w pd-ok">${esc(t.d)}</span>`])
      }else{
        const [hc,ht]=pdCharDiff(c.d,t.d);
        cr.push([c.sep,`<span class="pd-w pd-fix">${hc}</span>`]);
        tr.push([t.sep,`<span class="pd-w pd-bad">${ht}</span>`]);
        fix.push(c.d+'（你寫 '+t.d+'）')
      }
    }else if(c){
      if(c.opt)cr.push([c.sep,`<span class="pd-w pd-opt">${esc(c.d)}</span>`]);
      else{
        cr.push([c.sep,`<span class="pd-w pd-miss">${esc(c.d)}</span>`]);
        tr.push([' ','<span class="pd-w pd-gap" aria-hidden="true">___</span>']);
        miss.push(c.d)
      }
    }else{
      tr.push([t.sep,`<s class="pd-w pd-x">${esc(t.d)}</s>`]);
      extra.push(t.d)
    }
  });
  const join=v=>v.map((q,k)=>(k?(q[0]==='-'?'-':' '):'')+q[1]).join('');
  const sr=[miss.length?'漏寫：'+miss.join('、'):'',fix.length?'拼錯：'+fix.join('、'):'',extra.length?'多寫：'+extra.join('、'):''].filter(Boolean).join('；');
  return `<div class="pd-diff"><div class="pd-l"><span class="pd-lab">正確</span><span class="pd-ws" lang="en">${join(cr)}</span></div><div class="pd-l"><span class="pd-lab">你寫</span><span class="pd-ws" lang="en">${join(tr)}</span></div></div><small class="pd-legend">紅色是漏寫或拼錯的地方，刪除線是多寫的</small>`+(sr?`<span class="e5-sr">${esc(sr)}</span>`:'')
}
/* 出題時自動念一次：瀏覽器不能朗讀時不念；store.settings.mute 是之後「靜音」設定預留的位置 */
function pdAutoOK(){
  return TTS_OK&&!(store.settings&&store.settings.mute===true)
}
/* 答錯的片語（只有作答時才建立 store.phWrong；讀取時不改動學習紀錄） */
function pdWrongMap(){
  const w=store.phWrong;
  if(!w||typeof w!=='object'||Array.isArray(w))store.phWrong={};
  return store.phWrong
}
function pdWrongItems(){
  const w=store.phWrong,out=[];
  if(!w||typeof w!=='object'||Array.isArray(w))return out;
  Object.keys(w).forEach(k=>{
    const x=PH_BY[k],n=Math.floor(+w[k]);
    if(x&&n>0)out.push({k:'pd:'+x.id,id:x.id,n,x})
  });
  return out.sort((p,q)=>q.n-p.n)
}
function pdRecord(x,ok){
  store[ok?'quizRight':'quizWrong']=(store[ok?'quizRight':'quizWrong']||0)+1;
  qStat('p-dict',ok);
  const w=pdWrongMap();
  let note='';
  if(ok){
    if(w[x.id]!=null){
      delete w[x.id];
      note='已從「📕 錯題本」移除'
    }
  }else{
    w[x.id]=(Math.floor(+w[x.id])||0)+1;
    note='已加入「📕 錯題本」的片語聽寫';
    if((store.phKnown||[]).includes(x.id)){
      store.pDue=store.pDue||{};
      store.pStage=store.pStage||{};
      store.pDue[x.id]=day();
      store.pStage[x.id]=1;
      note+='；這個片語你標過「已會」，也排入今天的片語複習'
    }
  }
  bumpLog('quiz');
  markStudy();
  save();
  return note
}
/* 小手機：輸入框和按鈕要在螢幕鍵盤、底部選單（或今日學習進度列）上方 */
function pdKeep(){
  const f=$('#pdForm');
  if(!f||$('#quiz').hidden)return;
  const vv=window.visualViewport,vt=vv?vv.offsetTop:0,vb=vv?vv.offsetTop+vv.height:innerHeight;
  const lim=Math.min(bottomLimit(),vb)-8,r=f.getBoundingClientRect();
  let dy=0;
  if(r.bottom>lim)dy=r.bottom-lim;
  else if(r.top<vt+8)dy=r.top-vt-8;
  if(dy)window.scrollBy(0,Math.round(dy))
}
(function(){
  const k=()=>{
    const a=document.activeElement;
    if(a&&a.id==='pdIn'){
      clearTimeout(PD.kT);
      PD.kT=setTimeout(pdKeep,80)
    }
  };
  if(window.visualViewport)window.visualViewport.addEventListener('resize',k);
  window.addEventListener('resize',k)
})();
function pdQuiz(fx){
  qCur='';
  const wrongOnly=!fx&&PD.wrongOnly&&$('#quizType').value==='phrase'&&$('#quizMode').value==='dict';
  let pool=PHRASES;
  if(wrongOnly){
    pool=pdWrongItems().map(o=>o.x);
    if(!pool.length){
      PD.wrongOnly=false;
      qEmpty('🎉 答錯的片語聽寫都練完了！<br><button type="button" id="pdAll" class="primary pd-mini">改練全部片語</button>');
      $('#pdAll').onclick=()=>runQuiz();
      return
    }
  }
  if(!fx&&!pool.length){
    qEmpty('目前沒有片語');
    return
  }
  let x=fx||pool[Math.floor(Math.random()*pool.length)];
  if(!fx&&pool.length>1&&x.id===PD.last)x=pool[(pool.indexOf(x)+1)%pool.length];
  PD.last=x.id;
  const nW=String(x.p).trim().split(/\s+/).length;
  $('#quizQ').innerHTML=(wrongOnly?`<small class="muted wb-tag">📕 只練答錯的片語（剩 ${pool.length} 題） <button type="button" id="pdAll" class="mini pd-mini">改練全部</button></small><br>`:'')+`<span class="pd-head">🎧 片語聽寫：聽發音，寫出片語</span><span class="pd-play"><button type="button" id="pdPlay">🔊 再聽</button><button type="button" id="pdSlow">🐢 慢速</button></span><small class="pd-hint">提示：${esc(x.zh)}（${nW} 個字）</small>`+(TTS_OK?'':'<small class="pd-hint">⚠️ 這個瀏覽器不能朗讀英文，請改用 Safari 或 Chrome 開啟。</small>');
  $('#quizOpts').onclick=null;
  $('#quizOpts').innerHTML=`<div id="pdForm" class="pd-form"><input id="pdIn" type="text" lang="en" maxlength="120" placeholder="輸入聽到的片語" aria-label="聽寫答案：輸入聽到的英文片語" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><div class="pd-btns"><button type="button" id="pdGo" class="primary">確認</button><button type="button" id="pdGive">不會，看答案</button></div></div>`;
  $('#quizMsg').textContent='';
  const inp=$('#pdIn'),go=$('#pdGo'),give=$('#pdGive'),all=$('#pdAll');
  let done=false;
  $('#pdPlay').onclick=()=>say(x.p,.9);
  $('#pdSlow').onclick=()=>say(x.p,.6);
  if(all)all.onclick=()=>{
    PD.wrongOnly=false;
    runQuiz()
  };
  const finish=(typed,gave)=>{
    if(done)return;
    done=true;
    const t=String(typed||'').trim(),ok=!gave&&pdCheck(x,t);
    inp.disabled=go.disabled=give.disabled=true;
    const note=pdRecord(x,ok);
    let h;
    if(ok)h=`✅ 答對了！ <b lang="en">${esc(x.p)}</b>｜${esc(x.zh)}`+(pdStd(t)!==pdStd(x.p)?`<br><small>你寫的「<span lang="en">${esc(t)}</span>」也算對；標準寫法是 <b lang="en">${esc(x.p)}</b>。</small>`:'');
    else h=`❌ 正確答案：<b lang="en">${esc(x.p)}</b>｜${esc(x.zh)}`+(gave||!pdNorm(t)?'<br><small>這題先記下來，之後再練。</small>':pdDiff(x.p,t));
    $('#quizMsg').innerHTML=h+`<br><small lang="en">${esc(x.ex)}</small><br><small>${esc(x.exz)}</small>`+(note?`<br><small>${esc(note)}</small>`:'');
    say(x.p,.9);
    try{
      $('#newQuiz').focus({preventScroll:true})
    }catch(e){}
  };
  go.onclick=()=>{
    if(done)return;
    if(!pdNorm(inp.value)){
      $('#quizMsg').textContent='✏️ 先輸入聽到的片語；不會的話按「不會，看答案」。';
      try{
        inp.focus({preventScroll:true})
      }catch(e){}
      return
    }
    finish(inp.value,false)
  };
  give.onclick=()=>finish(inp.value,true);
  inp.onkeydown=e=>{
    if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){
      e.preventDefault();
      go.click()
    }
  };
  inp.addEventListener('focus',()=>{
    clearTimeout(PD.kT);
    PD.kT=setTimeout(pdKeep,350)
  });
  if(pdAutoOK())say(x.p,.9);
  setTimeout(()=>{
    if(!document.body.contains(inp)||inp.disabled||$('#quiz').hidden)return;
    try{
      inp.focus({preventScroll:true})
    }catch(e){}
    pdKeep()
  },0)
}
/* 錯題本：片語聽寫清單 */
function pdWbHtml(D){
  const L=D.phr||[];
  if(!L.length)return '';
  return `<h3>片語聽寫（${L.length}）<button class="mini" data-wbgo="pd">聽寫練習</button></h3><div class="wb-list">${L.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b lang="en">${esc(o.x.p)}</b><small>${esc(o.x.zh)}</small></span><small class="wb-n">錯 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.x.p)}" aria-label="播放 ${esc(o.x.p)}">🔊</button><button class="mini" data-wbdel="p|${o.id}" aria-label="移除 ${esc(o.x.p)}">✕</button></div>`).join('')}</div>`+(L.length>50?`<p class="muted">…還有 ${L.length-50} 項（練習時都會出現）</p>`:'')
}
/* 錯題本的數量也算片語聽寫（今日頁、統計頁、混合練習都用 wbData） */
var _wbDataV532=wbData;
wbData=function(){
  const D=_wbDataV532();
  D.phr=pdWrongItems();
  D.total+=D.phr.length;
  return D
};
function pdWrongGo(){
  page('quiz');
  $('#quizType').value='phrase';
  $('#quizMode').value='dict';
  PD.wrongOnly=true;
  $('#quizType').onchange()
}
/* 自己換測驗類型或出題方式：不再只練答錯的片語 */
document.addEventListener('change',e=>{
  const id=e.target&&e.target.id;
  if(id==='quizType'||id==='quizMode')PD.wrongOnly=false
},true);
/* ===== V5.32.0 今日學習自訂、每週摘要、儲存空間與備份提醒、Role Play 複習 ===== */
/* 注意：開啟 App 時第一次 renderToday() 比這一段先執行；這裡的函式宣告會被提前建立，那時就會用到，
   所以函式裡只用前面已經建立的變數。這一段的 var 在那之前是 undefined（例如 FCG_OPEN）。 */

/* ---------- 共用：日期 ---------- */
function v532Ymd(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function v532IsoDay(iso){
  if(typeof iso!=='string')return '';
  const d=new Date(iso);
  return isNaN(d)?'':v532Ymd(d)
}
/* a 到 b 相隔幾天（YYYY-MM-DD） */
function v532Diff(a,b){
  const x=Date.parse(a+'T00:00:00'),y=Date.parse(b+'T00:00:00');
  return isNaN(x)||isNaN(y)?null:Math.round((y-x)/864e5)
}
function v532MD(ymd){
  const m=/^\d{4}-(\d{2})-(\d{2})/.exec(ymd||'');
  return m?(+m[1])+'/'+(+m[2]):''
}

/* ---------- 讀取／匯入學習紀錄時整理新欄位（由 normStore 呼叫；開啟 App 時很早就執行，只用 _isObj、_date） ---------- */
function v532Norm(s){
  try{
    if(s.rpSched!=null){
      const o={},num=(x,lo,hi)=>{
        x=Number(x);
        return isFinite(x)?Math.min(hi,Math.max(lo,Math.round(x))):undefined
      };
      if(_isObj(s.rpSched))Object.keys(s.rpSched).forEach(id=>{
        const v=s.rpSched[id],due=_isObj(v)&&_date(v.due);
        if(!/^d\d{2,3}$/.test(id)||!due)return;
        const r={due,iv:num(v.iv,1,60)||1,last:_date(v.last)||due,best:num(v.best,0,100)||0,n:num(v.n,0,1e6)||0,me:v.me==='A'?'A':'B'};
        const sc=num(v.sc,0,100),piv=num(v.piv,0,60);
        if(sc!==undefined)r.sc=sc;
        if(piv!==undefined)r.piv=piv;
        o[id]=r
      });
      s.rpSched=o
    }
    if(s.lastBackupAt!=null&&!(typeof s.lastBackupAt==='string'&&s.lastBackupAt.length<40&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s.lastBackupAt)&&!isNaN(Date.parse(s.lastBackupAt))))delete s.lastBackupAt;
    const st=s.settings;
    if(st.bkLater!=null){
      const d=_date(st.bkLater);
      if(d)st.bkLater=d;else delete st.bkLater
    }
    if(st.flowCfg!=null){
      const c=st.flowCfg,r={},ok=flowCfgOk();
      if(_isObj(c))Object.keys(ok).forEach(k=>{
        if(typeof c[k]==='number'&&ok[k].includes(c[k]))r[k]=c[k]
      });
      if(Object.keys(r).length)st.flowCfg=r;else delete st.flowCfg
    }
  }catch(e){}
}

/* ---------- 項目 5：一鍵今日學習可以自訂步驟和數量 ----------
   store.settings.flowCfg 只存跟預設不同的項目：rev 複習單字（1 開／0 關）、new 學新單字（沒設定＝跟「每日新字」）、
   sent 句子跟讀、situ CE 情境題、ph 片語、radio 無線電用語、rp Role Play。沒有任何設定時完全照原本的預設。 */
function flowCfgOk(){
  return {rev:[0,1],new:[0,10,20,30,50],sent:[0,5,10],situ:[0,1,3],ph:[0,5,10],radio:[0,5],rp:[0,1]}
}
function flowCfgOn(){
  const c=store.settings&&store.settings.flowCfg;
  return _isObj(c)&&Object.keys(c).length>0
}
function flowCfgGet(){
  const c=store.settings&&_isObj(store.settings.flowCfg)?store.settings.flowCfg:{},ok=flowCfgOk();
  const pick=(k,def)=>ok[k].includes(c[k])?c[k]:def;
  return {rev:c.rev===0?0:1,new:ok.new.includes(c.new)?c.new:null,sent:pick('sent',5),situ:pick('situ',1),ph:pick('ph',0),radio:pick('radio',0),rp:pick('rp',0)}
}
function flowHasRadio(){
  return !!(window.RADIO&&Array.isArray(window.RADIO.sent)&&window.RADIO.sent.length)
}
/* 順序：複習單字 → 學新單字 → 片語 → 句子跟讀 → 無線電用語 → CE 情境題 → Role Play */
function flowPlanCfg(){
  const c=flowCfgGet(),L=todayLog(),st=[];
  if(c.rev){
    const cap=reviewCap(),due=WORDS.filter(x=>isDue(x.w)).length;
    const rv=Math.min(REVIEW_BATCH,due,cap?Math.max(0,cap-(L.review||0)):due);
    if(rv>0)st.push({k:'review',n:rv})
  }
  const g=c.new==null?(store.settings.dailyGoal||20):c.new,nw=Math.max(0,g-(L.new||0));
  if(nw>0)st.push({k:'new',n:nw});
  if(c.ph&&PHRASES.length)st.push({k:'ph',n:c.ph});
  if(c.sent)st.push({k:'sent',n:c.sent});
  if(c.radio&&flowHasRadio())st.push({k:'radio',n:c.radio});
  if(c.situ)st.push({k:'situ',n:c.situ});
  if(c.rp&&DIALOGS.length)st.push({k:'rp',n:1});
  return st
}
/* 每一步今天做了多少（舊的每日紀錄沒有新的計數也可以）
   片語：標記已會＋複習到期片語；無線電：無線電句子按「✓ 我會說了」＋🎤 念對（90% 以上）＋聽代號測驗作答；Role Play：演完的段數 */
function flowVal(k,L){
  L=L||{};
  const n=v=>typeof v==='number'&&isFinite(v)?v:0;
  if(k==='sent')return n(L.sent)+n(L.shadow);
  if(k==='ph')return n(L.ph)+n(L.prev);
  if(k==='radio')return (Array.isArray(L.sentIds)?L.sentIds.filter(x=>/^r:/.test(String(x))).length:0)+n(L.rsay)+n(L.rquiz);
  return n(L[k])
}
function flowBase(L){
  const b={};
  ['review','new','sent','situ','ph','radio','rp'].forEach(k=>{
    b[k]=flowVal(k,L)
  });
  return b
}
/* 這一步已經沒有東西可以做（自動跳過）：片語都會了也沒有到期的；沒有無線電句子；沒有對話 */
function flowNothing(k){
  if(k==='ph'){
    const pk=cset('phKnown');
    return !PHRASES.some(x=>!pk.has(x.id)||isPDue(x.id))
  }
  if(k==='radio')return !flowHasRadio();
  if(k==='rp')return !DIALOGS.length;
  return false
}
/* 按鈕上的數量：複習、新字一定顯示；其他步驟跟預設不同時才顯示（預設的文字和原本一樣） */
function flowAmt(s){
  const D={sent:5,situ:1,rp:1};
  return s.k==='review'||s.k==='new'||D[s.k]!==s.n?' '+s.n:''
}
function flowSec(k){
  return {review:15,new:18,sent:36,situ:60,ph:24,radio:30,rp:360}[k]||30
}
/* 預估分鐘（預設：複習 20、新字 20、句子 5、情境題 1 ≈ 15 分鐘） */
function flowMin(p){
  return Math.max(1,Math.round(p.reduce((t,s)=>t+s.n*flowSec(s.k),0)/60))
}
function flowEstText(p){
  return p.length?`預估約 <b>${flowMin(p)}</b> 分鐘：${esc(p.map(s=>flowLabel(s.k)[1]+flowAmt(s)).join(' → '))}`:'目前的設定今天沒有要做的項目。'
}
function flowEmptyHtml(){
  let fd='';
  try{
    fd=localStorage.getItem('e5k_flow_done')
  }catch(e){}
  const dn=fd===day();
  return `<button class="wide flow-start${dn?' flow-done':''}" data-go="flowset">${dn?'✅ 今天的學習完成了':'▶ 開始今天的學習'}<small>目前的設定今天沒有要做的項目，點這裡調整</small></button>`
}
var FCG_OPEN=false;
function flowCfgHtml(){
  const on=flowCfgOn(),open=!!FCG_OPEN;
  let h=`<div class="fcg-bar"><button type="button" class="mini fcg-t${on?' on':''}" data-go="flowcfg" aria-expanded="${open}">⚙️ 調整今日學習${on?' ●':''}</button></div>`;
  if(!open)return h;
  const c=flowCfgGet(),g=+store.settings.dailyGoal||20,p=flowPlan(),act=!!(FLOW&&FLOW.i<FLOW.steps.length);
  const sel=(k,ic,lab,vals,cur)=>`<label class="fcg-row"><span>${ic} ${lab}</span><select data-fc="${k}" aria-label="${lab}">${vals.map(([v,t])=>`<option value="${v}"${v===cur?' selected':''}>${t}</option>`).join('')}</select></label>`;
  const nv=[...new Set([0,10,20,30,g])].sort((a,b)=>a-b).map(v=>[v,v===0?'不學':v===g?v+' 個（每日新字）':v+' 個']);
  h+=`<div class="fcg" role="group" aria-label="調整今日學習"><b class="fcg-h">今天要做哪些、做多少</b>`+
    sel('rev','🔁','複習單字',[[1,'開（最多 20 個）'],[0,'關']],c.rev)+
    sel('new','🆕','學新單字',nv,c.new==null?g:c.new)+
    sel('ph','💬','片語',[[0,'不做'],[5,'5 個'],[10,'10 個']],c.ph)+
    sel('sent','🗣','句子跟讀',[[0,'不做'],[5,'5 句'],[10,'10 句']],c.sent)+
    (flowHasRadio()?sel('radio','📻','無線電用語',[[0,'不做'],[5,'5 句／題']],c.radio):'')+
    sel('situ','🏭','CE 情境題',[[0,'不做'],[1,'1 題'],[3,'3 題']],c.situ)+
    (DIALOGS.length?sel('rp','🎭','Role Play',[[0,'不做'],[1,'1 段（優先複習到期的）']],c.rp):'')+
    `<p class="fcg-est">${flowEstText(p)}</p>`+
    (act?'<p class="muted fcg-note">進行中的今日學習不變；新的設定從下一次「開始今天的學習」起套用。</p>':'')+
    '<div class="fcg-btns"><button type="button" data-go="flowreset">恢復預設</button><button type="button" class="primary" data-go="flowcfg">完成</button></div></div>';
  return h
}
function flowCfgSet(k,v){
  const ok=flowCfgOk(),D={rev:1,sent:5,situ:1,ph:0,radio:0,rp:0};
  if(!ok[k]||!ok[k].includes(v))return;
  const st=store.settings,c=_isObj(st.flowCfg)?Object.assign({},st.flowCfg):{};
  if(k==='new'?v===(+st.dailyGoal||20):v===D[k])delete c[k];else c[k]=v;
  if(Object.keys(c).length)st.flowCfg=c;else delete st.flowCfg;
  save()
}
function flowCfgRefresh(){
  const b=$('#todayBody .flow-start');
  if(b)b.outerHTML=flowBtnHtml();
  const e=$('#todayBody .fcg-est');
  if(e)e.innerHTML=flowEstText(flowPlan());
  const t=$('#todayBody .fcg-t'),on=flowCfgOn();
  if(t){
    t.textContent='⚙️ 調整今日學習'+(on?' ●':'');
    t.classList.toggle('on',on)
  }
}
/* 做完一輪：記在每日紀錄（flow），每週摘要用；同一輪只記一次 */
function flowMarkDone(){
  if(!FLOW||FLOW.rec)return;
  FLOW.rec=1;
  flowSave();
  try{
    localStorage.setItem('e5k_flow_done',day())
  }catch(e){}
  bumpLog('flow')
}
function flowCurK(){
  return FLOW&&FLOW.day===day()&&FLOW.i<FLOW.steps.length?FLOW.steps[FLOW.i].k:''
}
/* 自訂了新字數量：單字卡改成這一步還要學的數量（沒有自訂時和原本一樣，照「每日新字」） */
function flowFitCards(){
  const s=FLOW&&FLOW.steps[FLOW.i];
  if(!s||s.k!=='new'||$('#wordCard').hidden||!cardPool.length)return;
  const want=Math.max(0,s.n-flowProg(s));
  if(!want||want===cardPool.length)return;
  if(want<cardPool.length)cardPool=cardPool.slice(0,want);
  else{
    const have=new Set(cardPool.map(x=>x.w)),ok=x=>statusOf(x.w)==='new'&&!have.has(x.w)&&!(skipV()&&x.b&&x.k!==7);
    const book=$('#wordBook').value,tp=$('#wordTopic').value;
    let more=toeicSort(WORDS.filter(x=>ok(x)&&inBook(x,book)&&(tp==='all'||(x.t||[]).includes(tp))),book);
    if(more.length<want-cardPool.length){
      const mh=new Set(more.map(x=>x.w));
      more=more.concat(WORDS.filter(x=>ok(x)&&!mh.has(x.w)))
    }
    cardPool=cardPool.concat(more.slice(0,want-cardPool.length))
  }
  if(cardIndex>=cardPool.length)cardIndex=0;
  const m=$('#wordCard .meta');
  if(m&&/^\d+ \/ \d+/.test(m.textContent))m.textContent=m.textContent.replace(/^\d+ \/ \d+/,(cardIndex+1)+' / '+cardPool.length);else showCard()
}
/* 無線電用語：句子頁的「📻 無線電用語」範圍（和無線電頁的「用 🎤 練習」一樣） */
function flowRadioGo(){
  if(window.rpOff)rpOff();
  page('practice');
  const u=$('#unit');
  if(u.value!=='radio'){
    u.value='radio';
    store.settings.unit='radio';
    i=(store.settings.pos&&store.settings.pos.radio)||0;
    save()
  }
  filter();
  if(!pool.some(s=>s.src==='radio')){
    $('#hideKnown').checked=false;
    filter()
  }
  render()
}

/* ---------- 項目 9：Role Play 間隔複習 ----------
   store.rpSched[對話 id]={due 下次複習日, iv 間隔天數, piv 今天第一次之前的間隔, last 最後一次, best 最高分, sc 這次分數, n 次數, me 演哪個角色}
   平均相似度 < 70 → 1 天；70–84 → 3 天；≥ 85 → 前一次間隔 × 2（最少 7、最多 60 天）。同一天再演一次只重算今天的結果，不會連續加倍。 */
function rpSchedSet(id,avg,me){
  if(typeof avg!=='number'||!isFinite(avg)||!DLG_BY[id])return null;
  store.rpSched=_isObj(store.rpSched)?store.rpSched:{};
  const o=_isObj(store.rpSched[id])?store.rpSched[id]:{},t=day(),sc=Math.max(0,Math.min(100,Math.round(avg)));
  const prev=o.last===t&&typeof o.piv==='number'?o.piv:(+o.iv||0);
  const iv=sc>=85?Math.min(60,Math.max(7,prev*2)):sc>=70?3:1;
  const r={due:day(iv),iv,piv:prev,last:t,best:Math.max(+o.best||0,sc),sc,n:(+o.n||0)+1,me:me==='A'?'A':'B'};
  store.rpSched[id]=r;
  return r
}
function rpSchedHtml(r,id){
  if(!r){
    const o=_isObj(store.rpSched)&&store.rpSched[id];
    return `<p class="rp-next-rev">📅 這次沒有用 🎤 檢查，複習日期沒有改${o&&o.due?'（下次複習 '+esc(v532MD(o.due))+'）':''}。<small>用 🎤 念過的話，會依平均相似度安排下次複習。</small></p>`
  }
  const why=r.sc<70?'平均低於 70%：明天再演一次':r.sc<85?'平均 70–84%：3 天後複習':'平均 85% 以上：間隔加倍（最少 7 天、最多 60 天）';
  return `<p class="rp-next-rev">📅 下次複習：<b>${esc(v532MD(r.due))}</b>（${r.iv===1?'明天':r.iv+' 天後'}）<small>${why}</small></p>`
}
/* 到期的對話：最久沒複習的排前面（同一天到期的，分數低的先） */
function rpDueList(){
  const S=_isObj(store.rpSched)?store.rpSched:{},t=day();
  return Object.keys(S).filter(id=>DLG_BY[id]&&_isObj(S[id])&&S[id].due&&S[id].due<=t).sort((a,b)=>S[a].due<S[b].due?-1:S[a].due>S[b].due?1:((S[a].sc||0)-(S[b].sc||0))||(a<b?-1:1))
}
function rpPick(){
  const L=rpDueList();
  if(!L.length)return null;
  const id=L[0],s=store.rpSched[id],r=(store.rpDone||{})[id];
  return {d:DLG_BY[id],me:s.me||(r&&r.me)||'B',due:s.due}
}
function rpDueHtml(){
  const L=rpDueList();
  if(!L.length)return '';
  const d=DLG_BY[L[0]],od=v532Diff(store.rpSched[L[0]].due,day());
  return task('🎭',`Role Play 待複習 ${L.length} 段`,0,0,'▶ 複習','rpdue',`最久的：${esc(d.t)}（${od>0?'已到期 '+od+' 天':'今天到期'}）`)
}
/* 今日頁「▶ 複習」：直接用 Role Play 演最久沒複習的那一段（有同一段的接續就接著演） */
function rpDueGo(){
  const p=rpPick();
  if(!p){
    renderToday();
    return
  }
  const r=rpResume();
  if(r&&r.d.id===p.d.id&&rpResumeGo())return;
  rpStart(p.d,p.me)
}
/* 今日學習的 Role Play 步驟：進行中的就回去；有接續就接著演；有到期的先複習；都沒有就打開建議的對話 */
function rpFlowGo(){
  try{
    if(RP.on&&!RP.fin){
      page('practice');
      return
    }
  }catch(e){}
  if(rpResume()&&rpResumeGo())return;
  const p=rpPick();
  if(p){
    rpStart(p.d,p.me);
    return
  }
  _tgV532('rp')
}
function rpBadge(id){
  const s=_isObj(store.rpSched)&&store.rpSched[id];
  if(!s||!s.due)return '';
  return s.due<=day()?'<em class="rp-badge due">🎭 待複習</em>':`<em class="rp-badge">🎭 下次 ${esc(v532MD(s.due))}</em>`
}

/* ---------- 項目 8：上次備份時間、備份提醒 ----------
   store.lastBackupAt：最後一次手動備份（下載／分享備份檔、複製備份內容）的時間（ISO）。
   備份檔裡也記下自己的建立時間：匯入時「上次備份」＝那個檔案建立的時間，匯入本身不算新的備份。 */
function bkStamp(b){
  try{
    b.progress.lastBackupAt=b.exportedAt;
    b.progress.lastExport=v532IsoDay(b.exportedAt)||day()
  }catch(e){}
  return b
}
function bkMark(iso){
  store.lastBackupAt=typeof iso==='string'&&!isNaN(Date.parse(iso))?iso:new Date().toISOString();
  if(store.settings)delete store.settings.bkLater;
  save();
  const el=$('#backupBody .bk-last');
  if(el)el.innerHTML=bkLastHtml()
}
/* 最後一次備份的日期：新的 lastBackupAt，或舊版記的 lastExport（只有日期） */
function bkLastDay(){
  const a=v532IsoDay(store.lastBackupAt),b=_date(store.lastExport)||'';
  return (a>b?a:b)||null
}
function bkLastHtml(){
  const last=bkLastDay();
  if(!last)return '還沒有備份過';
  const n=v532Diff(last,day());
  return '上次備份：'+esc(v532MD(last))+'（'+(n==null||n<=0?'今天':n+' 天前')+'）'
}
/* 有值得備份的進度：有學習紀錄，而且學過 2 天以上或累積 20 項以上 */
function bkMeaningful(){
  if(!hasProgress(store))return false;
  if((store.studyDays||[]).length>=2)return true;
  const o=x=>_isObj(x)?Object.keys(x).length:0,a=x=>Array.isArray(x)?x.length:0;
  return o(store.wordStatus)+a(store.known)+a(store.phKnown)+o(store.rpDone)+o(store.dlgDone)>=20
}
function bkRemind(){
  if(!bkMeaningful())return null;
  const last=bkLastDay(),t=day(),days=last?v532Diff(last,t):null;
  if(days!=null&&days<14)return null;
  const later=store.settings&&store.settings.bkLater;
  if(later&&later>t)return null;
  return {days,md:last?v532MD(last):''}
}
function bkRemindHtml(){
  const r=bkRemind();
  if(!r)return '';
  return `<div class="backup bk-remind"><b>💾 建議備份學習進度</b><small>${r.days==null?'你還沒有備份過。':'上次備份是 '+r.days+' 天前（'+esc(r.md)+'）。'}學習紀錄只存在這支手機的瀏覽器裡，清除瀏覽資料或換手機就會消失。</small><div class="bk-r-btns"><button data-go="backup">💾 立即匯出備份</button><button data-go="bkgo">前往備份區</button><button data-go="bklater">稍後提醒</button></div></div>`
}
/* 捲到統計頁的「資料備份與還原」 */
function bkScroll(){
  const box=$('#backupBody');
  if(!box)return;
  const h=box.previousElementSibling&&box.previousElementSibling.tagName==='H3'?box.previousElementSibling:box;
  try{
    h.scrollIntoView({block:'start'})
  }catch(e){
    h.scrollIntoView()
  }
  box.classList.remove('bk-flash');
  void box.offsetWidth;
  box.classList.add('bk-flash');
  setTimeout(()=>box.classList.remove('bk-flash'),1800)
}

/* ---------- 項目 5：每週摘要（最近 7 天和前 7 天比較，資料來自 dailyLog） ---------- */
function wkData(){
  const L=_isObj(store.dailyLog)?store.dailyLog:{},sd=new Set(store.studyDays||[]),n=v=>typeof v==='number'&&isFinite(v)&&v>0?v:0;
  let fd='';
  try{
    fd=localStorage.getItem('e5k_flow_done')||''
  }catch(e){}
  const W=[0,1].map(()=>({days:0,new:0,review:0,sent:0,ph:0,quiz:0,qok:0,qn:0,rp:0,flow:0}));
  for(let k=0;k<14;k++){
    const d=day(-k),w=W[k<7?0:1],x=_isObj(L[d])?L[d]:{};
    if(sd.has(d)||Object.keys(x).some(q=>n(x[q])>0))w.days++;
    w.new+=n(x.new);
    w.review+=n(x.review);
    w.sent+=n(x.sent)+n(x.shadow);
    w.ph+=n(x.ph)+n(x.prev);
    w.quiz+=n(x.quiz);
    w.qok+=n(x.qok);
    w.qn+=n(x.qok)+n(x.qng);
    w.rp+=n(x.rp);
    if(n(x.flow)>0||fd===d)w.flow++
  }
  return W
}
function wkRows(W){
  const a=W[0],b=W[1],pc=w=>w.qn?Math.round(w.qok/w.qn*100):null;
  return [['學習天數',a.days,b.days,'天'],['新單字',a.new,b.new,'個'],['複習單字',a.review,b.review,'個'],['句子跟讀',a.sent,b.sent,'句'],['片語',a.ph,b.ph,'個'],['測驗作答',a.quiz,b.quiz,'題'],['測驗正確率',pc(a),pc(b),'%'],['Role Play',a.rp,b.rp,'段'],['完成今日學習',a.flow,b.flow,'天']]
}
function wkArrow(x,y){
  if(x==null||y==null||x===y)return '';
  return x>y?' <i class="wk-up" title="比前 7 天多">▲</i>':' <i class="wk-down" title="比前 7 天少">▼</i>'
}
function wkHtml(){
  const R=wkRows(wkData()).filter((r,k)=>k===0||r[1]||r[2]),any=R.some(r=>r[1]||r[2]);
  const cell=(v,u)=>v==null?'—':u==='%'?v+'%':v+' '+u;
  const head=`<h3 id="wkCard">📅 每週摘要 <small class="muted">最近 7 天和前 7 天比較</small></h3>`;
  if(!any)return head+'<p class="muted">最近兩週還沒有學習紀錄。開始學習後，這裡會比較每週做了多少。</p>';
  return head+`<div class="wk"><span class="wk-h"></span><span class="wk-h wk-n">最近 7 天<small>${v532MD(day(-6))}–${v532MD(day())}</small></span><span class="wk-h wk-n">前 7 天<small>${v532MD(day(-13))}–${v532MD(day(-7))}</small></span>`+R.map(r=>`<b>${r[0]}</b><span class="wk-n">${cell(r[1],r[3])}${wkArrow(r[1],r[2])}</span><span class="wk-n wk-prev">${cell(r[2],r[3])}</span>`).join('')+'</div><p class="muted wk-note">「句子跟讀」包含 🎤 念對的句子；測驗正確率從 V5.32.0 起統計。</p>'
}
/* 今日頁的小卡 */
function wkMiniHtml(){
  const W=wkData(),a=W[0],b=W[1];
  if(!a.days&&!b.days)return '';
  const pc=a.qn?Math.round(a.qok/a.qn*100):null;
  const chips=[['學習',a.days,b.days,' 天'],['新字',a.new,b.new,''],['複習',a.review,b.review,''],['句子',a.sent,b.sent,''],['片語',a.ph,b.ph,''],['測驗',a.quiz,b.quiz,' 題'+(pc!=null?'（'+pc+'%）':'')],['Role Play',a.rp,b.rp,' 段'],['完成今日學習',a.flow,b.flow,' 天']].filter((c,k)=>k===0||c[1]||c[2]);
  return `<div class="wk-mini"><div class="wk-mini-t"><b>📅 最近 7 天</b><button type="button" class="mini" data-go="week">完整摘要 ›</button></div><div class="wk-chips">${chips.map(c=>`<span>${c[0]} <b>${c[1]}</b>${c[3]}${wkArrow(c[1],c[2])}</span>`).join('')}</div><small class="muted">▲▼：和前 7 天比較</small></div>`
}

/* ---------- 項目 8：儲存空間（統計頁） ----------
   localStorage 以字元數估算（瀏覽器上限約 5M 字元，畫面寫「約 5 MB」）；離線檔案用 navigator.storage.estimate() */
function stInfo(){
  const r={prog:0,snap:0,pre:0,app:0,other:0,total:0};
  try{
    for(let k=0;k<localStorage.length;k++){
      const key=localStorage.key(k);
      if(key==null)continue;
      const n=key.length+(localStorage.getItem(key)||'').length;
      r.total+=n;
      if(key===STORE_KEY)r.prog+=n;else if(key.indexOf(SNAP_PFX)===0||key.indexOf(SNAP_KEY)===0)r.snap+=n;else if(key===PRE_KEY)r.pre+=n;else if(/^(english5000|e5k_)/.test(key))r.app+=n;else r.other+=n
    }
  }catch(e){
    return null
  }
  return r
}
function stSize(n){
  return n<1e5?(n?Math.max(1,Math.round(n/1e3)):0)+' KB':(n/1e6).toFixed(1)+' MB'
}
function stBytes(n){
  return n<1048576?Math.max(1,Math.round(n/1024))+' KB':n<1073741824?(n/1048576).toFixed(1)+' MB':(n/1073741824).toFixed(1)+' GB'
}
function stHtml(){
  const r=stInfo();
  if(!r)return '';
  const LIM=5e6,w=x=>Math.min(100,x/LIM*100).toFixed(2)+'%',pct=Math.round(r.total/LIM*100),oth=r.pre+r.app;
  setTimeout(stEst,0);
  return `<h3 id="stCard">💽 儲存空間</h3><div class="st-box"><div class="st-top"><b>學習資料（瀏覽器儲存區）</b><span>約 ${stSize(r.total)}，上限約 5 MB（已用 ${pct}%）</span></div>`+
    `<div class="st-bar" role="img" aria-label="儲存空間已用 ${pct}%"><span class="st-p" style="width:${w(r.prog)}"></span><span class="st-s" style="width:${w(r.snap)}"></span><span class="st-o" style="width:${w(oth)}"></span><span class="st-x" style="width:${w(r.other)}"></span></div>`+
    `<div class="st-leg"><span><i class="st-p"></i>學習紀錄 ${stSize(r.prog)}</span><span><i class="st-s"></i>每日自動備份 ${stSize(r.snap)}</span><span><i class="st-o"></i>其他（設定${r.pre?'、復原點':''}）${stSize(oth)}</span>${r.other?`<span><i class="st-x"></i>同網址的其他網頁 ${stSize(r.other)}</span>`:''}</div>`+
    `<p class="muted st-est" id="stEst">離線檔案：計算中…</p>`+
    (pct>80?`<div class="rec-msg warn st-warn"><span>⚠️ 儲存空間已用 ${pct}%，快滿了。請先到下方「資料備份與還原」匯出備份檔；空間不夠時，App 會先刪掉最舊的每日自動備份。</span><button type="button" class="mini" data-bkgo="1">⬇️ 前往資料備份</button></div>`:'')+'</div>'
}
function stEst(){
  const el=$('#stEst');
  if(!el)return;
  try{
    if(!(navigator.storage&&navigator.storage.estimate)){
      el.hidden=true;
      return
    }
    navigator.storage.estimate().then(e=>{
      const x=$('#stEst');
      if(!x)return;
      if(!e||!(e.usage>=0)){
        x.hidden=true;
        return
      }
      x.textContent='離線檔案與快取：約 '+stBytes(e.usage)+(e.quota>0?'（瀏覽器給這個網站的空間約 '+stBytes(e.quota)+'）':'')
    }).catch(()=>{
      const x=$('#stEst');
      if(x)x.hidden=true
    })
  }catch(e){
    el.hidden=true
  }
}

/* ---------- 每日紀錄（向下相容：只新增計數，舊紀錄沒有這些計數也照常） ----------
   qok／qng：測驗答對／答錯；rquiz：聽代號測驗作答；rsay：無線電句子 🎤 念對；flow：做完一輪今日學習 */
var _v532q={r:+store.quizRight||0,w:+store.quizWrong||0};
var _blV532=bumpLog;
bumpLog=function(k){
  _blV532(k);
  try{
    const L=store.dailyLog&&store.dailyLog[day()];
    if(!L)return;
    if(k==='quiz'){
      const r=+store.quizRight||0,w=+store.quizWrong||0;
      if(r>_v532q.r)L.qok=(+L.qok||0)+1;else if(w>_v532q.w)L.qng=(+L.qng||0)+1;
      _v532q={r,w};
      if(qCur==='radio')L.rquiz=(+L.rquiz||0)+1
    }else if(k==='shadow'){
      const s=cur();
      if(s&&s.src==='radio')L.rsay=(+L.rsay||0)+1
    }
  }catch(e){}
};
/* 做完一輪今日學習（最後一步完成，或按「完成」）時記錄 */
var _fgV532=flowGo;
flowGo=function(){
  _fgV532();
  if(FLOW&&FLOW.i>=FLOW.steps.length)flowMarkDone()
};
var _feV532=flowEnd;
flowEnd=function(){
  if(FLOW&&FLOW.i>=FLOW.steps.length)flowMarkDone();
  _feV532()
};
/* 今日頁的新按鈕、新步驟 */
var _tgV532=todayGo;
todayGo=function(g){
  if(g==='flowcfg'||g==='flowset'){
    FCG_OPEN=g==='flowset'?true:!FCG_OPEN;
    renderToday();
    const p=$(FCG_OPEN?'#todayBody .fcg':'#todayBody .fcg-t');
    if(p&&p.scrollIntoView)p.scrollIntoView({block:'nearest'});
    return
  }
  if(g==='flowreset'){
    if(store.settings.flowCfg){
      delete store.settings.flowCfg;
      save()
    }
    renderToday();
    return
  }
  if(g==='bkgo'){
    $('#navStats').click();
    bkScroll();
    return
  }
  if(g==='bklater'){
    store.settings.bkLater=day(7);
    save();
    renderToday();
    return
  }
  if(g==='week'){
    $('#navStats').click();
    const h=$('#wkCard');
    if(h)h.scrollIntoView({block:'start'});
    return
  }
  if(g==='rpdue'){
    rpDueGo();
    return
  }
  if(g==='radio'){
    flowRadioGo();
    return
  }
  if(g==='flow'){
    flowStale();
    if(!(FLOW&&FLOW.i<FLOW.steps.length)&&!flowPlan().length){
      todayGo('flowset');
      return
    }
  }
  const fk=flowCurK();
  if(g==='ph'&&fk==='ph'&&PHRASES.some(x=>isPDue(x.id)))return _tgV532('prev');
  if(g==='rp'&&fk==='rp'){
    rpFlowGo();
    return
  }
  const r=_tgV532(g);
  if(g==='new'&&fk==='new'&&flowCfgGet().new!=null)flowFitCards();
  return r
};
$('#todayBody').addEventListener('change',e=>{
  const s=e.target.closest&&e.target.closest('select[data-fc]');
  if(!s)return;
  flowCfgSet(s.dataset.fc,+s.value);
  flowCfgRefresh()
});
$('#statsBody').addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('[data-bkgo]'))bkScroll()
});
