const {test}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),fs=require('node:fs'),vm=require('node:vm');
test('unhosted fictional preview parses, preserves print templates and contains no production cloud target',()=>{
 execFileSync('python3',['scripts/prepare-fictional-preview.py'],{stdio:'inherit'});const html=fs.readFileSync('test-results/fictional-preview/index-3.html','utf8');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
 assert.equal((html.match(/FICTIONAL DATA PREVIEW/g)||[]).length,1);assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src 'none'/);assert.match(html,/CLOUD_KEY='FICTIONAL-NO-CREDENTIAL'/);assert.doesNotMatch(html,/https:\/\/[^'"\s]+\.supabase\.co/);assert.match(html,/paramount-fictional-preview-v1/);assert.doesNotMatch(fs.readFileSync('test-results/fictional-preview/main-app.js','utf8'),/paramount-main-app-v1:/);assert(fs.existsSync('test-results/fictional-preview/templates/Paramount_Quotation_Editable.docx'));
});
test('fictional preview seeds four independent untested registers, preserves history and packages every asset',()=>{
 const html=fs.readFileSync('test-results/fictional-preview/index-3.html','utf8'),storage=new Map();
 const seed=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('paramount-fictional-main-v1:device-guest'));
 vm.runInNewContext(seed[1],{localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
 const data=JSON.parse(storage.get('paramount-fictional-main-v1:device-guest'));
 assert.equal(data.records.length,6);
 for(const kind of ['service','pat','lighting','extinguisher']){
  const v=data.drafts[kind].values;assert.equal(v.reviewed,'');assert.equal(v.engineerSignature,undefined);assert.equal(v.serviceStatus,'In progress');
  for(const row of JSON.parse(v.equipment)){assert.equal(row.result,'Not Tested');assert.equal(row.readings,'');assert.equal(row.defects,'')}
 }
 const original=storage.get('paramount-fictional-main-v1:device-guest');vm.runInNewContext(seed[1],{localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});assert.equal(storage.get('paramount-fictional-main-v1:device-guest'),original);
 const crypto=require('node:crypto'),manifest=JSON.parse(fs.readFileSync('test-results/fictional-preview/SHA256SUMS.json'));
 for(const [file,hash]of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('test-results/fictional-preview/'+file)).digest('hex'),hash);
 assert(fs.statSync('test-results/paramount-fictional-preview.zip').size>100000);
 assert.doesNotMatch(html,/['"]paramount-cloud-session['"]/);
 assert.doesNotMatch(fs.readFileSync('test-results/fictional-preview/academy.js','utf8'),/['"]paramount-academy-session-v1:/);
 for(const asset of ['manifest.webmanifest','academy-test.html'])assert(fs.existsSync('test-results/fictional-preview/'+asset));
});
