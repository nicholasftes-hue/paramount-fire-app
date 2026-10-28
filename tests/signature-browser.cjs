// Fictional customer capability only. No real service, hosted user or customer contacted.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{randomUUID,createHash}=require('node:crypto');
const frozen={scope:'Test scope only',payload:{values:{tests:'<img src=x onerror="window.injected=true">',defects:'Fictional limitation'},siteSnapshot:{name:'Fictional site'}}},canonical=JSON.stringify(frozen);
const root=path.resolve(__dirname,'..'),token='a'.repeat(64),digest=createHash('sha256').update(canonical).digest('hex'),errors=[],external=[],requests=[];
let signed=false,denied=false;
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))});
(async()=>{let browser;try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:360,height:800}});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===origin){assert(!url.search.includes(token)&&!url.hash.includes(token));return route.continue()}
  if(url.origin!=='http://127.0.0.1:54321'){external.push(url.origin);return route.abort()}
  const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'apikey, content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const body=req.postDataJSON();requests.push({path:url.pathname,body});assert.equal(body.p_token,token);assert(!req.url().includes(token));
  if(denied)return route.fulfill({status:403,headers,json:{message:'SENSITIVE INTERNAL DETAILS'}});
  if(url.pathname.endsWith('_accept')){assert.equal(body.p_digest,digest);assert.equal(body.p_consent,'Acknowledge fictional scope');assert.equal(body.p_name,'Test Customer');assert(!signed);signed=true}
  else assert(url.pathname.endsWith('_read'));
  return route.fulfill({headers,json:{canonical_document:canonical,issue:randomUUID(),sequence:1,digest,kind:'service',values:{tests:'<img src=x onerror="window.injected=true">',defects:'Fictional limitation'},site:{name:'Fictional site'},approved_at:'2026-10-28T12:00:00Z',scope:'Test scope only',consent:'Acknowledge fictional scope',expires_at:'2026-11-01T12:00:00Z',signed_at:signed?'2026-10-28T13:00:00Z':null,signer_name:signed?'Test Customer':null}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/signature-test.html#token='+token);
 assert.equal(new URL(page.url()).hash,'');assert.equal(await page.locator('#signature-token').inputValue(),token);assert.equal(requests.length,0);
 const config={mode:'isolated-test',url:'http://127.0.0.1:54321',workspace:randomUUID(),publicKey:'sb_publishable_fixture'};
 await page.locator('#signature-config').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))});
 await page.locator('#signature-open button').click();await page.locator('#signature-accept').waitFor();
 assert.match(await page.locator('#signature-document').innerText(),/<img src=x/);assert.equal(await page.locator('#signature-document img').count(),0);
 assert.match(await page.locator('#signature-consent').innerText(),/fictional scope/);
 await page.locator('[name=signer]').fill('Test Customer');await page.locator('#signature-accept button').click();assert.equal(requests.length,1);
 await page.locator('[name=consent]').check();await page.locator('#signature-accept button').click();await page.locator('#signature-status').filter({hasText:'Acknowledged by Test Customer'}).waitFor();assert.equal(requests.length,2);assert(await page.locator('#signature-accept').isHidden());
 const downloading=page.waitForEvent('download');await page.locator('#signature-receipt').click();const download=await downloading;
 fs.mkdirSync('test-results',{recursive:true});await download.saveAs('test-results/signature-receipt.json');const receipt=JSON.parse(fs.readFileSync('test-results/signature-receipt.json','utf8'));
 assert.equal(receipt.digest,digest);assert.equal(receipt.signer_name,'Test Customer');assert(!JSON.stringify(receipt).includes(token));
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await page.locator('#signature-close').click();assert.equal(await page.locator('#signature-document').innerText(),'');assert.equal(await page.locator('#signature-token').inputValue(),'');
 denied=true;await page.locator('#signature-token').fill(token);await page.locator('#signature-open button').click();await page.locator('#signature-status').filter({hasText:'Record unavailable'}).waitFor();assert(!await page.locator('body').innerText().then(t=>t.includes('SENSITIVE')));assert(await page.locator('#signature-accept').isHidden());
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/signature-browser.json',JSON.stringify({passed:true,scenarios:['no automatic requests','fragment removal','token POST only','escaped record','explicit consent','single acknowledgement receipt','no browser storage','clear and redacted denial'],external,errors},null,2));
 console.log('PASS: isolated customer acknowledgement browser scenarios');
}catch(error){console.error(error);process.exitCode=1}finally{await browser?.close();server.close()}})();
