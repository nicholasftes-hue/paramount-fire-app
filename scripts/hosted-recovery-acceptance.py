"""Owner-approved disposable hosted projects only. No restore or mail is implicit.
backup: capture a complete private archive and inventory.
verify: after a supported operator restore, compare DB/auth/storage and object bytes.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid
from urllib.parse import urlparse, quote
from urllib.request import Request, urlopen

PRODUCTION = 'ehlfgmfjzwfsudowaxku'
SCHEMAS = ('paramount_sync', 'auth', 'storage')

def validate(config):
    assert config['version'] == 1
    assert config['synthetic_only'] is True and config['owner_approved_disposable'] is True
    assert config['owner'] and config['approval_reference']
    assert re.fullmatch(r'[a-f0-9]{40}', config['source_sha'])
    assert config['synthetic_user_ids'] and len(set(config['synthetic_user_ids'])) == len(config['synthetic_user_ids'])
    assert all(str(uuid.UUID(u)) == u for u in config['synthetic_user_ids'])
    assert config['rpo_seconds'] >= 0 and config['rto_seconds'] > 0
    refs = [config[k] for k in ('source_ref', 'target_ref')]
    assert len(set(refs)) == 2
    assert all(re.fullmatch(r'[a-z0-9]{20}', ref) and ref != PRODUCTION for ref in refs)
    assert config['objects'], 'At least one synthetic storage object is required'
    for obj in config['objects']:
        assert obj['bucket'].startswith('acceptance-') and obj['path'].startswith('synthetic/')
        assert not any(p in ('', '.', '..') for p in obj['path'].split('/'))
        assert re.fullmatch(r'[a-f0-9]{64}', obj['sha256'])
    return config

def environment(config, side):
    # Never print credentials or pass them on a process command line.
    value = os.environ['PARAMOUNT_'+side.upper()+'_DB_URL']
    url = urlparse(value)
    assert url.scheme in ('postgres', 'postgresql')
    assert url.hostname == 'db.'+config[side+'_ref']+'.supabase.co'
    assert url.port in (None, 5432) and url.path == '/postgres' and not url.query and not url.fragment
    assert url.username == 'postgres' and url.password
    from urllib.parse import unquote
    # Strip inherited libpq selectors: PGHOSTADDR/PGSERVICE could redirect a validated host.
    clean_env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    return {**clean_env, 'PGSSLROOTCERT': os.environ.get('PGSSLROOTCERT', '/etc/ssl/certs/ca-certificates.crt'), 'PGHOST': url.hostname, 'PGPORT': '5432', 'PGDATABASE': 'postgres',
            'PGUSER': 'postgres', 'PGPASSWORD': unquote(url.password), 'PGSSLMODE': 'verify-full',
            'PGCONNECT_TIMEOUT': '15', 'PGOPTIONS': '-c statement_timeout=60000'}

def command(args, env, text=None):
    result = subprocess.run(args, env=env, input=text, text=True, capture_output=True, timeout=900)
    if result.returncode:
        raise RuntimeError('Hosted database command failed; inspect privately (credentials redacted)')
    return result.stdout.strip()

def inventory(config, side):
    env = environment(config, side)
    def sql(query):
        return command(['psql', '-XqAt', '-v', 'ON_ERROR_STOP=1'], env, query)
    tables = sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('paramount_sync','auth','storage') order by 1").splitlines()
    assert all(any(t.startswith(s+'.') for t in tables) for s in SCHEMAS), 'Missing application/auth/storage schema'
    rows = {}
    for table in tables:
        assert re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', table)
        # Hash inside PostgreSQL: credentials/PII are never returned to this process.
        rows[table] = sql("select count(*)||':'||encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from "+table+" t) q")
    users = json.loads(sql("select coalesce(json_agg(id::text order by id),'[]'::json) from auth.users"))
    assert sorted(users) == sorted(config['synthetic_user_ids']), 'Unexpected identities: synthetic-only assertion failed'
    schema = command(['pg_dump', '--schema-only', '--schema=paramount_sync', '--schema=public', '--no-owner'], env)
    # pg_dump emits random restrict keys and version comments; retain actual DDL/ACL/RLS.
    schema = '\n'.join(line for line in schema.splitlines() if not line.startswith(('--', '\\restrict ', '\\unrestrict ')))
    objects = {}
    for obj in config['objects']:
        token = os.environ['PARAMOUNT_'+side.upper()+'_SERVICE_KEY']
        route = '/storage/v1/object/authenticated/'+quote(obj['bucket'], safe='')+'/'+quote(obj['path'], safe='/')
        request = Request('https://'+config[side+'_ref']+'.supabase.co'+route,
                          headers={'apikey': token, 'Authorization': 'Bearer '+token})
        with urlopen(request, timeout=30) as response:
            data = response.read(2097153)
        assert len(data) <= 2097152
        digest = hashlib.sha256(data).hexdigest()
        assert digest == obj['sha256'], 'Synthetic storage object hash mismatch'
        objects[obj['bucket']+'/'+obj['path']] = digest
    return {'tables': rows, 'schema_sha256': hashlib.sha256(schema.encode()).hexdigest(), 'objects': objects}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['backup', 'verify'])
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--private-directory', required=True)
    args = parser.parse_args()
    config = validate(json.loads(Path(args.manifest).read_text()))
    os.umask(0o077)
    directory = Path(args.private_directory).resolve()
    assert not directory.is_relative_to(Path.cwd().resolve()), 'Keep archives outside the checkout'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    assert directory.stat().st_mode & 0o077 == 0, 'Private directory permissions required'
    evidence_path = directory/'recovery.json'
    archive = directory/'synthetic.pgdump'
    if args.phase == 'backup':
        assert not evidence_path.exists() and not archive.exists(), 'Never overwrite recovery evidence'
        before = inventory(config, 'source')
        started = time.time()
        command(['pg_dump', '--format=custom', '--file', str(archive)], environment(config, 'source'))
        assert inventory(config, 'source') == before, 'Source changed; freeze synthetic writes and retry'
        evidence = {'version': 1, 'manifest': config, 'backup_started': started, 'backup_finished': time.time(),
                    'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'source': before,
                    'status': 'RESTORE AND HUMAN ACCEPTANCE PENDING'}
        evidence_path.write_text(json.dumps(evidence, indent=2))
        print('Private backup captured. Supported isolated target restore is required before verify.')
    else:
        evidence = json.loads(evidence_path.read_text())
        assert evidence['manifest'] == config
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == evidence['archive_sha256'], 'Corrupt archive'
        assert inventory(config, 'source') == evidence['source'], 'Source changed during drill'
        assert inventory(config, 'target') == evidence['source'], 'Restored DB/auth/storage/ACL or object bytes differ'
        # Operator records actual restore start/end, recovered checkpoint and manual auth/denial checks.
        checks = json.loads((directory/'operator-restore.json').read_text())
        assert checks['source_ref'] == config['source_ref'] and checks['target_ref'] == config['target_ref']
        assert checks['archive_sha256'] == evidence['archive_sha256'] and checks['source_sha'] == config['source_sha']
        assert checks['reviewer'] and checks['provider_restore_evidence']
        for gate in ('auth_signin', 'anonymous_denied', 'foreign_user_denied', 'revoked_user_denied',
                     'worker_disabled', 'no_duplicate_delivery', 'storage_private', 'scanner_quarantine'):
            assert checks[gate] == 'PASS', gate+' needs actual acceptance evidence'
        assert 0 <= checks['measured_rpo_seconds'] <= config['rpo_seconds']
        assert 0 <= checks['restore_finished']-checks['restore_started'] <= config['rto_seconds']
        evidence.update(status='PASS ISOLATED RECOVERY ONLY', operator=checks, verified_at=time.time())
        evidence_path.write_text(json.dumps(evidence, indent=2))
        print('PASS isolated hosted restore comparison and recorded human gates; no production approval.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('BLOCKED: hosted recovery acceptance failed; inspect private configuration/evidence. No success claimed.')
