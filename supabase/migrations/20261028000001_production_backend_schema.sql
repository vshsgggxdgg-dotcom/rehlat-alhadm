-- ============================================================================
-- «رحلة الهضم» (Digestion Journey) — Production Backend Schema, RLS & RPCs
-- Migration: 20261028000001_production_backend_schema.sql
--
-- SAFETY RULE:
-- This migration is strictly non-destructive. It never drops tables, truncates
-- records, or resets existing production data.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ADMINISTRATOR AUTHORIZATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  email text NOT NULL,
  role_name text NOT NULL DEFAULT 'curriculum_admin'
    CHECK (role_name IN ('curriculum_admin', 'super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.is_authenticated_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_anon boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  v_is_anon := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  IF v_is_anon THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = v_uid
      AND ar.is_active = true
  );
END;
$$;

-- ============================================================================
-- 2. ABUSE PROTECTION & RATE LIMITING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.backend_rate_limits (
  caller_key text NOT NULL,
  action_name text NOT NULL,
  window_bucket timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (caller_key, action_name, window_bucket)
);

CREATE OR REPLACE FUNCTION public.assert_rate_limit(
  p_action_name text,
  p_max_requests_per_minute integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_caller_key text;
  v_bucket timestamptz;
  v_count integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED_CALLER: يجب تسجيل الدخول أولاً.';
  END IF;

  v_caller_key := v_uid::text;
  v_bucket := date_trunc('minute', now());

  INSERT INTO public.backend_rate_limits (caller_key, action_name, window_bucket, request_count)
  VALUES (v_caller_key, p_action_name, v_bucket, 1)
  ON CONFLICT (caller_key, action_name, window_bucket)
  DO UPDATE SET request_count = public.backend_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > p_max_requests_per_minute THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: تم تجاوز الحد المسموح للطلبات المتتالية (%). يرجى الانتظار لحظات.', p_action_name;
  END IF;
END;
$$;

-- ============================================================================
-- 3. STUDENT PROFILES LINKED TO AUTHENTICATION IDENTITIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_profiles (
  student_id text PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  avatar_id text NOT NULL DEFAULT 'girl-noor'
    CHECK (avatar_id IN ('girl-noor', 'girl-salma', 'girl-farida', 'boy-omar', 'boy-ziad', 'boy-karim')),
  grade_level text NOT NULL DEFAULT 'grade-6',
  has_completed_instructions boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. IMMUTABLE PUBLISHED CONTENT VERSIONS & EDITABLE DRAFTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_versions (
  content_version_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  base_version_id text REFERENCES public.content_versions(content_version_id) ON DELETE RESTRICT,
  title_ar text NOT NULL,
  subtitle_ar text NOT NULL,
  grade_ar text NOT NULL,
  subject_ar text NOT NULL,
  about_text_ar text NOT NULL,
  instructions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.curriculum_levels (
  content_version_id text NOT NULL REFERENCES public.content_versions(content_version_id) ON DELETE RESTRICT,
  level_id text NOT NULL,
  level_order integer NOT NULL CHECK (level_order BETWEEN 1 AND 6),
  station_name_ar text NOT NULL,
  organ_name_ar text NOT NULL,
  subtitle_ar text NOT NULL,
  illustration_key text NOT NULL,
  badge_json jsonb NOT NULL,
  learning_objectives_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  core_facts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_concepts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_possible_score integer NOT NULL CHECK (max_possible_score > 0),
  PRIMARY KEY (content_version_id, level_id),
  UNIQUE (content_version_id, level_order)
);

-- Public presentation table for activities — NEVER contains answer keys!
CREATE TABLE IF NOT EXISTS public.curriculum_activities (
  content_version_id text NOT NULL,
  activity_id text NOT NULL,
  level_id text NOT NULL,
  activity_order integer NOT NULL CHECK (activity_order >= 1),
  activity_type text NOT NULL
    CHECK (activity_type IN (
      'multiple_choice',
      'fill_in',
      'ordering',
      'matching',
      'image_identification',
      'villi_comparison'
    )),
  title_ar text NOT NULL,
  prompt_ar text NOT NULL,
  max_score integer NOT NULL CHECK (max_score > 0 AND max_score % 2 = 0),
  public_options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_interaction_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_asset_url text,
  PRIMARY KEY (content_version_id, activity_id),
  FOREIGN KEY (content_version_id, level_id)
    REFERENCES public.curriculum_levels(content_version_id, level_id)
    ON DELETE RESTRICT
);

-- Protected Answer Keys Table — NEVER readable by students (`anon` or non-admin `authenticated`)
CREATE TABLE IF NOT EXISTS public.activity_answer_keys (
  content_version_id text NOT NULL,
  activity_id text NOT NULL,
  canonical_correct_answer text NOT NULL,
  answer_key_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  scientific_hint_ar text NOT NULL,
  scientific_explanation_ar text NOT NULL,
  option_feedback_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_version_id, activity_id),
  FOREIGN KEY (content_version_id, activity_id)
    REFERENCES public.curriculum_activities(content_version_id, activity_id)
    ON DELETE RESTRICT
);

-- Activity-to-Topic Mappings for Personalized Review Recommendations
CREATE TABLE IF NOT EXISTS public.activity_topic_mappings (
  content_version_id text NOT NULL,
  activity_id text NOT NULL,
  level_id text NOT NULL,
  level_order integer NOT NULL,
  topic_id text NOT NULL,
  topic_title_ar text NOT NULL,
  approved_explanation_ar text NOT NULL,
  PRIMARY KEY (content_version_id, activity_id),
  FOREIGN KEY (content_version_id, activity_id)
    REFERENCES public.curriculum_activities(content_version_id, activity_id)
    ON DELETE RESTRICT
);

-- ============================================================================
-- 5. IMMUTABILITY TRIGGERS FOR PUBLISHED CONTENT VERSIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_published_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id text;
  v_status text;
BEGIN
  IF TG_TABLE_NAME = 'content_versions' THEN
    IF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION: لا يمكن حذف إصدار محتوى منشور (%).', OLD.content_version_id;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
      -- Only allow transitioning published -> archived if needed; forbid content mutation
      IF NEW.title_ar IS DISTINCT FROM OLD.title_ar
         OR NEW.subtitle_ar IS DISTINCT FROM OLD.subtitle_ar
         OR NEW.about_text_ar IS DISTINCT FROM OLD.about_text_ar
         OR NEW.instructions_json IS DISTINCT FROM OLD.instructions_json
         OR NEW.status = 'draft' THEN
        RAISE EXCEPTION 'IMMUTABLE_VERSION: إصدار المحتوى المنشور (%) غير قابل للتعديل المباشر. أنشئ مسودة إصدار جديد.', OLD.content_version_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_version_id := COALESCE(OLD.content_version_id, NEW.content_version_id);
  SELECT status INTO v_status
  FROM public.content_versions
  WHERE content_version_id = v_version_id;

  IF v_status = 'published' THEN
    RAISE EXCEPTION 'IMMUTABLE_VERSION: لا يمكن تعديل أو حذف بيانات تابعة لإصدار محتوى منشور (%).', v_version_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_content_versions ON public.content_versions;
CREATE TRIGGER trg_immutable_content_versions
BEFORE UPDATE OR DELETE ON public.content_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutability();

DROP TRIGGER IF EXISTS trg_immutable_curriculum_levels ON public.curriculum_levels;
CREATE TRIGGER trg_immutable_curriculum_levels
BEFORE INSERT OR UPDATE OR DELETE ON public.curriculum_levels
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutability();

DROP TRIGGER IF EXISTS trg_immutable_curriculum_activities ON public.curriculum_activities;
CREATE TRIGGER trg_immutable_curriculum_activities
BEFORE INSERT OR UPDATE OR DELETE ON public.curriculum_activities
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutability();

DROP TRIGGER IF EXISTS trg_immutable_activity_answer_keys ON public.activity_answer_keys;
CREATE TRIGGER trg_immutable_activity_answer_keys
BEFORE INSERT OR UPDATE OR DELETE ON public.activity_answer_keys
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutability();

DROP TRIGGER IF EXISTS trg_immutable_activity_topic_mappings ON public.activity_topic_mappings;
CREATE TRIGGER trg_immutable_activity_topic_mappings
BEFORE INSERT OR UPDATE OR DELETE ON public.activity_topic_mappings
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutability();

-- ============================================================================
-- 6. JOURNEYS, SCORED LEVEL RUNS, SUBMISSIONS, BEST SCORES & ACHIEVEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_journeys (
  journey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.student_profiles(student_id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content_version_id text NOT NULL REFERENCES public.content_versions(content_version_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'superseded_by_replay')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.scored_level_runs (
  run_id text PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES public.student_journeys(journey_id) ON DELETE RESTRICT,
  student_id text NOT NULL REFERENCES public.student_profiles(student_id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content_version_id text NOT NULL,
  level_id text NOT NULL,
  run_number integer NOT NULL DEFAULT 1 CHECK (run_number >= 1),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'discarded')),
  score_earned integer NOT NULL DEFAULT 0 CHECK (score_earned >= 0),
  max_possible_score integer NOT NULL CHECK (max_possible_score > 0),
  completed_activities_count integer NOT NULL DEFAULT 0 CHECK (completed_activities_count >= 0),
  total_activities_count integer NOT NULL CHECK (total_activities_count > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (content_version_id, level_id)
    REFERENCES public.curriculum_levels(content_version_id, level_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.activity_submissions (
  submission_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  run_id text NOT NULL REFERENCES public.scored_level_runs(run_id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES public.student_journeys(journey_id) ON DELETE RESTRICT,
  student_id text NOT NULL REFERENCES public.student_profiles(student_id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content_version_id text NOT NULL,
  level_id text NOT NULL,
  activity_id text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number IN (1, 2)),
  submitted_answer text NOT NULL,
  is_correct boolean NOT NULL,
  score_earned integer NOT NULL CHECK (score_earned >= 0),
  max_score integer NOT NULL CHECK (max_score > 0),
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  response_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, activity_id, attempt_number),
  FOREIGN KEY (content_version_id, activity_id)
    REFERENCES public.curriculum_activities(content_version_id, activity_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.student_level_best_scores (
  student_id text NOT NULL REFERENCES public.student_profiles(student_id) ON DELETE RESTRICT,
  content_version_id text NOT NULL REFERENCES public.content_versions(content_version_id) ON DELETE RESTRICT,
  level_id text NOT NULL,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  best_completed_score integer NOT NULL CHECK (best_completed_score >= 0),
  max_possible_score integer NOT NULL CHECK (max_possible_score > 0),
  completions_count integer NOT NULL DEFAULT 1 CHECK (completions_count >= 1),
  first_completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, content_version_id, level_id),
  FOREIGN KEY (content_version_id, level_id)
    REFERENCES public.curriculum_levels(content_version_id, level_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.student_achievements (
  student_id text NOT NULL REFERENCES public.student_profiles(student_id) ON DELETE RESTRICT,
  content_version_id text NOT NULL REFERENCES public.content_versions(content_version_id) ON DELETE RESTRICT,
  badge_id text NOT NULL,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  level_id text NOT NULL,
  badge_title_ar text NOT NULL,
  awarded_on_run_id text NOT NULL REFERENCES public.scored_level_runs(run_id) ON DELETE RESTRICT,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, content_version_id, badge_id)
);

-- ============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) & LEAST-PRIVILEGE GRANTS
-- ============================================================================
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backend_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_topic_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scored_level_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_level_best_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Revoke broad default privileges from public/anon/authenticated
REVOKE ALL ON public.admin_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.backend_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.content_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.curriculum_levels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.curriculum_activities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.activity_answer_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.activity_topic_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_journeys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.scored_level_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.activity_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_level_best_scores FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_achievements FROM PUBLIC, anon, authenticated;

-- Grant read-only SELECT on public curriculum presentation tables
GRANT SELECT ON public.content_versions TO anon, authenticated;
GRANT SELECT ON public.curriculum_levels TO anon, authenticated;
GRANT SELECT ON public.curriculum_activities TO anon, authenticated;
GRANT SELECT ON public.activity_topic_mappings TO anon, authenticated;

-- Grant read-only SELECT on student's own records (filtered by RLS `auth_user_id = auth.uid()`)
-- Students CANNOT directly INSERT/UPDATE/DELETE scores, runs, submissions, best scores, or badges!
GRANT SELECT ON public.student_profiles TO authenticated;
GRANT SELECT ON public.student_journeys TO authenticated;
GRANT SELECT ON public.scored_level_runs TO authenticated;
GRANT SELECT ON public.activity_submissions TO authenticated;
GRANT SELECT ON public.student_level_best_scores TO authenticated;
GRANT SELECT ON public.student_achievements TO authenticated;

-- Grant SELECT on admin_roles and activity_answer_keys ONLY to authenticated (still gated by RLS `is_authenticated_admin()`)
GRANT SELECT ON public.admin_roles TO authenticated;
GRANT SELECT ON public.activity_answer_keys TO authenticated;

-- RLS Policies: Admin Roles
DROP POLICY IF EXISTS policy_admin_roles_select ON public.admin_roles;
CREATE POLICY policy_admin_roles_select ON public.admin_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_authenticated_admin());

-- RLS Policies: Content Versions, Levels, Public Activities, Topic Mappings
DROP POLICY IF EXISTS policy_content_versions_select ON public.content_versions;
CREATE POLICY policy_content_versions_select ON public.content_versions
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_curriculum_levels_select ON public.curriculum_levels;
CREATE POLICY policy_curriculum_levels_select ON public.curriculum_levels
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      WHERE cv.content_version_id = curriculum_levels.content_version_id
        AND (cv.status = 'published' OR public.is_authenticated_admin())
    )
  );

DROP POLICY IF EXISTS policy_curriculum_activities_select ON public.curriculum_activities;
CREATE POLICY policy_curriculum_activities_select ON public.curriculum_activities
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      WHERE cv.content_version_id = curriculum_activities.content_version_id
        AND (cv.status = 'published' OR public.is_authenticated_admin())
    )
  );

DROP POLICY IF EXISTS policy_activity_topic_mappings_select ON public.activity_topic_mappings;
CREATE POLICY policy_activity_topic_mappings_select ON public.activity_topic_mappings
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      WHERE cv.content_version_id = activity_topic_mappings.content_version_id
        AND (cv.status = 'published' OR public.is_authenticated_admin())
    )
  );

-- Protected Answer Keys: ONLY verified administrators can SELECT directly!
DROP POLICY IF EXISTS policy_activity_answer_keys_admin_only ON public.activity_answer_keys;
CREATE POLICY policy_activity_answer_keys_admin_only ON public.activity_answer_keys
  FOR SELECT TO authenticated
  USING (public.is_authenticated_admin());

-- Student Private Records: Students can access ONLY their own records (`auth_user_id = auth.uid()`)
DROP POLICY IF EXISTS policy_student_profiles_own ON public.student_profiles;
CREATE POLICY policy_student_profiles_own ON public.student_profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_student_journeys_own ON public.student_journeys;
CREATE POLICY policy_student_journeys_own ON public.student_journeys
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_scored_level_runs_own ON public.scored_level_runs;
CREATE POLICY policy_scored_level_runs_own ON public.scored_level_runs
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_activity_submissions_own ON public.activity_submissions;
CREATE POLICY policy_activity_submissions_own ON public.activity_submissions
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_student_level_best_scores_own ON public.student_level_best_scores;
CREATE POLICY policy_student_level_best_scores_own ON public.student_level_best_scores
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

DROP POLICY IF EXISTS policy_student_achievements_own ON public.student_achievements;
CREATE POLICY policy_student_achievements_own ON public.student_achievements
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_authenticated_admin());

-- ============================================================================
-- 8. SUPABASE STORAGE BUCKET & RESTRICTED UPLOAD/DELETE POLICIES
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'curriculum-assets',
      'curriculum-assets',
      true,
      5242880,
      ARRAY['image/png', 'image/webp', 'image/svg+xml']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS policy_curriculum_assets_public_read ON storage.objects;
    CREATE POLICY policy_curriculum_assets_public_read ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'curriculum-assets');

    DROP POLICY IF EXISTS policy_curriculum_assets_admin_insert ON storage.objects;
    CREATE POLICY policy_curriculum_assets_admin_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'curriculum-assets' AND public.is_authenticated_admin());

    DROP POLICY IF EXISTS policy_curriculum_assets_admin_update ON storage.objects;
    CREATE POLICY policy_curriculum_assets_admin_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'curriculum-assets' AND public.is_authenticated_admin())
      WITH CHECK (bucket_id = 'curriculum-assets' AND public.is_authenticated_admin());

    DROP POLICY IF EXISTS policy_curriculum_assets_admin_delete ON storage.objects;
    CREATE POLICY policy_curriculum_assets_admin_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'curriculum-assets' AND public.is_authenticated_admin());
  END IF;
END $$;

-- ============================================================================
-- 9. CAREFULLY PERMISSIONED TRANSACTIONAL DATABASE FUNCTIONS (RPCs)
-- ============================================================================

-- 9.1 Ensure Student Profile, Active Journey & Level 1 Run for Authenticated Session
CREATE OR REPLACE FUNCTION public.rpc_ensure_student_session(
  p_display_name text,
  p_avatar_id text,
  p_content_version_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

      v_run_id := 'run_' || encode(gen_random_bytes(8), 'hex');
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
$$;

-- 9.2 Transactional, Idempotent Server-Side Activity Submission & Scoring RPC
CREATE OR REPLACE FUNCTION public.rpc_submit_activity_attempt(
  p_run_id text,
  p_content_version_id text,
  p_level_id text,
  p_activity_id text,
  p_submitted_answer text,
  p_duration_ms integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

  IF NOT FOUND THEN
    SELECT * INTO v_run
    FROM public.scored_level_runs
    WHERE student_id = v_student_id
      AND auth_user_id = v_uid
      AND content_version_id = p_content_version_id
      AND level_id = p_level_id
      AND status = 'in_progress'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    SELECT journey_id INTO v_journey_id
    FROM public.student_journeys
    WHERE student_id = v_student_id
      AND content_version_id = p_content_version_id
      AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;

    IF v_journey_id IS NOT NULL THEN
      SELECT count(*) INTO v_act_count
      FROM public.curriculum_activities
      WHERE content_version_id = p_content_version_id
        AND level_id = p_level_id;

      SELECT coalesce(max(run_number), 0) + 1 INTO v_next_run_number
      FROM public.scored_level_runs
      WHERE journey_id = v_journey_id
        AND level_id = p_level_id;

      v_auto_run_id := 'run_' || encode(extensions.gen_random_bytes(8), 'hex');

      INSERT INTO public.scored_level_runs (
        run_id, journey_id, student_id, auth_user_id, content_version_id,
        level_id, run_number, status, score_earned, max_possible_score,
        completed_activities_count, total_activities_count
      )
      VALUES (
        v_auto_run_id, v_journey_id, v_student_id, v_uid, p_content_version_id,
        p_level_id, v_next_run_number, 'in_progress', 0, v_level.max_possible_score,
        0, GREATEST(v_act_count, 1)
      )
      RETURNING * INTO v_run;
    END IF;
  END IF;

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
$$;

-- 9.3 Start Level Replay (Preserves Best Completed Score, Requires Confirmation if Unfinished)
CREATE OR REPLACE FUNCTION public.rpc_start_level_replay(
  p_content_version_id text,
  p_level_id text,
  p_confirm_discard_unfinished boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

-- 9.4 Competition Leaderboard RPC (6-Level Eligibility, Best Completed Scores, 1-1-3 Tie Ranking, Public Identity Only)
CREATE OR REPLACE FUNCTION public.rpc_get_competition_leaderboard(
  p_content_version_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_total_levels integer;
  v_total_max_score integer;
  v_entries jsonb;
BEGIN
  SELECT count(*), coalesce(sum(max_possible_score), 186)
  INTO v_total_levels, v_total_max_score
  FROM public.curriculum_levels
  WHERE content_version_id = p_content_version_id;

  IF v_total_levels = 0 THEN
    v_total_levels := 6;
  END IF;

  WITH eligible_students AS (
    SELECT
      sp.student_id,
      sp.display_name,
      sp.avatar_id,
      sp.last_active_at,
      count(slbs.level_id) AS completed_levels_count,
      sum(slbs.best_completed_score) AS total_best_score
    FROM public.student_profiles sp
    JOIN public.student_level_best_scores slbs
      ON slbs.student_id = sp.student_id
     AND slbs.content_version_id = p_content_version_id
    GROUP BY sp.student_id, sp.display_name, sp.avatar_id, sp.last_active_at
    HAVING count(slbs.level_id) = v_total_levels
  ),
  ranked_students AS (
    SELECT
      RANK() OVER (ORDER BY total_best_score DESC) AS competition_rank,
      student_id,
      display_name,
      avatar_id,
      completed_levels_count,
      total_best_score,
      last_active_at
    FROM eligible_students
    ORDER BY total_best_score DESC, display_name ASC
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', competition_rank,
        'studentId', student_id,
        'displayName', display_name,
        'avatarId', avatar_id,
        'contentVersionId', p_content_version_id,
        'completedLevelsCount', completed_levels_count,
        'totalLevelsCount', v_total_levels,
        'totalScoreEarned', total_best_score,
        'totalMaxScore', v_total_max_score,
        'lastActiveAtIso', last_active_at
      )
    ),
    '[]'::jsonb
  )
  INTO v_entries
  FROM ranked_students;

  RETURN jsonb_build_object(
    'contentVersionId', p_content_version_id,
    'totalLevelsCount', v_total_levels,
    'totalMaxScore', v_total_max_score,
    'eligibleEntries', v_entries
  );
END;
$$;

-- ============================================================================
-- 10. BACKEND-ENFORCED ADMINISTRATOR CMS & VERSION PUBLISHING RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_admin_session_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.is_authenticated_admin() THEN
    RETURN jsonb_build_object(
      'isAdmin', false,
      'userId', v_uid,
      'roleName', null
    );
  END IF;

  SELECT role_name, email INTO v_role
  FROM public.admin_roles
  WHERE user_id = v_uid AND is_active = true;

  RETURN jsonb_build_object(
    'isAdmin', true,
    'userId', v_uid,
    'email', v_role.email,
    'roleName', v_role.role_name
  );
END;
$$;

-- Create a new editable draft version cloned from an existing version
CREATE OR REPLACE FUNCTION public.rpc_admin_create_draft_version(
  p_source_version_id text,
  p_new_draft_version_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_authenticated_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ADMIN: هذه العملية مقصورة على مسؤولي النظام الموثقين.';
  END IF;

  IF btrim(coalesce(p_new_draft_version_id, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_VERSION_ID: يرجى تحديد معرّف صالح لمسودة الإصدار الجديد.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.content_versions WHERE content_version_id = p_new_draft_version_id) THEN
    RAISE EXCEPTION 'VERSION_ALREADY_EXISTS: معرّف الإصدار (%) موجود مسبقاً.', p_new_draft_version_id;
  END IF;

  INSERT INTO public.content_versions (
    content_version_id, status, base_version_id, title_ar, subtitle_ar,
    grade_ar, subject_ar, about_text_ar, instructions_json
  )
  SELECT
    p_new_draft_version_id, 'draft', content_version_id, title_ar, subtitle_ar,
    grade_ar, subject_ar, about_text_ar, instructions_json
  FROM public.content_versions
  WHERE content_version_id = p_source_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOURCE_VERSION_NOT_FOUND: الإصدار المصدر (%) غير موجود.', p_source_version_id;
  END IF;

  INSERT INTO public.curriculum_levels (
    content_version_id, level_id, level_order, station_name_ar, organ_name_ar,
    subtitle_ar, illustration_key, badge_json, learning_objectives_json,
    core_facts_json, key_concepts_json, max_possible_score
  )
  SELECT
    p_new_draft_version_id, level_id, level_order, station_name_ar, organ_name_ar,
    subtitle_ar, illustration_key, badge_json, learning_objectives_json,
    core_facts_json, key_concepts_json, max_possible_score
  FROM public.curriculum_levels
  WHERE content_version_id = p_source_version_id;

  INSERT INTO public.curriculum_activities (
    content_version_id, activity_id, level_id, activity_order, activity_type,
    title_ar, prompt_ar, max_score, public_options_json,
    public_interaction_config_json, visual_asset_url
  )
  SELECT
    p_new_draft_version_id, activity_id, level_id, activity_order, activity_type,
    title_ar, prompt_ar, max_score, public_options_json,
    public_interaction_config_json, visual_asset_url
  FROM public.curriculum_activities
  WHERE content_version_id = p_source_version_id;

  INSERT INTO public.activity_answer_keys (
    content_version_id, activity_id, canonical_correct_answer,
    answer_key_payload_json, scientific_hint_ar, scientific_explanation_ar,
    option_feedback_json
  )
  SELECT
    p_new_draft_version_id, activity_id, canonical_correct_answer,
    answer_key_payload_json, scientific_hint_ar, scientific_explanation_ar,
    option_feedback_json
  FROM public.activity_answer_keys
  WHERE content_version_id = p_source_version_id;

  INSERT INTO public.activity_topic_mappings (
    content_version_id, activity_id, level_id, level_order,
    topic_id, topic_title_ar, approved_explanation_ar
  )
  SELECT
    p_new_draft_version_id, activity_id, level_id, level_order,
    topic_id, topic_title_ar, approved_explanation_ar
  FROM public.activity_topic_mappings
  WHERE content_version_id = p_source_version_id;

  RETURN jsonb_build_object(
    'draftVersionId', p_new_draft_version_id,
    'baseVersionId', p_source_version_id,
    'status', 'draft'
  );
END;
$$;

-- Save edits to an activity, its choices, answer key, hint, explanation, and image in an editable draft
CREATE OR REPLACE FUNCTION public.rpc_admin_save_activity_draft(
  p_draft_version_id text,
  p_activity_id text,
  p_title_ar text,
  p_prompt_ar text,
  p_public_options_json jsonb,
  p_canonical_correct_answer text,
  p_scientific_hint_ar text,
  p_scientific_explanation_ar text,
  p_visual_asset_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_authenticated_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ADMIN: غير مصرح لك بتعديل المحتوى التعليمي.';
  END IF;

  SELECT status INTO v_status
  FROM public.content_versions
  WHERE content_version_id = p_draft_version_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND: مسودة الإصدار (%) غير موجودة.', p_draft_version_id;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'IMMUTABLE_VERSION: لا يمكن تعديل إصدار منشور (%). يجب التعديل على مسودة (draft) فقط.', p_draft_version_id;
  END IF;

  IF btrim(coalesce(p_title_ar, '')) = ''
     OR btrim(coalesce(p_prompt_ar, '')) = ''
     OR btrim(coalesce(p_canonical_correct_answer, '')) = ''
     OR btrim(coalesce(p_scientific_hint_ar, '')) = ''
     OR btrim(coalesce(p_scientific_explanation_ar, '')) = '' THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: جميع حقول النشاط (العنوان، السؤال، مفتاح الإجابة، التلميح، التفسير العلمي) إلزامية.';
  END IF;

  UPDATE public.curriculum_activities
  SET title_ar = btrim(p_title_ar),
      prompt_ar = btrim(p_prompt_ar),
      public_options_json = COALESCE(p_public_options_json, public_options_json),
      visual_asset_url = COALESCE(p_visual_asset_url, visual_asset_url)
  WHERE content_version_id = p_draft_version_id
    AND activity_id = p_activity_id;

  UPDATE public.activity_answer_keys
  SET canonical_correct_answer = btrim(p_canonical_correct_answer),
      scientific_hint_ar = btrim(p_scientific_hint_ar),
      scientific_explanation_ar = btrim(p_scientific_explanation_ar),
      updated_at = now()
  WHERE content_version_id = p_draft_version_id
    AND activity_id = p_activity_id;

  UPDATE public.content_versions
  SET updated_at = now()
  WHERE content_version_id = p_draft_version_id;

  RETURN jsonb_build_object(
    'draftVersionId', p_draft_version_id,
    'activityId', p_activity_id,
    'savedAtIso', now()
  );
END;
$$;

-- Validate all required fields and publish a draft version as a new immutable version
-- without mutating any journeys attached to older versions
CREATE OR REPLACE FUNCTION public.rpc_admin_publish_version(
  p_draft_version_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_levels_count integer;
  v_activities_count integer;
  v_total_points integer;
  v_missing_keys_count integer;
  v_invalid_fields_count integer;
BEGIN
  IF NOT public.is_authenticated_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ADMIN: غير مصرح لك بنشر إصدارات المحتوى.';
  END IF;

  SELECT status INTO v_status
  FROM public.content_versions
  WHERE content_version_id = p_draft_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND: الإصدار (%) غير موجود.', p_draft_version_id;
  END IF;

  IF v_status = 'published' THEN
    RAISE EXCEPTION 'ALREADY_PUBLISHED: الإصدار (%) منشور مسبقاً.', p_draft_version_id;
  END IF;

  -- Validate 6 levels, 26 activities, 186 total points, and complete answer keys/hints/explanations
  SELECT count(*) INTO v_levels_count
  FROM public.curriculum_levels
  WHERE content_version_id = p_draft_version_id;

  SELECT count(*), coalesce(sum(max_score), 0)
  INTO v_activities_count, v_total_points
  FROM public.curriculum_activities
  WHERE content_version_id = p_draft_version_id;

  IF v_levels_count <> 6 OR v_activities_count <> 26 OR v_total_points <> 186 THEN
    RAISE EXCEPTION 'PUBLICATION_VALIDATION_FAILED: يجب أن يضم الإصدار ٦ مستويات و٢٦ نشاطاً بمجموع ١٨٦ نقطة (الحالي: % مستويات، % نشاطاً، % نقطة).',
      v_levels_count, v_activities_count, v_total_points;
  END IF;

  SELECT count(*) INTO v_missing_keys_count
  FROM public.curriculum_activities ca
  LEFT JOIN public.activity_answer_keys aak
    ON aak.content_version_id = ca.content_version_id
   AND aak.activity_id = ca.activity_id
  WHERE ca.content_version_id = p_draft_version_id
    AND (
      aak.activity_id IS NULL
      OR btrim(coalesce(aak.canonical_correct_answer, '')) = ''
      OR btrim(coalesce(aak.scientific_hint_ar, '')) = ''
      OR btrim(coalesce(aak.scientific_explanation_ar, '')) = ''
    );

  IF v_missing_keys_count > 0 THEN
    RAISE EXCEPTION 'PUBLICATION_VALIDATION_FAILED: يوجد % نشاط بدون مفتاح إجابة أو تلميح أو تفسير علمي مكتمل.', v_missing_keys_count;
  END IF;

  SELECT count(*) INTO v_invalid_fields_count
  FROM public.curriculum_activities
  WHERE content_version_id = p_draft_version_id
    AND (
      btrim(coalesce(title_ar, '')) = ''
      OR btrim(coalesce(prompt_ar, '')) = ''
      OR jsonb_typeof(public_options_json) <> 'array'
      OR jsonb_array_length(public_options_json) = 0
    );

  IF v_invalid_fields_count > 0 THEN
    RAISE EXCEPTION 'PUBLICATION_VALIDATION_FAILED: يوجد % نشاط بحقول سؤال أو خيارات فارغة.', v_invalid_fields_count;
  END IF;

  -- Mark draft as published (immutable from this point forward; older journeys remain attached to their version)
  UPDATE public.content_versions
  SET status = 'published',
      published_at = now(),
      published_by = auth.uid(),
      updated_at = now()
  WHERE content_version_id = p_draft_version_id;

  RETURN jsonb_build_object(
    'publishedVersionId', p_draft_version_id,
    'status', 'published',
    'publishedAtIso', now(),
    'levelsCount', v_levels_count,
    'activitiesCount', v_activities_count,
    'totalPoints', v_total_points
  );
END;
$$;

-- Grant EXECUTE on carefully permissioned RPCs
REVOKE ALL ON FUNCTION public.rpc_ensure_student_session(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ensure_student_session(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_submit_activity_attempt(text, text, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_activity_attempt(text, text, text, text, text, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_start_level_replay(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_start_level_replay(text, text, boolean) TO authenticated;

-- 9.3b Start Full Replay (Creates a New Journey While Preserving Best Completed Level Scores & Badges)
CREATE OR REPLACE FUNCTION public.rpc_start_full_replay(
  p_content_version_id text,
  p_confirm_discard_unfinished boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.rpc_start_full_replay(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_start_full_replay(text, boolean) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_get_competition_leaderboard(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_admin_session_status() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_admin_create_draft_version(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_draft_version(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_admin_save_activity_draft(text, text, text, text, jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_save_activity_draft(text, text, text, text, jsonb, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_admin_publish_version(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_publish_version(text) TO authenticated;
