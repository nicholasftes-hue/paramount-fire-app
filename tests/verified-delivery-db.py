"""Continuation of disposable database tests, synthetic identities only."""
sql("create role service_role nologin;")
for path in ['sql/shared-records-isolated.sql','sql/verified-delivery-isolated.sql']:
    migration=Path(path).read_text()
    sql(migration,False)
    sql("set paramount.isolated_sync_test='yes';"+migration)
    sql("set paramount.isolated_sync_test='yes';"+migration,False)
sql(f"update paramount_sync.staff set active=true,access_role='admin' where workspace_id={literal(w)} and user_id={literal(users[0])}")
sql(f"update paramount_sync.staff set active=true,access_role='approver' where workspace_id={literal(w)} and user_id={literal(users[1])}")
# Restriction inheritance across list, issue, invite, history, write and operation replay.
def policy(doc,restricted,grants):
    return as_user(users[0],f"select public.paramount_record_access({literal(w)},{literal(doc)},{str(restricted).lower()},{literal(json.dumps(grants))}::jsonb)")
policy(prop,True,[{'user':users[1],'permission':'read'}])
assert json.loads(as_user(users[2],f"select public.paramount_sync_list({literal(w)})")[-1])==[]
assert len(json.loads(as_user(users[1],f"select public.paramount_sync_list({literal(w)})")[-1]))==4
rpc(users[1],'paramount_issue_history',[literal(w),literal(ident)])
issue(users[1],version=3,ok=False)
write(users[1],prop,'property',None,site,version=2,ok=False)
as_user(users[1],f"select public.paramount_record_access({literal(w)},{literal(prop)},false,'[]')",False)
policy(ident,True,[])
rpc(users[1],'paramount_issue_history',[literal(w),literal(ident)],False)
policy(prop,False,[]);policy(ident,False,[])
assert sql('select count(*) from paramount_sync.access_events')=='4'
# Every remaining kind shares CAS/history/permissions. Site-linked fictional records only.
shared_fields={
'extinguisher':['engineer','asset','location','model','capacity','visitType','tests','outcome','defects'],
'installation':['engineer','stage','system','standard','drawingRef','devices','tests','defects','actions','recipient','declaration'],
'callout':['engineer','number','priority','status','issue','defects','actions'],
'enquiry':['customer','contact','site','status','owner','notes'],
'drawing':['title','layout','notes'],
'equipment':['manufacturer','model','title','url','checked','notes'],
'quote':['number','customer','address','due','lines','vat','terms'],
'invoice':['number','customer','address','due','lines','vat','terms'],
'visit':['engineer','time','minutes','serviceType','status','notes']}
new_ids={}
for k,fields in shared_fields.items():
    record_id=uid();new_ids[k]=record_id
    vals={f:'Fictional' for f in fields};vals.update(property=prop,reviewed='yes',date='2026-10-28')
    if k in ('quote','invoice'): vals.update(due='2026-11-28',lines='Fictional item | 2 | 10.00',vat='20')
    if k=='equipment': vals.update(url='https://example.invalid/manual',checked='2026-10-28')
    if k=='visit': vals.update(time='09:00',minutes='60',status='Confirmed')
    if k=='drawing': vals.update(layout='Room | 0 | 0 | 10 | 10')
    payload={'id':record_id,'kind':k,'values':vals,'revision':1,'history':[],'created':'fixture','updated':'fixture','siteSnapshot':site}
    write(users[0],record_id,k,prop,payload)
    write(users[2],record_id,k,prop,payload,ok=False)
    write(users[3],record_id,k,prop,payload,ok=False)
quote_issue=rpc(users[0],'paramount_issue',[literal(w),literal(new_ids['quote']),'1',literal('Fictional quotation approval scope checked')])
assert quote_issue['snapshot']['kind']=='quote'
# Approved isolated customer origin is owner-provisioned, never supplied in an anonymous redirect.
sql(f"insert into paramount_sync.delivery_config values({literal(w)},'https://isolated.example.invalid')")
req=rpc(users[0],'paramount_signature_invite',[literal(w),literal(quote_issue['id']),literal('fictional@example.invalid'),'72'])
assert req['delivery']=='queued' and 'token' not in req
mail=json.loads(sql("select to_jsonb(m) from paramount_sync.mail_outbox m where kind='invitation'"))
token=mail['body']['text'].split('#token=')[1]
assert len(token)==64
read_token(token,False)
accept(token,quote_issue['digest'],'anything',ok=False) # old route is closed
for name,args in [('paramount_mail_claim',[]),('paramount_mail_schedule',[])]:
    rpc(users[0],name,args,False)
rpc('','paramount_signature_read_verified',[literal(token),literal('f'*64)],False,'anon')
challenge=rpc('','paramount_signature_challenge',[literal(token)],role='anon')
assert 'status' in challenge
rpc('','paramount_signature_challenge',[literal(token)],role='anon')
assert sql("select count(*) from paramount_sync.mail_outbox where kind='verification'")=='1'
code=json.loads(sql("select body from paramount_sync.mail_outbox where kind='verification'"))['text'].split('code is ')[1][:8]
assert rpc('','paramount_signature_verify',[literal(token),literal('bad')],role='anon') is None
proof=rpc('','paramount_signature_verify',[literal(token),literal(code)],role='anon')['proof']
assert rpc('','paramount_signature_verify',[literal(token),literal(code)],role='anon') is None
opened=rpc('','paramount_signature_read_verified',[literal(token),literal(proof)],role='anon')
assert opened['verified_email']=='fictional@example.invalid'
args=list(map(literal,[token,proof,quote_issue['digest'],'Fictional Customer',opened['consent']]))
receipt=rpc('','paramount_signature_accept_verified',args,role='anon')
assert receipt['signed_at']
assert rpc('','paramount_signature_accept_verified',args,role='anon')['signed_at']==receipt['signed_at']
assert sql("select count(*) from paramount_sync.issue_events where event='signed' and request_id="+literal(req['request']))=='1'
assert token not in json.dumps(receipt) and proof not in json.dumps(receipt)
# Post-signature receipt queued once. Worker cannot duplicate provider acceptance on stale lease.
def worker(name,args=[]):return rpc('',name,args,role='service_role')
claim=worker('paramount_mail_claim')
assert claim['kind']=='receipt' # signed invitations and consumed verification codes are cancelled
import base64,hashlib
artifact={'filename':'paramount-acknowledged-'+req['request']+'.pdf','content':base64.b64encode(b'%PDF-1.4'+b'0'*100).decode(),'sha256':hashlib.sha256(b'%PDF-1.4'+b'0'*100).hexdigest(),'certificate_sha256':'a'*64}
assert worker('paramount_mail_artifact',[literal(claim['id']),literal(uid()),literal(json.dumps(artifact))+'::jsonb']) is None
assert worker('paramount_mail_artifact',[literal(claim['id']),literal(claim['lease']),literal(json.dumps(artifact))+'::jsonb'])['attachment']==artifact
assert not worker('paramount_mail_finish',[literal(claim['id']),literal(uid()),literal('accepted'),literal('fake-provider')])
assert worker('paramount_mail_finish',[literal(claim['id']),literal(claim['lease']),literal('retry'),'null'])
sql(f"update paramount_sync.mail_outbox set next_at=clock_timestamp()-interval '1 second' where id={literal(claim['id'])}")
retry=worker('paramount_mail_claim');assert retry['id']==claim['id'] and retry['lease']!=claim['lease']
assert worker('paramount_mail_finish',[literal(retry['id']),literal(retry['lease']),literal('accepted'),literal('fake-provider')])
assert worker('paramount_mail_claim') is None
assert sql('select body from paramount_sync.mail_outbox where id='+literal(retry['id']))=='{}'
# Reminders are calendar-day based UTC, catch up without the browser, never use new hosted users.
visit_id=new_ids['visit']
sql(f"update paramount_sync.documents set payload=jsonb_set(payload,'{{values,date}}',to_jsonb(((clock_timestamp() at time zone 'UTC')::date+30)::text)) where id={literal(visit_id)}")
as_user(users[0],f"select public.paramount_reminder_set({literal(w)},{literal(visit_id)},'fictional@example.invalid',true)")
as_user(users[0],f"select public.paramount_reminder_set({literal(w)},{literal(visit_id)},'unverified@example.invalid',true)",False)
assert worker('paramount_mail_schedule')==1
assert worker('paramount_mail_schedule')==0
# Competing worker transactions cannot claim the same message.
with concurrent.futures.ThreadPoolExecutor() as pool: claims=list(pool.map(lambda _:worker('paramount_mail_claim'),range(2)))
assert sum(c is not None for c in claims)==1
reminder=next(c for c in claims if c)
assert reminder['days']==30
assert worker('paramount_mail_finish',[literal(reminder['id']),literal(reminder['lease']),literal('accepted'),literal('fake-reminder')])
assert worker('paramount_mail_schedule')==0
# Changing the due date cancels stale queued work; disabling recipient cancels new work.
sql(f"update paramount_sync.documents set payload=jsonb_set(payload,'{{values,date}}',to_jsonb(((clock_timestamp() at time zone 'UTC')::date+7)::text)) where id={literal(visit_id)}")
assert worker('paramount_mail_schedule')==1
as_user(users[0],f"select public.paramount_reminder_set({literal(w)},{literal(visit_id)},'fictional@example.invalid',false)")
assert worker('paramount_mail_claim') is None
for table in ['mail_outbox','delivery_config','reminder_subscriptions','delivery_events','record_access','access_events']:
    as_user(users[0],f'select * from paramount_sync.{table}',False)
for statement in ['select public.paramount_signature_invite_internal(null,null,null,null)','select public.paramount_issue_internal(null,null,null,null)','select public.paramount_sync_write_role_internal(null,null,null,null,null,null,null)']:
    as_user(users[0],statement,False)
print('PASS: shared kinds/ACL inheritance and audit, quote issue, legacy bypass denial, emailed code verification/attempt persistence/single-use proof, exact idempotent acceptance, private queue, worker lease fencing/retry/scrubbing, concurrent claims, unattended UTC 30/7 reminders/duplicate prevention/cancellation; no hosted accounts or services')
