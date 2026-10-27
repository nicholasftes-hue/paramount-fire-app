// Fictional device-only records; every external request is aborted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),results=[],errors=[],external=[];
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))});
(async()=>{let browser;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 fs.mkdirSync('test-results',{recursive:true});
 for(const viewport of [{width:320,height:568},{width:360,height:800},{width:412,height:915},{width:800,height:360}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route('https://**/*',route=>{external.push(route.request().url());return route.abort()});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.waitForFunction(()=>!!window.ParamountMainApp&&!!window.ParamountPdfFont);
 const tab=async name=>{await p.locator(`[data-tab="${name}"]:visible`).first().click();await p.locator('.main-app').waitFor();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits '+viewport.width)};
 const fill=async values=>{await p.locator('form[data-main-form]').evaluate((form,values)=>{for(const [k,v]of Object.entries(values)){form.elements.namedItem(k).value=v}form.dispatchEvent(new Event('input',{bubbles:true}));form.elements.reviewed.checked=true},values)};
 const save=async(next=false)=>{await p.locator(next?'button[name=continueAppliance]':'form[data-main-form] button[type=submit]').first().click();await p.waitForFunction(()=>document.querySelector('#main-status')?.textContent.startsWith('Draft saved'))};
 const pdf=async(selector,name)=>{const waiting=p.waitForEvent('download');await p.locator(selector).first().click();const file=await waiting;await file.saveAs(`test-results/${name}-${viewport.width}.pdf`);assert.match(fs.readFileSync(await file.path(),'utf8'),/^%PDF-1.4/)};
 const common={property:'P001',date:'2026-10-27',engineer:'Zoë — Ω',engineerSignature:'Zoë',engineerSigned:'2026-10-27',customerName:'José',customerSignature:'José',customerSigned:'2026-10-27'};
 await tab('Service Records');await fill({...common,system:'Fictional panel',standard:'TEST scope — competent review pending',tests:'Fictional: ✓ £ Ω ≥ MΩ — café',battery:'Not inspected',measurements:'Fictional values only',defects:'<script>fixture</script>',actions:'Fictional handover',recipient:'José',declaration:'Fictional draft only'});await save();await pdf('[data-main-pdf]','certificate');
 const popupWait=p.waitForEvent('popup');await p.locator('[data-main-print]').click();const popup=await popupWait;await popup.waitForLoadState();const text=await popup.locator('body').innerText();assert.match(text,/Fire alarm service certificate — DRAFT/);assert.match(text,/Customer signature \(typed\): José/);assert.equal(await popup.locator('.certificate script').count(),0);await popup.close();
 await tab('PAT Testing');await p.locator('[data-main-appliance="Kettle"]').click();assert.equal(await p.locator('[name=appliance]').inputValue(),'Kettle');assert.equal(await p.locator('[name=outcome]').inputValue(),'');
 await fill({...common,instrument:'Fictional instrument',calibration:'TEST reference',asset:'K009',location:'Kitchen',equipmentClass:'Class I',visual:'Fictional visual check',tests:'0.12 Ω; ≥2 MΩ; ✓',outcome:'Pass within recorded test scope',defects:'Fictional only'});await save(true);
 assert.equal(await p.locator('[name=asset]').inputValue(),'K010');assert.equal(await p.locator('[name=instrument]').inputValue(),'Fictional instrument');for(const k of ['tests','outcome','visual','engineerSignature','customerSignature'])assert.equal(await p.locator(`[name=${k}]`).inputValue(),'');assert.equal(await p.locator('[name=reviewed]').isChecked(),false);
 await p.locator('[data-main-appliance="Toaster"]').click();await fill({equipmentClass:'Class I',visual:'Fictional damage',tests:'Not energised — visual failure',outcome:'Fail / unsafe — action required',defects:'Fictional isolation advice'});await save();assert.equal(await p.locator('.main-record').count(),2);
 await p.locator('form [name=property]').selectOption('P001');await pdf('[data-main-report]','pat-register');
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('PAT Testing');assert.equal(await p.locator('.main-record').count(),2);
 await p.locator('[data-main-edit]').last().click();assert.equal(await p.locator('[name=customerSignature]').inputValue(),'José');await fill({defects:'Reviewed fictional revision'});await save();assert.match(await p.locator('.main-record').first().innerText(),/revision 2/);
 await tab('Emergency Lighting');await fill({...common,system:'Fictional L1',location:'Hall',testType:'Duration test',duration:'',tests:'Fictional observation',defects:'Fictional defect',actions:'Fictional notification',outcome:'Defective / action required',restoration:'Fictional supply restored / charge indicator on'});
 await p.locator('form button[type=submit]').click();assert.match(await p.locator('#main-status').innerText(),/actual observed duration/);assert.equal(await p.locator('.main-record').count(),0);
 await fill({duration:'180'});await save();await pdf('[data-main-pdf]','lighting');await p.locator('form [name=property]').selectOption('P001');await pdf('[data-main-report]','lighting-register');
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('Emergency Lighting');await p.locator('[data-main-edit]').click();assert.equal(await p.locator('[name=duration]').inputValue(),'180');assert.equal(await p.locator('[name=customerSignature]').inputValue(),'José');assert.equal(await p.locator('[name=reviewed]').isChecked(),false);
 await p.screenshot({path:`test-results/certificates-${viewport.width}.png`,fullPage:true});results.push({viewport,status:'passed'});console.log('PASS: draft certificates, PAT quick-entry / register, lighting, signatures, revisions, reload and downloads at',viewport.width);await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }catch(e){results.push({status:'failed',message:e.stack});throw e}finally{fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/certificates-browser-results.json',JSON.stringify({results,errors,external},null,2));await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
