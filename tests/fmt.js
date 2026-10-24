// 安全排版：只在「敘述與敘述之間」換行縮排，不改任何程式內容；完成後比對語法樹必須完全相同
const acorn=require('internal/deps/acorn/acorn/dist/acorn');const walk=require('internal/deps/acorn/acorn-walk/dist/walk');const fs=require('fs');
const [,,inF,outF]=process.argv;const src=fs.readFileSync(inF,'utf8');
const P=s=>acorn.parse(s,{ecmaVersion:'latest',sourceType:'script',onComment:[]});
const ast=P(src);const ins=new Map();// pos -> depth
function mark(list,depth){list.forEach(s=>{if(!ins.has(s.start))ins.set(s.start,depth)})}
const closers=new Map();
(function visit(node,depth){if(!node||typeof node.type!=='string')return;
 if(node.type==='Program'){mark(node.body,0)}
 if(node.type==='BlockStatement'||node.type==='StaticBlock'){if(node.body.length){mark(node.body,depth+1);closers.set(node.end-1,depth)}depth=depth+1}
 if(node.type==='SwitchCase'){mark(node.consequent,depth+1)}
 if(node.type==='ClassBody'){if(node.body.length){mark(node.body,depth+1);closers.set(node.end-1,depth)}depth=depth+1}
 for(const k of Object.keys(node)){if(k==='type'||k==='start'||k==='end')continue;const v=node[k];if(Array.isArray(v))v.forEach(c=>c&&typeof c.type==='string'&&visit(c,node.type==='BlockStatement'||node.type==='ClassBody'?depth:depth));else if(v&&typeof v.type==='string')visit(v,depth)}
})(ast,0);
// 只在空白可插入處插入：該位置前面是空白或標點（不在字串/註解中，因為敘述起點與右大括號一定是 token 起點）
const pts=[...new Set([...ins.keys(),...closers.keys()])].sort((a,b)=>a-b);
let out='',last=0;
for(const p of pts){let q=p;let seg=src.slice(last,p);
 // 去掉插入點前的空白（不跨過註解）
 const m=/[ \t\r\n]*$/.exec(seg);seg=seg.slice(0,seg.length-m[0].length);
 const depth=ins.has(p)?ins.get(p):closers.get(p);
 out+=seg+(out.length+seg.length===0?'':'\n')+'  '.repeat(depth);last=p}
out+=src.slice(last);if(!out.endsWith('\n'))out+='\n';
// 驗證
const strip=n=>JSON.stringify(n,(k,v)=>k==='start'||k==='end'||k==='loc'||k==='range'?undefined:v);
const a1=strip(P(src)),a2=strip(P(out));
if(a1!==a2){console.error('AST 不同，放棄');process.exit(1)}
fs.writeFileSync(outF,out);const L=out.split('\n');console.log('OK 行數',src.split('\n').length,'→',L.length,'最長一行',Math.max(...L.map(l=>l.length)),'大小',src.length,'→',out.length);
