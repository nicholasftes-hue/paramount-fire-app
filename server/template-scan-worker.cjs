'use strict';
// Server-only polling adapter. Private files are never served as public assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {quarantine,privateDirectory}=require('./scan-template.cjs');
const PRODUCTION='ehlfgmfjzwfsudowaxku';
function settings(env){
 const url=new URL(env.PARAMOUNT_TEST_URL||'');
 if(env.PARAMOUNT_ISOLATED_SCAN!=='yes'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url.origin)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.hostname.split('.')[0]!==env.PARAMOUNT_TEST_PROJECT_REF||env.PARAMOUNT_TEST_PROJECT_REF===PRODUCTION||!env.PARAMOUNT_SCAN_KEY||!path.isAbsolute(env.PARAMOUNT_QUARANTINE_DIR||''))throw Error('Explicit isolated scan configuration required');
 return {url:url.origin,key:env.PARAMOUNT_SCAN_KEY,directory:env.PARAMOUNT_QUARANTINE_DIR};
}
async function tick(c,fetcher=fetch,scanner=quarantine){
 const rpc=async(name,body={})=>{const r=await fetcher(c.url+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Scan RPC failed');return r.json();};
 const directory=privateDirectory(c.directory);
 const job=await rpc('paramount_template_scan_claim');if(!job)return false;
 if(!/^[0-9a-f]{64}$/.test(job.hash)||!['pdf','docx'].includes(job.format)||typeof job.content!=='string'||job.content.length>2796204)throw Error('Invalid quarantine claim');
 const bytes=Buffer.from(job.content,'base64');let clean=false,fields=null;
 const privateDir=fs.mkdtempSync(path.join(directory,'claimed-'));fs.chmodSync(privateDir,0o700);
 const input=path.join(privateDir,'upload.'+job.format);
 try{
  fs.writeFileSync(input,bytes,{mode:0o600,flag:'wx'});
  if(bytes.length<1||bytes.length>2097152||crypto.createHash('sha256').update(bytes).digest('hex')!==job.hash)throw Error('Claim hash mismatch');
  const report=await scanner(input,directory);
  clean=report.verdict==='clean'&&report.structuralInspection===true&&report.sha256===job.hash&&report.format===job.format&&Array.isArray(report.fields);fields=clean?report.fields:null;
 }catch{/* All scan/inspection failures remain blocked; no upload bytes in logs. */}
 finally{fs.rmSync(privateDir,{recursive:true,force:true});}
 const accepted=await rpc('paramount_template_scan_finish',{p_workspace:job.workspace,p_hash:job.hash,p_format:job.format,p_lease:job.lease,p_clean:clean,p_fields:fields,p_scanner:'clamav+paramount-structural-v1'});
 if(!accepted)throw Error('Scan lease expired or superseded');return clean;
}
module.exports={settings,tick};
if(require.main===module)tick(settings(process.env)).then(clean=>console.log(clean?'Clean scan recorded':'No clean scan recorded')).catch(()=>{console.error('Isolated scan worker failed; upload remains quarantined.');process.exitCode=1;});
