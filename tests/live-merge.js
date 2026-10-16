// Run: see tests/README.md
const APP=process.env.APP_URL||'http://localhost:8765/index.html';const OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1400,height:900}});
 await ctx.route(/(cartocdn|arcgisonline|unpkg|fonts.googleapis|nominatim)/,r=>r.abort());
 const C=[{id:'a1',name:'Taro Yamada',phone:'0400 111 222',notes:'met at church',aiNotes:'- likes ramen',log:[],added:'2026-01-01',beeper:{LINE:'11'}},
          {id:'a2',name:'Taro Y',phone:'0400111222',notes:'',aiNotes:'- works at Sony',added:'2026-02-01',beeper:{Instagram:'22'}},
          {id:'p1',name:'Kid Yamada',parents:['a2'],added:'2026-01-01'},
          ...[...Array(10)].map((_,i)=>({id:'x'+i,name:'Other '+i,added:'2026-01-01'}))];
 const reqs=[];await ctx.route('https://script.google.com/**',async r=>{const body=JSON.parse(r.request().postData()||'{}');reqs.push(body);let res={ok:true};
  if(body.action==='meta')res={ok:true,contactCount:C.length,photoCount:0,log:[{d:'2026-10-01',id:'a2',p:'Instagram'}],chats:[{id:'99',platform:'LINE',name:'たろう Yamada',status:'Unmatched'},{id:'11',platform:'LINE',name:'Taro',status:'Linked',contactId:'a1'},{id:'22',platform:'Instagram',name:'taro',status:'Linked',contactId:'a2'}],maps:[],views:[],lists:{},settings:{},dashboards:[]};
  else if(body.action==='contacts')res={ok:true,contacts:C.slice(body.offset,body.offset+body.limit)};
  else if(body.action==='photos')res={ok:true,photos:{}};
  else if(body.action==='batch')res={ok:true,results:body.ops.map(()=>({ok:true}))};
  await r.fulfill({contentType:'application/json',body:JSON.stringify(res)});});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('nakama.url','https://script.google.com/macros/s/X/exec');localStorage.setItem('nakama.pin','pin');});
 await p.goto(''+APP+'#contacts');await p.waitForTimeout(1500);
 await p.fill('#q','Taro Yamada');await p.waitForTimeout(300);await p.click('[data-act=open]');await p.waitForSelector('#profile:not([hidden])');
 console.log('ai notes field:',await p.inputValue('#f-aiNotes'));
 await p.click('.pbar [data-act=mg-open]');await p.waitForSelector('[data-act=mg-pick]');
 console.log('top suggestion:',(await p.textContent('[data-act=mg-pick]')).slice(0,60));
 await p.click('[data-act=mg-pick]');await p.waitForSelector('.cmp');await p.click('[data-act=rv-merge]');await p.waitForTimeout(2500);
 const ops=reqs.filter(r=>r.action!=='meta'&&r.action!=='contacts'&&r.action!=='photos').map(r=>r.action==='batch'?'batch['+r.ops.map(o=>o.action+(o.contact?'('+o.contact.id+' beeper='+JSON.stringify(o.contact.beeper)+' parents='+o.contact.parents+' ai='+JSON.stringify(o.contact.aiNotes)+')':'')).join(', ')+']':r.action+' '+JSON.stringify({keep:r.keep,drop:r.drop}));
 console.log(ops.join('\n'));
 reqs.length=0;
 // link chat with name choice
 await p.click('[data-act=close-profile]');await p.click('.nav[data-r=other]');await p.click('.tool[data-k=matcher]');await p.waitForSelector('.chatcard');
 await p.fill('#mq','Taro');await p.waitForTimeout(200);await p.keyboard.press('Enter');await p.waitForSelector('#lnh');
 await p.click('.lnopt:nth-child(2)');await p.keyboard.press('Enter');await p.waitForTimeout(2500);
 console.log(reqs.map(r=>r.action==='batch'?'batch['+r.ops.map(o=>o.action+(o.contact?'('+o.contact.name+' notes='+JSON.stringify(o.contact.notes)+')':'')).join(', ')+']':r.action+' '+(r.chatId||'')).join('\n'));
 console.log('errors',errs);await b.close();})();
