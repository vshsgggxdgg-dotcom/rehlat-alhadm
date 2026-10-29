import type { LearningActivityDefinition } from '../content/schema';
import type { ContentVersionId, StudentId } from '../domain/ids';
import type { ActivityAttempt, AppOperatingMode } from '../domain/types';
import type { PublicationValidationResult } from './answerKeyVault';

export type BackendConnectionStatus =
  | 'local_demo_sandbox'
  | 'production_connected'
  | 'production_unconfigured'
  | 'production_unreachable';

export interface BackendHealthReport {
  readonly mode: AppOperatingMode;
  readonly status: BackendConnectionStatus;
  readonly endpointUrl: string | null;
  readonly missingConfigItems: readonly string[];
  readonly messageAr: string;
}

export interface SessionIdentityResult {
  readonly studentId: StudentId | null;
  readonly authProvider: 'local_demo' | 'supabase_anonymous' | 'unconfigured';
  readonly errorAr?: string;
}

export interface AttemptSyncResult {
  readonly synced: boolean;
  readonly status: BackendConnectionStatus;
  readonly detailAr: string;
  readonly idempotentReplay?: boolean;
  readonly serverScoreEarned?: number;
  readonly revealedHintAr?: string | null;
  readonly revealedExplanationAr?: string | null;
  readonly revealedCorrectAnswer?: string | null;
}

export interface AdminSessionStatus {
  readonly isAuthenticatedAdmin: boolean;
  readonly adminRole: 'super_admin' | 'curriculum_editor' | null;
  readonly email: string | null;
  readonly authMethod: 'supabase_admin_auth' | 'demo_passcode' | 'unauthenticated';
  readonly detailAr: string;
}

export interface AdminAuthResult {
  readonly ok: boolean;
  readonly status: AdminSessionStatus;
  readonly errorAr: string | null;
}

export interface ContentVersionSummary {
  readonly contentVersionId: ContentVersionId;
  readonly status: 'draft' | 'published' | 'archived';
  readonly baseVersionId: ContentVersionId | null;
  readonly titleAr: string;
  readonly levelsCount: number;
  readonly activitiesCount: number;
  readonly totalPoints: number;
  readonly publishedAtIso: string | null;
  readonly updatedAtIso: string;
}

export interface BackendPort {
  getHealthReport(): Promise<BackendHealthReport>;
  ensureSessionStudentId(
    existingActiveId: StudentId | null,
    displayName?: string,
    avatarId?: string
  ): Promise<SessionIdentityResult>;
  syncAttempt(
    attempt: ActivityAttempt & {
      readonly idempotencyKey?: string;
      readonly runId?: string;
    }
  ): Promise<AttemptSyncResult>;
  getAdminSessionStatus(): Promise<AdminSessionStatus>;
  signInAdmin(credentials: {
    readonly email?: string;
    readonly password: string;
  }): Promise<AdminAuthResult>;
  signOutAdmin(): Promise<void>;
  listContentVersions(): Promise<readonly ContentVersionSummary[]>;
  createDraftVersion(
    newVersionId: string,
    baseVersionId: ContentVersionId
  ): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly versionSummary?: ContentVersionSummary;
  }>;
  saveActivityDraft(
    versionId: ContentVersionId,
    updatedActivity: LearningActivityDefinition
  ): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
  }>;
  publishDraftVersion(draftVersionId: ContentVersionId): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly validation?: PublicationValidationResult;
    readonly publishedVersionId?: ContentVersionId;
  }>;
  uploadCurriculumAsset(
    fileName: string,
    fileBlob: Blob
  ): Promise<{
    readonly ok: boolean;
    readonly publicUrl: string | null;
    readonly messageAr: string;
  }>;
  deleteCurriculumAsset(assetPath: string): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
  }>;
}
