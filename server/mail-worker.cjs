'use strict';
// Run once per minute from an isolated scheduler. No inbound endpoint or browser secrets.
const {signPdf}=require('./sign-pdf.cjs');
async function receiptAttachment(m,c){
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),context={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pdf-font.js'),'utf8'),context);
 const renderer=require('../controlled-pdf.js')(context.window.ParamountPdfFont);
 const signed=signPdf(await renderer.create(m.body.evidence),{keyPath:c.keyPath,certificatePath:c.certificatePath});
 return {filename:'paramount-acknowledged-'+m.request_id+'.pdf',content:signed.bytes.toString('base64'),sha256:signed.sha256,certificate_sha256:signed.certificateSha256};
}
const PRODUCTION='https://ehlfgmfjzwfsudowaxku.supabase.co';
function settings(env){
 const url=new URL(env.PARAMOUNT_TEST_URL||'');
 if(env.PARAMOUNT_ISOLATED_WORKER!=='yes'||url.origin===PRODUCTION||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url.origin)||url.hostname.split('.')[0]!==env.PARAMOUNT_TEST_PROJECT_REF||!env.PARAMOUNT_WORKER_KEY||!env.RESEND_API_KEY||!env.PARAMOUNT_SIGNING_KEY_PATH||!env.PARAMOUNT_SIGNING_CERT_PATH||!/^[^\r\n]+@[^\r\n]+$/.test(env.PARAMOUNT_FROM_EMAIL||''))throw Error('Explicit isolated worker configuration required');
 return {url:url.origin,key:env.PARAMOUNT_WORKER_KEY,emailKey:env.RESEND_API_KEY,from:env.PARAMOUNT_FROM_EMAIL,keyPath:env.PARAMOUNT_SIGNING_KEY_PATH,certificatePath:env.PARAMOUNT_SIGNING_CERT_PATH};
}
async function tick(c,fetcher=fetch,makeAttachment=receiptAttachment){
 const rpc=async(name,body={})=>{
  const response=await fetcher(c.url+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('Worker RPC failed');return response.json();
 };
 await rpc('paramount_mail_schedule');let sent=0;
 for(let i=0;i<50;i++){
  const m=await rpc('paramount_mail_claim');if(!m)break;
  if(m.kind==='receipt'&&!m.body.attachment){const attachment=await makeAttachment(m,c);m.body=await rpc('paramount_mail_artifact',{p_id:m.id,p_lease:m.lease,p_attachment:attachment});if(!m.body)continue;}
  let outcome='retry',provider=null;
  try{
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+c.emailKey,'Content-Type':'application/json','Idempotency-Key':'paramount-'+m.id},body:JSON.stringify({from:c.from,to:[m.recipient],subject:m.body.subject,text:m.body.text,...(m.body.attachment?{attachments:[{filename:m.body.attachment.filename,content:m.body.attachment.content}]}:{})})});
   if(response.ok){const data=await response.json();if(typeof data.id==='string'&&data.id.length<=200){outcome='accepted';provider=data.id}}
   else if(response.status>=400&&response.status<500&&![408,409,429].includes(response.status))outcome='permanent';
  }catch{/* Unknown outcome: retry the identical key inside the provider's 24h dedupe window. */}
  const finished=await rpc('paramount_mail_finish',{p_id:m.id,p_lease:m.lease,p_outcome:outcome,p_provider:provider});
  if(finished&&outcome==='accepted')sent++;
 }
 return sent;
}
module.exports={settings,tick};
if(require.main===module)tick(settings(process.env)).then(n=>console.log('Provider-accepted messages: '+n)).catch(()=>{console.error('Isolated email worker failed; inspect restricted delivery audit.');process.exitCode=1});
