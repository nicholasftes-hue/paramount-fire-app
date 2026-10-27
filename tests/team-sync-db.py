"""Disposable PostgreSQL only: emulates Supabase auth.uid; never reads app config."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import uuid

# Explicit loopback-only test database. No arbitrary production DSN accepted.
port = os.environ.get('PARAMOUNT_TEST_PG_PORT', '55432')
assert port.isdigit()
env = {**os.environ, 'PGHOST': '127.0.0.1', 'PGPORT': port,
       'PGDATABASE': 'paramount_sync_test', 'PGUSER': 'postgres', 'PGPASSWORD': 'fictional-local-test'}
def sql(text, ok=True):
    p = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=text, text=True, capture_output=True, env=env)
    if ok:
        assert p.returncode == 0, p.stderr
    else:
        assert p.returncode != 0, 'Expected access/validation rejection'
    return p.stdout.strip()

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def as_user(user, statement, ok=True, role='authenticated'):
    return sql(f"begin; set local role {role}; select set_config('request.jwt.claim.sub',{literal(user)},true); {statement}; commit;", ok).splitlines()[-1:]

def uid():
    return str(uuid.uuid4())

w, other, prop = uid(), uid(), uid()
users = [uid() for _ in range(4)]
sql("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;")
migration = Path('sql/team-sync-isolated.sql').read_text()
# A conflicting public RPC must survive a rejected migration unchanged.
sql("create function public.paramount_sync_list(text) returns text language sql as $$select 'existing'::text$$;")
sql("set paramount.isolated_sync_test='yes';" + migration, False)
assert sql("select to_regnamespace('paramount_sync') is null") == 't'
assert sql("select public.paramount_sync_list('sentinel'::text)") == 'existing'
sql("drop function public.paramount_sync_list(text);")
sql(migration, False)  # Missing explicit isolated-test acknowledgement rolls back.
assert sql("select to_regnamespace('paramount_sync') is null") == 't'
sql("set paramount.isolated_sync_test='yes';" + migration)
sql("set paramount.isolated_sync_test='yes';" + migration, False)  # Never clobber an existing schema.
sql('insert into auth.users values ' + ','.join('('+literal(u)+')' for u in users) + ';')
sql(f"insert into paramount_sync.workspaces values ({literal(w)},'Fictional team'),({literal(other)},'Other team');")
for slot, user in enumerate(users[:3], 1):
    sql(f"insert into paramount_sync.staff(workspace_id,user_id,slot) values ({literal(w)},{literal(user)},{slot});")
sql(f"insert into paramount_sync.staff(workspace_id,user_id,slot) values ({literal(w)},{literal(users[3])},4);", False)
for user in users[:3]:
    assert as_user(user, f"select public.paramount_sync_list({literal(w)})") == ['[]']
as_user(users[3], f"select public.paramount_sync_list({literal(w)})", False)
as_user('', f"select public.paramount_sync_list({literal(w)})", False, 'anon')
as_user(users[0], f"select public.paramount_sync_list({literal(other)})", False)
for statement in ['select * from paramount_sync.documents', 'select * from paramount_sync.staff', 'delete from paramount_sync.operations', 'update paramount_sync.staff set active=true']:
    as_user(users[0], statement, False)

def write(user, ident, kind, parent, payload, version=0, op=None, ok=True):
    args = [literal(w), literal(ident), literal(kind), literal(parent) if parent else 'null', literal(json.dumps(payload))+'::jsonb', str(version), literal(op or uid())]
    result = as_user(user, 'select public.paramount_sync_write('+','.join(args)+')', ok)
    return json.loads(result[-1]) if ok else None

site = {'id':prop, 'name':'Fictional site', 'panel':'TEST', 'last':'2026-10-27', 'months':'6'}
op = uid()
first = write(users[0], prop, 'property', None, site, op=op)
assert first['version'] == 1 and first['updated_by'] == users[0]
assert write(users[0], prop, 'property', None, site, op=op) == first
write(users[1], prop, 'property', None, site, op=op, ok=False)
write(users[0], prop, 'property', None, {**site,'name':'Reused op'}, op=op, ok=False)
write(users[1], prop, 'property', None, site, version=0, ok=False)

# Real competing database connections: exactly one CAS update succeeds.
def concurrent_write(user):
    try:
        return write(user, prop, 'property', None, {**site,'name':user}, version=1)
    except AssertionError:
        return None
with concurrent.futures.ThreadPoolExecutor() as pool:
    results = list(pool.map(concurrent_write, users[:2]))
assert sum(r is not None for r in results) == 1

required = {
    'service': ['engineer','system','standard','tests','battery','measurements','defects','actions','recipient','declaration'],
    'pat': ['engineer','instrument','calibration','asset','appliance','location','equipmentClass','visual','tests','outcome','defects'],
    'lighting': ['engineer','system','location','testType','tests','defects','actions'],
}
for kind, fields in required.items():
    ident = uid()
    values = {f:'Fictional result' for f in fields}
    values.update(property=prop, reviewed='yes', date='2026-10-27')
    if kind == 'lighting':
        values.update(testType='Duration test', duration='180')
    payload = dict(id=ident, kind=kind, values=values, history=[], revision=1, created='fixture', updated='fixture', siteSnapshot={'id':prop,'name':'Frozen site'})
    write(users[0], ident, kind, prop, {**payload, 'values':{**values,'reviewed':''}}, ok=False)
    if kind == 'lighting':
        write(users[0], ident, kind, prop, {**payload,'values':{**values,'duration':'0'}}, ok=False)
    saved = write(users[0], ident, kind, prop, payload)
    revised = {**payload, 'values':{**values,'tests':'Revised fictional result'}, 'revision':2,
               'history':[dict(revision=1,values=values,updated='fixture',siteSnapshot=payload['siteSnapshot'])]}
    write(users[1], ident, kind, prop, {**revised,'history':[]}, version=1, ok=False)
    assert write(users[1], ident, kind, prop, revised, version=1)['version'] == 2
    write(users[0], ident, kind, prop, payload, version=1, ok=False)
    assert saved['payload']['siteSnapshot']['name'] == 'Frozen site'
assert len(json.loads(as_user(users[2], f"select public.paramount_sync_list({literal(w)})")[-1])) == 4
sql(f"begin; select 1 from paramount_sync.workspaces where id={literal(w)} for update; update paramount_sync.staff set active=false where user_id={literal(users[2])}; commit;")
as_user(users[2], f"select public.paramount_sync_list({literal(w)})", False)
write(users[2], prop, 'property', None, site, version=2, ok=False)
assert sql("select count(*) from paramount_sync.operations") == '8'
print('PASS: isolated migration rollback/reapply guards, RLS/direct access denial, three staff, fourth/anonymous/foreign/revoked denial, real concurrent CAS, idempotency, property/service/PAT/lighting validation and immutable audit/revisions')

