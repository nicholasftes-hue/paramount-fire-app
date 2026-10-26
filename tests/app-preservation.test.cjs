const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

test('entire existing app script matches main 0e882fb (auth, records, forms and billing)',()=>{
  const html=fs.readFileSync('index-3.html','utf8');
  const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].trim();
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'9bdb0189d3ec99f62ad1d6214377e45552fb0868f26eacee0da7b46413774783');
});

test('all standalone and inline JavaScript parses',()=>{
  for(const path of ['academy.js','app-updates.js','service-worker.js'])new vm.Script(fs.readFileSync(path,'utf8'),{filename:path});
  for(const path of ['index.html','index-3.html']) {
    for(const match of fs.readFileSync(path,'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:path});
  }
});

test('white theme, all six accessible subject buttons and local assets remain available',()=>{
  const html=fs.readFileSync('index-3.html','utf8');
  assert.match(html,/WHITE DASHBOARD/);assert.match(html,/background:#ffffff!important/);
  for(const id of ['fire','cctv','electrical','intruder','lighting','skills'])assert.match(html,new RegExp('<button[^>]+type="button"[^>]+data-academy-subject="'+id+'"[^>]+aria-controls="academy-content"'));
  for(const path of ['academy.js','academy.css','app-updates.js'])assert(html.includes('./'+path));
  const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
  for(const icon of manifest.icons)assert(fs.existsSync(icon.src));
});
