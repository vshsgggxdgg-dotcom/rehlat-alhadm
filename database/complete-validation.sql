create function ae_private.validate_question(q jsonb) returns void language plpgsql set search_path='' as $$
declare typ text;it jsonb;n int;begin
 if q is null or coalesce(q->>'id','')!~'^[a-z0-9-]{1,60}$' or coalesce(length(q->>'prompt'),0)<1 or coalesce(length(q->>'explanation'),0)<1 or coalesce(jsonb_typeof(q->'options'),'')<>'array' or not(q?'answer') then raise exception 'بيانات السؤال غير مكتملة';end if;
 n:=jsonb_array_length(q->'options');if n not between 2 and 8 or (select count(distinct value) from jsonb_array_elements_text(q->'options'))<>n or exists(select 1 from jsonb_array_elements(q->'options') x where jsonb_typeof(x)<>'string' or length(x#>>'{}')=0) then raise exception 'اختيارات غير صالحة';end if;
 typ:=coalesce(q->>'type','choice');
 if typ='choice' then if coalesce(jsonb_typeof(q->'answer'),'')<>'number' or (q->>'answer')::numeric<>trunc((q->>'answer')::numeric) or (q->>'answer')::int not between 0 and n-1 then raise exception 'الإجابة الصحيحة غير صالحة';end if;
 elsif typ='hotspot' then if coalesce(jsonb_typeof(q->'targets'),'')<>'array' or not exists(select 1 from jsonb_array_elements(q->'targets') x where x->>'id'=q->>'answer') then raise exception 'موضع الخريطة غير صالح';end if;
  for it in select value from jsonb_array_elements(q->'targets') loop if coalesce(jsonb_typeof(it->'lon'),'')<>'number' or coalesce(jsonb_typeof(it->'lat'),'')<>'number' or abs((it->>'lon')::numeric)>180 or abs((it->>'lat')::numeric)>90 or coalesce(length(it->>'label'),0)=0 then raise exception 'إحداثيات غير صالحة';end if;end loop;
 elsif typ in ('classify','match','order') then
  if coalesce(jsonb_typeof(q->'items'),'')<>'array' or jsonb_array_length(q->'items') not between 2 and 10 then raise exception 'بطاقات النشاط غير صالحة';end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(q->'items'))<>jsonb_array_length(q->'items') then raise exception 'معرف بطاقة مكرر';end if;
  if typ='order' then
   if coalesce(jsonb_typeof(q->'answer'),'')<>'array' or jsonb_array_length(q->'answer')<>jsonb_array_length(q->'items') or (select count(distinct value) from jsonb_array_elements_text(q->'answer'))<>jsonb_array_length(q->'items') or exists(select 1 from jsonb_array_elements_text(q->'answer') a where not exists(select 1 from jsonb_array_elements(q->'items') i where i->>'id'=a)) then raise exception 'ترتيب الإجابة غير صالح';end if;
  else
   if coalesce(jsonb_typeof(q->'answer'),'')<>'object' or coalesce(jsonb_typeof(q->'optionIds'),'')<>'array' or jsonb_array_length(q->'optionIds')<>n then raise exception 'مفاتيح التصنيف غير صالحة';end if;
   if (select count(*) from jsonb_object_keys(q->'answer'))<>jsonb_array_length(q->'items') then raise exception 'عدد الإجابات غير صحيح';end if;
   for it in select value from jsonb_array_elements(q->'items') loop if not(q->'answer'?(it->>'id')) or not exists(select 1 from jsonb_array_elements_text(q->'optionIds') op where op=q->'answer'->>(it->>'id')) then raise exception 'إجابة بطاقة غير صالحة';end if;end loop;
  end if;
 else raise exception 'نوع سؤال غير معروف';end if;
end $$;
alter function public.ae_validate(jsonb) rename to ae_validate_legacy;
create function public.ae_validate(p_document jsonb) returns void language plpgsql set search_path='' as $$
declare s jsonb;p jsonb;q jsonb;ids text[]:='{}';i int:=0;begin
 if p_document->>'format' is distinct from '2' then perform public.ae_validate_legacy(p_document);return;end if;
 if coalesce(length(p_document->>'title'),0) not between 3 and 160 or octet_length(p_document::text)>350000 or jsonb_array_length(p_document->'stations')<>4 or jsonb_array_length(p_document->'final')<>8 or jsonb_array_length(p_document->'evidence')<>4 then raise exception 'راجع بنية الدرس الكامل';end if;
 for s in select value from jsonb_array_elements(p_document->'stations') loop
  i:=i+1;if (s->>'id')::int<>i or coalesce(length(s->>'title'),0)=0 or jsonb_array_length(s->'questions')<>5 or jsonb_array_length(s->'pages') not between 1 and 16 then raise exception 'بيانات المحطة غير صالحة';end if;
  for p in select value from jsonb_array_elements(s->'pages') loop
   if coalesce(p->>'id','')!~'^[a-z0-9-]{1,60}$' or p->>'id'=any(ids) or coalesce(length(p->>'title'),0)=0 or jsonb_array_length(p->'cards')<1 then raise exception 'صفحة شرح غير صالحة';end if;ids:=array_append(ids,p->>'id');
   for q in select value from jsonb_array_elements(p->'cards') loop if coalesce(length(q->>'text'),0)=0 or coalesce(length(q->>'title'),0)=0 then raise exception 'بطاقة شرح فارغة';end if;end loop;
   if p->'exercise' is not null and p->'exercise'<>'null'::jsonb then perform ae_private.validate_question(p->'exercise');if p->'exercise'->>'id'=any(ids) then raise exception 'معرّف نشاط مكرر';end if;ids:=array_append(ids,p->'exercise'->>'id');end if;
  end loop;
 end loop;
 for q in select value from jsonb_array_elements(p_document->'final') union all select x.value from jsonb_array_elements(p_document->'stations') st cross join lateral jsonb_array_elements(st.value->'questions') x loop perform ae_private.validate_question(q);if q->>'id'=any(ids) then raise exception 'معرف سؤال مكرر';end if;ids:=array_append(ids,q->>'id');end loop;
 for p in select value from jsonb_array_elements(p_document->'evidence') loop if p->>'id'=any(ids) then raise exception 'معرف ملف مكرر';end if;ids:=array_append(ids,p->>'id');perform ae_private.validate_question(p->'exercise');if p->'exercise'->>'id'=any(ids) then raise exception 'معرف مراجعة مكرر';end if;ids:=array_append(ids,p->'exercise'->>'id');end loop;
end $$;
revoke all on function public.ae_validate(jsonb),public.ae_validate_legacy(jsonb) from public,anon,authenticated;
