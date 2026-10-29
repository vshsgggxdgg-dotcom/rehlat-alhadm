import type { ActivityId, LevelId, StudentId } from '../domain/ids';
import type {
  ActivityAttempt,
  AvatarId,
  StudentProfile,
  StudentProgressState,
} from '../domain/types';

export interface PersistencePort {
  readonly namespace: string;
  listStudents(): readonly StudentProfile[];
  listAllProgressStates(): readonly StudentProgressState[];
  getActiveStudentId(): StudentId | null;
  setActiveStudentId(studentId: StudentId | null): void;
  getStudentProgress(studentId: StudentId): StudentProgressState | null;
  saveStudentProfile(
    profile: StudentProfile,
    initialState: StudentProgressState
  ): StudentProgressState;
  updateStudentAvatarOrName(
    studentId: StudentId,
    updates: { readonly displayName?: string; readonly avatarId?: AvatarId }
  ): StudentProgressState | null;
  saveDraftSelection(
    studentId: StudentId,
    activityId: ActivityId,
    selectedOptionId: string
  ): StudentProgressState | null;
  markInstructionsCompleted(studentId: StudentId): StudentProgressState | null;
  appendAttempt(
    studentId: StudentId,
    attempt: ActivityAttempt
  ): StudentProgressState;
  startLevelReplay(
    studentId: StudentId,
    levelId: LevelId,
    activityIdsToClear: readonly ActivityId[],
    preservedBestCompletedScore: number | null,
    contentVersionId: string
  ): StudentProgressState | null;
  startFullReplay(
    studentId: StudentId,
    levelIds: readonly LevelId[],
    preservedBestScoresByLevelId: Readonly<Record<string, number>>,
    contentVersionId: string
  ): StudentProgressState | null;
  markAttemptSynced(
    studentId: StudentId,
    attemptId: ActivityAttempt['attemptId']
  ): StudentProgressState | null;
  clearAllData(): void;
}
