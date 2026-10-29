ALTER TABLE private.owner_bootstrap ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION private.redact_answers(data jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,private AS $$
BEGIN
 IF jsonb_typeof(data)='object' THEN RETURN coalesce((SELECT jsonb_object_agg(key,CASE WHEN key LIKE 'correct%' OR key IN ('canonicalCorrectAnswer','revealedCorrectAnswer') THEN CASE WHEN jsonb_typeof(value)='array' THEN '[]'::jsonb ELSE '"__SERVER_PROTECTED_ANSWER_KEY__"'::jsonb END WHEN key IN ('feedbackAr','scientificHintAr','scientificExplanationAr') THEN '""'::jsonb ELSE private.redact_answers(value) END) FROM jsonb_each(data)),'{}'::jsonb);
 ELSIF jsonb_typeof(data)='array' THEN RETURN coalesce((SELECT jsonb_agg(private.redact_answers(value)) FROM jsonb_array_elements(data)),'[]'::jsonb);
 ELSE RETURN data; END IF;
END;$$;
REVOKE ALL ON FUNCTION private.redact_answers(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.rpc_admin_save_activity(p_draft_version_id text,p_activity jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE a text:=p_activity->>'activityId'; result jsonb; url text:=p_activity->>'visualAssetUrl';
BEGIN
 IF NOT public.is_authenticated_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED_ADMIN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM curriculum_activities WHERE content_version_id=p_draft_version_id AND activity_id=a) THEN RAISE EXCEPTION 'ACTIVITY_NOT_FOUND'; END IF;
 IF url IS NOT NULL AND url<>'' AND url NOT LIKE '/assets/%' AND url NOT LIKE 'https://klyfgdsfwxyavjhoovtz.supabase.co/storage/v1/object/public/curriculum-assets/%' THEN RAISE EXCEPTION 'INVALID_IMAGE_URL'; END IF;
 result:=public.rpc_admin_save_activity_draft(p_draft_version_id,a,p_activity->>'titleAr',p_activity->>'promptAr',private.redact_answers(p_activity->'options'),p_activity->>'correctOptionId',p_activity->>'scientificHintAr',p_activity->>'scientificExplanationAr',url);
 UPDATE curriculum_activities SET public_interaction_config_json=private.redact_answers(jsonb_build_object('fillInConfig',p_activity->'fillInConfig','orderingConfig',p_activity->'orderingConfig','matchingConfig',p_activity->'matchingConfig','imageIdentificationConfig',p_activity->'imageIdentificationConfig','villiComparisonConfig',p_activity->'villiComparisonConfig')),visual_asset_url=nullif(url,'') WHERE content_version_id=p_draft_version_id AND activity_id=a;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.rpc_admin_save_activity(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_save_activity(text,jsonb) TO authenticated;
