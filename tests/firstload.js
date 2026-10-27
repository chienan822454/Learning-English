// 第一次開啟時間比較：node firstload.js 舊版資料夾 新版資料夾
// 模擬網路（壓縮傳輸，和 GitHub Pages 一樣）＋中階手機（CPU 降速 4 倍），各量 3 次取中間值
const {launch,sleep}=require('./common');const http=require('http'),path=require('path'),fs=require('fs'),zlib=require('zlib');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const A=process.argv[2]||'siteA',B=process.argv[3]||'siteB';let ROOT=A;const gz={};
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}const k=f;gz[k]=gz[k]||zlib.gzipSync(fs.readFileSync(f));s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Content-Encoding':'gzip','Cache-Control':'no-store'});s.end(gz[k])}).listen(8879);
(async()=>{const b=await launch();const res={};
for(const net of [{name:'一般 4G（10 Mbps）',down:10e6/8,lat:60},{name:'訊號弱（1.5 Mbps）',down:1.5e6/8,lat:150}]){
 for(const site of [A,B]){ROOT=site;const times=[];
  for(let r=0;r<3;r++){const ctx=await b.newContext({serviceWorkers:'block'});const pg=await ctx.newPage();await pg.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),5)});
   const c=await ctx.newCDPSession(pg);await c.send('Network.enable');await c.send('Network.emulateNetworkConditions',{offline:false,latency:net.lat,downloadThroughput:net.down,uploadThroughput:net.down});await c.send('Emulation.setCPUThrottlingRate',{rate:4});
   const t0=Date.now();await pg.goto('http://localhost:8879/',{waitUntil:'commit'});
   await pg.waitForFunction(()=>!!document.querySelector('#todayBody [data-go="new"]'),null,{timeout:60000,polling:20});const tReady=Date.now()-t0;
   await pg.waitForFunction(()=>typeof EX_READY==='undefined'||EX_READY===true||(window.WORDS||[]).every(x=>x.ex),null,{timeout:60000,polling:50});const tAll=Date.now()-t0;
   times.push([tReady,tAll]);await ctx.close()}
  times.sort((a,b)=>a[0]-b[0]);res[net.name+' '+site]=times[1]}}
console.log(JSON.stringify(res,null,1));await b.close();srv.close()})();
