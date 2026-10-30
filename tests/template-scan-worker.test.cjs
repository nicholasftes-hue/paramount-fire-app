const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {settings,tick}=require('../server/template-scan-worker.cjs');
test('scan worker rejects production and missing configuration',()=>{for(const env of [{},{PARAMOUNT_ISOLATED_SCAN:'yes',PARAMOUNT_TEST_URL:'https://ehlfgmfjzwfsudowaxku.supabase.co',PARAMOUNT_TEST_PROJECT_REF:'ehlfgmfjzwfsudowaxku',PARAMOUNT_SCAN_KEY:'fixture',PARAMOUNT_QUARANTINE_DIR:'/private'}])assert.throws(()=>settings(env));});
test('scan claim binds exact hash and lease; scanner failures and substitutions block',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scan-worker-'));try{
 const bytes=Buffer.from('%PDF-fixture'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 for(const mode of ['clean','infected','missing','tampered','lease']){
 let finished,scanCalls=0;const job={workspace:'fixture',hash,format:'pdf',lease:'lease',content:bytes.toString('base64')};
 const fetcher=async(url,o)=>{if(url.endsWith('claim'))return {ok:true,json:async()=>job};finished=JSON.parse(o.body);return {ok:true,json:async()=>mode!=='lease'};};
 const scanner=async input=>{scanCalls++;assert.deepEqual(fs.readFileSync(input),bytes);if(['infected','missing'].includes(mode))throw Error(mode);return {verdict:'clean',structuralInspection:true,sha256:mode==='tampered'?'0'.repeat(64):hash,format:'pdf',fields:['test']};};
 if(mode==='lease')await assert.rejects(()=>tick({directory,url:'https://fixture.supabase.co',key:'fixture'},fetcher,scanner),/lease/);
 else assert.equal(await tick({directory,url:'https://fixture.supabase.co',key:'fixture'},fetcher,scanner),mode==='clean');
 assert.equal(scanCalls,1);assert.equal(finished.p_clean,['clean','lease'].includes(mode));assert.equal(finished.p_hash,hash);assert.equal(finished.p_lease,'lease');
 }
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
