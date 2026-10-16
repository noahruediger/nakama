// Run: see tests/README.md
const APP=process.env.APP_URL||'http://localhost:8765/index.html';const OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require('playwright');const fs=require('fs');const NM=__dirname+'/node_modules/';
const shot=async(p,n)=>p.screenshot({path:OUT+'/'+n+'.png'});
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1440,height:900}});
 await ctx.route(/(cartocdn|arcgisonline|unpkg|fonts.googleapis|nominatim)/,r=>r.abort());
 let dictHits=0;
 await ctx.route('https://cdn.jsdelivr.net/npm/**',r=>{const u=new URL(r.request().url());const m=u.pathname.match(/^\/npm\/([^@]+)@[^/]+\/(.*)$/);const f=NM+m[1]+'/'+m[2];if(f.endsWith('.gz'))dictHits++;
   r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':'application/octet-stream'});});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 const step=async(n,f)=>{try{await f();console.log('OK  ',n);}catch(e){console.log('FAIL',n,e.message.split('\n')[0]);}};
 await p.goto(''+APP+'');await p.waitForTimeout(600);
 await step('matcher romaji',async()=>{await p.click('.nav[data-r=other]');await p.click('.tool[data-k=matcher]');await p.waitForSelector('.chatcard');
   // pick a chat with kanji or kana via finder: inject test chats via find
   const rows=await p.$$eval('.qscroll .qbtn',x=>x.map(e=>e.innerText.replace(/\n/g,' / ')));console.log('   queue sample',rows.slice(0,14).join(' | '));
   await p.waitForTimeout(4000);const rows2=await p.$$eval('.qscroll .qbtn',x=>x.filter(e=>e.querySelector('.rj')).map(e=>e.innerText.replace(/\n/g,' / ')));console.log('   with romaji',rows2.join(' | '),'dictHits',dictHits);
   await shot(p,'matcher');});
 await step('ignore + undo',async()=>{const before=await p.textContent('.chatcard .nmcopy');await p.click('[data-act=mignore]');await p.waitForSelector('.toastbtn');await p.click('.toastbtn');await p.waitForTimeout(200);
   const after=await p.textContent('.chatcard .nmcopy');console.log('   ',before,'->',after);if(before!==after)throw new Error('not restored');});
 await step('ignored list',async()=>{await p.click('[data-act=mignore]');await p.click('[data-act=mshowig]',{force:true});const n=await p.$$eval('.igrow',x=>x.length);console.log('   ignored rows',n);await shot(p,'ignored');await p.click('.igrow [data-act=munignore]',{force:true});});
 await step('gender buttons in new contact',async()=>{await p.click('[data-act=mnew]');await p.waitForSelector('.gbtns');const unset=await p.$eval('.gbtns',e=>e.className);await shot(p,'gender0');await p.click('.gbtn.female');const on=await p.$eval('.gbtn.female',e=>e.className+' '+getComputedStyle(e).backgroundColor);console.log('   ',unset,'|',on);await shot(p,'gender1');await p.click('[data-act=draft-close] >> nth=0');});
 await step('photo inbox search + save (demo)',async()=>{await p.click('[data-act=tool-back]');await p.click('.tool[data-k=photos]');await p.waitForSelector('#piFiles',{state:'attached'});
   await p.setInputFiles('#piFiles',{name:'a.png',mimeType:'image/png',buffer:fs.readFileSync(OUT+'/review.png')});await p.waitForSelector('.pithumb');await p.click('.pithumb');await p.waitForSelector('#piCv');
   await p.fill('#piWho','gra');await p.waitForTimeout(150);const n=await p.$$eval('.pires',x=>x.length);console.log('   results',n);await shot(p,'pisearch');
   await p.click('.pires >> nth=0');await p.fill('#piWho','Totally New Person');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
   const ppl=await p.$$eval('.pipeople .tag',x=>x.map(e=>e.innerText));console.log('   people',ppl);
   await p.click('[data-act=pi-save]');await p.waitForTimeout(200);console.log('   saved:',await p.textContent('.pisaved').catch(()=>'NONE'));await shot(p,'pisaved');});
 console.log('errors',errs.slice(0,5));await b.close();})();
