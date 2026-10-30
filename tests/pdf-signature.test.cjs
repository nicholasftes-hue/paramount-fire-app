const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {signPdf}=require('../server/sign-pdf.cjs');
test('cryptographic PDF signature verifies independently; modified content fails',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paramount-test-cert-'));
 try{
  const keyPath=path.join(dir,'key.pem'),certificatePath=path.join(dir,'cert.pem');
  const cert=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certificatePath,'-days','1','-subj','/CN=Fictional isolated test signer'],{stdio:'pipe'});assert.equal(cert.status,0);
  for(const kind of ['service','pat','lighting','quote']){
  const source=fs.readFileSync('test-results/controlled-'+kind+'.pdf');
  const signed=signPdf(source,{keyPath,certificatePath});fs.writeFileSync('test-results/cryptographically-signed-'+kind+'.pdf',signed.bytes);
  const text=signed.bytes.toString('latin1'),match=text.match(/\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\]/);assert(match);const range=match.slice(1).map(Number);
  const data=Buffer.concat([signed.bytes.subarray(range[0],range[1]),signed.bytes.subarray(range[2],range[2]+range[3])]);
  const hex=text.slice(range[1]+1,range[2]-1),der=Buffer.from(hex,'hex');
  fs.writeFileSync(path.join(dir,'signature.der'),der);fs.writeFileSync(path.join(dir,'content.bin'),data);
  const verify=()=>spawnSync('openssl',['cms','-verify','-binary','-inform','DER','-in',path.join(dir,'signature.der'),'-content',path.join(dir,'content.bin'),'-noverify','-out',path.join(dir,'verified.bin')],{stdio:'pipe'});
  assert.equal(verify().status,0);data[50]^=1;fs.writeFileSync(path.join(dir,'content.bin'),data);assert.notEqual(verify().status,0);
  assert.throws(()=>signPdf(signed.bytes,{keyPath,certificatePath}));assert.equal(signed.sha256.length,64);assert.equal(signed.certificateSha256.length,64);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
