import { ANATOMICAL_ASSET_MANIFEST } from "../content/assetManifest";
import { downloadExcel } from "./exportExcel";
import { useEffect, useState } from 'react';
import { adminCloud } from '../backend/cloud';
type Row = Record<string, any>;
async function all(table: string, order: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await adminCloud!.from(table).select('*').order(order).range(offset, offset + 99);
    if (error) throw error;
    result.push(...data);
    if (data.length < 100) return result;
  }
}
export function StudentReports() {
  const [students, setStudents] = useState<Row[]>([]), [answers, setAnswers] = useState<Row[]>([]), [best, setBest] = useState<Row[]>([]), [activities, setActivities] = useState<Row[]>([]), [journeys,setJourneys]=useState<Row[]>([]), [runs,setRuns]=useState<Row[]>([]);
  const [query, setQuery] = useState(''), [classroom, setClassroom] = useState(''), [selected, setSelected] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [editName,setEditName]=useState(''),[editClass,setEditClass]=useState('6/1');
  async function refresh() {
    setBusy(true); setMessage('');
    try { const [s,a,b,c,j,r] = await Promise.all([all('student_profiles','student_id'),all('activity_submissions','submission_id'),all('student_level_best_scores','student_id'),all('curriculum_activities','activity_id'),all('student_journeys','journey_id'),all('scored_level_runs','run_id')]); setStudents(s);setAnswers(a);setBest(b);setActivities(c);setJourneys(j);setRuns(r); }
    catch(e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const visible = students.filter(s => s.display_name.includes(query.trim()) && (!classroom || s.class_name === classroom));
  const latest = (id:string) => journeys.filter(j=>j.student_id===id).sort((a,b)=>b.started_at.localeCompare(a.started_at))[0];
  const completed=(id:string)=>runs.filter(r=>r.journey_id===latest(id)?.journey_id && r.status==='completed').length;
  const score = (id: string) => best.filter(b => b.student_id === id && b.content_version_id===latest(id)?.content_version_id).reduce((n,b) => n + b.best_completed_score, 0);
  function activity(a: Row) { return activities.find(c => c.activity_id === a.activity_id && c.content_version_id === a.content_version_id); }
  function answerText(a: Row) {
    const c = activity(a); const labels: Record<string,string> = {};
    const visit = (v: any) => { if (!v || typeof v !== 'object') return; if (!Array.isArray(v)) { const label = v.labelAr ?? v.postConfirmationOrganNameAr; if (label) for (const k of Object.keys(v)) if (/Id$/.test(k) && typeof v[k] === 'string') labels[v[k]] = label; } Object.values(v).forEach(visit); };
    visit(c?.public_options_json); visit(c?.public_interaction_config_json);
    const assetId=c?.public_interaction_config_json?.imageIdentificationConfig?.assetId as keyof typeof ANATOMICAL_ASSET_MANIFEST; if(assetId) visit(ANATOMICAL_ASSET_MANIFEST[assetId]?.hotspots);
    return String(a.submitted_answer).split(/([>|:]+)/).map(part => labels[part] ?? part).join(' ');
  }
  const answerRows = (list: Row[]) => [['الطالب','الفصل','نسخة المحتوى','المستوى','النشاط','الإجابة','رقم المحاولة','النتيجة','النقاط','الحد الأقصى','المدة بالثواني','التاريخ','معرف الجولة'], ...list.map(a => { const s=students.find(s=>s.student_id===a.student_id);return [s?.display_name,s?.class_name ?? 'غير محدد',a.content_version_id,a.level_id,activity(a)?.title_ar ?? a.activity_id,answerText(a),a.attempt_number,a.is_correct?'صحيحة':'غير صحيحة',a.score_earned,a.max_score,Math.round(a.duration_ms/1000),a.submitted_at,a.run_id];})];
  return <section className="student-reports"><h2>الطلاب والإجابات</h2><p>{students.length} طالب مسجل · {answers.length} محاولة محفوظة في قاعدة البيانات</p>
    <div className="button-row"><label>بحث بالاسم<input value={query} onChange={e=>setQuery(e.target.value)}/></label><label>الفصل<select value={classroom} onChange={e=>setClassroom(e.target.value)}><option value="">كل الفصول</option>{[...new Set(students.map(s=>s.class_name).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select></label><button className="btn" disabled={busy} onClick={()=>void refresh()}>تحديث البيانات</button>
    <button className="btn btn--primary" disabled={busy} onClick={()=>void downloadExcel([{name:'الطلاب',rows:[['معرف الطالب','الاسم','الفصل','تاريخ التسجيل','آخر نشاط','أفضل نقاط المستويات المكتملة','عدد المحاولات','المستويات المكتملة','نسخة المحتوى'],...visible.map(s=>[s.student_id,s.display_name,s.class_name ?? 'غير محدد',s.created_at,s.last_active_at,score(s.student_id),answers.filter(a=>a.student_id===s.student_id).length,completed(s.student_id),latest(s.student_id)?.content_version_id])]}, {name:'الإجابات والمحاولات',rows:answerRows(answers.filter(a=>visible.some(s=>s.student_id===a.student_id)))}, {name:'جولات المستويات',rows:[['الطالب','الفصل','المستوى','نسخة المحتوى','الحالة','الأنشطة المكتملة','إجمالي الأنشطة','النقاط','تاريخ البداية','تاريخ الإكمال'],...runs.filter(r=>visible.some(s=>s.student_id===r.student_id)).map(r=>{const s=students.find(s=>s.student_id===r.student_id);return [s?.display_name,s?.class_name,r.level_id,r.content_version_id,r.status,r.completed_activities_count,r.total_activities_count,r.score_earned,r.started_at,r.completed_at];})]}]).catch(e=>setMessage(e.message))}>تصدير تقرير Excel للفلاتر الحالية</button></div>
    <p role="status">{busy?'جارٍ تحميل البيانات…':message}</p><div style={{overflowX:'auto'}}><table><thead><tr><th>الاسم</th><th>الفصل</th><th>النقاط المكتملة</th><th>المستويات</th><th>التفاصيل</th></tr></thead><tbody>{visible.map(s=><tr key={s.student_id}><td>{s.display_name}</td><td>{s.class_name ?? 'غير محدد'}</td><td>{score(s.student_id)}</td><td>{completed(s.student_id)} / 6</td><td><button className="btn" onClick={()=>{setSelected(s.student_id);setEditName(s.display_name);setEditClass(s.class_name ?? "6/1");}}>عرض الإجابات</button></td></tr>)}</tbody></table></div>
    {selected && <section><h3>إجابات {students.find(s=>s.student_id===selected)?.display_name}</h3><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const {error}=await adminCloud!.rpc('rpc_admin_update_student',{p_student_id:selected,p_display_name:editName,p_class_name:editClass});if(error)throw error;await refresh();setMessage('تم حفظ بيانات الطالب مع الاحتفاظ بتقدمه.');}catch(err){setMessage((err as Error).message);}finally{setBusy(false);}}}><label>الاسم الثلاثي<input required value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>الفصل (مثل 6/1)<input required dir="ltr" value={editClass} onChange={e=>setEditClass(e.target.value)}/></label><button className="btn" disabled={busy}>حفظ بيانات الطالب</button></form>{answers.filter(a=>a.student_id===selected).map(a=><article key={a.submission_id}><h4>{activity(a)?.title_ar ?? a.activity_id}</h4><p>{answerText(a)}</p><p>المحاولة {a.attempt_number} · {a.is_correct?'صحيحة':'غير صحيحة'} · {a.score_earned}/{a.max_score} · {new Date(a.submitted_at).toLocaleString('ar-EG')}</p></article>)}{!answers.some(a=>a.student_id===selected)&&<p>لم يسجل إجابات بعد.</p>}</section>}
  </section>;
}
