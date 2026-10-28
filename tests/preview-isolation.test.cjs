const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('preview contains no live credentials or cloud, email or signing clients',()=>{
 for(const name of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){const s=fs.readFileSync(path.join(root,name),'utf8');assert.doesNotMatch(s,/supabase\.co|sb_publishable_|CLOUD_KEY|CLOUD_URL|access_token|refresh_token|cloudAuthorizedRequest|\/auth\/v1|\/rest\/v1|SpeechRecognition|service_role|BEGIN PRIVATE KEY|mailto:/,name)}
 for(const name of ['index.html','index-3.html','academy-test.html']){const s=fs.readFileSync(path.join(root,name),'utf8');assert.match(s,/connect-src 'self'/);assert.match(s,/form-action 'none'/);assert.doesNotMatch(s,/type=["']password/)}
 assert(!fs.existsSync(path.join(root,'server')));assert(!fs.existsSync(path.join(root,'.env')));
});
test('all scripts parse and referenced local HTML assets exist',()=>{
 for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
 for(const name of ['index.html','index-3.html','academy-test.html']){const html=fs.readFileSync(path.join(root,name),'utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);for(const m of html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)(?:[^"']*)["']/g))assert(fs.existsSync(path.join(root,m[1])),name+' '+m[1])}
});
test('offline shell contains only existing isolated assets and reset uses only preview keys',()=>{
 const s=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');const assets=JSON.parse(s.match(/const ASSETS = (\[[^;]+\]);/)[1]);for(const f of assets)assert(fs.existsSync(path.join(root,f)),f);assert.match(s,/paramount-preview-69c45d4-shell/);assert.doesNotMatch(s,/key.startsWith\('paramount-mark|key.startsWith\('paramount-shell/);
 const notice=fs.readFileSync(path.join(root,'demo-notice.js'),'utf8');assert.doesNotMatch(notice,/localStorage\.clear/);assert.match(notice,/paramount-preview-workspace-69c45d4-v2:/);assert.match(notice,/FICTIONAL DATA ONLY/);
});
