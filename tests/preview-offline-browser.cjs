// Actual Chrome offline/mobile checks, confined to the generated fictional demo.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),errors=[],external=[],results=[];
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))});
(async()=>{let browser,ctx;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});ctx=await browser.newContext();
 await ctx.route('https://**/*',r=>{external.push(r.request().url());return r.abort()});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.waitForFunction(()=>!!window.ParamountMainApp);
 assert.match(await p.locator('body').innerText(),/FICTIONAL DATA ONLY/);assert.equal(await p.locator('input[type=password]').count(),0);
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.ParamountMainApp);
 results.push('first online load installs offline shell');
 await ctx.setOffline(true);await p.reload();await p.waitForFunction(()=>!!window.ParamountMainApp);
 for(const v of [{width:320,height:568},{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:844,height:390}]){
  await p.setViewportSize(v);
  for(const name of ['Dashboard','Properties','Service Records','PAT Testing','Emergency Lighting','Extinguishers','Installation Forms','Quotes','Invoices','Planner','Call-outs','Office','Drawing Studio','Equipment Library','Property History','Equipment Registers','Documents','Inventory','Job Packs','Record Backup']){
   if(name!=='Dashboard'||!await p.locator('.main-hero').isVisible())await p.locator(`[data-tab="${name}"]:visible`).first().click();await p.locator('#view').waitFor();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${v.width}`);
  }
 }
 results.push('offline navigation fits 320/360/390/412px and landscape');
 await p.locator('[data-academy-subject="fire"]').click();await p.locator('[data-academy-lesson="fire-servicing"]').click();await p.locator('#academy-quiz').waitFor();
 results.push('Academy servicing lesson and quiz open offline');
 await p.locator('[data-tab="Documents"]:visible').first().click();
 for(const name of ['Paramount_Quotation_Editable.docx','Paramount_Quotation_Fillable.pdf','Paramount_Invoice_Editable.docx','Paramount_Invoice_Fillable.pdf']){const pending=p.waitForEvent('download');await p.locator('a[href="./templates/'+name+'"]').click();const file=await pending;assert.deepEqual(fs.readFileSync(await file.path()),fs.readFileSync(path.join(root,'templates',name)))}
 results.push('all four blank templates download byte-for-byte offline');
 await p.locator('[data-tab="Service Records"]:visible').first().click();await p.locator('form[data-main-form] [name=engineer]').fill('Fictional unfinished reset test');
 await p.evaluate(()=>localStorage.setItem('unrelated-preview-test','preserve'));
 await Promise.all([p.waitForNavigation(),p.locator('#demo-reset').click()]);await p.waitForFunction(()=>!!window.ParamountMainApp);
 assert.equal(await p.evaluate(()=>localStorage.getItem('paramount-preview-workspace-69c45d4-v2:device-guest')),null);assert.equal(await p.evaluate(()=>localStorage.getItem('unrelated-preview-test')),'preserve');
 await p.locator('[data-tab="Service Records"]:visible').first().click();assert.equal(await p.locator('form[data-main-form] [name=engineer]').inputValue(),'');assert.equal(await p.locator('[data-main-dictate]').count(),0);
 results.push('reset clears unfinished forms without resurrecting them; unrelated storage survives; voice controls absent');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS:',results.join('; '));
 }catch(e){console.error(e);process.exitCode=1;results.push(e.stack)}finally{fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/demo-offline-browser.json',JSON.stringify({results,errors,external},null,2));if(ctx)await ctx.close();if(browser)await browser.close();await new Promise(r=>server.close(r))}
})();

