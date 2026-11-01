import config from './config.js';
let session;
try{session=JSON.parse(localStorage.getItem('ae-session')||'null');}catch{session=null;}
let refreshing;
let studentKey=localStorage.getItem('ae-active-student-key');
function deviceStudents(){try{return JSON.parse(localStorage.getItem('ae-student-identities')||'{}');}catch{return {};}}
function save(s){session=s;if(s){localStorage.setItem('ae-session',JSON.stringify(s));if(studentKey){const profiles={...deviceStudents(),[studentKey]:s};localStorage.setItem('ae-student-identities',JSON.stringify(profiles));localStorage.setItem('ae-active-student-key',studentKey);}}else{localStorage.removeItem('ae-session');localStorage.removeItem('ae-active-student-key');}}
async function authRequest(path,body,token){
 const r=await fetch(`${config.url}/auth/v1/${path}`,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok) throw Object.assign(Error(authMessage(data.msg||data.error_description||data.message||data.error)),{status:r.status});return data;
}
function authMessage(message=''){if(/Invalid login/i.test(message))return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';if(/Email not confirmed/i.test(message))return 'فعّل بريدك الإلكتروني من رسالة التأكيد أولًا.';if(/already registered/i.test(message))return 'البريد مسجّل بالفعل. استخدم تسجيل الدخول.';if(/rate limit/i.test(message))return 'طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول.';return message||'تعذر إتمام تسجيل الدخول.';}
export const cloud={
 get session(){return session;},
 async enterStudent(name,avatar){
  const normalized=name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ar');
  if(normalized.length<2||normalized.length>100)throw Error('اكتب اسمك من حرفين إلى ١٠٠ حرف.');
  const profiles=deviceStudents(),cached=Object.hasOwn(profiles,normalized)?profiles[normalized]:null;studentKey=normalized;
  if(cached){save(cached);try{await this.token();return await this.rpc('ae_set_identity',{p_name:name,p_avatar:avatar});}catch(e){if(![400,401].includes(e.status))throw e;}}
  const s=await authRequest('signup',{data:{display_name:name}});s.expires_at=Date.now()/1000+s.expires_in;save(s);
  return this.rpc('ae_set_identity',{p_name:name,p_avatar:avatar});
 },
 async enterTeacher(name,password,invite=null){
  const r=await fetch(`${config.url}/functions/v1/ae-teacher-access`,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({action:invite?'register':'login',name,password,...(invite?{invite}:{})})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر الدخول.');studentKey=null;localStorage.removeItem('ae-active-student-key');const s=d.session;s.expires_at=Date.now()/1000+s.expires_in;save(s);return s;
 },
 async login(email,password){const s=await authRequest('token?grant_type=password',{email,password});s.expires_at=Date.now()/1000+s.expires_in;save(s);return s;},
 async signup(email,password,name){const d=await authRequest(`signup?redirect_to=${encodeURIComponent(location.origin)}`,{email,password,data:{display_name:name}});if(d.access_token){d.expires_at=Date.now()/1000+d.expires_in;save(d);}return d;},
 async logout(){try{if(session&&!studentKey)await authRequest('logout',{},session.access_token);}finally{save(null);studentKey=null;}},
 async reset(email){await authRequest(`recover?redirect_to=${encodeURIComponent(location.origin)}`,{email});},
 async password(password){const token=await this.token();const r=await fetch(`${config.url}/auth/v1/user`,{method:'PUT',headers:{apikey:config.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok)throw Error('تعذر تغيير كلمة المرور.');},
 async token(){if(!session)throw Error('سجّل الدخول أولًا.');if(session.expires_at<Date.now()/1000+60){if(!refreshing)refreshing=authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(s=>{s.expires_at=Date.now()/1000+s.expires_in;save(s);}).catch(e=>{save(null);throw e;}).finally(()=>refreshing=null);await refreshing;}return session.access_token;},
 async rpc(name,body={}){const token=await this.token();const r=await fetch(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(Error(d?.message||'تعذر حفظ البيانات سحابيًا. حاول مرة أخرى.'),{status:r.status});return d;},
 async generate(source,title,focus=0){return this.rpc('ae_generate_from_bank',{p_source:source,p_title:title,p_focus:focus});},
 acceptRedirect(){const p=new URLSearchParams(location.hash.slice(1));if(p.get('access_token')){save({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_at:Date.now()/1000+Number(p.get('expires_in')||3600)});history.replaceState(null,'',location.pathname);return p.get('type');}if(p.get('error_description')){history.replaceState(null,'',location.pathname);throw Error(p.get('error_description'));}}
};
