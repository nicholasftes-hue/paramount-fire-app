'use strict';
const {spawnSync}=require('node:child_process'),{mkdtempSync,writeFileSync,readFileSync,rmSync}=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os'),{createHash}=require('node:crypto');
// Incremental PDF signature, detached CMS/SHA-256. Keys remain in server-mounted files.
// This is a basic PDF signature, not qualified/PAdES-LT or a trusted timestamp.
function signPdf(input,{keyPath,certificatePath}){
 const original=Buffer.isBuffer(input)?input:Buffer.from(input,'ascii'),source=original.toString('latin1');
 if(!source.startsWith('%PDF-1.4')||!keyPath||!certificatePath||source.includes('/ByteRange'))throw Error('Unsigned generated PDF and signing configuration required');
 const size=Number([...source.matchAll(/\/Size (\d+)/g)].at(-1)?.[1]),prev=Number([...source.matchAll(/startxref\s+(\d+)/g)].at(-1)?.[1]);
 if(!Number.isSafeInteger(size)||size<3||!Number.isSafeInteger(prev)||!source.includes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>'))throw Error('Unsupported PDF structure');
 const reserve=32768,placeholder='000000000000',ranges='[0 '+placeholder+' '+placeholder+' '+placeholder+']';
 let suffix='\n';const entries=[];
 function obj(id,body){entries.push({id,offset:original.length+Buffer.byteLength(suffix,'ascii')});suffix+=id+' 0 obj\n'+body+'\nendobj\n'}
 obj(1,'<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields ['+(size+1)+' 0 R] /SigFlags 3 >> >>');
 obj(size,'<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange '+ranges+' /Contents <'+'0'.repeat(reserve*2)+'> /Reason (Controlled issue and verified acknowledgement evidence) >>');
 obj(size+1,'<< /FT /Sig /T (Paramount controlled evidence) /V '+size+' 0 R >>');
 const xref=original.length+Buffer.byteLength(suffix,'ascii');suffix+='xref\n0 2\n0000000000 65535 f \n'+String(entries[0].offset).padStart(10,'0')+' 00000 n \n'+size+' 2\n'+entries.slice(1).map(e=>String(e.offset).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(size+2)+' /Root 1 0 R /Prev '+prev+' >>\nstartxref\n'+xref+'\n%%EOF\n';
 let output=Buffer.concat([original,Buffer.from(suffix,'ascii')]);
 const marker=output.indexOf(Buffer.from('/Contents <'),original.length)+10,start=marker,end=start+reserve*2+2;
 if(output[start]!==60||output[end-1]!==62)throw Error('Signature reservation mismatch');
 const byteRange='[0 '+String(start).padStart(12,'0')+' '+String(end).padStart(12,'0')+' '+String(output.length-end).padStart(12,'0')+']';
 const rangeOffset=output.indexOf(Buffer.from(ranges),original.length);output.write(byteRange,rangeOffset,'ascii');
 const data=Buffer.concat([output.subarray(0,start),output.subarray(end)]),directory=mkdtempSync(join(tmpdir(),'paramount-sign-'));
 try{
  const valid=spawnSync('openssl',['x509','-in',certificatePath,'-checkend','0','-noout'],{timeout:10000,stdio:'pipe'});if(valid.status!==0)throw Error('Signing certificate expired or unavailable');
  const dataPath=join(directory,'content.bin'),signaturePath=join(directory,'signature.der');writeFileSync(dataPath,data,{mode:0o600});
  const result=spawnSync('openssl',['cms','-sign','-binary','-nosmimecap','-md','sha256','-signer',certificatePath,'-inkey',keyPath,'-in',dataPath,'-outform','DER','-out',signaturePath],{timeout:20000,stdio:'pipe'});
  if(result.status!==0)throw Error('PDF signing failed; check restricted key/certificate configuration');
  const signature=readFileSync(signaturePath);if(signature.length>reserve)throw Error('PDF signing certificate chain exceeds reserved size');
  output.write(signature.toString('hex').padEnd(reserve*2,'0'),start+1,'ascii');
  const certificate=spawnSync('openssl',['x509','-in',certificatePath,'-outform','DER'],{timeout:10000,stdio:'pipe'});if(certificate.status!==0)throw Error('Signing certificate unavailable');
  return {bytes:output,sha256:createHash('sha256').update(output).digest('hex'),certificateSha256:createHash('sha256').update(certificate.stdout).digest('hex')};
 }finally{rmSync(directory,{recursive:true,force:true})}
}
module.exports={signPdf};
