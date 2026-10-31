export function config(){return {url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};}
export async function rpc(token,name,body={}){
 const {url,key}=config();
 const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const raw=await r.text();const d=raw?JSON.parse(raw):null;if(!r.ok) throw Object.assign(Error(d?.message||'تعذر الاتصال بقاعدة البيانات'),{status:r.status});return d;
}
export async function teacher(req){
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)throw Object.assign(Error('سجّل الدخول أولًا.'),{status:401});
 const p=await rpc(token,'ae_me');if(p.role!=='teacher') throw Object.assign(Error('هذه الخدمة للمعلم فقط.'),{status:403});return {token,profile:p};
}
export function fail(res,e){res.status(e.status||400).json({error:e.message||'تعذر إتمام الطلب.'});}
