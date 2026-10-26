const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function worker() {
  const events={}, stored=new Map(),deleted=[];
  let network=async()=>new Response('fresh'), writeFails=false, skipped=0,claimed=0;
  const cache={
    async addAll(paths){for(const path of paths)stored.set(new URL(path,'https://example.test/app/').href,new Response(path))},
    async match(key){return stored.get(key)?.clone()},
    async put(key,value){if(writeFails)throw Error('quota');stored.set(key,value)}
  };
  const context=vm.createContext({URL,console,
    self:{registration:{scope:'https://example.test/app/'},location:{origin:'https://example.test'},addEventListener:(n,f)=>events[n]=f,skipWaiting:()=>skipped++,clients:{claim:()=>claimed++}},
    caches:{open:async()=>cache,keys:async()=>['other-app-cache','paramount-shell-academy-v1','paramount-demo-v1','paramount-shell-academy-v4'],delete:async key=>deleted.push(key)},
    fetch:(...args)=>network(...args)
  });
  vm.runInContext(fs.readFileSync('service-worker.js','utf8'),context);
  return {stored,deleted,
    setNetwork(fn){network=fn},failWrites(){writeFails=true},
    async lifecycle(name){let p;events[name]({waitUntil:v=>p=v});await p},
    message(type){events.message({data:{type}})},
    get skipped(){return skipped},get claimed(){return claimed},
    request(path,method='GET'){let response;events.fetch({request:{url:new URL(path,'https://example.test/app/').href,method},respondWith:p=>response=p});return response}
  };
}

test('offline installation includes every shell asset and both PWA icons',async()=>{
  const w=worker();await w.lifecycle('install');
  for(const path of ['index.html','index-3.html','academy.js','academy.css','app-updates.js','manifest.webmanifest','icon-192.png','icon-512.png','academy-test.html']) {
    assert(w.stored.has('https://example.test/app/'+path));assert(fs.existsSync(path));
  }
  assert.equal(w.skipped,0);w.message('ignored');assert.equal(w.skipped,0);
  w.message('ACTIVATE_UPDATE');assert.equal(w.skipped,1);
});

test('offline requests support the loader, root URL and versioned assets',async()=>{
  const w=worker();await w.lifecycle('install');w.setNetwork(async()=>{throw Error('offline')});
  for(const path of ['./','index.html','index-3.html?white-dashboard-v9=20261023','academy.js?v=academy-1','academy.css?v=academy-1','icon-192.png'])assert((await w.request(path)).ok);
});

test('auth, database traffic, unrelated files and POST requests are never cached',()=>{
  const w=worker();
  for(const path of ['https://example.supabase.co/auth/v1/token','https://example.supabase.co/rest/v1/properties','unrelated.json'])assert.equal(w.request(path),undefined);
  assert.equal(w.request('academy.js','POST'),undefined);
});

test('successful network response survives cache quota failure',async()=>{
  const w=worker();await w.lifecycle('install');w.failWrites();
  assert.equal(await (await w.request('academy.js')).text(),'fresh');
});

test('temporary HTTP failure serves the cached shell when available',async()=>{
  const w=worker();await w.lifecycle('install');w.setNetwork(async()=>new Response('unavailable',{status:503}));
  const response=await w.request('index-3.html');assert.equal(response.status,200);assert.equal(await response.text(),'./index-3.html');
});

test('activation deletes only obsolete Paramount caches',async()=>{
  const w=worker();await w.lifecycle('activate');
  assert.deepEqual(w.deleted,['paramount-shell-academy-v1','paramount-demo-v1']);assert.equal(w.claimed,1);
});
