const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const html=fs.readFileSync('mark-demo-standalone.html','utf8');
test('standalone HTML has demo identification and core sections',()=>{for(const token of ['DEMO ONLY','Fictional records','id="home"','id="jobs"','id="academy"','id="quotes"','Reset demo data'])assert.ok(html.includes(token),token)});
test('no cloud, remote scripts, auth or production credentials',()=>{for(const re of [/supabase/i,/https?:\/\//i,/<script[^>]+src=/i,/\bfetch\s*\(/i,/XMLHttpRequest/i,/WebSocket/i,/sendBeacon/i,/serviceWorker\.register/i,/indexedDB/i])assert.doesNotMatch(html,re)});
test('local data isolated by dedicated key',()=>{assert.match(html,/paramount-isolated-demo-2026-10-27/);assert.match(html,/localStorage\.setItem/);assert.match(html,/localStorage\.removeItem/)});
test('renders user notes safely',()=>assert.match(html,/escapeText\(r\.property\)/));
test('responsive viewport and accessible controls',()=>{assert.match(html,/name="viewport"/);assert.match(html,/<label>/);assert.match(html,/aria-live="polite"/)});
test('inline script parses',()=>{const vm=require('node:vm');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1])});
