ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS class_name text;
CREATE UNIQUE INDEX IF NOT EXISTS student_name_class_identity ON public.student_profiles (display_name, class_name) WHERE class_name IS NOT NULL;

-- Owner explicitly chose recovery by full name + class, without a secret.
-- This is a classroom identity lookup, not proof of the student's identity.
CREATE OR REPLACE FUNCTION public.rpc_enter_class_student(p_display_name text, p_class_name text, p_avatar_id text, p_content_version_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n text := regexp_replace(btrim(p_display_name), '\s+', ' ', 'g'); c text := btrim(p_class_name); u uuid:=auth.uid(); target text; own_id text; t text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'يلزم تسجيل الدخول'; END IF;
 IF char_length(n)>60 OR array_length(string_to_array(n,' '),1)<3 OR n !~ '^[[:alpha:]ء-ي ]+$' THEN RAISE EXCEPTION 'اكتب اسمك الثلاثي على الأقل بالحروف'; END IF;
 IF c !~ '^6/[1-9][0-9]?$' THEN RAISE EXCEPTION 'اختر الفصل الصحيح'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(n||':'||c,0));
 SELECT student_id INTO own_id FROM student_profiles WHERE auth_user_id=u;
 SELECT student_id INTO target FROM student_profiles WHERE display_name=n AND class_name=c FOR UPDATE;
 IF target IS NOT NULL THEN
   IF own_id IS NOT NULL AND own_id<>target THEN RAISE EXCEPTION 'سجل الخروج أولاً للدخول باسم طالب آخر'; END IF;
   -- Move ownership of the same immutable student ID; never create new scores.
   FOREACH t IN ARRAY ARRAY['student_profiles','student_journeys','scored_level_runs','activity_submissions','student_level_best_scores','student_achievements'] LOOP
     EXECUTE format('UPDATE public.%I SET auth_user_id=$1 WHERE student_id=$2',t) USING u,target;
   END LOOP;
   UPDATE student_profiles SET last_active_at=now() WHERE student_id=target;
 ELSE
   IF own_id IS NOT NULL AND EXISTS(SELECT 1 FROM student_profiles WHERE student_id=own_id AND class_name IS NOT NULL AND (display_name<>n OR class_name<>c)) THEN RAISE EXCEPTION 'سجل الخروج أولاً للدخول باسم طالب آخر'; END IF;
   PERFORM rpc_ensure_student_session(n,p_avatar_id,p_content_version_id);
   UPDATE student_profiles SET display_name=n,class_name=c,last_active_at=now() WHERE auth_user_id=u RETURNING student_id INTO target;
 END IF;
 RETURN jsonb_build_object('studentId',target);
END $$;
REVOKE ALL ON FUNCTION public.rpc_enter_class_student(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_enter_class_student(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_update_student(p_student_id text,p_display_name text,p_class_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n text:=regexp_replace(btrim(p_display_name),'\s+',' ','g');
BEGIN
 IF NOT public.is_authenticated_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF char_length(n)>60 OR array_length(string_to_array(n,' '),1)<3 OR btrim(p_class_name) !~ '^6/[1-9][0-9]?$' THEN RAISE EXCEPTION 'اكتب الاسم الثلاثي والفصل بصيغة 6/1'; END IF;
 UPDATE student_profiles SET display_name=n,class_name=btrim(p_class_name) WHERE student_id=p_student_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'الطالب غير موجود'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.rpc_admin_update_student(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_student(text,text,text) TO authenticated;
