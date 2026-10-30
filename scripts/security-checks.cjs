'use strict';
// Bounded source checks supplement dependency audits and adversarial tests; not a penetration test.
const fs=require('node:fs'),vm=require('node:vm');
const files=fs.readFileSync(0,'utf8').split('\0').filter(Boolean),findings=[];
function inspect(file,text){
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{32,}/.test(text))findings.push(file+': private key material');
 if(/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk_live_[A-Za-z0-9]{20,})\b/.test(text))findings.push(file+': credential-shaped token');
 for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){try{if(['service_role','supabase_admin'].includes(JSON.parse(Buffer.from(match[1],'base64url')).role))findings.push(file+': privileged JWT');}catch{}}
 if(/\.(?:c?js)$/.test(file))try{new vm.Script(text,{filename:file});}catch{findings.push(file+': JavaScript parse failure');}
}
for(const f of files){if(!/\.(?:js|cjs|html|json|yml|yaml|sql|py|md|txt)$/.test(f))continue;inspect(f,fs.readFileSync(f,'utf8'));}
if(!files.length)throw Error('Supply git ls-files -z on stdin.');
const shell=fs.readFileSync('service-worker.js','utf8');if(/shared-template|team-sync/.test(shell))findings.push('Shared authenticated data must not enter the public service-worker shell');
for(const f of fs.readdirSync('sql').filter(f=>f.endsWith('-isolated.sql'))){const sql=fs.readFileSync('sql/'+f,'utf8');if(!sql.includes("paramount.isolated_sync_test")||!sql.includes("set search_path=''"))findings.push(f+': missing isolation/search-path guard');}
if(findings.length){for(const finding of findings)console.error(finding);process.exitCode=1;}else console.log('PASS: tracked-source credential patterns, JavaScript parsing, isolated SQL guards and private-cache boundary ('+files.length+' files)');
