CREATE OR REPLACE FUNCTION public.rpc_ensure_student_session(p_display_name text, p_avatar_id text, p_content_version_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_student_id text;
  v_clean_name text;
  v_clean_avatar text;
  v_journey_id uuid;
  v_lvl RECORD;
  v_run_id text;
  v_act_count integer;
BEGIN
  v_uid := auth.uid();
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: يتطلب إنشاء جلسة الطالب مصادقة Supabase صالحة.';
  END IF;

  PERFORM public.assert_rate_limit('ensure_student_session', 20);

  v_clean_name := btrim(coalesce(p_display_name, ''));
  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 60 THEN
    RAISE EXCEPTION 'INVALID_NAME: يرجى إدخال اسم صالح للطالب.';
  END IF;

  v_clean_avatar := CASE
    WHEN p_avatar_id IN ('girl-noor', 'girl-salma', 'girl-farida', 'boy-omar', 'boy-ziad', 'boy-karim')
      THEN p_avatar_id
    ELSE 'girl-noor'
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_versions
    WHERE content_version_id = p_content_version_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'INVALID_CONTENT_VERSION: إصدار المحتوى المطلوب غير منشور أو غير موجود (%).', p_content_version_id;
  END IF;

  v_student_id := 'stu_' || replace(v_uid::text, '-', '');

  INSERT INTO public.student_profiles (
    student_id, auth_user_id, display_name, avatar_id, grade_level, last_active_at
  )
  VALUES (
    v_student_id, v_uid, v_clean_name, v_clean_avatar, 'grade-6', now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      avatar_id = EXCLUDED.avatar_id,
      last_active_at = now()
  RETURNING student_id INTO v_student_id;

  -- Ensure an active journey exists for this student & content version
  SELECT journey_id INTO v_journey_id
  FROM public.student_journeys
  WHERE student_id = v_student_id
    AND content_version_id = p_content_version_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_journey_id IS NULL THEN
    INSERT INTO public.student_journeys (
      student_id, auth_user_id, content_version_id, status
    )
    VALUES (
      v_student_id, v_uid, p_content_version_id, 'active'
    )
    RETURNING journey_id INTO v_journey_id;
  END IF;

  -- Ensure each level has an active or completed run in this journey
  FOR v_lvl IN
    SELECT level_id, max_possible_score
    FROM public.curriculum_levels
    WHERE content_version_id = p_content_version_id
    ORDER BY level_order ASC
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.scored_level_runs
      WHERE journey_id = v_journey_id
        AND level_id = v_lvl.level_id
        AND status IN ('in_progress', 'completed')
    ) THEN
      SELECT count(*) INTO v_act_count
      FROM public.curriculum_activities
      WHERE content_version_id = p_content_version_id
        AND level_id = v_lvl.level_id;

      v_run_id := 'run_' || encode(extensions.gen_random_bytes(8), 'hex');
      INSERT INTO public.scored_level_runs (
        run_id, journey_id, student_id, auth_user_id, content_version_id,
        level_id, run_number, status, score_earned, max_possible_score,
        completed_activities_count, total_activities_count
      )
      VALUES (
        v_run_id, v_journey_id, v_student_id, v_uid, p_content_version_id,
        v_lvl.level_id, 1, 'in_progress', 0, v_lvl.max_possible_score,
        0, GREATEST(v_act_count, 1)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'studentId', v_student_id,
    'journeyId', v_journey_id,
    'displayName', v_clean_name,
    'avatarId', v_clean_avatar,
    'contentVersionId', p_content_version_id
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rpc_start_full_replay(p_content_version_id text, p_confirm_discard_unfinished boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_student_id text;
  v_current_journey_id uuid;
  v_has_unfinished_run boolean;
  v_new_journey_id uuid;
  v_lvl RECORD;
  v_act_count integer;
  v_new_run_id text;
BEGIN
  v_uid := auth.uid();
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: يجب تسجيل الدخول أولاً.';
  END IF;

  PERFORM public.assert_rate_limit('start_full_replay', 15);

  SELECT student_id INTO v_student_id
  FROM public.student_profiles
  WHERE auth_user_id = v_uid;

  SELECT journey_id INTO v_current_journey_id
  FROM public.student_journeys
  WHERE student_id = v_student_id
    AND content_version_id = p_content_version_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_current_journey_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.scored_level_runs slr
      JOIN public.activity_submissions sub ON sub.run_id = slr.run_id
      WHERE slr.journey_id = v_current_journey_id
        AND slr.status = 'in_progress'
    ) INTO v_has_unfinished_run;

    IF v_has_unfinished_run AND NOT coalesce(p_confirm_discard_unfinished, false) THEN
      RAISE EXCEPTION 'CONFIRMATION_REQUIRED: توجد جولة حالية غير مكتملة؛ يجب تأكيد الاستبدال قبل بدء رحلة جديدة.';
    END IF;

    UPDATE public.scored_level_runs
    SET status = 'discarded', completed_at = now()
    WHERE journey_id = v_current_journey_id
      AND status = 'in_progress';

    UPDATE public.student_journeys
    SET status = 'superseded_by_replay', completed_at = now()
    WHERE journey_id = v_current_journey_id;
  END IF;

  INSERT INTO public.student_journeys (
    student_id, auth_user_id, content_version_id, status
  )
  VALUES (
    v_student_id, v_uid, p_content_version_id, 'active'
  )
  RETURNING journey_id INTO v_new_journey_id;

  FOR v_lvl IN
    SELECT level_id, max_possible_score
    FROM public.curriculum_levels
    WHERE content_version_id = p_content_version_id
    ORDER BY level_order ASC
  LOOP
    SELECT count(*) INTO v_act_count
    FROM public.curriculum_activities
    WHERE content_version_id = p_content_version_id
      AND level_id = v_lvl.level_id;

    v_new_run_id := 'run_' || encode(extensions.gen_random_bytes(8), 'hex');
    INSERT INTO public.scored_level_runs (
      run_id, journey_id, student_id, auth_user_id, content_version_id,
      level_id, run_number, status, score_earned, max_possible_score,
      completed_activities_count, total_activities_count
    )
    VALUES (
      v_new_run_id, v_new_journey_id, v_student_id, v_uid, p_content_version_id,
      v_lvl.level_id, 1, 'in_progress', 0, v_lvl.max_possible_score,
      0, GREATEST(v_act_count, 1)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'newJourneyId', v_new_journey_id,
    'contentVersionId', p_content_version_id
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rpc_start_level_replay(p_content_version_id text, p_level_id text, p_confirm_discard_unfinished boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_student_id text;
  v_journey_id uuid;
  v_current_run RECORD;
  v_has_submissions boolean;
  v_next_run_number integer;
  v_new_run_id text;
  v_level RECORD;
  v_act_count integer;
  v_best_score integer;
BEGIN
  v_uid := auth.uid();
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: يجب تسجيل الدخول أولاً.';
  END IF;

  PERFORM public.assert_rate_limit('start_level_replay', 20);

  SELECT student_id INTO v_student_id
  FROM public.student_profiles
  WHERE auth_user_id = v_uid;

  SELECT journey_id INTO v_journey_id
  FROM public.student_journeys
  WHERE student_id = v_student_id
    AND content_version_id = p_content_version_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_journey_id IS NULL THEN
    RAISE EXCEPTION 'JOURNEY_NOT_FOUND: لا توجد رحلة نشطة لهذا الإصدار.';
  END IF;

  SELECT * INTO v_current_run
  FROM public.scored_level_runs
  WHERE journey_id = v_journey_id
    AND level_id = p_level_id
    AND status IN ('in_progress', 'completed')
  ORDER BY run_number DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_current_run.status = 'in_progress' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.activity_submissions WHERE run_id = v_current_run.run_id
    ) INTO v_has_submissions;

    IF v_has_submissions AND NOT coalesce(p_confirm_discard_unfinished, false) THEN
      RAISE EXCEPTION 'CONFIRMATION_REQUIRED: توجد جولة حالية غير مكتملة؛ يجب تأكيد الاستبدال أولاً.';
    END IF;

    UPDATE public.scored_level_runs
    SET status = 'discarded', completed_at = now()
    WHERE run_id = v_current_run.run_id;
  END IF;

  SELECT coalesce(max(run_number), 0) + 1 INTO v_next_run_number
  FROM public.scored_level_runs
  WHERE journey_id = v_journey_id
    AND level_id = p_level_id;

  SELECT * INTO v_level
  FROM public.curriculum_levels
  WHERE content_version_id = p_content_version_id
    AND level_id = p_level_id;

  SELECT count(*) INTO v_act_count
  FROM public.curriculum_activities
  WHERE content_version_id = p_content_version_id
    AND level_id = p_level_id;

  v_new_run_id := 'run_' || encode(extensions.gen_random_bytes(8), 'hex');

  INSERT INTO public.scored_level_runs (
    run_id, journey_id, student_id, auth_user_id, content_version_id,
    level_id, run_number, status, score_earned, max_possible_score,
    completed_activities_count, total_activities_count
  )
  VALUES (
    v_new_run_id, v_journey_id, v_student_id, v_uid, p_content_version_id,
    p_level_id, v_next_run_number, 'in_progress', 0, v_level.max_possible_score,
    0, GREATEST(v_act_count, 1)
  );

  SELECT best_completed_score INTO v_best_score
  FROM public.student_level_best_scores
  WHERE student_id = v_student_id
    AND content_version_id = p_content_version_id
    AND level_id = p_level_id;

  RETURN jsonb_build_object(
    'newRunId', v_new_run_id,
    'levelId', p_level_id,
    'runNumber', v_next_run_number,
    'preservedBestCompletedScore', v_best_score
  );
END;
$function$
;
