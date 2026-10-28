const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

function lessonData() {
  const source=fs.readFileSync('academy.js','utf8');
  return vm.runInNewContext(source.slice(source.indexOf('  const lessons = {'),source.indexOf('  let currentSubject'))+'; lessons');
}
test('all four original lessons, quizzes and exercises match remote 03faa09',()=>{
  const lessons=lessonData();
  for(const [id,expected] of Object.entries(require('./original-lessons.json'))) {
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(lessons[id])).digest('hex'),expected,id);
  }
});
test('each additional lesson has six complete questions and a supervised exercise',()=>{
  const lessons=lessonData();
  assert.equal(Object.keys(lessons).length,22);
  for(const id of Object.keys(lessons).filter(id=>!Object.keys(require('./original-lessons.json')).includes(id))) {
    const lesson=lessons[id];
    assert.match(lesson.body,/Supervised exercise/);
    assert.match(lesson.body,/Draft/);
    assert.equal(lesson.questions.length,6);
    for(const q of lesson.questions) {
      assert(q.q && q.why);
      assert.equal(q.options.length,3);
      assert(Number.isInteger(q.answer) && q.answer>=0 && q.answer<q.options.length);
    }
  }
});

