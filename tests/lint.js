// 靜態檢查：未定義變數、重複宣告、沒用到的函式/變數、重複的物件鍵、return 後不會執行的程式
const acorn=require('internal/deps/acorn/acorn/dist/acorn');const walk=require('internal/deps/acorn/acorn-walk/dist/walk');const fs=require('fs');
const [,,file,...extra]=process.argv;const src=fs.readFileSync(file,'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script',locations:true,allowHashBang:true});
const GLOBALS=new Set(('window document navigator location localStorage sessionStorage console setTimeout clearTimeout setInterval clearInterval Date Math JSON Object Array String Number Boolean Set Map WeakMap WeakSet Promise RegExp Error TypeError encodeURIComponent decodeURIComponent Blob URL File FileReader Audio AudioContext webkitAudioContext MediaRecorder speechSynthesis SpeechSynthesisUtterance alert confirm prompt fetch performance requestAnimationFrame cancelAnimationFrame getComputedStyle isNaN isFinite parseInt parseFloat Infinity NaN undefined Symbol Uint8Array Int16Array Float32Array DataView ArrayBuffer TextEncoder TextDecoder atob btoa history screen Intl structuredClone queueMicrotask globalThis self caches crypto matchMedia scrollTo innerWidth innerHeight Event CustomEvent MutationObserver IntersectionObserver ResizeObserver Image arguments Reflect Proxy HTMLElement Node NodeFilter Response Request Headers clients registration skipWaiting importScripts addEventListener removeEventListener dispatchEvent DOMException AbortController'.split(' ')));
extra.forEach(f=>{const s=fs.readFileSync(f,'utf8');(s.match(/window\.([A-Za-z_$][\w$]*)\s*=/g)||[]).forEach(m=>GLOBALS.add(m.slice(7).replace(/\s*=$/,'')));try{const a=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script'});a.body.forEach(n=>{if(n.type==='VariableDeclaration')n.declarations.forEach(d=>d.id.name&&GLOBALS.add(d.id.name));if(n.type==='FunctionDeclaration')GLOBALS.add(n.id.name)})}catch(e){}});
const decl=new Map(),refs=new Map(),issues=[];
const addDecl=(name,node,kind,top)=>{if(!decl.has(name))decl.set(name,[]);decl.get(name).push({line:node.loc.start.line,col:node.loc.start.column,kind,top})};
const pat=(p,kind,top)=>{if(!p)return;if(p.type==='Identifier')addDecl(p.name,p,kind,top);else if(p.type==='ObjectPattern')p.properties.forEach(q=>pat(q.type==='RestElement'?q.argument:q.value,kind,top));else if(p.type==='ArrayPattern')p.elements.forEach(e=>pat(e,kind,top));else if(p.type==='AssignmentPattern')pat(p.left,kind,top);else if(p.type==='RestElement')pat(p.argument,kind,top)};
ast.body.forEach(n=>{if(n.type==='FunctionDeclaration')addDecl(n.id.name,n.id,'function',true);else if(n.type==='VariableDeclaration')n.declarations.forEach(d=>pat(d.id,n.kind,true));else if(n.type==='ClassDeclaration')addDecl(n.id.name,n.id,'class',true)});
const declNodes=new Set();
walk.fullAncestor(ast,(node,st,anc)=>{
 if(node.type==='FunctionDeclaration'&&anc.length>2){addDecl(node.id.name,node.id,'function',false);declNodes.add(node.id)}
 if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'||node.type==='ArrowFunctionExpression'){node.params.forEach(p=>pat(p,'param',false));if(node.id)declNodes.add(node.id);if(node.type==='FunctionExpression'&&node.id)addDecl(node.id.name,node.id,'fnexpr',false)}
 if(node.type==='VariableDeclaration'&&anc.length>2)node.declarations.forEach(d=>pat(d.id,node.kind,false));
 if(node.type==='CatchClause'&&node.param)pat(node.param,'catch',false);
 if(node.type==='ObjectExpression'){const seen=new Map();node.properties.forEach(p=>{if(p.type!=='Property'||p.computed)return;const k=p.key.type==='Identifier'?p.key.name:String(p.key.value);if(seen.has(k))issues.push(['重複的物件鍵',k,p.loc.start.line]);seen.set(k,1)})}
 if(node.type==='SwitchStatement'){const seen=new Set();node.cases.forEach(c=>{if(!c.test)return;const k=src.slice(c.test.start,c.test.end);if(seen.has(k))issues.push(['重複的 case',k,c.loc.start.line]);seen.add(k)})}
 if(node.type==='BlockStatement'||node.type==='Program'){const b=node.body;for(let k=0;k+1<b.length;k++){if(['ReturnStatement','ThrowStatement','BreakStatement','ContinueStatement'].includes(b[k].type)&&b[k+1].type!=='FunctionDeclaration')issues.push(['return 後面的程式不會執行',src.slice(b[k+1].start,b[k+1].start+60),b[k+1].loc.start.line])}}
 if(node.type==='AssignmentExpression'&&node.left.type==='Identifier'&&node.right.type==='Identifier'&&node.left.name===node.right.name&&node.operator==='=')issues.push(['自己指定給自己',node.left.name,node.loc.start.line]);
 if(node.type==='BinaryExpression'&&/^[!=]==?$/.test(node.operator)){const t=[node.left,node.right].find(x=>x.type==='Literal'&&typeof x.value==='string');const o=[node.left,node.right].find(x=>x.type==='UnaryExpression'&&x.operator==='typeof');if(t&&o&&!['undefined','object','boolean','number','string','function','symbol','bigint'].includes(t.value))issues.push(['typeof 比較打錯字',t.value,node.loc.start.line])}
 if(node.type==='Identifier'){const p=anc[anc.length-2];if(!p)return;
  if(p.type==='MemberExpression'&&p.property===node&&!p.computed)return;
  if((p.type==='Property'||p.type==='MethodDefinition'||p.type==='PropertyDefinition')&&p.key===node&&!p.computed&&!(p.shorthand&&p.value===node))return;
  if(p.type==='LabeledStatement'||p.type==='BreakStatement'||p.type==='ContinueStatement')return;
  if((p.type==='FunctionDeclaration'||p.type==='FunctionExpression'||p.type==='ClassDeclaration'||p.type==='ClassExpression')&&p.id===node)return;
  if(p.type==='VariableDeclarator'&&p.id===node)return;
  if((p.type==='FunctionDeclaration'||p.type==='FunctionExpression'||p.type==='ArrowFunctionExpression')&&p.params.includes(node))return;
  if(p.type==='CatchClause'&&p.param===node)return;
  if(p.type==='AssignmentPattern'&&p.left===node&&anc.some(a=>a.params))return;
  if(p.type==='Property'&&p.value===node&&anc[anc.length-3]&&anc[anc.length-3].type==='ObjectPattern')return;
  if(p.type==='ArrayPattern')return;
  refs.set(node.name,(refs.get(node.name)||0)+1)}
});
const strUse=new Set();(src.match(/[A-Za-z_$][\w$]*(?=\()/g)||[]).forEach(n=>strUse.add(n));
const htmlUse=new Set();extra.filter(f=>f.endsWith('.html')).forEach(f=>(fs.readFileSync(f,'utf8').match(/[A-Za-z_$][\w$]*(?=\()/g)||[]).forEach(n=>htmlUse.add(n)));
const undef=[...refs.keys()].filter(n=>!decl.has(n)&&!GLOBALS.has(n));
undef.forEach(n=>{const re=new RegExp('(^|[^\\w$.])'+n.replace(/\$/g,'\\$')+'(?![\\w$])','m');const m=re.exec(src);const line=m?src.slice(0,m.index).split('\n').length:0;issues.push(['未定義的名稱',n,line])});
const tops=new Map();decl.forEach((arr,name)=>{const t=arr.filter(x=>x.top);if(t.length>1)issues.push(['最上層重複宣告',name+' ×'+t.length+' '+t.map(x=>x.kind+'@'+x.line).join(','),t[1].line])});
decl.forEach((arr,name)=>{if(arr.every(x=>x.kind==='param'||x.kind==='catch'))return;if(!(refs.get(name))&&!htmlUse.has(name))issues.push(['宣告了但沒用到',name+'（'+arr.map(x=>x.kind+'@'+x.line).join(',')+'）',arr[0].line])});
issues.sort((a,b)=>a[0].localeCompare(b[0])||a[2]-b[2]);const by={};issues.forEach(i=>{(by[i[0]]=by[i[0]]||[]).push(i)});
Object.entries(by).forEach(([k,v])=>{console.log(`== ${k}（${v.length}）`);v.forEach(i=>console.log('  L'+i[2]+'  '+i[1]))});
console.log('declared names',decl.size,'referenced names',refs.size);
