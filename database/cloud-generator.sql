alter table public.ae_courses add column if not exists bank_source uuid references public.ae_courses(id);
create table public.ae_question_bank(id uuid primary key default gen_random_uuid(),source_id uuid not null references public.ae_courses(id),station integer not null check(station between 1 and 5),question_id text not null,question jsonb not null,active boolean not null default true,created_by uuid references public.ae_profiles(id),created_at timestamptz not null default now(),unique(source_id,question_id));
alter table public.ae_question_bank enable row level security;
revoke all on public.ae_question_bank from anon,authenticated;
create index ae_bank_source_active on public.ae_question_bank(source_id,station) where active;

create function public.ae_bank_list(p_source uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;root uuid;begin
 if(public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 select * into c from public.ae_courses where id=p_source and (status='published' or owner_id=auth.uid());
 if c.id is null then raise exception 'المصدر غير متاح';end if;
 root:=coalesce(c.bank_source,c.id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'source_id',source_id,'station',station,'question',question,'active',active) order by station,created_at) from public.ae_question_bank where source_id=root),'[]'::jsonb);
end $$;
create function public.ae_bank_save(p_source uuid,p_station integer,p_question jsonb,p_active boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;root uuid;result uuid;begin
 if(public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 select * into c from public.ae_courses where id=p_source and (owner_id=auth.uid() or owner_id is null);
 if c.id is null then raise exception 'يمكنك تعديل بنك دروسك أو الدرس الأساسي فقط';end if;
 root:=coalesce(c.bank_source,c.id);
 if not exists(select 1 from public.ae_courses where id=root and (owner_id=auth.uid() or owner_id is null)) then raise exception 'لا تملك هذا البنك';end if;
 if p_station is null or p_station not between 1 and 5 or coalesce(p_question->>'id','')!~'^[a-z0-9-]{1,60}$' or coalesce(length(p_question->>'prompt'),0)<3 or coalesce(jsonb_typeof(p_question->'options'),'')<>'array' or coalesce(jsonb_typeof(p_question->'answer'),'')<>'number' or coalesce(length(p_question->>'explanation'),0)<3 then raise exception 'بيانات السؤال غير مكتملة';end if;
 if jsonb_array_length(p_question->'options')<>4 or (p_question->>'answer')::numeric not between 0 and 3 or (p_question->>'answer')::numeric<>trunc((p_question->>'answer')::numeric) or (select count(distinct value) from jsonb_array_elements_text(p_question->'options'))<>4 or exists(select 1 from jsonb_array_elements(p_question->'options') opt where jsonb_typeof(opt)<>'string' or length(opt#>>'{}')<1) then raise exception 'راجع الاختيارات والإجابة الصحيحة';end if;
 insert into public.ae_question_bank(source_id,station,question_id,question,active,created_by) values(root,p_station,p_question->>'id',p_question,p_active,auth.uid()) on conflict(source_id,question_id) do update set station=excluded.station,question=excluded.question,active=excluded.active returning id into result;
 return result;
end $$;
create function public.ae_shuffle_question(p_question jsonb) returns jsonb language plpgsql set search_path='' as $$
declare opts jsonb;correcttext text;answeridx int;begin
 correcttext:=p_question->'options'->>((p_question->>'answer')::int);
 select jsonb_agg(value) into opts from (select value from jsonb_array_elements(p_question->'options') order by random()) shuffled;
 select ordinality-1 into answeridx from jsonb_array_elements_text(opts) with ordinality where value=correcttext;
 return p_question||jsonb_build_object('id','q-'||replace(gen_random_uuid()::text,'-',''),'options',opts,'answer',answeridx);
end $$;
create function public.ae_generate_from_bank(p_source uuid,p_title text,p_focus integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;root uuid;d jsonb;s jsonb;q jsonb;stations jsonb:='[]';questions jsonb;finalquestions jsonb:='[]';selectedprompts text[]:='{}';cid uuid;countq int;begin
 if(public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 if p_title is null or length(p_title) not between 3 and 160 or p_focus is null or p_focus not between 0 and 4 then raise exception 'راجع عنوان النسخة وتركيز الأسئلة';end if;
 select * into c from public.ae_courses where id=p_source and status='published';if c.id is null then raise exception 'اختر درسًا منشورًا كمصدر';end if;
 root:=coalesce(c.bank_source,c.id);d:=c.document;
 -- A source without an expanded bank still has its original approved questions.
 if not exists(select 1 from public.ae_question_bank where source_id=root) then
  for s in select value from jsonb_array_elements(d->'stations') loop for q in select value from jsonb_array_elements(s->'questions') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,(s->>'id')::int,q->>'id',q,auth.uid()) on conflict do nothing;end loop;end loop;
  for q in select value from jsonb_array_elements(d->'final') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,5,q->>'id',q,auth.uid()) on conflict do nothing;end loop;
 end if;
 for s in select value from jsonb_array_elements(d->'stations') loop
  questions:='[]';countq:=0;
  for q in select question from public.ae_question_bank where source_id=root and active and station=(s->>'id')::int order by random() limit 5 loop
   questions:=questions||jsonb_build_array(public.ae_shuffle_question(q));selectedprompts:=array_append(selectedprompts,q->>'prompt');countq:=countq+1;
  end loop;
  if countq<>5 then raise exception 'البنك يحتاج خمسة أسئلة نشطة على الأقل لكل محطة';end if;
  stations:=stations||jsonb_build_array(jsonb_set(s,'{questions}',questions));
 end loop;
 countq:=0;
 for q in select question from public.ae_question_bank where source_id=root and active and not(question->>'prompt'=any(selectedprompts)) order by (p_focus<>0 and station=p_focus) desc,random() limit 8 loop
  finalquestions:=finalquestions||jsonb_build_array(public.ae_shuffle_question(q));countq:=countq+1;
 end loop;
 if countq<>8 then raise exception 'أضف أسئلة للبنك؛ نحتاج ثمانية أسئلة إضافية لا تتكرر مع أسئلة المحطات';end if;
 d:=d||jsonb_build_object('title',p_title,'stations',stations,'final',finalquestions);
 perform public.ae_validate(d);
 insert into public.ae_courses(owner_id,title,document,source,bank_source) values(auth.uid(),p_title,d,c.source,root) returning id into cid;
 return jsonb_build_object('id',cid,'document',d,'source',c.source,'bank_source',root,'generator','cloud-question-bank');
end $$;
revoke all on function public.ae_bank_list(uuid),public.ae_bank_save(uuid,integer,jsonb,boolean),public.ae_shuffle_question(jsonb),public.ae_generate_from_bank(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ae_bank_list(uuid),public.ae_bank_save(uuid,integer,jsonb,boolean),public.ae_generate_from_bank(uuid,text,integer) to authenticated;
