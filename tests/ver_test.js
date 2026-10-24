const {serve,launch,sleep,ok,fs}=require('./common');const srv=serve(()=>'site',8773);
(async()=>{const b=await launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8773/');await sleep(1500);await pg.reload();await sleep(1200);
const badge=await pg.textContent('#appVer');await pg.click('#navStats');await sleep(800);const info=await pg.textContent('#verInfo');
ok('畫面標題顯示正確版本',badge===process.env.VER,badge);ok('統計頁版本資訊：程式／畫面／離線快取一致',info.includes(process.env.VER)&&info.includes(process.env.CACHE)&&/一致/.test(info)&&!/不一致/.test(info),info);
ok('版本測試沒有 JavaScript 錯誤',errs.length===0,errs.join(';'));
fs.writeFileSync('results_ver.json',JSON.stringify(require('./common').R,null,1));await b.close();srv.close()})();
