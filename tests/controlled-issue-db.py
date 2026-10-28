"""Executed by team-sync-db.py in its disposable loopback PostgreSQL fixture only."""
migration = Path('sql/controlled-issue-isolated.sql').read_text()
sql(migration, False)
assert sql("select to_regclass('paramount_sync.issues') is null") == 't'
sql("set paramount.isolated_sync_test='yes';" + migration)
sql("set paramount.isolated_sync_test='yes';" + migration, False)
# Synthetic local principals exercise roles; no hosted accounts are created or needed.
sql(f"update paramount_sync.staff set access_role='approver' where user_id={literal(users[0])};")
sql(f"update paramount_sync.staff set active=true,access_role='viewer' where user_id={literal(users[2])};")
sql(f"insert into paramount_sync.staff(workspace_id,user_id,slot,access_role) values ({literal(other)},{literal(users[3])},1,'approver');")

def rpc(user, name, args, ok=True, role='authenticated'):
    result=as_user(user,'select public.'+name+'('+','.join(args)+')',ok,role)
    return json.loads(result[-1]) if ok and result and result[-1] else None

def issue(user=users[0], version=2, ok=True):
    return rpc(user,'paramount_issue',[literal(w),literal(ident),str(version),literal('Fictional competent review: scope and limitations checked')],ok)

def invite(issued, ok=True, user=users[0]):
    return rpc(user,'paramount_signature_invite',[literal(w),literal(issued['id']),literal('Fictional recipient'), '72'],ok)

def read_token(token, ok=True):
    return rpc('','paramount_signature_read',[literal(token)],ok,'anon')

def accept(token, digest, consent, name='Fictional Customer', ok=True):
    return rpc('','paramount_signature_accept',list(map(literal,[token,digest,name,consent])),ok,'anon')

assert len(json.loads(as_user(users[2],f"select public.paramount_sync_list({literal(w)})")[-1])) == 4
write(users[2],prop,'property',None,site,version=2,ok=False) # viewer cannot write
as_user(users[0],"select public.paramount_sync_write_internal(null,null,null,null,null,null,null)",False)
issue(users[1],ok=False) # editor cannot approve
issue(users[2],ok=False) # viewer cannot approve
issue(users[3],ok=False) # foreign workspace approver
issue(version=1,ok=False) # stale review
issued=issue()
assert issued['sequence']==1 and issued['source_version']==2
assert issued['snapshot']['payload']['revision']==2
assert sql('select encode(sha256(convert_to(snapshot::text,\'UTF8\')),\'hex\')=digest from paramount_sync.issues')=='t'
issue(ok=False) # no duplicate issue of a version
request=invite(issued)
assert len(request['token'])==64 and request['token'] not in sql('select to_jsonb(r) from paramount_sync.signature_requests r')
read_token('bad',False)
read_token('f'*64,False)
opened=read_token(request['token'])
assert opened['digest']==issued['digest'] and 'history' not in opened and 'recipient' not in opened and 'approved_by' not in opened
accept(request['token'],'0'*64,opened['consent'],ok=False)
accept(request['token'],opened['digest'],'different consent',ok=False)
accept(request['token'],opened['digest'],opened['consent'],name=' ',ok=False)
# Competing anonymous requests: exactly one succeeds, and only one signed audit exists.
def race(_):
    try:return accept(request['token'],opened['digest'],opened['consent'])
    except AssertionError:return None
with concurrent.futures.ThreadPoolExecutor() as pool:
    signed=list(pool.map(race,range(2)))
assert sum(s is not None for s in signed)==1
receipt=read_token(request['token'])
assert receipt['signed_at'] and receipt['signer_name']=='Fictional Customer'
accept(request['token'],opened['digest'],opened['consent'],ok=False)
rpc(users[0],'paramount_signature_revoke',[literal(w),literal(request['request'])],False)
# Explicit revocation and expiration fail closed.
revoked=invite(issued)
rpc(users[0],'paramount_signature_revoke',[literal(w),literal(revoked['request'])])
read_token(revoked['token'],False)
accept(revoked['token'],opened['digest'],opened['consent'],ok=False)
expired=invite(issued)
sql(f"update paramount_sync.signature_requests set expires_at=clock_timestamp()-interval '1 second' where id={literal(expired['request'])}")
read_token(expired['token'],False)
# Editing never mutates issued evidence. Reissue appends a successor and revokes unused old links.
unused=invite(issued)
third={**revised,'revision':3,'values':{**revised['values'],'tests':'Corrected fictional result'},
       'history':revised['history']+[dict(revision=2,values=revised['values'],updated=revised['updated'],siteSnapshot=revised['siteSnapshot'])]}
write(users[1],ident,kind,prop,third,version=2)
assert read_token(unused['token'])['values']['tests']==revised['values']['tests']
next_issue=issue(version=3)
assert next_issue['sequence']==2 and next_issue['supersedes']==issued['id']
assert next_issue['digest']!=issued['digest']
read_token(unused['token'],False)
invite(issued,False)
# A signed receipt survives correction; its issue remains frozen.
assert read_token(request['token'])['digest']==issued['digest']
history=rpc(users[2],'paramount_issue_history',[literal(w),literal(ident)])
assert len(history['issues'])==2
assert sum(e['event']=='signed' for e in history['events'])==1
assert request['token'] not in json.dumps(history)
rpc(users[3],'paramount_issue_history',[literal(w),literal(ident)],False)
for table in ['issues','signature_requests','issue_events']:
    for statement in [f'select * from paramount_sync.{table}',f'delete from paramount_sync.{table}']:
        as_user(users[0],statement,False)
        as_user('',statement,False,'anon')
sql(f"update paramount_sync.staff set active=false where user_id={literal(users[0])}")
issue(version=3,ok=False)
invite(next_issue,False)
print('PASS: workspace roles, stale/duplicate issue denial, frozen revisions/digests, single-use concurrent customer signatures, consent/name/digest validation, hashed tokens, expiry, revocation, supersession, preserved receipts, audit and cross-workspace/direct-table/revoked-staff denial')
