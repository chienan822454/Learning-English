const APP_VERSION='6.4.0';
/* English 5000（手機學英文 PWA；一般 script，不需要建置）
   程式分成 13 段（依功能），每段開頭有說明：
    1. 版本與工具
    2. 學習紀錄與儲存
    3. 語音與錄音
    4. 句子頁
    5. 單字頁、片語頁
    6. 測驗與錯題本
    7. 情境對話與 Role Play
    8. 今日學習與每日流程
    9. 統計、備份、儲存空間
   10. 點字查詢
   11. 無線電、發音辨別、KK
   12. 句型替換、中翻英、意思回想
   13. 畫面切換、資料載入、啟動
   開啟 App 時依照檔案順序執行各段最上層的程式：
   - 第 2 段在 const store=loadStore() 這一行讀取學習紀錄（normStore、v532Norm、mrNorm、v534Norm；多益程度估計的 toeicNorm 寫在第 6 段，也只用第 1 段的工具），
     這些函式只能用在那一行之前建立的東西（第 1 段的工具、第 2 段前面的常數；V6.0 的自動備份用到的 SNAPDB 也在前面）。
     接著轉移舊版紀錄、補齊欄位：這個順序決定學習紀錄（和備份檔）裡欄位的順序，不要任意調換。
   - 第 3～12 段建立資料、設定畫面、綁定事件。句子清單（第 4 段的 ALLS）建立時就會呼叫後面的關鍵字函式，
     那些函式用到的資料在第一次用到時才建立（var，不給初始值）。
   - 第 13 段最後才畫出第一個畫面（render、page('today')、renderToday），再下載 data-ex.js、data-ex2.js、data-more.js。
   函式宣告會提前建立；let／const 在宣告那一行之前不能用。
   最上層的名稱都是全域的，自動測試（tests/）會直接呼叫，改名或刪除前先搜尋測試。 */
/* ==================================================================
   1. 版本與工具
   版本號、沒有朗讀功能時的替代物件、$()、跳脫 HTML、日期與型別小工具
   ================================================================== */
const HTML_VER=(document.getElementById('appVer')||{}).textContent||'';
/* 瀏覽器沒有朗讀功能（例如 LINE、Facebook 等 App 內建瀏覽器）時改用替代物件，App 其他功能照常；按播放時提示改用 Safari／Chrome */
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
const $=s=>document.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function debounce(f,ms){
  let t;
  return()=>{
    clearTimeout(t);
    t=setTimeout(f,ms)
  }
}
function todayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
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
/* 讀取或匯入學習紀錄時，把每個欄位整理成正確的型別（數字、日期、狀態），
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
function qShuffle(a){
  a=a.slice();
  for(let k=a.length-1;k>0;k--){
    const j=Math.floor(Math.random()*(k+1));
    [a[k],a[j]]=[a[j],a[k]]
  }
  return a
}
/* 底部選單或今日學習進度列的上緣（自動捲動要避開的位置） */
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
/* ==================================================================
   2. 學習紀錄與儲存
   讀取（整理欄位、損毀時改用自動備份）、每日自動備份（最新一份在 localStorage，歷史在瀏覽器資料庫 IndexedDB）、延後合併存檔、多分頁同步、舊版紀錄轉移、每日紀錄、複習排程
   ================================================================== */
try{
  localStorage.removeItem('e5k_sr_once')
}catch(e){}
/* ---------- 學習紀錄：安全載入＋每日自動備份 ---------- */
/* BACKUP_FMT：V6.0 起備份檔加上 fmt（儲存格式版本 6）；比這個數字新的備份檔不匯入 */
const STORE_KEY='english5000v5',SNAP_KEY='english5000v5_snaps',PRE_KEY='english5000v5_before_restore',BACKUP_SCHEMA=3,BACKUP_FMT=6;
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
/* 每日自動備份「每天一個鍵」：直接保存開啟時讀到的原始紀錄文字，另外記一份小的索引（日期、摘要），
   開啟 App 時不必解析、重新產生完整備份。舊格式（english5000v5_snaps 一個鍵存 3 份完整備份）第一次讀取時自動轉換（snapMigrate）。 */
const SNAP_PFX='english5000v5_snap_',SNAP_IDX=SNAP_KEY+'_idx';
/* ---------- V6.0：自動備份的歷史存在瀏覽器資料庫（IndexedDB） ----------
   localStorage 只留最新一份（學習紀錄損毀時，開啟 App 就能立刻改用），較舊的存在 IndexedDB：
   資料庫 english5000、表 snaps、鍵＝日期，每份 {date, savedAt, version, summary, raw}（raw＝那天開啟時讀到的原始紀錄文字），保留最近 14 份。
   最新一份也同時存在資料庫；localStorage 索引裡的 db:1＝這份已經存進資料庫、讀回比對過。
   搬移一律「寫入 → 讀回比對完全相同 → 才刪掉 localStorage 的那份」；中途中斷時下次開啟接著做（重複做結果也一樣）。
   english5000v5_snaps_db 記錄轉移狀態：{v:6, ok:1, at:第一次轉移完成的時間, n:那次搬了幾份}；ok:0＝上次資料庫不能用。
   資料庫不能用（無痕模式、空間不足、舊瀏覽器、開不起來）時照 V5 的做法：localStorage 保留 3 天，下次開啟再試。 */
const SNAP_DB='english5000',SNAP_STORE='snaps',SNAP_DB_DAYS=14,SNAP_LS_DAYS=3,SNAP_FLAG=SNAP_KEY+'_db';
/* db：開好的資料庫；p：開啟中；st：''（還不確定）／'ok'／'off'（這次開啟不能用）；
   q：為了空間先移出 localStorage、還沒確認存進資料庫的備份（放在記憶體）；run：正在搬移；again：搬移中又有新的要搬；
   soon：已排定搬移；list：資料庫裡各份的摘要（快取）；rt：自動備份清單第幾次畫 */
const SNAPDB={db:null,p:null,st:'',q:[],run:null,again:0,soon:0,list:null,rt:0};
function snapDbHas(){
  try{
    return !!window.indexedDB
  }catch(e){
    return false
  }
}
/* 這次開啟可能可以用資料庫（還不確定時當作可以） */
function snapDbMaybe(){
  return SNAPDB.st!=='off'&&snapDbHas()
}
function snapFlag(){
  try{
    const f=JSON.parse(lsGet(SNAP_FLAG)||'null');
    return _isObj(f)?f:null
  }catch(e){
    return null
  }
}
/* localStorage 最多留幾天：資料庫可以用（或還不確定）時先不刪（最多 14 份，開啟後就搬到資料庫）；不能用時和 V5 一樣 3 天 */
function snapLsMax(){
  if(!snapDbMaybe())return SNAP_LS_DAYS;
  if(SNAPDB.st==='ok')return SNAP_DB_DAYS;
  const f=snapFlag();
  return f&&f.ok===0?SNAP_LS_DAYS:SNAP_DB_DAYS
}
/* localStorage 裡有哪些天的每日自動備份（看鍵，不看索引） */
function snapLsDates(){
  const a=[];
  try{
    for(let k=0;k<localStorage.length;k++){
      const key=localStorage.key(k),d=key&&key.indexOf(SNAP_PFX)===0?key.slice(SNAP_PFX.length):'';
      if(/^\d{4}-\d{2}-\d{2}$/.test(d))a.push(d)
    }
  }catch(e){}
  return a
}
function snapRec(r){
  return {date:r.date,savedAt:r.savedAt||'',version:r.version||'',summary:_isObj(r.summary)?r.summary:{},raw:r.raw}
}
/* 開啟資料庫（只開一次）；不能用或 8 秒沒有回應 → null */
function snapDbOpen(){
  if(SNAPDB.db)return Promise.resolve(SNAPDB.db);
  if(SNAPDB.p)return SNAPDB.p;
  if(!snapDbMaybe())return Promise.resolve(null);
  return SNAPDB.p=new Promise(res=>{
    let end=false,poke=0,tm=0;
    const fin=db=>{
      if(end){
        try{
          if(db)db.close()
        }catch(e){}
        return
      }
      end=true;
      clearTimeout(tm);
      clearInterval(poke);
      SNAPDB.db=db;
      res(db)
    };
    try{
      const idb=window.indexedDB,rq=idb.open(SNAP_DB,1);
      rq.onupgradeneeded=()=>{
        try{
          const db=rq.result;
          if(!db.objectStoreNames.contains(SNAP_STORE))db.createObjectStore(SNAP_STORE,{keyPath:'date'})
        }catch(e){}
      };
      rq.onsuccess=()=>{
        const db=rq.result,drop=()=>{
          if(SNAPDB.db===db){
            SNAPDB.db=null;
            SNAPDB.p=null
          }
        };
        /* 另一個分頁要升級資料庫、或瀏覽器關掉了連線：放開，下次用到再開 */
        db.onversionchange=()=>{
          try{
            db.close()
          }catch(e){}
          drop()
        };
        db.onclose=drop;
        fin(db)
      };
      rq.onerror=()=>fin(null);
      /* Safari 14 有時第一次開資料庫一直沒有回應：查一下資料庫清單就會繼續 */
      if(typeof idb.databases==='function')poke=setInterval(()=>{
        try{
          idb.databases().catch(()=>{})
        }catch(e){}
      },500);
      tm=setTimeout(()=>fin(null),8000)
    }catch(e){
      fin(null)
    }
  })
}
/* 一個交易全部做完才算成功（中途失敗整個交易取消） */
function snapDbTx(db,mode,fn){
  return new Promise((res,rej)=>{
    try{
      const tx=db.transaction(SNAP_STORE,mode);
      fn(tx.objectStore(SNAP_STORE));
      tx.oncomplete=()=>res();
      tx.onabort=()=>rej(tx.error||new Error('IndexedDB'))
    }catch(e){
      rej(e)
    }
  })
}
function snapDbPut(db,recs){
  return snapDbTx(db,'readwrite',os=>recs.forEach(r=>os.put(snapRec(r))))
}
function snapDbDel(db,dates){
  return snapDbTx(db,'readwrite',os=>dates.forEach(d=>os.delete(d)))
}
function snapDbGet(db,dates){
  const out={};
  return snapDbTx(db,'readonly',os=>dates.forEach(d=>{
    const q=os.get(d);
    q.onsuccess=()=>{
      out[d]=q.result
    }
  })).then(()=>out)
}
/* 全部的日期（keys＝true，不讀內容）或全部內容 */
function snapDbEach(db,keys){
  const out=[];
  return snapDbTx(db,'readonly',os=>{
    const q=keys&&os.openKeyCursor?os.openKeyCursor():os.openCursor();
    q.onsuccess=()=>{
      const c=q.result;
      if(c){
        out.push(keys?c.key:c.value);
        c.continue()
      }
    }
  }).then(()=>out)
}
/* 這份自動備份要移出 localStorage（或 localStorage 放不下）：先放在記憶體交給資料庫（資料庫開著就立刻寫入），
   開啟後的搬移（snapDbSync）會再寫一次並讀回確認。資料庫不能用時和 V5 一樣不保留。 */
function snapHold(m,raw){
  if(!m||typeof raw!=='string'||!snapDbMaybe())return;
  const r={date:m.date,savedAt:m.savedAt||'',version:m.version||'',summary:_isObj(m.summary)?m.summary:null,raw};
  SNAPDB.q=SNAPDB.q.filter(y=>y.date!==r.date).concat(r);
  if(SNAPDB.db){
    try{
      const tx=SNAPDB.db.transaction(SNAP_STORE,'readwrite');
      tx.objectStore(SNAP_STORE).put(snapRec(r));
      if(tx.commit)tx.commit();
      SNAPDB.list=null
    }catch(e){}
  }
  snapDbSoon()
}
/* 從 localStorage 移除一份每日自動備份：還沒存進資料庫的先交給資料庫（snapHold） */
function snapDrop(x){
  if(!x.db)snapHold(x,lsGet(SNAP_PFX+x.date));
  snapDel(x.date)
}
/* 空間不足時先「移」自動備份（不刪任何東西）：已經存進資料庫的直接從 localStorage 移除，還沒存進去的先交給資料庫再移除。
   最舊的先移、最新一份最後；每移一份就試一次 retry()，成功就停。資料庫不能用時不做（照 V5 的順序清理）。 */
function snapFreeSafe(retry){
  if(!snapDbMaybe())return false;
  const idx=snapIdx().sort((p,q)=>q.date.localeCompare(p.date));
  while(idx.length){
    snapDrop(idx.pop());
    snapIdxSave(idx);
    if(retry())return true
  }
  return false
}
function snapDbSoon(){
  if(!SNAPDB.soon&&snapDbMaybe())SNAPDB.soon=setTimeout(()=>{
    SNAPDB.soon=0;
    snapDbSync()
  },0)
}
/* 把 localStorage 裡較舊的自動備份搬到資料庫（開啟 App 後、每天第一份備份後、移出 localStorage 後）。同一時間只跑一個，跑的時候又有新的就再跑一次 */
function snapDbSync(){
  if(SNAPDB.run){
    SNAPDB.again=1;
    return SNAPDB.run
  }
  SNAPDB.run=snapDbSync1().catch(()=>snapDbOff()).then(()=>{
    SNAPDB.run=null;
    if(SNAPDB.again){
      SNAPDB.again=0;
      return snapDbSync()
    }
  });
  return SNAPDB.run
}
async function snapDbSync1(){
  const db=await snapDbOpen();
  if(!db)return snapDbOff();
  /* V5.27 以前的舊格式（一個鍵存 3 份）先換成每天一個鍵 */
  snapMigrate();
  /* 1. 要寫入的：記憶體裡暫放的、localStorage 裡還沒確認的（記著 db:1 但資料庫裡沒有的也算；同一天以 localStorage 的為準）、索引裡沒有的每日備份鍵（中途中斷留下的） */
  const have=await snapDbEach(db,true),held=SNAPDB.q.slice(),idx=snapIdx(),todo={};
  held.forEach(r=>{
    todo[r.date]=r
  });
  idx.forEach(x=>{
    const raw=x.db&&have.includes(x.date)?null:lsGet(SNAP_PFX+x.date);
    if(raw!=null)todo[x.date]={date:x.date,savedAt:x.savedAt,version:x.version,summary:x.summary,raw}
  });
  snapLsDates().forEach(d=>{
    if(idx.some(x=>x.date===d))return;
    const raw=lsGet(SNAP_PFX+d);
    if(raw!=null)todo[d]={date:d,raw}
  });
  const recs=Object.keys(todo).map(d=>todo[d]),ok={};
  recs.forEach(r=>{
    if(!_isObj(r.summary)){
      try{
        r.summary=progSummary(JSON.parse(r.raw))
      }catch(e){
        r.summary={}
      }
    }
  });
  let moved=0;
  if(recs.length){
    await snapDbPut(db,recs);
    /* 2. 讀回比對：有任何一份不同就當作資料庫不能用（localStorage 的一份都不刪；讀回不對的不留在資料庫） */
    const back=await snapDbGet(db,recs.map(r=>r.date)),bad=recs.filter(r=>!(back[r.date]&&back[r.date].raw===r.raw)).map(r=>r.date);
    if(bad.length){
      await snapDbDel(db,bad).catch(()=>{});
      throw new Error('verify')
    }
    SNAPDB.list=null;
    SNAPDB.q=SNAPDB.q.filter(y=>!held.includes(y));
    recs.forEach(r=>{
      ok[r.date]=r.raw
    });
    moved+=held.filter(r=>todo[r.date]===r).length
  }
  /* 3. localStorage：存好的記下 db:1；最新一份留著，其他（已經在資料庫裡的）刪掉 */
  const keys=snapLsDates(),newest=keys.slice().sort().pop();
  let cur=snapIdx().filter(x=>keys.includes(x.date));
  keys.forEach(d=>{
    if(ok[d]!=null&&!cur.some(x=>x.date===d))cur.push({date:d,savedAt:todo[d].savedAt||'',version:todo[d].version||'',summary:todo[d].summary})
  });
  cur=cur.filter(x=>{
    if(!x.db&&ok[x.date]!=null&&lsGet(SNAP_PFX+x.date)===ok[x.date])x.db=1;
    if(x.date===newest||!x.db)return true;
    snapDel(x.date);
    moved++;
    return false
  });
  cur.sort((p,q)=>q.date.localeCompare(p.date));
  if(JSON.stringify(cur)!==JSON.stringify(snapIdx()))snapIdxSave(cur);
  /* 4. 資料庫只留最近 14 份 */
  const all=(await snapDbEach(db,true)).filter(k=>typeof k==='string').sort();
  if(all.length>SNAP_DB_DAYS){
    await snapDbDel(db,all.slice(0,all.length-SNAP_DB_DAYS));
    SNAPDB.list=null
  }
  /* 5. 記下已轉移（第一次成功的時間和份數） */
  SNAPDB.st='ok';
  const f=snapFlag();
  if(!f||f.ok!==1||!f.at)lsSet(SNAP_FLAG,JSON.stringify({v:6,ok:1,at:f&&f.at||new Date().toISOString(),n:f&&f.at?f.n||0:moved}))
}
/* 資料庫不能用（開不起來、寫入或讀回不對）：照 V5 的做法，localStorage 保留 3 天；這次開啟不再用資料庫，下次開啟再試 */
function snapDbOff(){
  SNAPDB.st='off';
  SNAPDB.q=[];
  SNAPDB.list=null;
  const f=snapFlag()||{v:6};
  if(f.ok!==0){
    f.ok=0;
    lsSet(SNAP_FLAG,JSON.stringify(f))
  }
  const idx=snapIdx().sort((p,q)=>q.date.localeCompare(p.date));
  if(idx.length>SNAP_LS_DAYS){
    while(idx.length>SNAP_LS_DAYS)snapDel(idx.pop().date);
    snapIdxSave(idx)
  }
}
/* 等資料庫的搬移做完（自動測試也用）；回傳 'ok'／'off'／''（還不確定） */
async function snapDbIdle(){
  for(let k=0;k<200&&(SNAPDB.soon||SNAPDB.run);k++){
    if(SNAPDB.run)await SNAPDB.run;else await new Promise(r=>setTimeout(r,10))
  }
  return SNAPDB.st
}
/* 有還沒寫完的搬移時，等寫完（最多 2 秒）再做 fn（重新載入前用） */
function snapDbFlushThen(fn){
  if(!SNAPDB.q.length&&!SNAPDB.run&&!SNAPDB.soon)return fn();
  let done=false;
  const go=()=>{
    if(!done){
      done=true;
      fn()
    }
  };
  snapDbIdle().then(go,go);
  setTimeout(go,2000)
}
/* 資料庫裡各份的摘要（不留原始紀錄文字，size＝字元數），新的在前；資料庫不能用 → null */
async function snapDbList(){
  await snapDbIdle();
  if(SNAPDB.list)return SNAPDB.list;
  try{
    const db=await snapDbOpen();
    if(!db)return null;
    const a=await snapDbEach(db,false);
    return SNAPDB.list=a.filter(x=>x&&typeof x.date==='string').map(x=>({date:x.date,savedAt:x.savedAt||'',version:x.version||'',summary:_isObj(x.summary)?x.summary:{},size:typeof x.raw==='string'?x.raw.length:0})).sort((p,q)=>q.date.localeCompare(p.date))
  }catch(e){
    return null
  }
}
/* 全部的自動備份：localStorage 的（最新一份）＋資料庫的歷史，同一天只列一次，新的在前。db＝資料庫可以用 */
async function snapMetaAll(){
  const a=await snapDbList(),m={};
  (a||[]).forEach(x=>{
    m[x.date]={date:x.date,summary:x.summary,db:1}
  });
  snapMeta().forEach(x=>{
    m[x.date]={date:x.date,summary:x.summary,ls:1,db:m[x.date]?1:0}
  });
  return {db:!!a,list:Object.keys(m).sort().reverse().map(d=>m[d])}
}
/* 讀出一份自動備份（先找 localStorage，沒有再找資料庫） */
async function snapGet(date){
  const a=snapList().find(y=>y.date===date);
  if(a)return a;
  try{
    const db=await snapDbOpen(),r=db&&(await snapDbGet(db,[date]))[date],p=r&&typeof r.raw==='string'?JSON.parse(r.raw):null;
    return _isObj(p)?{date,savedAt:r.savedAt||'',version:r.version||'',progress:p}:null
  }catch(e){
    return null
  }
}
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
    const m={date:x.date,savedAt:x.savedAt||'',version:x.version||'',summary:progSummary(x.progress)},raw=JSON.stringify(x.progress);
    if(lsSet(SNAP_PFX+x.date,raw))idx.push(m);else snapHold(m,raw)
  });
  idx.sort((p,q)=>q.date.localeCompare(p.date));
  /* V6.0：資料庫可以用時先全部留著（開啟後搬到資料庫）；不能用時和 V5 一樣留 3 天 */
  while(idx.length>snapLsMax())snapDrop(idx.pop());
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
function hasProgress(p){
  return !!p&&['fav','known','wordFav','wordKnown','phKnown','phFav','studyDays'].some(k=>Array.isArray(p[k])&&p[k].length)||!!p&&['wordStatus','reviewDue','wrongWords','sDue','pDue'].some(k=>p[k]&&typeof p[k]==='object'&&Object.keys(p[k]).length)
}
/* 每天第一次開啟時保存一份，在任何轉移或修改之前。raw＝開啟時讀到的原始紀錄文字。
   V6.0：localStorage 只留最新一份（較舊的已經存進資料庫就移除，還沒存進去的開啟後由 snapDbSync 搬過去）；
   資料庫不能用時和 V5 一樣在 localStorage 保留 3 天。為了空間要移出的，先交給資料庫（snapDrop）。 */
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
  idx=idx.filter((x,k)=>!(k&&x.db&&(snapDel(x.date),1)));
  while(idx.length>snapLsMax())snapDrop(idx.pop());
  /* 自動備份最多用約 3.4M 字元，留空間給學習紀錄本身（瀏覽器上限約 5M） */
  const size=d=>(lsGet(SNAP_PFX+d)||'').length;
  let total=raw.length+idx.slice(1).reduce((s,x)=>s+size(x.date),0);
  while(idx.length>2&&total+raw.length*2>3.4e6){
    const x=idx.pop();
    total-=size(x.date);
    snapDrop(x)
  }
  while(idx.length){
    if(lsSet(SNAP_PFX+t,raw)){
      snapIdxSave(idx);
      lsSet(SNAP_KEY+'_date',t);
      snapDbSoon();
      return
    }
    if(idx.length<=2)break;
    snapDrop(idx.pop())
  }
  /* localStorage 放不下今天的：交給資料庫 */
  snapHold(idx[0],raw);
  snapIdxSave(idx.filter(x=>x.date!==t));
  lsSet(SNAP_KEY+'_date',t)
}
function snapMeta(){
  snapMigrate();
  return snapIdx().map(m=>({date:m.date,summary:m.summary&&typeof m.summary==='object'?m.summary:{}}))
}
/* 學習紀錄的摘要（自動備份的索引、備份檔的 summary、匯入或還原前的確認都用） */
function progSummary(p){
  p=p||{};
  const st=p.wordStatus&&typeof p.wordStatus==='object'?p.wordStatus:{};
  const n=a=>Array.isArray(a)?a.length:0,o=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).length:0;
  const known=new Set([...(Array.isArray(p.wordKnown)?p.wordKnown:[]),...Object.keys(st).filter(k=>st[k]==='known')]);
  return {wordKnown:known.size,learning:Object.values(st).filter(v=>v==='learning').length,review:o(p.reviewDue),wordFav:n(p.wordFav),wrong:o(p.wrongWords),sentKnown:n(p.known),sentFav:n(p.fav),phKnown:n(p.phKnown),phFav:n(p.phFav),dlg:o(p.dlgDone),rp:o(p.rpDone),days:n(p.studyDays)}
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
  if(s.dlgDone!=null)s.dlgDone=_map(s.dlgDone,v=>_date(v)||(v?todayStr():undefined));
  if(s.rpDone!=null)s.rpDone=_map(s.rpDone,v=>_isObj(v)?{d:_date(v.d)||todayStr(),me:v.me==='A'?'A':'B',avg:typeof v.avg==='number'&&isFinite(v.avg)?v.avg:null,lv:/^[a-z0-9]{1,12}$/.test(v.lv||'')?v.lv:undefined,pass:_num(v.pass)||0,of:_num(v.of)||0}:undefined);
  if(s.qStat!=null)s.qStat=_map(s.qStat,v=>Array.isArray(v)?[_num(v[0])||0,_num(v[1])||0]:undefined);
  ['quizRight','quizWrong'].forEach(k=>{
    if(s[k]!=null)s[k]=_num(s[k])||0
  });
  if(s.lastExport!=null&&!_date(s.lastExport))delete s.lastExport;
  if(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings))s.settings={dailyGoal:20};
  const g=+s.settings.dailyGoal;
  s.settings.dailyGoal=[10,20,30,50].includes(g)?g:20;
  if(s.settings.theme!=null&&!['auto','light','dark'].includes(s.settings.theme))s.settings.theme='auto';
  /* 每日複習上限、音標顯示、iPhone 加入主畫面提示 */
  if(s.settings.reviewCap!=null&&![0,50,100,200].includes(s.settings.reviewCap))delete s.settings.reviewCap;
  if(s.settings.phon!=null&&!['ipa','kk'].includes(s.settings.phon))delete s.settings.phon;
  if(s.settings.iosTip!=null&&s.settings.iosTip!=='never'&&!_date(s.settings.iosTip))delete s.settings.iosTip;
  if(s.settings.pos!=null)s.settings.pos=_map(s.settings.pos,v=>_num(v)>=0?Math.floor(_num(v)):undefined);
  /* 今日學習自訂、Role Play 複習排程、上次備份時間、備份提醒延後（整理成正確型別） */
  v532Norm(s);
  /* 意思不熟清單（meanWeak）、只聽發音設定（settings.mrEar） */
  mrNorm(s);
  /* 今天回想過的字（mrToday，只留今天的）、各句型 🎤 念對次數（frSay）、今日學習暫時切換的中翻英（settings.zfFlow） */
  v534Norm(s);
  /* 多益程度估計（非官方）：估計紀錄 toeicEst（最多 50 筆）、正式成績 toeicOfficial（最多 20 筆）；沒有時是空陣列（toeicNorm 在第 6 段） */
  toeicNorm(s);
  /* V6.3.0：答錯單字的出處（wrongSrc；只留還在答錯單字本裡的字） */
  v630Norm(s);
  /* V6.4.0：Role Play 沒念到、還在觀察的字（rpMiss） */
  v640Norm(s);
  return s
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
/* ---------- 讀取／匯入學習紀錄時整理（只用 _isObj、_num、_date、todayStr） ---------- */
function mrNorm(s){
  try{
    if(s.meanWeak!=null){
      const o={},m=s.meanWeak;
      if(_isObj(m))Object.keys(m).forEach(w=>{
        const v=m[w];
        if(!/^[A-Za-z0-9][A-Za-z0-9 '+.\-]{0,59}$/.test(w)||!_isObj(v))return;
        const n=Math.floor(_num(v.n));
        o[w]={n:n>=1?Math.min(n,99999):1,last:_date(v.last)||todayStr(),ok:_num(v.ok)===1?1:0}
      });
      s.meanWeak=o
    }
    if(s.settings&&s.settings.mrEar!=null&&s.settings.mrEar!==true)delete s.settings.mrEar;
    /* V6.3.0：⚡ 快速模式的秒數（2／3／5；沒有＝關）、不顯示學習天數（hideStreak） */
    if(s.settings&&s.settings.mrQuick!=null&&![2,3,5].includes(s.settings.mrQuick))delete s.settings.mrQuick;
    if(s.settings&&s.settings.hideStreak!=null&&s.settings.hideStreak!==true)delete s.settings.hideStreak
  }catch(e){}
}
/* ---------- 讀取／匯入學習紀錄時整理新欄位（只用 _isObj、_num、_date、todayStr） ---------- */
function v534Norm(s){
  try{
    if(s.mrToday!=null){
      const m=s.mrToday,t=todayStr(),ok=w=>typeof w==='string'&&/^[A-Za-z0-9][A-Za-z0-9 '+.\-]{0,59}$/.test(w);
      const w=_isObj(m)&&m.d===t&&Array.isArray(m.w)?[...new Set(m.w.filter(ok))].slice(-600):[];
      if(w.length)s.mrToday={d:t,w};else delete s.mrToday
    }
    if(s.frSay!=null){
      const o={};
      if(_isObj(s.frSay))Object.keys(s.frSay).forEach(k=>{
        const n=Math.floor(_num(s.frSay[k]));
        if(/^fr\d{1,4}$/.test(k)&&n>=1)o[k]=Math.min(n,1e6)
      });
      if(Object.keys(o).length)s.frSay=o;else delete s.frSay
    }
    const st=s.settings;
    if(st&&st.zfFlow!=null&&!(st.zfFlow===1&&st.zhFirst===true))delete st.zfFlow
  }catch(e){}
}
/* V6.3.0：store.wrongSrc＝{單字:{s 出處句子 id（d:對話:句、w:單字例句、x:多益長例句、f:句型），q 答錯的題型（en、zh、listen、cloze、dict、ctx、dc），d 日期}}；
   只留還在答錯單字本（wrongWords）裡的字；沒有時沒有這個欄位 */
/* V6.4.0：store.rpMiss＝{單字:{n 沒念到的次數（1）, d 日期, s 那一句的 id（d:對話:句）}}：Role Play 第一次沒念到、還不確定是不是辨識錯誤的字。
   14 天內再沒念到一次才放進答錯單字本；只留 14 天內、格式正確的，最多 300 個 */
function v640Norm(s){
  try{
    if(s.rpMiss==null)return;
    const o={},m=s.rpMiss,lim=(()=>{
      const d=new Date();
      d.setDate(d.getDate()-14);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
    })();
    if(_isObj(m))Object.keys(m).slice(-300).forEach(w=>{
      const v=m[w];
      if(!/^[A-Za-z][A-Za-z'-]{1,40}$/.test(w)||!_isObj(v))return;
      const d=_date(v.d);
      if(!d||d<lim)return;
      const e={n:1,d};
      if(typeof v.s==='string'&&/^d:d\d{1,4}:\d{1,3}$/.test(v.s))e.s=v.s;
      o[w]=e
    });
    if(Object.keys(o).length)s.rpMiss=o;else delete s.rpMiss
  }catch(e){}
}
function v630Norm(s){
  try{
    if(s.wrongSrc==null)return;
    const o={},m=s.wrongSrc,ww=_isObj(s.wrongWords)?s.wrongWords:{};
    if(_isObj(m))Object.keys(m).forEach(w=>{
      const v=m[w];
      if(!/^[A-Za-z0-9][A-Za-z0-9 '+.\-]{0,59}$/.test(w)||!_isObj(v)||!ww[w])return;
      const e={};
      if(typeof v.s==='string'&&/^[dwxf]:[^<>"]{1,80}$/.test(v.s))e.s=v.s;
      if(typeof v.q==='string'&&/^[a-z0-9-]{1,10}$/.test(v.q))e.q=v.q;
      if(_date(v.d))e.d=_date(v.d);
      if(e.s||e.q)o[w]=e
    });
    if(Object.keys(o).length)s.wrongSrc=o;else delete s.wrongSrc
  }catch(e){}
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
  /* V6.0：開啟後（第一個畫面畫好之後）把較舊的自動備份搬到瀏覽器資料庫 */
  snapDbSoon();
  return s
}
const store=loadStore();
/* 效能：存檔延後 0.25 秒合併成一次（離開、切到背景、重新載入前一定立刻存）；
   已熟／收藏等清單用快取查詢（cset），不必每次在數千筆陣列裡逐一比對 */
let STV=0,_svT=0,_svLock=false;
const _cs={};
function cset(k){
  const a=store[k]||[];
  const c=_cs[k];
  if(c&&c.v===STV&&c.a===a&&c.n===a.length)return c.s;
  const st=new Set(a);
  _cs[k]={v:STV,a,n:a.length,s:st};
  return st
}
/* 空間不足時：V6.0 先把每日自動備份移到瀏覽器資料庫（什麼都不刪，snapFreeSafe）；
   還是不夠（或資料庫不能用）才依序清掉：損毀檔備份 → 匯入前備份 → 最舊的每日自動備份，再存一次 */
function freeSpaceFor(txt){
  if(snapFreeSafe(()=>lsSet(STORE_KEY,txt)))return true;
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
/* 另一個分頁（或加入主畫面的 App）更新了學習紀錄：這邊不再存檔，重新載入讀最新的紀錄 */
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
/* ---------- 舊版紀錄轉移、補齊欄位（這個順序決定學習紀錄和備份檔裡欄位的順序，不要調換） ---------- */
store.settings.pos=store.settings.pos||{};
/* 學習紀錄以單字為鍵（字庫調整後進度不會錯位）：很舊的紀錄用編號記，用 V4_WORDS 轉成單字（wordKeyVersion 2）。
   V6.2.0：V4_WORDS 移到 data-v4.js，只有需要轉移時才載入（index.html 開啟前先看學習紀錄的 wordKeyVersion）。
   紀錄裡有編號卻沒有載入（例如紀錄格式看不出版本）：先不轉移、不存檔，記下 e5k_v4 後重新載入，下次開啟就會載入 data-v4.js */
(function migrate(){
  if(store.wordKeyVersion>=2)return;
  const num=a=>(a||[]).some(x=>typeof x==='number'),numK=o=>Object.keys(o||{}).some(k=>/^\d+$/.test(k));
  if(!window.V4_WORDS&&(num(store.wordFav)||num(store.wordKnown)||numK(store.wordStatus)||numK(store.reviewDue))){
    let again=false;
    try{
      again=sessionStorage.getItem('e5k_v4')==='1';
      if(!again)sessionStorage.setItem('e5k_v4','1')
    }catch(e){}
    if(!again){
      saveLock();
      location.reload();
      throw new Error('E5K_V4_RELOAD')
    }
  }
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
  try{
    sessionStorage.removeItem('e5k_v4')
  }catch(e){}
  save()
})();
/* 詞形（went、colour、don't…）併入原形：把舊紀錄轉移到原形（wordKeyVersion 3）。
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
/* 字庫裡改成原形詞形的字（MERGED4：accompanied、buyers…；MERGED5：allowed、working、stairs、lying…）：
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
store.phFav=store.phFav||[];
store.phKnown=store.phKnown||[];
/* 句子／片語的複習排程（階段、到期日） */
store.sStage=store.sStage||{};
store.sDue=store.sDue||{};
store.pStage=store.pStage||{};
store.pDue=store.pDue||{};
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
store.dlgDone=store.dlgDone&&typeof store.dlgDone==='object'&&!Array.isArray(store.dlgDone)?store.dlgDone:{};
store.rpDone=store.rpDone&&typeof store.rpDone==='object'&&!Array.isArray(store.rpDone)?store.rpDone:{};
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
/* ---------- V6.3.0 學習天數（不給壓力的版本） ----------
   本週天數：這週（星期一到今天）有學習的天數。
   連續天數（streakFlex）：每 7 天可以休息 1 天不中斷（連續兩天沒學、或 7 天內休息兩次才算重新開始）；
   數的是從第一天到最後一天的天數（含休息日）；今天還沒學不算休息。不顯示任何「中斷了」的訊息。
   store.settings.hideStreak＝true：今日頁、統計頁都不顯示本週天數和連續天數（統計頁「⚙️ 學習天數」可以切換）。 */
function weekDays(){
  const S=new Set(store.studyDays||[]),dow=(new Date().getDay()+6)%7;
  let n=0;
  for(let k=0;k<=dow;k++)if(S.has(day(-k)))n++;
  return n
}
function streakFlex(){
  const S=new Set(store.studyDays||[]);
  let k=S.has(day())?0:-1,first=null,last=null;
  const miss=[];
  for(let t=0;t<800;t++,k--){
    if(S.has(day(k))){
      if(first===null)first=k;
      last=k;
      continue
    }
    /* 這次休息和上一次休息相隔不到 7 天（含連續兩天沒學）：到這裡為止 */
    if(miss.length&&miss[miss.length-1]-k<7)break;
    miss.push(k)
  }
  return first===null?0:first-last+1
}
function streakOn(){
  return store.settings.hideStreak!==true
}
/* ---------- 每日紀錄（向下相容：只新增計數，舊紀錄沒有這些計數也照常） ----------
   qok／qng：測驗答對／答錯；rquiz：聽代號測驗作答；rsay：無線電句子 🎤 念對；flow：做完一輪今日學習 */
var _v532q={r:+store.quizRight||0,w:+store.quizWrong||0};
function bumpLog(k){
  store.dailyLog=store.dailyLog||{};
  let t=day();
  let L=store.dailyLog[t]=store.dailyLog[t]||{};
  L[k]=(L[k]||0)+1;
  let ks=Object.keys(store.dailyLog).sort();
  if(ks.length>60)delete store.dailyLog[ks[0]];
  save();
  /* 細項計數（向下相容：舊紀錄沒有這些計數也照常）：qok／qng 測驗答對／答錯、rquiz 聽代號測驗作答、rsay 無線電句子 🎤 念對、fsay 句型的句子 🎤 念對 */
  try{
    const D=store.dailyLog&&store.dailyLog[day()];
    if(!D)return;
    if(k==='quiz'){
      const r=+store.quizRight||0,w=+store.quizWrong||0;
      if(r>_v532q.r)D.qok=(+D.qok||0)+1;else if(w>_v532q.w)D.qng=(+D.qng||0)+1;
      _v532q={r,w};
      if(qCur==='radio')D.rquiz=(+D.rquiz||0)+1
    }else if(k==='shadow'){
      const s=cur();
      if(s&&s.src==='radio')D.rsay=(+D.rsay||0)+1;
      /* 句型的句子 🎤 念對：今日學習「🧩 句型」的進度（fsay）、各句型練習次數（輪到練得最少的句型） */
      else if(s&&s.src==='frame'){
        D.fsay=(+D.fsay||0)+1;
        frSayAdd(s.frame)
      }
    }
  }catch(e){}
}
/* 「標記會說／已會」的今日計數記住是哪幾項；同一天取消標記會扣回 */
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
/* 複習間隔最長到 60、120、240 天（學完 5000 字後每天約 70–100 個到期；最長 30 天時會有約 210–240 個）。
   「◐ 模糊」和測驗答錯：往前退兩級；「✗ 不熟」：從頭開始 */
const INTERVALS=[1,3,7,14,30,60,120,240];
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
/* V6.4.0 速度：到期的句子、單字數量只看排程表裡的項目（不用掃整個句子清單／字表；結果和逐一比對相同，p37 會比對） */
function sDueN(){
  const d=store.sDue;
  if(!d)return 0;
  let n=0;
  for(const k in d){
    const s=sById(k);
    if(s&&isSDue(s.id))n++
  }
  return n
}
function wDueN(){
  const d=store.reviewDue;
  if(!d)return 0;
  let n=0;
  for(const w in d)if(BY_WORD[w]&&isDue(w))n++;
  return n
}
function isPDue(id){
  return !!(store.pDue&&store.pDue[id]&&store.pDue[id]<=day()&&cset('phKnown').has(id))
}
/* ==================================================================
   3. 語音與錄音
   朗讀（英文、中文、自動播放的順序念）、錄音與播放、🎤 語音辨識與評分、逐字回饋、縮寫和編號的念法
   ================================================================== */
let voices=[];
function voiceLoad(){
  voices=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
  setTimeout(()=>{
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
    /* 朗讀失敗（沒有語音、引擎忙碌）也要往下走，例如「⇄ 範例→我」仍會播放自己的錄音 */
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
/* ---------- 錄音與辨識 ----------
   每次錄音都是新的 session（新的 MediaRecorder、新的 chunks），舊的錄音網址會釋放；
   任何失敗都會把按鈕恢復成可再按的狀態。 */
const VOICE={sr:null,srTimer:null,srBusy:false,lastId:null,n:0,sess:null,att:null,trace:[],sessN:0};
const REC={state:'idle',seq:0,stream:null,mr:null,parts:[],type:'',url:null,sid:null,timer:null,guard:null,idle:null,done:0,player:null,maxMs:30000,keepMs:60000,ctx:null,src:null,proc:null,bufs:[],rate:0,mic:'',diag:'',n:0};
/* 錄音：同時用 MediaRecorder 與 Web Audio(WAV) 兩種方式收音，自動採用有聲音的那一個；
   麥克風在錄完後保留 60 秒，連續錄音時沿用，不每次重新取得（iPhone 重新取得常會變成靜音）。 */
const RAC=window.AudioContext||window.webkitAudioContext;
/* iPhone 播放聲音後會把網頁切成「只播放」模式，之後麥克風只收到靜音。
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
        /* 最多等 1.5 秒（部分手機的音訊會一直等不到，按鈕卡在「開啟麥克風…」） */
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
/* 「每次載入只能辨識一次、要重新載入」是 iPhone／iPad（Safari 引擎）的限制；Android Chrome 每念完一句辨識就會結束，屬於正常，不用重新載入 */
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
/* 🎤 評分 — 數字、時間、縮寫、連字號名稱都能對上（例：2:15 ↔ two fifteen、What's ↔ what is、UPS-2A ↔ UPS 2 A） */
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
  /* 縮寫的其他念法（lotto → LOTO）、一個一個字母念的縮寫和編號（u p s 2 a → UPS、2A）；只會加入縮寫和字母數字混合的編號 */
  scXtra(toks).forEach(x=>H.add(x[0]));
  return H
}
function scMatch(want,H){
  return want.filter(x=>H.has(x)).length
}
function srResult(heard){
  const a=scTok(cur().en),H=scHeard(heard),hit=scMatch(a,H),score=a.length?Math.round(hit/a.length*100):0;
  /* 逐字回饋（和相似度用同一套斷字；紅色的字可以點來聽） */
  $('#result').innerHTML=swFeedback(cur().en,heard,score);
  rpScore(score,heard);
  if(score>=90)bumpLog('shadow');
  /* 看中文說英文：有辨識結果之後顯示英文 */
  if(zfActive()&&!ZF.rev){
    ZF.rev=true;
    zfApply()
  }
}
/* iPhone 語音辨識常常只有第一次有效：「沿用同一個辨識器」與「重新建立」兩種方式輪替，
   某種方式聽不到時，下一次自動換另一種；並顯示診斷事件，方便回報。 */
/* iPhone 語音辨識每次載入網頁通常只能啟動一次，所以用「背景持續辨識」：
   第一次按 🎤 啟動一個連續辨識，之後每次按 🎤 只擷取按下後聽到的內容，不重新啟動辨識器。
   若手機仍結束了背景辨識、新的又聽不到，就顯示「重新啟動麥克風」。 */
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
const SR_STUCK='<br><b>⚠️ 重新載入後語音辨識仍然聽不到，這是瀏覽器本身的辨識功能暫時卡住，重新載入網頁無法修復。</b><br><small>請試：① 從 iPhone 多工畫面把 Edge 完全滑掉再重開；② 或改用 Safari 開啟（實測 Safari 可連續使用）。「🎙 錄音」與「⇄ 範例→我」不受影響，可以先用錄音對比發音。</small>';
/* 整句的字都聽到了就立刻評分，不必等手機確認（約快 3 秒） */
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
/* 🎤 開始念／停止聆聽 */
function srCheck(){
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
if(SR){
  $('#check').onclick=()=>{
    srCheck();
    /* 看中文說英文：聆聽中的說明改成「用英文說出這句中文」 */
    if(zfActive()&&VOICE.srBusy){
      const el=$('#result');
      if(el&&/^🎧 正在聆聽…請念出上面的句子/.test(el.textContent))el.textContent='🎧 正在聆聽…請用英文說出「'+cur().zh+'」（說完會自動評分）'
    }
  }
}
else{
  $('#check').onclick=()=>{
    $('#result').textContent='⚠️ 此瀏覽器不支援語音辨識，建議使用 Safari、Chrome 或 Edge。錄音對比功能仍可使用。'
  }
}
/* 換句子時：丟掉上一句的錄音、停止上一句的辨識 */
function voiceOnRender(id){
  if(REC.sid&&REC.sid!==id)recDiscard();
  if(VOICE.srBusy&&VOICE.lastId&&VOICE.lastId!==id)srAbort();
  if(VOICE.lastId!==id)sayTok++;
  VOICE.lastId=id
}
/* ---------- 🎤 逐字回饋（句子頁、Role Play） ----------
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
  /* 和 scHeard 用同一份 scXtra：合成句子裡的縮寫或編號的字（lotto、u p s、b 3）也算用上 */
  scXtra(hs).forEach(([x,f,t])=>{
    if(want.has(x))for(let q=f;q<=t;q++)used[q]=true
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
$('#result').addEventListener('click',e=>{
  let b=e.target.closest('[data-say]');
  if(b)say(b.dataset.say,.75)
});
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
/* ---------- 🎤 縮寫和編號的念法（scHeard 和逐字回饋都用 scXtra，綠色的字就是相似度算到的字） ----------
   辨識結果另外加入的只有「縮寫」和「字母數字混合的編號」：評分只看句子裡的字，所以句子裡有這個縮寫／編號時才會用到；
   沒有縮寫、編號的句子，分數不受影響（bass guitar 不會變成 LOTO）。Role Play 的通過與否（scHeard）也一樣適用。
   ① 別名（SCX.alias）：縮寫當成一個字念時常被聽成別的字（LOTO ← lotto、low toe、lo-to；BAS ← bass；SOC ← sock…）。
   ② 一個一個字母念：WORDS 裡全部的縮寫（acr:1）和機房名稱 TWDC 自動適用（PM 和 p.m. 是同一個字，不另外加）。辨識結果任何位置連續的短字
      合起來等於縮寫就算（u p s 2 a → UPS、2A；p d u b 3 → PDU、B3；e pm s → EPMS），字母的念法也算
      （see → C、you → U、are → R、oh → O、double you → W：I see M → IcM）。
   ③ 字母數字混合的編號：連續的短字合起來（b 1 4 → B14、see 2 → C2）；純數字不受影響（52 8 → 52-8）。
   合起來的每一段最多 4 個字元、全部最多 8 個字元。 */
var SCX;
function scxInit(){
  if(SCX)return SCX;
  const alias={LOTO:['lotto','lottos','low toe','lo toe','lo-to','low tow','lo tow'],BAS:['bass'],SOC:['sock'],IcM:['i c m','icm'],FOC:['f o c'],EPMS:['e p m s'],CRAC:['crack'],NOC:['knock'],VESDA:['vesta'],SME:['smee']};
  /* 字母的念法（辨識結果常把一個一個念的字母寫成這些字）；oh 在 scTok 已經變成 0 */
  const LN={see:'c',sea:'c',cee:'c',you:'u',yu:'u',are:'r',ar:'r',why:'y',eye:'i',owe:'o','0':'o',be:'b',bee:'b',dee:'d',gee:'g',jay:'j',kay:'k',el:'l',ell:'l',em:'m',en:'n',pee:'p',pea:'p',cue:'q',queue:'q',ess:'s',tee:'t',tea:'t',vee:'v',ex:'x',zee:'z',zed:'z',aitch:'h',ef:'f',eff:'f',ay:'a'};
  const A=new Map(),al=new Map();
  (window.WORDS||[]).forEach(x=>{
    const t=String(x.w||'').toLowerCase();
    if(x.acr&&/^[a-z0-9]{2,8}$/.test(t)&&t!=='pm')A.set(t,x.w)
  });
  A.set('twdc','TWDC');
  Object.keys(alias).forEach(k=>{
    const t=k.toLowerCase();
    if(A.has(t))alias[k].forEach(f=>{
      const q=scTok(f);
      if(!q.length||q.join(' ')===t)return;
      if(!al.has(q[0]))al.set(q[0],[]);
      al.get(q[0]).push([q,t])
    })
  });
  SCX={A,al,LN,alias};
  return SCX
}
/* 辨識結果（scTok 斷好的字）另外對得到的縮寫和編號：[評分用的字, 從第幾個字, 到第幾個字] */
function scXtra(toks){
  const X=scxInit(),out=[],n=toks?toks.length:0,U=[];
  for(let k=0;k<n;k++){
    const L=X.al.get(toks[k]);
    if(L)L.forEach(([q,t])=>{
      if(q.every((p,j)=>toks[k+j]===p))out.push([t,k,k+q.length-1])
    })
  }
  for(let k=0;k<n;k++){
    const w=toks[k],m=X.LN[w];
    if(w==='double'&&(toks[k+1]==='u'||toks[k+1]==='you')){
      U.push({a:['w'],i:k,j:k+1});
      k++
    }else U.push({a:m?[w,m]:[w],i:k,j:k})
  }
  for(let s=0;s<U.length;s++){
    let cur=[''];
    for(let e=s;e<U.length;e++){
      const nx=new Set();
      U[e].a.forEach(p=>{
        if(p.length<=4)cur.forEach(c=>{
          if(c.length+p.length<=8)nx.add(c+p)
        })
      });
      if(!nx.size)break;
      cur=[...nx];
      if(e>s)cur.forEach(v=>{
        if(X.A.has(v)||(/[a-z]/.test(v)&&/\d/.test(v)))out.push([v,U[s].i,U[e].j])
      })
    }
  }
  return out
}
/* ==================================================================
   4. 句子頁
   句子清單（精選、單字例句、片語、對話、無線電、句型）、關鍵字、單元與篩選、句子表、自動播放、例句檔（data-ex.js、data-ex2.js）載入
   ================================================================== */
let EX_READY=WORDS.length>0&&WORDS.every(x=>x.ex);
let EX_FAIL=false;
const ALLS=[...SENTENCES.map(s=>Object.assign({src:'core'},s)),...wordSents(),...PHRASES.map(x=>({id:'p:'+x.id,en:x.ex,zh:x.exz,keys:[x.p],kzh:x.zh,src:'phrase',cat:x.cat})),...dlgSentences(),...radioSents(),...frameSents()];
const SRC_LABEL={core:'精選',word:'單字例句',phrase:'片語例句',dialog:'對話句',word2:'多益長例句',radio:'無線電用語',frame:'句型替換'};
/* 單字例句另外放在 data-ex.js，開啟後才載入；載入前句子清單先不含單字例句 */
function wordSents(){
  return WORDS.filter(x=>x.ex).map(x=>({id:'w:'+x.w,en:x.ex,zh:x.exz,keys:[x.w],src:'word',book:x.k,toeic:x.toeic}))
}
/* 多益第二個例句（較長的職場例句），例句檔載入後補進句子清單 */
function wordSents2(){
  return WORDS.filter(x=>x.ex2).map(x=>({id:'x:'+x.w,en:x.ex2,zh:x.exz2,keys:[x.w],src:'word2',book:x.k,toeic:x.toeic}))
}
/* V6.2.0 速度：對話句、無線電用語、句型替換的關鍵字事先算好放在 data.js（KWPRE），開啟 App 時直接用，不必每次重算（中階手機約省 0.2 秒）。
   KWPRE.k[句子 id]＝「英文句子的雜湊|關鍵字|關鍵字」：句子改過（雜湊不同）或找不到時，照原本的方法即時計算，所以結果一定一樣；
   KWPRE.x＝計算時加進 KEYX 的說明（CE 縮寫全名、字母代碼、片語、無線電用語），先放進 KEYX。
   字庫（WORDS、DIALOGS、FRAMES、RADIO、PHRASES）有改時，要用工具 data_build.js 重新產生（自動測試 kw 會檢查和即時計算完全相同）。 */
function kwHash(en){
  let h=0x811c9dc5;
  en=String(en||'');
  for(let j=0;j<en.length;j++){
    h^=en.charCodeAt(j);
    h=Math.imul(h,0x01000193)>>>0
  }
  return h.toString(36)
}
function kwPre(id,en){
  const P=window.KWPRE;
  if(KWOFF||!P||!P.k)return null;
  const v=P.k[id];
  if(typeof v!=='string')return null;
  const a=v.split('|');
  return a[0]===kwHash(en)?a.slice(1):null
}
/* 事先算好的 KEYX 說明：開啟 App 建立句子清單時先放進 KEYX（已有的不覆蓋） */
var KWOFF;
function kwPreKeyx(){
  const P=window.KWPRE;
  if(KWOFF||!P||!P.x)return;
  const KXo=window.KEYX=window.KEYX||{};
  Object.keys(P.x).forEach(k=>{
    if(!KXo[k])KXo[k]=P.x[k]
  })
}
/* 對話句、句型替換的關鍵字（即時計算）：句子裡的 CE 字（kwCE：依第一個字分組只建一次；去掉被較長關鍵字包含的字，例如 leak／leak detection；
   CE 縮寫的全名、多字 CE 字的複數也算：open work orders → work order）；不到 2 個時，補上句子裡較進階的字（kwFill）；
   還是沒有關鍵字時，kwLast 最多補 1 個 */
function kwSent(en){
  en=String(en||'');
  const keys=kwCE(en);
  const tk=en.replace(/[^A-Za-z0-9'-]/g,' ').split(' ').filter(Boolean);
  if(keys.length<2)kwFill(tk,keys,2,true);
  if(!keys.length)kwFill(tk,keys,1,true,300);
  if(!keys.length)kwLast(en,keys);
  return keys
}
function dlgSentences(){
  const out=[];
  kwPreKeyx();
  (window.DIALOGS||[]).forEach(d=>d.lines.forEach((L,n)=>{
    const id='d:'+d.id+':'+n,keys=kwPre(id,L.en)||kwSent(L.en);
    out.push({id,en:L.en,zh:L.zh,keys,src:'dialog',dlg:d.id,who:L.s,kzh:d.t})
  }));
  return out
}
/* 重新計算全部關鍵字（不用 KWPRE）：工具 data_build.js 產生 KWPRE、自動測試比對用。KEYX 先換成空的，算完還原 */
function kwBuild(){
  const old=window.KEYX,k={};
  KWOFF=true;
  window.KEYX={};
  try{
    dlgSentences().concat(radioSents(),frameSents()).forEach(s=>{
      k[s.id]=[kwHash(s.en)].concat(s.keys).join('|')
    });
    return {k,x:window.KEYX}
  }finally{
    window.KEYX=old;
    KWOFF=false
  }
}
/* 無線電用語練習句（句子頁可以聽、跟讀、用 🎤 評分） */
function radioSents(){
  /* 關鍵字＝句子裡的無線電用語（Copy、Say again…）＋較進階的字 */
  const R=window.RADIO||{},KXo=window.KEYX=window.KEYX||{};
  const pro=(R.pro||[]).map(p=>[p.en.replace(/[.?!]+$/,''),p.zh.replace(/。$/,'')]);
  return (R.sent||[]).map(r=>{
    const pk=kwPre('r:'+r.id,r.en);
    if(pk)return {id:'r:'+r.id,en:r.en,zh:r.zh,keys:pk,src:'radio'};
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
/* 句型替換的句子。開啟 App 建立句子清單（ALLS）時就會呼叫，這時後面的變數還沒設定：只用 window.FRAMES、kwCE、kwFill、kwLast；
   關鍵字和對話句一樣（先找 CE 字） */
function frameSents(){
  const out=[];
  (window.FRAMES||[]).forEach(f=>{
    if(!f||!Array.isArray(f.items))return;
    f.items.forEach((it,n)=>{
      /* 和對話句一樣（kwSent：先找 CE 字，不到 2 個再用 kwFill 補，還是沒有時 kwLast 最多補 1 個）；有事先算好的（KWPRE）就直接用 */
      const id='f:'+f.id+':'+n,keys=kwPre(id,it.en)||kwSent(it.en);
      out.push({id,en:it.en,zh:it.zh,keys,src:'frame',frame:f.id})
    })
  });
  return out
}
/* 需要單字例句才完整的句子單元（例句載入前不保存這些單元的位置） */
function exNeeded(u){
  return !/^(all|life|ce|pall|pdaily|pwork|pce|pmail|dall|d\d\d|radio|frame|fr\d+)$/.test(u||'')
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
  if(u==='frame')return s.src==='frame';
  if(/^fr\d+$/.test(u))return s.frame===u;
  if(u==='pall')return s.src==='phrase';
  if(/^p(daily|work|ce|mail)$/.test(u))return s.src==='phrase'&&s.cat===u.slice(1);
  if(u==='fav')return cset('fav').has(s.id);
  return s.src==='core'
}
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
  const have=new Set(),c=[];
  keys.forEach(k=>String(k).toLowerCase().split(/[\s-]+/).concat(String(k).toLowerCase()).forEach(x=>have.add(x)));
  const bad=/^(det|prep|pron|conj|aux|interj|contr|num)\./;
  toks.forEach(w0=>{
    /* 速度：字表查詢（含詞形還原）的結果每個字只算一次（kwTok） */
    const x=kwTok(w0);
    if(!x)return;
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
/* ---------- 句子關鍵字補強（對話句、句型替換） ----------
   開啟 App 建立句子清單（ALLS）時就會呼叫，這時下面的變數還沒設定，所以資料都在第一次用到時才建立（var，不給初始值）。
   kwCE：句子裡的 CE 字（WORDS k===7，加上 CE 縮寫的全名：work order ← WO），依第一個字分組只建一次；多字 CE 字的最後一個字
         是複數也算（open work orders → work order、sump pumps → sump pump）；去掉被較長關鍵字包含的字，依字表順序取 2 個。
   kwLast：kwCE、kwFill 都找不到關鍵字時最多補 1 個，依序：① 拼字的無線電字母代碼（B as in bravo → Bravo）；
         ② 編號前面的 CE 縮寫（CHWP-02 → CHWP、UPS-2B → UPS）；③ 片語表裡的片語（get started、shut it down → shut down）。
         都沒有就不補（只剩很基本的字、數字、或不是單字的編號）。中文：字表，或 KEYX（字母代碼、片語）。
   kwTok：kwFill 每個字查字表（含詞形還原）的結果記下來，同一個字不再重找（開啟 App 時不會因為多做上面這些而變慢）。 */
var KWCE,KWPH;
function kwCE(en){
  if(!KWCE){
    KWCE=new Map();
    const C=(window.WORDS||[]).filter(x=>x.k===7&&!x.b),seen=new Set(),put=c=>{
      if(!KWCE.has(c[1][0]))KWCE.set(c[1][0],[]);
      KWCE.get(c[1][0]).push(c)
    };
    C.forEach((x,k)=>{
      const p=x.w.toLowerCase().split(' ');
      seen.add(p.join(' '));
      put([x.w,p,k])
    });
    /* CE 縮寫的全名（中文後面括號裡的英文）也當成多字 CE 字，排在縮寫的位置：work order ← WO（工單） */
    C.forEach((x,k)=>{
      const m=x.acr&&/（([A-Za-z][^）；，]*)/.exec(x.zh||''),p=m?m[1].toLowerCase().replace(/[^a-z0-9-]/g,' ').split(' ').filter(Boolean):[];
      if(p.length<2||seen.has(p.join(' ')))return;
      seen.add(p.join(' '));
      put([p.join(' '),p,k,x])
    })
  }
  const t=String(en||'').toLowerCase().replace(/[^a-z0-9-]/g,' ').split(' ').filter(Boolean),hit=new Set();
  t.forEach((w,j)=>{
    const cs=KWCE.get(w);
    if(cs)cs.forEach(c=>{
      const p=c[1],m=p.length;
      if(p.every((x,q)=>t[j+q]===x||(m>1&&q===m-1&&kwPl(x,t[j+q]))))hit.add(c)
    })
  });
  if(!hit.size)return [];
  const keys=kwDedupe([...hit].sort((a,b)=>a[2]-b[2]||!!a[3]-!!b[3]).map(c=>c[0])).slice(0,2);
  /* 全名當關鍵字時，中文用縮寫的中文（KEYX：n. 工單（縮寫 WO）） */
  hit.forEach(c=>{
    if(!c[3]||!keys.includes(c[0]))return;
    const KXo=window.KEYX=window.KEYX||{};
    if(!KXo[c[0]])KXo[c[0]]={p:'',pos:'n.',zh:String(c[3].zh).split('（')[0]+'（縮寫 '+c[3].w+'）'}
  });
  return keys
}
/* 多字 CE 字最後一個字的複數：orders、switches、batteries */
function kwPl(p,w){
  return !!w&&(w===p+'s'||w===p+'es'||(/[^aeiou]y$/.test(p)&&w===p.slice(0,-1)+'ies'))
}
/* kwFill 用：一個字在字表裡是哪個字（大寫縮寫、原形、詞形還原、併入的原形）；每個字只算一次 */
var KWT;
function kwTok(w0){
  if(!KWT)KWT=new Map();
  let x=KWT.get(w0);
  if(x!==undefined)return x;
  const M=kwMap(),w=String(w0||'').toLowerCase().replace(/'s$/,'');
  x=null;
  if(/^[a-z][a-z'-]*$/.test(w)){
    x=(/[A-Z]/.test(w0.slice(1))&&KWX.get(w0))||M.get(w)||null;
    if(!x)for(const s of lkStems(w))if(M.get(s)){
      x=M.get(s);
      break
    }
    if(x&&x.b&&M.get(String(x.b).toLowerCase()))x=M.get(String(x.b).toLowerCase())
  }
  KWT.set(w0,x);
  return x
}
function kwLast(en,keys){
  if(keys.length)return keys;
  en=String(en||'');
  const KXo=window.KEYX=window.KEYX||{};
  const add=(k,o)=>{
    keys.push(k);
    if(o&&!KXo[k])KXo[k]=o;
    return keys
  };
  const sp=/\b([A-Za-z]) as in ([A-Za-z]+(?:-[A-Za-z]+)?)/i.exec(en);
  if(sp){
    const v=((window.RADIO||{}).abc||[]).find(a=>a[1].toLowerCase()===sp[2].toLowerCase());
    if(v)return add(v[1],{p:'',pos:'字母代碼',zh:v[0]+'（無線電拼字）'})
  }
  kwCE('');
  for(const m of en.match(/\b[A-Za-z]{2,6}(?=-[A-Za-z0-9]*\d)/g)||[]){
    const c=(KWCE.get(m.toLowerCase())||[]).find(c=>c[1].length===1);
    if(c)return add(c[0])
  }
  /* 片語依第一個字分組；第一個字可以有詞形變化（shutting down），兩個字的片語中間可以夾代名詞（shut it down）；最長的片語優先 */
  if(!KWPH){
    KWPH=new Map();
    (window.PHRASES||[]).forEach((p,o)=>{
      const s=String(p.p||'').toLowerCase(),w=s.split(' ');
      if(!/^[a-z]+( [a-z]+)+$/.test(s)||/\b(someone|somebody|something|sb|sth|one|oneself)\b/.test(s)||!p.zh)return;
      if(!KWPH.has(w[0]))KWPH.set(w[0],[]);
      KWPH.get(w[0]).push([p.p,w,p.zh,o])
    })
  }
  const t=en.toLowerCase().replace(/[^a-z]+/g,' ').trim().split(' '),obj=/^(it|them|this|that|him|her|me|us|you)$/;
  let best=null;
  t.forEach((x,j)=>[x].concat(/(s|ed|ing)$/.test(x)?lkStems(x):[]).forEach(f=>(KWPH.get(f)||[]).forEach(c=>{
    const w=c[1];
    if((w.slice(1).every((y,q)=>t[j+1+q]===y)||(w.length===2&&obj.test(t[j+1]||'')&&t[j+2]===w[1]))&&(!best||w.length>best[1].length||(w.length===best[1].length&&c[3]<best[3])))best=c
  })));
  if(best)return add(best[0],{p:'',pos:'片語',zh:best[2]});
  return keys
}
let pool=ALLS.filter(s=>s.src==='core'),i=0,slow=false;
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
  lkClose();
  voiceOnRender(s.id);
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
  rpRender(s);
  {
    const kw=$('#keywords'),kh=kw&&kw.previousElementSibling,emp=!(s.keys&&s.keys.length);
    if(kw)kw.hidden=emp;
    if(kh&&kh.tagName==='H2')kh.hidden=emp
  }
  $('#keywords').innerHTML=s.keys.map(w=>`<div class="key"><div><strong>${dispW(w)}</strong><span>${ipaFor(w)?'/ '+esc(phon(ipaFor(w)))+' /':''}</span><span class="kzh">${esc((WMAP[w]&&WMAP[w].zh)||(KX[w]&&KX[w].pos+' '+KX[w].zh)||s.kzh||'')}</span></div><button data-word="${w}">🔊</button></div>`).join('');
  /* 句型框、看中文說英文 */
  v533Render()
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
    /* 這個範圍沒有句子時明確提示（不默默換成精選句子） */
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
/* 重新篩選時盡量停在同一句 */
function refilter(){
  const id=cur().id;
  filter();
  const k=pool.findIndex(s=>s.id===id);
  if(k>=0)i=k
}
$('#play').onclick=()=>say(cur().en,slow?.67:1);
$('#slow').onclick=()=>{
  slow=!slow;
  $('#slow').textContent='🐢 慢速：'+(slow?'開':'關');
  say(cur().en,slow?.67:1)
};
$('#showZh').onclick=()=>{
  /* 看中文說英文時，「👁 看中文」改成看／藏英文（中文一直顯示） */
  if(zfActive()){
    ZF.rev=!ZF.rev;
    zfApply();
    return
  }
  $('#chinese').hidden=!$('#chinese').hidden
};
$('#repeat').onclick=()=>say(cur().en,slow?.67:1,3);
$('#prev').onclick=()=>{
  if(rpNav(-1))return;
  i=(i-1+pool.length)%pool.length;
  render()
};
$('#next').onclick=()=>{
  if(rpNav(1))return;
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
$('#unit').onchange=()=>{
  rpOff();
  unitNote('');
  let u=$('#unit').value;
  if(u!=='search')store.settings.unit=u;
  /* 記住最後一個一般的句子範圍（今日學習的「句子跟讀」用） */
  if(!/^(sdue|lsw|fav|search)$/.test(u))store.settings.learnUnit=u;
  i=store.settings.pos[u]||0;
  save();
  filter();
  render()
};
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
$('#navPractice').onclick=()=>{
  page('practice');
  refilter();
  render()
};
$('#openList').onclick=()=>{
  page('list');
  list()
};
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
/* 自動播放 */
let autoOn=false,cardAuto=false,autoTok=0;
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
  /* 看中文說英文：念中文 → 停頓讓你說 → 顯示英文、念英文 → 下一句 */
  if(zfActive()){
    const s=cur(),tok=autoTok,rep=+(store.settings.autoRep||2),go=()=>tok===autoTok&&autoOn;
    ZF.id=s.id;
    ZF.rev=false;
    ZF.hint=false;
    zfApply();
    const think=Math.min(8000,Math.max(3000,1500+scTok(s.en).length*500));
    steps([{t:s.zh,l:'zh'},{wait:think}],tok,()=>{
      if(!go())return;
      /* 停頓時換了句子（下一句、換單元…）：不念上一句的英文，從現在這一句重新開始 */
      if(cur().id!==s.id){
        autoSentence();
        return
      }
      if(!ZF.rev){
        ZF.rev=true;
        zfApply()
      }
      const L=[{t:s.en,r:1}];
      if(rep>=2)L.push({wait:500},{t:s.en,r:.7});
      L.push({wait:1200});
      steps(L,tok,()=>{
        if(!go())return;
        if(cur().id===s.id)i=(i+1)%pool.length;
        render();
        autoSentence()
      })
    });
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
/* 在「捕獲階段」先停止自動播放，避免把按鈕剛開始的發音取消；錄音、標記、收藏、複習、換單元也會停止句子自動播放 */
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
/* ---------- 單字例句延後載入：先顯示畫面，再載入 data-ex.js（約 0.4 MB），載入後補進句子清單 ---------- */
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
  /* 多益長例句（data-ex2.js）在單字例句之後才下載；選了長例句單元就立刻下載 */
  setTimeout(()=>loadWordEx2(0),$('#unit').value==='wt2'?0:1500);
  /* 情境題、發音辨別、人名地名（data-more.js）接著下載 */
  setTimeout(()=>loadMore(0),0);
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
  /* 統計頁的句子總數在例句載入後更新 */
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
      if(!$('#todayPage').hidden)renderToday();
      /* 例句下載失敗也照樣下載 data-more.js */
      loadMore(0)
    }
  };
  document.body.appendChild(s)
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
var UEL;
function updEveryLabel(){
  /* 🧩 句型替換（全部＋每個句型）的選項與句數 */
  frUnitOpts();
  const ev=$('#unit option[value="every"]');
  if(ev)ev.textContent=`全部句子（${ALLS.length}）`;
  /* CE 專業字與職場英文的數量依字庫自動顯示。V6.2.0 速度：字庫的數量只算一次（UEL），句子清單只掃一遍（例句載入後會再呼叫） */
  if(!UEL){
    UEL={n7:0,n8:0,nT:0,pc:{}};
    WORDS.forEach(x=>{
      if(x.k===7)UEL.n7++;
      else if(x.k===8)UEL.n8++;
      if(x.toeic)UEL.nT++
    });
    PHRASES.forEach(p=>UEL.pc[p.cat]=(UEL.pc[p.cat]||0)+1)
  }
  const {n7,n8,nT}=UEL;
  let s7=0,s8=0,sT=0,s2=0,nR=0;
  ALLS.forEach(s=>{
    if(s.src==='word'){
      if(s.book===7)s7++;
      else if(s.book===8)s8++;
      if(s.toeic)sT++
    }else if(s.src==='word2')s2++;
    else if(s.src==='radio')nR++
  });
  const set=(sel,t)=>{
    const o=$(sel);
    if(o&&o.textContent!==t)o.textContent=t
  };
  set('#wordBook option[value="7"]',`CE 專業字與縮寫（${n7}）`);
  /* 職場英文＝多益字＋商用英文 */
  set('#wordBook option[value="8"]',`職場英文（多益＋商用，${n8}）`);
  set('#quizBook option[value="8"]',`職場英文（多益＋商用，${n8}）`);
  /* 片語數量依字庫顯示 */
  const nP=PHRASES.length,pc=c=>UEL.pc[c]||0;
  const pg=$('#phUnits');
  if(pg)pg.label=`片語例句（${nP}）`;
  set('#phTotal',`共 ${nP} 個`);
  set('#unit option[value="pall"]',`片語例句・全部（${nP}）`);
  [['daily','日常'],['work','工作'],['ce','CE 現場'],['mail','Email／會議']].forEach(([c,t])=>set(`#unit option[value="p${c}"]`,`片語例句・${t}（${pc(c)}）`));
  set('#unit option[value="w7"]',`CE 專業字例句（${s7||n7}）`);
  set('#unit option[value="w8"]',`職場英文例句（${s8||n8}）`);
  /* TOEIC 多益章節 */
  set('#wordBook option[value="toeic"]',`TOEIC 多益（${nT}）`);
  set('#quizBook option[value="toeic"]',`TOEIC 多益（${nT}）`);
  set('#unit option[value="wt"]',`TOEIC 多益例句（${sT||nT}）`);
  /* 多益長例句、無線電用語 */
  set('#unit option[value="wt2"]',s2?`📖 多益長例句（${s2}）`:(EX_FAIL||EX2_FAIL)?'📖 多益長例句（下載失敗）':'📖 多益長例句（載入中）');
  set('#unit option[value="radio"]',`📻 無線電用語（${nR}）`)
}
/* ==================================================================
   5. 單字頁、片語頁
   單字狀態與複習、例句標示、搜尋與篩選、單字卡（含自動播放）、詞形與相關字、主題；片語清單
   ================================================================== */
const BY_WORD={};
WORDS.forEach(x=>BY_WORD[x.w]=x);
function statusOf(w){
  if(store.wordStatus[w])return store.wordStatus[w];
  if(cset('wordKnown').has(w))return 'known';
  return 'new'
}
function isDue(w){
  return !!store.reviewDue[w]&&store.reviewDue[w]<=day()
}
/* 例句用的是詞形（例如 sprained、buried）時也要標出，避免例句填空直接露出答案 */
function hlForms(w){
  const v=VS[w]||[],l=w.slice(-1),c=w.slice(0,-1);
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
  /* 手機上每個字建一個不分大小寫的 RegExp 約要 2 ms（單字清單一次 60 張卡）：一般英文字用 hlFast（結果和 RegExp 完全相同） */
  const forms=hlForms(x.w),h=hlFast(e,forms);
  if(h!==null)return h;
  const fs=forms.map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
  return r.test(e)?e.replace(r,'$1<mark>$2</mark>'):e
}
/* 例句標示（hlFast）：和 hl0 的 RegExp（不分大小寫、前面不是字母或 '、後面不是字母、先試較長的詞形）結果完全相同（p30_test.js 會比對）；
   詞形含非英文字母（例如 résumé）時回傳 null，改用 RegExp。 */
function hlFast(e,forms){
  const lf=[];
  for(const f of forms){
    for(let k=0;k<f.length;k++)if(f.charCodeAt(k)>127)return null;
    lf.push(f.toLowerCase())
  }
  /* 只把 A–Z 轉小寫（其他字元不動，長度不變；非英文字母永遠不算字母，和 RegExp 的 i 一樣） */
  const le=/[A-Z]/.test(e)?e.replace(/[A-Z]+/g,m=>m.toLowerCase()):e,n=le.length;
  const at=q=>{
    for(let i=0;i<lf.length;i++){
      const f=lf[i];
      if(le.startsWith(f,q)){
        const c=le.charCodeAt(q+f.length);
        if(!(c>=97&&c<=122))return f.length
      }
    }
    return 0
  };
  let L=at(0);
  if(L)return '<mark>'+e.slice(0,L)+'</mark>'+e.slice(L);
  for(let p=0;p<n;p++){
    const c=le.charCodeAt(p);
    if((c>=97&&c<=122)||c===39)continue;
    L=at(p+1);
    if(L)return e.slice(0,p+1)+'<mark>'+e.slice(p+1,p+1+L)+'</mark>'+e.slice(p+1+L)
  }
  return e
}
/* 單字卡第二個例句：標出單字（含詞形） */
function hlx(x,t){
  const e=esc(t);
  const fs=hlForms(x.w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
  return r.test(e)?e.replace(r,'$1<mark>$2</mark>'):e
}
const ST_LABEL={new:'新字',learning:'學習中',review:'待複習',known:'已熟'};
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
      /* 記錄複習時記得或忘記（統計頁的複習答對率） */
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
/* 「全部」只算 5000 原形（不含 CE 專業字與職場英文）
   TOEIC 多益章節＝TOEIC Service List 的字（在 5000、CE 或職場英文裡都算），依多益常用程度排列 */
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
  /* 搜尋字先用預先轉小寫的字比對，接著打字時只在上一次的結果裡找（wordHits；結果和順序都要和逐一比對相同，p30_test.js 會比對） */
  return toeicSort((q?wordHits(q):WORDS).filter(x=>(q||!skipV()||!x.b||x.k===7)&&(tp==='all'||(x.t||[]).includes(tp))&&((q&&book==='all')||inBook(x,book))&&(st==='all'||(st==='fav'&&cset('wordFav').has(x.w))||(st==='review'&&isDue(x.w))||(st==='wrong'&&!!(store.wrongWords||{})[x.w])||(st==='zh'&&x.zh)||(st==='meanweak'&&mrHas(x.w))||(st!=='fav'&&st!=='review'&&st!=='zh'&&st!=='wrong'&&statusOf(x.w)===st))),q?'all':book)
}
/* 搜尋：每個字的小寫只算一次（_lw）；新的搜尋字包含上一次的搜尋字（繼續打字）時，只在上一次的結果裡找 */
var _whC=null;
function wordHits(q){
  const c=_whC&&_whC.n===WORDS.length?_whC:null;
  if(c&&c.q===q)return c.a;
  const src=c&&q.includes(c.q)?c.a:WORDS,a=[];
  for(let k=0;k<src.length;k++){
    const x=src[k];
    if((x._lw||(x._lw=x.w.toLowerCase())).includes(q)||(x.zh&&x.zh.includes(q)))a.push(x)
  }
  _whC={q,a,n:WORDS.length};
  return a
}
/* 上方數字的範圍（冊別、主題、只學原形）：範圍沒變就沿用 */
var _wsc=null;
function wordScope(book,tp,sv){
  const k=book+'|'+tp+'|'+sv;
  if(!_wsc||_wsc.k!==k||_wsc.n!==WORDS.length)_wsc={k,n:WORDS.length,B:WORDS.filter(x=>inBook(x,book)&&!(sv&&x.b&&x.k!==7)&&(tp==='all'||(x.t||[]).includes(tp)))};
  return _wsc.B
}
/* 「已熟／待複習／收藏」的數字和清單用同樣的範圍（冊別、主題、只學原形），點下去的字數會一致 */
function wordStats(n){
  $('#wordCount').textContent=n;
  const book=$('#wordBook').value,tp=$('#wordTopic').value,sv=skipV(),fv=cset('wordFav');
  /* 同一個範圍（冊別、主題、只學原形）的字只篩一次；已熟、收藏、待複習在同一圈算完 */
  const B=wordScope(book,tp,sv),ws=store.wordStatus,kn=cset('wordKnown'),rd=store.reviewDue,t=day();
  let nk=0,nf=0,nd=0;
  for(let k=0;k<B.length;k++){
    const w=B[k].w,s=ws[w];
    if(s?s==='known':kn.has(w))nk++;
    if(fv.has(w))nf++;
    if(rd[w]&&rd[w]<=t)nd++
  }
  $('#wordKnownN').textContent=nk;
  $('#wordFavN').textContent=nf;
  $('#wordDueN').textContent=nd;
  /* 「🧠 意思不熟（N）」的數字（和上面同一個範圍） */
  mrStats(B)
}
function renderWords(){
  if(cardAuto)stopAuto();
  syncWordTools();
  let a=wordFiltered();
  $('#wordRows').hidden=false;
  $('#wordCard').hidden=true;
  wordStats(a.length);
  /* 單字卡：🔊 🐢 ☆ ○ 放在單字那一行，💬 放在例句框右邊（卡片比較矮） */
  _wl=a;
  const tb=$('#wordBook').value==='toeic'&&!$('#wordSearch').value.trim(),fv=cset('wordFav');
  $('#wordRows').innerHTML=a.slice(0,wordShown).map(x=>wordRowHtml(x,tb,fv)).join('');
  if(!a.length)$('#wordRows').innerHTML=`<p class="muted empty-note">${$('#wordSearch').value.trim()?'找不到符合「'+esc($('#wordSearch').value.trim())+'」的單字。':'這個範圍目前沒有符合條件的單字。'}可以換冊別、主題或狀態看看。</p>`;
  $('#wordMore').hidden=wordShown>=a.length;
  /* 「🧠 意思不熟」清單上方可以直接開始意思回想 */
  mrList(a)
}
/* 單字卡的 HTML（局部更新與「顯示更多」共用） */
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
  lkClose();
  window.__cardAt=Date.now();
  /* 意思回想模式由 mrCard 畫卡片（含完成畫面） */
  if(mrCard(x))return;
  if(!x){
    const fin=window.__cardDone;
    window.__cardDone=0;
    const left=window.__cardKind==='review'?wDueN():0,cap=reviewCap(),rv=todayLog().review||0;
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
  /* 只有 mrStart 開的卡片是意思回想，其他入口一律是一般單字卡 */
  mrOpen();
  cardPool=a;
  cardIndex=0;
  cardReveal=false;
  $('#wordRows').hidden=true;
  $('#wordMore').hidden=true;
  $('#wordCard').hidden=false;
  showCard();
  window.scrollTo({top:0,behavior:'smooth'})
}
/* 冊別是一排按鈕（點一下就換；#wordBook 選單留在背景，其他功能照常讀取它的值）；
   「已熟／待複習／收藏」可以直接點，只列出那一類（再點「顯示 N 字」回到全部） */
function syncWordTools(){
  const b=$('#wordBook').value,s=$('#wordState').value;
  wfMark();
  /* 取消「只學原形」時，「全部」也包含詞形，標示跟著改 */
  const ca=$('#bookChips [data-b="all"]');
  if(ca)ca.textContent=skipV()?'全部 5000':'全部＋詞形';
  document.querySelectorAll('#bookChips [data-b]').forEach(x=>x.classList.toggle('on',x.dataset.b===b));
  document.querySelectorAll('#wordPage .word-stats [data-st]').forEach(x=>x.classList.toggle('on',s!=='all'&&x.dataset.st===s))
}
/* ---------- 單字頁：篩選收起來（主題、狀態、只學原形、每日新字） ---------- */
function wfMark(){
  const t=$('#wfToggle');
  if(!t)return;
  const on=$('#wordTopic').value!=='all'||$('#wordState').value!=='all'||!skipV();
  t.classList.toggle('on',on);
  t.textContent=on?'篩選 ●':'篩選 ▾'
}
/* 一次複習 20 個；最早到期（最久沒複習）、階段最低的先出；做完可以「再複習 20 個」 */
function reviewQueue(){
  const st=store.reviewStage||{},rd=store.reviewDue;
  return qShuffle(WORDS.filter(x=>isDue(x.w))).sort((a,b)=>(rd[a.w]<rd[b.w]?-1:rd[a.w]>rd[b.w]?1:0)||((st[a.w]||0)-(st[b.w]||0)))
}
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
  /* 衍生字（happily←happy）與英式用字（petrol＝gas）分開顯示 */
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
/* 主題後面的數字依目前選的範圍計算（冊別＋「只學原形」），和清單顯示的字數一致；換冊時保留已選的主題 */
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
  /* 只加上新的 100 張卡（不整個清單重畫） */
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
/* 每日新字目標從紀錄還原 */
$('#dailyGoal').value=String([10,20,30,50].includes(+store.settings.dailyGoal)?+store.settings.dailyGoal:20);
$('#dailyGoal').onchange=()=>{
  store.settings.dailyGoal=+$('#dailyGoal').value||20;
  save()
};
$('#dailyStart').onclick=()=>{
  let g=+$('#dailyGoal').value||20;
  store.settings.dailyGoal=g;
  save();
  /* 今日新字依單字頁選的冊別＋主題（例如「第 1 冊」＋「電力」只出第 1 冊電力的新字） */
  let book=$('#wordBook').value,tp=$('#wordTopic').value;
  let a=toeicSort(WORDS.filter(x=>statusOf(x.w)==='new'&&inBook(x,book)&&!(skipV()&&x.b&&x.k!==7)&&(tp==='all'||(x.t||[]).includes(tp))),book);
  /* 選的冊別／主題已經沒有新字時，改出其他冊別的新字，並說明 */
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
    /* 意思回想剛換卡時連點兩下，不會直接翻開下一張（要先自己想意思） */
    if(typeof MR!=='undefined'&&MR&&MR.on&&Date.now()-(window.__cardAt||0)<350)return;
    cardReveal=true;
    showCard();
    return
  }
  if(a==='fav'){
    toggleFav(x.w)
  }
  if(a&&a.startsWith('g-')){
    /* 連點兩下不會把下一張還沒看到的卡也評分 */
    if(Date.now()-(window.__cardAt||0)<350)return;
    setStatus(x.w,a.slice(2));
    /* 意思回想的評分另外記錄（意思不熟清單、今天評分的張數）；排程照上一行一般評分更新 */
    mrGraded(x.w,a.slice(2));
    /* 上方「已熟／待複習」數字跟著更新 */
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
$('#navWords').onclick=()=>{
  page('words');
  wordShown=60;
  renderWords()
};
updTopicCounts();
$('#skipVar').checked=skipV();
$('#skipVar').onchange=()=>{
  store.settings.skipVar=$('#skipVar').checked;
  save();
  updTopicCounts();
  wordShown=60;
  renderWords()
};
(function(){
  const t=$('#wfToggle'),p=$('#wfPanel');
  if(!t||!p)return;
  t.onclick=()=>{
    p.hidden=!p.hidden;
    t.setAttribute('aria-expanded',String(!p.hidden))
  };
  wfMark()
})();
/* 片語分類（日常、工作、CE 現場、Email／會議） */
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
  /* 片語卡：🔊 ☆ ○ 放在片語那一行，💬 🐢 放在例句框右邊 */
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
/* ==================================================================
   6. 測驗與錯題本
   單字、片語、句子、聽力、對話填空、CE 情境題、片語聽寫；題型統計；我的錯題本；📈 多益程度估計（非官方）
   ================================================================== */
/* 小手機作答後，答對／答錯的說明和「下一題」常在底部選單下面；作答後自動捲到看得到的位置 */
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
function quiz(){
  qCur='';
  const SQ=pool.length>=4?pool:ALLS;
  let s=SQ[Math.floor(Math.random()*SQ.length)];
  /* 選項的中文不重複 */
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
/* ---------- 單字測驗：英→中、中→英、聽音選字（只使用已有中文的單字） ---------- */
/* 拼字相似度（lev）：共用一個陣列（不每次配置）；給 max 時，距離超過 max 就提早回傳 max+1（出題只需要知道 ≤2、≤3） */
var _levB=[];
function lev(a,b,max){
  if(Math.abs(a.length-b.length)>3)return 9;
  const n=b.length,d=_levB;
  for(let j=0;j<=n;j++)d[j]=j;
  for(let i=1;i<=a.length;i++){
    let p=d[0],lo=i;
    d[0]=i;
    const c=a.charCodeAt(i-1);
    for(let j=1;j<=n;j++){
      const t=d[j];
      let v=p+(c===b.charCodeAt(j-1)?0:1);
      if(t+1<v)v=t+1;
      if(d[j-1]+1<v)v=d[j-1]+1;
      d[j]=v;
      if(v<lo)lo=v;
      p=t
    }
    if(max!=null&&lo>max)return max+1
  }
  return d[n]
}
/* 中文意思拆成幾個義項（去掉括號說明），用來排除「意思重疊」的選項 */
const _senseC=new Map();
function zhSenses(z){
  let r=_senseC.get(z);
  if(!r){
    /* 速度：沒有括號就不跑取代、自己切「；」「;」（結果和 replace／split／trim 相同，p30_test.js 會比對） */
    let s=String(z||'');
    if(s.indexOf('（')>=0||s.indexOf('(')>=0)s=s.replace(/（[^）]*）|\([^)]*\)/g,'');
    r=[];
    for(let k=0,st=0;k<=s.length;k++){
      const c=k<s.length?s.charCodeAt(k):59;
      if(c===59||c===65307){
        const t=s.slice(st,k).trim();
        if(t)r.push(t);
        st=k+1
      }
    }
    _senseC.set(z,r)
  }
  return r
}
function pickOpts(x,pool,n=3){
  let p1=(x.pos||'').split('/')[0];
  const xs=zhSenses(x.zh),dw=dispW(x.w).toLowerCase();
  /* 效能：每個字的小寫、中文義項、詞性、字首字尾先算好存起來，迴圈裡不呼叫 filter／some／split／slice，交換也不建暫存陣列；拼字相似度只算到 3。
     規則、候選字順序、亂數用法都要和舊的寫法一樣：同樣的亂數出同樣的選項（p30_test.js 會比對） */
  const xw=x.w,xz=x.zh,xp=x.p,xb=x.b,xset=new Set(xs);
  /* 排除同音字（聽發音題會變成兩個正確答案）、答案自己的詞形、和答案共用一個中文義項的字、顯示文字相同的字 */
  let cand=[];
  /* V6.4.0 速度：同一個字表第二次出題起，用索引直接標出要排除的字（結果和下面逐一比對完全相同；不用亂數） */
  const PI=pkIdx(pool);
  if(PI){
    const mark=new Uint8Array(pool.length),mk=a=>{
      if(a)for(let m=0;m<a.length;m++)mark[a[m]]=1
    };
    mk(PI.w.get(xw));
    mk(PI.zh.get(xz));
    if(xp)mk(PI.p.get(xp));
    mk(PI.b.get(xw));
    if(xb!==undefined)mk(PI.w.get(xb));
    if(xb)mk(PI.b.get(xb));
    mk(PI.dl.get(dw));
    xset.forEach(z=>mk(PI.s.get(z)));
    for(let k=0;k<pool.length;k++)if(!mark[k])cand.push(pool[k])
  }else for(let k=0;k<pool.length;k++){
    const y=pool[k];
    if(y.w===xw||y.zh===xz||(xp&&y.p===xp)||y.b===xw||xb===y.w||(xb&&y.b===xb))continue;
    if(y._qk===undefined)qPrep(y);
    if((y._dl||(y._dl=dispW(y.w).toLowerCase()))===dw)continue;
    const zs=y._zs;
    let same=false;
    for(let m=0;m<zs.length;m++)if(xset.has(zs[m])){
      same=true;
      break
    }
    if(!same)cand.push(y)
  }
 /* 效能：只對「開頭字母相同、字尾相同或長度相近」的候選字計算拼字相似度，其餘隨機抽樣 */
  if(cand.length>500){
    const a=xw[0],e2=xw.slice(-2);
    const near=[],rest=[];
    for(let k=0;k<cand.length;k++){
      const y=cand[k];
      if(y.w[0]===a||y._qe===e2)near.push(y);else rest.push(y)
    }
    for(let k=rest.length-1;k>0;k--){
      const j=Math.floor(Math.random()*(k+1)),t=rest[k];
      rest[k]=rest[j];
      rest[j]=t
    }
    const m=Math.max(150,500-near.length);
    if(rest.length>m)rest.length=m;
    cand=near.concat(rest)
  }
  const x0=xw[0],x3=xw.slice(0,3),xl=xw.length,sc=new Array(cand.length);
  for(let k=0;k<cand.length;k++){
    const y=cand[k];
    if(y._qk===undefined)qPrep(y);
    let s=Math.random()*1.5;
    if(y._qp===p1)s+=3;
    if(y.w[0]===x0)s+=1;
    if(y._qk===x3)s+=2;
    const L=lev(xw,y.w,3);
    if(L<=2)s+=3;else if(L<=3)s+=1.5;
    if(Math.abs(y.w.length-xl)<=1)s+=.5;
    sc[k]=[s,y]
  }
  sc.sort((a,b)=>b[0]-a[0]);
  /* 選項的中文、英文都不重複 */
  const out=[],sz=new Set([xz]),sw=new Set([dw]);
  const top=sc.slice(0,12).map(v=>v[1]).sort(()=>Math.random()-.5);
  for(let k=0;k<sc.length;k++){
    const y=k<top.length?top[k]:sc[k][1];
    const yw=y._dl||dispW(y.w).toLowerCase();
    if(sz.has(y.zh)||sw.has(yw))continue;
    sz.add(y.zh);
    sw.add(yw);
    out.push(y);
    if(out.length>=n)break
  }
  return out
}
/* 出題選項的索引（V6.4.0）：字表 → 拼字、中文、音標、原形、顯示文字、中文義項各自對到哪些位置。
   同一個字表（同一個陣列）用到第二次才建立；字表長度變了就重建。 */
const _pkI=new WeakMap();
function pkIdx(pool){
  if(!pool||pool.length<200)return null;
  let r=_pkI.get(pool);
  if(!r){
    _pkI.set(pool,{n:-1});
    return null
  }
  if(r.n===pool.length)return r;
  const M=()=>new Map(),put=(m,k,i)=>{
    const a=m.get(k);
    if(a)a.push(i);else m.set(k,[i])
  };
  r={n:pool.length,w:M(),zh:M(),p:M(),b:M(),dl:M(),s:M()};
  for(let k=0;k<pool.length;k++){
    const y=pool[k];
    if(y._qk===undefined)qPrep(y);
    if(!y._dl)y._dl=dispW(y.w).toLowerCase();
    put(r.w,y.w,k);
    put(r.zh,y.zh,k);
    if(y.p)put(r.p,y.p,k);
    put(r.b,y.b,k);
    put(r.dl,y._dl,k);
    const zs=y._zs;
    for(let m=0;m<zs.length;m++)if(zs.indexOf(zs[m])===m)put(r.s,zs[m],k)
  }
  _pkI.set(pool,r);
  return r
}
/* ---------- 測驗出題：每個字只算一次的資料 ----------
   _dl 顯示用小寫、_zs 中文義項、_qp 主要詞性、_qk 前 3 個字母、_qe 最後 2 個字母 */
function qPrep(y){
  if(!y._dl)y._dl=dispW(y.w).toLowerCase();
  if(!y._zs)y._zs=zhSenses(y.zh);
  y._qp=(y.pos||'').split('/')[0];
  y._qe=y.w.slice(-2);
  y._qk=y.w.slice(0,3)
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
function quizResult(x,ok,extra='',mode,sid){
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
  /* V6.3.0：記下答錯的出處（例句填空＝單字例句；放回原句＝那一句）；這次沒有句子時保留之前記的句子；移出答錯單字本時一起刪掉 */
  wsrcSet(x.w,ok,mode||'en',sid||(mode==='cloze'?'w:'+x.w:''));
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
  /* 答錯單字本的錯誤選項只用原形字（不會出現答案自己的變化形） */
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
    /* 按鈕在出題當下就綁定（延後綁定時，連續快速按「下一題」可能出錯） */
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
  /* 新題目：作答後的自動捲動重設，回到題目位置 */
  _qrv=0;
  if(!$('#quiz').hidden&&window.scrollY>0)window.scrollTo(0,0);
  if(window.P6QUIZ&&window.P6QUIZ[t])return window.P6QUIZ[t]();
  t==='word'?wordQuiz():t==='phrase'?phraseQuiz():quiz()
}
$('#newQuiz').onclick=runQuiz;
['quizType','quizMode','quizBook'].forEach(id=>$('#'+id).onchange=()=>{
  let t=$('#quizType').value;
  /* 單字、片語測驗都有出題方式的選項（片語也有聽寫拼字題） */
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
/* ---------- 分題型統計 ---------- */
const QT_LABEL={'w-en':'單字：看英文選中文','w-zh':'單字：看中文選英文','w-listen':'單字：聽發音選單字','w-cloze':'單字：例句填空','w-dict':'單字：聽寫拼字','w-ctx':'單字：放回原句','phrase':'片語測驗','p-dict':'片語：聽寫拼字','sentence':'句子測驗','lisen':'聽英文句子選中文','liszh':'看中文聽選英文','dcloze':'對話填空','situ':'CE 情境題','radio':'無線電代號與數字','pairs':'發音辨別'};
let qCur='';
function qStat(type,ok){
  store.qStat=store.qStat&&typeof store.qStat==='object'&&!Array.isArray(store.qStat)?store.qStat:{};
  const v=Array.isArray(store.qStat[type])?store.qStat[type]:[0,0];
  v[ok?0:1]=(+v[ok?0:1]||0)+1;
  store.qStat[type]=v;
  if(!store.qStatSince)store.qStatSince=day()
}
/* 片語測驗 */
/* 片語填空可以對到變化形（looking for、makes sense、called off）
   和中間插入受詞的片語（pick you up、fill me in、bring it up）；只認一模一樣的寫法時，25 個片語出不了填空題 */
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
  /* 聽寫（拼字）是真的聽寫題（pdQuiz）；綜合也會出聽寫 */
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
/* ---------- 聽力、對話填空、CE 情境題 ---------- */
const SITQ=window.SITQ||[];
/* 情境題在 data-more.js（開啟後才下載）：選單先顯示（載入中），下載完改成題數 */
moreLabels();
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
/* 聽力題、對話填空答錯 → 加入「📕 測驗答錯的句子」；標過「會說」的句子排入今天的 🔁 待複習 */
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
function dcWords(t){
  return (t.match(/[A-Za-z][A-Za-z0-9'-]*/g)||[]).filter(w=>w.length>=3&&!DC_STOP.has(w.toLowerCase()))
}
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
const DC_STOP=new Set('the a an and or but to of in on at for with from by is are was were be been am it its it\'s this that these those i you we they he she me us them my your our their can could will would should do does did have has had not no yes ok okay please there here what which who when where how just so if then than also all any some one two let\'s let i\'m you\'re we\'re that\'s don\'t can\'t won\'t i\'ll we\'ll you\'ll go get got up out now right sure thanks thank hi hello'.split(' '));
let _dcPool=null;
const _dcR=new Map();
function dcRe(w){
  let r=_dcR.get(w);
  if(!r){
    r=new RegExp('\\b'+w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b');
    _dcR.set(w,r)
  }
  return r
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
  /* V6.4.0 速度：每個字的比對規則只建一次（_dcR） */
  let pool=dcPool().filter(w=>w.toLowerCase()!==ans.toLowerCase()&&!dcRe(w).test(lineLow)&&(/^[A-Z0-9-]{2,}$/.test(w)===isAc));
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
    $('#quizMsg').innerHTML=`${ok?'✅ 答對了！':'❌ 正確答案：'+esc(ans)}<br><b>${esc(L.en)}</b><br><small>${esc(L.zh)}</small>`+qWrongMark('d:'+d.id+':'+n,ok)+dcWordMark(ans,'d:'+d.id+':'+n,ok);
    say(L.en,.9)
  })
}
function situQuiz(fq){
  if(fq&&!fq.opts)fq=null;
  qCur='situ';
  if(!SITQ.length){
    if(moreWait('situ'))return;
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
let wbFrom='quiz';
/* ---------- 我的錯題本：整合答錯的單字、句子（聽力、對話填空）、情境題、片語聽寫 ---------- */
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
  /* 情境題資料（data-more.js）還沒下載完：先用答錯紀錄算數量（wait），下載完再顯示題目 */
  const situs=(MORE_READY||SITQ.length?Object.keys(sq).map(id=>({k:id,n:sq[id],q:SITQ.find(q=>q.id===id)})).filter(o=>o.q):Object.keys(sq).map(id=>({k:id,n:sq[id],q:null,wait:1}))).sort(by);
  /* 片語聽寫答錯的片語也算（今日頁、統計頁、混合練習都用 wbData） */
  const phr=pdWrongItems();
  return {words,sents,situs,total:words.length+sents.length+situs.length+phr.length,phr}
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
  (D.words.length?`<h3>單字（${D.words.length}）<button class="mini" data-wbgo="w">練習</button><button class="mini" data-wbgo="wc">🧩 放回原句</button></h3><div class="wb-list">${D.words.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(dispW(o.k))}</b><small>${esc(o.x.zh||'')}</small>${wsrcLabel(o.k)?`<small class="wb-src">出處：${esc(wsrcLabel(o.k))}</small>`:''}</span><small class="wb-n">還要答對 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.k)}" aria-label="播放">🔊</button><button class="mini" data-wbdel="w|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.words,50)}`:'')+
  (D.sents.length?`<h3>句子（${D.sents.length}）<button class="mini" data-wbgo="s">聽力練習</button><button class="mini" data-wbgo="sp">跟讀</button></h3><div class="wb-list">${D.sents.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(o.s.en)}</b><small>${esc(o.s.zh)}｜${esc(wbSrc(o.s))}</small></span><small class="wb-n">錯 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.s.en)}" aria-label="播放">🔊</button><button class="mini" data-wbdel="s|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.sents,50)}`:'')+
  (D.situs.length?`<h3>情境題（${D.situs.length}）<button class="mini" data-wbgo="q">練習</button></h3>${D.situs[0].wait?moreWbHtml():`<div class="wb-list">${D.situs.slice(0,50).map(o=>`<div class="wb-row"><span class="wb-main"><b>${esc(o.q.sit)}</b><small>正確說法：${esc(o.q.opts[o.q.ans])}</small></span><small class="wb-n">錯 ${o.n} 次</small><button class="mini" data-wbsay="${esc(o.q.opts[o.q.ans])}" aria-label="播放">🔊</button><button class="mini" data-wbdel="q|${esc(o.k)}" aria-label="移除">✕</button></div>`).join('')}</div>${more(D.situs,50)}`}`:'')+
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
    /* 移除後顯示「復原」 */
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
  if(v==='wc'){
    $('#quizType').value='wctx'
  }else if(v==='w'){
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
/* ---------- V6.3.0 錯字放回原句重考 ----------
   答錯的單字記下出處（store.wrongSrc，見 v630Norm）。「🧩 放回原句」：把字挖空放回答錯的那一句（對話句會先顯示前一句），
   可以播放這一句、選答案或直接輸入（輸入原形或句子裡的樣子都算對）。沒有記到句子時，依序用：含這個字的 CE 對話句、單字例句、多益長例句。
   答對、答錯和一般單字測驗一樣（quizResult：答對減 1、答錯加 2）。對話填空答錯時，空格的字（字表裡有的）也放進答錯單字本，出處是那一句。 */
function wsrcSet(w,ok,q,sid){
  const ww=store.wrongWords||{};
  if(ok){
    if(!ww[w]&&store.wrongSrc)delete store.wrongSrc[w];
    return
  }
  if(!_isObj(store.wrongSrc))store.wrongSrc={};
  const o=_isObj(store.wrongSrc[w])?store.wrongSrc[w]:{},e={q,d:day()};
  if(sid||o.s)e.s=sid||o.s;
  store.wrongSrc[w]=e
}
function dcWordMark(ans,id,ok){
  let x=null;
  try{
    x=kwTok(ans)
  }catch(e){}
  if(!x||!x.zh||!WMAP[x.w])return '';
  const ww=store.wrongWords=store.wrongWords||{};
  if(ok){
    if(ww[x.w]){
      ww[x.w]--;
      if(ww[x.w]<=0)delete ww[x.w];
      wsrcSet(x.w,true,'dc');
      save()
    }
    return ''
  }
  ww[x.w]=(ww[x.w]||0)+2;
  wsrcSet(x.w,false,'dc',id);
  save();
  return `<br><small>「${esc(dispW(x.w))}」已加入答錯單字本（錯題本可以「🧩 放回原句」重考）</small>`
}
/* 出處的說明（錯題本、放回原句題目上方） */
function wsrcLabel(w,id){
  const o=(store.wrongSrc||{})[w]||{},s=id||o.s||'';
  const m=/^d:(d\d+):(\d+)$/.exec(s);
  if(m&&DLG_BY[m[1]])return (o.q==='rp'&&!id?'🎭 Role Play「':'💬 對話「')+DLG_BY[m[1]].t+'」';
  if(/^f:/.test(s))return '🧩 句型替換';
  if(/^w:/.test(s))return '📝 單字例句';
  if(/^x:/.test(s))return '📖 多益長例句';
  return o.q?(QT_LABEL['w-'+o.q]||'').replace(/^單字：/,'')||'':''
}
/* 句子裡找這個字（含詞形）：回傳挖空前後的文字和句子裡的樣子 */
/* V6.4.0 速度：每個字的比對規則只建一次（_cxR）；含這個字的對話句也只找一次（_cxD） */
const _cxR=new Map(),_cxD=new Map();
function ctxCut(x,en){
  if(!en)return null;
  let r=_cxR.get(x.w);
  if(!r){
    const fs=hlForms(x.w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    r=new RegExp('(^|[^A-Za-z\'])('+fs.join('|')+')(?![A-Za-z])','i');
    _cxR.set(x.w,r)
  }
  const m=r.exec(en);
  if(!m)return null;
  const at=m.index+m[1].length;
  return {pre:en.slice(0,at),hit:m[2],post:en.slice(at+m[2].length)}
}
/* 放回原句用的句子：記到的出處 → 含這個字的 CE 對話句 → 單字例句 → 多益長例句 */
function ctxFind(x){
  const o=(store.wrongSrc||{})[x.w]||{},c=[];
  const dl=id=>{
    const m=/^d:(d\d+):(\d+)$/.exec(id),d=m&&DLG_BY[m[1]],L=d&&d.lines[+m[2]];
    return L?{id,en:L.en,zh:L.zh,who:L.s,prev:d.lines[+m[2]-1]||null}:null
  };
  if(o.s){
    if(/^d:/.test(o.s))c.push(dl(o.s));
    else if(o.s==='w:'+x.w)c.push(x.ex?{id:o.s,en:x.ex,zh:x.exz}:null);
    else if(o.s==='x:'+x.w)c.push(x.ex2?{id:o.s,en:x.ex2,zh:x.exz2}:null);
    else{
      const t=sById(o.s);
      c.push(t?{id:o.s,en:t.en,zh:t.zh}:null)
    }
  }
  let hits=_cxD.get(x.w);
  if(!hits){
    hits=[];
    for(const d of DIALOGS){
      for(let n=0;n<d.lines.length&&hits.length<20;n++)if(ctxCut(x,d.lines[n].en))hits.push('d:'+d.id+':'+n);
      if(hits.length>=20)break
    }
    _cxD.set(x.w,hits)
  }
  if(hits.length)c.push(dl(hits[Math.floor(Math.random()*hits.length)]));
  if(x.ex)c.push({id:'w:'+x.w,en:x.ex,zh:x.exz});
  if(x.ex2)c.push({id:'x:'+x.w,en:x.ex2,zh:x.exz2});
  for(const s of c){
    const k=s&&ctxCut(x,s.en);
    if(k)return Object.assign(s,k)
  }
  return null
}
let _ctxLast='';
function wctxQuiz(fx){
  if(fx&&!fx.w)fx=null;
  qCur='';
  const ww=store.wrongWords||{};
  let pool=fx?[fx]:WORDS.filter(x=>ww[x.w]>0&&WMAP[x.w]===x);
  if(!pool.length){
    qEmpty('🎉 答錯單字本是空的。單字測驗、對話填空答錯的字會放在這裡，可以放回原來的句子重考。');
    return
  }
  pool=qShuffle(pool.slice());
  if(pool.length>1&&pool[0].w===_ctxLast)pool.push(pool.shift());
  let x=null,c=null;
  for(const y of pool.slice(0,40)){
    c=ctxFind(y);
    if(c){
      x=y;
      break
    }
  }
  /* 找不到句子（例句還在下載等）：改出一般單字題 */
  if(!x)return wordQuiz(pool[0]);
  _ctxLast=x.w;
  const base=window.__baseW=window.__baseW||WORDS.filter(y=>!y.b||y.k===7);
  const opts=qShuffle([x,...pickOpts(x,base)]);
  const P=c.prev,lab=wsrcLabel(x.w,c.id);
  $('#quizQ').innerHTML=`<small class="muted">🧩 放回原句${lab?'｜'+esc(lab):''}</small><div class="dc-ctx cx-ctx">${P?`<div class="dc-l"><b>${esc(P.s)}</b> ${esc(P.en)} <button type="button" class="mini" data-cx="prev" aria-label="播放前一句">🔊</button></div>`:''}<div class="dc-l dc-q">${c.who?`<b>${esc(c.who)}</b> `:''}${esc(c.pre)}<span class="blank">_____</span>${esc(c.post)}</div><small>${esc(c.zh||'')}</small></div><div class="cx-play"><button type="button" class="mini" data-cx="play">🔊 播放這一句</button><button type="button" class="mini" data-cx="slow">🐢 慢速</button></div><small class="muted">選出空格的字（選項是原形），或直接輸入</small>`;
  $('#quizMsg').textContent='';
  $('#quizOpts').innerHTML=opts.map(o=>`<button data-ok="${o.w===x.w}">${esc(dispW(o.w))}</button>`).join('')+`<div class="cx-type"><input id="cxIn" aria-label="輸入空格的字" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="或輸入空格的字"><button type="button" id="cxGo">確認</button></div>`;
  const full=c.pre+c.hit+c.post;
  $('#quizQ').onclick=e=>{
    const b=e.target.closest('[data-cx]');
    if(!b)return;
    const v=b.dataset.cx;
    if(v==='prev'&&P)say(P.en,.9);else if(v==='play')say(full,.9);else if(v==='slow')say(full,.65)
  };
  let done=false;
  const fin=(ok,extra)=>{
    done=true;
    $('#quizOpts').querySelectorAll('button,input').forEach(b=>b.disabled=true);
    const r=$('#quizOpts').querySelector('[data-ok=true]');
    if(r)r.classList.add('opt-ok');
    quizResult(x,ok,extra,'ctx',c.id);
    $('#quizMsg').insertAdjacentHTML('beforeend',`<div class="cx-full"><b>${esc(c.pre)}<mark>${esc(c.hit)}</mark>${esc(c.post)}</b><br><small>${esc(c.zh||'')}</small></div>`);
    save()
  };
  $('#quizOpts').onclick=e=>{
    const b=e.target.closest('button[data-ok]');
    if(!b||done)return;
    const ok=b.dataset.ok==='true';
    if(!ok)b.classList.add('opt-bad');
    fin(ok,'')
  };
  const inp=$('#cxIn'),go=()=>{
    if(done)return;
    const v=inp.value.trim().toLowerCase().replace(/[’]/g,"'");
    if(!v)return;
    const ok=[c.hit,x.w,dispW(x.w)].some(t=>String(t).toLowerCase()===v);
    fin(ok,`<br><small>你輸入的是：${esc(v)}</small>`)
  };
  $('#cxGo').onclick=go;
  inp.onkeydown=e=>{
    if(e.key==='Enter')go()
  }
}
function wrongMixQuiz(){
  const D=wbData();
  /* 情境題資料還沒下載完先等（下載完自動出題）；下載失敗時先練其他錯題 */
  if(D.situs.length&&D.situs[0].wait){
    if(!MORE_FAIL||D.total===D.situs.length){
      if(moreWait('wrongmix'))return
    }else{
      D.total-=D.situs.length;
      D.situs=[]
    }
  }
  if(!D.total){
    qEmpty('🎉 錯題本是空的，太棒了！');
    return
  }
  const all=[...D.words.map(o=>['w',o]),...D.sents.map(o=>['s',o]),...D.situs.map(o=>['q',o]),...(D.phr||[]).map(o=>['p',o])];
  let p=all[Math.floor(Math.random()*all.length)];
  if(all.length>1&&p[1].k===store.wbLast)p=all[(all.indexOf(p)+1)%all.length];
  store.wbLast=p[1].k;
  /* V6.3.0：錯字有一半放回原句（找得到句子時） */
  if(p[0]==='w'&&Math.random()<.5&&ctxFind(p[1].x))wctxQuiz(p[1].x);else if(p[0]==='w')wordQuiz(p[1].x);else if(p[0]==='s')lisEnQuiz(p[1].s);else if(p[0]==='p')pdQuiz(p[1].x);else situQuiz(p[1].q);
  $('#quizQ').insertAdjacentHTML('afterbegin',`<small class="muted wb-tag">📕 錯題本混合練習（剩 ${D.total} 題）</small><br>`)
}
window.P6QUIZ={lisen:lisEnQuiz,liszh:lisZhQuiz,dcloze:dcQuiz,situ:situQuiz,wrongmix:wrongMixQuiz,radio:radioQuiz,pairs:pairsQuiz,wctx:wctxQuiz};
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
/* ---------- 片語聽寫（拼字） ----------
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
/* ---------- 📈 多益程度估計（非官方） ----------
   約 20 分鐘、40 題，看大概的多益聽力、閱讀程度和進步趨勢（不是正式分數；建議每 4～6 週做一次）：
     聽力 20：應答問題 10（題本；念題目，再念 A、B、C 三個回答，畫面只有 A／B／C 按鈕）、聽句子選意思 10（多益長例句）
     閱讀 20：句子填空 12（多益長例句裡的名詞）、短文 4 篇×2 題（題本；作答時文章一直顯示）
   題本在 data-toeic.js（開啟 App 時不下載；說明頁、作答、檢討用到時才下載，下載中／下載失敗＋重新下載，和 data-more.js 一樣），
   有 A、B、C 三份，依完成的估計輪流（A → B → C → A）。多益長例句（data-ex2.js）的題目每次隨機，避開上一次用過的句子。
   每題只能「🔁 再聽一次」一次；換頁或 App 切到背景時停止播放（沒播完的題目回來可以重新播放，不算重聽）。
   作答進度存在 localStorage 的 e5k_toeic_run：同一天可以繼續，也可以放棄；做完後留著給「結果與紀錄」看檢討，下次開始時取代。
   結果存在 store.toeicEst（最多 50 筆）；自己輸入的正式成績存在 store.toeicOfficial（最多 20 筆），只用來對照，不改動估計紀錄。
   不計入題型統計（qStat）、測驗正確率和錯題本（做完只記一天學習天數）。
   計分（聽力、閱讀分開算）：先扣掉猜對的期望值 p'＝max(0,(答對−Σ1/k)/(題數−Σ1/k))（k＝每題的選項數），
   分數＝5＋490×p'，取 5 的倍數；範圍＝分數±50（限 5–495），合計範圍＝兩部分範圍相加。每部分只有 20 題，只是粗略估計。 */
var TQ_READY,TQ_FAIL,TQ_LOADING,TQ_TRY,TQ_T;
const TQ_KEY='e5k_toeic_run';
/* 題型：部分（L 聽力／R 閱讀）、圖示、名稱、作答說明 */
const TQ_PART={qr:['L','🎧','應答問題','聽題目和 A、B、C 三個回答，選出最適當的回答（回答不會顯示在畫面上）。'],lm:['L','🎧','聽句子選意思','聽英文句子，選出正確的中文意思。'],sf:['R','📝','句子填空','選出最適合填入空格的字。'],rd:['R','📄','短文閱讀','閱讀文章，回答問題（文章會一直顯示）。']};
const TQ_PT={email:'📧 電子郵件',notice:'📌 公告',memo:'📝 備忘錄',chat:'💬 訊息'};
/* ETS 公布的各級最低分數（聽力、閱讀分開）；ETS 說明這些是參考指引，不是門檻分數 */
const TQ_CEFR={L:[[490,'C1'],[400,'B2'],[275,'B1'],[110,'A2'],[60,'A1']],R:[[455,'C1'],[385,'B2'],[275,'B1'],[115,'A2'],[60,'A1']]};
const TQ={from:'stats',view:'intro',run:null,tok:0,pt:0,wd:0,playing:false,t0:0,readyAt:0,poll:0,sig:'',ex2k:0,need:false,oform:false,msg:''};
/* 讀取／匯入學習紀錄時整理（由 normStore 呼叫；開啟 App 時很早就執行，只用第 1 段的工具） */
function tqYmdOk(d){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||'');
  if(!m)return false;
  const t=new Date(+m[1],+m[2]-1,+m[3]);
  return t.getFullYear()===+m[1]&&t.getMonth()===+m[2]-1&&t.getDate()===+m[3]
}
function toeicNorm(s){
  const sc=v=>{
    v=typeof v==='string'&&v.trim()?Number(v):v;
    return Number.isInteger(v)&&v>=5&&v<=495&&v%5===0?v:undefined
  };
  const pr=v=>{
    if(!Array.isArray(v)||v.length!==2)return undefined;
    const c=v[0],n=v[1];
    return Number.isInteger(c)&&Number.isInteger(n)&&n>=1&&n<=40&&c>=0&&c<=n?[c,n]:undefined
  };
  const est=[],off=[];
  try{
    if(Array.isArray(s.toeicEst))s.toeicEst.forEach(e=>{
      const d=_isObj(e)&&tqYmdOk(e.date)?e.date:'',L=d?sc(e.estL):undefined,R=d?sc(e.estR):undefined;
      if(!d||L===undefined||R===undefined)return;
      const p={},sec=Math.floor(_num(e.seconds));
      ['qr','lm','sf','rd'].forEach(k=>{
        const v=_isObj(e.parts)?pr(e.parts[k]):undefined;
        if(v)p[k]=v
      });
      est.push({date:d,form:['A','B','C'].includes(e.form)?e.form:'A',parts:p,estL:L,estR:R,seconds:sec>0?Math.min(sec,86400):0})
    });
    if(Array.isArray(s.toeicOfficial))s.toeicOfficial.forEach(e=>{
      const d=_isObj(e)&&tqYmdOk(e.date)?e.date:'',L=d?sc(e.L):undefined,R=d?sc(e.R):undefined;
      if(d&&L!==undefined&&R!==undefined)off.push({date:d,L,R})
    })
  }catch(x){}
  s.toeicEst=est.slice(-50);
  s.toeicOfficial=off.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).slice(-20)
}
/* ---------- 題本 data-toeic.js：用到時才下載（重試 2 次；失敗就顯示「重新下載」） ---------- */
function tqHave(){
  const F=(window.TOEIC_BANK||{}).forms;
  return !!F&&['A','B','C'].every(f=>F[f]&&Array.isArray(F[f].qr)&&F[f].qr.length>=10&&Array.isArray(F[f].rd)&&F[f].rd.length>=4)
}
function tqMerge(){
  if(TQ_READY||!tqHave())return;
  TQ_READY=true;
  TQ_FAIL=false;
  TQ_LOADING=false;
  clearTimeout(TQ_T);
  TQ_T=0;
  tqRefresh()
}
function tqLoad(tries){
  tries=tries||0;
  if(TQ_READY||TQ_LOADING)return;
  if(tqHave()){
    tqMerge();
    return
  }
  clearTimeout(TQ_T);
  TQ_T=0;
  TQ_TRY=tries;
  TQ_LOADING=true;
  window.__toeicBank=tqMerge;
  const s=document.createElement('script');
  let end=false;
  const fail=()=>{
    if(end)return;
    end=true;
    s.remove();
    TQ_LOADING=false;
    if(TQ_READY)return;
    if(tries<2)TQ_T=setTimeout(()=>{
      TQ_T=0;
      tqLoad(tries+1)
    },1500*(tries+1));else{
      TQ_FAIL=true;
      tqRefresh()
    }
  };
  s.src='data-toeic.js';
  s.async=true;
  s.onload=()=>{
    if(!TQ_READY&&tqHave())tqMerge();
    if(!TQ_READY)return fail();
    end=true;
    TQ_LOADING=false
  };
  s.onerror=fail;
  document.body.appendChild(s)
}
/* 按「重新下載」：正在等下一次重試就馬上重試；已經失敗就再試一次 */
function tqNeed(){
  if(TQ_READY)return true;
  if(TQ_LOADING)return false;
  if(TQ_T){
    clearTimeout(TQ_T);
    TQ_T=0;
    tqLoad((TQ_TRY||0)+1)
  }else if(TQ_FAIL){
    TQ_FAIL=false;
    tqLoad(2)
  }else tqLoad(0);
  return false
}
/* 多益長例句（data-ex2.js）：單字例句（data-ex.js）載入後才能下載（不然長例句會重複加進句子清單）；用到時馬上開始下載，不等原本的 1.5 秒 */
function tqEx2(){
  if(EX2_READY)return 'ok';
  if(!EX_READY)return EX_FAIL?'fail':'wait';
  if(window.__ex2Loading)return 'wait';
  if(EX2_FAIL)return 'fail';
  if(!TQ.ex2k){
    TQ.ex2k=1;
    loadWordEx2(0)
  }
  return EX2_READY?'ok':'wait'
}
/* 題目要用的資料（題本、多益長例句）：ok／wait（下載中）／fail（下載失敗）；還沒開始下載就開始，失敗後不自動重試 */
function tqSt(){
  TQ.need=true;
  if(!TQ_READY&&!TQ_FAIL&&!TQ_LOADING&&!TQ_T)tqLoad(0);
  const b=TQ_READY?'ok':TQ_FAIL?'fail':'wait',x=tqEx2();
  return b==='fail'||x==='fail'?'fail':b==='ok'&&x==='ok'?'ok':'wait'
}
function tqRetry(){
  if(!TQ_READY)tqNeed();
  if(!EX_READY&&EX_FAIL){
    EX_FAIL=false;
    loadWordEx(3)
  }else if(EX_READY&&!EX2_READY&&!window.__ex2Loading&&EX2_FAIL){
    EX2_FAIL=false;
    loadWordEx2(2)
  }
  tqRender()
}
function tqStHtml(st){
  if(st==='ok')return '';
  return st==='fail'?'<div class="rec-msg warn tq-st" role="status">⚠️ 題目資料下載失敗（網路不穩）。請連上網路後按「重新下載」。<div class="tq-btns"><button type="button" class="primary" data-tq="retry">🔄 重新下載</button></div></div>':'<p class="rec-msg tq-st" role="status">⏳ 題目資料下載中，請稍候…</p>'
}
/* 下載完成（或失敗）：正在看多益頁就更新畫面；等資料時每 0.4 秒檢查一次（多益長例句的下載沒有通知） */
function tqSig(){
  return (TQ_READY?1:TQ_FAIL?2:0)+''+(EX2_READY?1:EX_FAIL||EX2_FAIL?2:0)+(EX_READY?1:0)
}
function tqVis(){
  const p=$('#toeicPage');
  return !!p&&!p.hidden
}
function tqRefresh(){
  if(tqVis())tqRender()
}
function tqWatch(){
  if(TQ.poll||(TQ_READY&&EX2_READY))return;
  TQ.poll=setInterval(()=>{
    if(!tqVis()){
      clearInterval(TQ.poll);
      TQ.poll=0;
      return
    }
    if(tqSig()!==TQ.sig)tqRender();
    if(TQ_READY&&EX2_READY){
      clearInterval(TQ.poll);
      TQ.poll=0
    }
  },400)
}
window.addEventListener('online',()=>{
  if(tqVis()&&(TQ_FAIL||EX2_FAIL||EX_FAIL))tqRetry()
});
/* ---------- 作答進度（localStorage e5k_toeic_run） ----------
   {v:1, d:開始日期, form:題本, items:[題目], ans:[作答（顯示的第幾個選項）], rep:[已重聽], heard:[已播完], i:目前第幾題, sec:作答秒數,
    gen:這次用到的多益長例句, avoid:這次避開的句子, done:做完了, est:做完的估計}
   每題 {t:題型, c:正確答案是第幾個, n:選項數, ...}：qr／rd 記題本編號和選項順序 o；lm 記句子 w 和 4 個選項句子 o；sf 記句子 w、空格位置 at、len 和選項 o、原形 b */
function tqRunGet(){
  try{
    const r=JSON.parse(lsGet(TQ_KEY)||'null');
    if(_isObj(r)&&r.v===1&&Array.isArray(r.items)&&Array.isArray(r.ans)&&['A','B','C'].includes(r.form)&&typeof r.i==='number')return r
  }catch(e){}
  return null
}
function tqRunSave(){
  if(TQ.run)lsSet(TQ_KEY,JSON.stringify(TQ.run))
}
function tqCanResume(r){
  return !!r&&!r.done&&r.items.length>0&&r.i<r.items.length&&r.d===day()
}
/* 題本輪流：看最後一次完成的估計（放棄的不算） */
function tqNextForm(){
  const E=store.toeicEst||[],l=E[E.length-1],F=['A','B','C'];
  return l?F[(F.indexOf(l.form)+1)%3]:'A'
}
/* 避開上一次用過的多益長例句（上一次沒做完時，連它當時避開的也一起避開） */
function tqAvoid(r){
  if(!r)return [];
  const g=Array.isArray(r.gen)?r.gen:[];
  return r.done?g:g.concat(Array.isArray(r.avoid)?r.avoid:[])
}
/* ---------- 出題 ---------- */
function tqForm(f){
  return ((window.TOEIC_BANK||{}).forms||{})[f]||null
}
function tqQr(R,it){
  const F=tqForm(R.form);
  return F&&F.qr.find(x=>x.id===it.id)||null
}
function tqPass(R,it){
  const F=tqForm(R.form);
  return F&&F.rd.find(p=>p.id===it.id)||null
}
function tqPos(y){
  return String(y.pos||'').split('/').map(p=>p.trim().replace(/\.$/,'')).filter(Boolean)
}
/* 中文意思的「類別」：每個義項的最後一個字、相連的兩個字，和大類（最後兩個字裡有：機器設備、地方、文件票證、費用金錢）。
   類別相同的字不當干擾選項：運輸公司／快遞公司、電梯／發電機（「停機保養」兩個都說得通）、發票／收據 */
const TQ_ZC=[['D','機器梯爐箱櫃燈扇泵閥線板具錶鍋車'],['P','室廳館店場站院所庫房廠樓屋區園廊港'],['W','單表書函冊卡證票據帳簿約'],['M','費金款稅價薪']];
function tqZhKey(z){
  const L=new Set(),B=new Set(),C=new Set();
  zhSenses(z).forEach(s=>{
    const t=s.replace(/[^\u4e00-\u9fff]/g,'');
    if(!t)return;
    L.add(t.slice(-1));
    for(let k=0;k+1<t.length;k++)B.add(t.slice(k,k+2));
    for(const ch of t.slice(-2))TQ_ZC.forEach(c=>{
      if(c[1].includes(ch))C.add(c[0])
    })
  });
  return {L,B,C}
}
function tqZhNear(a,b){
  for(const c of b.L)if(a.L.has(c))return true;
  for(const c of b.B)if(a.B.has(c))return true;
  for(const c of b.C)if(a.C.has(c))return true;
  return false
}
/* a／an 後面的字：用音標判斷是不是母音開頭（hour、university 也對） */
function tqVowel(y){
  const p=String(y.p||'').replace(/^[ˈˌ'\s(]+/,'');
  if(p)return /^[aeiouæɑɒɔəɛɪʊʌɜɝɚ]/.test(p);
  return /^[aeiou]/.test(y.w)&&!/^(uni|use|usu|uti|eu|one|once)/.test(y.w)||/^(hour|honest|honor|heir)/.test(y.w)
}
/* 答案是複數時，干擾選項也用複數：只用 App 句子裡出現過的拼法（不自己猜拼法；不規則複數、不可數名詞的字就不用） */
function tqPlural(y,att){
  const w=y.w,ok=[w+'s',w+'es',w.slice(0,-1)+'ies'].filter(f=>att.has(f));
  return ok.length===1?ok[0]:''
}
var _tqFP=null;
function tqFillPrep(){
  if(_tqFP&&_tqFP.n===ALLS.length)return _tqFP;
  const att=new Set();
  ALLS.forEach(s=>{
    const m=String(s.en||'').match(/[A-Za-z]+/g);
    if(m)m.forEach(t=>{
      if(/^[a-z]+$/.test(t))att.add(t)
    })
  });
  /* 干擾選項：原形、有中文、全小寫英文字（不用人名地名、縮寫）。不用基本字、時間、數字、人物、感受主題的字（太常用或很多句子都填得進去，
     例如「The ___ sells coffee」填人都說得通），也不用社會主題（政治、宗教、犯罪）和死亡、疾病等字 */
  const GEN={basic:1,time:1,num:1,people:1,feel:1,society:1},BAD=/^(suicide|abortion|death|die|dead|kill|bomb|weapon|gun|drug|cancer|tumor|blood|disease|diabetes|virus|pregnant|sex|naked|alcohol|beer|wine|cigarette|casino|lottery|fat|ugly|hate|stupid|divorce|enemy|victim|terrorist|terrorism|attack|funeral|grave|coffin|corpse|poison|injury|wound|bleed|vomit|toilet|urine)$/;
  /* 也不用指人或公司的字（中文以「員、者、人、師、商、家、工、匠、官、司、手、主」結尾，例如 provider、maker、employer）：「The ___ is working…」這種句子填人都說得通 */
  const WHO=/[員者人師商家工匠官司手主]$/;
  const pool=WORDS.filter(y=>!y.b&&!y.d&&y.zh&&/^[a-z]{3,}$/.test(y.w)&&!BAD.test(y.w)&&!(y.t||[]).some(t=>GEN[t])&&!zhSenses(y.zh).some(z=>WHO.test(z.replace(/[^\u4e00-\u9fff]+$/,''))));
  /* 題目：多益字（名詞）的長例句。動詞、形容詞、副詞換成別的字常常也說得通（例如 recognize／reproduce the error），所以不出 */
  const targets=WORDS.filter(x=>x.toeic&&x.ex2&&x.exz2&&!x.b&&!x.d&&/^[a-z]{3,}$/.test(x.w)&&tqPos(x).join()==='n');
  return _tqFP={n:ALLS.length,att,pool,targets}
}
/* 句子填空：空格＝句子裡的多益字（名詞；用 hlForms 找詞形，例如複數）；出現兩次或找不到就跳過。
   選項＝句子裡的寫法＋3 個同詞性、主題不同、中文意思的類別也不同（意思明顯不同）的字（pickOpts 的規則：不同音、不共用中文義項、不是答案的詞形），
   而且不在句子裡、和答案沒有字首包含關係、a／an 後面要對得上，單複數和答案一樣 */
function tqFill(x,P){
  const e=x.ex2,w=x.w;
  const fs=hlForms(w).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const ms=[...e.matchAll(new RegExp("(^|[^A-Za-z'])("+fs.join('|')+")(?![A-Za-z])",'gi'))];
  if(ms.length!==1)return null;
  const m=ms[0],f=m[2],fl=f.toLowerCase(),at=m.index+m[1].length,xp=tqPos(x);
  /* 句子裡是原形或規則複數才出（不規則的詞形跳過） */
  const pl=fl===w?false:[w+'s',w+'es',w.slice(0,-1)+'ies'].includes(fl)?true:null;
  if(pl===null)return null;
  const art=((e.slice(0,at).match(/([A-Za-z]+)[^A-Za-z]*$/)||[])[1]||'').toLowerCase();
  const toks=new Set((e.toLowerCase().match(/[a-z]+/g)||[]));
  const xt=x.t||[],xz=tqZhKey(x.zh);
  const has=y=>{
    const v=y.w,vc=v.slice(0,-1);
    return [v,v+'s',v+'es',v+'ed',v+'d',v+'ing',vc+'ing',vc+'ies',vc+'ied'].some(t=>toks.has(t))
  };
  const cand=P.pool.filter(y=>{
    if(y.w===w||y.w.startsWith(w)||w.startsWith(y.w))return false;
    const yp=tqPos(y);
    if(!xp.every(p=>yp.includes(p)))return false;
    if((y.t||[]).some(t=>xt.includes(t)))return false;
    if((art==='a'||art==='an')&&tqVowel(y)!==(art==='an'))return false;
    if(pl&&!tqPlural(y,P.att))return false;
    if(has(y))return false;
    return !tqZhNear(xz,y._tz||(y._tz=tqZhKey(y.zh)))
  });
  const ds=pickOpts(x,cand,3);
  if(ds.length<3)return null;
  const forms=[fl,...ds.map(y=>pl?tqPlural(y,P.att):y.w)],bases=[w,...ds.map(y=>y.w)];
  if(new Set(forms).size<4)return null;
  const ord=qShuffle([0,1,2,3]);
  return {t:'sf',w,at,len:f.length,o:ord.map(k=>forms[k]),b:ord.map(k=>bases[k]),c:ord.indexOf(0),n:4}
}
/* 聽句子選意思：多益長例句；干擾選項＝長度相近的其他長例句的中文（qNear） */
function tqLmPick(av,used,n){
  const S2=ALLS.filter(s=>s.src==='word2'&&s.en&&s.zh),out=[];
  for(const s of qShuffle(S2)){
    if(out.length>=n)break;
    const w=s.keys[0];
    if(av.has(w)||used.has(w))continue;
    const os=qNear(s,S2,'zh',3);
    if(os.length<3)continue;
    used.add(w);
    const o=qShuffle([s,...os]).map(y=>y.keys[0]);
    out.push({t:'lm',w,o,c:o.indexOf(w),n:4})
  }
  return out
}
function tqBuild(form,avoid){
  const F=tqForm(form),av=new Set(avoid||[]),used=new Set(),items=[];
  qShuffle(F.qr).slice(0,10).forEach(x=>{
    const o=qShuffle([0,1,2]);
    items.push({t:'qr',id:x.id,o,c:o.indexOf(x.a),n:3})
  });
  let lm=tqLmPick(av,used,10);
  if(lm.length<10)lm=lm.concat(tqLmPick(new Set(),used,10-lm.length));
  items.push(...lm);
  const P=tqFillPrep(),sf=[];
  for(const ex of [av,new Set()]){
    for(const x of qShuffle(P.targets)){
      if(sf.length>=12)break;
      if(ex.has(x.w)||used.has(x.w))continue;
      const it=tqFill(x,P);
      if(it){
        used.add(x.w);
        sf.push(it)
      }
    }
    if(sf.length>=12)break
  }
  items.push(...sf);
  qShuffle(F.rd).slice(0,4).forEach(p=>p.qs.slice(0,2).forEach((q,j)=>{
    const o=qShuffle(q.o.map((_,k)=>k));
    items.push({t:'rd',id:p.id,q:j,o,c:o.indexOf(q.a),n:o.length})
  }));
  return items
}
/* ---------- 計分 ---------- */
function tqScore(c,ks){
  const n=ks.length,g=ks.reduce((s,k)=>s+1/k,0);
  const p=n>g?Math.max(0,Math.min(1,(c-g)/(n-g))):0;
  const S=Math.min(495,Math.max(5,Math.round((5+490*p)/5)*5));
  return {c,n,p,S,lo:Math.max(5,S-50),hi:Math.min(495,S+50)}
}
function tqCefr(sec,S){
  const r=TQ_CEFR[sec].find(v=>S>=v[0]);
  return r?'約 '+r[1]:'未達 A1'
}
function tqBand(S){
  return [Math.max(5,S-50),Math.min(495,S+50)]
}
function tqResult(R){
  const parts={},ks={L:[],R:[]},cs={L:0,R:0};
  R.items.forEach((it,k)=>{
    const P=TQ_PART[it.t];
    if(!P)return;
    const v=parts[it.t]=parts[it.t]||[0,0];
    v[1]++;
    if(R.ans[k]===it.c){
      v[0]++;
      cs[P[0]]++
    }
    ks[P[0]].push(it.n)
  });
  const L=tqScore(cs.L,ks.L),Rd=tqScore(cs.R,ks.R);
  return {parts,L,R:Rd}
}
/* ---------- 開始、作答、做完 ---------- */
function tqStart(){
  if(tqSt()!=='ok'||!TTS_OK)return tqRender();
  const old=tqRunGet(),form=tqNextForm(),avoid=tqAvoid(old).slice(0,200),items=tqBuild(form,avoid);
  tqStop();
  TQ.run={v:1,d:day(),form,items,ans:items.map(()=>-1),rep:[],heard:[],i:0,sec:0,gen:items.filter(it=>it.w).map(it=>it.w),avoid,done:0};
  tqRunSave();
  TQ.view='q';
  TQ.t0=Date.now();
  tqRender(true)
}
function tqTick(){
  const R=TQ.run;
  if(R&&!R.done&&TQ.t0){
    R.sec=(R.sec||0)+Math.min(600,Math.max(0,(Date.now()-TQ.t0)/1000));
    TQ.t0=Date.now()
  }
}
function tqAnswer(k){
  const R=TQ.run;
  if(!R||R.done||TQ.view!=='q'||Date.now()<TQ.readyAt||!tqVis())return;
  const it=R.items[R.i];
  if(!it||!(k>=0&&k<it.n))return;
  tqStop();
  tqTick();
  R.ans[R.i]=k;
  R.i++;
  if(R.i>=R.items.length)return tqFinish();
  tqRunSave();
  tqRender(true)
}
function tqFinish(){
  const R=TQ.run,S=tqResult(R),e={date:day(),form:R.form,parts:S.parts,estL:S.L.S,estR:S.R.S,seconds:Math.min(86400,Math.round(R.sec||0))};
  R.done=1;
  R.est=e;
  store.toeicEst=(Array.isArray(store.toeicEst)?store.toeicEst:[]).concat([e]).slice(-50);
  markStudy();
  save();
  tqRunSave();
  TQ.t0=0;
  TQ.view='res';
  tqRender();
  window.scrollTo(0,0)
}
/* 放棄：不能再繼續，但記住用過的句子（下次一樣避開） */
function tqDiscard(){
  const r=tqRunGet();
  tqStop();
  TQ.run=null;
  TQ.t0=0;
  if(r&&!r.done)lsSet(TQ_KEY,JSON.stringify({v:1,d:r.d,form:r.form,items:[],ans:[],i:0,gen:Array.isArray(r.gen)?r.gen:[],avoid:(Array.isArray(r.avoid)?r.avoid:[]).slice(0,200),done:0,drop:1}))
}
/* 換頁（page）、按返回：停止播放、記下作答時間和進度 */
function tqLeave(){
  if(TQ.poll){
    clearInterval(TQ.poll);
    TQ.poll=0
  }
  if(TQ.run&&!TQ.run.done&&TQ.t0){
    tqTick();
    tqRunSave()
  }
  TQ.t0=0;
  tqStop()
}
function tqBack(){
  tqLeave();
  $(TQ.from==='quiz'?'#navQuiz':'#navStats').click()
}
/* ---------- 播放（應答問題：題目 → A → B → C，中間停一下；聽句子：念一次） ---------- */
function tqSeq(R,it){
  if(it.t==='lm')return [(BY_WORD[it.w]||{}).ex2||''];
  const x=tqQr(R,it);
  return x?[x.q].concat(it.o.map((o,k)=>'ABC'[k]+'. '+x.o[o])):[]
}
function tqStop(){
  TQ.tok++;
  clearTimeout(TQ.pt);
  clearTimeout(TQ.wd);
  if(TQ.playing){
    TQ.playing=false;
    try{
      speechSynthesis.cancel()
    }catch(e){}
  }
}
function tqPlay(){
  const R=TQ.run;
  if(!R||R.done||TQ.view!=='q'||TQ.playing||!tqVis())return;
  const i=R.i,it=R.items[i];
  if(!it||(it.t!=='qr'&&it.t!=='lm'))return;
  if(R.heard[i]){
    /* 每題只能再聽一次 */
    if(R.rep[i])return;
    R.rep[i]=1;
    tqRunSave()
  }
  const seq=tqSeq(R,it).filter(Boolean),tok=++TQ.tok;
  if(!seq.length)return;
  TQ.playing=true;
  tqAudioUI();
  /* 朗讀被別的聲音打斷、一直沒有結束時：恢復按鈕（沒播完的題目可以重新播放） */
  clearTimeout(TQ.wd);
  TQ.wd=setTimeout(()=>{
    if(tok===TQ.tok&&TQ.playing){
      TQ.playing=false;
      tqAudioUI()
    }
  },seq.join(' ').length*150+seq.length*1200+5000);
  let k=0;
  const nx=()=>{
    if(tok!==TQ.tok)return;
    say(seq[k],.9,1,()=>{
      if(tok!==TQ.tok)return;
      if(++k<seq.length){
        TQ.pt=setTimeout(nx,k===1?1000:600);
        return
      }
      TQ.playing=false;
      clearTimeout(TQ.wd);
      if(TQ.run===R&&R.i===i&&!R.heard[i]){
        R.heard[i]=1;
        tqRunSave()
      }
      tqAudioUI()
    })
  };
  nx()
}
function tqAudioUI(){
  const b=$('#tqPlay'),s=$('#tqAst'),R=TQ.run;
  if(!b||!s||!R)return;
  const i=R.i;
  if(TQ.playing){
    b.textContent='🔊 播放中…';
    b.disabled=true;
    s.textContent=''
  }else if(!R.heard[i]){
    b.textContent='▶ 播放題目';
    b.disabled=false;
    s.textContent='還沒播完，可以重新播放'
  }else if(!R.rep[i]){
    b.textContent='🔁 再聽一次';
    b.disabled=false;
    s.textContent='可以再聽 1 次'
  }else{
    b.textContent='🔁 已重聽';
    b.disabled=true;
    s.textContent='每題只能再聽一次'
  }
}
document.addEventListener('visibilitychange',()=>{
  if(!tqVis()||TQ.view!=='q'||!TQ.run||TQ.run.done)return;
  if(document.hidden){
    tqTick();
    TQ.t0=0;
    tqStop();
    tqRunSave()
  }else TQ.t0=Date.now();
  tqAudioUI()
});
/* ---------- 畫面 ---------- */
function tqDate(d){
  return String(d||'').replace(/-/g,'/')
}
function tqSign(n){
  return n>0?'+'+n:n<0?'−'+(-n):'±0'
}
function tqHead(t){
  return `<div class="tq-head"><button type="button" class="mini" data-tq="back">← 返回${TQ.from==='quiz'?'測驗':'統計'}</button></div><h2>${t}</h2>`
}
/* 統計頁和測驗選單的卡片：上次的估計、開始／繼續 */
function toeicCardHtml(inQuiz){
  const E=Array.isArray(store.toeicEst)?store.toeicEst:[],e=E[E.length-1],p=E[E.length-2],r=tqRunGet(),can=tqCanResume(r);
  let h=inQuiz?'<div class="tq-card tq-qcard"><b class="tq-ct">📈 多益程度估計（非官方）</b>':'<h3 id="tqCard">📈 多益程度估計（非官方）</h3><div class="tq-card">';
  if(e){
    const L=tqBand(e.estL),R=tqBand(e.estR),n=v532Diff(e.date,day());
    h+=`<p class="tq-last">上次 ${esc(tqDate(e.date))}（題本 ${esc(e.form)}）：<b>聽力 約 ${L[0]}–${L[1]}</b>、<b>閱讀 約 ${R[0]}–${R[1]}</b><br><small class="muted">合計 約 ${L[0]+R[0]}–${L[1]+R[1]}${p?`・比前一次：聽力 ${tqSign(e.estL-p.estL)}、閱讀 ${tqSign(e.estR-p.estR)}`:''}</small></p>`;
    if(!can&&n!==null&&n>=0&&n<28)h+=`<p class="muted">距離上次 ${n} 天；建議隔 4～6 週再做，比較看得出進步。</p>`
  }else h+='<p class="muted">約 20 分鐘、40 題（聽力 20、閱讀 20），估計大概的多益聽力、閱讀程度；每 4～6 週做一次，看進步的趨勢。不是正式分數。</p>';
  if(can)h+=`<p class="muted">今天的估計做到第 ${r.i+1}／${r.items.length} 題，可以接著做。</p>`;
  h+='<div class="tq-btns">'+(can?'<button type="button" class="primary" data-tq="resume">▶ 繼續上次的估計</button><button type="button" data-tq="discard">放棄這次</button>':'<button type="button" class="primary" data-tq="start">開始（約 20 分鐘）</button>')+(E.length||(store.toeicOfficial||[]).length?'<button type="button" data-tq="hist">📊 結果與紀錄</button>':'')+'</div></div>';
  return h
}
function toeicQuizCard(){
  qCur='';
  $('#quizQ').innerHTML=toeicCardHtml(true);
  $('#quizOpts').innerHTML='';
  $('#quizOpts').onclick=null;
  $('#quizMsg').textContent=''
}
window.P6QUIZ.toeic=toeicQuizCard;
function tqIntroHtml(){
  const r=tqRunGet(),can=tqCanResume(r),st=tqSt(),old=r&&!r.done&&!r.drop&&r.items.length&&!can,form=can?r.form:tqNextForm();
  let h=tqHead('📈 多益程度估計（非官方）');
  h+=`<ul class="tq-intro"><li><b>40 題：聽力 20、閱讀 20</b>（應答問題 10、聽句子選意思 10、句子填空 12、短文閱讀 8），約 20 分鐘。</li><li>聽力題由<b>手機語音</b>念出，請打開聲音或戴耳機；每題可以再聽一次。</li><li>結果只是<b>大概的程度和進步趨勢，不是正式分數</b>。建議每 4～6 週做一次。</li><li>這次用題本 ${form}（A、B、C 輪流）。中途離開會自動保存，當天可以繼續。</li></ul>`;
  if(!TTS_OK)h+='<p class="rec-msg warn">⚠️ 這個瀏覽器不能朗讀英文，沒辦法做聽力題。請改用 Safari 或 Chrome 開啟。</p>';
  if(old)h+=`<p class="rec-msg">上次（${esc(tqDate(r.d))}）沒做完的估計已經過期（只能在同一天繼續），這次重新開始。</p>`;
  h+=tqStHtml(st);
  const dis=st!=='ok'||!TTS_OK?' disabled':'';
  if(can)h+=`<p class="muted">今天的估計做到第 ${r.i+1}／${r.items.length} 題（題本 ${esc(r.form)}）。</p>`;
  h+='<div class="tq-btns">'+(can?`<button type="button" class="primary" data-tq="cont"${dis}>▶ 繼續作答</button><button type="button" data-tq="discard">放棄這次</button>`:`<button type="button" class="primary" data-tq="go"${dis}>▶ 開始作答</button>`)+'</div>';
  return h
}
function tqQHtml(R){
  const it=R.items[R.i],P=TQ_PART[it.t],same=R.items.filter(x=>x.t===it.t),pi=R.items.slice(0,R.i+1).filter(x=>x.t===it.t).length;
  let h=`<div class="tq-top"><b>${P[1]} ${P[0]==='L'?'聽力':'閱讀'}・${P[2]} ${pi}／${same.length}</b><span class="muted">第 ${R.i+1}／${R.items.length} 題・題本 ${esc(R.form)}</span></div><div class="tq-prog" aria-hidden="true"><i style="width:${Math.round(R.i/R.items.length*100)}%"></i></div><p class="tq-ins">${P[3]}</p>`;
  if(it.t==='qr'||it.t==='lm')h+='<div class="tq-audio"><button type="button" id="tqPlay" data-tq="play">🔁 再聽一次</button><span id="tqAst" class="muted" role="status" aria-live="polite"></span></div>';
  if(it.t==='qr')h+=`<div class="tq-opts tq-abc">${['A','B','C'].map((L,k)=>`<button type="button" data-ans="${k}" aria-label="選 ${L}">${L}</button>`).join('')}</div>`;
  else if(it.t==='lm')h+=`<div class="tq-opts">${it.o.map((w,k)=>`<button type="button" data-ans="${k}">${esc((BY_WORD[w]||{}).exz2||'')}</button>`).join('')}</div>`;
  else if(it.t==='sf'){
    const e=(BY_WORD[it.w]||{}).ex2||'';
    let at=it.at;
    if(e.substr(at,it.len).toLowerCase()!==it.o[it.c])at=e.toLowerCase().indexOf(it.o[it.c]);
    h+=`<p class="tq-sent" lang="en">${at<0?esc(e):esc(e.slice(0,at))+'<span class="tq-blank" role="img" aria-label="空格">_____</span>'+esc(e.slice(at+it.len))}</p><div class="tq-opts tq-words">${it.o.map((f,k)=>`<button type="button" data-ans="${k}" lang="en">${esc(f)}</button>`).join('')}</div>`
  }else{
    const p=tqPass(R,it),q=p&&p.qs[it.q];
    if(!q)return h+'<p class="rec-msg warn">⚠️ 找不到這一題（題本可能更新了）。</p>';
    /* 文章和題目固定在畫面上方（小手機往下捲到選項時，文章還看得到） */
    h+=`<div class="tq-stick"><div class="tq-pass-h">${TQ_PT[p.type]||''}<small class="muted">（第 ${it.q+1}／${p.qs.length} 題）</small></div><div class="tq-pass" lang="en" tabindex="0" role="region" aria-label="文章">${esc(p.text)}</div><p class="tq-q" lang="en">${esc(q.q)}</p></div><div class="tq-opts">${it.o.map((o,k)=>`<button type="button" data-ans="${k}" lang="en"><b>${'ABCD'[k]}.</b> ${esc(q.o[o])}</button>`).join('')}</div>`
  }
  return h+'<div class="tq-btns tq-foot"><button type="button" data-tq="pause">⏸ 暫停，之後再做</button></div>'
}
/* 新的一題：題目捲到上面，選項盡量都在底部選單（和今日學習進度列）上方（不把題目捲出畫面）；
   短文題的文章和題目會固定在上方，所以可以再往下捲，讓第一個選項露出來 */
function tqKeep(){
  const box=$('#toeicBody'),o=box&&box.querySelector('.tq-opts button'),top=box&&box.querySelector('.tq-top');
  if(!o||!top||!tqVis())return;
  const t=top.getBoundingClientRect().top;
  if(t<8||t>120)window.scrollBy(0,t-8);
  const st=box.querySelector('.tq-stick'),lim=bottomLimit()-8,ob=(st?o:o.parentNode).getBoundingClientRect().bottom;
  if(ob>lim)window.scrollBy(0,Math.min(ob-lim,st?1e4:Math.max(0,top.getBoundingClientRect().top-8)))
}
function tqEstHtml(e){
  const L=tqBand(e.estL),R=tqBand(e.estR),p=_isObj(e.parts)?e.parts:{};
  const row=k=>p[k]?`<div class="tq-pr"><span>${TQ_PART[k][1]} ${TQ_PART[k][0]==='L'?'聽力':'閱讀'}・${TQ_PART[k][2]}</span><b>${p[k][0]}／${p[k][1]}</b></div>`:'';
  return `<p class="muted">${esc(tqDate(e.date))}・題本 ${esc(e.form)}${e.seconds?'・作答約 '+Math.max(1,Math.round(e.seconds/60))+' 分鐘':''}</p>`+
    `<div class="tq-res"><div><span>🎧 聽力</span><b>約 ${L[0]}–${L[1]}</b><small>估計值 ${e.estL}・CEFR ${tqCefr('L',e.estL)}</small></div><div><span>📖 閱讀</span><b>約 ${R[0]}–${R[1]}</b><small>估計值 ${e.estR}・CEFR ${tqCefr('R',e.estR)}</small></div><div class="tq-tot"><span>合計</span><b>約 ${L[0]+R[0]}–${L[1]+R[1]}</b></div></div>`+
    `<h3>各部分答對題數</h3><div class="tq-parts">${['qr','lm','sf','rd'].map(row).join('')}</div>`+
    '<p class="muted tq-note">怎麼算：聽力、閱讀各 20 題，先扣掉用猜的也可能答對的部分，再換算成 5–495 分（取 5 的倍數），範圍是估計值 ±50 分。每部分只有 20 題，只能看出大概的程度和進步趨勢，<b>不是正式成績</b>。</p>'+
    '<p class="muted tq-note">CEFR：用估計值對照 ETS 公布的各級最低分數（聽力 A1 60、A2 110、B1 275、B2 400、C1 490；閱讀 A1 60、A2 115、B1 275、B2 385、C1 455）。ETS 說明這些分數是參考指引（guidelines），不是門檻分數（cut scores）。</p>'
}
function tqSame(a,b){
  return !!a&&!!b&&a.date===b.date&&a.form===b.form&&a.estL===b.estL&&a.estR===b.estR&&a.seconds===b.seconds
}
/* 答錯的題目：聽力題附原文，每題附中文說明 */
function tqRevItem(R,it,k){
  const P=TQ_PART[it.t],me=R.ans[k],tag=`<small class="muted">第 ${k+1} 題・${P[1]} ${P[2]}</small>`;
  const li=(j,t)=>`<li class="${j===it.c?'tq-ok':j===me?'tq-bad':''}">${t}${j===it.c?' <b>✓ 正確答案</b>':j===me?' <b>✗ 你的答案</b>':''}</li>`;
  if(it.t==='qr'){
    const x=tqQr(R,it);
    if(!x)return '';
    return `<div class="tq-rv">${tag}<p class="tq-rq" lang="en"><b>${esc(x.q)}</b></p><ul class="tq-rvo" lang="en">${it.o.map((o,j)=>li(j,'ABC'[j]+'. '+esc(x.o[o]))).join('')}</ul><p class="tq-zh">${esc(x.zh)}</p><button type="button" class="mini" data-tq="say" data-k="${k}">🔊 再聽</button></div>`
  }
  if(it.t==='lm'){
    const x=BY_WORD[it.w];
    if(!x)return '';
    return `<div class="tq-rv">${tag}<p class="tq-rq" lang="en"><b>${esc(x.ex2)}</b></p><ul class="tq-rvo">${it.o.map((w,j)=>li(j,esc((BY_WORD[w]||{}).exz2||''))).join('')}</ul><p class="tq-zh">關鍵字 <b lang="en">${esc(dispW(x.w))}</b>：${esc(x.zh)}</p><button type="button" class="mini" data-tq="say" data-k="${k}">🔊 再聽</button></div>`
  }
  if(it.t==='sf'){
    const x=BY_WORD[it.w];
    if(!x)return '';
    const e=x.ex2,at=e.substr(it.at,it.len).toLowerCase()===it.o[it.c]?it.at:-1;
    const s=at<0?esc(e):esc(e.slice(0,at))+'<mark>'+esc(e.substr(at,it.len))+'</mark>'+esc(e.slice(at+it.len));
    return `<div class="tq-rv">${tag}<p class="tq-rq" lang="en">${s}</p><ul class="tq-rvo">${it.o.map((f,j)=>li(j,`<span lang="en">${esc(f)}</span>`+(BY_WORD[it.b[j]]?`<small>（${f!==it.b[j]?esc(it.b[j])+'：':''}${esc(BY_WORD[it.b[j]].zh)}）</small>`:''))).join('')}</ul><p class="tq-zh">${esc(x.exz2)}</p></div>`
  }
  const p=tqPass(R,it),q=p&&p.qs[it.q];
  if(!q)return '';
  return `<div class="tq-rv">${tag}<p class="tq-rq" lang="en"><b>${esc(q.q)}</b></p><ul class="tq-rvo" lang="en">${it.o.map((o,j)=>li(j,'ABCD'[j]+'. '+esc(q.o[o]))).join('')}</ul><p class="tq-zh">${esc(q.zh)}</p><details class="tq-rvp"><summary>看文章（${TQ_PT[p.type]||''}）</summary><div class="tq-pass" lang="en">${esc(p.text)}</div><p class="tq-zh">${esc(p.zh)}</p></details></div>`
}
function tqRevHtml(R){
  const wrong=R.items.map((it,k)=>k).filter(k=>R.ans[k]!==R.items[k].c);
  let h=`<h3 id="tqRev">答錯的題目（${wrong.length}）</h3>`;
  if(!wrong.length)return h+'<p class="muted">🎉 全部答對！</p>';
  const st=tqSt();
  if(st!=='ok')return h+'<p class="muted">檢討的題目和說明要用到題目資料：</p>'+tqStHtml(st);
  return h+'<div class="tq-rv-list">'+wrong.map(k=>tqRevItem(R,R.items[k],k)).join('')+'</div>'
}
function tqSorted(a){
  return (Array.isArray(a)?a:[]).slice().sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:0)
}
/* 進步趨勢：估計（聽力、閱讀）畫成折線，正式成績畫成菱形；不用任何圖表程式庫 */
function tqChartHtml(){
  const E=tqSorted(store.toeicEst),O=tqSorted(store.toeicOfficial);
  if(!E.length&&!O.length)return '<p class="muted">做完第一次估計後，這裡會畫出每次的分數。</p>';
  const W=320,H=180,x0=34,x1=W-14,y0=12,y1=H-30,ds=E.map(e=>e.date).concat(O.map(o=>o.date)),t=d=>Date.parse(d+'T00:00:00');
  const ts=ds.map(t),a=Math.min(...ts),z=Math.max(...ts);
  const X=d=>(z===a?(x0+x1)/2:x0+(x1-x0)*(t(d)-a)/(z-a)).toFixed(1),Y=s=>(y1-(y1-y0)*s/495).toFixed(1);
  let g='';
  [0,100,200,300,400].forEach(v=>{
    g+=`<line class="tq-g" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${x0-5}" y="${(+Y(v)+3.5).toFixed(1)}" text-anchor="end">${v}</text>`
  });
  const lab=d=>{
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return a&&new Date(a).getFullYear()!==new Date(z).getFullYear()?m[1].slice(2)+'/'+(+m[2])+'/'+(+m[3]):(+m[2])+'/'+(+m[3])
  };
  const first=ds.reduce((p,d)=>d<p?d:p),last=ds.reduce((p,d)=>d>p?d:p);
  g+=`<text x="${X(first)}" y="${H-12}" text-anchor="${first===last?'middle':'start'}">${lab(first)}</text>`+(first!==last?`<text x="${X(last)}" y="${H-12}" text-anchor="end">${lab(last)}</text>`:'');
  const line=(k,c)=>E.length>1?`<polyline class="${c}" points="${E.map(e=>X(e.date)+','+Y(e[k])).join(' ')}"/>`:'';
  const dot=(k,c)=>E.map(e=>`<circle class="${c}" cx="${X(e.date)}" cy="${Y(e[k])}" r="3.5"><title>${tqDate(e.date)} 估計 ${k==='estL'?'聽力':'閱讀'} ${e[k]}</title></circle>`).join('');
  const dia=(k,c)=>O.map(o=>{
    const x=X(o.date),y=Y(o[k]);
    return `<rect class="${c}" x="${(x-4.5).toFixed(1)}" y="${(y-4.5).toFixed(1)}" width="9" height="9" transform="rotate(45 ${x} ${y})"><title>${tqDate(o.date)} 正式成績 ${k==='L'?'聽力':'閱讀'} ${o[k]}</title></rect>`
  }).join('');
  return `<svg class="tq-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="多益估計分數的趨勢：${E.length} 次估計、${O.length} 次正式成績">${g}${line('estL','tq-cl')}${line('estR','tq-cr')}${dot('estL','tq-pl')}${dot('estR','tq-pr2')}${dia('L','tq-ol')}${dia('R','tq-or')}</svg>`+
    `<p class="tq-leg"><span><i class="tq-kl"></i>聽力估計</span><span><i class="tq-kr"></i>閱讀估計</span>${O.length?'<span>◆ 正式成績</span>':''}</p>`+
    (E.length?'<div class="tq-hist">'+E.slice(-12).reverse().map(e=>{
      const L=tqBand(e.estL),R=tqBand(e.estR);
      return `<div><span>${esc(tqDate(e.date))}・題本 ${esc(e.form)}</span><b>聽力 約 ${L[0]}–${L[1]}、閱讀 約 ${R[0]}–${R[1]}</b></div>`
    }).join('')+'</div>':'')
}
/* 正式成績：和日期最接近（60 天內）的估計比較 */
function tqNear(o){
  let best=null;
  (Array.isArray(store.toeicEst)?store.toeicEst:[]).forEach(e=>{
    const d=v532Diff(e.date,o.date);
    if(d===null||Math.abs(d)>60)return;
    if(!best||Math.abs(d)<best.d||(Math.abs(d)===best.d&&e.date>=best.e.date))best={e,d:Math.abs(d)}
  });
  return best
}
function tqOffHtml(){
  const O=Array.isArray(store.toeicOfficial)?store.toeicOfficial:[];
  let h='<h3 id="tqOff">📝 正式成績</h3><p class="muted">考過正式的多益（聽力＋閱讀）時，可以把成績記在這裡，和估計對照。只用來比較，不會改動估計紀錄。</p>';
  if(TQ.msg)h+=`<p class="rec-msg ok" role="status">${esc(TQ.msg)}</p>`;
  TQ.msg='';
  h+=TQ.oform?`<div class="tq-off" id="tqOform"><label class="tq-o2">考試日期<input type="date" id="tqOd" value="${day()}" max="${day()}"></label><label>聽力<input type="number" id="tqOl" inputmode="numeric" min="5" max="495" step="5" placeholder="5–495"></label><label>閱讀<input type="number" id="tqOr" inputmode="numeric" min="5" max="495" step="5" placeholder="5–495"></label><p id="tqOmsg" class="rec-msg warn tq-o2" role="alert" hidden></p><div class="tq-btns tq-o2"><button type="button" class="primary" data-tq="osave">儲存</button><button type="button" data-tq="oform">取消</button></div></div>`:'<div class="tq-btns"><button type="button" data-tq="oform">📝 輸入正式成績</button></div>';
  if(O.length)h+='<div class="tq-olist">'+O.map((o,i)=>{
    const n=tqNear(o);
    return `<div class="tq-orow"><span><b>${esc(tqDate(o.date))} 正式成績</b><small>聽力 ${o.L}・閱讀 ${o.R}・合計 ${o.L+o.R}</small><small>${n?`和 ${esc(tqDate(n.e.date))} 的估計（相隔 ${n.d} 天）比：聽力 ${tqSign(o.L-n.e.estL)}、閱讀 ${tqSign(o.R-n.e.estR)}`:'前後 60 天內沒有估計可以比較'}</small></span><button type="button" class="mini" data-tq="odel" data-i="${i}" aria-label="刪除 ${esc(tqDate(o.date))} 的正式成績">✕</button></div>`
  }).reverse().join('')+'</div>';
  return h
}
function tqOffSave(){
  const v=id=>(($(id)||{}).value||'').trim(),msg=$('#tqOmsg'),d=v('#tqOd');
  const bad=t=>{
    if(msg){
      msg.textContent='⚠️ '+t;
      msg.hidden=false
    }
  };
  const sc=x=>/^\d{1,3}$/.test(x)&&+x>=5&&+x<=495&&+x%5===0?+x:null;
  if(!tqYmdOk(d)||d>day()||d<'2006-01-01')return bad('請輸入正確的考試日期（不能是未來的日期）。');
  const L=sc(v('#tqOl')),R=sc(v('#tqOr'));
  if(L===null)return bad('聽力分數要是 5–495、5 的倍數（例如 350）。');
  if(R===null)return bad('閱讀分數要是 5–495、5 的倍數（例如 300）。');
  store.toeicOfficial=tqSorted((Array.isArray(store.toeicOfficial)?store.toeicOfficial:[]).concat([{date:d,L,R}])).slice(-20);
  save();
  TQ.oform=false;
  TQ.msg=`✅ 已記下 ${tqDate(d)} 的正式成績：聽力 ${L}、閱讀 ${R}。`;
  tqRender()
}
function tqResHtml(){
  const E=Array.isArray(store.toeicEst)?store.toeicEst:[],e=E[E.length-1],r=tqRunGet(),run=r&&r.done&&tqSame(r.est,e)?r:null;
  let h=tqHead('📈 多益程度估計結果（非官方）');
  h+=e?tqEstHtml(e):'<p class="muted">還沒有估計紀錄。</p>';
  if(run)h+=tqRevHtml(run);
  h+='<h3>📈 進步趨勢</h3>'+tqChartHtml()+tqOffHtml();
  if(!tqCanResume(r))h+='<p class="muted">建議每 4～6 週做一次估計，題本 A、B、C 會輪流使用。</p>';
  return h+'<div class="tq-btns"><button type="button" class="primary" data-tq="back">完成</button></div>'
}
function tqRender(auto){
  const box=$('#toeicBody');
  if(!box)return;
  TQ.sig=tqSig();
  if(TQ.view==='q'){
    const R=TQ.run;
    if(!R||R.done||!R.items.length||R.i>=R.items.length){
      TQ.view=R&&R.done?'res':'intro';
      return tqRender()
    }
    const st=tqSt();
    if(st!=='ok'){
      box.innerHTML=tqHead('📈 多益程度估計（非官方）')+tqStHtml(st)+'<div class="tq-btns tq-foot"><button type="button" data-tq="pause">⏸ 暫停，之後再做</button></div>';
      tqWatch();
      return
    }
    box.innerHTML=tqQHtml(R);
    TQ.readyAt=Date.now()+300;
    if(!TQ.t0)TQ.t0=Date.now();
    const it=R.items[R.i];
    if(auto&&(it.t==='qr'||it.t==='lm')&&!R.heard[R.i]&&TTS_OK)tqPlay();
    tqAudioUI();
    tqKeep();
    return
  }
  TQ.need=false;
  box.innerHTML=TQ.view==='res'?tqResHtml():tqIntroHtml();
  if(TQ.need)tqWatch()
}
/* ---------- 按鈕 ---------- */
function tqShow(view,auto){
  TQ.view=view;
  page('toeic');
  tqRender(auto)
}
function tqAct(a,el,from){
  if(from)TQ.from=from;
  if(a==='start')tqShow('intro');
  else if(a==='resume'||a==='cont'){
    const r=tqRunGet();
    if(tqCanResume(r)){
      TQ.run=r;
      TQ.t0=Date.now();
      tqShow('q',true)
    }else tqShow('intro')
  }else if(a==='hist')tqShow('res');
  else if(a==='go')tqStart();
  else if(a==='discard'){
    if(confirm('要放棄今天沒做完的估計嗎？已經作答的題目不會計分。')){
      tqDiscard();
      /* 在統計頁、測驗選單的卡片上按的：更新那張卡片 */
      if(tqVis())tqRender();else if(from==='quiz')toeicQuizCard();else if(from==='stats')renderStats()
    }
  }else if(a==='back'||a==='pause')tqBack();
  else if(a==='play')tqPlay();
  else if(a==='retry')tqRetry();
  else if(a==='oform'){
    TQ.oform=!TQ.oform;
    tqRender();
    const d=$('#tqOd');
    if(d)try{
      d.focus({preventScroll:true})
    }catch(e){}
  }else if(a==='osave')tqOffSave();
  else if(a==='odel'){
    const O=store.toeicOfficial||[],o=O[+el.dataset.i];
    if(o&&confirm(`要刪除 ${tqDate(o.date)} 的正式成績（聽力 ${o.L}、閱讀 ${o.R}）嗎？`)){
      O.splice(+el.dataset.i,1);
      save();
      tqRender()
    }
  }else if(a==='say'){
    const r=tqRunGet(),k=+el.dataset.k,it=r&&r.items[k];
    if(it)say(tqSeq(r,it).join(' '),.9)
  }
}
$('#toeicBody').addEventListener('click',e=>{
  const a=e.target.closest('[data-ans]');
  if(a){
    tqAnswer(+a.dataset.ans);
    return
  }
  const b=e.target.closest('[data-tq]');
  if(b&&!b.disabled)tqAct(b.dataset.tq,b)
});
['statsBody','quizQ'].forEach(id=>$('#'+id).addEventListener('click',e=>{
  const b=e.target.closest('[data-tq]');
  if(b)tqAct(b.dataset.tq,b,id==='quizQ'?'quiz':'stats')
}));
/* ==================================================================
   7. 情境對話與 Role Play
   對話列表與播放、Role Play（輪流說、評分、接續、難度）、Role Play 複習排程
   ================================================================== */
const DIALOGS=window.DIALOGS||[];
const DLG_BY={};
DIALOGS.forEach(d=>DLG_BY[d.id]=d);
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
    /* 點英文字查意思時，這一句的中文顯示出來（已顯示就不收起） */
    if(z&&!(e.target.closest('.dlg-en')&&!z.hidden&&lkWordAt(e)))z.hidden=!z.hidden
  }
});
$('#navDialogs').onclick=()=>{
  page('dialogs');
  renderDialogs()
};
/* ---------- Role Play（用句子頁的 🎤 辨識與 🎙 錄音） ----------
   🎤／🎙 按鈕在 Role Play 區塊裡（不用往下捲）；連續模式：對方說完自動開始聆聽、念到 80% 以上自動下一句 */
const RP={on:false,d:null,me:'B',n:-1,sc:{},peek:false,tok:0,fin:false,docked:false,autoT:null};
function rpMine(){
  return RP.d?RP.d.lines.map((L,n)=>L.s===RP.me?n:-1).filter(n=>n>=0):[]
}
function rpSave(){
  try{
    if(RP.on)sessionStorage.setItem('e5k_rp',JSON.stringify({id:RP.d.id,me:RP.me,n:RP.n,sc:RP.sc,ok:RP.ok||{},help:RP.help||{}}));else sessionStorage.removeItem('e5k_rp')
  }catch(e){}
  /* 進行中的 Role Play 另存一份（7 天內有效），切到其他頁或關掉 App 後可以「繼續」 */
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
/* Role Play 進行中回到句子頁時維持 Role Play 畫面；已完成的 Role Play 直接結束 */
function rpAfterPage(){
  if(!RP.on)return;
  if(RP.fin)rpOff();else rpShowPractice(false)
}
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
/* 每一句都讓「輪到你」和 🎤 出現在畫面上（不捲回最上面：小手機或大字體不必一直往下捲） */
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
function rpLevel(){
  const v=store.settings&&store.settings.rpLevel;
  return RP_LV[v]?v:'hint'
}
function rpInitPeek(){
  const lv=rpLevel();
  return lv==='read'?2:lv==='hint'?1:0
}
/* Role Play 難度 — 跟讀（看英文）／提示（首字母）／挑戰（只看中文）／自由回答（說到重點句型就過） */
const RP_LV={read:'跟讀（看英文）',hint:'提示（首字母）',hard:'挑戰（只看中文）',free:'自由回答（說到重點句型）'};
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
    /* 點英文字查意思時，中文只會顯示、不會被收起 */
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
  /* V6.4.0：沒念到的字（排除辨識常出錯的情況）放進錯題本 */
  const rm=rpMissMark(score,heard);
  if(r&&rm)r.insertAdjacentHTML('beforeend',rm);
  if(r)r.insertAdjacentHTML('beforeend','<br><b class="rp-pass'+(pass?' ok':'')+'">'+esc(msg)+'</b>'+(auto?'<br><small>👍 連續模式：1.5 秒後自動下一句…</small>':'<br><small>可以按「🎙 重新錄音」或「🎤」再試一次；滿意就按「下一句 →」。</small>'));
  if(auto){
    const n=RP.n,t=RP.tok;
    clearTimeout(RP.autoT);
    RP.autoT=setTimeout(()=>{
      if(RP.on&&!RP.fin&&RP.n===n&&RP.tok===t&&!VOICE.srBusy&&REC.state==='idle')rpNav(1)
    },1500)
  }
}
/* ---------- V6.4.0 Role Play 沒念到的字 → 錯題本 ----------
   語音辨識常會聽錯，所以只收「比較確定是自己沒念好」的字：
   ① 不是「自由回答」難度（自由回答可以用自己的話說）；② 這次相似度 50% 以上（整句大致有被聽到；太低多半是麥克風或辨識的問題）；
   ③ 只看字表裡有中文、比較進階的字（CE 專業字、職場英文、常用排名 900 以後）：不收常用字和基本字、冠詞介系詞代名詞等、3 個字母以下、數字、設備編號和縮寫；
   ④ 第一次沒念到先記在 store.rpMiss（觀察中），14 天內再沒念到一次才放進答錯單字本（還要答對 2 次），出處是這一句（🧩 可以放回原句重考）；
      觀察中的字之後念到了就移除；⑤ 一次最多記 3 個字。不會改變單字的學習狀態（可能只是發音或辨識的問題）。 */
function rpMissWords(en,heard){
  const T=swOwn(en),H=scHeard(heard),miss=new Set(),hit=new Set();
  T.toks.forEach((t,k)=>T.own[k].forEach(i=>(H.has(t)?hit:miss).add(i)));
  const bad=/^(det|prep|pron|conj|aux|interj|contr|num)\./,out={miss:[],hit:[]};
  T.words.forEach((w,i)=>{
    const c=w.w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,'');
    if(c.length<3||!/^[A-Za-z][a-z'-]*$/.test(c))return;
    let x=null;
    try{
      x=kwTok(c)
    }catch(e){}
    if(!x||!x.zh||!WMAP[x.w]||bad.test(x.pos||'')||(x.t||[]).includes('basic')||x.w.length<3)return;
    /* 和句子關鍵字一樣只收比較進階的字：CE 專業字、職場英文、或常用排名 900 以後的字（please、check 這類常用字不收） */
    if((x.k===7?20000:x.k===8?9000:+x.r||0)<900)return;
    const a=miss.has(i)?out.miss:hit.has(i)?out.hit:null;
    if(a&&!a.includes(x.w))a.push(x.w)
  });
  return out
}
function rpMissMark(score,heard){
  try{
    if(!RP.on||!RP.d||rpLevel()==='free')return '';
    const L=RP.d.lines[RP.n];
    if(!L)return '';
    const id='d:'+RP.d.id+':'+RP.n,M=rpMissWords(L.en,heard||'');
    if(!_isObj(store.rpMiss))store.rpMiss={};
    const P=store.rpMiss;
    let ch=false;
    M.hit.forEach(w=>{
      if(P[w]){
        delete P[w];
        ch=true
      }
    });
    if(score<50||!M.miss.length){
      if(ch)save();
      return ''
    }
    const ww=store.wrongWords=store.wrongWords||{},added=[],watch=[];
    M.miss.slice(0,3).forEach(w=>{
      if(P[w]&&_isObj(P[w])&&String(P[w].d||'')>=day(-14)){
        delete P[w];
        ww[w]=(ww[w]||0)+2;
        wsrcSet(w,false,'rp',id);
        added.push(w)
      }else{
        P[w]={n:1,d:day(),s:id};
        watch.push(w)
      }
    });
    const ks=Object.keys(P);
    if(ks.length>300)ks.slice(0,ks.length-300).forEach(k=>delete P[k]);
    if(!Object.keys(P).length)delete store.rpMiss;
    save();
    const lst=a=>a.map(w=>'「'+esc(dispW(w))+'」').join('');
    return (added.length?`<br><small class="rp-miss">📕 ${lst(added)}又沒念到，已放進錯題本（可以「🧩 放回原句」重考）</small>`:'')+(watch.length?`<br><small class="muted rp-miss">${lst(watch)}沒念到；下次再沒念到才會放進錯題本（可能只是辨識錯誤）</small>`:'')
  }catch(e){
    return ''
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
  /* 依這次的平均相似度安排下次複習（沒有用 🎤 檢查就不改排程） */
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
try{
  const rp=JSON.parse(sessionStorage.getItem('e5k_rp')||'null');
  const srNote=sessionStorage.getItem('e5k_sr')==='1';
  if(rp&&sessionStorage.getItem('e5k_go')==='practice'&&DLG_BY[rp.id])setTimeout(()=>{
    const note=srNote||/麥克風已重新啟動/.test($('#result').textContent);
    rpStart(DLG_BY[rp.id],rp.me,rp.n,rp.sc,true,{ok:rp.ok,help:rp.help});
    $('#result').textContent=note?'✅ 麥克風已重新啟動，請再按一次「🎤 開始念」。':'👉 繼續 Role Play：按「🎤 開始念」說出你的台詞'
  },0);else sessionStorage.removeItem('e5k_rp')
}catch(e){}
/* ---------- Role Play 間隔複習 ----------
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
  rpSuggestGo()
}
function rpBadge(id){
  const s=_isObj(store.rpSched)&&store.rpSched[id];
  if(!s||!s.due)return '';
  return s.due<=day()?'<em class="rp-badge due">🎭 待複習</em>':`<em class="rp-badge">🎭 下次 ${esc(v532MD(s.due))}</em>`
}
/* 今日學習建議的 Role Play — 先選還沒演過的情境，都演過就選最久沒演的 */
function rpSuggest(){
  const done=store.rpDone||{};
  return DIALOGS.find(d=>!done[d.id])||DIALOGS.slice().sort((x,y)=>String(done[x.id].d).localeCompare(String(done[y.id].d)))[0]||{t:'',id:''}
}
/* 打開建議的 Role Play 對話（今日頁；今日學習的 Role Play 步驟沒有進行中、接續或到期的對話時也用） */
function rpSuggestGo(){
  const d=rpSuggest();
  page('dialogs');
  if(DLG_BY[d.id]){
    DLG.cur=DLG_BY[d.id];
    renderDialog(DLG.cur)
  }else renderDialogs()
}
/* ==================================================================
   8. 今日學習與每日流程
   今日頁的任務、一鍵「開始今天的學習」（步驟、進度列、過午夜）、自訂今日學習、句子練習用中翻英
   ================================================================== */
function task(icon,title,done,goal,btn,id,note=''){
  let ok=goal&&done>=goal;
  let pc=goal?Math.min(100,Math.round(done/goal*100)):0;
  return `<div class="task ${ok?'task-done':''}"><div class="task-top"><span class="task-ic">${icon}</span><div class="task-t"><b>${title}</b><small>${goal?`${Math.min(done,goal)} / ${goal}`:note}${ok?' ✅':''}</small></div><button class="primary" data-go="${id}">${btn}</button></div>${goal?`<div class="bar"><span style="width:${pc}%"></span></div>`:''}</div>`
}
function renderToday(){
  let sdue=sDueN(),pdue=PHRASES.filter(x=>isPDue(x.id)).length;
  const rpSug=rpSuggest(),wb=wbData();
  let L=todayLog(),due=wDueN(),g=store.settings.dailyGoal||20;
  let d=new Date(),wd='日一二三四五六'[d.getDay()];
  let dueDone=L.review||0;
  /* 有學習進度、14 天沒備份（或從沒備份）才提醒；可以「稍後提醒」（7 天） */
  const backup=bkRemindHtml();
  $('#todayBody').innerHTML=`<div class="today-head"><div><b>${d.getMonth()+1} 月 ${d.getDate()} 日（${wd}）</b>${streakOn()?(()=>{
  const sf=streakFlex();
  return `<small class="wk-days">本週學了 ${weekDays()}／7 天${sf>=2?' · 連續 '+sf+' 天':''}</small>`
})():''}</div><div class="ring"><b>${['new','review','sent','ph','quiz','srev','prev','rp'].reduce((s,k)=>s+(L[k]||0),0)}</b><small>今日完成</small></div></div>${flowBtnHtml()}${flowCfgHtml()}${iosTipHtml()}${backup}
${(()=>{
  /* 每日複習上限（到期的字太多時分幾天消化） */
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
${wkMiniHtml()}<p class="muted">每日新字數量可在「單字」頁的「篩選」裡調整（目前 ${g} 字）。</p>${EX_FAIL?'<p class="rec-msg warn">⚠️ 單字例句還沒下載完成（網路不穩）。請連上網路後重新開啟 App；其他功能可以正常使用。</p>':''}`;
  /* data-more.js 下載失敗時提醒（其他功能照常） */
  const tb=$('#todayBody');
  if(MORE_FAIL&&tb&&!tb.querySelector('.more-fail'))tb.insertAdjacentHTML('beforeend','<p class="rec-msg warn more-fail">⚠️ CE 情境題、發音辨別和人名地名查詢的資料還沒下載完成（網路不穩）。連上網路後會自動再下載；其他功能可以正常使用。<button type="button" class="mini" data-moreget="1">🔄 重新下載</button></p>')
}
/* 今日頁的各項任務（一鍵今日學習也用它切換） */
function todayGo(g){
  /* 今日學習「🧩 句型」步驟 */
  if(g==='fr'){
    frFlowGo();
    if(flowCurK()==='fr')flowZfApply();
    return
  }
  /* 「句子跟讀」回到自己選的範圍 */
  if(g==='sent')frBackToLearn();
  /* 今日學習「🧠 意思回想」步驟 */
  if(g==='mr'){
    mrFlowGo();
    return
  }
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
    if(FLOW&&FLOW.i<FLOW.steps.length)flowGo();
    else if(!flowPlan().length)todayGo('flowset');
    else flowStart();
    return
  }
  const fk=flowCurK();
  /* 今日學習的「片語」步驟：有到期的片語先複習 */
  if(g==='ph'&&fk==='ph'&&PHRASES.some(x=>isPDue(x.id)))g='prev';
  if(g==='rp'&&fk==='rp'){
    rpFlowGo();
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
    /* 從「複習句子」過來時句子頁還停在待複習範圍，在那裡按「✓」反而會取消已會說 */
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
    rpSuggestGo()
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
  /* 自訂了新字數量：單字卡改成這一步還要學的數量 */
  if(g==='new'&&fk==='new'&&flowCfgGet().new!=null)flowFitCards();
  /* 打開句子跟讀時用中翻英（今日學習設定） */
  if(g==='sent'&&flowCurK()==='sent')flowZfApply()
}
$('#todayBody').onclick=e=>{
  let b=e.target.closest('[data-go]');
  if(!b)return;
  todayGo(b.dataset.go)
};
$('#navToday').onclick=()=>{
  page('today');
  renderToday()
};
/* ---------- 一鍵「開始今天的學習」（預設：複習 → 新字 → 句子跟讀 → CE 情境題） ---------- */
var FLOW_KEY='e5k_flow';
function flowLabel(k){
  return {review:['🔁','複習單字'],new:['🆕','學新單字'],sent:['🗣','句子跟讀','🎤 念對或按「✓ 我會說了」'],situ:['🏭','CE 情境題'],ph:['💬','片語','按 ○ 標記已會'],radio:['📻','無線電用語','🎤 念對或按 ✓'],rp:['🎭','Role Play','演完一段'],mr:['🧠','意思回想','說出中文意思再翻面'],fr:['🧩','句型','🎤 念對或按「✓ 我會說了」']}[k]
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
  /* 有自訂「今日學習」時照設定排；沒有設定時用預設 */
  if(flowCfgOn())return flowPlanCfg();
  const L=todayLog(),cap=reviewCap(),due=wDueN(),g=store.settings.dailyGoal||20;
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
/* App 開著過了午夜：昨天的今日學習結束（不然進度變 0 而且做不完） */
function flowStale(){
  if(FLOW&&FLOW.day!==day()){
    FLOW=null;
    flowSave();
    flowZfSync();
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
  if(FLOW&&FLOW.day===day()){
    if(FLOW.zf==null)FLOW.zf=flowCfgGet().zf?1:0;
    /* 先算出要打開哪一步（跳過已經做完的）：不是句子跟讀／句型就先換回原本的練習方式 */
    while(FLOW.i<FLOW.steps.length&&flowDone(FLOW.steps[FLOW.i]))FLOW.i++
  }
  flowZfSync();
  if(flowStale()){
    flowBar();
    if(!$('#todayPage').hidden)renderToday()
  }else if(FLOW){
    while(FLOW.i<FLOW.steps.length&&flowDone(FLOW.steps[FLOW.i]))FLOW.i++;
    flowSave();
    if(FLOW.i<FLOW.steps.length){
      const k=FLOW.steps[FLOW.i].k;
      todayGo(k)
    }
    flowBar()
  }
  /* 做完一輪今日學習（最後一步完成）時記錄 */
  if(FLOW&&FLOW.i>=FLOW.steps.length)flowMarkDone()
}
function flowEnd(){
  if(FLOW&&FLOW.i>=FLOW.steps.length){
    /* 做完一輪今日學習（按「完成」）時記錄 */
    flowMarkDone();
    try{
      localStorage.setItem('e5k_flow_done',day())
    }catch(e){}
  }
  FLOW=null;
  flowSave();
  flowBar();
  if(!$('#todayPage').hidden)renderToday();
  flowZfSync()
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
  /* 頁面底部留出進度列的高度，最後的按鈕可以捲到進度列上面 */
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
window.addEventListener('resize',()=>{
  if(FLOW)flowBar()
});
var FCG_OPEN=false;
/* ---------- 自訂今日學習的步驟和數量 ----------
   store.settings.flowCfg 只存跟預設不同的項目：rev 複習單字（1 開／0 關）、new 學新單字（沒設定＝跟「每日新字」）、
   sent 句子跟讀、situ CE 情境題、ph 片語、radio 無線電用語、rp Role Play、mr 意思回想、
   fr 句型（0／5／10 句）、zf 句子練習用 🀄 中翻英（1 開）。沒有任何設定時完全照預設。 */
function flowCfgOk(){
  return {rev:[0,1],new:[0,10,20,30,50],sent:[0,5,10],situ:[0,1,3],ph:[0,5,10],radio:[0,5],rp:[0,1],mr:[0,10,20],fr:[0,5,10],zf:[0,1]}
}
function flowCfgOn(){
  const c=store.settings&&store.settings.flowCfg;
  return _isObj(c)&&Object.keys(c).length>0
}
function flowCfgGet(){
  const c=store.settings&&_isObj(store.settings.flowCfg)?store.settings.flowCfg:{},ok=flowCfgOk();
  const pick=(k,def)=>ok[k].includes(c[k])?c[k]:def;
  return {rev:c.rev===0?0:1,new:ok.new.includes(c.new)?c.new:null,sent:pick('sent',5),situ:pick('situ',1),ph:pick('ph',0),radio:pick('radio',0),rp:pick('rp',0),mr:pick('mr',0),fr:pick('fr',0),zf:pick('zf',0)}
}
function flowHasRadio(){
  return !!(window.RADIO&&Array.isArray(window.RADIO.sent)&&window.RADIO.sent.length)
}
/* 順序：複習單字 → 意思回想 → 學新單字 → 片語 → 句子跟讀 → 句型 → 無線電用語 → CE 情境題 → Role Play */
function flowPlanCfg(){
  const c=flowCfgGet(),L=todayLog(),st=[];
  if(c.rev){
    const cap=reviewCap(),due=wDueN();
    const rv=Math.min(REVIEW_BATCH,due,cap?Math.max(0,cap-(L.review||0)):due);
    if(rv>0)st.push({k:'review',n:rv})
  }
  /* 🧠 意思回想（複習之後、新字之前；數量＝設定減掉今天已經在意思回想評分的張數，不超過學過的字數） */
  if(c.mr){
    const m=Math.min(Math.max(0,c.mr-(+L.mr||0)),mrSeenN(c.mr));
    if(m>0)st.push({k:'mr',n:m})
  }
  const g=c.new==null?(store.settings.dailyGoal||20):c.new,nw=Math.max(0,g-(L.new||0));
  if(nw>0)st.push({k:'new',n:nw});
  if(c.ph&&PHRASES.length)st.push({k:'ph',n:c.ph});
  if(c.sent)st.push({k:'sent',n:c.sent});
  /* 🧩 句型（句子跟讀之後） */
  if(c.fr&&frHas())st.push({k:'fr',n:c.fr});
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
  /* 句型＝句型的句子按「✓ 我會說了」＋🎤 念對（90% 以上，fsay） */
  if(k==='fr')return (Array.isArray(L.sentIds)?L.sentIds.filter(x=>/^f:/.test(String(x))).length:0)+n(L.fsay);
  if(k==='radio')return (Array.isArray(L.sentIds)?L.sentIds.filter(x=>/^r:/.test(String(x))).length:0)+n(L.rsay)+n(L.rquiz);
  return n(L[k])
}
function flowBase(L){
  const b={};
  ['review','new','sent','situ','ph','radio','rp','mr','fr'].forEach(k=>{
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
  if(k==='mr')return !mrSeenN(1);
  if(k==='fr')return !frHas();
  return false
}
/* 按鈕上的數量：複習、新字一定顯示；其他步驟跟預設不同時才顯示 */
function flowAmt(s){
  const D={sent:5,situ:1,rp:1};
  return s.k==='review'||s.k==='new'||D[s.k]!==s.n?' '+s.n:''
}
function flowSec(k){
  return {review:15,new:18,sent:36,situ:60,ph:24,radio:30,rp:360,mr:12,fr:40}[k]||30
}
/* 預估分鐘（預設：複習 20、新字 20、句子 5、情境題 1 ≈ 15 分鐘） */
function flowMin(p){
  return Math.max(1,Math.round(p.reduce((t,s)=>t+s.n*flowSec(s.k),0)/60))
}
function flowEstText(p){
  return (p.length?`預估約 <b>${flowMin(p)}</b> 分鐘：${esc(p.map(s=>flowLabel(s.k)[1]+flowAmt(s)).join(' → '))}`:'目前的設定今天沒有要做的項目。')+flowZfNote(p)
}
function flowEmptyHtml(){
  let fd='';
  try{
    fd=localStorage.getItem('e5k_flow_done')
  }catch(e){}
  const dn=fd===day();
  return `<button class="wide flow-start${dn?' flow-done':''}" data-go="flowset">${dn?'✅ 今天的學習完成了':'▶ 開始今天的學習'}<small>目前的設定今天沒有要做的項目，點這裡調整</small></button>`
}
function flowCfgHtml(){
  const on=flowCfgOn(),open=!!FCG_OPEN;
  let h=`<div class="fcg-bar"><button type="button" class="mini fcg-t${on?' on':''}" data-go="flowcfg" aria-expanded="${open}">⚙️ 調整今日學習${on?' ●':''}</button></div>`;
  if(!open)return h;
  const c=flowCfgGet(),g=+store.settings.dailyGoal||20,p=flowPlan(),act=!!(FLOW&&FLOW.i<FLOW.steps.length);
  const sel=(k,ic,lab,vals,cur)=>`<label class="fcg-row"><span>${ic} ${lab}</span><select data-fc="${k}" aria-label="${lab}">${vals.map(([v,t])=>`<option value="${v}"${v===cur?' selected':''}>${t}</option>`).join('')}</select></label>`;
  const nv=[...new Set([0,10,20,30,g])].sort((a,b)=>a-b).map(v=>[v,v===0?'不學':v===g?v+' 個（每日新字）':v+' 個']);
  h+=`<div class="fcg" role="group" aria-label="調整今日學習"><b class="fcg-h">今天要做哪些、做多少</b>`+
    sel('rev','🔁','複習單字',[[1,'開（最多 20 個）'],[0,'關']],c.rev)+
    sel('mr','🧠','意思回想',[[0,'不做'],[10,'10 個'],[20,'20 個']],c.mr)+
    sel('new','🆕','學新單字',nv,c.new==null?g:c.new)+
    sel('ph','💬','片語',[[0,'不做'],[5,'5 個'],[10,'10 個']],c.ph)+
    sel('sent','🗣','句子跟讀',[[0,'不做'],[5,'5 句'],[10,'10 句']],c.sent)+
    (frHas()?sel('fr','🧩','句型',[[0,'不做'],[5,'5 句'],[10,'10 句']],c.fr):'')+
    (flowHasRadio()?sel('radio','📻','無線電用語',[[0,'不做'],[5,'5 句／題']],c.radio):'')+
    sel('situ','🏭','CE 情境題',[[0,'不做'],[1,'1 題'],[3,'3 題']],c.situ)+
    (DIALOGS.length?sel('rp','🎭','Role Play',[[0,'不做'],[1,'1 段（優先複習到期的）']],c.rp):'')+
    `<label class="fcg-row fcg-opt"><span>句子練習用 🀄 中翻英</span><select data-fc="zf" aria-label="句子練習用中翻英">${[[0,'關'],[1,'開']].map(([v,t])=>`<option value="${v}"${v===c.zf?' selected':''}>${t}</option>`).join('')}</select></label>`+
    `<p class="fcg-est">${flowEstText(p)}</p>`+
    (act?'<p class="muted fcg-note">進行中的今日學習不變；新的設定從下一次「開始今天的學習」起套用。</p>':'')+
    '<div class="fcg-btns"><button type="button" data-go="flowreset">恢復預設</button><button type="button" class="primary" data-go="flowcfg">完成</button></div></div>';
  return h
}
function flowCfgSet(k,v){
  const ok=flowCfgOk(),D={rev:1,sent:5,situ:1,ph:0,radio:0,rp:0,mr:0,fr:0,zf:0};
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
/* 自訂了新字數量：單字卡改成這一步還要學的數量（沒有自訂時照「每日新字」） */
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
  rpOff();
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
$('#todayBody').addEventListener('change',e=>{
  const s=e.target.closest&&e.target.closest('select[data-fc]');
  if(!s)return;
  flowCfgSet(s.dataset.fc,+s.value);
  flowCfgRefresh()
});
/* ---------- 句子練習用 🀄 中翻英（store.settings.flowCfg.zf＝1；預設關、不存） ----------
   今日學習打開「句子跟讀」「句型」時，用句子頁的切換（zfSet）改成「看中文說英文」，並記下 store.settings.zfFlow＝1（表示原本是「看英文跟讀」）；
   今日學習離開這兩步（下一步、略過、按 ✕ 結束、做完、過了午夜、重新開啟時已經沒有進行中的今日學習）就切回「看英文跟讀」。
   原本就是「看中文說英文」的人什麼都不改。今日學習進行中自己按了「👂 跟讀／🀄 中翻英」，就以自己按的為準
   （這一輪不再切換，結束後也不改回）。這個設定在開始今天的學習時記下（FLOW.zf），進行中的今日學習不受影響。 */
/* 設定面板的說明（預估時間下面） */
function flowZfNote(p){
  if(!flowCfgGet().zf)return '';
  const a=p.some(s=>s.k==='sent'),b=p.some(s=>s.k==='fr');
  return '<small class="fcg-zf">'+(a||b?'🀄 '+(a&&b?'句子跟讀、句型':a?'句子跟讀':'句型')+'：用「看中文說英文」練習，做完'+(a&&b?'這兩步':'這一步')+'就換回原本的練習方式。':'🀄 中翻英只用在「句子跟讀」和「句型」，目前的設定沒有這兩步。')+'</small>'
}
/* 今日學習現在要用中翻英：這一輪開始時有開這個設定、還沒自己切換過、正在「句子跟讀」或「句型」 */
function flowZfWant(){
  const k=flowCurK();
  return !!(FLOW&&FLOW.zf===1&&!FLOW.zfm&&(k==='sent'||k==='fr'))
}
function flowZfApply(){
  if(!flowZfWant()||zfOn())return;
  store.settings.zfFlow=1;
  zfSet(true)
}
/* 離開這兩步（或今日學習結束）：換回原本的「看英文跟讀」 */
function flowZfSync(){
  const st=store.settings;
  if(!st||!st.zfFlow||flowZfWant())return;
  delete st.zfFlow;
  if(zfOn())zfSet(false);else save()
}
/* App 一直開著或從背景回來、日期已經換了：補存當天的自動備份 */
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
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)flowZfSync()
});
/* ==================================================================
   9. 統計、備份、儲存空間
   統計頁（題型、未來 7 天、每週摘要、儲存空間）、語音與外觀設定、備份匯出匯入與提醒、資料保存（iPhone 加入主畫面、Android 保留資料）、版本檢查
   ================================================================== */
function bar(n,t){
  let pc=t?Math.round(n/t*100):0;
  return `<div class="bar"><span style="width:${pc}%"></span></div><small>${n} / ${t}（${pc}%）</small>`
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
  /* V6.4.0 速度：冊別、合計、學習中的數量掃一遍字表就算完（結果和分開計算相同） */
  const BK=[1,2,3,4,5,7,8,'toeic'],C={};
  BK.concat('all').forEach(b=>C[b]=[0,0]);
  let learning=0;
  WORDS.forEach(x=>{
    const st=statusOf(x.w),kn=st==='known';
    if(st==='learning')learning++;
    if(sv&&x.b&&x.k!==7)return;
    const c=b=>{
      C[b][0]++;
      if(kn)C[b][1]++
    };
    if(x.k>=1&&x.k<=8&&C[x.k])c(x.k);
    if(x.toeic)c('toeic');
    if(!x.ce&&!x.job)c('all')
  });
  let books=BK.map(b=>{
    const [n,k]=C[b];
    if(!n)return '';
    return `<div class="stat-row"><b>${b===7?'CE 字':b===8?'職場英文':b==='toeic'?'TOEIC 多益':'第 '+b+' 冊'}</b>${bar(k,n)}</div>`
  }).join('');
  let allW={length:C.all[0]},allK=C.all[1];
  let due=wDueN();
  /* V6.4.0 速度：內容和上次完全一樣時不重畫（重畫約要 0.1 秒）；畫面上的內容被改過（例如測試）時照樣重畫 */
  const sh=`<div class="stat-cards${streakOn()?'':' sc2'}">${streakOn()?`<div><b>${weekDays()}<small>／7</small></b><span>本週學習天數${streakFlex()>=2?'（連續 '+streakFlex()+' 天）':''}</span></div>`:''}<div><b>${(store.studyDays||[]).length}</b><span>累計學習天數</span></div><div><b>${tot?Math.round(r/tot*100)+'%':'—'}</b><span>測驗正確率（${r}/${tot}）</span></div></div>${wkHtml()}${toeicCardHtml()}<h3>單字（已熟）${sv?'<small class="muted">　只計原形</small>':''}</h3>${books}<div class="stat-row"><b>合計</b>${bar(allK,allW.length)}</div><p class="muted">學習中 ${learning} 字 · 今日待複習 ${due} 字</p><h3>片語</h3><div class="stat-row"><b>已會</b>${bar(store.phKnown.length,PHRASES.length)}</div><p class="muted">待複習片語 ${PHRASES.filter(x=>isPDue(x.id)).length} 個</p><h3>句子</h3><div class="stat-row"><b>會說了</b>${bar(store.known.length,ALLS.length)}</div><p class="muted">待複習句子 ${sDueN()} 句</p>`+statsExtraHtml()+qStatHtml()+stHtml();
  const sb=$('#statsBody');
  if(sb.__h===sh&&sb.__n===sb.childNodes.length&&sb.firstChild===sb.__f)return;
  sb.innerHTML=sh;
  sb.__h=sh;
  sb.__n=sb.childNodes.length;
  sb.__f=sb.firstChild
}
/* ---------- 統計頁：未來 7 天複習量、單字複習答對率 ---------- */
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
  return `<h3>未來 7 天要複習 <small class="muted">（今天含已過期）</small></h3><div class="fc">${rows}</div><h3>單字複習答對率 <small class="muted">（近 30 天，V5.29.0 起統計）</small></h3>`+(ok+ng?`<div class="stat-row"><b>記得</b>${bar(ok,ok+ng)}</div><p class="muted">複習到期單字時按「✓ 已熟」${ok} 次、「◐ 模糊／✗ 不熟」${ng} 次。答對率低於 8 成時，可以把每日新字調少一點。</p>`:'<p class="muted">還沒有紀錄：複習到期單字時按「✓ 已熟」「◐ 模糊」「✗ 不熟」就會開始統計。</p>')+mrStatHtml()
}
$('#statsBody').addEventListener('click',e=>{
  if(e.target.closest('[data-openwb]'))openWrongBook()
});
$('#statsBody').addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('[data-bkgo]'))bkScroll()
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
/* V6.3.0：學習天數（本週天數、連續天數）顯示開關；關掉時今日頁、統計頁都不顯示 */
(function(){
  const c=$('#streakShow');
  if(!c)return;
  c.checked=streakOn();
  c.onchange=()=>{
    if(c.checked)delete store.settings.hideStreak;else store.settings.hideStreak=true;
    save();
    try{
      renderStats()
    }catch(e){}
  }
})();
$('#themeSel').value=store.settings.theme||'auto';
$('#themeSel').onchange=e=>{
  store.settings.theme=e.target.value;
  save();
  applyTheme()
};
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
applyTheme();
/* 字體大小：標準／大／特大；同時存一份在 e5k_fs，開啟時在畫面出現前就套用 */
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
/* ---------- 進度備份與還原 ----------
   匯出：app / version / schemaVersion / fmt（V6.0 起 6）/ exportedAt / summary / progress，匯出前先自我檢查。
   匯入：檢查 JSON、是否為 English 5000 備份、fmt（比這個 App 新的不匯入；舊檔沒有 fmt）、是否有 progress、格式版本、各欄位型別；
         有問題一律不動目前紀錄。匯入或還原前先把目前紀錄存到「復原點」，可隨時復原。 */
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
  return {app:'english-5000',version:APP_VERSION,schemaVersion:BACKUP_SCHEMA,fmt:BACKUP_FMT,exportedAt:new Date().toISOString(),summary:progSummary(store),progress:JSON.parse(JSON.stringify(store))}
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
  /* V6.0：fmt＝儲存格式版本（V6.0 起 6；舊的備份檔沒有 fmt，照常匯入）。比這個 App 新的不匯入 */
  if(obj.fmt!=null){
    const f=Number(obj.fmt);
    if(!(f>=1)||Math.floor(f)!==f)return {err:'無法辨識備份檔的格式版本。'};
    if(f>BACKUP_FMT)return {err:'這是較新版本 App 的備份，請先更新 App 再匯入。'}
  }
  const p=obj.progress;
  if(!p||typeof p!=='object'||Array.isArray(p))return {err:'備份檔裡沒有學習進度（progress）。'};
  const sv=obj.schemaVersion==null?(p.wordKeyVersion>=3?3:2):Number(obj.schemaVersion);
  if(!(sv>=1)||Math.floor(sv)!==sv)return {err:'無法辨識備份檔的格式版本。'};
  if(sv>BACKUP_SCHEMA)return {err:`這個備份來自較新版本的 App（格式 ${sv}），請先更新 App 再匯入。`};
  const arr=['fav','known','wordFav','wordKnown','phFav','phKnown','studyDays'],objs=['wordStatus','reviewDue','reviewStage','wrongWords','sDue','sStage','pDue','pStage','settings','dailyLog','dlgDone','rpDone','sqWrong','lsWrong','qStat','wrongSrc','rpMiss'];
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
  clearTimeout(bmTimer);
  bmTimer=setTimeout(()=>{
    if(el)el.hidden=true
  },15000)
}
function writeProgress(p,note){
  const pre=JSON.stringify({savedAt:new Date().toISOString(),version:APP_VERSION,summary:progSummary(store),progress:store});
  /* 學習紀錄很大時，空間不夠存「復原點」：V6.0 先把每日自動備份移到瀏覽器資料庫；還是不夠（或資料庫不能用）才清掉最舊的每日自動備份再試（要還原的那份已經讀進來了） */
  let ok=lsSet(PRE_KEY,pre)||snapFreeSafe(()=>lsSet(PRE_KEY,pre));
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
  /* 剛移到瀏覽器資料庫的自動備份還沒寫完時，等寫完（最多 2 秒）再重新載入 */
  snapDbFlushThen(()=>location.reload());
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
    /* 用暫時的文字框複製（畫面上的文字框收起來時選不到內容） */
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
  const canShare=!!(navigator.canShare&&window.File);
  box.innerHTML=`<p class="muted">學習紀錄只存在這支手機的瀏覽器裡。清除瀏覽資料、換手機或換瀏覽器前，請先匯出備份檔。</p>
 <div class="bk-sum"><b>目前紀錄</b><small>${esc(sumText(s))}</small><small class="bk-last">${bkLastHtml()}</small></div>
 <div class="grid2"><button id="bkExport" class="primary">💾 匯出備份檔</button>${canShare?'<button id="bkShare">📤 分享／存到「檔案」</button>':''}<label class="importBtn bk-import">📥 匯入備份檔<input id="bkImport" type="file" hidden></label><button id="bkCopy">📋 複製備份內容</button>${pre&&pre.progress?`<button id="bkUndo">↩️ 復原到 ${esc(fmtTime(pre.savedAt))} 匯入／還原前</button>`:''}</div>
 <p class="muted bk-hint">📁 <b>找不到備份檔？</b>按「📥 匯入備份檔」後，在檔案視窗下方點「瀏覽」→「最近項目」，或在上方搜尋 <b>english-5000</b>；也可到「我的 iPhone」或 iCloud Drive 找（用 Edge 存的檔案常在「我的 iPhone › Edge」）。${store.lastExportName?'<br>上次匯出的檔名：<b>'+esc(store.lastExportName)+'</b>':''}</p>
 <div id="backupMsg" class="rec-msg" role="status" aria-live="polite" hidden></div>
 <details class="bk-paste"><summary>📝 貼上備份內容匯入（不用檔案）</summary><textarea id="bkPaste" aria-label="備份內容" rows="4" placeholder="把「📋 複製備份內容」複製的整段文字貼在這裡"></textarea><button id="bkPasteGo">匯入貼上的內容</button></details>
 <h3>自動備份（每天第一次開啟時保存，保留 <span id="bkDays">${snapLsMax()===SNAP_LS_DAYS?SNAP_LS_DAYS:SNAP_DB_DAYS}</span> 天）</h3><div id="bkSnaps"><p class="muted">讀取中…</p></div>`;
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
  bkSnapsFill()
}
/* V6.0：自動備份清單（localStorage 的最新一份＋瀏覽器資料庫的歷史，新的在前）。讀資料庫要一點時間：先顯示「讀取中」，讀到後再列出；
   還原和以前一樣（先存「復原點」），資料庫裡的那份讀出來再還原 */
function bkSnapsFill(){
  const tok=++SNAPDB.rt;
  snapMetaAll().then(r=>{
    const el=$('#bkSnaps');
    if(!el||tok!==SNAPDB.rt)return;
    const snaps=r.list,d=$('#bkDays');
    if(d)d.textContent=snapLsMax()===SNAP_LS_DAYS?SNAP_LS_DAYS:SNAP_DB_DAYS;
    el.innerHTML=snaps.length?snaps.map((x,k)=>`<div class="bk-row"><span><b>${esc(x.date)}</b><small>${esc(sumText(x.summary))}</small></span><button data-snap="${k}">還原</button></div>`).join(''):'<p class="muted">還沒有自動備份（明天開啟時會自動建立）。</p>';
    el.querySelectorAll('[data-snap]').forEach(b=>b.onclick=async()=>{
      const m=snaps[+b.dataset.snap],x=m&&await snapGet(m.date);
      if(!x){
        backupMsg('❌ 找不到這份自動備份，請重新開啟統計頁。','warn');
        return
      }
      restoreFrom(x.progress,x.date+' 自動備份')
    })
  }).catch(()=>{})
}
/* ---------- 上次備份時間、備份提醒 ----------
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
/* ---------- 每週摘要（最近 7 天和前 7 天比較，資料來自 dailyLog） ---------- */
function wkData(){
  const L=_isObj(store.dailyLog)?store.dailyLog:{},sd=new Set(store.studyDays||[]),n=v=>typeof v==='number'&&isFinite(v)&&v>0?v:0;
  let fd='';
  try{
    fd=localStorage.getItem('e5k_flow_done')||''
  }catch(e){}
  const W=[0,1].map(()=>({days:0,new:0,review:0,sent:0,ph:0,quiz:0,qok:0,qn:0,rp:0,flow:0,mr:0}));
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
    w.mr+=n(x.mr);
    if(n(x.flow)>0||fd===d)w.flow++
  }
  return W
}
function wkRows(W){
  const a=W[0],b=W[1],pc=w=>w.qn?Math.round(w.qok/w.qn*100):null;
  return [['學習天數',a.days,b.days,'天'],['新單字',a.new,b.new,'個'],['複習單字',a.review,b.review,'個'],['意思回想',a.mr,b.mr,'個'],['句子跟讀',a.sent,b.sent,'句'],['片語',a.ph,b.ph,'個'],['測驗作答',a.quiz,b.quiz,'題'],['測驗正確率',pc(a),pc(b),'%'],['Role Play',a.rp,b.rp,'段'],['完成今日學習',a.flow,b.flow,'天']]
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
  const chips=[['學習',a.days,b.days,' 天'],['新字',a.new,b.new,''],['複習',a.review,b.review,''],['意思回想',a.mr,b.mr,''],['句子',a.sent,b.sent,''],['片語',a.ph,b.ph,''],['測驗',a.quiz,b.quiz,' 題'+(pc!=null?'（'+pc+'%）':'')],['Role Play',a.rp,b.rp,' 段'],['完成今日學習',a.flow,b.flow,' 天']].filter((c,k)=>k===0||c[1]||c[2]);
  return `<div class="wk-mini"><div class="wk-mini-t"><b>📅 最近 7 天</b><button type="button" class="mini" data-go="week">完整摘要 ›</button></div><div class="wk-chips">${chips.map(c=>`<span>${c[0]} <b>${c[1]}</b>${c[3]}${wkArrow(c[1],c[2])}</span>`).join('')}</div><small class="muted">▲▼：和前 7 天比較</small></div>`
}
/* ---------- 儲存空間（統計頁） ----------
   localStorage 以字元數估算（瀏覽器上限約 5M 字元，畫面寫「約 5 MB」）；離線檔案用 navigator.storage.estimate()；
   V6.0：另外一行列出瀏覽器資料庫（IndexedDB）裡的自動備份份數和大小（stDb） */
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
  setTimeout(()=>{
    stEst();
    stDb()
  },0);
  return `<h3 id="stCard">💽 儲存空間</h3><div class="st-box"><div class="st-top"><b>學習資料（瀏覽器儲存區）</b><span>約 ${stSize(r.total)}，上限約 5 MB（已用 ${pct}%）</span></div>`+
    `<div class="st-bar" role="img" aria-label="儲存空間已用 ${pct}%"><span class="st-p" style="width:${w(r.prog)}"></span><span class="st-s" style="width:${w(r.snap)}"></span><span class="st-o" style="width:${w(oth)}"></span><span class="st-x" style="width:${w(r.other)}"></span></div>`+
    `<div class="st-leg"><span><i class="st-p"></i>學習紀錄 ${stSize(r.prog)}</span><span><i class="st-s"></i>每日自動備份 ${stSize(r.snap)}</span><span><i class="st-o"></i>其他（設定${r.pre?'、復原點':''}）${stSize(oth)}</span>${r.other?`<span><i class="st-x"></i>同網址的其他網頁 ${stSize(r.other)}</span>`:''}</div>`+
    `<p class="muted st-est" id="stDb">瀏覽器資料庫：讀取中…</p><p class="muted st-est" id="stEst">離線檔案：計算中…</p>`+
    (pct>80?`<div class="rec-msg warn st-warn"><span>⚠️ 儲存空間已用 ${pct}%，快滿了。請先到下方「資料備份與還原」匯出備份檔；空間不夠時，App 會先${snapDbMaybe()?'把每日自動備份移到瀏覽器資料庫':'刪掉最舊的每日自動備份'}。</span><button type="button" class="mini" data-bkgo="1">⬇️ 前往資料備份</button></div>`:'')+'</div>'
}
/* V6.0：瀏覽器資料庫（IndexedDB）裡的自動備份：份數、大小（和上面一樣以字元數估算） */
function stDb(){
  if(!$('#stDb'))return;
  snapDbList().then(a=>{
    const x=$('#stDb');
    if(!x)return;
    const n=a?a.reduce((s,y)=>s+y.size,0):0;
    x.textContent=a?'瀏覽器資料庫：'+a.length+' 份自動備份（約 '+(n<1e6?(n?Math.max(1,Math.round(n/1e3)):0)+' KB':(n/1e6).toFixed(1)+' MB')+'）':'瀏覽器資料庫：無法使用（自動備份只存在瀏覽器儲存區，保留 '+SNAP_LS_DAYS+' 天）'
  }).catch(()=>{})
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
/* ---------- 資料保存：iPhone 提示加入主畫面、Android 請瀏覽器保留資料 ---------- */
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
(function(){
  try{
    if(navigator.storage&&navigator.storage.persisted)navigator.storage.persisted().then(p=>{
      if(!p&&navigator.storage.persist&&(isStandalone()||/Android/i.test(navigator.userAgent)))navigator.storage.persist().catch(()=>{})
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
/* ==================================================================
   10. 點字查詢
   點句子裡的英文字查意思（單字表、詞形還原、不規則變化、片語、人名地名、補充字典、序數、字母、編號）
   ================================================================== */
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
  /* 先試比較可能的原形（taped → tape、used → use、added → add、bigger → big） */
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
/* 單字表沒有收的不規則變化（am → be、sat → sit、shelves → shelf…）、稱謂與時間縮寫 */
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
    /* 人名地名、補充字典、序數、字母代號、編號 */
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
  if(el)delete el.dataset.lkwait;
  /* 人名地名等資料（data-more.js）還沒下載完：先顯示「查詢中」（不發音），下載完 lkMoreDone 自動換成結果 */
  const wait=r&&r.wait;
  if(wait)r=null;
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
    if(wait){
      MORE_LK=wait;
      el.dataset.lkwait='1';
      el.innerHTML=`<button class="lk-x" data-lk="x" aria-label="關閉">✕</button><div class="lk-w"><b lang="en">${esc(raw)}</b></div><div class="lk-zh">⏳ 查詢資料下載中，請稍候…</div>`
    }else if(MORE_FAIL)el.insertAdjacentHTML('beforeend','<div class="lk-base">⚠️ 人名、地名和補充字典的資料下載失敗（網路不穩）。<button type="button" class="mini" data-lkmore="1">🔄 重新下載</button></div>');
    return
  }
  /* 稱謂、a.m./p.m.、無線電字母代碼與用語、連字號複合字（各部分的意思） */
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
/* 查詢視窗可以用鍵盤操作（開啟時移到視窗、Esc 關閉並回到原來的位置）；讀屏軟體會念出內容 */
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
/* 點字查詢：單字表找不到時，依序找人名地名、補充字典、序數、字母代號、編號 */
function lkGloss(q){
  const G=window.GLOSS||{},b=q.replace(/'s$/,'');
  if(G[q])return [q,G[q]];
  if(G[b])return [b,G[b]];
  for(const c of lkStems(b))if(G[c])return [c,G[c]];
  return null
}
function lkExtra(w,p,n,raw){
  /* 人名地名、補充字典在 data-more.js：還沒下載完先顯示「查詢中」，下載完自動顯示結果；下載失敗就照順序找其他的說明 */
  if(!MORE_READY&&!window.PROPER){
    MORE_LKA={raw,p,n};
    if(!MORE_FAIL){
      moreNeed();
      return {wait:{raw,p,n}}
    }
  }
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
function lkMoreDone(){
  const w=MORE_LK,el=$('#lkPop');
  if(!w)return;
  MORE_LK=null;
  if(!el||el.hidden||el.dataset.lkwait!=='1')return;
  lkShow(lkFind(w.raw,w.p,w.n),String(w.raw).replace(/[-.]+$/,''))
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('#lkPop [data-lkmore]');
  if(!b||!MORE_LKA)return;
  const el=$('#lkPop'),a=MORE_LKA;
  moreNeed();
  if(MORE_READY)lkShow(lkFind(a.raw,a.p,a.n),String(a.raw).replace(/[-.]+$/,''));
  else if(el){
    MORE_LK=a;
    el.dataset.lkwait='1';
    el.innerHTML=`<button class="lk-x" data-lk="x" aria-label="關閉">✕</button><div class="lk-w"><b lang="en">${esc(String(a.raw).replace(/[-.]+$/,''))}</b></div><div class="lk-zh">⏳ 查詢資料下載中，請稍候…</div>`
  }
});
/* ==================================================================
   11. 無線電、發音辨別、KK
   KK 音標（由美式 IPA 自動轉換）、無線電用語（字母代碼、常用說法、唸代號、聽代號測驗）、發音辨別
   ================================================================== */
/* ---------- 音標：IPA／KK（KK 由 App 的美式音標自動轉換，僅供參考） ---------- */
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
        /* 次重音（ˌ）也算重讀；ər 後面接母音時，非重讀寫成 ər（battery ˋbætərɪ），重讀寫成 ɝ（hurry ˋhɝɪ） */
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
/* ---------- 無線電用語：字母代碼、常用說法、唸代號、聽代號測驗 ---------- */
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
/* ---------- 發音辨別：成對練習（th／s、l／n、r／l、v／b、ship／sheep…） ---------- */
function pairsQuiz(){
  qCur='pairs';
  const P=window.PAIRS||[];
  if(!P.length){
    if(moreWait('pairs'))return;
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
/* ==================================================================
   12. 句型替換、中翻英、意思回想
   句型替換（句型框、換一句）、看中文說英文（提示、🎤 後公布英文、自動播放）、今日學習的句型步驟、意思回想卡與統計
   ================================================================== */
/* ---------- 句子頁的兩種練習方式、句型替換 ----------
   store.settings.zhFirst：切到「看中文說英文」才會有這個欄位；沒有＝看英文跟讀。
   👂 看英文跟讀：一般的跟讀。
   🀄 看中文說英文：中文在上面當題目，英文先藏起來（💡 提示：每個字只顯示第一個字母；👁 看英文）；③ 關鍵字等看到英文才顯示；換句子時不會自動念英文。
     按 🎤 用英文說出來：辨識完自動顯示英文，結果的逐字回饋標出念到（綠）和沒念到（紅）的字；評分、✓ 我會說了、今日學習的計數都和看英文跟讀一樣。
     自動播放：念中文 → 停 3～8 秒（依句子長度）讓你自己說 → 顯示英文並念英文（「英文播 2 次」時再慢速念一次）→ 下一句；
     手機沒有中文語音時只顯示中文、一樣停頓。Role Play 進行中不受影響（Role Play 有自己的難度）。
   🧩 句型替換（window.FRAMES：24 個 CE 工作常用句型，共 158 句）：句子 id＝f:句型 id:第幾句（固定不變）；單元 frame＝全部句型、fr01～fr24＝單一句型。
     句型的句子上方有句型框：英文句型（空格）、中文句型、用法；可以換句型、「🔀 換一句」換同一個句型的另一句；看得到英文時，句子裡填進空格的字用黃底標出。 */
/* 句型的簡短名稱（選單用；沒有列出的句型用說明的第一段） */
function frShort(f,k){
  const S={fr01:'回報警報',fr02:'請人幫忙看',fr03:'設備狀態',fr04:'接下來要做',fr05:'稍後回報',fr06:'要我幫忙嗎',fr07:'說出判斷',fr08:'不確定先確認',fr09:'要先做嗎',fr10:'請對方傳資料',fr11:'多久會到',fr12:'先後順序',fr13:'請再說一次',fr14:'確認聽懂',fr15:'回報完成',fr16:'往上通報',fr17:'暫停作業',fr18:'交接說明',fr19:'排程時間',fr20:'發現異常',fr21:'請求許可',fr22:'回報讀值',fr23:'提出建議',fr24:'說明位置'};
  return S[f.id]||String(f.tip||'').split(/[：，]/)[0]||'句型 '+(k+1)
}
/* 句子頁「單元」選單：🧩 句型替換（全部）＋每個句型（由 updEveryLabel 呼叫；開啟 App 時在還原上次的單元之前就建立好） */
function frUnitOpts(){
  const g=document.getElementById('frUnits'),F=(window.FRAMES||[]).filter(f=>f&&/^fr\d+$/.test(f.id)&&Array.isArray(f.items));
  if(!g)return;
  if(!F.length){
    g.remove();
    return
  }
  const ops=[...g.querySelectorAll('option')],get=v=>{
    let o=ops.find(x=>x.value===v);
    if(!o){
      o=document.createElement('option');
      o.value=v;
      g.appendChild(o);
      ops.push(o)
    }
    return o
  };
  get('frame').textContent='🧩 句型替換（'+F.reduce((a,f)=>a+f.items.length,0)+'）';
  F.forEach((f,k)=>{
    get(f.id).textContent='句型 '+(k+1)+'・'+frShort(f,k)+'（'+f.items.length+'）'
  })
}
function frById(id){
  return (window.FRAMES||[]).find(f=>f&&f.id===id)||null
}
function frItem(s){
  const m=/^f:(.+):(\d+)$/.exec(s&&s.id||''),f=m&&frById(m[1]);
  return f&&Array.isArray(f.items)&&f.items[+m[2]]||null
}
/* 填進空格的字在句子裡的位置：照順序找，整個字相符（不會找到別的字的一部分） */
function frSpans(en,fills){
  en=String(en||'');
  const out=[],low=en.toLowerCase(),wc=c=>/[A-Za-z0-9]/.test(c||'');
  let at=0;
  (fills||[]).forEach(w=>{
    w=String(w||'').toLowerCase();
    if(!w)return;
    for(let k=low.indexOf(w,at);k>=0;k=low.indexOf(w,k+1)){
      if(!wc(en[k-1])&&!wc(en[k+w.length])){
        out.push([k,k+w.length]);
        at=k+w.length;
        return
      }
    }
  });
  return out
}
function frMarkHtml(en,spans,f){
  let h='',last=0;
  spans.forEach(([a,b])=>{
    h+=f(en.slice(last,a))+'<mark class="fr-fill">'+f(en.slice(a,b))+'</mark>';
    last=b
  });
  return h+f(en.slice(last))
}
function frBlankHtml(t){
  return esc(t).replace(/_{2,}/g,'<span class="fr-blank" aria-hidden="true"></span><span class="e5-sr">（空格）</span>')
}
var ZF={id:null,rev:false,hint:false};
var ZF_RES0='按下後朗讀上面的英文句子';
function zfOn(){
  return !!(store.settings&&store.settings.zhFirst===true)
}
function zfRp(){
  try{
    return !!RP.on
  }catch(e){
    return false
  }
}
function zfActive(){
  return zfOn()&&!zfRp()
}
function zfSegUI(){
  const on=zfOn();
  document.querySelectorAll('#zfSeg [data-zf]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.zf==='1')===on)))
}
/* 🎤 下面也顯示中文題目（小手機往下捲到 🎤 時還看得到要說什麼） */
function zfResHtml(s){
  return '<b class="zf-rzh">🀄 '+esc(s.zh)+'</b><br><small>按「🎤 開始念」用英文說出來（說完會自動評分，並顯示英文）</small>'
}
/* 💡 提示：每個字只留第一個字母（和 Role Play 的提示一樣）；句型的句子把填空的部分標出來 */
function zfHintHtml(s){
  const hx=x=>esc(rpHintText(x)),it=s.src==='frame'?frItem(s):null;
  return it?frMarkHtml(s.en,frSpans(s.en,it.fill),hx):hx(s.en)
}
/* 看中文說英文：依目前的句子顯示中文、藏英文（render 之後、按提示／看英文、🎤 有結果時都會呼叫） */
function zfApply(){
  const se=$('.sentence'),s=cur();
  if(!se||!s)return;
  const on=zfActive();
  if(ZF.id!==s.id){
    ZF.id=s.id;
    ZF.rev=false;
    ZF.hint=false
  }
  se.classList.toggle('zf-on',on);
  se.classList.toggle('zf-rev',on&&ZF.rev);
  const m=$('#zfMask'),sz=$('#showZh');
  if(m)m.hidden=!on||ZF.rev;
  if(sz)sz.textContent=on?(ZF.rev?'🙈 藏英文':'👁 看英文'):'👁 看中文';
  if(!on)return;
  $('#chinese').hidden=false;
  const kw=$('#keywords'),kh=kw&&kw.previousElementSibling,hide=!(s.keys&&s.keys.length)||!ZF.rev;
  if(kw)kw.hidden=hide;
  if(kh&&kh.tagName==='H2')kh.hidden=hide;
  const q=$('#zfQ'),h=$('#zfHintTxt'),hb=$('#zfHint'),r=$('#result');
  if(q)q.textContent=autoOn?'⏳ 換你用英文說說看…（等一下會公布英文）':'🗣 用英文說說看';
  if(h){
    h.hidden=!ZF.hint;
    h.innerHTML=ZF.hint?zfHintHtml(s):''
  }
  if(hb){
    hb.setAttribute('aria-pressed',ZF.hint?'true':'false');
    hb.textContent=ZF.hint?'💡 收起提示':'💡 提示'
  }
  if(r&&r.textContent===ZF_RES0)r.innerHTML=zfResHtml(s)
}
/* 句型框（只建立一次，之後換句子只更新內容，選單和按鈕不會失去焦點） */
function frBuild(){
  const box=$('#frBox');
  if(!box||box.dataset.ok)return;
  box.dataset.ok='1';
  box.innerHTML='<div class="fr-row"><select id="frSel" aria-label="選擇句型"></select><button type="button" id="frAgain">🔀 換一句</button></div><div id="frPat" class="fr-pat" lang="en"></div><div id="frZh" class="fr-zh"></div><div id="frTip" class="fr-tip"></div><div id="frRec" class="fr-rec">建議搭配上方的「🀄 中翻英」（看中文說英文）：先看中文，自己套用句型說出英文。</div>';
  $('#frSel').onchange=e=>frSwitch(e.target.value);
  $('#frAgain').onclick=frAnother
}
function frSelOpts(){
  const sel=$('#frSel');
  if(!sel)return;
  const ops=[...document.querySelectorAll('#frUnits option')],sig=ops.map(o=>o.value+o.textContent).join('|');
  if(sel.dataset.sig===sig)return;
  sel.dataset.sig=sig;
  sel.innerHTML=ops.map(o=>'<option value="'+esc(o.value)+'">'+esc(o.value==='frame'?o.textContent.replace(/^🧩 句型替換/,'全部句型'):o.textContent)+'</option>').join('')
}
function frRender(s){
  const box=$('#frBox');
  if(!box)return;
  const f=s&&s.src==='frame'&&!zfRp()?frById(s.frame):null;
  box.hidden=!f;
  if(!f)return;
  frBuild();
  frSelOpts();
  const it=frItem(s),u=$('#unit').value,sel=$('#frSel'),tip=$('#frTip');
  if(it)$('#english').innerHTML=frMarkHtml(s.en,frSpans(s.en,it.fill),esc);
  if(sel)sel.value=u==='frame'||/^fr\d+$/.test(u)?u:s.frame;
  $('#frPat').innerHTML=frBlankHtml(f.en);
  $('#frZh').innerHTML=frBlankHtml(f.zh);
  tip.textContent=f.tip||'';
  tip.hidden=!f.tip;
  $('#frRec').hidden=zfOn()
}
function v533Render(){
  frRender(cur());
  zfApply()
}
function zfSet(on){
  on=!!on;
  if(on!==zfOn()){
    if(on)store.settings.zhFirst=true;else delete store.settings.zhFirst;
    save();
    if(autoOn)stopAuto();
    ZF.id=null;
    render()
  }
  zfSegUI()
}
/* 換句型＝換句子頁的單元（記住位置、今日學習的「句子跟讀」也會用這個單元） */
function frSwitch(u){
  const el=$('#unit');
  if(!el||![...el.options].some(o=>o.value===u))return;
  if(autoOn)stopAuto();
  el.value=u;
  el.dispatchEvent(new Event('change'))
}
/* 🔀 換一句：隨機換成同一個句型的另一句（在別的單元時，切到這個句型） */
function frAnother(){
  const s=cur();
  if(!s||s.src!=='frame')return;
  if(autoOn)stopAuto();
  const pick=()=>pool.map((x,k)=>x.frame===s.frame&&x.id!==s.id?k:-1).filter(k=>k>=0);
  let c=pick();
  const u=$('#unit').value;
  if(!c.length&&u!==s.frame&&u!=='frame'){
    frSwitch(s.frame);
    c=pick()
  }
  if(!c.length){
    unitNote('這個句型目前只有這一句可以練（其他句子已標記「會說了」；取消勾選「只看未會說」就會出現）。');
    return
  }
  i=c[Math.floor(Math.random()*c.length)];
  render()
}
$('#autoPlay').addEventListener('click',()=>{
  if(zfActive())zfApply()
});
/* 換單元：回到同一句也重新從看中文開始（按 ✓、☆ 重畫同一句時，已顯示的英文不會又藏起來） */
$('#unit').addEventListener('change',()=>{
  ZF.id=null;
  zfApply()
});
(function(){
  const sg=$('#zfSeg'),hb=$('#zfHint'),sb=$('#zfShow');
  if(sg)sg.addEventListener('click',e=>{
    const b=e.target.closest('[data-zf]');
    if(b)zfSet(b.dataset.zf==='1')
  });
  if(hb)hb.onclick=()=>{
    ZF.hint=!ZF.hint;
    zfApply()
  };
  if(sb)sb.onclick=()=>{
    ZF.rev=true;
    zfApply()
  };
  zfSegUI()
})();
/* 自己按了「👂 跟讀／🀄 中翻英」：以自己按的為準 */
(function(){
  const sg=$('#zfSeg');
  if(sg)sg.addEventListener('click',e=>{
    if(!(e.target.closest&&e.target.closest('[data-zf]')))return;
    if(FLOW&&FLOW.day===day()&&FLOW.i<FLOW.steps.length&&!FLOW.zfm){
      FLOW.zfm=1;
      flowSave()
    }
    if(store.settings.zfFlow){
      delete store.settings.zfFlow;
      save()
    }
  })
})();
/* ---------- 今日學習「🧩 句型」步驟 ----------
   store.settings.flowCfg.fr＝5／10 句（0＝不做：預設，不存）：排在「句子跟讀」後面，每句約 40 秒。
   打開句子頁的「🧩 句型替換」：練得最少的句型（會說了的句數＋🎤 念對次數 store.frSay 最少；一樣多時照句型順序）。
   那個句型剩下還沒會說的句子比這一步要練的少（例如要練 10 句）時，打開全部句型，從那個句型開始，練完接著練下一個句型。
   計數和「句子跟讀」一樣：句型的句子按「✓ 我會說了」（每日紀錄 sentIds 裡 f: 開頭的）或 🎤 念對 90% 以上（每日紀錄 fsay）。
   和句子跟讀一樣只看還沒會說的句子；那個範圍都會說了，就這次全部顯示（不改「只看未會說」設定），用 🎤 念對也算。
   這一步選的句型記在進行中的今日學習（FLOW.fu／FLOW.fr）：換頁後按「回到這一步」回到同一個句型（自己換了別的句型就不動）。
   這一步只改句子頁目前的單元（store.settings.unit），不改「句子跟讀」用的範圍（store.settings.learnUnit）：
   之後「句子跟讀」看到句子頁停在不是自己選的句型單元時，會回到自己選的範圍（沒有選過＝精選全部）。 */
function frList(){
  return (window.FRAMES||[]).filter(f=>f&&/^fr\d+$/.test(f.id)&&Array.isArray(f.items)&&f.items.length)
}
function frHas(){
  return frList().length>0
}
function frSayAdd(id){
  if(!/^fr\d{1,4}$/.test(id||''))return;
  if(!_isObj(store.frSay))store.frSay={};
  store.frSay[id]=Math.min(1e6,(+store.frSay[id]||0)+1)
}
/* 每個句型：會說了幾句、還剩幾句、練習次數（會說了的句數＋🎤 念對次數） */
function frStat(){
  const kn=cset('known'),say=_isObj(store.frSay)?store.frSay:{};
  return frList().map((f,k)=>{
    let known=0;
    f.items.forEach((x,n)=>{
      if(kn.has('f:'+f.id+':'+n))known++
    });
    return {id:f.id,k,known,left:f.items.length-known,n:known+(+say[f.id]||0)}
  })
}
/* 這一步要練幾句（need）：練得最少、而且剩下的句子夠的句型；不夠時打開全部句型，從練得最少（還有沒會說的）的句型開始 */
function frPick(need){
  const P=frStat(),by=(a,b)=>a.n-b.n||a.k-b.k;
  if(!P.length)return null;
  let c=P.filter(p=>p.left>=need).sort(by)[0];
  if(c)return {u:c.id,fr:c.id};
  c=P.filter(p=>p.left>0).sort(by)[0];
  if(c)return {u:'frame',fr:c.id};
  c=P.slice().sort(by)[0];
  return {u:c.id,fr:c.id}
}
function frFlowGo(){
  rpOff();
  page('practice');
  const u=$('#unit'),hk=$('#hideKnown'),isFr=v=>/^(frame|fr\d+)$/.test(v||''),has=v=>!!v&&[...u.options].some(o=>o.value===v);
  const S=FLOW&&FLOW.day===day()&&FLOW.i<FLOW.steps.length?FLOW.steps[FLOW.i]:null,s=S&&S.k==='fr'?S:null;
  let go='',pk=null;
  if(s&&has(FLOW.fu)){
    /* 回到這一步：還在句型的單元就不動（可能自己換了句型）；不在的話回到這一步打開的句型 */
    if(!isFr(u.value))go=FLOW.fu
  }else{
    pk=frPick(s?Math.max(1,s.n-flowProg(s)):5);
    if(pk){
      go=pk.u;
      if(s){
        FLOW.fu=pk.u;
        FLOW.fr=pk.fr;
        flowSave()
      }
    }
  }
  if(has(go)&&u.value!==go){
    u.value=go;
    store.settings.unit=go;
    i=(store.settings.pos&&store.settings.pos[go])||0
  }
  /* 和「句子跟讀」一樣只看還沒會說的句子；這個範圍都會說了，就這次全部顯示（不改設定） */
  if(isFr(u.value)){
    const kn=cset('known'),open=ALLS.some(x=>x.src==='frame'&&inUnit(x,u.value)&&!kn.has(x.id));
    if(open&&!hk.checked){
      hk.checked=true;
      store.settings.hideKnown=true
    }else if(!open&&hk.checked)hk.checked=false
  }
  save();
  filter();
  if(isFr(u.value)&&!pool.some(x=>x.src==='frame')){
    hk.checked=false;
    filter()
  }
  if(pk&&pk.u==='frame'){
    const k=pool.findIndex(x=>x.frame===pk.fr);
    if(k>=0)i=k
  }
  render()
}
/* 句子頁停在不是自己選的句型單元（今日學習「🧩 句型」打開的）：「句子跟讀」回到自己選的範圍 */
function frBackToLearn(){
  const u=$('#unit'),lu=store.settings.learnUnit;
  if(!u||!/^(frame|fr\d+)$/.test(u.value)||u.value===lu)return;
  const nu=lu&&[...u.options].some(o=>o.value===lu)&&!/^(sdue|lsw|fav|search)$/.test(lu)?lu:'all';
  u.value=nu;
  store.settings.unit=nu;
  i=(store.settings.pos&&store.settings.pos[nu])||0;
  save();
  filter()
}
/* ---------- 意思回想卡 ---------- */
/* 給「會念、聽得懂發音，卻想不起中文意思」的字：單字頁「🧠 意思回想」。
   每張卡先自動念出單字（可以選「只聽發音（不看拼字）」），中文、例句中文、相關字都先藏起來；
   先說出中文意思，再按「👁 看意思」翻面（中文＋拼字＋例句和例句中文），然後自己評分：
   ✓ 想得起來＝✓ 已熟、◐ 有點印象＝◐ 模糊、✗ 想不起來＝✗ 不熟（走一般單字卡同一段評分程式，複習排程完全一樣）。
   新欄位：
   store.meanWeak＝{單字:{n 在意思回想按 ◐／✗ 的次數, last 最後一次按 ◐／✗ 的日期, ok 之後連續 ✓ 的次數（0／1）}}
     按 ◐／✗ 加入（ok 歸 0），連續兩次 ✓ 移出；沒有用過時沒有這個欄位（＝空的）。
   store.settings.mrEar＝true：只聽發音（不看拼字）；沒有設定＝顯示拼字。
   store.dailyLog[日期].mr＝那天在意思回想評分的張數（今日學習「🧠 意思回想」步驟的進度）。
   store.settings.flowCfg.mr＝今日學習的意思回想張數（0／10／20；0＝不做，不存）。
   store.mrToday＝{d 今天, w 今天已經回想過的字}（只存今天的清單，最多 600 個；隔天自動清掉）。 */
var MR={on:false,arm:false,src:'',size:0,stats:{known:0,learning:0,new:0},cleared:0,dd:'',done:null,nt:0,qt:0,qLeft:0,qAt:0,qOn:false,timed:null,rq:null};
/* ---------- 哪些字可以回想 ---------- */
function mrHas(w){
  const m=store.meanWeak;
  return !!m&&typeof m==='object'&&Object.prototype.hasOwnProperty.call(m,w)
}
/* 學過的字：不是新字、到期要複習（按過 ✗ 的字也算）、或在意思不熟清單裡 */
function mrSeen(x){
  return statusOf(x.w)!=='new'||isDue(x.w)||mrHas(x.w)
}
function mrSkipOk(x){
  return !(skipV()&&x.b&&x.k!==7)
}
/* 學過的字有幾個（最多數到 max 就停）；今日學習判斷要不要排這一步 */
function mrSeenN(max){
  let n=0;
  for(const x of WORDS)if(mrSkipOk(x)&&mrSeen(x)&&++n>=max)break;
  return n
}
/* 單字頁目前的範圍：冊別＋主題（只學原形時不含詞形），和上方「已熟／待複習」數字的範圍一樣 */
function mrRange(){
  const book=$('#wordBook').value,tp=$('#wordTopic').value;
  return x=>inBook(x,book)&&mrSkipOk(x)&&(tp==='all'||(x.t||[]).includes(tp))
}
/* 順序：到期的先（最早到期、階段低的先，和「今日複習」一樣）；再來是意思不熟、學習中、已熟（下次複習日早的先） */
function mrOrder(a){
  const rd=store.reviewDue||{},sg=store.reviewStage||{},cmp=(p,q)=>p<q?-1:p>q?1:0,due=[],rest=[];
  a.forEach(x=>(isDue(x.w)?due:rest).push(x));
  const rk=x=>mrHas(x.w)?0:statusOf(x.w)==='learning'?1:2;
  return qShuffle(due).sort((p,q)=>cmp(rd[p.w],rd[q.w])||((sg[p.w]||0)-(sg[q.w]||0))).concat(rest.sort((p,q)=>rk(p)-rk(q)||cmp(rd[p.w]||'9999',rd[q.w]||'9999')||((sg[p.w]||0)-(sg[q.w]||0))))
}
/* 今天已經回想過的字：「再回想」先出還沒做過的
   記在 store.mrToday（只存今天的），重新開啟 App 也記得；隔天自動從頭開始 */
function mrDone(){
  const t=day();
  if(MR.dd!==t||!MR.done){
    MR.dd=t;
    const m=store.mrToday;
    MR.done=new Set(_isObj(m)&&m.d===t&&Array.isArray(m.w)?m.w:[])
  }
  return MR.done
}
/* 挑 n 個字。範圍裡沒有學過的字時改出其他冊別學過的字（other＝要說明）；
   wide（今日學習）：範圍裡不夠時也用其他冊別補，還不夠才重複今天做過的 */
function mrPick(n,wide){
  const inR=mrRange(),done=mrDone();
  const inside=mrOrder(WORDS.filter(x=>inR(x)&&mrSeen(x)));
  let pool=inside,other=false;
  if(wide||!inside.length){
    const have=new Set(inside.map(x=>x.w)),out=mrOrder(WORDS.filter(x=>!have.has(x.w)&&mrSkipOk(x)&&mrSeen(x)));
    pool=inside.concat(out);
    other=!inside.length&&out.length>0
  }
  const fresh=pool.filter(x=>!done.has(x.w));
  let list=fresh.length?fresh:pool;
  if(wide&&list.length<n)list=list.concat(pool.filter(x=>done.has(x.w)));
  return {list:list.slice(0,n),other}
}
/* 單字頁目前範圍裡的意思不熟的字 */
function mrWeakN(){
  if(!_isObj(store.meanWeak)||!Object.keys(store.meanWeak).length)return 0;
  const inR=mrRange();
  return WORDS.filter(x=>inR(x)&&mrHas(x.w)).length
}
/* ---------- 開始意思回想 ---------- */
function mrNote(t){
  const m=$('#wordBackupMsg');
  if(!m)return;
  m.textContent=t;
  m.className='rec-msg';
  m.hidden=false;
  clearTimeout(MR.nt);
  MR.nt=setTimeout(()=>{
    m.hidden=true
  },6000)
}
function mrOpen(){
  if(typeof MR==='undefined'||!MR)return;
  MR.on=!!MR.arm;
  MR.arm=false
}
function mrStart(list,src){
  MR.arm=true;
  MR.src=src||'btn';
  MR.size=list.length;
  MR.stats={known:0,learning:0,new:0,slow:0};
  MR.cleared=0;
  MR.timed=null;
  MR.rq=new Set();
  openCards(list);
  window.__cardKind='mr';
  /* 不用等慢慢捲回最上面：直接定位，讓「👁 看意思」在底部選單和今日學習進度列上面 */
  window.scrollTo(0,0);
  mrSee()
}
/* 學過的字（冊別＋主題的範圍） */
function mrGoRange(src){
  const r=mrPick(REVIEW_BATCH,false);
  mrStart(r.list,src||'btn');
  if(r.other)mrNote('目前選的冊別／主題還沒有學過的字，先出其他冊別學過的字。')
}
/* 意思不熟的字：fromList＝就用清單上看到的字（含搜尋）；否則切到「🧠 意思不熟」整個範圍 */
function mrGoWeak(fromList){
  if(!fromList){
    $('#wordSearch').value='';
    $('#wordState').value='meanweak';
    wordShown=60
  }
  renderWords();
  mrStart(mrOrder(_wl.slice()).slice(0,REVIEW_BATCH),'weak')
}
/* 單字頁「🧠 意思回想」：正在看「🧠 意思不熟」清單（而且有字）時就回想這些字 */
function mrGo(){
  if($('#wordState').value==='meanweak'&&wordFiltered().length)mrGoWeak(true);else mrGoRange('btn')
}
/* 今日學習的「🧠 意思回想」步驟：進行中的就回到同一張卡；否則開這一步還要做的張數 */
function mrFlowGo(){
  const s=FLOW&&FLOW.day===day()&&FLOW.i<FLOW.steps.length?FLOW.steps[FLOW.i]:null;
  const want=s&&s.k==='mr'?Math.max(1,s.n-flowProg(s)):REVIEW_BATCH;
  page('words');
  if(MR.on&&cardPool.length&&cardIndex<cardPool.length){
    $('#wordRows').hidden=true;
    $('#wordMore').hidden=true;
    $('#wordCard').hidden=false;
    try{
      wordStats(_wl.length)
    }catch(e){}
    showCard();
    return
  }
  wordShown=60;
  renderWords();
  mrStart(mrPick(want,true).list,'flow')
}
/* ---------- 評分（一般評分 setStatus 已經做完；只在意思回想模式另外記錄） ---------- */
function mrGraded(w,g){
  if(typeof MR==='undefined'||!MR||!MR.on)return;
  mrDone().add(w);
  mrTodaySave();
  MR.stats[g]=(MR.stats[g]||0)+1;
  if(!_isObj(store.meanWeak))store.meanWeak={};
  const m=store.meanWeak,o=mrHas(w)&&_isObj(m[w])?m[w]:null;
  if(g==='known'){
    if(o){
      if((+o.ok||0)>=1){
        delete m[w];
        MR.cleared++
      }else m[w]={n:+o.n||1,last:o.last||day(),ok:1}
    }
  }else m[w]={n:(o?+o.n||0:0)+1,last:day(),ok:0};
  bumpLog('mr');
  save()
}
/* ---------- 單字頁：「🧠 意思不熟（N）」數字、清單上方的說明 ---------- */
function mrStats(B){
  const m=store.meanWeak,n=_isObj(m)&&Object.keys(m).length?B.filter(x=>mrHas(x.w)).length:0;
  const st=$('#wordState').value,c=$('#wordPage .word-stats [data-st="meanweak"]'),b=$('#wordMeanN'),o=$('#wordState option[value="meanweak"]');
  if(b)b.textContent=n;
  if(c)c.hidden=!(n>0||st==='meanweak');
  if(o)o.textContent='🧠 意思不熟（'+n+'）'
}
function mrList(a){
  if($('#wordState').value!=='meanweak')return;
  const box=$('#wordRows');
  if(!a.length){
    if(!$('#wordSearch').value.trim())box.innerHTML='<p class="muted empty-note">目前這個範圍沒有「意思不熟」的字。用「🧠 意思回想」練習時，按「◐ 有點印象」或「✗ 想不起來」的字會放在這裡；連續兩次「✓ 想得起來」就會移出。</p>';
    return
  }
  const k=Math.min(a.length,REVIEW_BATCH);
  box.insertAdjacentHTML('afterbegin',`<div class="mr-banner"><span><b>🧠 意思不熟 ${a.length} 個</b><small>會念、但想不起中文意思的字。連續兩次「✓ 想得起來」就會移出。</small></span><button type="button" class="primary" data-mr="list">▶ 回想${k<a.length?' '+k:'這 '+k} 個</button></div>`)
}
/* ---------- 卡片 ---------- */
function mrEarOn(){
  return store.settings.mrEar===true&&TTS_OK
}
/* 翻面前的「👁 看意思」、翻面後的評分按鈕：不要被底部選單或今日學習進度列蓋住，單字也盡量留在畫面上 */
function mrSee(){
  const c=$('#wordCard');
  if(!c||c.hidden||$('#wordPage').hidden||!c.classList.contains('mr-mode'))return;
  const key=c.querySelector('.mr-grade')||c.querySelector('.mr-reveal')||c.querySelector('.card-actions');
  if(!key)return;
  const top=c.querySelector('.big,.mr-earbig')||c,lim=bottomLimit()-8;
  const a=top.getBoundingClientRect().top,b=key.getBoundingClientRect().bottom;
  let d=0;
  if(b>lim)d=b-lim;else if(a<8)d=Math.max(a-8,b-lim);
  if(Math.abs(d)>=1)window.scrollTo(0,Math.max(0,window.scrollY+d))
}
function mrEndHtml(){
  window.__cardDone=0;
  const S=MR.stats||{},a=S.known||0,b=S.learning||0,c=S.new||0,wk=mrWeakN(),M=Math.min(wk,REVIEW_BATCH);
  if(!MR.size&&MR.src==='weak')return '<b>目前沒有「意思不熟」的字。</b><div class="card-actions mr-endb"><button data-ca="list">返回列表</button></div>';
  if(!MR.size)return '<b>目前沒有可以回想意思的字。</b><p class="muted">意思回想會出「到期要複習的字」和「學過的字（學習中、已熟）」。先用「🆕 今日新字」學幾個字，再來回想意思。</p><div class="card-actions mr-endb"><button data-ca="mr-new" class="primary">🆕 今日新字</button><button data-ca="list">返回列表</button></div>';
  const weak=MR.src==='weak';
  const K=weak?0:mrPick(REVIEW_BATCH,false).list.length;
  const btn=(weak?(M?`<button data-ca="mr-more" class="primary">🧠 再練意思不熟的 ${M} 個</button>`:''):(K?`<button data-ca="mr-more" class="primary">🧠 再回想 ${K} 個</button>`:'')+(M?`<button data-ca="mr-weak">🧠 練意思不熟的 ${M} 個</button>`:''))+'<button data-ca="list">返回列表</button>';
  return `<div class="mr-end"><b>🎉 這一組意思回想完成了！</b><div class="mr-sum"><span class="g3">✓ 想得起來 ${a}</span><span class="g2">◐ 有點印象 ${b}</span><span class="g1">✗ 想不起來 ${c}</span>${S.slow?`<span class="g2">⏱ 時間到 ${S.slow}（算在 ◐）</span>`:''}</div><p class="muted">${wk?`🧠 意思不熟的字：${wk} 個`:'🎉 這個範圍沒有意思不熟的字了'}${MR.cleared?`（這次有 ${MR.cleared} 個連續兩次 ✓，已移出）`:''}。按「◐」或「✗」的字會放進「🧠 意思不熟」，連續兩次「✓」就移出。</p><div class="card-actions mr-endb">${btn}</div></div>`
}
function mrCard(x){
  const card=$('#wordCard'),on=typeof MR!=='undefined'&&!!MR&&!!MR.on;
  if(typeof MR!=='undefined'&&MR)mrqStop();
  if(card)card.classList.toggle('mr-mode',on);
  if(!on||!card)return false;
  if(!x){
    card.innerHTML=mrEndHtml();
    mrSee();
    return true
  }
  const rv=!!cardReveal,ear=mrEarOn()&&!rv,s=statusOf(x.w),due=store.reviewDue[x.w],dw=dispW(x.w),pos=x.pos?` <em class="pos">${esc(x.pos)}</em>`:'';
  const meta=`<div class="meta"><b class="mr-tag">🧠 意思回想</b> ${cardIndex+1} / ${cardPool.length} · ${esc(bookName(x))} · ${ST_LABEL[s]||''}${due?(due<=day()?' · 已到期':' · 下次複習 '+esc(due.slice(5))):''}</div>`;
  const qs=mrQuickSec(),timed=rv&&!!MR.timed&&MR.timed.w===x.w&&MR.timed.i===cardIndex;
  const tog=`<label class="mr-ear-t"><input type="checkbox" data-mr="ear"${store.settings.mrEar===true?' checked':''}> 只聽發音（不看拼字）</label><label class="mr-ear-t mrq-t">⚡ 快速模式 <select data-mr="quick" aria-label="快速模式秒數">${[[0,'關'],[2,'2 秒'],[3,'3 秒'],[5,'5 秒']].map(([v,t])=>`<option value="${v}"${v===qs?' selected':''}>${t}</option>`).join('')}</select></label>`+(store.settings.mrEar===true&&!TTS_OK?'<p class="muted mr-note">這個瀏覽器不能朗讀英文，先顯示拼字。</p>':'');
  const head=ear?`<button type="button" data-ca="play" class="mr-earbig" aria-label="再聽一次發音">🔊</button><div class="phon mr-earhint">聽發音，想想中文意思${pos}</div>`:`<div class="big${dw.length>=15?' xlong':dw.length>=12?' long':''}" lang="en">${esc(dw)}</div><div class="phon">${x.p?'/ '+esc(phon(x.p))+' /':''}${pos}</div>`;
  let body;
  if(!rv)body=(qs?`<div class="mrq" data-sec="${qs}"><div class="mrq-bar" role="progressbar" aria-label="剩下的時間"><i style="animation-duration:${qs}s"></i></div><button type="button" class="mini mrq-pause" data-mrq="pause">⏸ 暫停</button></div><p class="mr-ask">⚡ ${qs} 秒內想出中文意思，想到就翻面</p>`:'<p class="mr-ask">先說出中文意思，再翻面</p>')+'<button type="button" data-ca="reveal" class="primary mr-reveal">👁 看意思</button>';
  else{
    const ex=x.ex?`<div class="card-ex"><div class="en" lang="en">${hl(x)}</div><div class="zhx">${esc(x.exz)}</div><div class="exbtn"><button data-ca="ex">💬 例句</button><button data-ca="exslow">🐢 慢速例句</button></div></div>`:(!EX_READY||EX_FAIL?`<p class="muted mr-noex">${EX_FAIL?'⚠️ 例句沒有下載完成（網路不穩）；連上網路後重新開啟 App 就會有例句。':'例句還在下載，下載好之後的卡片就會顯示例句。'}</p>`:'');
    const ex2=x.ex2?`<div class="card-ex ex2b"><div class="lbl">📖 多益例句</div><div class="en" lang="en">${hlx(x,x.ex2)}</div><div class="zhx">${esc(x.exz2)}</div><div class="exbtn"><button data-ca="ex2">💬 例句</button><button data-ca="ex2slow">🐢 慢速例句</button></div></div>`:'';
    /* ⚡ 時間到：已經記成「◐ 再練」，只要按「下一張」 */
    const grade=timed?`<p class="rec-msg mrq-note">⏱ 時間到：記為「◐ 再練」${statusOf(x.w)==='known'?'（已熟的字不會降級，明天再複習一次）':''}${MR.rq&&MR.rq.has(x.w)&&cardPool.indexOf(x,cardIndex+1)>cardIndex?'，這一組最後會再出一次':''}。</p><div class="card-actions mr-grade"><button type="button" data-ca="mr-next" class="primary">下一張 →</button></div>`:`<div class="card-actions grade mr-grade" role="group" aria-label="剛剛想得起來嗎？"><button data-ca="g-new" class="g1"><i aria-hidden="true">✗</i> 想不起來</button><button data-ca="g-learning" class="g2"><i aria-hidden="true">◐</i> 有點印象</button><button data-ca="g-known" class="g3"><i aria-hidden="true">✓</i> 想得起來</button></div>`;
    body=`<div class="reveal mr-zh">${x.zh?esc(x.zh):'<i>中文待補</i>'}</div>${grade}${relHtml(x)}${ex}${ex2}`
  }
  card.innerHTML=meta+tog+head+body+`<div class="card-actions"><button data-ca="play">🔊 再聽</button><button data-ca="slow">🐢 慢速</button><button data-ca="fav">${store.wordFav.includes(x.w)?'★ 已收藏':'☆ 收藏'}</button></div><div class="card-actions"><button data-ca="prev">← 上一字</button><button data-ca="list">列表</button><button data-ca="next">下一字 →</button></div>`;
  say(x.w,1);
  mrSee();
  if(!rv&&qs)mrqStart(x,qs*1000);
  return true
}
/* ---------- ⚡ 快速模式（V6.3.0） ----------
   store.settings.mrQuick＝2／3／5（秒；沒有＝關）。還沒翻面的卡片顯示倒數條，時間內按「👁 看意思」就照平常自己評分；
   時間到自動翻面，記為「◐ 再練」（mrSlow）：一般的字＝學習中（和按 ◐ 一樣）；已熟的字不降級，只把下次複習改成明天；
   放進意思不熟清單，這一組最後再出一次（每個字一次）。「⏸ 暫停」停止倒數（剩下的時間保留），翻面後照平常評分。 */
function mrQuickSec(){
  const v=store.settings.mrQuick;
  return [2,3,5].includes(v)?v:0
}
function mrqStop(){
  clearTimeout(MR.qt);
  MR.qt=0;
  MR.qOn=false
}
function mrqStart(x,ms){
  mrqStop();
  MR.qOn=true;
  MR.qLeft=ms;
  MR.qAt=Date.now();
  MR.qx=x;
  MR.qt=setTimeout(()=>mrqFire(x),ms)
}
function mrqFire(x){
  MR.qt=0;
  MR.qOn=false;
  const c=$('#wordCard');
  /* 已經換卡、翻面、離開單字頁或回到列表：不做事（回來時重新畫卡片會重新倒數） */
  if(!MR.on||cardReveal||cardPool[cardIndex]!==x||!c||c.hidden||$('#wordPage').hidden)return;
  mrSlow(x);
  MR.timed={w:x.w,i:cardIndex};
  cardReveal=true;
  showCard();
  say(x.w,1)
}
function mrqPause(btn){
  const box=btn.closest('.mrq');
  if(MR.qOn){
    MR.qLeft=Math.max(0,MR.qLeft-(Date.now()-MR.qAt));
    clearTimeout(MR.qt);
    MR.qt=0;
    MR.qOn=false;
    if(box)box.classList.add('paused');
    btn.textContent='▶ 繼續'
  }else if(MR.qx&&cardPool[cardIndex]===MR.qx&&!cardReveal){
    const x=MR.qx,left=Math.max(300,MR.qLeft);
    MR.qOn=true;
    MR.qAt=Date.now();
    MR.qLeft=left;
    MR.qt=setTimeout(()=>mrqFire(x),left);
    if(box)box.classList.remove('paused');
    btn.textContent='⏸ 暫停'
  }
}
/* 時間到＝「◐ 再練」：已熟的字不降級（階段不變，明天再複習）；其他的字照「◐ 有點印象」 */
function mrSlow(x){
  const w=x.w;
  if(statusOf(w)==='known'){
    if(isDue(w)){
      bumpLog('review');
      bumpLog('rng')
    }
    store.reviewDue[w]=day(1);
    markStudy();
    save()
  }else setStatus(w,'learning');
  mrGraded(w,'learning');
  MR.stats.slow=(MR.stats.slow||0)+1;
  if(MR.rq&&!MR.rq.has(w)){
    MR.rq.add(w);
    cardPool.push(x)
  }
  try{
    wordStats(+$('#wordCount').textContent||0)
  }catch(e){}
}
/* ---------- 按鈕 ---------- */
(function(){
  const b=$('#meanStart');
  if(b)b.onclick=()=>mrGo();
  $('#wordRows').addEventListener('click',e=>{
    if(e.target.closest&&e.target.closest('[data-mr="list"]'))mrGoWeak(true)
  });
  /* 完成畫面的按鈕（一般單字卡的按鈕由 $('#wordCard').onclick 處理） */
  $('#wordCard').addEventListener('click',e=>{
    const t=e.target.closest&&e.target.closest('[data-ca^="mr-"]');
    if(!t)return;
    const a=t.dataset.ca;
    if(a==='mr-next'){
      if(Date.now()-(window.__cardAt||0)<350)return;
      MR.timed=null;
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
    if(a==='mr-more'){
      if(MR.src==='weak')mrGoWeak(false);else mrGoRange(MR.src==='flow'?'btn':MR.src)
    }else if(a==='mr-weak')mrGoWeak(false);else if(a==='mr-new')$('#dailyStart').click()
  });
  /* 只聽發音（不看拼字）：記在 store.settings.mrEar，馬上套用到這張卡 */
  /* ⚡ 快速模式：暫停／繼續倒數 */
  $('#wordCard').addEventListener('click',e=>{
    const t=e.target.closest&&e.target.closest('[data-mrq="pause"]');
    if(t)mrqPause(t)
  });
  /* ⚡ 快速模式秒數：記在 store.settings.mrQuick，馬上套用到這張卡（重新倒數） */
  $('#wordCard').addEventListener('change',e=>{
    const c=e.target;
    if(!c||!c.matches||!c.matches('select[data-mr="quick"]'))return;
    const v=+c.value;
    if([2,3,5].includes(v))store.settings.mrQuick=v;else delete store.settings.mrQuick;
    save();
    showCard()
  });
  $('#wordCard').addEventListener('change',e=>{
    const c=e.target;
    if(!c||!c.matches||!c.matches('input[data-mr="ear"]'))return;
    if(c.checked)store.settings.mrEar=true;else delete store.settings.mrEar;
    save();
    showCard()
  })
})();
/* ---------- 今天回想過的字 ----------
   store.mrToday＝{d:今天, w:[字…]}（只存今天的，最多 600 個；隔天第一次評分時換成新的一天，開啟 App 時清掉舊的） */
function mrTodaySave(){
  const d=mrDone();
  while(d.size>600)d.delete(d.values().next().value);
  store.mrToday={d:MR.dd,w:[...d]}
}
/* ---------- 統計頁「🧠 意思回想」 ----------
   今天、最近 7 天在意思回想評分的張數、意思不熟的字數；每週摘要和今日頁「📅 最近 7 天」小卡也有「意思回想」（兩週都是 0 時不顯示） */
function mrStatHtml(){
  const L=_isObj(store.dailyLog)?store.dailyLog:{},n=v=>typeof v==='number'&&isFinite(v)&&v>0?v:0,lg=d=>_isObj(L[d])?n(L[d].mr):0;
  let wk=0,any=0;
  for(let k=0;k<7;k++)wk+=lg(day(-k));
  Object.keys(L).forEach(d=>{
    any+=lg(d)
  });
  /* 意思不熟：和單字頁「全部」的範圍一樣（只學原形時不算詞形） */
  const td=lg(day()),m=_isObj(store.meanWeak)?Object.keys(store.meanWeak).filter(w=>BY_WORD[w]&&mrSkipOk(BY_WORD[w])).length:0;
  const h='<h3 id="mrStat">🧠 意思回想 <small class="muted">（V5.33.0 起統計）</small></h3>';
  if(!any&&!m)return h+'<p class="muted">還沒有紀錄：在「單字」頁按「🧠 意思回想」，先說出中文意思再翻面評分，這裡就會開始統計。</p>';
  return h+`<div class="mr-st"><div><b>${td}</b><span>今天</span></div><div><b>${wk}</b><span>最近 7 天</span></div><div><b>${m}</b><span>意思不熟</span></div></div><p class="muted">今天、最近 7 天：在意思回想評分的張數。意思不熟：按過「◐ 有點印象」或「✗ 想不起來」、還沒有連續兩次「✓ 想得起來」的字（在「單字」頁點「🧠 意思不熟」可以看清單）。</p>`
}
/* ==================================================================
   13. 畫面切換、資料載入、啟動
   換頁、data-more.js（情境題、發音辨別、人名地名）載入、安裝與離線快取、開啟 App 時的順序
   ================================================================== */
function page(name){
  lkClose();
  /* 換頁時停止自動播放（不只按底部選單） */
  if(cardAuto||autoOn)stopAuto();
  if(name!=='practice')rpOff();
  /* 離開句子頁時停止錄音與語音辨識（麥克風不會一直開著） */
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
  /* 多益程度估計：離開時停止播放、記下作答進度 */
  const tq=$('#toeicPage');
  if(tq)tq.hidden=name!=='toeic';
  if(name!=='toeic')tqLeave();
  if(name!=='dialogs'&&(DLG.run||DLG.playing>=0))dlgStop();
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const nn=name==='list'?'practice':name==='wrongbook'?wbFrom:name==='toeic'?TQ.from:name;
  let nb=$('#nav'+nn[0].toUpperCase()+nn.slice(1));
  if(nb)nb.classList.add('active');
  if(pr)rpAfterPage();
  window.scrollTo(0,0);
  /* 有新版本在等待時，回到「今日」頁就套用（不必等 App 切到背景） */
  if(name==='today'&&window.__swGo)setTimeout(()=>{
    try{
      if(REC.state==='idle'&&!VOICE.srBusy&&!RP.on&&!DLG.run&&!autoOn&&!cardAuto)window.__swGo()
    }catch(e){}
  },0);
  if(FLOW)flowBar()
}
/* ---------- data-more.js：CE 情境題、發音辨別、點字查詢的人名地名與補充字典 ----------
   開啟 App 時用不到，所以不放在 data.js（訊號弱時第一次開啟少下載約 55 KB）。單字例句（data-ex.js）載入後接著下載；
   還沒下載完就用到（情境題、發音辨別、錯題本裡的情境題、點人名地名）會立刻下載，畫面先顯示「下載中」，下載完自動接著做。
   下載失敗重試 3 次；還是失敗就顯示「下載失敗」和「重新下載」，連上網路時也會自動再試一次。
   MERGED 對照表留在 data.js：開啟時轉移舊版學習紀錄（mergeWordKeys）要用到；V4_WORDS 在 data-v4.js（V6.2.0，只有很舊的紀錄才載入）。
   這裡的 var 不給初始值：開啟時在這一行之前就可能被讀到（例如第 6 段的 moreLabels()），沒有值＝還沒下載。 */
var MORE_READY,MORE_FAIL,MORE_LOADING,MORE_TRY,MORE_T,MORE_Q,MORE_LK,MORE_LKA;
function moreHave(){
  return Array.isArray(window.SITQ)&&Array.isArray(window.PAIRS)&&!!window.PROPER&&!!window.GLOSS
}
function moreMerge(){
  if(MORE_READY||!moreHave())return;
  if(SITQ!==window.SITQ&&!SITQ.length)SITQ.push(...window.SITQ);
  MORE_READY=true;
  MORE_FAIL=false;
  MORE_LOADING=false;
  clearTimeout(MORE_T);
  MORE_T=0;
  moreLabels();
  moreRefresh()
}
function loadMore(tries){
  tries=tries||0;
  if(MORE_READY||MORE_LOADING)return;
  if(moreHave()){
    moreMerge();
    return
  }
  clearTimeout(MORE_T);
  MORE_T=0;
  MORE_TRY=tries;
  MORE_LOADING=true;
  window.__dataMore=moreMerge;
  const s=document.createElement('script');
  let end=false;
  const fail=()=>{
    if(end)return;
    end=true;
    s.remove();
    MORE_LOADING=false;
    if(MORE_READY)return;
    if(tries<3)MORE_T=setTimeout(()=>{
      MORE_T=0;
      loadMore(tries+1)
    },1500*(tries+1));else moreFailed()
  };
  s.src='data-more.js';
  s.async=true;
  s.onload=()=>{
    if(!MORE_READY&&moreHave())moreMerge();
    if(!MORE_READY)return fail();
    end=true;
    MORE_LOADING=false
  };
  s.onerror=fail;
  document.body.appendChild(s)
}
/* 功能要用到了：還沒開始就立刻下載；正在等下一次重試就馬上重試；已經失敗就再試一次 */
function moreNeed(){
  if(MORE_READY)return true;
  if(MORE_LOADING)return false;
  if(MORE_T){
    clearTimeout(MORE_T);
    MORE_T=0;
    loadMore((MORE_TRY||0)+1)
  }else if(MORE_FAIL){
    MORE_FAIL=false;
    moreLabels();
    loadMore(3)
  }else loadMore(0);
  return false
}
function moreFailed(){
  MORE_FAIL=true;
  moreLabels();
  moreRefresh()
}
function moreLabels(){
  const o=document.querySelector('#quizType option[value="situ"]');
  if(o)o.textContent='🏭 CE 情境題（'+(SITQ.length?SITQ.length+' 題':MORE_FAIL?'下載失敗':'載入中')+'）'
}
/* 下載完成（或失敗）後，更新正在看的畫面 */
function moreRefresh(){
  const vis=s=>{
    const e=$(s);
    return !!e&&!e.hidden
  };
  const sq=!!store.sqWrong&&Object.keys(store.sqWrong).length>0,q=MORE_Q;
  if(MORE_READY)MORE_Q='';
  if(q&&vis('#quiz')&&$('#quizType').value===q){
    if(MORE_READY)runQuiz();else moreWaitUI(q)
  }
  if(sq&&vis('#wrongPage'))renderWrongBook();
  if(vis('#todayPage')&&(sq||MORE_FAIL||$('#todayBody .more-fail')))renderToday();
  if(sq&&MORE_READY&&vis('#statsPage'))renderStats();
  lkMoreDone()
}
/* 測驗：題目資料還沒下載完 → 顯示下載中（下載完自動出題）；下載失敗 → 顯示「重新下載」 */
function moreWait(kind){
  if(MORE_READY)return false;
  MORE_Q=kind;
  moreNeed();
  moreWaitUI(kind);
  return true
}
function moreWaitUI(kind){
  const t={situ:'🏭 CE 情境題',pairs:'👂 發音辨別',wrongmix:'📕 錯題本混合練習'}[kind]||'';
  qEmpty(`<small class="muted">${t}</small><p class="rec-msg${MORE_FAIL?' warn':''} more-wait" role="status">${MORE_FAIL?'⚠️ 題目資料下載失敗（網路不穩）。請連上網路後按「重新下載」；其他測驗可以照常練習。':'⏳ 題目資料下載中，請稍候；下載完會自動出題。'}</p>`+(MORE_FAIL?'<button type="button" id="moreRetry" class="primary">🔄 重新下載</button>':''));
  const b=$('#moreRetry');
  if(b)b.onclick=()=>{
    MORE_Q=kind;
    moreNeed();
    moreWaitUI(kind)
  }
}
/* 錯題本頁：情境題那一段 */
function moreWbHtml(){
  return MORE_FAIL?'<p class="rec-msg warn more-wait">⚠️ 情境題資料下載失敗（網路不穩），題目暫時無法顯示。<button type="button" class="mini" data-wbmore="1">🔄 重新下載</button></p>':'<p class="rec-msg more-wait" role="status">⏳ 情境題資料下載中，下載完會自動顯示題目。</p>'
}
$('#wrongBody').addEventListener('click',e=>{
  if(!e.target.closest('[data-wbmore]'))return;
  moreNeed();
  renderWrongBook()
});
$('#todayBody').addEventListener('click',e=>{
  if(!e.target.closest('[data-moreget]'))return;
  moreNeed();
  renderToday()
});
window.addEventListener('online',()=>{
  if(MORE_FAIL)moreNeed()
});
[['unit','練習範圍'],['wordTopic','主題'],['wordState','單字狀態'],['dailyGoal','每日新字數量'],['phCat','片語分類'],['phState','片語狀態'],['quizType','測驗類型'],['quizMode','出題方式'],['quizBook','測驗範圍'],['quizSRange','句子範圍'],['quizDcRange','對話範圍'],['quizSRange2','題目範圍'],['autoRep','自動播放次數'],['themeSel','外觀'],['fontSel','字體大小'],['voiceSel','英文語音'],['search','搜尋句子'],['wordSearch','搜尋單字'],['phSearch','搜尋片語'],['dictIn','聽寫答案'],['bkPaste','備份內容']].forEach(([id,l])=>{
  const el=document.getElementById(id);
  if(el&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',l)
});
(function(){
  const g=$('#dlgUnits');
  if(g&&DIALOGS.length){
    const n=ALLS.filter(x=>x.src==='dialog').length;
    g.innerHTML=`<option value="dall">對話句・全部（${n}）</option>`+DIALOGS.map((d,k)=>`<option value="${esc(d.id)}">對話 ${k+1}・${esc(d.t)}</option>`).join('')
  }else if(g)g.remove();
  updEveryLabel()
})();
/* ---------- 安裝（加入主畫面）、離線快取（service worker） ---------- */
let deferred;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferred=e;
  $('#install').hidden=false
});
/* 安裝提示只能用一次；按過就收起按鈕（再按會出現紅色錯誤） */
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
/* ---------- 開啟 App：還原上次的句子單元和位置、畫出第一個畫面、處理重新載入前留下的訊息（e5k_go／e5k_msg）、開始下載例句檔 ---------- */
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
setTimeout(verCheck,0);
/* 等頁面載入完成（load）後才開始下載例句檔：不和開啟時需要的檔案搶頻寬，瀏覽器也不會一直顯示「載入中」 */
if(document.readyState==='complete')setTimeout(()=>loadWordEx(0),0);else window.addEventListener('load',()=>setTimeout(()=>loadWordEx(0),0));
FLOW=flowLoad();
if(FLOW)setTimeout(()=>{
  flowBar();
  if(!$('#todayPage').hidden)renderToday()
},0);
/* 舊版快取或其他原因已經有這些資料（例如 data.js 還是舊版）：直接使用 */
if(moreHave())moreMerge();
/* 開啟 App 時：上次今日學習暫時換成中翻英，但現在已經沒有進行中的句子跟讀／句型（例如隔天才打開）→ 換回原本的方式 */
flowZfSync();
