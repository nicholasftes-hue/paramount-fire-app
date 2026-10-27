// Local fixtures only. Never connects to Supabase or a deployed application.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..'), prefix='/paramount-fire-app/';
const results=[],errors=[], external=[];
const seed={properties:[{id:'TEST001',name:'Test Property',postcode:'BL1 1AA',panel:'C-TEC Conventional',last:'2026-04-21',months:6}],services:[],inventory:[],pat:[],quotes:[],lighting:[],jobs:[],settings:{patRate:'',fireRate:'85',lightingRate:'',vat:'0'}};
let oldWorker=false, serverUnavailable=false;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){res.writeHead(404).end();return}
  const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  if(serverUnavailable&&relative==='index-3.html'){res.writeHead(503).end('temporary outage');return}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  let body=fs.readFileSync(file);
  if(oldWorker&&relative==='service-worker.js')body=Buffer.from(body.toString().replace('paramount-shell-main-app-v7','paramount-shell-academy-test-old'));
  res.end(body);
});

async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS:',name)}
async function ready(page,url){await page.goto(url);await page.locator('#academy[data-academy-ready="true"]').waitFor();await page.waitForFunction(()=>document.querySelector('#view')?.children.length>0)}
async function allSubjects(page){
  if(await page.locator('[data-academy-back]').first().isVisible())await page.locator('[data-academy-back]').first().click();
  if(await page.locator('[data-academy-home]').isVisible())await page.locator('[data-academy-home]').click();
  assert(await page.locator('.academy-grid').isVisible());
}
async function lesson(page,id){
  await allSubjects(page);
  await page.locator(`[data-academy-subject="${id.startsWith('fire')?'fire':'cctv'}"]`).click();
  await page.locator(`[data-academy-lesson="${id}"]`).click();
  await page.locator('#academy-quiz').waitFor();
}
async function quiz(page,answers){for(const [i,value]of answers.entries())await page.locator(`#academy-quiz input[name="q${i}"][value="${value}"]`).check();await page.locator('#academy-quiz button[type="submit"]').click()}
async function offlineReady(page){await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller)}

(async()=>{
  let browser,context;
  try {
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const base=`http://127.0.0.1:${server.address().port}${prefix}`;
    browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}:{});
    async function fresh(options={}){
      const ctx=await browser.newContext(options);
      await ctx.addInitScript(value=>{
        // New pages and print popups may start with an opaque blank origin.
        if(location.protocol==='http:'&&!localStorage.getItem('paramount-demo-v1'))localStorage.setItem('paramount-demo-v1',JSON.stringify(value));
      },seed);
      await ctx.route('https://**/*',route=>{external.push(route.request().url());return route.abort()});
      ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
      return ctx;
    }
    context=await fresh({viewport:{width:1280,height:900}});
    const page=await context.newPage();page.setDefaultTimeout(15000);

    await check('loader opens white main app and Academy without script errors',async()=>{
      await ready(page,base);
      assert.equal(await page.title(),'Paramount Fire Protection | Service Hub');
      assert.equal(await page.locator('.academy-card').count(),6);
      assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    });
    await check('six subject cards, coming-soon paths and return focus',async()=>{
      for(const id of ['fire','cctv','electrical','intruder','lighting','skills']){
        await page.locator(`[data-academy-subject="${id}"] .academy-title`).click();
        assert(await page.locator('#academy-content h3').isVisible());
        assert.equal(await page.locator('#academy-content h3').evaluate(el=>el===document.activeElement),true);
        if(!['fire','cctv'].includes(id)){
          assert.match(await page.locator('#academy-content').innerText(),/Lessons are not available yet/);
          assert.equal(await page.locator('[data-academy-lesson]').count(),0);
        }
        await page.locator('[data-academy-home]').click();
        assert.equal(await page.locator(`[data-academy-subject="${id}"]`).evaluate(el=>el===document.activeElement),true);
      }
    });
    await check('all six quizzes validate missing answers, explain failures, retry and save tab progress',async()=>{
      for(const [id,answers]of Object.entries({'fire-basics':[0,2,1],'fire-ctec':[1,2],'cctv-basics':[1,2,0],'cctv-faults':[2,0], 'fire-servicing':[0,1,2,0,1,2], 'cctv-diagnosis':[1,0,2,1,0,2]})){
        await lesson(page,id);
        await page.locator('#academy-quiz button[type="submit"]').click();
        assert.equal(await page.locator('#academy-result').innerText(),'');
        await quiz(page,answers.map(v=>(v+1)%3));
        assert.match(await page.locator('#academy-result').innerText(),/No new completion was recorded/);
        assert.equal(await page.locator('.academy-feedback').count(),answers.length);
        await quiz(page,answers);
        assert.match(await page.locator('#academy-result').innerText(),/Knowledge check passed/);
        await page.locator('[data-academy-back]').first().click();
        assert.match(await page.locator(`[data-academy-lesson="${id}"]`).innerText(),/Knowledge check passed/);
      }
      assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('paramount-academy-session-v1:guest'))).length),6);
    });
    await check('previous and next lesson buttons and keyboard activation',async()=>{
      await lesson(page,'fire-basics');await page.getByRole('button',{name:'Next lesson →',exact:true}).click();
      assert.match(await page.locator('#academy-content h3').innerText(),/C-TEC/);
      await page.getByRole('button',{name:'Next lesson →',exact:true}).click();
      assert.match(await page.locator('#academy-content h3').innerText(),/Fire alarm servicing/);
      await page.getByRole('button',{name:'Back to learning path',exact:true}).click();
      await lesson(page,'fire-ctec');
      await page.getByRole('button',{name:'← Previous lesson',exact:true}).click();
      assert.match(await page.locator('#academy-content h3').innerText(),/Fire alarms:/);
      await allSubjects(page);
      await page.locator('[data-academy-subject="cctv"]').focus();await page.keyboard.press('Enter');
      assert.match(await page.locator('#academy-content h3').innerText(),/CCTV Systems/);
      await allSubjects(page);await page.locator('[data-academy-subject="fire"]').focus();await page.keyboard.press('Space');
      assert.match(await page.locator('#academy-content h3').innerText(),/Fire Alarm Systems/);
    });
    await check('Academy and return button preserve property draft and stored records',async()=>{
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('paramount-demo-v1'))),seed);
      await page.locator('.home-management [data-tab="Properties"]').click();
      await page.locator('#main-property-form input[name="name"]').fill('Unsaved property draft');
      await lesson(page,'fire-basics');await page.locator('[data-academy-return]').click();
      assert.equal(await page.locator('#main-property-form input[name="name"]').inputValue(),'Unsaved property draft');
      assert.equal(await page.locator('main').evaluate(el=>el===document.activeElement),true);
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('paramount-demo-v1'))),seed);
    });
    await check('existing service, property, PAT, lighting, planner, quote, documents and cloud views open',async()=>{
      for(const name of ['Properties','Service Records','Inventory','PAT Testing','Emergency Lighting','Planner','Quotes','Documents','Cloud Properties','Job Packs']){
        await page.locator(`[data-tab="${name}"]`).click();
        assert((await page.locator('#view').innerText()).length>0);
        if(name==='PAT Testing')await page.locator('form[data-main-form="pat"] input[name="asset"]').waitFor({state:'attached'});
      }
      await page.locator('#packEngineer').fill('Test engineer');await page.locator('#packFire').check();
      await page.locator('[data-make-pack]').click();
      assert.match(await page.locator('#packResult').innerText(),/Ready to review/);
      for(const button of ['data-print-report','data-print-invoice']){
        const popupPromise=page.waitForEvent('popup');await page.locator(`[${button}]`).click();const popup=await popupPromise;
        await popup.waitForLoadState();assert.match(await popup.locator('body').innerText(),/Test Property/);
        assert.match(await popup.locator('body').innerText(),/DRAFT|draft/);await popup.close();
      }
    });
    await check('all four existing Documents links download the exact new templates',async()=>{
      await page.locator('[data-tab="Documents"]').click();
      for(const kind of ['Quotation','Invoice'])for(const ext of ['Editable.docx','Fillable.pdf']){
        const file=`Paramount_${kind}_${ext}`;
        const downloadPromise=page.waitForEvent('download');
        await page.locator(`a[download][href="./templates/${file}"]`).click();
        const download=await downloadPromise;
        assert.equal(download.suggestedFilename(),file);
        assert.equal(await download.failure(),null);
        assert.deepEqual(fs.readFileSync(await download.path()),fs.readFileSync(path.join(root,'templates',file)));
      }
    });
    await check('mobile widths, landscape and keyboard focus fit without horizontal overflow',async()=>{
      for(const viewport of [{width:320,height:568},{width:360,height:800},{width:412,height:915},{width:800,height:360}]){
        await page.setViewportSize(viewport);
        for(const id of ['fire-servicing','cctv-diagnosis']) {
          await lesson(page,id);
          assert.equal(await page.locator('#academy-quiz fieldset').count(),6);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,JSON.stringify(viewport)+id);
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,JSON.stringify(viewport));
        const first=page.locator('#academy-quiz input').first();await first.focus();await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator('#academy-quiz input[name="q0"]:checked').count(),1);
        await page.screenshot({path:`test-results/academy-${viewport.width}.png`,fullPage:true});
      }
    });
    await check('offline reload from loader and versioned assets, icons and quizzes work',async()=>{
      await offlineReady(page);await context.setOffline(true);await page.reload();
      await page.locator('[data-academy-subject="fire"]').waitFor();await lesson(page,'fire-basics');
      assert.match(await page.locator('#academy-quiz').innerText(),/Knowledge check/);
      assert.equal(await page.evaluate(async()=>{const r=await fetch('./icon-192.png');return r.ok&&(await r.blob()).size>0}),true);
      await page.goto(base+'academy-test.html');
      await page.locator('#academy[data-academy-ready="true"]').waitFor();
      await lesson(page,'cctv-diagnosis');await quiz(page,[1,0,2,1,0,2]);assert.match(await page.locator('#academy-result').innerText(),/Knowledge check passed/);
      await lesson(page,'fire-servicing');await quiz(page,[0,1,2,0,1,2]);assert.match(await page.locator('#academy-result').innerText(),/Knowledge check passed/);
      for(const kind of ['Quotation','Invoice'])for(const ext of ['Editable.docx','Fillable.pdf']){
        const file=`templates/Paramount_${kind}_${ext}`;
        const downloaded=await page.evaluate(async file=>{const r=await fetch('./'+file);return {ok:r.ok,bytes:Array.from(new Uint8Array(await r.arrayBuffer()))}},file);
        assert(downloaded.ok);assert.deepEqual(Buffer.from(downloaded.bytes),fs.readFileSync(path.join(root,file)));
      }
      await page.goto(base);await page.locator('#academy[data-academy-ready="true"]').waitFor();
      await context.setOffline(false);
    });
    await check('HTTP 503 falls back to the cached white dashboard',async()=>{
      serverUnavailable=true;
      try{await page.reload();await page.locator('[data-academy-subject="fire"]').waitFor()}finally{serverUnavailable=false}
    });
    await check('new browser session has no completed Academy knowledge checks',async()=>{
      const clean=await fresh();try{const p=await clean.newPage();await ready(p,base+'index-3.html');await p.locator('[data-academy-subject="fire"]').click();assert.doesNotMatch(await p.locator('#academy-content').innerText(),/Knowledge check passed/)}finally{await clean.close()}
    });
    await check('standalone Academy opens six subjects and six working quizzes without registering a worker',async()=>{
      const ctx=await fresh();
      try{
        const p=await ctx.newPage();await p.goto(base+'academy-test.html');await p.locator('#academy[data-academy-ready="true"]').waitFor();
        assert.match(await p.locator('#academy-status').innerText(),/Academy ready/);
        assert.equal(await p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())),false);
        for(const id of ['fire','cctv','electrical','intruder','lighting','skills']){
          await p.locator(`[data-academy-subject="${id}"]`).click();assert(await p.locator('#academy-content h3').isVisible());await allSubjects(p);
        }
        for(const [id,answers]of Object.entries({'fire-basics':[0,2,1],'fire-ctec':[1,2],'cctv-basics':[1,2,0],'cctv-faults':[2,0], 'fire-servicing':[0,1,2,0,1,2], 'cctv-diagnosis':[1,0,2,1,0,2]})){
          await lesson(p,id);await quiz(p,answers);assert.match(await p.locator('#academy-result').innerText(),/Knowledge check passed/);
        }
      }finally{await ctx.close()}
    });
    await check('script-load failures show a recoverable message without replacing the main app',async()=>{
      for(const entry of ['index.html','index-3.html','academy-test.html']){
        const ctx=await fresh({serviceWorkers:'block'});
        try{
          await ctx.route('**/academy.js?*',route=>route.abort());
          const p=await ctx.newPage();await p.goto(base+entry);
          await p.waitForFunction(()=>/could not load|failed to load/i.test(document.getElementById('academy-status')?.textContent||''));
          if(entry!=='academy-test.html'){
            assert(await p.locator('.home-hero').isVisible());await p.locator('.home-management [data-tab="Properties"]').click();assert(await p.locator('#main-property-form').isVisible());
          }
          await ctx.unroute('**/academy.js?*');await p.reload();await p.locator('#academy[data-academy-ready="true"]').waitFor();
          await p.locator('[data-academy-subject="fire"]').click();assert(await p.locator('#academy-content h3').isVisible());
        }finally{await ctx.close()}
      }
    });
    await context.close();context=null;
    await check('service-worker update waits for approval and cancelled update preserves a draft',async()=>{
      oldWorker=true;const ctx=await fresh();
      try{
        const p=await ctx.newPage();await ready(p,base);await offlineReady(p);
        await p.locator('.home-management [data-tab="Properties"]').click();await p.locator('input[name="name"]').fill('Keep this draft');
        oldWorker=false;await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
        await p.locator('#app-update button').waitFor();
        p.once('dialog',dialog=>dialog.dismiss());await p.locator('#app-update button').click();
        assert.equal(await p.locator('input[name="name"]').inputValue(),'Keep this draft');
        p.once('dialog',dialog=>dialog.accept());await p.locator('#app-update button').click();
        await p.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('paramount-shell-main-app-v7')&&!keys.includes('paramount-shell-academy-test-old')});
        await p.locator('[data-academy-subject="fire"]').waitFor();
      }finally{oldWorker=false;await ctx.close()}
    });
    assert.deepEqual(external,[],'Unexpected external requests; no live services should be called');
    assert.deepEqual(errors,[],'Browser JavaScript errors');
    console.log(`PASS: ${results.length} browser scenarios; no live service calls or browser errors`);
  }catch(error){results.push({name:'browser run',status:'failed',error:error.stack});console.error(error);process.exitCode=1}
  finally{
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    fs.writeFileSync(path.join(root,'test-results/browser-results.json'),JSON.stringify({results,errors,external},null,2));
    if(context)await context.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})();


