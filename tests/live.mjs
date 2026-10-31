import fs from 'node:fs';
import assert from 'node:assert/strict';
const users=JSON.parse(fs.readFileSync('../ae-qa-accounts.json','utf8'));
const url='https://klyfgdsfwxyavjhoovtz.supabase.co',key='sb_publishable_qTGd0iK7LiXdkMnkWxmDag_GjdJ81-f';
const site=process.env.AE_TEST_SITE||'https://africa-explorer-ivory.vercel.app';
async function request(path,token,body){const r=await fetch(url+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(JSON.stringify(d));return d;}
const rpc=(name,token,body={})=>request('/rest/v1/rpc/'+name,token,body);
for(const u of users){const s=await request('/auth/v1/token?grant_type=password',null,{email:u.email,password:u.password});u.token=s.access_token;assert.ok(u.token);assert.equal((await rpc('ae_me',u.token)).role,u.role);}
const student=users.find(u=>u.role==='student'),teacher=users.find(u=>u.role==='teacher');
console.log('PASS: real email/password authentication for student and teacher');
const cs=await rpc('ae_list_courses',student.token);const id=cs.find(c=>c.status==='published').id;
const clean=await rpc('ae_get_course',student.token,{p_id:id});assert.equal(clean.document.stations[0].questions[0].answer,undefined);
const complete=await rpc('ae_get_course',teacher.token,{p_id:id});assert.equal(typeof complete.document.stations[0].questions[0].answer,'number');
const q=complete.document.stations[0].questions[0];
assert.equal((await rpc('ae_submit',student.token,{p_id:id,p_question:q.id,p_choice:q.answer})).score,3);
assert.equal((await rpc('ae_progress',student.token,{p_id:id})).length,1);
console.log('PASS: live API content permissions, server grading and cloud persistence');
await assert.rejects(rpc('ae_generate_from_bank',student.token,{p_source:id,p_title:'اختبار منع الطالب',p_focus:0}));
await assert.rejects(rpc('ae_bank_list',student.token,{p_source:id}));
console.log('PASS: students cannot access bank or teacher generation');
const draft=await rpc('ae_save_draft',teacher.token,{p_id:null,p_document:complete.document,p_source:complete.source});assert.ok(draft.id);console.log('PASS: teacher cloud draft saved');
const bank=await rpc('ae_bank_list',teacher.token,{p_source:id});assert.equal(bank.length,56);
const result=await rpc('ae_generate_from_bank',teacher.token,{p_source:id,p_title:'اختبار توليد سحابي',p_focus:0});
const second=await rpc('ae_generate_from_bank',teacher.token,{p_source:id,p_title:'اختبار تنويع النسخ',p_focus:2});
assert.equal(result.document.stations.length,4);assert.equal(result.document.final.length,8);assert.equal((await rpc('ae_get_course',teacher.token,{p_id:result.id})).status,'draft');
const all=result.document.stations.flatMap(s=>s.questions).concat(result.document.final);
assert.equal(new Set(all.map(q=>q.prompt)).size,28);
for(const q of all){const original=bank.find(b=>b.question.prompt===q.prompt).question;assert.equal(q.options[q.answer],original.options[original.answer]);}
assert.notDeepEqual(result.document.stations.flatMap(s=>s.questions).map(q=>q.prompt),second.document.stations.flatMap(s=>s.questions).map(q=>q.prompt));
console.log('PASS: 56-question cloud bank generates varied private drafts with 28 non-repeated questions and correct shuffled answer keys');
for(const s of complete.document.stations)for(const q of s.questions)await rpc('ae_submit',student.token,{p_id:id,p_question:q.id,p_choice:q.answer});
for(const q of complete.document.final)await rpc('ae_submit',student.token,{p_id:id,p_question:q.id,p_choice:q.answer});
const progress=await rpc('ae_progress',student.token,{p_id:id});assert.equal(progress.length,28);assert.equal(progress.reduce((n,a)=>n+a.score,0),100);
console.log('PASS: full cloud journey, final unlock, 28 answers and 100/100 persisted');
fs.writeFileSync('../ae-qa-result.json',JSON.stringify({generator:'supabase-question-bank',success:true,draftId:result.id}));
