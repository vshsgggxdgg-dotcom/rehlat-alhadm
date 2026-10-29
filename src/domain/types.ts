import type {
  ActivityId,
  AttemptId,
  ContentVersionId,
  DependencyId,
  LevelId,
  StudentId,
} from './ids';

export type AppOperatingMode = 'demo' | 'production';

export type AppScreenId =
  | 'entry'
  | 'instructions'
  | 'map'
  | 'activity'
  | 'level_complete'
  | 'dashboard'
  | 'leaderboard'
  | 'final_results'
  | 'accessibility'
  | 'about'
  | 'admin';

/**
 * Six consistent creative 3D characters: three girls and three boys.
 */
export type AvatarId =
  | 'girl-noor'
  | 'girl-salma'
  | 'girl-farida'
  | 'boy-omar'
  | 'boy-ziad'
  | 'boy-karim';

export const DEFAULT_AVATAR_ID: AvatarId = 'girl-noor';

export function normalizeAvatarId(raw: string | undefined): AvatarId {
  switch (raw) {
    case 'girl-noor':
    case 'girl-salma':
    case 'girl-farida':
    case 'boy-omar':
    case 'boy-ziad':
    case 'boy-karim':
      return raw;
    case 'explorer-boy':
    case 'young-scientist':
      return 'boy-omar';
    default:
      return DEFAULT_AVATAR_ID;
  }
}

export type FontScaleOption = 'normal' | 'large' | 'xlarge' | 'xxlarge';

export interface AccessibilitySettings {
  readonly fontScale: FontScaleOption;
  readonly highContrast: boolean;
  readonly reducedMotion: boolean;
  readonly enhancedFocus: boolean;
  readonly soundMuted?: boolean;
}

export type AssetApprovalStatus =
  | 'approved'
  | 'pending_asset'
  | 'pending_content_review';

export interface StudentProfile {
  readonly className?: string;
  readonly studentId: StudentId;
  readonly displayName: string;
  readonly gradeLevel: 'grade-6';
  readonly avatarId: AvatarId;
  readonly authProvider?: 'local_demo' | 'supabase_anonymous' | 'local_prod_session';
  readonly createdAtIso: string;
  readonly lastActiveAtIso: string;
}

export interface ActivityAttempt {
  readonly revealedHintAr?: string | null;
  readonly revealedExplanationAr?: string | null;
  readonly revealedCorrectAnswer?: string | null;
  readonly revealedSolutionSummaryAr?: string | null;
  readonly attemptId: AttemptId;
  readonly studentId: StudentId;
  readonly contentVersionId: ContentVersionId;
  readonly levelId: LevelId;
  readonly activityId: ActivityId;
  readonly runId?: string;
  readonly isPractice?: boolean;
  readonly attemptNumber?: 1 | 2;
  readonly selectedOptionId: string;
  readonly isCorrect: boolean;
  readonly scoreEarned: number;
  readonly maxScore: number;
  readonly durationMs: number;
  readonly submittedAtIso: string;
  readonly syncedToBackend: boolean;
}

export interface ReviewPlanRecommendation {
  readonly activityId: ActivityId;
  readonly levelId: LevelId;
  readonly levelOrder: number;
  readonly levelTitleAr: string;
  readonly activityTitleAr: string;
  readonly topicId: string;
  readonly topicTitleAr: string;
  readonly approvedExplanationAr: string;
  readonly reasonKind: 'incorrect_after_two_attempts' | 'correct_second_attempt';
  readonly reasonLabelAr: string;
  readonly priorityOrder: 1 | 2;
}

export interface LevelProgressSummary {
  readonly levelId: LevelId;
  readonly activeRunId: string;
  readonly isUnlocked: boolean;
  readonly isCompleted: boolean;
  readonly isCurrentRunCompleted: boolean;
  readonly hasUnfinishedCurrentRun: boolean;
  readonly currentRunScoreEarned: number;
  readonly bestCompletedScoreEarned: number | null;
  readonly bestScoreEarned: number;
  readonly maxPossibleScore: number;
  readonly bestScorePercent: number;
  readonly attemptsCount: number;
  readonly currentRunAttemptsCount: number;
  readonly completedActivityIds: readonly ActivityId[];
  readonly masteredActivityIds: readonly ActivityId[];
  readonly correctFirstAttemptCount: number;
  readonly correctSecondAttemptCount: number;
  readonly incorrectAfterTwoAttemptsCount: number;
}

export interface StudentProgressState {
  readonly schemaVersion: 1;
  readonly student: StudentProfile;
  readonly lastContentVersionId: ContentVersionId;
  readonly hasCompletedInstructions?: boolean;
  readonly draftSelectionsByActivityId?: Readonly<Record<string, string>>;
  readonly activeRunIdByLevelId?: Readonly<Record<string, string>>;
  readonly bestCompletedScoreByVersionAndLevel?: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
  readonly attempts: readonly ActivityAttempt[];
  readonly updatedAtIso: string;
}

export type DependencyCategory = 'asset' | 'content' | 'configuration';

export type DependencyStatus =
  | 'unresolved'
  | 'unconfigured_in_production'
  | 'resolved';

export interface UnresolvedDependencyRecord {
  readonly id: DependencyId;
  readonly category: DependencyCategory;
  readonly titleAr: string;
  readonly descriptionAr: string;
  readonly affectedScope: string;
  readonly status: DependencyStatus;
  readonly requiredForProduction: boolean;
}
