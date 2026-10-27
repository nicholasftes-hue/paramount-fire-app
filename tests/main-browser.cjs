// Isolated local fictional records only. All external service requests are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),results=[],errors=[],external=[];
const server=http.createServer((req,res)=>{
 const relative=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS:',name)}
(async()=>{let browser,context;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 context=await browser.newContext({serviceWorkers:'block',viewport:{width:360,height:800}});
 await context.route('https://**/*',route=>{external.push(route.request().url());return route.abort()});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const base=`http://127.0.0.1:${server.address().port}/`;
 await p.goto(base);await p.waitForFunction(()=>!!window.ParamountMainApp);
 async function tab(name){await p.locator(`[data-tab="${name}"]:visible`).first().click();await p.locator('.main-app').waitFor()}
 async function fill(values){await p.locator('form[data-main-form]').evaluate((form,values)=>{for(const [name,value]of Object.entries(values)){if(value===undefined)continue;const el=form.elements.namedItem(name);if(!el)throw Error('Missing field '+name);if(el.type==='checkbox')el.checked=!!value;else el.value=value}form.dispatchEvent(new Event('input',{bubbles:true}));form.elements.reviewed.checked=true},values)}
 async function save(values){await fill(values);await p.locator('form[data-main-form] button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('main-status')?.textContent.startsWith('Draft saved'));}
 const common={property:'P001',date:'2026-10-26',reviewed:'yes'};
 await check('all core draft forms save and retain records after reload',async()=>{
 const cases=[['Service Records',{engineer:'Test engineer',system:'Fictional panel',standard:'Agreed scope TEST',tests:'Zone 1 tested — fictional',battery:'Not inspected',measurements:'Not measured — training fixture',defects:'No conclusion — test',actions:'Test advice',recipient:'Fictional recipient',declaration:'Training fixture only'}],['Extinguishers',{engineer:'Test engineer',asset:'EXT-1',location:'Fictional hall',model:'Test model',capacity:'Test type',visitType:'Inspection only',tests:'Training fixture',outcome:'Not serviced / inaccessible',defects:'No service performed'}],['Installation Forms',{engineer:'Test engineer',stage:'Commissioning record',system:'Test system',standard:'Test scope',drawingRef:'D1',devices:'Test device',tests:'Fictional results',defects:'Test limitation',actions:'Test handover',recipient:'Test recipient',declaration:'Draft fixture only'}],['Quotes',{number:'Q-TEST-1',customer:'Test customer',address:'Fictional address',due:'2026-11-26',lines:'Test service | 3 | 0.10',vat:'20',vatNumber:'TEST',terms:'Draft test'}],['Planner',{engineer:'Test engineer',time:'09:00',minutes:'60',serviceType:'Fire alarm',status:'Confirmed',notes:'Test access'}],['Call-outs',{engineer:'Test engineer',number:'C-TEST',priority:'Routine',status:'Open',issue:'Fictional issue',defects:'Test defect',actions:'Test follow-up'}],['Office',{customer:'Test customer',contact:'TEST ONLY',site:'Fictional site',status:'New',owner:'Test office',notes:'Fictional enquiry'}],['Drawing Studio',{title:'Test layout revision 1',layout:'Hall | 0 | 0 | 100 | 50',markers:'Test detector | 20 | 20',notes:'Not to scale — fictional'}],['Equipment Library',{manufacturer:'SmartCell',model:'TEST MODEL',title:'Test guide reference',url:'https://example.com/fictional-guide',checked:'2026-10-26',notes:'Placeholder reference — no verified manual'}]];
 for(const [name,v] of cases){await tab(name);await save({...common,...v,...(name==='Office'?{property:undefined}:{})});assert.equal(await p.locator('.main-record').count(),1,name)}
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Extinguishers');assert.equal(await p.locator('.main-record').count(),1);
 });
 await check('quote conversion requires a new number and review; invoice totals and draft preview are correct',async()=>{
 await tab('Quotes');await p.locator('[data-main-convert]').click();assert.equal(await p.locator('form [name=number]').inputValue(),'');assert.equal(await p.locator('form [name=reviewed]').isChecked(),false);assert.equal(await p.locator('form [name=source]').inputValue(),'Q-TEST-1');
 await save({...common,number:'I-TEST-1',due:'2026-11-26'});assert.match(await p.locator('.main-record').innerText(),/£0.36/);
 const popupPromise=p.waitForEvent('popup');await p.locator('[data-main-print]').click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(await popup.locator('body').innerText(),/DRAFT.*NOT ISSUED/);assert.match(await popup.locator('body').innerText(),/£0.36/);await popup.close();
 });
 await check('saved edits append revisions and safely render script-like text',async()=>{
 await tab('Call-outs');await p.locator('[data-main-edit]').click();await save({...common,issue:'<img src=x onerror=alert(1)> test'});assert.match(await p.locator('.main-record').innerText(),/revision 2/);assert.equal(await p.locator('.main-record img').count(),0);await p.locator('.main-record>details>summary').click();assert.match(await p.locator('.main-record').innerText(),/Revision 1/);
 });
 await check('planner prevents engineer overlaps without changing saved records',async()=>{
 await tab('Planner');await fill({...common,engineer:'Test engineer',time:'09:30',minutes:'60',serviceType:'PAT',status:'Planned',notes:'Test overlap'});await p.locator('form[data-main-form] button[type=submit]').click();assert.match(await p.locator('#main-status').innerText(),/overlapping/);assert.equal(await p.locator('.main-record').count(),1);
 });
 await check('property history contains all site workflows and preserves original records',async()=>{
 await tab('Property History');await p.locator('#main-history-property').selectOption('P001');assert.equal(await p.locator('#main-history>.main-record').count(),9);assert.match(await p.locator('#main-history').innerText(),/Existing prototype records/);
 });
 await check('unfinished forms survive navigation and reload with review reset on edits',async()=>{
 await tab('Service Records');await p.locator('form [name=engineer]').fill('Unfinished engineer');await tab('Invoices');await tab('Service Records');assert.equal(await p.locator('form [name=engineer]').inputValue(),'Unfinished engineer');await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Service Records');assert.equal(await p.locator('form [name=engineer]').inputValue(),'Unfinished engineer');assert.equal(await p.locator('form [name=reviewed]').isChecked(),false);
 });
 await check('property database saves, reopens, searches and preserves service site snapshots',async()=>{
 await tab('Properties');await p.locator('[data-main-property-edit="P001"]').click();
 await p.locator('#main-property-form [name=name]').fill('Renamed fictional property');
 await p.locator('#main-property-form [name=address]').fill('Fictional new address');
 await p.locator('#main-property-form button[type=submit]').click();
 assert.match(await p.locator('#main-status').innerText(),/Property saved/);
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Properties');
 await p.locator('#main-property-search').fill('Renamed fictional');assert.equal(await p.locator('#main-properties .main-record').count(),1);
 await p.locator('[data-main-property-edit="P001"]').click();assert.equal(await p.locator('#main-property-form [name=address]').inputValue(),'Fictional new address');
 await tab('Service Records');await p.locator('[data-main-edit]').click();
 await fill({batteryVoltage:'24.125',batteryAh:'7'});await p.locator('form[data-main-form] button[type=submit]').click();
 await p.waitForFunction(()=>document.getElementById('main-status')?.textContent.startsWith('Draft saved'));
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Service Records');
 await p.locator('[data-main-edit]').click();assert.equal(await p.locator('form [name=batteryVoltage]').inputValue(),'24.125');
 const pending=p.waitForEvent('download');await p.locator('[data-main-pdf]').click();const file=await pending;
 const pdf=fs.readFileSync(await file.path(),'utf8');assert.match(pdf,/^%PDF-1.4/);assert.match(pdf,/FontFile2/);assert.match(pdf,/ToUnicode/);
 fs.mkdirSync('test-results',{recursive:true});fs.copyFileSync(await file.path(),'test-results/browser-service-draft.pdf');
 });
 await check('account changes cannot save a stale account form and have isolated records',async()=>{
 await p.evaluate(()=>{cloudSession={user:{id:'fictional-account-b'}}});await p.locator('form[data-main-form]').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.match(await p.locator('#main-status').innerText(),/Account changed/);await tab('Invoices');assert.equal(await p.locator('.main-record').count(),0);await p.evaluate(()=>{cloudSession=null});await tab('Invoices');assert.equal(await p.locator('.main-record').count(),1);
 });
 await check('320px, 360px, 412px and landscape forms fit the screen',async()=>{
 for(const viewport of [{width:320,height:568},{width:360,height:800},{width:412,height:915},{width:800,height:360}]){await p.setViewportSize(viewport);for(const name of ['Properties','Service Records','Extinguishers','Quotes','Invoices','Planner','Drawing Studio']){await tab(name);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${viewport.width}`)}await tab('Service Records');const pending=p.waitForEvent('download');await p.locator('[data-main-pdf]').click();const pdfFile=await pending;assert.match(fs.readFileSync(await pdfFile.path(),'utf8'),/^%PDF-1.4/);fs.mkdirSync('test-results',{recursive:true});await p.screenshot({path:`test-results/main-app-${viewport.width}.png`,fullPage:true})}
 });
 await check('workspace backup downloads without authentication tokens',async()=>{
 await tab('Record Backup');const pending=p.waitForEvent('download');await p.locator('[data-main-export]').click();const file=await pending;const data=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(data.records.length,10);assert(!JSON.stringify(data).includes('access_token'));assert.equal(data.scope,'device-guest');
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`PASS: ${results.length} main-app browser scenarios; no external requests or browser errors`);
 }catch(error){results.push({name:'main-app browser run',status:'failed',error:error.stack});console.error(error);process.exitCode=1}
 finally{fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/main-browser-results.json',JSON.stringify({results,errors,external},null,2));if(context)await context.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})();


