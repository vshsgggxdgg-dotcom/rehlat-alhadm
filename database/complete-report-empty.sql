create or replace function public.ae_v2_reports() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.ae_me()->>'role'<>'teacher' then raise exception 'صلاحية المعلم مطلوبة';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from(select p.id,p.display_name,c.id course_id,c.title,r.id run_id,r.active,r.completed_at,coalesce(sum(a.score),0) score,count(a.question_id) answered,count(a.question_id) filter(where a.correct or a.attempts=2) finished,coalesce(max(a.updated_at),r.started_at) last_active from public.ae_v2_runs r join public.ae_profiles p on p.id=r.user_id join public.ae_courses c on c.id=r.course_id left join public.ae_v2_answers a on a.run_id=r.id where not p.disabled and (c.owner_id=auth.uid() or c.owner_id is null) group by p.id,p.display_name,c.id,c.title,r.id,r.active,r.completed_at) x),'[]')||public.ae_reports();
end $$;
