const {test}=require('node:test'),assert=require('node:assert/strict');
const {settings,tick}=require('../server/mail-worker.cjs');
const c={url:'https://fictional.supabase.co',key:'fixture',emailKey:'fictional',from:'test@example.invalid'};
test('worker refuses production, missing explicit isolation and incomplete provider configuration',()=>{
 for(const env of [{},{PARAMOUNT_ISOLATED_WORKER:'yes',PARAMOUNT_TEST_URL:'https://ehlfgmfjzwfsudowaxku.supabase.co',PARAMOUNT_TEST_PROJECT_REF:'ehlfgmfjzwfsudowaxku'}])assert.throws(()=>settings(env));
 const env={PARAMOUNT_ISOLATED_WORKER:'yes',PARAMOUNT_TEST_URL:c.url,PARAMOUNT_TEST_PROJECT_REF:'fictional',PARAMOUNT_WORKER_KEY:'fixture',RESEND_API_KEY:'fixture',PARAMOUNT_FROM_EMAIL:c.from};assert.equal(settings(env).url,c.url);
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
