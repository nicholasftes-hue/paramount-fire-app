// Fictional fixtures only. All requests outside this temporary loopback origin are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))});
(async()=>{let browser;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [320,360,412,800]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(base);await p.waitForFunction(()=>!!window.ParamountMainApp);
  const tab=async t=>p.locator(`[data-tab="${t}"]:visible`).first().click();
  const fill=async v=>p.locator('form[data-main-form]').evaluate((f,v)=>{for(const[k,x]of Object.entries(v))f.elements[k].value=x;f.dispatchEvent(new Event('input',{bubbles:true}))},v);
  const field=async(k,v,i=0)=>{const el=p.locator(`[data-equipment-field="${k}"]`).nth(i);if(k==='result')await el.selectOption(v);else await el.fill(v)};
  const save=async()=>{await p.locator('[name=reviewed]').check();await p.locator('form[data-main-form] button[type=submit]').first().click();await p.waitForFunction(()=>document.querySelector('#main-status').textContent.startsWith('Draft saved'))};
  const download=async(kind)=>{for(const [control,ext]of [['pdf','pdf'],['word','docx']]){const waiting=p.waitForEvent('download');await p.locator(`[data-main-${control}]`).first().click();await(await waiting).saveAs(`test-results/${kind}-${width}.${ext}`)}};
  await tab('Extinguishers');await fill({property:'P001',date:'2026-10-29',engineer:'Fictional tester',visitType:'Basic service',serviceStatus:'Completed',testState:'Tested within recorded scope'});
  for(const[k,v]of Object.entries({id:'EX-1',serial:'SER-1',location:'Hall',model:'Fictional model',capacity:'6L foam',manufactured:'2020',lastTest:'2025-01-01',readings:'Fictional inspection',result:'Pass'}))await field(k,v);
  await p.locator('[data-equipment-identical]').click();await field('id','EX-2',1);assert.equal(await p.locator('[data-equipment-field=result]').nth(1).inputValue(),'Not Tested');assert.equal(await p.locator('[data-equipment-field=lastTest]').nth(1).inputValue(),'');await field('result','Fail',1);await field('defects','Fictional damaged hose',1);await field('actions','Fictional replacement advice',1);await save();await download('extinguisher');
  const original=await p.evaluate(()=>localStorage.getItem('paramount-main-app-v1:device-guest'));
  await p.locator('form [name=property]').selectOption('P001');await p.locator('[data-main-repeat=extinguisher]').click();assert.equal(await p.locator('[data-equipment-field=id]').count(),2);assert.equal(await p.locator('[data-equipment-field=readings]').first().inputValue(),'');assert.equal(await p.locator('[data-equipment-field=serial]').first().inputValue(),'SER-1');
  await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Extinguishers');assert.equal(await p.locator('[data-equipment-field=id]').count(),2);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('paramount-main-app-v1:device-guest')).records),JSON.parse(original).records);
  await tab('Service Records');await fill({property:'P001',date:'2026-10-29',engineer:'Fictional tester',system:'Fictional panel',standard:'Fictional recorded scope',battery:'Not inspected',measurements:'Fictional instrument',defects:'None in recorded scope',actions:'Fictional handover',recipient:'Fictional person',declaration:'Recorded scope only'});await p.locator('[data-equipment-add]').click();
  for(const[k,v]of Object.entries({id:'DEV-1',zone:'Z1',address:'L1:001',deviceType:'Smoke detector',location:'Hall',result:'Pass',readings:'Fictional current functional result'}))await field(k,v);await save();await download('structured-fire');
  const waiting=p.waitForEvent('popup');await p.locator('[data-main-print]').first().click();const popup=await waiting;await popup.waitForLoadState();assert.match(await popup.locator('.certificate').innerText(),/SYSTEM \/ PANEL \/ BATTERIES/);await popup.screenshot({path:`test-results/premium-certificate-${width}.png`,fullPage:true});await popup.close();
  await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('paramount-demo-v1')||'null')||{properties:db.properties};d.services=[{property:'P001',date:'2024-01-01',engineer:'Historical fictional engineer',notes:'Historical fictional results'}];localStorage.setItem('paramount-demo-v1',JSON.stringify(d));db=d});
  const legacy=await p.evaluate(()=>localStorage.getItem('paramount-demo-v1'));await tab('Property History');await p.locator('#main-history-property').selectOption('P001');await p.locator('[data-main-legacy]').first().click();assert.equal(await p.locator('[name=engineer]').inputValue(),'');assert.equal(await p.locator('[name=testState]').inputValue(),'Not Tested');assert.equal(await p.evaluate(()=>localStorage.getItem('paramount-demo-v1')),legacy);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.screenshot({path:`test-results/registers-${width}.png`,fullPage:true});await context.close();console.log('PASS registers, repeat, legacy history, premium exports and layout',width);
 }
 const c=await browser.newContext({serviceWorkers:'block'});const p=await c.newPage();p.on('dialog',d=>d.accept());await p.goto(base+'/test-results/fictional-preview/index.html');await p.waitForFunction(()=>!!window.ParamountMainApp);assert.match(await p.locator('body').innerText(),/FICTIONAL DATA PREVIEW/);assert.equal(await p.evaluate(()=>CLOUD_URL),'https://fictional.invalid');assert.equal(await p.evaluate(()=>CLOUD_KEY),'FICTIONAL-NO-CREDENTIAL');await p.screenshot({path:'test-results/fictional-preview.png',fullPage:true});
 const previewTab=async t=>p.locator(`[data-tab="${t}"]:visible`).first().click();
 const preserved=await p.evaluate(()=>JSON.parse(localStorage.getItem('paramount-fictional-main-v1:device-guest')).records);
 await previewTab('PAT Testing');assert.equal(await p.locator('[data-equipment-field=id]').count(),3);
 await p.locator('[data-equipment-result="Fail"]').first().click();assert.equal(await p.locator('[data-equipment-field=result]').first().inputValue(),'Fail');
 assert.equal(await p.locator('[data-equipment-field=defects]').first().evaluate(el=>el===document.activeElement),true);
 await p.locator('[data-equipment-field=defects]').first().fill('Fictional new defect');
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await previewTab('PAT Testing');
 assert.equal(await p.locator('[data-equipment-field=result]').first().inputValue(),'Fail');assert.equal(await p.locator('[data-equipment-field=defects]').first().inputValue(),'Fictional new defect');
 await previewTab('Properties');await p.locator('[data-main-site-history="P001"]').click();assert.match(await p.locator('#main-history').innerText(),/Service overview/);
 await p.locator('[data-main-site-repeat="P001"]').click();
 for(const kind of ['service','pat','lighting','extinguisher']){
  const values=await p.evaluate(kind=>JSON.parse(localStorage.getItem('paramount-fictional-main-v1:device-guest')).drafts[kind].values,kind);
  assert.equal(values.serviceStatus,'In progress');assert.equal(values.engineerSignature,undefined);assert(JSON.parse(values.equipment).every(r=>r.result==='Not Tested'&&r.readings===''&&r.defects===''));
 }
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('paramount-fictional-main-v1:device-guest')).records),preserved);
 await p.locator('[data-main-site-register="P001"]').click();assert.match(await p.locator('#view').innerText(),/PAT-001/);
 await previewTab('Quotes');await p.locator('[data-main-convert]').first().click();assert.equal(await p.locator('[name=source]').inputValue(),'FICTIONAL-Q-001');assert.equal(await p.locator('[name=number]').inputValue(),'');
 await c.close();
 }catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}})();
