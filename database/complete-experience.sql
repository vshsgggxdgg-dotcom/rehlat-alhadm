create table public.ae_v2_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.ae_profiles(id),course_id uuid not null references public.ae_courses(id),active boolean not null default true,started_at timestamptz not null default now(),completed_at timestamptz);
create unique index ae_v2_one_active on public.ae_v2_runs(user_id,course_id) where active;
create table public.ae_v2_events(run_id uuid not null references public.ae_v2_runs(id),event_id text not null,station int not null,kind text not null,completed boolean not null default false,attempts int not null default 0,last_answer jsonb,updated_at timestamptz not null default now(),primary key(run_id,event_id));
create table public.ae_v2_answers(run_id uuid not null references public.ae_v2_runs(id),question_id text not null,station int not null,attempts int not null default 0,correct boolean not null default false,score numeric(4,1) not null default 0,last_answer jsonb,updated_at timestamptz not null default now(),primary key(run_id,question_id));
create table public.ae_v2_attempts(id uuid primary key default gen_random_uuid(),run_id uuid not null references public.ae_v2_runs(id),user_id uuid not null references public.ae_profiles(id),question_id text not null,request_id uuid not null,attempt int not null,answer jsonb not null,correct boolean not null,score numeric(4,1) not null,result jsonb not null,created_at timestamptz not null default now(),unique(user_id,request_id),unique(run_id,question_id,attempt));
alter table public.ae_v2_runs enable row level security;alter table public.ae_v2_events enable row level security;alter table public.ae_v2_answers enable row level security;alter table public.ae_v2_attempts enable row level security;
revoke all on public.ae_v2_runs,public.ae_v2_events,public.ae_v2_answers,public.ae_v2_attempts from anon,authenticated;
create index ae_v2_runs_course on public.ae_v2_runs(course_id,user_id);

create function ae_private.clean_document(d jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb;v jsonb;k text;begin
 if jsonb_typeof(d)='object' then r:='{}';for k,v in select * from jsonb_each(d) loop if k not in ('answer','explanation','solution') then r:=r||jsonb_build_object(k,ae_private.clean_document(v));end if;end loop;return r;
 elsif jsonb_typeof(d)='array' then select coalesce(jsonb_agg(ae_private.clean_document(value)),'[]') into r from jsonb_array_elements(d);return r;else return d;end if;
end $$;
create function ae_private.find_learning(d jsonb,e text) returns jsonb language plpgsql immutable set search_path='' as $$
declare s jsonb;p jsonb;begin
 for s in select value from jsonb_array_elements(d->'stations') loop for p in select value from jsonb_array_elements(s->'pages') loop
  if p->>'id'=e then return jsonb_build_object('item',p,'kind','page','station',s->'id');end if;
  if p->'exercise'->>'id'=e then return jsonb_build_object('item',p->'exercise','kind','exercise','station',s->'id','parent',p->>'id');end if;
 end loop;end loop;
 for p in select value from jsonb_array_elements(d->'evidence') loop
  if p->>'id'=e then return jsonb_build_object('item',p,'kind','evidence','station',0);end if;
  if p->'exercise'->>'id'=e then return jsonb_build_object('item',p->'exercise','kind','exercise','station',0,'parent',p->>'id');end if;
 end loop;return null;
end $$;
create function ae_private.find_question(d jsonb,e text) returns jsonb language plpgsql immutable set search_path='' as $$
declare s jsonb;q jsonb;begin
 for s in select value from jsonb_array_elements(d->'stations') loop for q in select value from jsonb_array_elements(s->'questions') loop if q->>'id'=e then return jsonb_build_object('item',q,'station',s->'id');end if;end loop;end loop;
 for q in select value from jsonb_array_elements(d->'final') loop if q->>'id'=e then return jsonb_build_object('item',q,'station',5);end if;end loop;return null;
end $$;
create function ae_private.station_complete(r uuid,d jsonb,sid int) returns boolean language plpgsql stable set search_path='' as $$
declare s jsonb;p jsonb;q jsonb;begin
 select value into s from jsonb_array_elements(d->'stations') where (value->>'id')::int=sid;if s is null then return false;end if;
 for p in select value from jsonb_array_elements(s->'pages') loop
  if not exists(select 1 from public.ae_v2_events where run_id=r and event_id=p->>'id' and completed) then return false;end if;
  if p->'exercise' is not null and p->'exercise'<>'null'::jsonb and not exists(select 1 from public.ae_v2_events where run_id=r and event_id=p->'exercise'->>'id' and completed) then return false;end if;
 end loop;
 for q in select value from jsonb_array_elements(s->'questions') loop if not exists(select 1 from public.ae_v2_answers where run_id=r and question_id=q->>'id' and (correct or attempts=2)) then return false;end if;end loop;return true;
end $$;
create function ae_private.final_ready(r uuid,d jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare i int;p jsonb;begin
 for i in 1..4 loop if not ae_private.station_complete(r,d,i) then return false;end if;end loop;
 for p in select value from jsonb_array_elements(d->'evidence') loop if not exists(select 1 from public.ae_v2_events where run_id=r and event_id=p->>'id' and completed) or not exists(select 1 from public.ae_v2_events where run_id=r and event_id=p->'exercise'->>'id' and completed) then return false;end if;end loop;return true;
end $$;
create function public.ae_v2_state(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;r public.ae_v2_runs;s jsonb;sts jsonb:='[]';n int;begin
 if public.ae_me()->>'role'<>'student' then raise exception 'وضع المعلم معاينة بلا درجات';end if;
 select document into d from public.ae_courses where id=p_id and status='published' and document->>'format'='2';if d is null then raise exception 'النسخة غير متاحة';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_id::text,0));
 select * into r from public.ae_v2_runs where user_id=auth.uid() and course_id=p_id and active;
 if r.id is null then insert into public.ae_v2_runs(user_id,course_id) values(auth.uid(),p_id) returning * into r;end if;
 for s in select value from jsonb_array_elements(d->'stations') loop sts:=sts||jsonb_build_array(jsonb_build_object('id',s->'id','complete',ae_private.station_complete(r.id,d,(s->>'id')::int)));end loop;
 select count(*) into n from public.ae_v2_runs where user_id=auth.uid() and course_id=p_id;
 return jsonb_build_object('run',r.id,'round',n,'completed_at',r.completed_at,'mission',exists(select 1 from public.ae_v2_events where run_id=r.id and event_id='mission' and completed),'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.ae_v2_events e where run_id=r.id),'[]'),'answers',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('last_choice',case when jsonb_typeof(a.last_answer)='number' then a.last_answer else null end)) from public.ae_v2_answers a where run_id=r.id),'[]'),'stations',sts,'finalReady',ae_private.final_ready(r.id,d),'history',coalesce((select jsonb_agg(jsonb_build_object('id',rr.id,'started',rr.started_at,'completed',rr.completed_at,'active',rr.active,'score',coalesce((select sum(score) from public.ae_v2_answers where run_id=rr.id),0)) order by rr.started_at desc) from public.ae_v2_runs rr where user_id=auth.uid() and course_id=p_id),'[]'));
end $$;
create function public.ae_v2_mark(p_run uuid,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare r public.ae_v2_runs;d jsonb;found jsonb;i int;begin
 perform public.ae_me();select * into r from public.ae_v2_runs where id=p_run and user_id=auth.uid() and active for update;if r.id is null then raise exception 'هذه الجولة ليست نشطة؛ حدّث الصفحة';end if;
 select document into d from public.ae_courses where id=r.course_id;
 if p_event='mission' then found:=jsonb_build_object('kind','mission','station',0);else found:=ae_private.find_learning(d,p_event);if found is null or found->>'kind'='exercise' then raise exception 'صفحة غير موجودة';end if;end if;
 if found->>'kind'='evidence' then for i in 1..4 loop if not ae_private.station_complete(r.id,d,i) then raise exception 'أكمل المحطات الأربع قبل تجميع الأدلة';end if;end loop;end if;
 insert into public.ae_v2_events(run_id,event_id,station,kind,completed) values(r.id,p_event,(found->>'station')::int,found->>'kind',true) on conflict(run_id,event_id) do update set completed=true,updated_at=now();
end $$;
create function public.ae_v2_practice(p_run uuid,p_event text,p_answer jsonb,p_reveal boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ae_v2_runs;d jsonb;f jsonb;q jsonb;e public.ae_v2_events;ok boolean;finished boolean;i int;begin
 if public.ae_me()->>'role'<>'student' then raise exception 'الأنشطة هنا للطالب';end if;
 if p_answer is null or octet_length(p_answer::text)>10000 then raise exception 'إجابة غير صالحة';end if;
 select * into r from public.ae_v2_runs where id=p_run and user_id=auth.uid() and active for update;if r.id is null then raise exception 'الجولة غير متاحة';end if;
 select document into d from public.ae_courses where id=r.course_id;f:=ae_private.find_learning(d,p_event);q:=f->'item';
 if f is null or f->>'kind'<>'exercise' then raise exception 'النشاط غير موجود';end if;
 if (f->>'station')::int=0 then for i in 1..4 loop if not ae_private.station_complete(r.id,d,i) then raise exception 'أكمل المحطات قبل غرفة الأدلة';end if;end loop;end if;
 insert into public.ae_v2_events(run_id,event_id,station,kind) values(r.id,p_event,(f->>'station')::int,'exercise') on conflict do nothing;
 select * into e from public.ae_v2_events where run_id=r.id and event_id=p_event;
 ok:=p_answer=q->'answer';finished:=ok or e.completed or (p_reveal and e.attempts>=2);
 update public.ae_v2_events set completed=finished,attempts=attempts+case when e.completed then 0 else 1 end,last_answer=p_answer,updated_at=now() where run_id=r.id and event_id=p_event;
 if finished then insert into public.ae_v2_events(run_id,event_id,station,kind,completed) values(r.id,f->>'parent',(f->>'station')::int,case when (f->>'station')::int=0 then 'evidence' else 'page' end,true) on conflict(run_id,event_id) do update set completed=true,updated_at=now();end if;
 return jsonb_build_object('correct',ok,'completed',finished,'attempts',e.attempts+1,'explanation',case when finished then q->>'explanation' else q->>'hint' end,'solution',case when finished then q->'answer' else null end);
end $$;
create function public.ae_v2_answer(p_run uuid,p_question text,p_answer jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ae_v2_runs;d jsonb;f jsonb;q jsonb;a public.ae_v2_answers;previous public.ae_v2_attempts;ok boolean;points numeric;result jsonb;st int;begin
 if public.ae_me()->>'role'<>'student' then raise exception 'استخدم معاينة المعلم';end if;
 if p_request is null or p_answer is null or octet_length(p_answer::text)>10000 then raise exception 'إجابة غير صالحة';end if;
 select * into r from public.ae_v2_runs where id=p_run and user_id=auth.uid() and active for update;if r.id is null then raise exception 'هذه الجولة ليست نشطة؛ حدّث الصفحة';end if;
 select * into previous from public.ae_v2_attempts where user_id=auth.uid() and request_id=p_request;
 if previous.id is not null then if previous.run_id<>p_run or previous.question_id<>p_question or previous.answer<>p_answer then raise exception 'طلب مكرر ببيانات مختلفة';end if;return previous.result;end if;
 select document into d from public.ae_courses where id=r.course_id;f:=ae_private.find_question(d,p_question);q:=f->'item';st:=(f->>'station')::int;
 if f is null then raise exception 'السؤال غير موجود';end if;
 if not exists(select 1 from public.ae_v2_events where run_id=r.id and event_id='mission' and completed) then raise exception 'استلم المهمة أولًا';end if;
 if st=5 and not ae_private.final_ready(r.id,d) then raise exception 'أكمل المحطات وملفات الأدلة قبل النهائي';end if;
 insert into public.ae_v2_answers(run_id,question_id,station) values(r.id,p_question,st) on conflict do nothing;select * into a from public.ae_v2_answers where run_id=r.id and question_id=p_question;
 if a.correct or a.attempts>=2 then return jsonb_build_object('correct',a.correct,'score',a.score,'attempts',a.attempts,'finished',true,'explanation',q->>'explanation','answer',q->'answer');end if;
 ok:=p_answer=q->'answer';points:=case when not ok then 0 when a.attempts=0 then case when st=5 then 5 else 3 end else case when st=5 then 2.5 else 1.5 end end;
 update public.ae_v2_answers set attempts=attempts+1,correct=ok,score=points,last_answer=p_answer,updated_at=now() where run_id=r.id and question_id=p_question;
 result:=jsonb_build_object('correct',ok,'score',points,'attempts',a.attempts+1,'finished',ok or a.attempts=1,'explanation',case when ok or a.attempts=1 then q->>'explanation' else q->>'hint' end,'answer',case when ok or a.attempts=1 then q->'answer' else null end);
 insert into public.ae_v2_attempts(run_id,user_id,question_id,request_id,attempt,answer,correct,score,result) values(r.id,auth.uid(),p_question,p_request,a.attempts+1,p_answer,ok,points,result);
 if st=5 and (select count(*) from public.ae_v2_answers where run_id=r.id and station=5 and (correct or attempts=2))=8 then update public.ae_v2_runs set completed_at=coalesce(completed_at,now()) where id=r.id;end if;
 return result;
end $$;
create function public.ae_v2_replay(p_id uuid,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.ae_me()->>'role'<>'student' or p_confirm is distinct from true then raise exception 'أكّد بدء جولة جديدة';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_id::text,0));
 update public.ae_v2_runs set active=false where user_id=auth.uid() and course_id=p_id and active;
 return public.ae_v2_state(p_id);
end $$;
create function public.ae_v2_review(p_run uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ae_v2_runs;d jsonb;q jsonb;a public.ae_v2_answers;outp jsonb:='[]';begin
 perform public.ae_me();select * into r from public.ae_v2_runs where id=p_run and user_id=auth.uid();if r.id is null then raise exception 'الجولة غير متاحة';end if;select document into d from public.ae_courses where id=r.course_id;
 for a in select * from public.ae_v2_answers where run_id=r.id and (correct or attempts=2) order by station,question_id loop q:=ae_private.find_question(d,a.question_id)->'item';outp:=outp||jsonb_build_array(jsonb_build_object('id',a.question_id,'prompt',q->>'prompt','question',q,'answer',q->'answer','explanation',q->>'explanation','correct',a.correct,'score',a.score,'station',a.station));end loop;return outp;
end $$;
create function public.ae_v2_reports() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.ae_me()->>'role'<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from(select p.id,p.display_name,c.id course_id,c.title,r.id run_id,r.active,r.completed_at,sum(a.score) score,count(a.question_id) answered,count(a.question_id) filter(where a.correct or a.attempts=2) finished,max(a.updated_at) last_active from public.ae_v2_runs r join public.ae_profiles p on p.id=r.user_id join public.ae_courses c on c.id=r.course_id left join public.ae_v2_answers a on a.run_id=r.id where not p.disabled and (c.owner_id=auth.uid() or c.owner_id is null) group by p.id,p.display_name,c.id,c.title,r.id,r.active,r.completed_at) x),'[]')||public.ae_reports();
end $$;
create or replace function public.ae_get_course(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;p jsonb;begin
 p:=public.ae_me();select * into c from public.ae_courses where id=p_id;if c.id is null or (c.status<>'published' and c.owner_id is distinct from auth.uid()) then raise exception 'الدرس غير متاح';end if;
 if p->>'role'='teacher' then return jsonb_build_object('id',c.id,'document',c.document,'source',c.source,'status',c.status);end if;
 return jsonb_build_object('id',c.id,'document',ae_private.clean_document(c.document),'status',c.status);
end $$;
create or replace function public.ae_list_courses() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.ae_me();return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'format',coalesce((document->>'format')::int,1),'created_at',created_at,'owner_id',owner_id) order by published_at desc nulls last,created_at desc) from public.ae_courses where status='published' or owner_id=auth.uid()),'[]');end $$;
-- Only the authenticated, ownership-checked API functions are exposed.
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'ae_v2_%' loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to authenticated',f);end loop;end $$;
revoke all on all functions in schema ae_private from public,anon,authenticated;
