const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'https://africa-explorer-ivory.vercel.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
async function call(path:string,body:unknown,key=secret){const r=await fetch(url+path,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{throw Error('تعذر الاتصال بخدمة الحسابات');}return {ok:r.ok,data,status:r.status};}
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>8192)return reply({error:'طلب أكبر من المسموح'},413);
  const body=await req.json();const name=String(body.name||'').normalize('NFC').trim().replace(/\s+/g,' '),username=name.toLocaleLowerCase('en-US');const password=body.password;
  if(name.length<2||name.length>60||typeof password!=='string'||password.length<8||password.length>128)return reply({error:'اكتب الاسم وكلمة مرور من ٨ أحرف على الأقل.'},400);
  const bucket=await digest((req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'shared').split(',')[0]+':'+username);
  const rate=await call('/rest/v1/rpc/ae_teacher_login_rate',{p_bucket:bucket});if(!rate.ok||!rate.data)return reply({error:'محاولات كثيرة. انتظر قليلًا ثم حاول.'},429);
  let email='';let created='';
  if(body.action==='register'){
   const code=String(body.invite||'');if(!/^[a-f0-9]{32}$/.test(code))return reply({error:'رمز تهيئة المعلم غير صالح.'},400);
   const ready=await call('/rest/v1/rpc/ae_teacher_signup_ready',{p_username:username,p_code:code});if(!ready.ok||!ready.data)return reply({error:'الاسم مستخدم أو رمز التهيئة غير صالح.'},400);
   email=(await digest(username))+'@teachers.africa-explorer.invalid';
   const user=await call('/auth/v1/admin/users',{email,password,email_confirm:true,user_metadata:{display_name:name}});if(!user.ok)return reply({error:'تعذر إنشاء الحساب بهذا الاسم. جرّب اسمًا مختلفًا.'},400);
   created=user.data.id;
   const bound=await call('/rest/v1/rpc/ae_teacher_register_bind',{p_username:username,p_code:code,p_user:created,p_name:name});
   if(!bound.ok){await fetch(url+'/auth/v1/admin/users/'+created,{method:'DELETE',headers:{apikey:secret,Authorization:`Bearer ${secret}`}});return reply({error:'لم يكتمل تفعيل المعلم. تحقق من رمز التهيئة.'},400);}
  }else if(body.action==='login'){
   const target=await call('/rest/v1/rpc/ae_teacher_login_target',{p_username:username});email=target.data?.email||'unknown@teachers.africa-explorer.invalid';
  }else return reply({error:'طلب غير صالح'},400);
  const login=await call('/auth/v1/token?grant_type=password',{email,password});if(!login.ok)return reply({error:'الاسم أو كلمة المرور غير صحيحة.'},401);
  return reply({session:login.data});
 }catch{return reply({error:'تعذر الدخول الآن. حاول مرة أخرى.'},400);}
});
