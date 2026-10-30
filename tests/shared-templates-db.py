"""Runs only inside team-sync-db.py's disposable loopback database."""
import base64
import hashlib
migration=Path('sql/shared-templates-isolated.sql').read_text()
sql(migration,False)
assert sql("select to_regclass('paramount_sync.templates') is null")=='t'
sql("set paramount.isolated_sync_test='yes';"+migration)
sql("set paramount.isolated_sync_test='yes';"+migration,False)
sql(f"update paramount_sync.staff set active=true,access_role='admin' where user_id={literal(users[0])}")
blob=Path('templates/Paramount_Invoice_Fillable.pdf').read_bytes()
content=base64.b64encode(blob).decode()
hash_value=hashlib.sha256(blob).hexdigest()
template_id,family=uid(),uid()
payload={'name':'Fictional shared certificate','kind':'invoice','filename':'Blank.pdf','format':'pdf','fields':['prepared_by'],'mappings':[{'name':'Engineer','fields':{'prepared_by':'engineer'}}]}
def publish(user=users[0],id=template_id,family_id=family,expected=0,company='paramount',property_id=None,body=payload,encoded=content,hash=hash_value,ok=True):
 args=[literal(w),literal(id),literal(family_id),str(expected),literal(property_id) if property_id else 'null',literal(company),literal(json.dumps(body))+'::jsonb',literal(encoded),literal(hash)]
 result=as_user(user,'select public.paramount_template_publish('+','.join(args)+')',ok)
 return json.loads(result[-1]) if ok else None
# Additive security migration: browser/admin cannot attest scanner success.
security=Path('sql/template-security-isolated.sql').read_text()
sql(security,False)
sql("set paramount.isolated_sync_test='yes';"+security)
sql("set paramount.isolated_sync_test='yes';"+security,False)
publish(ok=False)
request=f"select public.paramount_template_scan_request({literal(w)},{literal(content)},{literal(hash_value)},'pdf')"
for user in [users[1],users[2],users[3]]:as_user(user,request,False)
as_user('',request,False,'anon')
assert json.loads(as_user(users[0],request)[-1])['state']=='pending'
assert json.loads(as_user(users[0],request)[-1])['state']=='pending'
publish(ok=False)
for user in [users[0],users[1]]:
 as_user(user,'select public.paramount_template_scan_claim()',False)
 as_user(user,'select * from paramount_sync.template_scans',False)
claim=json.loads(as_user('','select public.paramount_template_scan_claim()',role='service_role')[-1])
assert base64.b64decode(claim['content'])==blob
assert as_user('','select public.paramount_template_scan_claim()',role='service_role')==['null']
def finish(lease,clean=True,fields=payload['fields'],role='service_role',ok=True):
 return as_user('',f"select public.paramount_template_scan_finish({literal(w)},{literal(hash_value)},'pdf',{literal(lease)},{str(clean).lower()},{literal(json.dumps(fields))}::jsonb,'fictional-test-scanner')",ok,role)
finish(claim['lease'],role='authenticated',ok=False)
assert finish(uid())==['f']
sql("update paramount_sync.template_scans set lease_until=clock_timestamp()-interval '1 second'")
assert finish(claim['lease'])==['f']
old_lease=claim['lease']
claim=json.loads(as_user('','select public.paramount_template_scan_claim()',role='service_role')[-1])
assert claim['lease']!=old_lease
assert finish(old_lease)==['f']
publish(ok=False)
assert finish(claim['lease'])==['t']
assert finish(claim['lease'])==['f']
publish(body={**payload,'fields':['forged']},ok=False)
for user in [users[1],users[2],users[3]]:publish(user=user,ok=False)
first=publish()
assert first['hash']==hash_value and first['company']=='paramount' and first['version']==1
assert publish()==first
publish(body={**payload,'name':'Overwrite'},ok=False)
publish(id=uid(),encoded=base64.b64encode(b'changed').decode(),ok=False)
publish(id=uid(),body={**payload,'mappings':[{'name':'bad','fields':{'prepared_by':'engineerSignature'}}]},ok=False)
publish(id=uid(),company='unknown',ok=False)
publish(id=uid(),property_id=uid(),ok=False)
# Concurrent new versions race under the workspace lock: exactly one wins.
def race(_):
 try:return publish(id=uid(),expected=1,company='absolute')
 except AssertionError:return None
with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(race,range(2)))
assert sum(r is not None for r in results)==1
second=next(r for r in results if r)
assert second['company']=='absolute' and second['version']==2
for user in users[:3]:
 listed=json.loads(as_user(user,f"select public.paramount_template_list({literal(w)})")[-1])
 assert len(listed)==2 and all('content' not in t for t in listed)
 old=json.loads(as_user(user,f"select public.paramount_template_get({literal(w)},{literal(template_id)})")[-1])
 assert base64.b64decode(old['content'])==blob and not old['active']
as_user(users[3],f"select public.paramount_template_list({literal(w)})",False)
as_user('',f"select public.paramount_template_list({literal(w)})",False,'anon')
for table in ['templates','template_events']:
 as_user(users[0],f'select * from paramount_sync.{table}',False)
 as_user(users[0],f'delete from paramount_sync.{table}',False)
as_user(users[1],f"select public.paramount_template_active({literal(w)},{literal(second['id'])},false)",False)
as_user(users[0],f"select public.paramount_template_active({literal(w)},{literal(template_id)},true)",False)
as_user(users[0],f"select public.paramount_template_active({literal(w)},{literal(second['id'])},false)")
backup=json.loads(as_user(users[0],f"select public.paramount_template_backup({literal(w)})")[-1])
assert len(backup['templates'])==2 and len(backup['audit'])==4
for t in backup['templates']:assert hashlib.sha256(base64.b64decode(t['content'])).hexdigest()==t['hash']
as_user(users[1],f"select public.paramount_template_backup({literal(w)})",False)
# Property restrictions use the same server ACLs as engineering records.
sql(f"update paramount_sync.documents set restricted=true where workspace_id={literal(w)} and id={literal(prop)}")
restricted=publish(id=uid(),family_id=uid(),property_id=prop)
assert restricted['property']==prop
assert all(t['id']!=restricted['id'] for t in json.loads(as_user(users[2],f"select public.paramount_template_list({literal(w)})")[-1]))
as_user(users[2],f"select public.paramount_template_get({literal(w)},{literal(restricted['id'])})",False)
sql(f"update paramount_sync.staff set active=false where user_id={literal(users[2])} and workspace_id={literal(w)}")
as_user(users[2],f"select public.paramount_template_get({literal(w)},{literal(template_id)})",False)
print('PASS shared templates: migration guards, immutable originals, server hash, both brands, roles/anonymous/foreign/revoked/direct-access denial, property ACLs, CAS races, idempotency, historical reads, deactivation, original/audit backup')

# Existing/idempotent returns, list/get and reactivation cannot bypass a blocked verdict.
sql("update paramount_sync.template_scans set state='blocked'")
publish(ok=False)
assert json.loads(as_user(users[0],f"select public.paramount_template_list({literal(w)})")[-1])==[]
as_user(users[0],f"select public.paramount_template_get({literal(w)},{literal(template_id)})",False)
as_user(users[0],f"select public.paramount_template_active({literal(w)},{literal(second['id'])},true)",False)
# Owner restoration of this synthetic fixture only, to preserve subsequent restore comparisons.
sql("update paramount_sync.template_scans set state='clean'")
print('PASS scan enforcement: missing/pending/blocked/field substitution/idempotent bypass, roles, private quarantine, hash binding, expired and superseded leases, list/get/reactivation denial')
