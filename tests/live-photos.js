// Run: see tests/README.md
const APP=process.env.APP_URL||'http://localhost:8765/index.html';const OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1400,height:900}});
 await ctx.route(/(cartocdn|arcgisonline|unpkg|fonts.googleapis|nominatim|jsdelivr)/,r=>r.abort());
 const img='data:image/png;base64,'+fs.readFileSync(OUT+'/review.png').toString('base64');
 const C=[{id:'a1',name:'Grace Barton',added:'2026-01-01'},...[...Array(5)].map((_,i)=>({id:'x'+i,name:'Other '+i,added:'2026-01-01'}))];
 const reqs=[];await ctx.route('https://script.google.com/**',async r=>{const body=JSON.parse(r.request().postData()||'{}');reqs.push(body);let res={ok:true};
  if(body.action==='meta')res={ok:true,contactCount:C.length,photoCount:0,log:[],chats:[{id:'5',platform:'LINE',name:'さくら',status:'Ignored'}],maps:[],views:[],lists:{},settings:{},dashboards:[]};
  else if(body.action==='contacts')res={ok:true,contacts:C.slice(body.offset,body.offset+body.limit)};
  else if(body.action==='photos')res={ok:true,photos:{}};
  else if(body.action==='inboxList'){await new Promise(z=>setTimeout(z,1500));res={ok:true,photos:[{id:'d1',name:'fam.png',thumb:img}]};}
  else if(body.action==='inboxGet'){await new Promise(z=>setTimeout(z,1500));res={ok:true,photo:img};}
  else if(body.action==='batch')res={ok:true,results:body.ops.map(()=>({ok:true}))};
  await r.fulfill({contentType:'application/json',body:JSON.stringify(res)});});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('nakama.url','https://script.google.com/macros/s/X/exec');localStorage.setItem('nakama.pin','pin');});
 await p.goto(''+APP+'#other');await p.waitForTimeout(1500);
 await p.click('.tool[data-k=photos]');await p.waitForTimeout(300);console.log('loading card:',!!await p.$('.piload .indet'));await p.screenshot({path:OUT+'/piload.png'});
 await p.waitForSelector('.pithumb');await p.click('.pithumb');await p.waitForTimeout(300);console.log('photo loading:',!!await p.$('.piphload'));await p.screenshot({path:OUT+'/piphload.png'});
 await p.waitForSelector('#piCv');await p.fill('#piWho','grace');await p.keyboard.press('Enter');await p.click('[data-act=pi-save]');await p.waitForTimeout(1500);
 console.log(reqs.filter(r=>r.action==='batch').map(r=>r.ops.map(o=>o.action+':'+(o.id||o.contact&&o.contact.id)+(o.photo?' photo '+o.photo.length:''))).flat());
 // unignore live
 await p.click('[data-act=pi-back]');await p.click('[data-act=tool-back]');await p.click('.tool[data-k=matcher]');await p.click('[data-act=mshowig]');console.log('ig row:',await p.textContent('.igrow'));
 await p.click('.igrow [data-act=munignore]');await p.waitForTimeout(800);console.log(reqs.filter(r=>r.action==='unlinkChat').map(r=>r.chatId));
 console.log('errors',errs);await b.close();})();
