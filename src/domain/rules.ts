import type {
  CurriculumManifest,
  LearningLevelDefinition,
} from '../content/schema';
import { getActivityTopicMapping } from '../content/topicMappings';
import type {
  ActivityId,
  ContentVersionId,
  LevelId,
  StudentId,
} from './ids';
import {
  normalizeAvatarId,
  type ActivityAttempt,
  type AvatarId,
  type LevelProgressSummary,
  type ReviewPlanRecommendation,
  type StudentProgressState,
} from './types';

/**
 * Pure domain rules for «رحلة الهضم» (Stages 1–6)
 * Implements:
 * - Deterministic two-attempt scoring per activity within a scored level run
 * - Level Replay & Full Replay preserving previous best completed scores
 * - Practice Mode isolation (never affects scores or leaderboard)
 * - Explicit Dashboard accuracy formulas & Review Plan from activity-to-topic mappings
 * - Competition Leaderboard (1, 1, 3 tie ranking, 6-level completion eligibility, content-version separation)
 */

export const MAX_ATTEMPTS_PER_ACTIVITY = 2;

export function calculateActivityAttemptScore(
  maxScore: number,
  attemptNumber: 1 | 2,
  isCorrect: boolean
): number {
  if (!isCorrect) {
    return 0;
  }
  const safeMax = Math.max(0, maxScore);
  if (attemptNumber === 1) {
    return safeMax;
  }
  return Math.ceil(safeMax / 2);
}

/**
 * Returns only the valid attempts within a single scored level run (max 2 submissions,
 * stopping immediately once an attempt is correct).
 * Completed activities cannot award points again in the same run.
 */
export function getScoredRunAttemptsForActivity(
  activityAttempts: readonly ActivityAttempt[]
): readonly ActivityAttempt[] {
  const valid: ActivityAttempt[] = [];
  for (const att of activityAttempts) {
    if (att.isPractice) {
      continue;
    }
    if (valid.length >= MAX_ATTEMPTS_PER_ACTIVITY) {
      break;
    }
    valid.push(att);
    if (att.isCorrect) {
      break;
    }
  }
  return valid;
}

export function isActivityFinished(
  activityAttempts: readonly ActivityAttempt[]
): boolean {
  const valid = getScoredRunAttemptsForActivity(activityAttempts);
  if (valid.length === 0) {
    return false;
  }
  if (valid.some((a) => a.isCorrect)) {
    return true;
  }
  return valid.length >= MAX_ATTEMPTS_PER_ACTIVITY;
}

/**
 * Filters attempts belonging to the active scored run of a level in a given content version.
 */
export function getActiveRunAttemptsForLevel(
  progressState: StudentProgressState | null,
  levelId: LevelId,
  contentVersionId?: ContentVersionId
): readonly ActivityAttempt[] {
  if (!progressState) return [];
  const activeRunId =
    progressState.activeRunIdByLevelId?.[levelId] ?? 'run-initial';
  const targetVersion =
    contentVersionId ?? progressState.lastContentVersionId;

  return progressState.attempts.filter(
    (a) =>
      !a.isPractice &&
      a.levelId === levelId &&
      a.contentVersionId === targetVersion &&
      (a.runId ?? 'run-initial') === activeRunId
  );
}

interface SingleRunEvaluation {
  readonly runId: string;
  readonly scoreEarned: number;
  readonly isRunCompleted: boolean;
  readonly attemptsCount: number;
  readonly completedActivityIds: readonly ActivityId[];
  readonly masteredActivityIds: readonly ActivityId[];
  readonly correctFirstAttemptCount: number;
  readonly correctSecondAttemptCount: number;
  readonly incorrectAfterTwoAttemptsCount: number;
}

function evaluateLevelRun(
  level: LearningLevelDefinition,
  runId: string,
  runAttempts: readonly ActivityAttempt[]
): SingleRunEvaluation {
  const completedActivityIds: ActivityId[] = [];
  const masteredActivityIds: ActivityId[] = [];
  let scoreEarned = 0;
  let correctFirstAttemptCount = 0;
  let correctSecondAttemptCount = 0;
  let incorrectAfterTwoAttemptsCount = 0;

  for (const activity of level.activities) {
    const rawForAct = runAttempts.filter(
      (a) => a.activityId === activity.activityId
    );
    const validForAct = getScoredRunAttemptsForActivity(rawForAct);

    if (validForAct.length > 0) {
      const bestForAct = Math.max(
        0,
        ...validForAct.map((a) => Math.max(0, a.scoreEarned))
      );
      scoreEarned += bestForAct;

      const solvedOnFirst =
        validForAct[0]?.isCorrect === true;
      const solvedOnSecond =
        !solvedOnFirst && validForAct[1]?.isCorrect === true;
      const failedBoth =
        !solvedOnFirst &&
        !solvedOnSecond &&
        validForAct.length >= MAX_ATTEMPTS_PER_ACTIVITY;

      if (solvedOnFirst || solvedOnSecond) {
        masteredActivityIds.push(activity.activityId);
      }
      if (solvedOnFirst) {
        correctFirstAttemptCount += 1;
      } else if (solvedOnSecond) {
        correctSecondAttemptCount += 1;
      } else if (failedBoth) {
        incorrectAfterTwoAttemptsCount += 1;
      }

      if (isActivityFinished(validForAct)) {
        completedActivityIds.push(activity.activityId);
      }
    }
  }

  const isRunCompleted =
    level.activities.length > 0 &&
    completedActivityIds.length === level.activities.length;

  return {
    runId,
    scoreEarned,
    isRunCompleted,
    attemptsCount: runAttempts.length,
    completedActivityIds,
    masteredActivityIds,
    correctFirstAttemptCount,
    correctSecondAttemptCount,
    incorrectAfterTwoAttemptsCount,
  };
}

export function computeLevelProgress(
  level: LearningLevelDefinition,
  attempts: readonly ActivityAttempt[],
  previousLevelCompleted: boolean,
  activeRunId = 'run-initial',
  storedBestCompletedScore?: number,
  targetContentVersionId?: ContentVersionId
): LevelProgressSummary {
  const isUnlocked = level.order === 1 || previousLevelCompleted;

  const levelAttempts = attempts.filter(
    (a) =>
      !a.isPractice &&
      a.levelId === level.levelId &&
      (!targetContentVersionId || a.contentVersionId === targetContentVersionId)
  );

  // Group attempts by runId to evaluate both historical completed runs and the current active run
  const attemptsByRunId = new Map<string, ActivityAttempt[]>();
  for (const att of levelAttempts) {
    const rId = att.runId ?? 'run-initial';
    const list = attemptsByRunId.get(rId) ?? [];
    list.push(att);
    attemptsByRunId.set(rId, list);
  }

  if (!attemptsByRunId.has(activeRunId)) {
    attemptsByRunId.set(activeRunId, []);
  }

  let bestCompletedScoreEarned: number | null =
    typeof storedBestCompletedScore === 'number'
      ? Math.max(0, storedBestCompletedScore)
      : null;

  for (const [rId, rAttempts] of attemptsByRunId.entries()) {
    const evalResult = evaluateLevelRun(level, rId, rAttempts);
    if (evalResult.isRunCompleted) {
      bestCompletedScoreEarned =
        bestCompletedScoreEarned === null
          ? evalResult.scoreEarned
          : Math.max(bestCompletedScoreEarned, evalResult.scoreEarned);
    }
  }

  const currentRunEval = evaluateLevelRun(
    level,
    activeRunId,
    attemptsByRunId.get(activeRunId) ?? []
  );

  const totalMaxScore = level.activities.reduce(
    (acc, a) => acc + a.maxScore,
    0
  );

  // Once a level has been completed in at least one run (bestCompletedScoreEarned !== null),
  // its badge remains earned and the next level stays unlocked even during replay!
  const hasEverCompleted =
    currentRunEval.isRunCompleted || bestCompletedScoreEarned !== null;
  const isCompleted = isUnlocked && hasEverCompleted;

  const effectiveBestScore =
    bestCompletedScoreEarned ?? currentRunEval.scoreEarned;

  const bestScorePercent =
    totalMaxScore > 0
      ? Math.round((effectiveBestScore / totalMaxScore) * 100)
      : 0;

  const hasUnfinishedCurrentRun =
    currentRunEval.attemptsCount > 0 && !currentRunEval.isRunCompleted;

  return {
    levelId: level.levelId,
    activeRunId,
    isUnlocked,
    isCompleted,
    isCurrentRunCompleted: isUnlocked && currentRunEval.isRunCompleted,
    hasUnfinishedCurrentRun,
    currentRunScoreEarned: currentRunEval.scoreEarned,
    bestCompletedScoreEarned: isCompleted ? bestCompletedScoreEarned : null,
    bestScoreEarned: effectiveBestScore,
    maxPossibleScore: totalMaxScore,
    bestScorePercent,
    attemptsCount: levelAttempts.length,
    currentRunAttemptsCount: currentRunEval.attemptsCount,
    completedActivityIds: currentRunEval.completedActivityIds,
    masteredActivityIds: currentRunEval.masteredActivityIds,
    correctFirstAttemptCount: currentRunEval.correctFirstAttemptCount,
    correctSecondAttemptCount: currentRunEval.correctSecondAttemptCount,
    incorrectAfterTwoAttemptsCount:
      currentRunEval.incorrectAfterTwoAttemptsCount,
  };
}

export function computeAllLevelsProgress(
  manifest: CurriculumManifest,
  progressState: StudentProgressState | null,
  targetContentVersionId?: ContentVersionId
): ReadonlyMap<LevelId, LevelProgressSummary> {
  const attempts = progressState?.attempts ?? [];
  const versionId =
    targetContentVersionId ?? manifest.contentVersionId;
  const storedByVersion =
    progressState?.bestCompletedScoreByVersionAndLevel?.[versionId] ?? {};
  const activeRunMap = progressState?.activeRunIdByLevelId ?? {};

  const sortedLevels = [...manifest.levels].sort((a, b) => a.order - b.order);
  const result = new Map<LevelId, LevelProgressSummary>();

  let previousCompleted = true;
  for (const level of sortedLevels) {
    const activeRunId = activeRunMap[level.levelId] ?? 'run-initial';
    const storedBest = storedByVersion[level.levelId];
    const summary = computeLevelProgress(
      level,
      attempts,
      previousCompleted,
      activeRunId,
      storedBest,
      versionId
    );
    result.set(level.levelId, summary);
    previousCompleted = summary.isCompleted;
  }

  return result;
}

export interface OverallJourneyStats {
  readonly completedLevelsCount: number;
  readonly currentRunCompletedLevelsCount: number;
  readonly totalLevelsCount: number;
  readonly completedActivitiesCount: number;
  readonly totalActivitiesCount: number;
  readonly currentRunTotalScore: number;
  readonly bestCompletedTotalScore: number;
  readonly totalBestScoreEarned: number;
  readonly totalMaxPossibleScore: number;
  readonly overallMasteryPercent: number;
  readonly currentRunScoreRatioPercent: number;
  readonly correctFirstAttemptCount: number;
  readonly correctSecondAttemptCount: number;
  readonly incorrectAfterTwoAttemptsCount: number;
  readonly firstAttemptAccuracyPercent: number | null;
  readonly overallResolutionAccuracyPercent: number | null;
  readonly hasSufficientActivityForAnalytics: boolean;
  readonly hasUnfinishedScoredRunAnyLevel: boolean;
  readonly isEligibleForLeaderboard: boolean;
  readonly reviewPlan: readonly ReviewPlanRecommendation[];
  readonly totalAttemptsCount: number;
  readonly totalDurationMs: number;
}

export function computeOverallJourneyStats(
  manifest: CurriculumManifest,
  progressState: StudentProgressState | null,
  targetContentVersionId?: ContentVersionId
): OverallJourneyStats {
  const versionId =
    targetContentVersionId ?? manifest.contentVersionId;
  const levelMap = computeAllLevelsProgress(
    manifest,
    progressState,
    versionId
  );

  let completedLevelsCount = 0;
  let currentRunCompletedLevelsCount = 0;
  let completedActivitiesCount = 0;
  let totalActivitiesCount = 0;
  let currentRunTotalScore = 0;
  let bestCompletedTotalScore = 0;
  let totalBestScoreEarned = 0;
  let totalMaxPossibleScore = 0;
  let correctFirstAttemptCount = 0;
  let correctSecondAttemptCount = 0;
  let incorrectAfterTwoAttemptsCount = 0;
  let hasUnfinishedScoredRunAnyLevel = false;

  const reviewPlan: ReviewPlanRecommendation[] = [];

  for (const level of manifest.levels) {
    totalActivitiesCount += level.activities.length;
    const summary = levelMap.get(level.levelId);
    if (summary) {
      if (summary.isCompleted) {
        completedLevelsCount += 1;
      }
      if (summary.isCurrentRunCompleted) {
        currentRunCompletedLevelsCount += 1;
      }
      if (summary.hasUnfinishedCurrentRun) {
        hasUnfinishedScoredRunAnyLevel = true;
      }
      completedActivitiesCount += summary.completedActivityIds.length;
      currentRunTotalScore += summary.currentRunScoreEarned;
      bestCompletedTotalScore += summary.bestCompletedScoreEarned ?? 0;
      totalBestScoreEarned += summary.bestScoreEarned;
      totalMaxPossibleScore += summary.maxPossibleScore;
      correctFirstAttemptCount += summary.correctFirstAttemptCount;
      correctSecondAttemptCount += summary.correctSecondAttemptCount;
      incorrectAfterTwoAttemptsCount += summary.incorrectAfterTwoAttemptsCount;
    }

    // Build review plan recommendations from actual mistakes or second-attempt answers in active run
    const activeRunAttempts = getActiveRunAttemptsForLevel(
      progressState,
      level.levelId,
      versionId
    );
    for (const act of level.activities) {
      const validForAct = getScoredRunAttemptsForActivity(
        activeRunAttempts.filter((a) => a.activityId === act.activityId)
      );
      if (validForAct.length === 0) continue;

      const solvedFirst = validForAct[0]?.isCorrect === true;
      const solvedSecond = !solvedFirst && validForAct[1]?.isCorrect === true;
      const failedBoth =
        !solvedFirst &&
        !solvedSecond &&
        validForAct.length >= MAX_ATTEMPTS_PER_ACTIVITY;

      if (failedBoth || solvedSecond) {
        const mapping = getActivityTopicMapping(manifest, act.activityId);
        if (mapping) {
          reviewPlan.push({
            ...mapping,
            reasonKind: failedBoth
              ? 'incorrect_after_two_attempts'
              : 'correct_second_attempt',
            reasonLabelAr: failedBoth
              ? 'إجابة غير صحيحة بعد محاولتين — أولوية قصوى للمراجعة'
              : 'إجابة صحيحة من المحاولة الثانية — يوصى بتثبيت المفهوم',
            priorityOrder: failedBoth ? 1 : 2,
          });
        }
      }
    }
  }

  // Sort review plan so mistakes after 2 attempts appear first, then 2nd-attempt answers
  reviewPlan.sort((a, b) => {
    if (a.priorityOrder !== b.priorityOrder) {
      return a.priorityOrder - b.priorityOrder;
    }
    return a.levelOrder - b.levelOrder;
  });

  const totalLevelsCount = manifest.levels.length;
  const overallMasteryPercent =
    totalMaxPossibleScore > 0
      ? Math.round((totalBestScoreEarned / totalMaxPossibleScore) * 100)
      : 0;

  const currentRunScoreRatioPercent =
    totalMaxPossibleScore > 0
      ? Math.round((currentRunTotalScore / totalMaxPossibleScore) * 100)
      : 0;

  const firstAttemptAccuracyPercent =
    completedActivitiesCount > 0
      ? Math.round((correctFirstAttemptCount / completedActivitiesCount) * 100)
      : null;

  const overallResolutionAccuracyPercent =
    completedActivitiesCount > 0
      ? Math.round(
          ((correctFirstAttemptCount + correctSecondAttemptCount) /
            completedActivitiesCount) *
            100
        )
      : null;

  const allScoredAttempts = (progressState?.attempts ?? []).filter(
    (a) => !a.isPractice && a.contentVersionId === versionId
  );
  const totalDurationMs = allScoredAttempts.reduce(
    (acc, a) => acc + a.durationMs,
    0
  );

  return {
    completedLevelsCount,
    currentRunCompletedLevelsCount,
    totalLevelsCount,
    completedActivitiesCount,
    totalActivitiesCount,
    currentRunTotalScore,
    bestCompletedTotalScore,
    totalBestScoreEarned,
    totalMaxPossibleScore,
    overallMasteryPercent,
    currentRunScoreRatioPercent,
    correctFirstAttemptCount,
    correctSecondAttemptCount,
    incorrectAfterTwoAttemptsCount,
    firstAttemptAccuracyPercent,
    overallResolutionAccuracyPercent,
    hasSufficientActivityForAnalytics: completedActivitiesCount > 0,
    hasUnfinishedScoredRunAnyLevel,
    isEligibleForLeaderboard:
      totalLevelsCount > 0 && completedLevelsCount === totalLevelsCount,
    reviewPlan,
    totalAttemptsCount: allScoredAttempts.length,
    totalDurationMs,
  };
}

/**
 * Public Leaderboard Entry
 * Note: Only necessary public identity fields (`rank`, `displayName`, `avatarId`, `totalScoreEarned`, `totalMaxScore`, `isCurrentStudent`)
 * are displayed in the UI. Internal authentication/session IDs and private progress details are never exposed publicly.
 */
export interface RealLeaderboardEntry {
  readonly rank: number;
  readonly studentId: StudentId;
  readonly displayName: string;
  readonly avatarId: AvatarId;
  readonly contentVersionId: ContentVersionId;
  readonly completedLevelsCount: number;
  readonly totalLevelsCount: number;
  readonly totalScoreEarned: number;
  readonly totalMaxScore: number;
  readonly overallMasteryPercent: number;
  readonly totalAttemptsCount: number;
  readonly lastActiveAtIso: string;
}

export interface CompetitionLeaderboardResult {
  readonly contentVersionId: ContentVersionId;
  readonly availableContentVersions: readonly ContentVersionId[];
  readonly eligibleEntries: readonly RealLeaderboardEntry[];
  readonly topTenRanksIncludingTies: readonly RealLeaderboardEntry[];
  readonly currentStudentEntry: RealLeaderboardEntry | null;
  readonly currentStudentEligibility: {
    readonly isEligible: boolean;
    readonly completedLevelsCount: number;
    readonly totalLevelsCount: number;
    readonly bestCompletedTotalScore: number;
    readonly currentRunTotalScore: number;
    readonly totalMaxScore: number;
    readonly rank: number | null;
  } | null;
}

/**
 * Computes the official Competition Leaderboard for a specific published contentVersionId:
 * - Score = sum of each student's best completed score for all 6 levels within the same contentVersionId.
 * - A student is eligible ONLY after completing every level at least once in that contentVersionId.
 * - Lower replay scores never replace higher scores.
 * - Tied scores receive equal competition ranks (e.g., 1, 1, 3).
 * - Separated by content version.
 */
export function computeCompetitionLeaderboard(
  manifest: CurriculumManifest,
  allStates: readonly StudentProgressState[],
  targetContentVersionId?: ContentVersionId,
  activeStudentId?: StudentId | null
): CompetitionLeaderboardResult {
  const versionId =
    targetContentVersionId ?? manifest.contentVersionId;

  const versionsSet = new Set<ContentVersionId>([manifest.contentVersionId]);
  for (const st of allStates) {
    if (st.lastContentVersionId) {
      versionsSet.add(st.lastContentVersionId);
    }
    for (const att of st.attempts) {
      if (att.contentVersionId) {
        versionsSet.add(att.contentVersionId);
      }
    }
  }

  const eligibleRaw: Omit<RealLeaderboardEntry, 'rank'>[] = [];
  let currentStudentStats: OverallJourneyStats | null = null;

  for (const state of allStates) {
    const stats = computeOverallJourneyStats(manifest, state, versionId);
    if (activeStudentId && state.student.studentId === activeStudentId) {
      currentStudentStats = stats;
    }

    // Rule: A student is eligible only after completing every level at least once in that version
    if (!stats.isEligibleForLeaderboard) {
      continue;
    }

    eligibleRaw.push({
      studentId: state.student.studentId,
      displayName: state.student.displayName,
      avatarId: normalizeAvatarId(state.student.avatarId),
      contentVersionId: versionId,
      completedLevelsCount: stats.completedLevelsCount,
      totalLevelsCount: stats.totalLevelsCount,
      // Rule: Score = sum of each student's best completed score for all six levels
      totalScoreEarned: stats.bestCompletedTotalScore,
      totalMaxScore: stats.totalMaxPossibleScore,
      overallMasteryPercent:
        stats.totalMaxPossibleScore > 0
          ? Math.round(
              (stats.bestCompletedTotalScore / stats.totalMaxPossibleScore) * 100
            )
          : 0,
      totalAttemptsCount: stats.totalAttemptsCount,
      lastActiveAtIso: state.student.lastActiveAtIso,
    });
  }

  // Sort strictly by best completed score descending (deterministic tie-break for display order only; rank is equal!)
  eligibleRaw.sort((a, b) => {
    if (b.totalScoreEarned !== a.totalScoreEarned) {
      return b.totalScoreEarned - a.totalScoreEarned;
    }
    return a.displayName.localeCompare(b.displayName, 'ar');
  });

  // Rule: Tied scores receive equal competition ranks (e.g., 1, 1, 3)
  const eligibleEntries: RealLeaderboardEntry[] = [];
  for (let i = 0; i < eligibleRaw.length; i += 1) {
    const item = eligibleRaw[i];
    const rank =
      i > 0 && item.totalScoreEarned === eligibleEntries[i - 1].totalScoreEarned
        ? eligibleEntries[i - 1].rank
        : i + 1;

    eligibleEntries.push({
      ...item,
      rank,
    });
  }

  // Show the first 10 ranks including ties (every entry with rank <= 10)
  const topTenRanksIncludingTies = eligibleEntries.filter(
    (entry) => entry.rank <= 10
  );

  const currentStudentEntry = activeStudentId
    ? eligibleEntries.find((e) => e.studentId === activeStudentId) ?? null
    : null;

  const currentStudentEligibility = currentStudentStats
    ? {
        isEligible: currentStudentStats.isEligibleForLeaderboard,
        completedLevelsCount: currentStudentStats.completedLevelsCount,
        totalLevelsCount: currentStudentStats.totalLevelsCount,
        bestCompletedTotalScore: currentStudentStats.bestCompletedTotalScore,
        currentRunTotalScore: currentStudentStats.currentRunTotalScore,
        totalMaxScore: currentStudentStats.totalMaxPossibleScore,
        rank: currentStudentEntry?.rank ?? null,
      }
    : null;

  return {
    contentVersionId: versionId,
    availableContentVersions: Array.from(versionsSet),
    eligibleEntries,
    topTenRanksIncludingTies,
    currentStudentEntry,
    currentStudentEligibility,
  };
}

export function computeRealLeaderboard(
  manifest: CurriculumManifest,
  allStates: readonly StudentProgressState[],
  targetContentVersionId?: ContentVersionId
): readonly RealLeaderboardEntry[] {
  return computeCompetitionLeaderboard(
    manifest,
    allStates,
    targetContentVersionId
  ).eligibleEntries;
}
