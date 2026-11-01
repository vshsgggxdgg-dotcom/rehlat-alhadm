alter table public.ae_profiles add column if not exists avatar_id text not null default 'safari-driver' check(avatar_id in ('safari-driver','explorer-girl','teacher'));
update public.ae_profiles set avatar_id='teacher' where role='teacher';
create table ae_private.teacher_logins(username text primary key,user_id uuid unique not null references auth.users(id) on delete cascade);
create table ae_private.login_limits(bucket text primary key,started_at timestamptz not null default now(),attempts integer not null default 1);
alter table ae_private.teacher_logins enable row level security;
alter table ae_private.login_limits enable row level security;
insert into ae_private.teacher_logins(username,user_id) select lower(regexp_replace(btrim(normalize(display_name)),'\s+',' ','g')),id from public.ae_profiles where role='teacher' and not disabled on conflict do nothing;

create or replace function public.ae_me() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ae_profiles;begin
 if auth.uid() is null then raise exception 'ابدأ رحلتك بالاسم أولًا';end if;
 select * into p from public.ae_profiles where id=auth.uid();
 if p.disabled then raise exception 'هذا الحساب معطل';end if;
 if p.id is null then insert into public.ae_profiles(id,display_name) values(auth.uid(),'مستكشف جديد') returning * into p;end if;
 return to_jsonb(p);
end $$;
create function public.ae_set_identity(p_name text,p_avatar text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;begin
 p:=public.ae_me();
 if p_name is null or length(btrim(p_name)) not between 2 and 100 then raise exception 'اكتب اسمًا من حرفين إلى ١٠٠ حرف';end if;
 if p->>'role'='teacher' then
  update public.ae_profiles set avatar_id='teacher' where id=auth.uid();
 else
  if p_avatar not in ('safari-driver','explorer-girl') or p_avatar is null then raise exception 'اختر شخصية المستكشف';end if;
  update public.ae_profiles set display_name=btrim(p_name),avatar_id=p_avatar where id=auth.uid();
 end if;
 return public.ae_me();
end $$;
create function public.ae_teacher_login_target(p_username text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'email',u.email) from ae_private.teacher_logins l join auth.users u on u.id=l.user_id join public.ae_profiles p on p.id=u.id where l.username=p_username and p.role='teacher' and not p.disabled;
$$;
create function public.ae_teacher_signup_ready(p_username text,p_code text) returns boolean language sql security definer set search_path='' as $$
 select length(p_username) between 2 and 60 and not exists(select 1 from ae_private.teacher_logins where username=p_username) and exists(select 1 from ae_private.invites where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') and used_by is null and expires_at>now());
$$;
create function public.ae_teacher_register_bind(p_username text,p_code text,p_user uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
declare n int;begin
 if p_username is null or length(p_username) not between 2 and 60 or p_name is null or length(p_name) not between 2 and 100 or not exists(select 1 from auth.users where id=p_user and not is_anonymous) then raise exception 'بيانات الحساب غير صالحة';end if;
 update ae_private.invites set used_by=p_user where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') and used_by is null and expires_at>now();get diagnostics n=row_count;
 if n<>1 then raise exception 'رمز تهيئة المعلم غير صالح أو مستخدم';end if;
 insert into ae_private.teacher_logins(username,user_id) values(p_username,p_user);
 insert into public.ae_profiles(id,display_name,role,avatar_id) values(p_user,p_name,'teacher','teacher') on conflict(id) do update set role='teacher',avatar_id='teacher';
end $$;
create function public.ae_teacher_login_rate(p_bucket text) returns boolean language plpgsql security definer set search_path='' as $$
declare lim ae_private.login_limits;begin
 insert into ae_private.login_limits(bucket) values(p_bucket) on conflict(bucket) do update set attempts=case when ae_private.login_limits.started_at<now()-interval '10 minutes' then 1 else ae_private.login_limits.attempts+1 end,started_at=case when ae_private.login_limits.started_at<now()-interval '10 minutes' then now() else ae_private.login_limits.started_at end returning * into lim;
 return lim.attempts<=30;
end $$;
-- Anonymous student identities cannot redeem teacher invitations directly.
create or replace function public.ae_redeem_invite(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n int;begin
 perform public.ae_me();
 if exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then raise exception 'أنشئ حساب المعلم بالاسم وكلمة المرور أولًا';end if;
 update ae_private.invites set used_by=auth.uid() where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') and used_by is null and expires_at>now();get diagnostics n=row_count;if n<>1 then raise exception 'رمز الدعوة غير صالح أو مستخدم';end if;
 update public.ae_profiles set role='teacher',avatar_id='teacher' where id=auth.uid();return public.ae_me();
end $$;
revoke all on function public.ae_set_identity(text,text),public.ae_teacher_login_target(text),public.ae_teacher_signup_ready(text,text),public.ae_teacher_register_bind(text,text,uuid,text),public.ae_teacher_login_rate(text) from public,anon,authenticated;
grant execute on function public.ae_set_identity(text,text) to authenticated;
grant execute on function public.ae_teacher_login_target(text),public.ae_teacher_signup_ready(text,text),public.ae_teacher_register_bind(text,text,uuid,text),public.ae_teacher_login_rate(text) to service_role;
