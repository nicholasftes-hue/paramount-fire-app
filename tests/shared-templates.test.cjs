const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {create}=require('../shared-templates.js'),pdf=require('../imported-pdf.js');
const id='00000000-0000-4000-8000-000000000001',family='00000000-0000-4000-8000-000000000002',workspace='00000000-0000-4000-8000-000000000003';
const bytes=fs.readFileSync('templates/Paramount_Invoice_Fillable.pdf'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),original={name:'Blank.pdf',size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
const t={id,family,version:1,name:'Shared blank',company:'absolute',property:'',kind:'invoice',filename:'Blank.pdf',format:'pdf',hash,content:bytes.toString('base64'),active:true,mappings:[{name:'Engineer',fields:{prepared_by:'engineer'}}]};
const meta={id,family,expected:0,name:'Shared blank',company:'absolute',kind:'invoice',mappings:t.mappings};
const setup=(rpc,extra={})=>create({rpc,inspect:async(n,b)=>pdf.inspect(b),mappingSources:['engineer','reference'],...extra});
test('shared template publishing inspects original bytes and verifies exact server acknowledgement',async()=>{
 const calls=[],api=setup(async(n,args)=>{calls.push({n,args});return t;});const result=await api.publish(original,meta);assert(result.fields.includes('prepared_by'));assert.equal(calls.length,1);assert.equal(calls[0].n,'paramount_template_publish');assert.equal(calls[0].args.p_hash,hash);assert.deepEqual(Buffer.from(calls[0].args.p_content,'base64'),bytes);assert.equal(calls[0].args.p_company,'absolute');
 await assert.rejects(()=>api.publish(original,{...meta,mappings:[{name:'unsafe',fields:{prepared_by:'engineerSignature'}}]}),/Unsupported/);assert.equal(calls.length,1);
});
test('shared downloads and backups re-inspect content and reject tampering or substituted versions',async()=>{
 assert((await setup(async()=>t).get(id)).fields.includes('prepared_by'));
 await assert.rejects(()=>setup(async()=>({...t,hash:'bad'})).get(id),/hash/);
 await assert.rejects(()=>setup(async()=>({...t,id:family})).get(id),/Wrong/);
 const backup={version:1,workspace,templates:[t],audit:[]};assert.equal((await setup(async()=>backup).backup()).templates[0].hash,hash);
 await assert.rejects(()=>setup(async()=>({...backup,templates:[{...t,content:btoa('bad')}]})).backup(),/hash/);
 await assert.rejects(()=>setup(async()=>({...t,version:2})).publish(original,meta),/acknowledgement/);
});
test('shared actions propagate access/network failures and enforce account changes across awaited inspection',async()=>{
 let scope='account-one',calls=0;const api=setup(async()=>{calls++;return t},{scope:()=>scope,inspect:async(n,b)=>{scope='account-two';return pdf.inspect(b)}});
 await assert.rejects(()=>api.publish(original,meta),/Account changed/);assert.equal(calls,0);
 await assert.rejects(()=>setup(async()=>{throw Error('Access denied')}).list(),/Access denied/);
 await assert.rejects(()=>setup(async()=>{throw Error('Offline')}).get(id),/Offline/);
 await assert.rejects(()=>setup(async()=>[]).active('bad',false),/Invalid/);
});
