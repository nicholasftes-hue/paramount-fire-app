// No external service is contacted. The mock REST boundary is loopback-only.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),rows=new Map(),ops=new Map(),users=[randomUUID(),randomUUID(),randomUUID()],workspace=randomUUID(),errors=[],external=[];
let offline=false,denied=false;
const server=http.createServer((req,res)=>{const p=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404).end();return}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p))});
(async()=>{let browser;try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  async function staff(n){
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:360,height:800}});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===origin)return route.continue();
      if(url.origin!=='http://127.0.0.1:54321'){external.push(url.origin);return route.abort()}
      if(offline)return route.abort();
      const p=request.postDataJSON();
      if(url.pathname==='/auth/v1/token')return route.fulfill({json:{user:{id:users[n]},access_token:'fictional-'+n}});
      if(denied)return route.fulfill({status:403,json:{message:'DO NOT DISPLAY sensitive upstream details'}});
      if(url.pathname.endsWith('_list'))return route.fulfill({json:[...rows.values()]});
      if(url.pathname.endsWith('_write')){
        if(ops.has(p.p_operation))return route.fulfill({json:ops.get(p.p_operation)});
        const old=rows.get(p.p_id);if((old?.version||0)!==p.p_expected)return route.fulfill({status:409,json:{}});
        const r={id:p.p_id,kind:p.p_kind,property_id:p.p_property,payload:p.p_payload,version:p.p_expected+1};rows.set(r.id,r);ops.set(p.p_operation,r);return route.fulfill({json:r});
      }
      throw Error('Unexpected test endpoint '+url.pathname);
    });
    const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('TEST PAGE ERROR:',e.message)});page.on('dialog',d=>d.accept());
    await page.addInitScript(()=>{localStorage.setItem('paramount-demo-v1',JSON.stringify({properties:[{id:'NEVER-UPLOAD',name:'Private legacy fixture'}],services:[],inventory:[],pat:[],quotes:[],lighting:[],jobs:[],settings:{}}))});
    await page.goto(origin+'/team-sync-test.html');await page.waitForFunction(()=>!!window.ParamountMainApp);
    await page.locator('#team-config').setInputFiles({name:'isolated.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({mode:'isolated-test',url:'http://127.0.0.1:54321',publicKey:'sb_publishable_fixture',workspace}))});
    await page.locator('#team-status').filter({hasText:'Test configuration loaded'}).waitFor();
    await page.locator('#team-login [name=email]').fill('staff'+n+'@example.invalid');await page.locator('#team-login [name=password]').fill('fictional');await page.locator('#team-login button').click();try{await page.locator('#team-status').filter({hasText:'Sync complete'}).waitFor()}catch(error){console.error('Fictional test sign-in status:',await page.locator('#team-sync').innerText());throw error};
    return {context,page};
  }
  const a=await staff(0),b=await staff(1),c=await staff(2);
  async function tab(page,name){await page.locator(`#tabs [data-tab="${name}"]`).click()}
  async function sync(page){await page.locator('#team-now').click();await page.locator('#team-status').filter({hasText:'Sync complete'}).waitFor()}
  await a.page.locator('#main-property-form [name=name]').fill('Fictional shared site');await a.page.locator('#main-property-form [name=panel]').fill('TEST');await a.page.locator('#main-property-form [name=last]').fill('2026-10-27');await a.page.locator('#main-property-form button[type=submit]').click();await sync(a.page);
  const property=[...rows.keys()][0];assert.equal(rows.size,1);assert(!JSON.stringify([...rows.values()]).includes('Private legacy'));
  const values={service:{engineer:'Fixture',system:'TEST',standard:'TEST',tests:'Fixture results',battery:'Not inspected',measurements:'Not measured fixture',defects:'Fixture',actions:'Fixture',recipient:'Fixture',declaration:'Fixture'},pat:{engineer:'Fixture',instrument:'TEST',calibration:'TEST',asset:'A001',appliance:'Kettle',location:'Kitchen',equipmentClass:'Class I',visual:'Fixture',tests:'Fixture readings',outcome:'Pass within recorded test scope',defects:'Fixture'},lighting:{engineer:'Fixture',system:'L1',location:'Hall',testType:'Duration test',duration:'180',tests:'Fixture readings',defects:'Fixture',actions:'Fixture'}};
  for(const [kind,title]of [['service','Service Records'],['pat','PAT Testing'],['lighting','Emergency Lighting']]){
    await tab(a.page,title);await a.page.locator('form[data-main-form]').evaluate((form,v)=>{for(const [k,value]of Object.entries(v))form.elements.namedItem(k).value=value;form.dispatchEvent(new Event('input',{bubbles:true}));form.elements.reviewed.checked=true},{property,date:'2026-10-27',...values[kind]});
    await a.page.locator('form[data-main-form] button[type=submit]').first().click();await sync(a.page);
  }
  for(const p of [b.page,c.page]){await sync(p);await tab(p,'Service Records');assert.equal(await p.locator('.main-record').count(),1);await tab(p,'PAT Testing');assert.equal(await p.locator('.main-record').count(),1);await tab(p,'Emergency Lighting');assert.equal(await p.locator('.main-record').count(),1)}
  assert.equal(rows.size,4);
  offline=true;await tab(a.page,'Properties');await a.page.locator('[data-main-property-edit]').click();await a.page.locator('#main-property-form [name=name]').fill('Offline revision');await a.page.locator('#main-property-form button[type=submit]').click();await a.page.locator('#team-now').click();await a.page.locator('#team-status').filter({hasText:'Cloud unavailable'}).waitFor();assert.equal(rows.get(property).payload.name,'Fictional shared site');
  offline=false;await sync(a.page);assert.equal(rows.get(property).payload.name,'Offline revision');await sync(b.page);
  // Two reviewed edits from the same server base become a visible conflict.
  for(const [p,name]of [[a.page,'Staff A'],[b.page,'Staff B']]){await tab(p,'Properties');await p.locator('[data-main-property-edit]').click();await p.locator('#main-property-form [name=name]').fill(name);await p.locator('#main-property-form button[type=submit]').click()}
  await sync(a.page);await sync(b.page);await b.page.locator('#team-sync details summary').click();assert.match(await b.page.locator('#team-sync details').innerText(),/Staff A/);assert.match(await b.page.locator('#team-sync details').innerText(),/Staff B/);await b.page.locator('[data-choice=cloud]').click();
  denied=true;await a.page.locator('#team-now').click();await a.page.locator('#team-status').filter({hasText:'Staff access is unavailable'}).waitFor();assert(!await a.page.locator('#team-status').innerText().then(t=>t.includes('sensitive')));denied=false;
  // A second tab cannot acquire the same editing lock.
  const second=await a.context.newPage();await second.goto(origin+'/team-sync-test.html');await second.waitForFunction(()=>!!window.ParamountMainApp);await second.locator('#team-config').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({mode:'isolated-test',url:'http://127.0.0.1:54321',publicKey:'sb_publishable_fixture',workspace}))});await second.locator('#team-offline').click();await second.locator('#team-status').filter({hasText:'another tab'}).waitFor();await second.close();
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/team-sync-browser.json',JSON.stringify({passed:true,scenarios:['three staff/four kinds','no legacy upload','offline queue/reconnect','conflict review','access denied/redaction','exclusive tab lock'],external,errors},null,2));
  console.log('PASS: isolated team sync browser scenarios');
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}})();
