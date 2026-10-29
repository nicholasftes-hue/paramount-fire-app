// Route-backed browser checks: no listening socket, cloud, hosting or real customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const root=path.resolve('test-results/fictional-preview');
 for(const width of [320,360,412,1024]){
 const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='fictional.test')return route.abort();const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto('http://fictional.test/index-3.html');await p.waitForFunction(()=>window.ParamountMainApp&&window.ParamountTemplates);
 await p.locator('[data-tab="Service Records"]:visible').first().click();const form=p.locator('form[data-main-form]');
 await form.locator('[name=branding]').selectOption('absolute');await form.locator('[data-template-library]').click();
 await form.locator('[data-template-name]').fill('Fictional mapped certificate');await form.locator('[data-template-company]').selectOption('absolute');
 await form.locator('[data-template-upload]').setInputFiles('test-results/mapped-existing-template.docx');
 await p.waitForFunction(()=>document.querySelector('[data-template-library-panel]')?.textContent.includes('Fictional mapped certificate · v1'));
 const select=form.locator('[name=templateRef]');assert.equal(await select.locator('option').count()>=2,true);
 await select.selectOption({label:'Fictional mapped certificate · v1'});
 await p.reload();await p.waitForFunction(()=>window.ParamountTemplates);await p.locator('[data-tab="Service Records"]:visible').first().click();assert.equal(await p.locator('[name=branding]').inputValue(),'absolute');assert(await p.locator('[name=templateRef]').inputValue());
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fits '+width);assert.deepEqual(errors,[]);
 await p.screenshot({path:'test-results/templates-'+width+'.png',fullPage:true});await context.close();
 }
 console.log('PASS template mobile/desktop upload, branding, assignment, selection and reload');
 }finally{await browser?.close()}})().catch(e=>{console.error(e);process.exitCode=1});
