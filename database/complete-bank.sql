alter function public.ae_shuffle_question(jsonb) rename to ae_shuffle_question_legacy;
create function public.ae_shuffle_question(p_question jsonb) returns jsonb language plpgsql set search_path='' as $$
declare q jsonb;items jsonb;begin
 if coalesce(p_question->>'type','choice')='choice' then return public.ae_shuffle_question_legacy(p_question);end if;
 q:=p_question||jsonb_build_object('id','q-'||replace(gen_random_uuid()::text,'-',''));
 if p_question?'items' then select jsonb_agg(value) into items from(select value from jsonb_array_elements(p_question->'items') order by random()) shuffled;q:=jsonb_set(q,'{items}',items);end if;return q;
end $$;
revoke all on function public.ae_shuffle_question(jsonb),public.ae_shuffle_question_legacy(jsonb) from public,anon,authenticated;
alter function public.ae_generate_from_bank(uuid,text,integer) rename to ae_generate_from_bank_legacy;
create function public.ae_generate_from_bank(p_source uuid,p_title text,p_focus integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;root uuid;d jsonb;s jsonb;q jsonb;stationlist jsonb:='[]';qs jsonb;ff jsonb:='[]';slotnum int;cid uuid;begin
 if public.ae_me()->>'role'<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;select * into c from public.ae_courses where id=p_source and status='published';if c.id is null then raise exception 'المصدر غير متاح';end if;
 if c.document->>'format' is distinct from '2' then return public.ae_generate_from_bank_legacy(p_source,p_title,p_focus);end if;
 if p_title is null or length(p_title) not between 3 and 160 then raise exception 'راجع عنوان النسخة';end if;
 root:=coalesce(c.bank_source,c.id);d:=c.document;
 if not exists(select 1 from public.ae_question_bank where source_id=root) then
  for s in select value from jsonb_array_elements(d->'stations') loop for q in select value from jsonb_array_elements(s->'questions') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,(s->>'id')::int,q->>'id',q,auth.uid()) on conflict do nothing;end loop;end loop;
  for q in select value from jsonb_array_elements(d->'final') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,5,q->>'id',q,auth.uid()) on conflict do nothing;end loop;
 end if;
 for s in select value from jsonb_array_elements(d->'stations') loop qs:='[]';for slotnum in 1..5 loop
  select question into q from public.ae_question_bank where source_id=root and active and station=(s->>'id')::int and (question->>'slot')::int=slotnum order by random() limit 1;
  if q is null then raise exception 'البنك يحتاج سؤالًا نشطًا لكل هدف من أهداف المحطة الخمسة';end if;qs:=qs||jsonb_build_array(public.ae_shuffle_question(q));
 end loop;stationlist:=stationlist||jsonb_build_array(jsonb_set(s,'{questions}',qs));end loop;
 for slotnum in 1..8 loop select question into q from public.ae_question_bank where source_id=root and active and station=5 and (question->>'slot')::int=slotnum order by random() limit 1;if q is null then raise exception 'أكمل أهداف النهائي الثمانية في البنك';end if;ff:=ff||jsonb_build_array(public.ae_shuffle_question(q));end loop;
 d:=d||jsonb_build_object('title',p_title,'stations',stationlist,'final',ff);perform public.ae_validate(d);
 insert into public.ae_courses(owner_id,title,document,source,bank_source) values(auth.uid(),p_title,d,c.source,root) returning id into cid;return jsonb_build_object('id',cid,'document',d,'source',c.source,'bank_source',root,'generator','cloud-blueprint-bank');
end $$;
revoke all on function public.ae_generate_from_bank(uuid,text,integer),public.ae_generate_from_bank_legacy(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ae_generate_from_bank(uuid,text,integer) to authenticated;
create or replace function public.ae_bank_save(p_source uuid,p_station integer,p_question jsonb,p_active boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.ae_courses;root uuid;result uuid;section jsonb;entry jsonb;begin
 if public.ae_me()->>'role'<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;select * into c from public.ae_courses where id=p_source and(owner_id=auth.uid() or owner_id is null);if c.id is null then raise exception 'لا تملك تعديل هذا البنك';end if;
 root:=coalesce(c.bank_source,c.id);if not exists(select 1 from public.ae_courses where id=root and(owner_id=auth.uid() or owner_id is null)) then raise exception 'لا تملك البنك المصدر';end if;
 perform ae_private.validate_question(p_question);if p_station not between 1 and 5 or p_station is null then raise exception 'محطة غير صالحة';end if;
 if c.document->>'format'='2' and (coalesce((p_question->>'slot')::int,0) not between 1 and case when p_station=5 then 8 else 5 end) then raise exception 'حدد هدف السؤال في البنك';end if;
 if exists(select 1 from public.ae_question_bank where source_id=root and question_id<>p_question->>'id' and question->>'prompt'=p_question->>'prompt') then raise exception 'السؤال موجود بالفعل';end if;
 if not exists(select 1 from public.ae_question_bank where source_id=root) then
  for section in select value from jsonb_array_elements(c.document->'stations') loop for entry in select value from jsonb_array_elements(section->'questions') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,(section->>'id')::int,entry->>'id',entry,auth.uid()) on conflict do nothing;end loop;end loop;
  for entry in select value from jsonb_array_elements(c.document->'final') loop insert into public.ae_question_bank(source_id,station,question_id,question,created_by) values(root,5,entry->>'id',entry,auth.uid()) on conflict do nothing;end loop;
 end if;
 insert into public.ae_question_bank(source_id,station,question_id,question,active,created_by) values(root,p_station,p_question->>'id',p_question,p_active,auth.uid()) on conflict(source_id,question_id) do update set station=excluded.station,question=excluded.question,active=excluded.active returning id into result;return result;
end $$;
revoke all on all functions in schema ae_private from public,anon,authenticated;
