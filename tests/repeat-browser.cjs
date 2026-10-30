// Fictional local fixtures; no production services are permitted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),errors=[];
const server=http.createServer((req,res)=>{const f=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))});
(async()=>{let browser;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const c=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'});
 await c.route('https://**/*',r=>r.abort());const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.waitForFunction(()=>!!window.ParamountMainApp);
 const tab=async n=>p.locator(`[data-tab="${n}"]:visible`).first().click();
 await tab('PAT Testing');
 await p.locator('form[data-main-form]').evaluate(f=>{for(const [k,v]of Object.entries({property:'P001',engineer:'Fictional tester',instrument:'Instrument TEST',calibration:'Fictional current check',serviceStatus:'Completed',testState:'Tested within recorded scope'}))f.elements[k].value=v;f.dispatchEvent(new Event('input',{bubbles:true}))});
 await p.locator('[data-equipment-field="description"]').fill('Kettle');await p.locator('[data-equipment-field="location"]').fill('Kitchen');await p.locator('[data-equipment-field="specification"]').fill('Class I');await p.locator('[data-equipment-field="result"]').selectOption('Pass');await p.locator('[data-equipment-field="readings"]').fill('0.12 ohm');
 await p.locator('[data-equipment-identical]').click();assert.equal(await p.locator('[data-equipment-field="id"]').count(),2);assert.equal(await p.locator('[data-equipment-field="result"]').nth(1).inputValue(),'Not Tested');await p.locator('[data-equipment-field="result"]').nth(1).selectOption('Pass');
 await p.locator('[name=reviewed]').check();await p.locator('form[data-main-form] button[type=submit]').first().click();await p.waitForFunction(()=>document.querySelector('#main-status').textContent.startsWith('Draft saved'));
 const original=await p.evaluate(()=>JSON.parse(localStorage.getItem('paramount-main-app-v1:device-guest')).records);
 await p.locator('form[data-main-form] [name=property]').selectOption('P001');
 await p.locator('[data-main-repeat="pat"]').click();assert.equal(await p.locator('[data-equipment-field="id"]').count(),2);
 for(let i=0;i<2;i++){assert.equal(await p.locator('[data-equipment-field="result"]').nth(i).inputValue(),'Not Tested');assert.equal(await p.locator('[data-equipment-field="readings"]').nth(i).inputValue(),'')}
 assert.equal(await p.locator('[name=engineerSignature]').inputValue(),'');
 await p.locator('[data-equipment-remove]').last().click();await p.locator('[data-equipment-field="description"]').fill('Edited appliance');
 await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);await tab('PAT Testing');assert.equal(await p.locator('[data-equipment-field="description"]').inputValue(),'Edited appliance');
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('paramount-main-app-v1:device-guest')).records),original);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS batch entry, identical assets, repeat resets, remove, local draft resume, old records unchanged, 360px layout');
 }catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}})();
