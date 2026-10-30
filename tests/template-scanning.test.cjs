const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {quarantine}=require('../server/scan-template.cjs');
test('server quarantine requires structural and malware scanner success for the exact immutable bytes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paramount-scan-test-'));try{
 let calls=0;const file='templates/Paramount_Invoice_Fillable.pdf';const clean=await quarantine(file,dir,{scan:async p=>{calls++;assert.equal(fs.statSync(p).mode&0o777,0o600);}});assert.equal(clean.verdict,'clean');assert.equal(calls,1);assert.equal(clean.sha256,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
 for(const scan of [async()=>{throw Error('infected')},async()=>{throw Error('scanner missing')},async p=>fs.appendFileSync(p,'tampered')])assert.equal((await quarantine(file,dir,{scan})).verdict,'blocked');
 const bad=path.join(dir,'malformed.pdf');fs.writeFileSync(bad,'%PDF-unsafe');assert.equal((await quarantine(bad,dir,{scan:async()=>{throw Error('Must not reach scanner')}})).structuralInspection,false);
 await assert.rejects(()=>quarantine(dir,dir),/regular/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
