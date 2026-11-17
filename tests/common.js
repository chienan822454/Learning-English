/* 測試共用設定：優先用專案安裝的 playwright（GitHub 自動測試、自己的電腦）；找不到時用開發環境內建的位置 */
let pw;try{pw=require('playwright')}catch(e){pw=require('/usr/local/lib/node_modules/docgen-utils/node_modules/playwright')}
const {chromium}=pw;
const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
function serve(getRoot,port,st={online:true}){return http.createServer((q,s)=>{if(!st.online){q.socket.destroy();return}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(getRoot(),p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)}).listen(port)}
const DEV_CHROME='/opt/docgen-browsers/chromium-1208/chrome-linux64/chrome';
const EXE=process.env.CHROME_PATH||(require('fs').existsSync(DEV_CHROME)?DEV_CHROME:undefined);
const launch=()=>chromium.launch({executablePath:EXE,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R=[];const ok=(n,p,i='')=>{R.push({name:n,pass:!!p,info:i});console.log((p?'PASS':'FAIL')+' | '+n+(i?' | '+i:''))};
/* 依網站的字庫計算句子數（測試不必寫死數量）：精選＋單字例句＋片語例句＋對話句 */
function dataCounts(dir='site'){const vm=require('vm');const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'data.js'),'utf8'),ctx);const w=ctx.window;try{vm.runInNewContext(fs.readFileSync(path.join(dir,'data-ex.js'),'utf8'),ctx)}catch(e){}/* V5.32.0：多益長例句移到 data-ex2.js */try{vm.runInNewContext(fs.readFileSync(path.join(dir,'data-ex2.js'),'utf8'),ctx)}catch(e){}/* V5.34.0：情境題、發音辨別、人名地名移到 data-more.js */try{vm.runInNewContext(fs.readFileSync(path.join(dir,'data-more.js'),'utf8'),ctx)}catch(e){}const words=(w.WORDS||[]).length,core=(w.SENTENCES||[]).length,ph=(w.PHRASES||[]).length,dl=(w.DIALOGS||[]).reduce((a,d)=>a+d.lines.length,0);/* V5.29.0：無線電用語句子、多益第二個例句 */const radio=((w.RADIO||{}).sent||[]).length,ex2=Object.keys(w.WORD_EX2||{}).length;/* V5.33.0：句型替換 */const fr=(w.FRAMES||[]).reduce((a,f)=>a+f.items.length,0);return {words,core,ph,dl,radio,ex2,fr,dn:(w.DIALOGS||[]).length,sq:(w.SITQ||[]).length,total:core+words+ph+dl+radio+ex2+fr,noEx:core+ph+dl+radio+fr}}
/* V5.29.0：單字頁的主題、狀態、只學原形、每日新字收進「篩選」；舊測試操作這些選單前先自動展開 */
function wfAuto(pg){const WF=['#wordTopic','#wordState','#skipVar','#dailyGoal'],_so=pg.selectOption.bind(pg),_cl=pg.click.bind(pg);const wfo=async s=>{if(WF.includes(s)&&await pg.$eval('#wfPanel',e=>e.hidden).catch(()=>false))await _cl('#wfToggle')};pg.selectOption=async(s,...a)=>{await wfo(s);return _so(s,...a)};pg.click=async(s,...a)=>{await wfo(s);return _cl(s,...a)};return pg}
module.exports={serve,launch,sleep,R,ok,fs,dataCounts,wfAuto};
