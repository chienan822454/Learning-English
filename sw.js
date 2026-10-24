/* English 5000 Service Worker — V5.32.0
   程式與字庫分開快取：字庫沒有變動時，新版本只下載程式檔（約 170 KB）。
   字庫分成三個檔：data.js（開啟時需要）、data-ex.js（單字例句，開啟後才載入）、data-ex2.js（多益長例句，最後才載入）。
   DATA_FILES 是每個檔案 SHA-1 的前 12 碼；字庫有改動時一定要更新（自動測試會檢查）。
   新版安裝時略過瀏覽器 HTTP 快取，啟用後立即接管並清除舊版快取，避免卡在舊版。 */
const C='english-5000-v5-32-0';
const DATA_FILES={'data.js':'2055cf974b0c','data-ex.js':'e21d56a3b9b7','data-ex2.js':'a72e77cdf75c'};
const D='english-5000-data-'+Object.values(DATA_FILES).map(h=>h.slice(0,6)).join('');
const CORE=['./','index.html','styles.css','app.js','manifest.webmanifest'];
const OPT=['icon.svg','icon-180.png','icon-192.png','icon-512.png'];
const fresh=u=>new Request(u,{cache:'reload'});
async function sha(buf){
  const h=await crypto.subtle.digest('SHA-1',buf);
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,12);
}
const jsResp=buf=>new Response(buf,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
/* 字庫檔：已有相同內容（舊版快取裡的檔案，比對 SHA-1）就直接沿用，不重新下載 */
async function installFile(c,dc,f,want){
  if(await dc.match(f))return;
  try{
    const old=await caches.match(f,{ignoreSearch:true});
    if(old){
      const buf=await old.arrayBuffer();
      if(await sha(buf)===want){await dc.put(f,jsResp(buf));return}
    }
  }catch(e){}
  /* V5.27.2：內容和預期不同（例如伺服器剛更新、還在送舊檔）時，改用新網址再下載一次；
     還是不同就這次先不更新（繼續用目前的版本），下次開啟再試，避免新程式配到舊字庫 */
  for(const u of [f,f+'?v='+want]){
    const r=await fetch(fresh(u));
    if(!r.ok)continue;
    const buf=await r.arrayBuffer();
    let same=false;
    try{same=await sha(buf)===want}catch(e){}
    if(same){await dc.put(f,jsResp(buf));return}
  }
  throw new Error(f+' 內容和版本不符');
}
async function install(){
  const c=await caches.open(C);
  await c.addAll(CORE.map(fresh));
  const dc=await caches.open(D);
  for(const [f,h] of Object.entries(DATA_FILES))await installFile(c,dc,f,h);
  await Promise.all(OPT.map(u=>fetch(fresh(u)).then(r=>r.ok?c.put(u,r):null).catch(()=>null)));
  await self.skipWaiting();
}
async function activate(){
  const keys=await caches.keys();
  await Promise.all(keys.filter(x=>x!==C&&x!==D&&x.startsWith('english-5000')).map(x=>caches.delete(x)));
  await self.clients.claim();
}
self.addEventListener('install',e=>e.waitUntil(install()));
self.addEventListener('activate',e=>e.waitUntil(activate()));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(caches.match('index.html').then(h=>h||fetch(r)).catch(()=>fetch(r)));return}
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||fetch(r)));
});
