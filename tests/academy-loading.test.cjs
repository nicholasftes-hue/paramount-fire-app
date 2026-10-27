// No dependencies or network required. Exercises the actual Academy module with
// a small DOM/event adapter; these are not full-browser rendering tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'academy.js'), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function fixture(readyState='complete', present=true) {
  const listeners = {}, documentListeners = {}, storage = new Map(), feedback = {};
  const status = {textContent:''}, result={textContent:''};
  const grid = {hidden:false};
  const content = {hidden:true, innerHTML:'', querySelector:()=>({focus(){}})};
  const root = {
    dataset:{},
    querySelector(selector) {
      if (selector === '.academy-grid') return grid;
      if (selector === '#academy-result') return result;
      if (selector.startsWith('[data-academy-feedback=')) return feedback[selector] ||= {innerHTML:''};
      return {focus(){},addEventListener(){}};
    },
    addEventListener(name, listener) {(listeners[name] ||= []).push(listener);}
  };
  const document = {
    readyState,
    getElementById(id) {return {academy:present?root:null,'academy-content':content,'academy-status':status}[id];},
    addEventListener(name, listener) {(documentListeners[name] ||= []).push(listener);}
  };
  const sandbox = vm.createContext({document, Date, FormData:class {
    constructor(form){this.answers=form.answers;}
    has(key){return Object.hasOwn(this.answers,key);}
    get(key){return this.answers[key];}
  }, sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
  vm.runInContext(source,sandbox);
  function click(attribute,value='') {
    const button={dataset:{[attribute.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:name=>name==='data-'+attribute};
    for (const fn of listeners.click || []) fn({target:{closest:()=>button}});
  }
  function quiz(answers,valid=true) {
    for (const fn of listeners.submit || []) fn({target:{id:'academy-quiz',answers,reportValidity:()=>valid},preventDefault(){}});
  }
  return {root,grid,content,listeners,documentListeners,storage,status,result,sandbox,click,quiz,setPresent(value){present=value;}};
}
const f=fixture('loading',false);
check(!f.root.dataset.academyReady,'Early script waits for DOM');
f.setPresent(true);
f.documentListeners.DOMContentLoaded[0]();
check(f.root.dataset.academyReady==='true','Initialises after DOM ready');
vm.runInContext(source,f.sandbox);
check(f.listeners.click.length===1,'Duplicate initialisation cannot duplicate handlers');
check(f.status.textContent.includes('Academy ready'),'Visible ready status');
for (const key of ['fire','cctv','electrical','intruder','lighting','skills']) {
  f.click('academy-subject',key);
  check(f.grid.hidden && !f.content.hidden,'Subject opens: '+key);
  check(f.content.innerHTML.includes('Intermediate')&&f.content.innerHTML.includes('Advanced'),'Three learning levels: '+key);
  f.click('academy-home');
  check(!f.grid.hidden && f.content.hidden,'Returns to cards: '+key);
}
for (const [key,answers] of Object.entries({'fire-basics':[0,2,1],'fire-ctec':[1,2],'cctv-basics':[1,2,0],'cctv-faults':[2,0], 'fire-servicing':[0,1,2,0,1,2], 'cctv-diagnosis':[1,0,2,1,0,2]})) {
  f.click('academy-lesson',key);
  check(f.content.innerHTML.includes('academy-quiz'),'Lesson and quiz open: '+key);
  const pass=Object.fromEntries(answers.map((value,i)=>['q'+i,String(value)]));
  f.quiz(pass,false);
  check(!f.storage.get('paramount-academy-session-v1:guest')?.includes('"'+key+'"'),'Incomplete quiz does not pass');
  f.quiz(Object.fromEntries(answers.map((value,i)=>['q'+i,String((value+1)%3)])));
  check(f.result.textContent.includes('No new completion'),'Wrong answers support retry: '+key);
  f.quiz(pass);
  check(f.result.textContent.includes('Knowledge check passed'),'Correct answers pass: '+key);
  check(JSON.parse(f.storage.get('paramount-academy-session-v1:guest'))[key].revision===1,'Session progress saved: '+key);
  f.click('academy-back');
  check(f.content.innerHTML.includes('Knowledge check passed'),'Path displays pass: '+key);
}
f.sandbox.cloudSession={user:{id:'another-user'}};
f.click('academy-subject','fire');
check(!f.content.innerHTML.includes('Knowledge check passed'),'Signed-in account does not inherit guest progress');
f.sandbox.sessionStorage.setItem=()=>{throw Error('blocked');};
f.click('academy-lesson','fire-ctec'); f.quiz({q0:'1',q1:'2'});
check(f.result.textContent.includes('could not be saved'),'Storage denial has an honest error state');
check(fixture().root.dataset.academyReady==='true','Late-loaded script initialises immediately');
check(fixture('loading').root.dataset.academyReady==='true','Existing cards initialise immediately even before DOMContentLoaded');
check(!fixture('complete',false).root.dataset.academyReady,'Missing host section does not throw');
for (const file of ['index.html','index-3.html','academy-test.html']) {
  const html=fs.readFileSync(path.join(base,file),'utf8');
  for (const [,attributes,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(attributes)) new vm.Script(body,{filename:file});
  }
  check(true,'Inline scripts parse: '+file);
}
for (const file of ['index-3.html','academy-test.html']) {
  const html=fs.readFileSync(path.join(base,file),'utf8');
  check((html.match(/data-academy-subject=/g)||[]).length===6,'Six native cards: '+file);
  check(html.includes('academy.js?v=academy-3'),'Current script version: '+file);
}
const standalone=fs.readFileSync(path.join(base,'academy-test.html'),'utf8');
check(!standalone.includes('app-updates.js')&&!standalone.includes('supabase.co'),'Standalone has no cloud or worker setup');
console.log(`PASS: ${checks} Academy logic, loading, quiz, storage, markup and syntax checks. Full-browser checks remain separate.`);

(async () => {
  const appHtml=fs.readFileSync(path.join(base,'index-3.html'),'utf8');
  const loader=fs.readFileSync(path.join(base,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const failAcademy of [false,true]) {
    let written='',closed=false;
    const appended=[],status={textContent:''};
    const document={
      open(){},write(html){written=html;},close(){closed=true;},
      createElement(){return {};},
      getElementById(id){return id==='academy-status'?status:null;},
      body:{append(script){
        check(closed && written.includes('id="academy"'),'Host markup exists before external module loading');
        appended.push(script.src);
        if (failAcademy && script.src.includes('academy.js')) script.onerror(); else script.onload();
      }}
    };
    await vm.runInNewContext(loader,{document,console,fetch:async()=>({ok:true,text:async()=>appHtml})});
    check(appended.join(',')==='./app-updates.js?v=academy-3,./academy.js?v=academy-3,./pdf-font.js?v=1,./main-app.js?v=main-app-2','Loader explicitly loads modules in order');
    check(!/<script\b[^>]*\bsrc=/.test(written),'Replacement markup contains no racing external script tags');
    check(written.includes('paramount-white-theme'),'White theme injection retained');
    if (failAcademy) check(status.textContent.includes('could not load'),'Module failure displays recoverable status');
  }
  console.log(`PASS: ${checks} total checks including document replacement/module ordering and load-failure recovery.`);
})().catch(error=>{console.error(error);process.exitCode=1;});


