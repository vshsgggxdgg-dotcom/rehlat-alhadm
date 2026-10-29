import {
  evaluateSubmissionInVault,
  REDACTED_MARKER,
} from '../backend/answerKeyVault';
import type { LearningActivityDefinition } from '../content/schema';
import { asContentVersionId } from './ids';
import {
  calculateActivityAttemptScore,
  isActivityFinished,
  MAX_ATTEMPTS_PER_ACTIVITY,
} from './rules';
import type { ActivityAttempt } from './types';

/**
 * Deterministic Activity State Machine for «رحلة الهضم»
 *
 * State transition graph:
 * unanswered → editing → submitting → hint/editing OR completed
 *
 * Authoritative Rules:
 * 1. Exactly two submissions per activity within a scored level run.
 * 2. Correct on first submission: full activity points (maxScore).
 * 3. Correct on second submission: half activity points (maxScore / 2).
 * 4. Incorrect on second submission: zero points, reveal the correct solution and explanation.
 * 5. No negative points.
 * 6. Multi-part activities require all parts correct to earn the relevant full/half score.
 * 7. Completed activities cannot award points again in the same run.
 * 8. Incomplete input validation does not consume an attempt.
 */

export type ActivityMachineState =
  | 'unanswered'
  | 'editing'
  | 'submitting'
  | 'hint'
  | 'completed';

export interface ActivityInputValidationResult {
  readonly isComplete: boolean;
  readonly hasAnyInput: boolean;
  readonly validationMessageAr: string | null;
}

export interface ActivityMachineSnapshot {
  readonly state: ActivityMachineState;
  readonly attemptsUsed: 0 | 1 | 2;
  readonly attemptsRemaining: 0 | 1 | 2;
  readonly attemptIndicatorTextAr: string;
  readonly isCompleted: boolean;
  readonly isMastered: boolean;
  readonly hasFailedFirstAttemptOnly: boolean;
  readonly hasExhaustedBothAttempts: boolean;
  readonly earnedScore: number;
  readonly maxScore: number;
  readonly showFirstErrorHintCard: boolean;
  readonly showSolutionAndExplanation: boolean;
  readonly validation: ActivityInputValidationResult;
}

export type SubmissionRejectionReason =
  | 'already_completed'
  | 'incomplete_input';

export type ActivitySubmissionDecision =
  | {
      readonly accepted: false;
      readonly consumesAttempt: false;
      readonly rejectionReason: SubmissionRejectionReason;
      readonly validationMessageAr: string;
      readonly nextState: ActivityMachineState;
    }
  | {
      readonly accepted: true;
      readonly consumesAttempt: true;
      readonly attemptNumber: 1 | 2;
      readonly selectedOptionId: string;
      readonly isCorrect: boolean;
      readonly scoreEarned: number;
      readonly maxScore: number;
      readonly revealSolution: boolean;
      readonly transitionPath: readonly [
        'submitting',
        'hint' | 'completed',
      ];
      readonly nextState: 'hint' | 'completed';
    };

export function parseKeyValueDraftMap(draft: string): Record<string, string> {
  if (!draft) return {};
  const result: Record<string, string> = {};
  for (const part of draft.split('|')) {
    const [k, v] = part.split(':');
    if (k && v) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Validates whether the student's current draft input is complete.
 * Incomplete input validation NEVER consumes an attempt.
 */
export function validateActivityDraftCompleteness(
  activity: LearningActivityDefinition,
  draftString: string
): ActivityInputValidationResult {
  const trimmed = draftString.trim();

  switch (activity.type) {
    case 'multiple_choice': {
      const isComplete = trimmed.length > 0;
      return {
        isComplete,
        hasAnyInput: isComplete,
        validationMessageAr: isComplete
          ? null
          : 'يرجى اختيار إجابة واحدة أولاً قبل التأكيد (لا تُحتسب محاولة عند التنبيه).',
      };
    }

    case 'fill_in': {
      const blanks = activity.fillInConfig?.blanks ?? [];
      const map = parseKeyValueDraftMap(trimmed);
      const filledCount = blanks.filter((b) => Boolean(map[b.blankId])).length;
      const isComplete = blanks.length > 0 && filledCount === blanks.length;
      return {
        isComplete,
        hasAnyInput: filledCount > 0,
        validationMessageAr: isComplete
          ? null
          : `يرجى إكمال جميع الفراغات أولاً (${filledCount} من ${blanks.length}) قبل تأكيد الإجابة.`,
      };
    }

    case 'ordering': {
      const cfg = activity.orderingConfig;
      if (!cfg) {
        return {
          isComplete: false,
          hasAnyInput: false,
          validationMessageAr: 'تكوين نشاط الترتيب غير متوفر.',
        };
      }
      const initialSerialized = cfg.initialOrderIds.join('>');
      const effective = trimmed || initialSerialized;
      const ids = effective.split('>').filter(Boolean);
      const hasAllItems =
        ids.length === cfg.items.length &&
        cfg.items.every((item) => ids.includes(item.itemId));
      const hasRearranged =
        trimmed.length > 0 && trimmed !== initialSerialized;

      return {
        isComplete: hasAllItems,
        hasAnyInput: hasRearranged,
        validationMessageAr: hasAllItems
          ? null
          : 'يرجى التأكد من ترتيب جميع البطاقات قبل إرسال الإجابة.',
      };
    }

    case 'matching': {
      const prompts = activity.matchingConfig?.prompts ?? [];
      const map = parseKeyValueDraftMap(trimmed);
      const pairedCount = prompts.filter((p) => Boolean(map[p.promptId])).length;
      const isComplete = prompts.length > 0 && pairedCount === prompts.length;
      return {
        isComplete,
        hasAnyInput: pairedCount > 0,
        validationMessageAr: isComplete
          ? null
          : `يرجى توصيل جميع عناصر العمود الأيمن بما يناسبها (${pairedCount} من ${prompts.length}) قبل التأكيد.`,
      };
    }

    case 'image_identification': {
      const cfg = activity.imageIdentificationConfig;
      if (!cfg) {
        return {
          isComplete: false,
          hasAnyInput: false,
          validationMessageAr: 'تكوين نشاط الرسم التشريحي غير متوفر.',
        };
      }
      if (cfg.mode === 'hotspot_select') {
        const isComplete = trimmed.length > 0;
        return {
          isComplete,
          hasAnyInput: isComplete,
          validationMessageAr: isComplete
            ? null
            : 'يرجى النقر على الموضع التشريحي المطلوب فوق الرسم قبل التأكيد.',
        };
      }
      const labels = cfg.labelsToPlace ?? [];
      const map = parseKeyValueDraftMap(trimmed);
      const placedLabelsCount = labels.filter((lbl) =>
        Object.values(map).includes(lbl.labelId)
      ).length;
      const isComplete =
        labels.length > 0 && placedLabelsCount === labels.length;
      return {
        isComplete,
        hasAnyInput: placedLabelsCount > 0,
        validationMessageAr: isComplete
          ? null
          : `يرجى وضع جميع بطاقات المسميات على مواضعها في الرسم (${placedLabelsCount} من ${labels.length}) قبل التأكيد.`,
      };
    }

    case 'villi_comparison': {
      const cfg = activity.villiComparisonConfig;
      if (!cfg) {
        return {
          isComplete: false,
          hasAnyInput: false,
          validationMessageAr: 'تكوين نشاط مقارنة الخملات غير متوفر.',
        };
      }
      const [criteriaPart = '', concPart = ''] = trimmed.split('||');
      const critMap = parseKeyValueDraftMap(criteriaPart);
      const concId = concPart.replace(/^conc:/, '').trim();
      const classifiedCount = cfg.criteria.filter((c) =>
        Boolean(critMap[c.criterionId])
      ).length;
      const hasAllCriteria =
        cfg.criteria.length > 0 && classifiedCount === cfg.criteria.length;
      const hasConclusion = concId.length > 0;
      const isComplete = hasAllCriteria && hasConclusion;

      return {
        isComplete,
        hasAnyInput: classifiedCount > 0 || hasConclusion,
        validationMessageAr: isComplete
          ? null
          : 'يرجى تصنيف جميع الخصائص العلمية واختيار الاستنتاج الصحيح أولاً قبل التأكيد.',
      };
    }

    default: {
      const isComplete = trimmed.length > 0;
      return {
        isComplete,
        hasAnyInput: isComplete,
        validationMessageAr: isComplete
          ? null
          : 'يرجى إكمال الإجابة أولاً قبل التأكيد.',
      };
    }
  }
}

/**
 * Multi-part activities require ALL parts correct to earn the relevant full/half score.
 */
export function evaluateActivitySubmission(
  activity: LearningActivityDefinition,
  submittedDraft: string,
  contentVersionId?: string
): boolean {
  const trimmed = submittedDraft.trim();

  if (activity.correctOptionId === REDACTED_MARKER) {
    const serverRes = evaluateSubmissionInVault({
      runId: 'eval-only',
      contentVersionId: asContentVersionId(
        contentVersionId ?? 'content-ar-g6-digestion-v1.4.0'
      ),
      levelId: activity.levelId,
      activityId: activity.activityId,
      attemptNumber: 1,
      submittedAnswer: trimmed,
      idempotencyKey: '',
    });
    return serverRes.isCorrect;
  }

  switch (activity.type) {
    case 'multiple_choice':
      return trimmed === activity.correctOptionId;

    case 'fill_in': {
      const blanks = activity.fillInConfig?.blanks ?? [];
      if (blanks.length === 0) return trimmed === activity.correctOptionId;
      const map = parseKeyValueDraftMap(trimmed);
      return blanks.every((b) => map[b.blankId] === b.correctWordId);
    }

    case 'ordering': {
      const cfg = activity.orderingConfig;
      if (!cfg || cfg.correctOrderIds.length === 0) {
        return trimmed === activity.correctOptionId;
      }
      const effective = trimmed || cfg.initialOrderIds.join('>');
      const submittedIds = effective.split('>');
      return (
        submittedIds.length === cfg.correctOrderIds.length &&
        cfg.correctOrderIds.every((expectedId, idx) => submittedIds[idx] === expectedId)
      );
    }

    case 'matching': {
      const pairs = activity.matchingConfig?.correctPairs ?? [];
      if (pairs.length === 0) return trimmed === activity.correctOptionId;
      const map = parseKeyValueDraftMap(trimmed);
      return pairs.every((cp) => map[cp.promptId] === cp.targetId);
    }

    case 'image_identification': {
      const cfg = activity.imageIdentificationConfig;
      if (!cfg) return trimmed === activity.correctOptionId;
      if (cfg.mode === 'hotspot_select') {
        return trimmed === (cfg.correctZoneId ?? activity.correctOptionId);
      }
      const labels = cfg.labelsToPlace ?? [];
      if (labels.length === 0) return trimmed === activity.correctOptionId;
      const map = parseKeyValueDraftMap(trimmed);
      return labels.every((lbl) => map[lbl.correctZoneId] === lbl.labelId);
    }

    case 'villi_comparison': {
      const cfg = activity.villiComparisonConfig;
      if (!cfg) return trimmed === activity.correctOptionId;
      const [criteriaPart = '', concPart = ''] = trimmed.split('||');
      const critMap = parseKeyValueDraftMap(criteriaPart);
      const concId = concPart.replace(/^conc:/, '').trim();
      const allCriteriaCorrect = cfg.criteria.every(
        (c) => critMap[c.criterionId] === c.correctSurfaceId
      );
      const conclusionCorrect = concId === cfg.correctConclusionId;
      return allCriteriaCorrect && conclusionCorrect;
    }

    default:
      return trimmed === activity.correctOptionId;
  }
}

/**
 * Authoritative Attempt Indicator Text:
 * - Initially: «المحاولة الأولى من ٢»
 * - After first incorrect submission: «باقي محاولة واحدة»
 * - When finished: clear completed state
 */
export function getAttemptIndicatorTextAr(
  previousAttempts: readonly ActivityAttempt[],
  maxScore: number
): string {
  const attemptsUsed = previousAttempts.length;
  const isMastered = previousAttempts.some((a) => a.isCorrect);
  const isCompleted = isActivityFinished(previousAttempts);

  if (isCompleted) {
    const earned =
      attemptsUsed > 0
        ? Math.max(0, ...previousAttempts.map((a) => a.scoreEarned))
        : 0;
    return `مكتمل (${earned}/${maxScore} نقاط) ✓`;
  }

  if (attemptsUsed === 1 && !isMastered) {
    return 'باقي محاولة واحدة';
  }

  return 'المحاولة الأولى من ٢';
}

/**
 * Derives the deterministic state machine snapshot for an activity:
 * unanswered → editing → submitting → hint/editing OR completed
 */
export function deriveActivityMachineSnapshot(params: {
  readonly activity: LearningActivityDefinition;
  readonly previousAttempts: readonly ActivityAttempt[];
  readonly draftString: string;
  readonly isSubmittingTransient?: boolean;
}): ActivityMachineSnapshot {
  const {
    activity,
    previousAttempts,
    draftString,
    isSubmittingTransient = false,
  } = params;

  const rawAttemptsCount = previousAttempts.length;
  const attemptsUsed = Math.min(
    MAX_ATTEMPTS_PER_ACTIVITY,
    rawAttemptsCount
  ) as 0 | 1 | 2;
  const isMastered = previousAttempts.some((a) => a.isCorrect);
  const isCompleted = isActivityFinished(previousAttempts);
  const hasFailedFirstAttemptOnly = attemptsUsed === 1 && !isMastered;
  const hasExhaustedBothAttempts =
    attemptsUsed >= MAX_ATTEMPTS_PER_ACTIVITY && !isMastered;

  const attemptsRemaining: 0 | 1 | 2 = isCompleted
    ? 0
    : hasFailedFirstAttemptOnly
    ? 1
    : 2;

  const earnedScore =
    rawAttemptsCount > 0
      ? Math.max(0, ...previousAttempts.map((a) => Math.max(0, a.scoreEarned)))
      : 0;

  const validation = validateActivityDraftCompleteness(activity, draftString);

  let state: ActivityMachineState;
  if (isCompleted) {
    state = 'completed';
  } else if (isSubmittingTransient) {
    state = 'submitting';
  } else if (hasFailedFirstAttemptOnly) {
    const lastSubmittedOption = previousAttempts[0]?.selectedOptionId ?? '';
    const hasEditedSinceFirstFailure =
      validation.hasAnyInput && draftString.trim() !== lastSubmittedOption;
    state = hasEditedSinceFirstFailure ? 'editing' : 'hint';
  } else if (validation.hasAnyInput) {
    state = 'editing';
  } else {
    state = 'unanswered';
  }

  return {
    state,
    attemptsUsed,
    attemptsRemaining,
    attemptIndicatorTextAr: getAttemptIndicatorTextAr(
      previousAttempts,
      activity.maxScore
    ),
    isCompleted,
    isMastered,
    hasFailedFirstAttemptOnly,
    hasExhaustedBothAttempts,
    earnedScore,
    maxScore: activity.maxScore,
    showFirstErrorHintCard: hasFailedFirstAttemptOnly,
    showSolutionAndExplanation: isCompleted,
    validation,
  };
}

/**
 * Executes the deterministic transition `editing → submitting → hint OR completed`.
 */
export function processActivitySubmission(params: {
  readonly activity: LearningActivityDefinition;
  readonly previousAttempts: readonly ActivityAttempt[];
  readonly draftString: string;
}): ActivitySubmissionDecision {
  const { activity, previousAttempts, draftString } = params;

  // Rule: Completed activities cannot award points again in the same run
  if (isActivityFinished(previousAttempts)) {
    return {
      accepted: false,
      consumesAttempt: false,
      rejectionReason: 'already_completed',
      validationMessageAr:
        'تم إكمال هذا النشاط مسبقاً ولا يمكن احتساب محاولات أو نقاط إضافية في نفس الجولة.',
      nextState: 'completed',
    };
  }

  // Rule: Incomplete input validation does not consume an attempt
  const validation = validateActivityDraftCompleteness(activity, draftString);
  if (!validation.isComplete) {
    const hasFailedFirst =
      previousAttempts.length === 1 && !previousAttempts.some((a) => a.isCorrect);
    return {
      accepted: false,
      consumesAttempt: false,
      rejectionReason: 'incomplete_input',
      validationMessageAr:
        validation.validationMessageAr ??
        'يرجى إكمال الإجابة أولاً قبل التأكيد — لم يتم استهلاك أي محاولة.',
      nextState: hasFailedFirst
        ? 'hint'
        : validation.hasAnyInput
        ? 'editing'
        : 'unanswered',
    };
  }

  const attemptNumber: 1 | 2 = previousAttempts.length === 0 ? 1 : 2;
  const effectiveSubmission =
    activity.type === 'ordering' &&
    !draftString.trim() &&
    activity.orderingConfig
      ? activity.orderingConfig.initialOrderIds.join('>')
      : draftString.trim();

  // Redacted production activities are graded only by the authenticated server.
  const isCorrect = activity.correctOptionId === REDACTED_MARKER ? false : evaluateActivitySubmission(activity, effectiveSubmission);

  // Rule: No negative points; full points on 1st, half points on 2nd, 0 on 2nd incorrect
  const scoreEarned = Math.max(
    0,
    calculateActivityAttemptScore(activity.maxScore, attemptNumber, isCorrect)
  );

  const nextState: 'hint' | 'completed' =
    isCorrect || attemptNumber === 2 ? 'completed' : 'hint';

  return {
    accepted: true,
    consumesAttempt: true,
    attemptNumber,
    selectedOptionId: effectiveSubmission,
    isCorrect,
    scoreEarned,
    maxScore: activity.maxScore,
    revealSolution: !isCorrect && attemptNumber === 2,
    transitionPath: ['submitting', nextState],
    nextState,
  };
}

/**
 * Generates gender-neutral Arabic encouragement using the student's display name:
 * - «أحسنت يا {name}! إجابتك صح.»
 * - «برافو يا {name}! وصلت للإجابة الصح.»
 * Avoids inferring gender from the student's name.
 */
export function getCorrectEncouragementHeadingAr(
  studentName: string | null,
  attemptNumber: 1 | 2,
  activityIndex: number
): string {
  const cleanName = studentName?.trim() ?? '';
  const useBravoVariant = attemptNumber === 2 || activityIndex % 2 === 1;

  if (cleanName) {
    return useBravoVariant
      ? `برافو يا ${cleanName}! وصلت للإجابة الصح.`
      : `أحسنت يا ${cleanName}! إجابتك صح.`;
  }

  return useBravoVariant
    ? 'برافو! وصلت للإجابة الصح.'
    : 'أحسنت! إجابتك صح.';
}
