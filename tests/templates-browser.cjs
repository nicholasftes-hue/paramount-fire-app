// Route-backed browser checks: no listening socket, cloud, hosting or real customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const root=path.resolve('test-results/fictional-preview');
 for(const width of [320,360,412,1024]){
 const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='localhost')return route.abort();const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto('http://localhost/index-3.html');assert(await p.evaluate(()=>isSecureContext&&!!crypto.subtle&&!!crypto.randomUUID),'template test requires a trustworthy local origin');await p.waitForFunction(()=>window.ParamountMainApp&&window.ParamountTemplates);
 await p.locator('[data-tab="Service Records"]:visible').first().click();const form=p.locator('form[data-main-form]');
 await form.locator('[name=branding]').selectOption('absolute');await form.locator('[data-template-library]').click();
 await form.locator('[data-template-name]').fill('Fictional mapped certificate');await form.locator('[data-template-company]').selectOption('absolute');
 await form.locator('[data-template-upload]').setInputFiles('test-results/mapped-existing-template.docx');
 await p.waitForFunction(()=>document.querySelector('[data-template-library-panel]')?.textContent.includes('Fictional mapped certificate · v1'));
 const select=form.locator('[name=templateRef]');assert.equal(await select.locator('option').count()>=2,true);
 await select.selectOption({label:'Fictional mapped certificate · v1'});
 await p.reload();await p.waitForFunction(()=>window.ParamountTemplates);await p.locator('[data-tab="Service Records"]:visible').first().click();assert.equal(await p.locator('[name=branding]').inputValue(),'absolute');assert(await p.locator('[name=templateRef]').inputValue());
 await form.locator('[data-template-library]').click();await form.locator('[data-template-name]').fill('Fictional PDF blank');await form.locator('[data-template-company]').selectOption('absolute');await form.locator('[data-template-upload]').setInputFiles('test-results/imported-blank.pdf');
 await p.waitForFunction(()=>document.querySelector('[data-template-library-panel]')?.textContent.includes('Fictional PDF blank · v1'));
 const article=form.locator('article').filter({hasText:'Fictional PDF blank · v1'});await article.locator('[data-pdf-map-name]').fill('Engineer mapping');await article.locator('[data-pdf-map-field="Engineer"]').selectOption('engineer');await article.locator('[data-pdf-map-save]').click();await p.waitForFunction(()=>document.getElementById('main-status')?.textContent.includes('Mapping saved.'));
 await form.locator('[name=templateRef]').selectOption({label:'Fictional PDF blank · v1'});await form.locator('[name=templateMappingRef]').selectOption({label:'Engineer mapping'});const pinned=await form.locator('[name=templateMappingRef]').inputValue();assert(pinned);
 await p.reload();await p.waitForFunction(()=>window.ParamountTemplates);await p.locator('[data-tab="Service Records"]:visible').first().click();assert.equal(await form.locator('[name=templateMappingRef]').inputValue(),pinned);
 const downloadEvent=p.waitForEvent('download');await p.evaluate(async()=>{const form=document.querySelector('form[data-main-form]');await ParamountTemplates.downloadFor({id:'FICTIONAL-PDF',revision:1,values:{templateRef:form.elements.templateRef.value,templateMappingRef:form.elements.templateMappingRef.value,branding:'absolute',engineer:'Fictional Engineer'}},form.dataset.mainScope)});const download=await downloadEvent;assert.equal(download.suggestedFilename(),'DRAFT-FICTIONAL-PDF-r1.pdf');await download.saveAs('test-results/browser-imported-pdf-'+width+'.pdf');
 await form.locator('[name=branding]').selectOption('paramount');assert.equal(await form.locator('[name=templateRef]').inputValue(),'');assert.equal(await form.locator('[name=templateMappingRef]').inputValue(),'');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fits '+width);assert.deepEqual(errors,[]);
 await p.screenshot({path:'test-results/templates-'+width+'.png',fullPage:true});await context.close();
 }
 console.log('PASS template mobile/desktop upload, branding, assignment, selection, PDF mapping, mapped download and reload');
 }finally{await browser?.close()}})().catch(e=>{console.error(e);process.exitCode=1});
