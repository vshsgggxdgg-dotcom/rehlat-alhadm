alter table public.ae_profiles add column if not exists disabled boolean not null default false;
create or replace function public.ae_me() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ae_profiles; begin
 if auth.uid() is null or exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then raise exception 'سجّل الدخول بحساب بريد إلكتروني أولًا'; end if;
 select * into p from public.ae_profiles where id=auth.uid();
 if p.disabled then raise exception 'هذا الحساب معطل';end if;
 if p.id is null then
  insert into public.ae_profiles(id,display_name) values(auth.uid(),coalesce(nullif(left((select raw_user_meta_data->>'display_name' from auth.users where id=auth.uid()),100),''),'مستكشف جديد')) returning * into p;
 end if;
 return to_jsonb(p);
end $$;
create or replace function public.ae_reports() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (public.ae_me()->>'role')<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select p.id,p.display_name,c.id course_id,c.title,sum(a.score) score,count(*) answered,count(*) filter(where a.correct or a.attempts>=2) finished,max(a.updated_at) last_active from public.ae_answers a join public.ae_profiles p on p.id=a.user_id join public.ae_courses c on c.id=a.course_id where not p.disabled and (c.owner_id=auth.uid() or c.owner_id is null) group by p.id,p.display_name,c.id,c.title) r),'[]'::jsonb);
end $$;
