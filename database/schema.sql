-- Separate application namespace; no existing application tables are changed.
create schema if not exists ae_private;
revoke all on schema ae_private from public,anon,authenticated;
create table public.ae_profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null check(length(display_name) between 2 and 100), role text not null default 'student' check(role in ('student','teacher')),created_at timestamptz not null default now());
create table public.ae_courses(id uuid primary key default gen_random_uuid(),owner_id uuid references public.ae_profiles(id),title text not null,document jsonb not null,source text not null default '',status text not null default 'draft' check(status in ('draft','published')),created_at timestamptz not null default now(),published_at timestamptz);
create table public.ae_answers(user_id uuid not null references public.ae_profiles(id) on delete cascade,course_id uuid not null references public.ae_courses(id),question_id text not null,station integer not null,attempts integer not null default 0,correct boolean not null default false,score integer not null default 0,last_choice integer,updated_at timestamptz not null default now(),primary key(user_id,course_id,question_id));
create table ae_private.invites(code_hash text primary key,created_by uuid,used_by uuid,expires_at timestamptz not null default now()+interval '7 days');
create table ae_private.generation_limits(user_id uuid primary key,last_at timestamptz not null default now(),daily_date date not null default current_date,daily_count integer not null default 1);
alter table public.ae_profiles enable row level security;
alter table public.ae_courses enable row level security;
alter table public.ae_answers enable row level security;
alter table ae_private.invites enable row level security;
alter table ae_private.generation_limits enable row level security;
revoke all on public.ae_profiles,public.ae_courses,public.ae_answers from anon,authenticated;
grant select on public.ae_profiles,public.ae_answers to authenticated;
create policy ae_profile_self on public.ae_profiles for select to authenticated using(id=(select auth.uid()));
create policy ae_answers_self on public.ae_answers for select to authenticated using(user_id=(select auth.uid()));

create function public.ae_me() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ae_profiles; begin
 if auth.uid() is null or exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then raise exception 'سجّل الدخول بحساب بريد إلكتروني أولًا'; end if;
 select * into p from public.ae_profiles where id=auth.uid();
 if p.id is null then
  insert into public.ae_profiles(id,display_name) values(auth.uid(),coalesce(nullif(left((select raw_user_meta_data->>'display_name' from auth.users where id=auth.uid()),100),''),'مستكشف جديد')) returning * into p;
 end if;
 return to_jsonb(p);
end $$;
create function public.ae_redeem_invite(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; begin
 perform public.ae_me();
 update ae_private.invites set used_by=auth.uid() where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') and used_by is null and expires_at>now();
 get diagnostics n=row_count;if n<>1 then raise exception 'رمز الدعوة غير صالح أو مستخدم';end if;
 update public.ae_profiles set role='teacher' where id=auth.uid();return public.ae_me();
end $$;
create function public.ae_create_invite() returns text language plpgsql security definer set search_path='' as $$
declare code text;begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 code:=replace(gen_random_uuid()::text,'-','');
 insert into ae_private.invites(code_hash,created_by) values(encode(sha256(convert_to(code,'UTF8')),'hex'),auth.uid());return code;
end $$;
create function public.ae_list_courses() returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;begin
 p:=public.ae_me();return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'created_at',created_at,'owner_id',owner_id) order by published_at desc nulls last,created_at desc) from public.ae_courses where status='published' or owner_id=auth.uid()),'[]'::jsonb);
end $$;
create function public.ae_get_course(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ae_courses; d jsonb;s jsonb;q jsonb;ss jsonb:='[]';qq jsonb;ff jsonb:='[]';p jsonb;begin
 p:=public.ae_me();select * into c from public.ae_courses where id=p_id;
 if c.id is null or (c.status<>'published' and c.owner_id is distinct from auth.uid()) then raise exception 'الدرس غير متاح';end if;
 d:=c.document;
 if p->>'role'='teacher' then return jsonb_build_object('id',c.id,'document',d,'source',c.source,'status',c.status);end if;
 for s in select value from jsonb_array_elements(d->'stations') loop
  qq:='[]';for q in select value from jsonb_array_elements(s->'questions') loop qq:=qq||jsonb_build_array(q-'answer'-'explanation');end loop;
  ss:=ss||jsonb_build_array(jsonb_set(s,'{questions}',qq));
 end loop;
 for q in select value from jsonb_array_elements(d->'final') loop ff:=ff||jsonb_build_array(q-'answer'-'explanation');end loop;
 d:=jsonb_set(jsonb_set(d,'{stations}',ss),'{final}',ff);
 return jsonb_build_object('id',c.id,'document',d,'status',c.status);
end $$;
create function public.ae_validate(p_document jsonb) returns void language plpgsql set search_path='' as $$
declare s jsonb;q jsonb;ids text[]:='{}';i int:=0;begin
 if p_document is null or coalesce(jsonb_typeof(p_document),'')<>'object' or coalesce(jsonb_typeof(p_document->'title'),'')<>'string' or coalesce(length(p_document->>'title'),0) not between 3 and 160 or octet_length(p_document::text)>180000 or coalesce(jsonb_typeof(p_document->'stations'),'')<>'array' or coalesce(jsonb_typeof(p_document->'final'),'')<>'array' then raise exception 'بنية الدرس غير صالحة';end if;
 if jsonb_array_length(p_document->'stations')<>4 or jsonb_array_length(p_document->'final')<>8 then raise exception 'عدد المحطات أو الأسئلة غير صالح';end if;
 for s in select value from jsonb_array_elements(p_document->'stations') loop
  i:=i+1;
  if coalesce((s->>'id')::int,0)<>i or coalesce(length(s->>'title'),0)<1 or coalesce(jsonb_typeof(s->'cards'),'')<>'array' or coalesce(jsonb_typeof(s->'questions'),'')<>'array' then raise exception 'راجع بيانات المحطات';end if;
  if jsonb_array_length(s->'cards') not between 1 and 12 or jsonb_array_length(s->'questions')<>5 then raise exception 'راجع عدد البطاقات والأسئلة';end if;
  for q in select value from jsonb_array_elements(s->'cards') loop if coalesce(length(q->>'title'),0)<1 or coalesce(length(q->>'text'),0)<1 then raise exception 'بطاقة فارغة';end if;end loop;
 end loop;
 for q in select value from jsonb_array_elements(p_document->'final') union all select question.value from jsonb_array_elements(p_document->'stations') section cross join lateral jsonb_array_elements(section.value->'questions') question loop
  if coalesce(q->>'id','')!~'^[a-z0-9-]{1,60}$' or q->>'id'=any(ids) or coalesce(length(q->>'prompt'),0)<1 or coalesce(jsonb_typeof(q->'options'),'')<>'array' or coalesce(jsonb_typeof(q->'answer'),'')<>'number' or coalesce((q->>'answer')::numeric,-1) not between 0 and 3 or coalesce(length(q->>'explanation'),0)<1 then raise exception 'سؤال غير صالح';end if;
  if jsonb_array_length(q->'options')<>4 or exists(select 1 from jsonb_array_elements(q->'options') opt where jsonb_typeof(opt)<>'string' or length(opt#>>'{}')<1) or (q->>'answer')::numeric<>trunc((q->>'answer')::numeric) then raise exception 'اختيارات أو إجابة غير صالحة';end if;
  if (select count(distinct value) from jsonb_array_elements_text(q->'options'))<>4 then raise exception 'الاختيارات يجب أن تكون مختلفة';end if;
  ids:=array_append(ids,q->>'id');
 end loop;
end $$;
create function public.ae_save_draft(p_id uuid,p_document jsonb,p_source text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 perform public.ae_validate(p_document);
 if length(p_source)>24000 then raise exception 'النص المرجعي طويل جدًا';end if;
 if p_id is not null then
  update public.ae_courses set document=p_document,title=p_document->>'title',source=p_source where id=p_id and owner_id=auth.uid() and status='draft' returning id into cid;
  if cid is null then raise exception 'لا يمكن تعديل هذه النسخة؛ انسخها لمسودة';end if;
 else insert into public.ae_courses(owner_id,title,document,source) values(auth.uid(),p_document->>'title',p_document,p_source) returning id into cid;end if;
 return jsonb_build_object('id',cid);
end $$;
create function public.ae_publish(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d jsonb;begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 select document into d from public.ae_courses where id=p_id and owner_id=auth.uid() and status='draft' for update;
 if d is null then raise exception 'المسودة غير متاحة';end if;
 perform public.ae_validate(d);update public.ae_courses set status='published',published_at=now() where id=p_id;
end $$;
create function public.ae_progress(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.ae_me();return coalesce((select jsonb_agg(to_jsonb(a)) from public.ae_answers a where user_id=auth.uid() and course_id=p_id),'[]'::jsonb);
end $$;
create function public.ae_submit(p_id uuid,p_question text,p_choice integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;s jsonb;q jsonb;foundq jsonb;st int:=0;a public.ae_answers;rightanswer boolean;points int;ready int;begin
 if (public.ae_me()->>'role')<>'student' then raise exception 'استخدم معاينة المعلم بدون تسجيل درجات';end if;
 if p_choice is null or p_choice not between 0 and 3 then raise exception 'اختيار غير صالح';end if;
 select document into d from public.ae_courses where id=p_id and status='published';if d is null then raise exception 'الدرس غير منشور';end if;
 for s in select value from jsonb_array_elements(d->'stations') loop
  for q in select value from jsonb_array_elements(s->'questions') loop if q->>'id'=p_question then foundq:=q;st:=(s->>'id')::int;end if;end loop;
 end loop;
 if foundq is null then
  for q in select value from jsonb_array_elements(d->'final') loop if q->>'id'=p_question then foundq:=q;st:=5;end if;end loop;
 end if;
 if foundq is null then raise exception 'السؤال غير موجود';end if;
 -- Serialize submissions from all tabs for this learner and course.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_id::text,0));
 if st=5 then
  select count(*) into ready from public.ae_answers where user_id=auth.uid() and course_id=p_id and station between 1 and 4 and (correct or attempts>=2);
  if ready<>20 then raise exception 'أكمل المحطات الأربع أولًا';end if;
 end if;
 insert into public.ae_answers(user_id,course_id,question_id,station) values(auth.uid(),p_id,p_question,st) on conflict do nothing;
 select * into a from public.ae_answers where user_id=auth.uid() and course_id=p_id and question_id=p_question for update;
 if a.correct or a.attempts>=2 then return jsonb_build_object('correct',a.correct,'score',a.score,'attempts',a.attempts,'explanation',foundq->>'explanation','answer',foundq->'answer','finished',true);end if;
 rightanswer:=(foundq->>'answer')::int=p_choice;
 points:=case when not rightanswer then 0 when st=5 and a.attempts=0 then 5 when st=5 then 2 when a.attempts=0 then 3 else 1 end;
 update public.ae_answers set attempts=attempts+1,correct=rightanswer,score=points,last_choice=p_choice,updated_at=now() where user_id=auth.uid() and course_id=p_id and question_id=p_question;
 return jsonb_build_object('correct',rightanswer,'score',points,'attempts',a.attempts+1,'explanation',foundq->>'explanation','answer',case when rightanswer or a.attempts>=1 then foundq->'answer' else null end,'finished',rightanswer or a.attempts>=1);
end $$;
create function public.ae_review(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;r jsonb:='[]';q jsonb;a public.ae_answers;begin
 perform public.ae_me();select document into d from public.ae_courses where id=p_id and status='published';
 for q in select value from jsonb_array_elements(d->'final') union all select question.value from jsonb_array_elements(d->'stations') section cross join lateral jsonb_array_elements(section.value->'questions') question loop
  select * into a from public.ae_answers where user_id=auth.uid() and course_id=p_id and question_id=q->>'id' and (correct or attempts>=2);
  if a.user_id is not null then r:=r||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','answer',q->'options'->((q->>'answer')::int),'explanation',q->>'explanation','correct',a.correct,'score',a.score));end if;
 end loop;return r;
end $$;
create function public.ae_reports() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select p.id,p.display_name,c.id course_id,c.title,sum(a.score) score,count(*) answered,count(*) filter(where a.correct or a.attempts>=2) finished,max(a.updated_at) last_active from public.ae_answers a join public.ae_profiles p on p.id=a.user_id join public.ae_courses c on c.id=a.course_id where c.owner_id=auth.uid() or c.owner_id is null group by p.id,p.display_name,c.id,c.title) r),'[]'::jsonb);
end $$;
create function public.ae_generation_slot() returns void language plpgsql security definer set search_path='' as $$
declare lim ae_private.generation_limits;begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 insert into ae_private.generation_limits(user_id,last_at,daily_count) values(auth.uid(),now()-interval '1 minute',0) on conflict do nothing;
 select * into lim from ae_private.generation_limits where user_id=auth.uid() for update;
 if lim.last_at>now()-interval '30 seconds' or (lim.daily_date=current_date and lim.daily_count>=20) then raise exception 'انتظر قليلًا؛ الحد اليومي ٢٠ عملية توليد';end if;
 update ae_private.generation_limits set last_at=now(),daily_date=current_date,daily_count=case when daily_date=current_date then daily_count+1 else 1 end where user_id=auth.uid();
end $$;
-- Definer RPCs intentionally mediate private answer keys and trusted scoring.
-- No anonymous execution; every entry checks auth.uid() through ae_me().
do $$ declare r record;begin for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ae_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.f);if r.f::text not like 'ae_validate(%' then execute format('grant execute on function %s to authenticated',r.f);end if;end loop;end $$;
