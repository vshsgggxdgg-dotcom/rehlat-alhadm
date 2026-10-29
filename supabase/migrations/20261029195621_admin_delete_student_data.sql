CREATE OR REPLACE FUNCTION public.rpc_admin_delete_student_data(p_student_id text,p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids text[]; count_students integer;
BEGIN
 IF NOT public.is_authenticated_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF p_student_id IS NULL THEN
   IF p_confirmation IS DISTINCT FROM 'حذف جميع بيانات الطلاب' THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
 ELSE
   IF p_student_id='' OR p_confirmation IS DISTINCT FROM 'حذف بيانات الطالب' THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
 END IF;
 SELECT array_agg(student_id) INTO ids FROM (SELECT student_id FROM public.student_profiles WHERE p_student_id IS NULL OR student_id=p_student_id FOR UPDATE) locked;
 count_students:=coalesce(array_length(ids,1),0);
 DELETE FROM public.student_achievements WHERE student_id=ANY(ids);
 DELETE FROM public.activity_submissions WHERE student_id=ANY(ids);
 DELETE FROM public.student_level_best_scores WHERE student_id=ANY(ids);
 DELETE FROM public.scored_level_runs WHERE student_id=ANY(ids);
 DELETE FROM public.student_journeys WHERE student_id=ANY(ids);
 DELETE FROM public.student_profiles WHERE student_id=ANY(ids);
 RETURN jsonb_build_object('deletedStudents',count_students);
END $$;
REVOKE ALL ON FUNCTION public.rpc_admin_delete_student_data(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_student_data(text,text) TO authenticated;
