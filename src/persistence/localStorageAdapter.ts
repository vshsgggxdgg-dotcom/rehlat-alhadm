import type { ActivityId, LevelId, StudentId } from '../domain/ids';
import { isActivityFinished } from '../domain/rules';
import {
  normalizeAvatarId,
  type ActivityAttempt,
  type AvatarId,
  type StudentProfile,
  type StudentProgressState,
} from '../domain/types';
import type { PersistencePort } from './storagePort';

interface StoredRegistryEnvelope {
  readonly schemaVersion: 1;
  readonly activeStudentId: StudentId | null;
  readonly recordsByStudentId: Record<string, StudentProgressState>;
}

/**
 * Browser LocalStorage adapter with strict namespace isolation between
 * Local Demo Mode (`rehlat_alhadm_demo_v1`) and Production Mode (`rehlat_alhadm_prod_v1`).
 *
 * Identity Rules:
 * - Keyed strictly by internal `studentId`, NEVER by `displayName`.
 * - Selecting an avatar or updating displayName never alters `studentId` or scores.
 * - Never pre-populates fake students or fake scores.
 */
export class LocalStoragePersistenceAdapter implements PersistencePort {
  public readonly namespace: string;

  public constructor(namespace: string) {
    this.namespace = namespace;
  }

  private readEnvelope(): StoredRegistryEnvelope {
    if (typeof window === 'undefined') {
      return {
        schemaVersion: 1,
        activeStudentId: null,
        recordsByStudentId: {},
      };
    }

    const raw = window.localStorage.getItem(this.namespace);
    if (!raw) {
      return {
        schemaVersion: 1,
        activeStudentId: null,
        recordsByStudentId: {},
      };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredRegistryEnvelope>;
      if (
        parsed &&
        parsed.schemaVersion === 1 &&
        typeof parsed.recordsByStudentId === 'object' &&
        parsed.recordsByStudentId !== null
      ) {
        return {
          schemaVersion: 1,
          activeStudentId: (parsed.activeStudentId as StudentId | null) ?? null,
          recordsByStudentId: parsed.recordsByStudentId,
        };
      }
    } catch {
      window.localStorage.setItem(
        `${this.namespace}_corrupt_backup_${Date.now()}`,
        raw
      );
    }

    return {
      schemaVersion: 1,
      activeStudentId: null,
      recordsByStudentId: {},
    };
  }

  private writeEnvelope(envelope: StoredRegistryEnvelope): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.namespace, JSON.stringify(envelope));
  }

  public listStudents(): readonly StudentProfile[] {
    const envelope = this.readEnvelope();
    return Object.values(envelope.recordsByStudentId)
      .map((state) => ({
        ...state.student,
        avatarId: normalizeAvatarId(state.student.avatarId),
      }))
      .sort((a, b) => b.lastActiveAtIso.localeCompare(a.lastActiveAtIso));
  }

  public listAllProgressStates(): readonly StudentProgressState[] {
    const envelope = this.readEnvelope();
    return Object.values(envelope.recordsByStudentId).sort((a, b) =>
      b.updatedAtIso.localeCompare(a.updatedAtIso)
    );
  }

  public getActiveStudentId(): StudentId | null {
    const envelope = this.readEnvelope();
    if (
      envelope.activeStudentId &&
      envelope.recordsByStudentId[envelope.activeStudentId]
    ) {
      return envelope.activeStudentId;
    }
    return null;
  }

  public setActiveStudentId(studentId: StudentId | null): void {
    const envelope = this.readEnvelope();
    this.writeEnvelope({
      ...envelope,
      activeStudentId: studentId,
    });
  }

  public getStudentProgress(studentId: StudentId): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const record = envelope.recordsByStudentId[studentId];
    if (!record) return null;
    return {
      ...record,
      student: {
        ...record.student,
        avatarId: normalizeAvatarId(record.student.avatarId),
      },
    };
  }

  public saveStudentProfile(
    profile: StudentProfile,
    initialState: StudentProgressState
  ): StudentProgressState {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[profile.studentId];

    // Keyed strictly by internal studentId — never by displayName!
    const mergedState: StudentProgressState = existing
      ? {
          ...existing,
          student: {
            ...existing.student,
            displayName: profile.displayName,
            avatarId: normalizeAvatarId(profile.avatarId),
            lastActiveAtIso: new Date().toISOString(),
          },
          updatedAtIso: new Date().toISOString(),
        }
      : {
          ...initialState,
          student: {
            ...initialState.student,
            avatarId: normalizeAvatarId(profile.avatarId),
          },
        };

    this.writeEnvelope({
      schemaVersion: 1,
      activeStudentId: profile.studentId,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [profile.studentId]: mergedState,
      },
    });

    return mergedState;
  }

  public updateStudentAvatarOrName(
    studentId: StudentId,
    updates: { readonly displayName?: string; readonly avatarId?: AvatarId }
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const nextName =
      updates.displayName !== undefined && updates.displayName.trim().length > 0
        ? updates.displayName.trim()
        : existing.student.displayName;

    const nextAvatar =
      updates.avatarId !== undefined
        ? normalizeAvatarId(updates.avatarId)
        : normalizeAvatarId(existing.student.avatarId);

    const nextState: StudentProgressState = {
      ...existing,
      student: {
        ...existing.student,
        displayName: nextName,
        avatarId: nextAvatar,
        lastActiveAtIso: nowIso,
      },
      updatedAtIso: nowIso,
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public saveDraftSelection(
    studentId: StudentId,
    activityId: ActivityId,
    selectedOptionId: string
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) {
      return null;
    }

    const currentDrafts = existing.draftSelectionsByActivityId ?? {};
    const nextDrafts = {
      ...currentDrafts,
      [activityId]: selectedOptionId,
    };

    const nextState: StudentProgressState = {
      ...existing,
      draftSelectionsByActivityId: nextDrafts,
      updatedAtIso: new Date().toISOString(),
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public markInstructionsCompleted(
    studentId: StudentId
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const nextState: StudentProgressState = {
      ...existing,
      hasCompletedInstructions: true,
      updatedAtIso: nowIso,
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public appendAttempt(
    studentId: StudentId,
    attempt: ActivityAttempt
  ): StudentProgressState {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) {
      throw new Error(`Cannot record attempt: student ${studentId} not found.`);
    }

    // Practice mode does not affect persisted scored attempts or leaderboard results
    if (attempt.isPractice) {
      return existing;
    }

    const activeRunId =
      attempt.runId ??
      existing.activeRunIdByLevelId?.[attempt.levelId] ??
      'run-initial';

    // Rule: Completed activities cannot award points again in the same run (max 2 attempts or already correct)
    const priorForActivityInRun = existing.attempts.filter(
      (a) =>
        !a.isPractice &&
        a.activityId === attempt.activityId &&
        a.contentVersionId === attempt.contentVersionId &&
        (a.runId ?? 'run-initial') === activeRunId
    );
    if (isActivityFinished(priorForActivityInRun)) {
      return existing;
    }

    const sanitizedAttempt: ActivityAttempt = {
      ...attempt,
      runId: activeRunId,
      isPractice: false,
      attemptNumber: priorForActivityInRun.length === 0 ? 1 : 2,
      scoreEarned: Math.max(0, attempt.scoreEarned),
    };

    const nowIso = new Date().toISOString();
    const nextState: StudentProgressState = {
      ...existing,
      student: {
        ...existing.student,
        lastActiveAtIso: nowIso,
      },
      lastContentVersionId: sanitizedAttempt.contentVersionId,
      attempts: [...existing.attempts, sanitizedAttempt],
      updatedAtIso: nowIso,
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public startLevelReplay(
    studentId: StudentId,
    levelId: LevelId,
    activityIdsToClear: readonly ActivityId[],
    preservedBestCompletedScore: number | null,
    contentVersionId: string
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) return null;

    const newRunId = `run-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const nextDrafts = { ...(existing.draftSelectionsByActivityId ?? {}) };
    for (const actId of activityIdsToClear) {
      delete nextDrafts[actId];
    }

    const prevByVersion = existing.bestCompletedScoreByVersionAndLevel ?? {};
    const prevVersionMap = prevByVersion[contentVersionId] ?? {};
    const currentStoredBest = prevVersionMap[levelId];
    const nextVersionMap: Record<string, number> = { ...prevVersionMap };

    if (preservedBestCompletedScore !== null) {
      nextVersionMap[levelId] =
        typeof currentStoredBest === 'number'
          ? Math.max(currentStoredBest, preservedBestCompletedScore)
          : preservedBestCompletedScore;
    }

    const nowIso = new Date().toISOString();
    const nextState: StudentProgressState = {
      ...existing,
      draftSelectionsByActivityId: nextDrafts,
      activeRunIdByLevelId: {
        ...(existing.activeRunIdByLevelId ?? {}),
        [levelId]: newRunId,
      },
      bestCompletedScoreByVersionAndLevel: {
        ...prevByVersion,
        [contentVersionId]: nextVersionMap,
      },
      updatedAtIso: nowIso,
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public startFullReplay(
    studentId: StudentId,
    levelIds: readonly LevelId[],
    preservedBestScoresByLevelId: Readonly<Record<string, number>>,
    contentVersionId: string
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) return null;

    const batchTimestamp = Date.now().toString(36);
    const nextActiveRunMap: Record<string, string> = {
      ...(existing.activeRunIdByLevelId ?? {}),
    };
    levelIds.forEach((lvlId, idx) => {
      nextActiveRunMap[lvlId] = `run-${batchTimestamp}-${idx + 1}`;
    });

    const prevByVersion = existing.bestCompletedScoreByVersionAndLevel ?? {};
    const prevVersionMap = prevByVersion[contentVersionId] ?? {};
    const nextVersionMap: Record<string, number> = { ...prevVersionMap };

    for (const [lvlId, score] of Object.entries(preservedBestScoresByLevelId)) {
      const existingBest = nextVersionMap[lvlId];
      nextVersionMap[lvlId] =
        typeof existingBest === 'number'
          ? Math.max(existingBest, score)
          : score;
    }

    const nowIso = new Date().toISOString();
    const nextState: StudentProgressState = {
      ...existing,
      draftSelectionsByActivityId: {},
      activeRunIdByLevelId: nextActiveRunMap,
      bestCompletedScoreByVersionAndLevel: {
        ...prevByVersion,
        [contentVersionId]: nextVersionMap,
      },
      updatedAtIso: nowIso,
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public markAttemptSynced(
    studentId: StudentId,
    attemptId: ActivityAttempt['attemptId']
  ): StudentProgressState | null {
    const envelope = this.readEnvelope();
    const existing = envelope.recordsByStudentId[studentId];
    if (!existing) {
      return null;
    }

    const nextAttempts = existing.attempts.map((att) =>
      att.attemptId === attemptId ? { ...att, syncedToBackend: true } : att
    );

    const nextState: StudentProgressState = {
      ...existing,
      attempts: nextAttempts,
      updatedAtIso: new Date().toISOString(),
    };

    this.writeEnvelope({
      ...envelope,
      recordsByStudentId: {
        ...envelope.recordsByStudentId,
        [studentId]: nextState,
      },
    });

    return nextState;
  }

  public clearAllData(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(this.namespace);
  }
}
