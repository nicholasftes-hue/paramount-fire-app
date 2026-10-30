const {test}=require('node:test'),assert=require('node:assert/strict');
const {settings,tick}=require('../server/mail-worker.cjs');
const c={url:'https://fictional.supabase.co',key:'fixture',emailKey:'fictional',from:'test@example.invalid'};
test('worker refuses production, missing explicit isolation and incomplete provider configuration',()=>{
 for(const env of [{},{PARAMOUNT_ISOLATED_WORKER:'yes',PARAMOUNT_TEST_URL:'https://ehlfgmfjzwfsudowaxku.supabase.co',PARAMOUNT_TEST_PROJECT_REF:'ehlfgmfjzwfsudowaxku'}])assert.throws(()=>settings(env));
 const env={PARAMOUNT_ISOLATED_WORKER:'yes',PARAMOUNT_TEST_URL:c.url,PARAMOUNT_TEST_PROJECT_REF:'fictional',PARAMOUNT_WORKER_KEY:'fixture',RESEND_API_KEY:'fixture',PARAMOUNT_FROM_EMAIL:c.from,PARAMOUNT_SIGNING_KEY_PATH:'/fictional/key.pem',PARAMOUNT_SIGNING_CERT_PATH:'/fictional/cert.pem'};assert.equal(settings(env).url,c.url);
 assert.throws(()=>settings({...env,PARAMOUNT_FROM_EMAIL:'test@example.invalid\r\nBcc:other@example.invalid'}));
});
test('worker retries unknown provider outcomes with stable idempotency keys and redacts errors',async()=>{
 let claims=0;const calls=[];const m={id:'fixture-id',lease:'fixture-lease',recipient:'recipient@example.invalid',body:{subject:'Fictional subject',text:'Fictional body'}};
 const fake=async(url,o)=>{calls.push({url,o,body:JSON.parse(o.body)});if(url.endsWith('schedule'))return {ok:true,json:async()=>1};if(url.endsWith('claim'))return {ok:true,json:async()=>claims++===0?m:null};if(url.endsWith('finish'))return {ok:true,json:async()=>true};throw Error('timeout SENSITIVE')};
 assert.equal(await tick(c,fake),0);const send=calls.find(x=>x.url.includes('resend.com'));assert.equal(send.o.headers['Idempotency-Key'],'paramount-fixture-id');assert.equal(calls.find(x=>x.url.endsWith('finish')).body.p_outcome,'retry');
});
test('worker distinguishes permanent rejection and provider acceptance from delivered mail',async()=>{
 for(const [status,outcome]of [[200,'accepted'],[429,'retry'],[500,'retry'],[400,'permanent']]){
 let claims=0,finished;
 const fake=async(url,o)=>{if(url.endsWith('schedule'))return {ok:true,json:async()=>0};if(url.endsWith('claim'))return {ok:true,json:async()=>claims++===0?{id:'x',lease:'y',recipient:'test@example.invalid',body:{subject:'s',text:'t'}}:null};if(url.endsWith('finish')){finished=JSON.parse(o.body);return {ok:true,json:async()=>true}}return {ok:status===200,status,json:async()=>({id:'provider-id'})}};
 assert.equal(await tick(c,fake),status===200?1:0);assert.equal(finished.p_outcome,outcome);
 }
});
test('signed receipt attachment is persisted before sending and identical stored bytes are used on retry',async()=>{
 let claims=0,signed=0,stored=null;const sent=[];let id='same-id';
 const fake=async(url,o)=>{
  const body=JSON.parse(o.body);
  if(url.endsWith('schedule'))return {ok:true,json:async()=>0};
  if(url.endsWith('claim'))return {ok:true,json:async()=>claims++<2?{id,lease:'lease-'+claims,kind:'receipt',recipient:'fictional@example.invalid',request_id:'fixture',body:{subject:'receipt',text:'acknowledged',...(stored?{attachment:stored}:{evidence:{fixture:true}})}}:null};
  if(url.endsWith('artifact')){stored=body.p_attachment;return {ok:true,json:async()=>({subject:'receipt',text:'acknowledged',attachment:stored})}}
  if(url.endsWith('finish'))return {ok:true,json:async()=>true};
  sent.push(body);return {ok:false,status:500};
 };
 await tick(c,fake,async()=>{signed++;return {filename:'evidence.pdf',content:'identical-signed-bytes',sha256:'a'.repeat(64),certificate_sha256:'b'.repeat(64)}});
 assert.equal(signed,1);assert.deepEqual(sent[0],sent[1]);assert.equal(sent[0].attachments[0].content,'identical-signed-bytes');
});
test('isolated delivery acceptance builds a real signed receipt, persists its hash and sends those exact bytes',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paramount-delivery-acceptance-'));try{
 const keyPath=path.join(dir,'key.pem'),certificatePath=path.join(dir,'cert.pem');
 const result=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certificatePath,'-days','1','-subj','/CN=Fictional delivery acceptance signer'],{stdio:'pipe'});assert.equal(result.status,0);
 const canonical_document=JSON.stringify({workspace:'fictional',document:'test-record',kind:'service',version:1,scope:'Fictional reviewed scope with limitations',payload:{revision:1,values:{engineer:'Fictional Engineer',tests:'Recorded fictional results',reviewed:'yes'},siteSnapshot:{name:'Fictional site'}}});
 const evidence={canonical_document,digest:crypto.createHash('sha256').update(canonical_document).digest('hex'),issue:'fictional-issue',sequence:1,approved_at:'2026-10-30T10:00:00Z',signed_at:'2026-10-30T11:00:00Z',request:'fictional-request',verified_email:'fictional@example.invalid',verified_at:'2026-10-30T10:59:00Z',signer_name:'Fictional Recipient',consent:'Acknowledged recorded scope and limitations'};
 let claimed=false,stored,posted,finished;const events=[];
 const fake=async(url,o)=>{const body=JSON.parse(o.body);if(url.endsWith('schedule'))return {ok:true,json:async()=>0};if(url.endsWith('claim')){const message=claimed?null:{id:'receipt-id',lease:'lease',kind:'receipt',recipient:'fictional@example.invalid',request_id:'fictional-request',body:{subject:'Fictional receipt',text:'Test only',evidence}};claimed=true;return {ok:true,json:async()=>message};}
 if(url.endsWith('artifact')){events.push('persist');stored=body.p_attachment;return {ok:true,json:async()=>({subject:'Fictional receipt',text:'Test only',attachment:stored})};}
 if(url.endsWith('finish')){finished=body;return {ok:true,json:async()=>true};}
 assert.equal(url,'https://api.resend.com/emails');events.push('send');posted=body;return {ok:true,json:async()=>({id:'fictional-provider-acceptance'})};};
 assert.equal(await tick({...c,keyPath,certificatePath},fake),1);assert.deepEqual(events,['persist','send']);assert.equal(finished.p_outcome,'accepted');assert.equal(posted.attachments[0].content,stored.content);
 const bytes=Buffer.from(stored.content,'base64');assert(bytes.subarray(0,5).equals(Buffer.from('%PDF-')));assert.match(bytes.toString('latin1'),/\/ByteRange \[/);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),stored.sha256);assert.equal(stored.certificate_sha256.length,64);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
