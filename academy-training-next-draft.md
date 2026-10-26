# Paramount Academy — next training content (draft for technical review)

Status: DEVELOPMENT ONLY. This is a draft syllabus and trainer guide, not an operational procedure, competency sign-off or approved manufacturer instruction.

## Fire alarms: C-TEC conventional servicing — beginner lesson proposal
**Audience:** Engineers new to fire systems. **Learning objective:** collect the right site records and recognise when to stop and escalate.

1. Before visiting, identify the premises' responsible person, fire risk assessment arrangements, system category, panel model/revision, zone chart, logbook and previous service reports.
2. On arrival, confirm site-specific emergency arrangements and any monitoring centre, occupants, interfaces and permit-to-work requirements with the authorised supervisor. Never assume an alarm test can be run without coordination.
3. Record externally visible panel indications precisely: labels, steady/flashing state, date/time and affected zone. Do not interpret codes from a different C-TEC model.
4. Explain the difference between **fire**, **fault** and **disablement** indications using the *matching* panel manual. A clear panel display alone does not establish system compliance.
5. Under an authorised competent engineer, observe how inspection, testing, restoration and record-keeping are planned and checked against the applicable BS 5839 requirements and manufacturer documentation.
6. After the visit, write factual defects and recommendations, identify any impairment and ensure the responsible person is notified. Do not claim a system passes based solely on a training quiz.

**Knowledge check:**
- Why must the exact panel model and manual revision be identified? Answer: controls and indications can differ.
- What must be arranged before a planned alarm test? Answer: site authorisation, occupant and monitoring coordination, and appropriate impairment controls.
- Is a green/normal display proof that every device works? Answer: no.

**Trainer sign-off (separate from quiz):** Supervisor ______  Site/training rig ______  Date ______  Observed activities ______  Further training required ______.

## CCTV: fault-finding — beginner lesson proposal
**Audience:** New starters learning from engineers with DVR/NVR experience.

Use a structured **symptom → scope → evidence → authorised escalation** approach:
- One channel has no image: note channel, exact error, camera/recorder models, when last working and any recent changes. A competent person checks compatible power, link and recording configuration without altering other channels.
- Every channel has no image: distinguish display failure, recorder failure, network outage and camera-power issues; record observable status.
- Live image but no playback: check authorised recording status and retention settings, report storage alerts and preserve existing footage. Never initialise/format storage as a first troubleshooting step.
- Local access works but mobile viewing does not: record the approved app's error and network context. Never expose ports, disable security or share credentials.
- Beeping recorder: capture the exact warning and escalate; do not silence warnings merely to hide faults.

**Knowledge check:**
- Does live view prove recording? No.
- Should an HDD be formatted to fix an unexplained warning? No.
- How should a forgotten password be handled? Verify authority and follow the manufacturer's approved recovery route.

## Review and integration acceptance criteria
- Technical content reviewed by a competent fire alarm engineer before it is presented as approved training.
- Add these lessons using existing Academy UI patterns, with quizzes, retries, keyboard support and mobile layout.
- Keep any new practical procedures model-specific and based on verified official manuals.
- No Supabase writes, credentials, customer data, changes to live site or changes to `main`.
- Test on a Samsung device before merge; keep PR #1 unmerged until explicit owner approval.
