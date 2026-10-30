const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('hosted acceptance refuses production, identical refs, absent approvals and unsafe object paths before I/O',()=>{
 const code=`import importlib.util
s=importlib.util.spec_from_file_location('h','scripts/hosted-recovery-acceptance.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=dict(version=1,synthetic_only=True,owner_approved_disposable=True,owner='Fictional',source_sha='3380c08',approval_reference='fictional',rpo_seconds=0,rto_seconds=600,source_ref='a'*20,target_ref='b'*20,objects=[dict(bucket='acceptance-fixture',path='synthetic/file.pdf',sha256='a'*64)])
assert m.validate(c)==c
for patch in [dict(source_ref=m.PRODUCTION),dict(target_ref=c['source_ref']),dict(synthetic_only=False),dict(owner_approved_disposable=False),dict(objects=[]),dict(objects=[dict(bucket='customers',path='synthetic/../file',sha256='a'*64)])]:
 try:m.validate({**c,**patch})
 except (AssertionError,KeyError):pass
 else:raise AssertionError('Unsafe manifest accepted')
print('PASS hosted configuration guards')`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
