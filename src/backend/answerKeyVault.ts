import { DIGESTION_CURRICULUM_MANIFEST } from '../content/digestionManifest';
import type {
  CurriculumManifest,
  LearningActivityDefinition,
  LearningLevelDefinition,
} from '../content/schema';
import { getActivityTopicMapping } from '../content/topicMappings';
import type { ActivityId, ContentVersionId, LevelId } from '../domain/ids';

/**
 * Protected Answer Key Record (mirrors `public.activity_answer_keys` in Supabase PostgreSQL).
 * Security Rule: Never ship answer keys, hints, or explanations inside frontend public content payloads.
 * Reveal approved hints/solutions only at the appropriate state (`hint` after 1st wrong attempt;
 * `explanation` + `canonicalCorrectAnswer` only when completed).
 */
export interface ProtectedAnswerKeyRecord {
  readonly contentVersionId: ContentVersionId;
  readonly activityId: ActivityId;
  readonly levelId: LevelId;
  readonly maxScore: number;
  readonly canonicalCorrectAnswer: string;
  readonly humanReadableSolutionAr: string;
  readonly scientificHintAr: string;
  readonly scientificExplanationAr: string;
  readonly optionFeedbackByOptionId: Readonly<Record<string, string>>;
}

export interface ServerEvaluationResponse {
  readonly submissionId: string;
  readonly idempotencyKey: string;
  readonly idempotentReplay: boolean;
  readonly runId: string;
  readonly contentVersionId: ContentVersionId;
  readonly levelId: LevelId;
  readonly activityId: ActivityId;
  readonly attemptNumber: 1 | 2;
  readonly isCorrect: boolean;
  readonly isActivityCompleted: boolean;
  readonly remainingAttempts: 0 | 1;
  readonly scoreEarned: number;
  readonly maxScore: number;
  /** Revealed ONLY after 1st or 2nd wrong attempt; null before submission or when correct on 1st attempt */
  readonly revealedHintAr: string | null;
  /** Revealed ONLY when activity is completed (correct on 1st/2nd attempt, or after 2nd wrong attempt) */
  readonly revealedExplanationAr: string | null;
  /** Revealed ONLY when activity is completed */
  readonly revealedCorrectAnswer: string | null;
  /** Human-readable Arabic solution summary revealed ONLY when activity is completed */
  readonly revealedSolutionSummaryAr: string | null;
}

export const REDACTED_MARKER = '__SERVER_PROTECTED_ANSWER_KEY__';

/**
 * Computes the canonical answer string for any of the 6 activity types from an authoritative definition.
 * Matches the exact serialized format produced by the activity renderers (`selectedOptionId`).
 */
export function extractCanonicalCorrectAnswer(
  activity: LearningActivityDefinition
): string {
  if (
    activity.type === 'fill_in' &&
    activity.fillInConfig &&
    activity.fillInConfig.blanks.length > 0
  ) {
    const allPresent = activity.fillInConfig.blanks.every(
      (b) => b.correctWordId && b.correctWordId !== REDACTED_MARKER
    );
    if (allPresent) {
      return [...activity.fillInConfig.blanks]
        .sort((a, b) => a.blankId.localeCompare(b.blankId))
        .map((b) => `${b.blankId}:${b.correctWordId}`)
        .join('|');
    }
  }

  if (
    activity.type === 'ordering' &&
    activity.orderingConfig &&
    activity.orderingConfig.correctOrderIds.length > 0
  ) {
    return activity.orderingConfig.correctOrderIds.join('>');
  }

  if (
    activity.type === 'matching' &&
    activity.matchingConfig &&
    activity.matchingConfig.correctPairs.length > 0
  ) {
    return [...activity.matchingConfig.correctPairs]
      .sort((a, b) => a.promptId.localeCompare(b.promptId))
      .map((cp) => `${cp.promptId}:${cp.targetId}`)
      .join('|');
  }

  if (
    activity.type === 'image_identification' &&
    activity.imageIdentificationConfig
  ) {
    if (activity.imageIdentificationConfig.mode === 'hotspot_select') {
      const z =
        activity.imageIdentificationConfig.correctZoneId ??
        activity.correctOptionId;
      if (z && z !== REDACTED_MARKER) {
        return z;
      }
    }
    if (
      activity.imageIdentificationConfig.mode === 'label_placement' &&
      activity.imageIdentificationConfig.labelsToPlace &&
      activity.imageIdentificationConfig.labelsToPlace.length > 0
    ) {
      const valid = activity.imageIdentificationConfig.labelsToPlace.every(
        (l) => l.correctZoneId && l.correctZoneId !== REDACTED_MARKER
      );
      if (valid) {
        return [...activity.imageIdentificationConfig.labelsToPlace]
          .sort((a, b) => a.correctZoneId.localeCompare(b.correctZoneId))
          .map((l) => `${l.correctZoneId}:${l.labelId}`)
          .join('|');
      }
    }
  }

  if (
    activity.type === 'villi_comparison' &&
    activity.villiComparisonConfig &&
    activity.villiComparisonConfig.criteria.length > 0 &&
    activity.villiComparisonConfig.correctConclusionId !== REDACTED_MARKER
  ) {
    const valid = activity.villiComparisonConfig.criteria.every(
      (c) => (c.correctSurfaceId as string) !== REDACTED_MARKER
    );
    if (valid) {
      const critPart = [...activity.villiComparisonConfig.criteria]
        .sort((a, b) => a.criterionId.localeCompare(b.criterionId))
        .map((c) => `${c.criterionId}:${c.correctSurfaceId}`)
        .join('|');
      return `${critPart}||conc:${activity.villiComparisonConfig.correctConclusionId}`;
    }
  }

  return activity.correctOptionId;
}

/**
 * Builds a human-readable Arabic model solution string from an authoritative activity definition.
 */
export function buildHumanReadableSolutionAr(
  activity: LearningActivityDefinition
): string {
  switch (activity.type) {
    case 'multiple_choice': {
      const opt = activity.options.find(
        (o) => o.optionId === activity.correctOptionId
      );
      return opt?.labelAr ?? activity.correctOptionId;
    }
    case 'fill_in': {
      if (!activity.fillInConfig) return activity.correctOptionId;
      const wordMap = new Map(
        activity.fillInConfig.wordCards.map((w) => [w.wordId, w.labelAr])
      );
      return activity.fillInConfig.blanks
        .map(
          (b, i) =>
            `الفراغ (${i + 1}): ${wordMap.get(b.correctWordId) ?? b.correctWordId}`
        )
        .join(' — ');
    }
    case 'ordering': {
      if (!activity.orderingConfig) return activity.correctOptionId;
      const itemMap = new Map(
        activity.orderingConfig.items.map((it) => [it.itemId, it.labelAr])
      );
      return activity.orderingConfig.correctOrderIds
        .map((id, i) => `${i + 1}. ${itemMap.get(id) ?? id}`)
        .join(' ← ');
    }
    case 'matching': {
      if (!activity.matchingConfig) return activity.correctOptionId;
      const promptMap = new Map(
        activity.matchingConfig.prompts.map((p) => [p.promptId, p.labelAr])
      );
      const targetMap = new Map(
        activity.matchingConfig.targets.map((t) => [t.targetId, t.labelAr])
      );
      return activity.matchingConfig.correctPairs
        .map(
          (cp) =>
            `(${promptMap.get(cp.promptId) ?? cp.promptId} ⟵ ${
              targetMap.get(cp.targetId) ?? cp.targetId
            })`
        )
        .join(' • ');
    }
    case 'image_identification': {
      const opt = activity.options.find(
        (o) => o.optionId === activity.correctOptionId
      );
      if (opt) return opt.labelAr;
      if (activity.imageIdentificationConfig?.labelsToPlace) {
        return activity.imageIdentificationConfig.labelsToPlace
          .map((l) => `${l.labelAr} (${l.correctZoneId})`)
          .join(' • ');
      }
      return activity.correctOptionId;
    }
    case 'villi_comparison': {
      const cfg = activity.villiComparisonConfig;
      if (!cfg) return activity.correctOptionId;
      const conc = cfg.conclusionOptions.find(
        (c) => c.optionId === cfg.correctConclusionId
      );
      return conc?.labelAr ?? activity.correctOptionId;
    }
    default:
      return activity.correctOptionId;
  }
}

// ============================================================================
// Protected Server/Vault Store (keyed by `${contentVersionId}::${activityId}`)
// ============================================================================
const vaultAnswerKeysByVersionAndActivity = new Map<
  string,
  ProtectedAnswerKeyRecord
>();
const vaultFullManifestsByVersion = new Map<string, CurriculumManifest>();
const processedIdempotencyResponses = new Map<
  string,
  ServerEvaluationResponse
>();

function makeVaultKey(
  contentVersionId: string,
  activityId: string
): string {
  return `${contentVersionId}::${activityId}`;
}

export function registerManifestInProtectedVault(
  fullManifest: CurriculumManifest
): void {
  vaultFullManifestsByVersion.set(fullManifest.contentVersionId, fullManifest);
  for (const level of fullManifest.levels) {
    for (const act of level.activities) {
      const feedbackMap: Record<string, string> = {};
      for (const opt of act.options) {
        if (opt.feedbackAr) {
          feedbackMap[opt.optionId] = opt.feedbackAr;
        }
      }
      const record: ProtectedAnswerKeyRecord = {
        contentVersionId: fullManifest.contentVersionId,
        activityId: act.activityId,
        levelId: level.levelId,
        maxScore: act.maxScore,
        canonicalCorrectAnswer: extractCanonicalCorrectAnswer(act),
        humanReadableSolutionAr: buildHumanReadableSolutionAr(act),
        scientificHintAr: act.scientificHintAr,
        scientificExplanationAr: act.scientificExplanationAr,
        optionFeedbackByOptionId: feedbackMap,
      };
      vaultAnswerKeysByVersionAndActivity.set(
        makeVaultKey(fullManifest.contentVersionId, act.activityId),
        record
      );
    }
  }
}

// Initialize vault with the authoritative curriculum manifest
registerManifestInProtectedVault(DIGESTION_CURRICULUM_MANIFEST);

/**
 * Strips all answer keys, hints, explanations, and correctness flags from a manifest
 * so that public frontend payloads never expose answer keys before submission.
 */
export function stripAnswerKeysFromManifest(
  source: CurriculumManifest
): CurriculumManifest {
  const sanitizedLevels: LearningLevelDefinition[] = source.levels.map(
    (level) => ({
      ...level,
      activities: level.activities.map((act): LearningActivityDefinition => {
        const sanitizedOptions = act.options.map((opt) => ({
          optionId: opt.optionId,
          labelAr: opt.labelAr,
          feedbackAr: '',
        }));

        const sanitizedFillIn = act.fillInConfig
          ? {
              ...act.fillInConfig,
              blanks: act.fillInConfig.blanks.map((b) => ({
                ...b,
                correctWordId: REDACTED_MARKER,
              })),
            }
          : undefined;

        const sanitizedOrdering = act.orderingConfig
          ? {
              ...act.orderingConfig,
              correctOrderIds: [],
            }
          : undefined;

        const sanitizedMatching = act.matchingConfig
          ? {
              ...act.matchingConfig,
              correctPairs: [],
            }
          : undefined;

        const sanitizedImageId = act.imageIdentificationConfig
          ? {
              ...act.imageIdentificationConfig,
              correctZoneId: undefined,
              labelsToPlace: act.imageIdentificationConfig.labelsToPlace?.map(
                (lbl) => ({
                  ...lbl,
                  correctZoneId: REDACTED_MARKER,
                })
              ),
            }
          : undefined;

        const sanitizedVilli = act.villiComparisonConfig
          ? {
              ...act.villiComparisonConfig,
              criteria: act.villiComparisonConfig.criteria.map((c) => ({
                ...c,
                correctSurfaceId: REDACTED_MARKER as 'villi_surface',
              })),
              correctConclusionId: REDACTED_MARKER,
            }
          : undefined;

        return {
          ...act,
          scientificHintAr: '',
          scientificExplanationAr: '',
          options: sanitizedOptions,
          correctOptionId: REDACTED_MARKER,
          fillInConfig: sanitizedFillIn,
          orderingConfig: sanitizedOrdering,
          matchingConfig: sanitizedMatching,
          imageIdentificationConfig: sanitizedImageId,
          villiComparisonConfig: sanitizedVilli,
        };
      }),
    })
  );

  return {
    ...source,
    levels: sanitizedLevels,
  };
}

/**
 * Public curriculum manifest with answer keys, hints, and explanations stripped.
 */
export const PUBLIC_DIGESTION_CURRICULUM_MANIFEST: CurriculumManifest =
  stripAnswerKeysFromManifest(DIGESTION_CURRICULUM_MANIFEST);

/**
 * Evaluates a submission against the protected answer key vault and reveals
 * ONLY the state-appropriate feedback:
 * - 1st wrong attempt: reveals ONLY `revealedHintAr` (`revealedExplanationAr` & `revealedCorrectAnswer` are null).
 * - Correct on 1st or 2nd attempt, or 2nd wrong attempt: reveals `revealedExplanationAr`, `revealedCorrectAnswer`, and `revealedSolutionSummaryAr`.
 */
export function evaluateSubmissionInVault(params: {
  readonly runId: string;
  readonly contentVersionId: ContentVersionId;
  readonly levelId: LevelId;
  readonly activityId: ActivityId;
  readonly attemptNumber: 1 | 2;
  readonly submittedAnswer: string;
  readonly idempotencyKey: string;
}): ServerEvaluationResponse {
  const cleanIdempotency = params.idempotencyKey.trim();
  if (cleanIdempotency && processedIdempotencyResponses.has(cleanIdempotency)) {
    const existing = processedIdempotencyResponses.get(cleanIdempotency)!;
    return {
      ...existing,
      idempotentReplay: true,
    };
  }

  const keyRecord =
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(params.contentVersionId, params.activityId)
    ) ??
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(
        DIGESTION_CURRICULUM_MANIFEST.contentVersionId,
        params.activityId
      )
    );

  if (!keyRecord) {
    throw new Error(
      `Protected answer key not found for activity ${params.activityId}`
    );
  }

  const isCorrect =
    params.submittedAnswer.trim() === keyRecord.canonicalCorrectAnswer.trim();

  const scoreEarned = isCorrect
    ? params.attemptNumber === 1
      ? keyRecord.maxScore
      : Math.floor(keyRecord.maxScore / 2)
    : 0;

  const isActivityCompleted = isCorrect || params.attemptNumber === 2;
  const remainingAttempts: 0 | 1 = isActivityCompleted ? 0 : 1;

  const response: ServerEvaluationResponse = {
    submissionId: `sub_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    idempotencyKey: cleanIdempotency,
    idempotentReplay: false,
    runId: params.runId,
    contentVersionId: params.contentVersionId,
    levelId: params.levelId,
    activityId: params.activityId,
    attemptNumber: params.attemptNumber,
    isCorrect,
    isActivityCompleted,
    remainingAttempts,
    scoreEarned,
    maxScore: keyRecord.maxScore,
    // State-gated disclosure:
    // On 1st wrong attempt -> reveal ONLY the activity hint!
    // On completion -> reveal explanation & solution!
    revealedHintAr: !isCorrect ? keyRecord.scientificHintAr : null,
    revealedExplanationAr: isActivityCompleted
      ? keyRecord.scientificExplanationAr
      : null,
    revealedCorrectAnswer: isActivityCompleted
      ? keyRecord.canonicalCorrectAnswer
      : null,
    revealedSolutionSummaryAr: isActivityCompleted
      ? keyRecord.humanReadableSolutionAr
      : null,
  };

  if (cleanIdempotency) {
    processedIdempotencyResponses.set(cleanIdempotency, response);
  }

  return response;
}

/**
 * Returns state-gated feedback for an activity given the student's existing attempts in the active run.
 * Ensures that:
 * - Unanswered / Editing before 1st submission: neither hint nor solution/explanation is revealed.
 * - After 1st wrong submission (`hint` state): ONLY `revealedHintAr` is revealed; solution & explanation remain null.
 * - When completed (`isCorrect` or `attempts.length >= 2`): `revealedExplanationAr` and `revealedSolutionSummaryAr` are revealed.
 */
export function getStateGatedActivityDisclosure(
  contentVersionId: ContentVersionId,
  activityId: ActivityId,
  runAttemptsForActivity: readonly {
    readonly attemptNumber?: 1 | 2;
    readonly isCorrect: boolean;
    readonly revealedHintAr?: string | null;
    readonly revealedExplanationAr?: string | null;
    readonly revealedSolutionSummaryAr?: string | null;
  }[]
): {
  readonly revealedHintAr: string | null;
  readonly revealedExplanationAr: string | null;
  readonly revealedSolutionSummaryAr: string | null;
} {
  if (runAttemptsForActivity.length === 0) {
    return {
      revealedHintAr: null,
      revealedExplanationAr: null,
      revealedSolutionSummaryAr: null,
    };
  }

  const lastAttempt = runAttemptsForActivity[runAttemptsForActivity.length - 1];
  const isCompleted =
    runAttemptsForActivity.some((a) => a.isCorrect) ||
    runAttemptsForActivity.length >= 2;
  const isFirstWrongOnly =
    runAttemptsForActivity.length === 1 && !runAttemptsForActivity[0].isCorrect;

  const keyRecord =
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(contentVersionId, activityId)
    ) ??
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(DIGESTION_CURRICULUM_MANIFEST.contentVersionId, activityId)
    );

  if (isFirstWrongOnly) {
    return {
      revealedHintAr:
        lastAttempt.revealedHintAr ?? keyRecord?.scientificHintAr ?? null,
      revealedExplanationAr: null,
      revealedSolutionSummaryAr: null,
    };
  }

  if (isCompleted) {
    return {
      revealedHintAr: !lastAttempt.isCorrect
        ? lastAttempt.revealedHintAr ?? keyRecord?.scientificHintAr ?? null
        : null,
      revealedExplanationAr:
        lastAttempt.revealedExplanationAr ??
        keyRecord?.scientificExplanationAr ??
        null,
      revealedSolutionSummaryAr:
        lastAttempt.revealedSolutionSummaryAr ??
        keyRecord?.humanReadableSolutionAr ??
        null,
    };
  }

  return {
    revealedHintAr: null,
    revealedExplanationAr: null,
    revealedSolutionSummaryAr: null,
  };
}

/**
 * Only for authenticated Administrator CMS or Completed Review screen (when the activity is already completed).
 */
export function getAdminAnswerKeyRecord(
  contentVersionId: ContentVersionId,
  activityId: ActivityId
): ProtectedAnswerKeyRecord | null {
  return (
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(contentVersionId, activityId)
    ) ??
    vaultAnswerKeysByVersionAndActivity.get(
      makeVaultKey(DIGESTION_CURRICULUM_MANIFEST.contentVersionId, activityId)
    ) ??
    null
  );
}

export function getAdminFullManifestForVersion(
  contentVersionId: ContentVersionId
): CurriculumManifest {
  return (
    vaultFullManifestsByVersion.get(contentVersionId) ??
    DIGESTION_CURRICULUM_MANIFEST
  );
}

export function getPublicManifestForVersion(
  contentVersionId: ContentVersionId
): CurriculumManifest {
  const full =
    vaultFullManifestsByVersion.get(contentVersionId) ??
    DIGESTION_CURRICULUM_MANIFEST;
  return stripAnswerKeysFromManifest(full);
}

/**
 * Returns the full activity definition ONLY when `isCompleted` is true (terminal state),
 * and returns the redacted public activity when `isCompleted` is false.
 */
export function getCompletedActivityForTerminalReview(
  contentVersionId: string,
  publicActivity: LearningActivityDefinition,
  isCompleted: boolean
): LearningActivityDefinition {
  if (!isCompleted) {
    return publicActivity;
  }
  const fullManifest =
    vaultFullManifestsByVersion.get(contentVersionId) ??
    DIGESTION_CURRICULUM_MANIFEST;
  for (const lvl of fullManifest.levels) {
    const found = lvl.activities.find(
      (a) => a.activityId === publicActivity.activityId
    );
    if (found) {
      return found;
    }
  }
  return publicActivity;
}

export interface PublicationValidationResult {
  readonly isValid: boolean;
  readonly errorsAr: readonly string[];
  readonly levelsCount: number;
  readonly activitiesCount: number;
  readonly totalPoints: number;
}

/**
 * Validates all required fields of a draft curriculum version before publication:
 * - Exactly 6 levels and 26 activities totaling 186 points
 * - Every activity has non-empty titleAr, promptAr, options, canonical answer key, scientificHintAr, and scientificExplanationAr
 * - Topic mappings exist for all 26 activities
 */
export function validateDraftManifestForPublication(
  draftManifest: CurriculumManifest
): PublicationValidationResult {
  const errorsAr: string[] = [];

  if (!draftManifest.contentVersionId.trim()) {
    errorsAr.push('معرّف إصدار المحتوى (contentVersionId) مطلوب.');
  }

  const levelsCount = draftManifest.levels.length;
  if (levelsCount !== 6) {
    errorsAr.push(
      `يجب أن يحتوي المنهج على ٦ مستويات بالضبط (الحالي: ${levelsCount}).`
    );
  }

  let activitiesCount = 0;
  let totalPoints = 0;

  for (const level of draftManifest.levels) {
    if (!level.stationNameAr.trim()) {
      errorsAr.push(`اسم المستوى رقم ${level.order} فارغ.`);
    }
    for (const act of level.activities) {
      activitiesCount += 1;
      totalPoints += act.maxScore;

      if (!act.titleAr.trim()) {
        errorsAr.push(`عنوان النشاط (${act.activityId}) فارغ.`);
      }
      if (!act.promptAr.trim()) {
        errorsAr.push(`نص سؤال النشاط (${act.activityId}) فارغ.`);
      }
      if (!act.scientificHintAr.trim()) {
        errorsAr.push(`التلميح العلمي للنشاط (${act.activityId}) فارغ.`);
      }
      if (!act.scientificExplanationAr.trim()) {
        errorsAr.push(`التفسير العلمي للنشاط (${act.activityId}) فارغ.`);
      }
      if (!act.options || act.options.length === 0) {
        errorsAr.push(`قائمة الخيارات للنشاط (${act.activityId}) فارغة.`);
      }
      const canonical = extractCanonicalCorrectAnswer(act);
      if (!canonical.trim() || canonical === REDACTED_MARKER) {
        errorsAr.push(
          `مفتاح الإجابة الصحيحة للنشاط (${act.activityId}) غير محدد.`
        );
      }
      const topicMapping = getActivityTopicMapping(
        draftManifest,
        act.activityId
      );
      if (!topicMapping || !topicMapping.topicTitleAr.trim()) {
        errorsAr.push(`ربط الموضوع العلمي للنشاط (${act.activityId}) مفقود.`);
      }
    }
  }

  if (activitiesCount !== 26) {
    errorsAr.push(
      `إجمالي الأنشطة يجب أن يكون ٢٦ نشاطاً (الحالي: ${activitiesCount}).`
    );
  }
  if (totalPoints !== 186) {
    errorsAr.push(
      `مجموع النقاط يجب أن يكون ١٨٦ نقطة (الحالي: ${totalPoints}).`
    );
  }

  return {
    isValid: errorsAr.length === 0,
    errorsAr,
    levelsCount,
    activitiesCount,
    totalPoints,
  };
}
