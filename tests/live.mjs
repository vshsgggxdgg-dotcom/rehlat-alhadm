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
let r=await fetch(site+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${student.token}`},body:JSON.stringify({source:complete.source})});assert.equal(r.status,403);
console.log('PASS: students cannot use teacher generation');
const draft=await rpc('ae_save_draft',teacher.token,{p_id:null,p_document:complete.document,p_source:complete.source});assert.ok(draft.id);console.log('PASS: teacher cloud draft saved');
r=await fetch(site+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${teacher.token}`},body:JSON.stringify({source:complete.source,instructions:'اكتب بأسلوب واضح وموجز.'})});
const result=await r.json();
console.log(JSON.stringify({generationStatus:r.status,model:result.model||null,draftId:result.id||null,error:result.error||null}));
if(r.ok){assert.equal(result.document.stations.length,4);assert.equal(result.document.final.length,8);assert.equal((await rpc('ae_get_course',teacher.token,{p_id:result.id})).status,'draft');console.log('PASS: real AI generation saved as private cloud draft');}
fs.writeFileSync('../ae-qa-result.json',JSON.stringify({generationStatus:r.status,error:result.error||null,draftId:result.id||null}));
