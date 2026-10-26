const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function academy({stored = new Map(), blocked = false} = {}) {
  const handlers = {}, feedback = {}, result = {}, grid = {}, focus = [];
  const content = {innerHTML:'', querySelector:()=>({focus:()=>focus.push('heading')})};
  const workspace = {setAttribute(){}, focus:()=>focus.push('workspace'), scrollIntoView(){}};
  let returnHandler;
  const root = {
    querySelector(selector) {
      if (selector === '.academy-grid') return grid;
      if (selector === '[data-academy-return]') return {addEventListener:(_,f)=>returnHandler=f};
      if (selector === '#academy-result') return result;
      if (selector.startsWith('[data-academy-feedback=')) return feedback[selector] ||= {};
      return {focus:()=>focus.push(selector)};
    },
    addEventListener:(name, handler)=>handlers[name]=handler
  };
  const context = vm.createContext({
    cloudSession:null,
    document:{getElementById:id=>id==='academy'?root:content,querySelector:()=>workspace},
    sessionStorage:{getItem(key){if(blocked)throw Error('storage blocked');return stored.get(key)},setItem(key,value){if(blocked)throw Error('storage blocked');stored.set(key,value)}},
    FormData:class {constructor(form){this.answers=form.answers} has(key){return key in this.answers} get(key){return this.answers[key]}}
  });
  vm.runInContext(fs.readFileSync('academy.js','utf8'),context);
  return {
    stored, content, grid, focus, feedback, result, context,
    click(attr,value){handlers.click({target:{closest:()=>({dataset:{academySubject:value,academyLesson:value},hasAttribute:name=>name===attr})}})},
    submit(answers){handlers.submit({target:{id:'academy-quiz',answers:Object.fromEntries(answers.map((v,i)=>['q'+i,String(v)]))},preventDefault(){}})},
    returnToApp(){returnHandler()}
  };
}

const answers = {'fire-basics':[0,2,1],'fire-ctec':[1,2],'cctv-basics':[1,2,0],'cctv-faults':[2,0]};

test('all six subjects open; unpublished paths cannot be marked complete',()=>{
  const a=academy();
  for(const id of ['fire','cctv','electrical','intruder','lighting','skills']) {
    a.click('data-academy-subject',id);
    assert.equal(a.grid.hidden,true);
    assert.match(a.content.innerHTML,/<h3 tabindex="-1">/);
    if(!['fire','cctv'].includes(id)) {
      assert.match(a.content.innerHTML,/Lessons are not available yet/);
      assert.doesNotMatch(a.content.innerHTML,/data-academy-lesson=/);
    }
    assert.match(a.content.innerHTML,/No lessons published yet/);
    a.click('data-academy-home');
    assert.equal(a.grid.hidden,false);
    assert.equal(a.focus.at(-1),`[data-academy-subject="${id}"]`);
  }
  assert.equal(a.stored.size,0);
});

for(const [id,correct] of Object.entries(answers)) {
  test(`${id}: feedback, retry, pass and session progress`,()=>{
    const a=academy();
    a.click('data-academy-lesson',id);
    assert.match(a.content.innerHTML,/id="academy-quiz"/);
    assert.match(a.content.innerHTML,/required/);
    a.submit(correct.map(v=>(v+1)%3));
    assert.match(a.result.textContent,/No new completion was recorded/);
    assert.equal(a.stored.size,0);
    a.submit(correct);
    assert.match(a.result.textContent,/Knowledge check passed/);
    assert.equal(Object.keys(a.feedback).length,correct.length);
    const saved=JSON.parse(a.stored.get('paramount-academy-session-v1:guest'));
    assert.equal(saved[id].revision,1);
    a.click('data-academy-back');
    assert.match(a.content.innerHTML,/Knowledge check passed/);
    const reopened=academy({stored:a.stored});
    reopened.click('data-academy-subject',id.startsWith('fire')?'fire':'cctv');
    assert.match(reopened.content.innerHTML,/Knowledge check passed/);
    const fresh=academy();
    fresh.click('data-academy-subject',id.startsWith('fire')?'fire':'cctv');
    assert.doesNotMatch(fresh.content.innerHTML,/Knowledge check passed/);
  });
}

test('progress is separated by account; bad or blocked storage does not break lessons',()=>{
  const a=academy();
  a.context.cloudSession={user:{id:'engineer-one'}};
  a.click('data-academy-lesson','fire-basics');a.submit(answers['fire-basics']);
  assert(a.stored.has('paramount-academy-session-v1:engineer-one'));
  a.context.cloudSession={user:{id:'engineer-two'}};
  a.click('data-academy-subject','fire');
  assert.doesNotMatch(a.content.innerHTML,/Knowledge check passed/);
  for(const stored of ['invalid json','null','42']) {
    const b=academy({stored:new Map([['paramount-academy-session-v1:guest',stored]])});
    assert.doesNotThrow(()=>b.click('data-academy-subject','fire'));
  }
  const b=academy({blocked:true});b.click('data-academy-lesson','fire-basics');b.submit(answers['fire-basics']);
  assert.match(b.result.textContent,/progress could not be saved/);
});

test('return control focuses the existing workspace without replacing it',()=>{
  const a=academy();a.returnToApp();assert.equal(a.focus.at(-1),'workspace');
});
