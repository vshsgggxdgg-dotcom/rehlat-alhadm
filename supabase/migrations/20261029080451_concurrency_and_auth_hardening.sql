CREATE OR REPLACE FUNCTION public.rpc_submit_activity_attempt(p_run_id text, p_content_version_id text, p_level_id text, p_activity_id text, p_submitted_answer text, p_duration_ms integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_student_id text;
  v_journey_id uuid;
  v_existing_sub RECORD;
  v_run RECORD;
  v_level RECORD;
  v_prev_level_id text;
  v_prev_completed boolean;
  v_activity RECORD;
  v_key RECORD;
  v_existing_attempts_count integer;
  v_already_solved boolean;
  v_attempt_number integer;
  v_is_correct boolean;
  v_score_earned integer;
  v_submission_id text;
  v_completed_in_run integer;
  v_run_total_score integer;
  v_is_level_now_completed boolean := false;
  v_best_score integer;
  v_badge_id text;
  v_badge_title text;
  v_response jsonb;
  v_act_count integer;
  v_next_run_number integer;
  v_auto_run_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: يجب تسجيل الدخول قبل إرسال الإجابة.';
  END IF;

  IF btrim(coalesce(p_idempotency_key, '')) = '' THEN
    RAISE EXCEPTION 'MISSING_IDEMPOTENCY_KEY: مفتاح منع التكرار (idempotency_key) مطلوب.';
  END IF;

  PERFORM public.assert_rate_limit('submit_activity_attempt', 45);

  SELECT student_id INTO v_student_id
  FROM public.student_profiles
  WHERE auth_user_id = v_uid;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: لم يتم العثور على ملف الطالب المرتبط بالجلسة.';
  END IF;

  -- 1. Idempotency check: if this idempotency_key was already processed, return stored result
  SELECT submission_id, auth_user_id, response_payload_json
  INTO v_existing_sub
  FROM public.activity_submissions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_sub.auth_user_id <> v_uid THEN
      RAISE EXCEPTION 'FORBIDDEN_IDEMPOTENCY_KEY: مفتاح العملية يخص جلسة أخرى.';
    END IF;
    RETURN v_existing_sub.response_payload_json || jsonb_build_object('idempotentReplay', true);
  END IF;

  -- 2. Validate content version is published
  IF NOT EXISTS (
    SELECT 1 FROM public.content_versions
    WHERE content_version_id = p_content_version_id
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'INVALID_CONTENT_VERSION: إصدار المحتوى (%) غير منشور.', p_content_version_id;
  END IF;

  -- 3. Validate level & level unlock state
  SELECT * INTO v_level
  FROM public.curriculum_levels
  WHERE content_version_id = p_content_version_id
    AND level_id = p_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEVEL_NOT_FOUND: المستوى المطلوب غير موجود في هذا الإصدار.';
  END IF;

  IF v_level.level_order > 1 THEN
    SELECT level_id INTO v_prev_level_id
    FROM public.curriculum_levels
    WHERE content_version_id = p_content_version_id
      AND level_order = v_level.level_order - 1;

    v_prev_completed := EXISTS (
      SELECT 1 FROM public.student_level_best_scores
      WHERE student_id = v_student_id
        AND content_version_id = p_content_version_id
        AND level_id = v_prev_level_id
    ) OR EXISTS (
      SELECT 1 FROM public.scored_level_runs
      WHERE student_id = v_student_id
        AND content_version_id = p_content_version_id
        AND level_id = v_prev_level_id
        AND status = 'completed'
    );

    IF NOT v_prev_completed THEN
      RAISE EXCEPTION 'LEVEL_LOCKED: لا يمكن إرسال إجابات للمستوى % قبل إكمال المستوى السابق.', v_level.level_order;
    END IF;
  END IF;

  -- 4. Lock & validate the scored level run row (support exact match or active in_progress run)
  SELECT * INTO v_run
  FROM public.scored_level_runs
  WHERE run_id = p_run_id
    AND student_id = v_student_id
    AND auth_user_id = v_uid
    AND content_version_id = p_content_version_id
    AND level_id = p_level_id
  FOR UPDATE;

  IF v_run.run_id IS NULL THEN
    RAISE EXCEPTION 'RUN_NOT_FOUND: جولة المستوى المحددة غير صالحة أو لا تخص هذا الطالب.';
  END IF;

  IF v_run.status <> 'in_progress' THEN
    RAISE EXCEPTION 'RUN_ALREADY_CLOSED: جولة المستوى ليست قيد التقدم (%).', v_run.status;
  END IF;

  -- 5. Validate activity belongs to this level & version
  SELECT * INTO v_activity
  FROM public.curriculum_activities
  WHERE content_version_id = p_content_version_id
    AND level_id = p_level_id
    AND activity_id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVITY_NOT_FOUND: النشاط المطلوب لا ينتمي إلى هذا المستوى.';
  END IF;

  -- 6. Validate remaining attempts within this run (max 2 attempts, and cannot re-submit after solving)
  SELECT
    count(*),
    coalesce(bool_or(is_correct), false)
  INTO
    v_existing_attempts_count,
    v_already_solved
  FROM public.activity_submissions
  WHERE run_id = v_run.run_id
    AND activity_id = p_activity_id;

  IF v_already_solved OR v_existing_attempts_count >= 2 THEN
    RAISE EXCEPTION 'ACTIVITY_ALREADY_COMPLETED: تم استنفاد محاولات هذا النشاط أو إكماله مسبقاً في هذه الجولة.';
  END IF;

  v_attempt_number := v_existing_attempts_count + 1;

  -- 7. Fetch protected answer key and evaluate correctness & points on the server
  SELECT * INTO v_key
  FROM public.activity_answer_keys
  WHERE content_version_id = p_content_version_id
    AND activity_id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANSWER_KEY_MISSING: مفتاح الإجابة المحمي غير متوفر للنشاط (%).', p_activity_id;
  END IF;

  v_is_correct := (btrim(coalesce(p_submitted_answer, '')) = btrim(v_key.canonical_correct_answer));

  IF v_is_correct THEN
    IF v_attempt_number = 1 THEN
      v_score_earned := v_activity.max_score;
    ELSE
      v_score_earned := v_activity.max_score / 2;
    END IF;
  ELSE
    v_score_earned := 0;
  END IF;

  -- 8. Build state-appropriate feedback payload (NEVER leak solution or explanation on 1st wrong attempt!)
  v_submission_id := 'sub_' || encode(extensions.gen_random_bytes(10), 'hex');

  IF v_is_correct THEN
    v_response := jsonb_build_object(
      'submissionId', v_submission_id,
      'runId', v_run.run_id,
      'activityId', p_activity_id,
      'attemptNumber', v_attempt_number,
      'isCorrect', true,
      'isActivityCompleted', true,
      'remainingAttempts', 0,
      'scoreEarned', v_score_earned,
      'maxScore', v_activity.max_score,
      'revealedHintAr', null,
      'revealedExplanationAr', v_key.scientific_explanation_ar,
      'revealedCorrectAnswer', v_key.canonical_correct_answer
    );
  ELSIF v_attempt_number = 1 THEN
    -- First wrong submission: reveal ONLY the single activity-specific hint!
    v_response := jsonb_build_object(
      'submissionId', v_submission_id,
      'runId', v_run.run_id,
      'activityId', p_activity_id,
      'attemptNumber', 1,
      'isCorrect', false,
      'isActivityCompleted', false,
      'remainingAttempts', 1,
      'scoreEarned', 0,
      'maxScore', v_activity.max_score,
      'revealedHintAr', v_key.scientific_hint_ar,
      'revealedExplanationAr', null,
      'revealedCorrectAnswer', null
    );
  ELSE
    -- Second wrong submission: 0 points, activity completed, reveal correct solution & explanation
    v_response := jsonb_build_object(
      'submissionId', v_submission_id,
      'runId', v_run.run_id,
      'activityId', p_activity_id,
      'attemptNumber', 2,
      'isCorrect', false,
      'isActivityCompleted', true,
      'remainingAttempts', 0,
      'scoreEarned', 0,
      'maxScore', v_activity.max_score,
      'revealedHintAr', v_key.scientific_hint_ar,
      'revealedExplanationAr', v_key.scientific_explanation_ar,
      'revealedCorrectAnswer', v_key.canonical_correct_answer
    );
  END IF;

  -- 9. Insert submission record
  INSERT INTO public.activity_submissions (
    submission_id, idempotency_key, run_id, journey_id, student_id, auth_user_id,
    content_version_id, level_id, activity_id, attempt_number, submitted_answer,
    is_correct, score_earned, max_score, duration_ms, response_payload_json
  )
  VALUES (
    v_submission_id, p_idempotency_key, v_run.run_id, v_run.journey_id, v_student_id, v_uid,
    p_content_version_id, p_level_id, p_activity_id, v_attempt_number, btrim(coalesce(p_submitted_answer, '')),
    v_is_correct, v_score_earned, v_activity.max_score, GREATEST(coalesce(p_duration_ms, 0), 0), v_response
  );

  -- 10. Recompute run progress & check if all activities in the level are now completed
  SELECT
    count(DISTINCT activity_id) FILTER (WHERE is_correct = true OR attempt_number = 2),
    coalesce(sum(score_earned), 0)
  INTO
    v_completed_in_run,
    v_run_total_score
  FROM public.activity_submissions
  WHERE run_id = v_run.run_id;

  IF v_completed_in_run >= v_run.total_activities_count THEN
    v_is_level_now_completed := true;

    UPDATE public.scored_level_runs
    SET completed_activities_count = v_completed_in_run,
        score_earned = v_run_total_score,
        status = 'completed',
        completed_at = now()
    WHERE run_id = v_run.run_id;

    -- Upsert best completed level score: lower replay scores NEVER replace higher scores!
    INSERT INTO public.student_level_best_scores (
      student_id, content_version_id, level_id, auth_user_id,
      best_completed_score, max_possible_score, completions_count,
      first_completed_at, updated_at
    )
    VALUES (
      v_student_id, p_content_version_id, p_level_id, v_uid,
      v_run_total_score, v_run.max_possible_score, 1,
      now(), now()
    )
    ON CONFLICT (student_id, content_version_id, level_id)
    DO UPDATE SET
      best_completed_score = GREATEST(public.student_level_best_scores.best_completed_score, EXCLUDED.best_completed_score),
      completions_count = public.student_level_best_scores.completions_count + 1,
      updated_at = now()
    RETURNING best_completed_score INTO v_best_score;

    -- Award level badge regardless of point total once all activities in the level are finished
    v_badge_id := coalesce(v_level.badge_json ->> 'badgeId', 'badge-' || p_level_id);
    v_badge_title := coalesce(v_level.badge_json ->> 'titleAr', v_level.station_name_ar);

    INSERT INTO public.student_achievements (
      student_id, content_version_id, badge_id, auth_user_id,
      level_id, badge_title_ar, awarded_on_run_id
    )
    VALUES (
      v_student_id, p_content_version_id, v_badge_id, v_uid,
      p_level_id, v_badge_title, v_run.run_id
    )
    ON CONFLICT (student_id, content_version_id, badge_id) DO NOTHING;
  ELSE
    UPDATE public.scored_level_runs
    SET completed_activities_count = v_completed_in_run,
        score_earned = v_run_total_score
    WHERE run_id = v_run.run_id;

    SELECT best_completed_score INTO v_best_score
    FROM public.student_level_best_scores
    WHERE student_id = v_student_id
      AND content_version_id = p_content_version_id
      AND level_id = p_level_id;
  END IF;

  v_response := v_response || jsonb_build_object(
    'levelCompletedInRun', v_is_level_now_completed,
    'currentRunScoreEarned', v_run_total_score,
    'bestCompletedScoreEarned', v_best_score
  );

  UPDATE public.activity_submissions
  SET response_payload_json = v_response
  WHERE submission_id = v_submission_id;

  RETURN v_response;
END;
$function$;
ALTER FUNCTION public.enforce_published_version_immutability() SET search_path = public;
REVOKE ALL ON FUNCTION public.assert_rate_limit(text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_get_admin_session_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_admin_session_status() TO authenticated;
CREATE OR REPLACE FUNCTION public.rpc_practice_activity(p_content_version_id text,p_activity_id text,p_answer text,p_attempt_number integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.activity_answer_keys; correct boolean; done boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_attempt_number NOT IN (1,2) THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.activity_submissions WHERE auth_user_id=auth.uid() AND content_version_id=p_content_version_id AND activity_id=p_activity_id GROUP BY run_id HAVING bool_or(is_correct) OR count(*)>=2) THEN RAISE EXCEPTION 'PRACTICE_REQUIRES_COMPLETED_ACTIVITY'; END IF;
 PERFORM public.assert_rate_limit('practice',60);
 SELECT * INTO STRICT k FROM public.activity_answer_keys WHERE content_version_id=p_content_version_id AND activity_id=p_activity_id;
 correct:=btrim(p_answer)=btrim(k.canonical_correct_answer); done:=correct OR p_attempt_number=2;
 RETURN jsonb_build_object('isCorrect',correct,'attemptNumber',p_attempt_number,'revealedHintAr',CASE WHEN NOT correct THEN k.scientific_hint_ar ELSE NULL END,'revealedExplanationAr',CASE WHEN done THEN k.scientific_explanation_ar ELSE NULL END,'revealedCorrectAnswer',CASE WHEN done THEN k.canonical_correct_answer ELSE NULL END);
END;$$;
REVOKE ALL ON FUNCTION public.rpc_practice_activity(text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_practice_activity(text,text,text,integer) TO authenticated;

