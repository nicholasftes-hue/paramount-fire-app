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
