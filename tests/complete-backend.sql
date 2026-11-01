begin;
update public.ae_courses set status='published' where id='099466f2-c383-49ce-974c-8145d77ebcc6';
do $$
declare u uuid:=gen_random_uuid();c uuid:='099466f2-c383-49ce-974c-8145d77ebcc6';r uuid;d jsonb;s jsonb;p jsonb;q jsonb;v jsonb;j jsonb;req uuid;firstq boolean:=true;blocked boolean:=false;n int;total numeric;teacher uuid;
begin
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values(u,'authenticated','authenticated','qa-'||u||'@example.invalid','{}','{}');
 insert into public.ae_profiles(id,display_name,role) values(u,'QA transactional full journey','student') on conflict(id) do update set role='student',disabled=false;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 select document into d from public.ae_courses where id=c;j:=public.ae_v2_state(c);r:=(j->>'run')::uuid;
 if public.ae_get_course(c)->'document' @? '$.**.answer' then raise exception 'Nested answers exposed';end if;
 q:=d->'final'->0;
 begin perform public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());exception when others then blocked:=SQLERRM='استلم المهمة أولًا';end;
 if not blocked then raise exception 'Mission gate failed';end if;
 perform public.ae_v2_mark(r,'mission');blocked:=false;
 begin perform public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());exception when others then blocked:=SQLERRM='أكمل المحطات وملفات الأدلة قبل النهائي';end;
 if not blocked then raise exception 'Final gate failed';end if;
 for s in select value from jsonb_array_elements(d->'stations') loop
  for q in select value from jsonb_array_elements(s->'questions') loop
   if firstq then
    req:=gen_random_uuid();v:=public.ae_v2_answer(r,q->>'id','"wrong"',req);
    if v->'answer'<>'null'::jsonb or (v->>'finished')::boolean then raise exception 'Premature answer reveal';end if;
    perform public.ae_v2_answer(r,q->>'id','"wrong"',req);
    v:=public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());
    if (v->>'score')::numeric<>1.5 then raise exception 'Station second attempt not half';end if;firstq:=false;
   else perform public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());end if;
  end loop;
 end loop;
 if ae_private.station_complete(r,d,1) then raise exception 'Quiz alone granted stamp';end if;
 for s in select value from jsonb_array_elements(d->'stations') loop
  for p in select value from jsonb_array_elements(s->'pages') loop
   perform public.ae_v2_mark(r,p->>'id');
   if jsonb_typeof(p->'exercise')='object' then v:=public.ae_v2_practice(r,p->'exercise'->>'id',p->'exercise'->'answer');if not (v->>'completed')::boolean then raise exception 'Practice failed';end if;end if;
  end loop;
  if not ae_private.station_complete(r,d,(s->>'id')::int) then raise exception 'Stamp not granted';end if;
 end loop;
 if ae_private.final_ready(r,d) then raise exception 'Missing evidence gate';end if;
 for p in select value from jsonb_array_elements(d->'evidence') loop perform public.ae_v2_mark(r,p->>'id');perform public.ae_v2_practice(r,p->'exercise'->>'id',p->'exercise'->'answer');end loop;
 if not ae_private.final_ready(r,d) then raise exception 'Final did not unlock';end if;
 firstq:=true;
 for q in select value from jsonb_array_elements(d->'final') loop
  if firstq then perform public.ae_v2_answer(r,q->>'id','"wrong"',gen_random_uuid());v:=public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());if (v->>'score')::numeric<>2.5 then raise exception 'Final second attempt not half';end if;firstq:=false;
  else perform public.ae_v2_answer(r,q->>'id',q->'answer',gen_random_uuid());end if;
 end loop;
 select count(*),sum(score) into n,total from public.ae_v2_answers where run_id=r;
 if n<>28 or total<>96 then raise exception 'Wrong final score: % / %',total,n;end if;
 if (select count(*) from public.ae_v2_attempts where run_id=r)<>30 then raise exception 'Audit/idempotence failed';end if;
 j:=public.ae_v2_state(c);if j->>'completed_at' is null then raise exception 'Run not complete';end if;
 if jsonb_array_length(public.ae_v2_review(r))<>28 then raise exception 'Review failed';end if;
 j:=public.ae_v2_replay(c,true);if j->>'run'=r::text or jsonb_array_length(j->'history')<>2 or jsonb_array_length(j->'answers')<>0 then raise exception 'Replay failed';end if;
 if (select sum(score) from public.ae_v2_answers where run_id=r)<>96 then raise exception 'Replay lost results';end if;
 select id into teacher from public.ae_profiles where role='teacher' and not disabled limit 1;perform set_config('request.jwt.claim.sub',teacher::text,true);
 v:=public.ae_generate_from_bank(c,'QA: blueprint verification',0);j:=v->'document';
 if j->>'format'<>'2' or j->'stations'->0->'pages'<>d->'stations'->0->'pages' or jsonb_array_length(j->'final')<>8 then raise exception 'Generator lost content';end if;
 for n in 0..7 loop if j->'final'->n->>'type'<>d->'final'->n->>'type' then raise exception 'Generator lost type slot %',n;end if;end loop;
 raise notice 'PASS: nested key protection, mission/content/evidence gates, all 28 typed questions, 1.5/2.5 half marks, idempotent audit, 96/100, replay preservation, generator blueprint';
end $$;
rollback;
