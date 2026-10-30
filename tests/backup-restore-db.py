"""Called only by the disposable loopback database harness, after all synthetic fixtures."""
import hashlib
import tempfile

assert env['PGHOST'] == '127.0.0.1' and env['PGDATABASE'] == 'paramount_sync_test'
restore_db = 'paramount_restore_acceptance'
restore_env = {**env, 'PGDATABASE': restore_db}
def command(args, environment=env):
    result = subprocess.run(args, env=environment, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return result.stdout

def inventory():
    tables = sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('auth','paramount_sync') order by 1").splitlines()
    result = {}
    for table in tables:
        # Trusted catalog identifiers only, never a user-supplied restore target.
        assert all(part.replace('_','').isalnum() for part in table.split('.'))
        result[table] = hashlib.sha256(sql(f"select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) from (select to_jsonb(t) v from {table} t) rows").encode()).hexdigest()
    return result

before = inventory()
with tempfile.TemporaryDirectory(prefix='paramount-disposable-restore-') as tmp:
    archive = Path(tmp) / 'synthetic.pgdump'
    command(['pg_dump','--format=custom','--file',str(archive)])
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert archive_hash != hashlib.sha256(archive.read_bytes()[:-32]).hexdigest(), 'Corrupt backup must fail checksum validation'
    command(['createdb',restore_db])
    try:
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == archive_hash
        command(['pg_restore','--exit-on-error','--no-owner','--dbname',restore_db,str(archive)])
        original_env = env
        env = restore_env
        try:
            assert inventory() == before, 'Restored records, originals, revisions, audit, access, invitations or queue differ'
            restored_backup = json.loads(as_user(users[0],f"select public.paramount_template_backup({literal(w)})")[-1])
            for t in restored_backup['templates']:
                assert hashlib.sha256(base64.b64decode(t['content'])).hexdigest() == t['hash']
            as_user(users[2],f"select public.paramount_template_list({literal(w)})",False)
            as_user('',f"select public.paramount_sync_list({literal(w)})",False,'anon')
            as_user(users[1],'select * from paramount_sync.templates',False)
            # No worker tick or provider endpoint runs after restore: no duplicate mail is sent.
        finally:
            env = original_env
        assert inventory() == before, 'Source database changed during restore drill'
    finally:
        command(['dropdb',restore_db])
print('PASS isolated full database backup/restore: exact table contents, byte hashes, ACL/RLS/revoked denial, audit/revision/queue preservation, corruption checksum, source unchanged; no mail delivery')
