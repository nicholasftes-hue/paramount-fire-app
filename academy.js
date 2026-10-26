/* Additive Academy module: never writes to the existing service database. */
(() => {
  'use strict';
  const root = document.getElementById('academy');
  if (!root) return;
  const content = document.getElementById('academy-content');
  const grid = root.querySelector('.academy-grid');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const subjects = {
    fire: {name:'Fire Alarm Systems', lessons:['fire-basics','fire-ctec'], next:'Servicing records and supervised fault diagnosis'},
    cctv: {name:'CCTV Systems', lessons:['cctv-basics','cctv-faults'], next:'Authorised recorder setup, networking and customer handover'},
    electrical: {name:'Electrical', lessons:[], next:'Safe working, isolation awareness and electrical fundamentals'},
    intruder: {name:'Intruder Alarms', lessons:[], next:'Panels, detectors, secure access and supervised commissioning'},
    lighting: {name:'Emergency Lighting', lessons:[], next:'Maintained/non-maintained systems and test records'},
    skills: {name:'Engineer Skills and General Fault Finding', lessons:[], next:'Site safety, evidence, reporting and systematic diagnosis'}
  };
  const lessons = {
    'fire-basics': {
      title:'Fire alarms: systems, components and safe observation', subject:'fire', minutes:8,
      body:`<p><b>Goal:</b> recognise the main components and describe a fault accurately before supervised practical training. This lesson does not authorise testing, isolation, commissioning or servicing.</p>
      <h4>1. What the system does</h4><p>Automatic detectors and manual call points signal a control panel. The panel indicates the event and operates the configured warning and interface outputs. An interface may connect other equipment; its operation must be understood from the site cause-and-effect documentation.</p>
      <ol class="academy-steps" aria-label="Conceptual signal path"><li>Detector or call point<br>Detects/reports an event</li><li>Control panel<br>Indicates and processes</li><li>Sounders / interfaces<br>Configured response</li></ol><p><small>Concept diagram only, not a wiring or installation drawing.</small></p>
      <h4>2. Conventional versus addressable</h4><p>A conventional system groups detection devices into circuits associated with zones. A zone indication identifies an area; it does not necessarily identify the individual device. An addressable system communicates with addressed devices, commonly on loops, and can identify a device or address. A loop and a zone are different concepts: a zone describes an area, while a loop is a circuit arrangement. Always use the actual panel and site records.</p>
      <h4>3. Recognise components</h4><ul><li>Detectors: types and siting depend on the design and environment.</li><li>Manual call points: a person can raise an alarm.</li><li>Sounders and visual alarm devices: warn occupants as designed.</li><li>Power supply and standby batteries: support the system during supply interruption. Batteries can deliver dangerous short-circuit current.</li></ul>
      <h4>4. Safe first observations</h4><ol><li>Follow site access, induction and emergency arrangements. If there is a fire indication, smoke or other evidence of fire, follow the site emergency procedure immediately.</li><li>Without operating controls, record the panel make/model, displayed indication, location, time and reported symptoms.</li><li>Tell the responsible person and authorised competent engineer. Record restrictions and agreed follow-up.</li></ol><p>Do not silence, reset, disable circuits, open the enclosure, disconnect batteries or trigger a test from this lesson. A fault indication is not proof of a safe system. Planned tests require an authorised procedure, site coordination and arrangements for any monitoring centre and affected equipment.</p>
      <h4>5. Requirements and records</h4><p>UK requirements depend on the premises, jurisdiction, risk assessment and system design. BS 5839-1 and BS 5839-6 cover different contexts; use the applicable current requirements and manufacturer instructions with a competent supervisor. Do not infer a servicing interval from this lesson.</p>`,
      questions:[
        {q:'A conventional zone indication usually identifies…', options:['An area requiring investigation','A guaranteed individual detector address','A confirmed safe system'], answer:0, why:'Conventional zones identify areas; use the site zone chart and authorised investigation.'},
        {q:'A new starter sees a panel fault. What is the appropriate first action?', options:['Disconnect the standby battery','Reset repeatedly until clear','Record the indication and report it through the authorised procedure'], answer:2, why:'Record and escalate. Do not operate life-safety controls without authorisation.'},
        {q:'Does completing this lesson qualify someone to service a fire alarm?', options:['Yes, on conventional panels','No; competence, supervised practice and authorisation are separate','Yes, if the quiz is passed'], answer:1, why:'A knowledge check is not a qualification or practical competency assessment.'}
      ]
    },
    'fire-ctec': {
      title:'C-TEC conventional panels: identify before acting', subject:'fire', minutes:6,
      body:`<p><b>Goal:</b> prepare a reliable observation record for a supervisor. This is a model-identification lesson, not a control-button procedure.</p><h4>1. Identify the exact product</h4><p>C-TEC makes different products, including conventional panel families. Record the model from an accessible external label and note the number of zones shown. Do not assume instructions for one family or revision apply to another.</p><h4>2. Locate the matching instructions</h4><ol><li>Use C-TEC's official website and identify the exact product.</li><li>Obtain the matching user and installation/maintenance documentation, checking revision and applicability.</li><li>Ask the supervisor to confirm the site zone chart, cause-and-effect records and permitted work scope.</li></ol><h4>3. Describe indicators without guessing</h4><p>Record the exact labels, colours, steady/flashing state and any audible indication. Fire, fault and disablement indications describe different conditions; interpret them using the matching manual. Do not assume a healthy-looking display proves all devices or outputs work.</p><h4>4. Stop and escalate</h4><p>Wrong or missing manual, unclear indication, signs of damage, exposed conductors or uncertainty about the site's arrangements → stop practical work and consult the responsible person and competent supervisor. Fire indications → follow the site emergency procedure. Never bypass a fault or disable an output to make a panel appear normal.</p><h4>Supervised practice to arrange separately</h4><p>On an authorised training rig, a supervisor can demonstrate the matching panel controls and explain the planned test and restoration checks. This release deliberately contains no model-specific button sequences, wiring details or battery test limits until the exact manuals are verified.</p>`,
      questions:[
        {q:'Which instructions should be used?', options:['Any conventional panel guide','The matching model and applicable revision, confirmed by a supervisor','A similar-looking panel video'], answer:1, why:'Panel families and revisions differ. Exact documentation matters.'},
        {q:'The matching manual cannot be found. What next?', options:['Try controls until they respond','Use another manufacturer’s sequence','Stop practical work and ask the competent supervisor'], answer:2, why:'Do not improvise life-safety procedures.'}
      ]
    },
    'cctv-basics': {
      title:'CCTV from the beginning: camera to recording', subject:'cctv', minutes:8,
      body:`<p><b>Goal:</b> for Mark and other beginners, explain where the picture travels and what each device does. No installation experience is assumed.</p><h4>1. The basic idea</h4><p>A camera captures a scene. A connection carries its video to a recorder or supported storage service. A monitor or authorised app displays live or recorded images. Live view alone does not prove recording works.</p><ol class="academy-steps" aria-label="Conceptual CCTV signal path"><li>Camera<br>Captures the view</li><li>Cable / network<br>Carries video</li><li>DVR / NVR<br>Records to storage</li><li>Authorised viewing<br>Live / playback</li></ol><p><small>Concept diagram; actual power and network arrangements vary by product.</small></p><h4>2. Common system types</h4><ul><li>Analogue and HD-over-coax: usually use coaxial video cabling and a compatible DVR. Video formats and recorder compatibility must match.</li><li>IP cameras: send network data, commonly to an NVR. Each device needs suitable addressing and connectivity.</li><li>PoE: compatible equipment supplies power and data over Ethernet. The switch/injector must support the required standard and total power budget.</li><li>Wireless: video may use Wi-Fi, but power is still required unless a suitable battery/solar design is used. Signal quality and supported recording arrangements matter.</li></ul><h4>3. Recorder and storage</h4><p>A DVR typically accepts compatible coax camera signals. An NVR records compatible network cameras. Hybrid products exist, so check the actual model. Storage depends on capacity, bitrate, camera count, schedule and retention policy. Check authorised playback and recording status rather than assuming footage exists.</p><h4>4. Privacy and account security</h4><p>Before positioning or enabling recording, confirm the customer's lawful purpose, field of view, access permissions, retention arrangements and signage with the responsible person. Avoid unnecessary views of neighbours or private areas. Follow current ICO guidance and the organisation's UK GDPR procedures.</p><p>Use named authorised accounts, strong unique passwords, current supported firmware and MFA where available. Do not publish recorder ports or share credentials to get remote viewing working. Use only the approved secure access method. Password recovery must use the manufacturer's authorised process and proof of ownership.</p><h4>5. First supervised exercise</h4><ol><li>On an authorised demonstration system, identify the camera, recorder, display and supported power source.</li><li>Draw the video path and label which connections carry power.</li><li>Ask a supervisor to demonstrate playback using permitted footage and explain retention and access controls.</li></ol>`,
      questions:[
        {q:'A live picture is visible. Does that prove recording works?', options:['Yes, always','No; authorised recording status and playback must also be checked','Only for wireless cameras'], answer:1, why:'Live viewing and stored recording are separate functions.'},
        {q:'What does compatible PoE equipment provide?', options:['Unlimited storage','Automatic permission to view footage','Power and data over Ethernet within supported limits'], answer:2, why:'PoE has compatibility and power-budget limits; it does not supply storage or access authority.'},
        {q:'A customer forgot a recorder password. What is appropriate?', options:['Verify ownership and use the authorised manufacturer recovery process','Try a password bypass tool','Share another customer’s account'], answer:0, why:'Account recovery requires authorisation and supported recovery channels.'}
      ]
    },
    'cctv-faults': {
      title:'CCTV: safe first checks and fault reporting', subject:'cctv', minutes:6,
      body:`<p><b>Goal:</b> record useful evidence and choose a safe next step without losing footage or weakening security.</p><h4>Start with permission and scope</h4><p>Confirm the site, affected camera/channel, exact symptom, when it began and any recent changes. Do not view or export footage beyond your authorisation. Photograph equipment labels or status messages only where permitted, avoiding passwords, access codes and personal footage.</p><h4>Decision tree: no picture</h4><ol><li><b>One camera affected?</b> Record the channel and error. A competent authorised engineer can check the supported power and cable path.</li><li><b>All cameras affected?</b> Record recorder/display status and whether the issue is local display, recording or remote access. Escalate with this distinction.</li><li><b>Local viewing works, remote viewing fails?</b> Record the approved app and connection error. Ask the authorised network administrator to check connectivity and permissions. Do not expose ports or disable security controls.</li></ol><h4>Recorder beeping or storage warning</h4><p>Record the exact message and time and inform the responsible person promptly. Beeping can have several causes, including storage or other exceptions. Do not format a disk, factory reset, erase recordings or silence warnings to hide the problem. A qualified authorised person should diagnose using the matching manual and evidence-preservation requirements.</p><h4>Manufacturer-specific next step</h4><p>For Hikvision, HiLook and Swann, record the exact camera and DVR/NVR models and firmware where accessible through an authorised account. Use the relevant official support documentation. Menus and supported recovery methods vary; this lesson does not invent shared button sequences.</p><h4>A useful handover note</h4><p>“Site / date / channel / reported symptom / observed message / scope affected / authorised checks performed / remaining risk / person notified / agreed next action.” Keep credentials out of notes.</p>`,
      questions:[
        {q:'A recorder beeps and shows a storage warning. What first?', options:['Format the drive','Factory reset the recorder','Record the warning and escalate without erasing evidence'], answer:2, why:'Preserve footage and evidence; diagnose through authorised support.'},
        {q:'Local viewing works but remote access fails. What is a suitable next step?', options:['Ask the authorised network administrator to check the approved access method','Disable the firewall','Publish recorder ports'], answer:0, why:'Use the approved secure path; do not weaken network controls.'}
      ]
    }
  };
  let currentSubject = null;
  let currentLesson = null;
  let lastSubject = 'fire';
  root.querySelector('[data-academy-return]')?.addEventListener('click', () => {
    const workspace = document.querySelector('main');
    if (!workspace) return;
    workspace.setAttribute('tabindex', '-1');
    workspace.focus();
    workspace.scrollIntoView({block:'start'});
  });
  function progressKey() {
    const user = typeof cloudSession !== 'undefined' && cloudSession?.user?.id;
    return 'paramount-academy-session-v1:' + (user || 'guest');
  }
  function progress() {
    try { const data = JSON.parse(sessionStorage.getItem(progressKey()) || '{}'); return data && typeof data === 'object' ? data : {}; } catch { return {}; }
  }
  function show(markup) {
    grid.hidden = true;
    content.hidden = false;
    content.innerHTML = markup;
    const heading = content.querySelector('h3');
    heading?.focus();
  }
  function home() { currentSubject=null; currentLesson=null; content.hidden=true; grid.hidden=false; root.querySelector(`[data-academy-subject="${lastSubject}"]`)?.focus(); }
  const notice = '<p class="academy-notice">Learning and quizzes are not qualifications, practical competency assessments or permission to work. Practical tasks require appropriate competence, supervision and authorisation.</p>';
  function subject(id) {
    const item = subjects[id]; if (!item) return;
    currentSubject=id; currentLesson=null;
    lastSubject=id;
    const done=progress();
    show(`<button type="button" data-academy-home>← All subjects</button><h3 tabindex="-1">${item.name}</h3>${notice}<p>Progress is for this browser tab/session only, separated by signed-in account where available. It is not synced to Supabase or an official staff competency record.</p>
      <section class="academy-level"><h4>Beginner</h4>${item.lessons.length ? item.lessons.map(key=>`<button class="academy-lesson-link" type="button" data-academy-lesson="${key}">${lessons[key].title} · ${lessons[key].minutes} min${done[key] ? ' · Knowledge check passed' : ''}</button>`).join('') : `<p class="academy-planned">Planned — ${item.next}. Lessons are not available yet.</p>`}</section>
      <section class="academy-level"><h4>Intermediate</h4><p class="academy-planned">Planned — supervised application and structured troubleshooting. No lessons published yet.</p></section><section class="academy-level"><h4>Advanced</h4><p class="academy-planned">Planned — complex diagnosis and manufacturer-specific material following technical review. No lessons published yet.</p></section>`);
  }
  function lesson(id) {
    const item=lessons[id]; if (!item) return;
    currentLesson=id; currentSubject=item.subject;
    const list=subjects[item.subject].lessons, index=list.indexOf(id);
    show(`<button type="button" data-academy-back>← ${subjects[item.subject].name}</button><article><h3 tabindex="-1">${item.title}</h3><p>Beginner · about ${item.minutes} minutes · Content revision 1</p>${notice}${item.body}<h4>Reference starting points</h4><p>Use current official guidance and exact model manuals before practical work: ${item.subject==='fire' ? '<a href="https://c-tec.com/" target="_blank" rel="noopener noreferrer">C-TEC official product documentation</a> · <a href="https://www.gov.uk/workplace-fire-safety-your-responsibilities" target="_blank" rel="noopener noreferrer">GOV.UK workplace fire safety</a>' : '<a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/cctv-and-video-surveillance/" target="_blank" rel="noopener noreferrer">ICO video surveillance guidance</a> · <a href="https://www.hikvision.com/uk/support/" target="_blank" rel="noopener noreferrer">Hikvision / HiLook support</a> · <a href="https://support.swann.com/" target="_blank" rel="noopener noreferrer">Swann support</a>'}. These links are reference entry points; no exact model manual has been verified for this release.</p>
      <form id="academy-quiz"><h4>Knowledge check</h4><p>Answer every question. All answers must be correct to record this knowledge check as passed. You can retry.</p>${item.questions.map((q,i)=>`<fieldset><legend>${i+1}. ${q.q}</legend>${q.options.map((option,j)=>`<label class="academy-option"><input type="radio" name="q${i}" value="${j}" required><span>${option}</span></label>`).join('')}<div data-academy-feedback="${i}"></div></fieldset>`).join('')}<button type="submit">Check answers</button><p id="academy-result" role="status" aria-live="polite"></p></form>
      <div class="academy-toolbar">${index>0 ? `<button type="button" data-academy-lesson="${list[index-1]}">← Previous lesson</button>` : ''}${index<list.length-1 ? `<button type="button" data-academy-lesson="${list[index+1]}">Next lesson →</button>` : '<button type="button" data-academy-back>Back to learning path</button>'}</div></article>`);
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button) return;
    if(button.hasAttribute('data-academy-subject')) subject(button.dataset.academySubject);
    else if(button.hasAttribute('data-academy-lesson')) lesson(button.dataset.academyLesson);
    else if(button.hasAttribute('data-academy-home')) home();
    else if(button.hasAttribute('data-academy-back')) subject(currentSubject);
  });
  root.addEventListener('submit',event=>{
    if(event.target.id!=='academy-quiz') return;
    event.preventDefault();
    const item=lessons[currentLesson]; if(!item) return;
    const answers=new FormData(event.target);
    let score=0;
    item.questions.forEach((q,i)=>{
      const correct=answers.has('q'+i)&&Number(answers.get('q'+i))===q.answer;
      if(correct) score++;
      root.querySelector(`[data-academy-feedback="${i}"]`).innerHTML=`<p class="academy-feedback">${correct?'Correct.':'Review this answer.'} ${escape(q.why)}</p>`;
    });
    let message=`${score} of ${item.questions.length} correct. `;
    if(score===item.questions.length){
      try { const done=progress(); done[currentLesson]={revision:1,passedAt:new Date().toISOString()}; sessionStorage.setItem(progressKey(),JSON.stringify(done)); message+='Knowledge check passed; saved for this browser tab/session only.'; }
      catch { message+='Knowledge check passed, but progress could not be saved because browser storage is unavailable.'; }
    } else message+='Review the explanations and try again. No new completion was recorded.';
    root.querySelector('#academy-result').textContent=message;
  });
})();

