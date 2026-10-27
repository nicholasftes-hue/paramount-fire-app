const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const output=process.env.PARAMOUNT_DEMO_DIR||'/tmp/paramount-mark-demo-check/site';
const read=name=>fs.readFileSync(path.join(output,name),'utf8');
test('separate demo removes live integrations and every local script and asset exists',()=>{
 const html=read('index.html');assert.match(html,/Content-Security-Policy/);assert.match(html,/connect-src 'self'/);
 for(const name of fs.readdirSync(output))if(/\.(js|html)$/.test(name)){
  const source=read(name);assert.doesNotMatch(source,/supabase\.co|CLOUD_URL|CLOUD_KEY|access_token|refresh_token|cloudAuthorizedRequest|\/auth\/v1|\/rest\/v1|cloudLoginForm/);
  if(name.endsWith('.js'))new vm.Script(source,{filename:name});
 }
 for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[^" ]*)"/g))assert(fs.existsSync(path.join(output,m[1])),m[1]);
 assert.match(read('demo-notice.js'),/FICTIONAL DATA ONLY/);assert.match(html,/Fictional Example House/);assert.doesNotMatch(html,/type="password"/);
});
test('all demo navigation views render with isolated fictional storage and no network API',()=>{
 const html=read('index.html'),inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
 const elements=new Map(),storage=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',querySelectorAll:()=>[],insertAdjacentHTML(_p,s){this.innerHTML+=s}});return elements.get(id)};
 const context={console,URL,Date,JSON,Number,Set,Map,Object,Array,String,Error,FormData,Blob,crypto:require('node:crypto').webcrypto,window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,querySelector:()=>null,addEventListener:()=>{}},addEventListener:()=>{},setTimeout:()=>{},confirm:()=>true};
 vm.createContext(context);for(const script of inline)new vm.Script(script).runInContext(context);vm.runInContext(read('main-app.js'),context);
 const tabs=vm.runInContext('sections.slice()',context);assert(!tabs.includes('Cloud Properties'));
 for(const tab of tabs){vm.runInContext(`tab=${JSON.stringify(tab)};render()`,context);assert(el('view').innerHTML.length>50,tab)}
 assert.deepEqual([...storage.keys()],[]);assert.equal(context.fetch,undefined);
});
test('offline shell caches only included files, serves offline root and keeps other app caches',async()=>{
 const events={},stored=new Map(),deleted=[];
 const cache={async addAll(files){for(const f of files){assert(fs.existsSync(path.join(output,f)));stored.set(new URL(f,'https://example.test/demo/').href,new Response(f))}},async match(k){return stored.get(k)?.clone()},async put(){}};
 const context={URL,console,self:{registration:{scope:'https://example.test/demo/'},location:{origin:'https://example.test'},addEventListener:(n,f)=>events[n]=f,clients:{claim:()=>{}},skipWaiting:()=>{}},caches:{open:async()=>cache,keys:async()=>['paramount-shell-main-app-v7','paramount-demo-v1','paramount-mark-demo-shell-old','paramount-mark-demo-shell-v2'],delete:async k=>deleted.push(k)},fetch:async()=>{throw Error('offline')}};
 vm.createContext(context);vm.runInContext(read('service-worker.js'),context);
 let pending;events.install({waitUntil:p=>pending=p});await pending;
 let response;events.fetch({request:{url:'https://example.test/demo/',method:'GET'},respondWith:p=>response=p});assert.equal(await (await response).text(),'./index.html');
 events.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['paramount-mark-demo-shell-old']);
 let intercepted=false;events.fetch({request:{url:'https://external.example/test',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
