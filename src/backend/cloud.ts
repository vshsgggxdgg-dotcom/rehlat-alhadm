import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DIGESTION_CURRICULUM_MANIFEST as base } from "../content/digestionManifest";
import type {
  CurriculumManifest,
  LearningActivityDefinition,
} from "../content/schema";
import type {
  ActivityAttempt,
  StudentProgressState,
  AvatarId,
} from "../domain/types";
import {
  asActivityId,
  asAttemptId,
  asContentVersionId,
  asLevelId,
  asStudentId,
} from "../domain/ids";
import { registerManifestInProtectedVault } from "./answerKeyVault";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "rehlat-production-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export const adminCloud =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "rehlat-admin-auth",
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
export function client() {
  if (!cloud) throw new Error("لم يكتمل إعداد الاتصال.");
  return cloud;
}
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}
async function readAll<T>(query: {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>;
}) {
  const rows: T[] = [];
  for (let from = 0; ; from += 100) {
    const { data, error } = await query.range(from, from + 99);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 100) return { data: rows, error: null };
  }
}
export async function loadManifest(
  version?: string,
  connection: SupabaseClient = client(),
): Promise<CurriculumManifest> {
  let id = version;
  if (!id) {
    const { data, error } = await connection
      .from("content_versions")
      .select("content_version_id")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    id = data.content_version_id;
  }
  const [lr, ar] = await Promise.all([
    connection
      .from("curriculum_levels")
      .select("*")
      .eq("content_version_id", id)
      .order("level_order"),
    connection
      .from("curriculum_activities")
      .select("*")
      .eq("content_version_id", id)
      .order("activity_order"),
  ]);
  if (lr.error || ar.error) throw lr.error ?? ar.error;
  const levels = (lr.data ?? []).map((l) => ({
    ...base.levels.find((b) => b.order === l.level_order)!,
    levelId: asLevelId(l.level_id),
    stationNameAr: l.station_name_ar,
    subtitleAr: l.subtitle_ar,
    badge: l.badge_json,
    learningObjectivesAr: l.learning_objectives_json,
    coreScientificFactsAr: l.core_facts_json,
    keyConcepts: l.key_concepts_json,
    activities: (ar.data ?? [])
      .filter((a) => a.level_id === l.level_id)
      .map(
        (a) =>
          ({
            ...a.public_interaction_config_json,
            activityId: asActivityId(a.activity_id),
            levelId: asLevelId(a.level_id),
            type: a.activity_type,
            titleAr: a.title_ar,
            promptAr: a.prompt_ar,
            visualAssetUrl: a.visual_asset_url?.startsWith("https://")
              ? a.visual_asset_url
              : undefined,
            maxScore: a.max_score,
            options: a.public_options_json,
            correctOptionId: "__SERVER_PROTECTED_ANSWER_KEY__",
            scientificHintAr: "",
            scientificExplanationAr: "",
            contentApprovalStatus: "approved",
            contentProvenance: "supplied_approved",
          }) as LearningActivityDefinition,
      ),
  }));
  if (
    levels.length !== 6 ||
    levels.reduce((n, l) => n + l.activities.length, 0) !== 26
  )
    throw new Error("المحتوى المنشور غير مكتمل.");
  const manifest = {
    ...base,
    contentVersionId: asContentVersionId(id!),
    levels,
  };
  registerManifestInProtectedVault(manifest);
  return manifest;
}
export async function loadProgress(): Promise<StudentProgressState | null> {
  const {
    data: { session },
  } = await client().auth.getSession();
  if (!session) return null;
  const pr = await client()
    .from("student_profiles")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (pr.error) throw pr.error;
  if (!pr.data) return null;
  const p = pr.data;
  const jr = await client()
    .from("student_journeys")
    .select("*")
    .eq("student_id", p.student_id)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  if (jr.error) throw jr.error;
  const j = jr.data;
  const [rr, sr, br] = await Promise.all([
    readAll(
      client()
        .from("scored_level_runs")
        .select("*")
        .eq("journey_id", j.journey_id)
        .order("run_number"),
    ),
    readAll(
      client()
        .from("activity_submissions")
        .select("*")
        .eq("student_id", p.student_id)
        .eq("content_version_id", j.content_version_id)
        .eq("journey_id", j.journey_id)
        .order("submitted_at"),
    ),
    client()
      .from("student_level_best_scores")
      .select("*")
      .eq("student_id", p.student_id)
      .eq("content_version_id", j.content_version_id),
  ]);
  if (rr.error || sr.error || br.error) throw rr.error ?? sr.error ?? br.error;
  const active: Record<string, string> = {};
  for (const r of rr.data ?? [])
    if (r.status !== "discarded") active[r.level_id] = r.run_id;
  const best: Record<string, number> = {};
  for (const b of br.data ?? []) best[b.level_id] = b.best_completed_score;
  const attempts: ActivityAttempt[] = (sr.data ?? []).map((s) => ({
    ...s.response_payload_json,
    attemptId: asAttemptId(s.submission_id),
    studentId: asStudentId(s.student_id),
    contentVersionId: asContentVersionId(s.content_version_id),
    levelId: asLevelId(s.level_id),
    activityId: asActivityId(s.activity_id),
    runId: s.run_id,
    isPractice: false,
    attemptNumber: s.attempt_number,
    selectedOptionId: s.submitted_answer,
    isCorrect: s.is_correct,
    scoreEarned: s.score_earned,
    maxScore: s.max_score,
    durationMs: s.duration_ms,
    submittedAtIso: s.submitted_at,
    syncedToBackend: true,
  }));
  return {
    schemaVersion: 1,
    student: {
      studentId: asStudentId(p.student_id),
      displayName: p.display_name,
      className: p.class_name,
      avatarId: p.avatar_id as AvatarId,
      gradeLevel: "grade-6",
      authProvider: "supabase_anonymous",
      createdAtIso: p.created_at,
      lastActiveAtIso: p.last_active_at,
    },
    lastContentVersionId: asContentVersionId(j.content_version_id),
    hasCompletedInstructions: true,
    attempts,
    activeRunIdByLevelId: active,
    bestCompletedScoreByVersionAndLevel: { [j.content_version_id]: best },
    updatedAtIso: new Date().toISOString(),
  };
}
export async function startStudent(
  name: string,
  avatar: string,
  version: string,
  className: string,
) {
  const {
    data: { session },
  } = await client().auth.getSession();
  if (session) {
    const { data: current, error: profileError } = await client().from('student_profiles').select('display_name,class_name').eq('auth_user_id', session.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (current?.class_name && (current.class_name !== className || current.display_name !== name.trim().replace(/\s+/g, ' '))) {
      await client().auth.signOut({scope:'local'});
      const {error} = await client().auth.signInAnonymously();
      if(error) throw error;
    }
  }
  if (!session) {
    const { error } = await client().auth.signInAnonymously();
    if (error) throw error;
  }
  await rpc("rpc_enter_class_student", {
    p_class_name: className,
    p_display_name: name,
    p_avatar_id: avatar,
    p_content_version_id: version,
  });
  return loadProgress();
}
