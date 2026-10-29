import type { AppEnvironmentConfig } from '../config/env';
import { DIGESTION_CURRICULUM_MANIFEST } from '../content/digestionManifest';
import type {
  CurriculumManifest,
  LearningActivityDefinition,
} from '../content/schema';
import {
  asContentVersionId,
  createStudentId,
  type ContentVersionId,
  type StudentId,
} from '../domain/ids';
import type { ActivityAttempt } from '../domain/types';
import {
  isAdminSessionUnlocked,
  lockAdminSession,
  verifyAdminPasscode,
} from '../persistence/adminStorage';
import {
  extractCanonicalCorrectAnswer,
  getAdminFullManifestForVersion,
  registerManifestInProtectedVault,
  validateDraftManifestForPublication,
  type PublicationValidationResult,
} from './answerKeyVault';
import type {
  AdminAuthResult,
  AdminSessionStatus,
  AttemptSyncResult,
  BackendHealthReport,
  BackendPort,
  ContentVersionSummary,
  SessionIdentityResult,
} from './backendPort';
import {
  getSupabaseClient,
  resolveProductionSessionIdentity,
} from './supabaseClient';

const DEMO_CMS_VERSIONS_STORAGE_KEY = 'rehlat_alhadm_demo_cms_versions_v1';

interface StoredCmsVersionEntry {
  readonly summary: ContentVersionSummary;
  readonly fullManifest: CurriculumManifest;
}

function loadDemoCmsVersionStore(): Map<string, StoredCmsVersionEntry> {
  const store = new Map<string, StoredCmsVersionEntry>();
  const baseManifest = DIGESTION_CURRICULUM_MANIFEST;
  const defaultSummary: ContentVersionSummary = {
    contentVersionId: baseManifest.contentVersionId,
    status: 'published',
    baseVersionId: null,
    titleAr: baseManifest.titleAr,
    levelsCount: baseManifest.levels.length,
    activitiesCount: baseManifest.levels.reduce(
      (s, l) => s + l.activities.length,
      0
    ),
    totalPoints: baseManifest.levels.reduce(
      (s, l) => s + l.activities.reduce((acc, a) => acc + a.maxScore, 0),
      0
    ),
    publishedAtIso: baseManifest.lastUpdatedIso,
    updatedAtIso: baseManifest.lastUpdatedIso,
  };
  store.set(baseManifest.contentVersionId, {
    summary: defaultSummary,
    fullManifest: baseManifest,
  });

  if (typeof window === 'undefined') {
    return store;
  }

  try {
    const raw = window.localStorage.getItem(DEMO_CMS_VERSIONS_STORAGE_KEY);
    if (!raw) return store;
    const parsed = JSON.parse(raw) as StoredCmsVersionEntry[];
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry?.summary?.contentVersionId && entry?.fullManifest) {
          store.set(entry.summary.contentVersionId, entry);
          registerManifestInProtectedVault(entry.fullManifest);
        }
      }
    }
  } catch {
    // Ignore corrupted demo CMS cache
  }
  return store;
}

function saveDemoCmsVersionStore(
  store: Map<string, StoredCmsVersionEntry>
): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(store.values());
    window.localStorage.setItem(
      DEMO_CMS_VERSIONS_STORAGE_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // Ignore storage quota errors
  }
}

// Hydrate any saved demo CMS versions on module load
loadDemoCmsVersionStore();

class LocalDemoBackendAdapter implements BackendPort {
  private readonly env: AppEnvironmentConfig;

  public constructor(env: AppEnvironmentConfig) {
    this.env = env;
  }

  public async getHealthReport(): Promise<BackendHealthReport> {
    return {
      mode: 'demo',
      status: 'local_demo_sandbox',
      endpointUrl: null,
      missingConfigItems: this.env.missingProductionConfigItems,
      messageAr:
        'وضع العرض المحلي نشط — تُحفظ الجلسات والبيانات على هذا المتصفح فقط في مساحة العرض المعزولة (rehlat_alhadm_demo_v1) مع تقييم الإجابات عبر خزنة المفاتيح المحمية.',
    };
  }

  public async ensureSessionStudentId(
    existingActiveId: StudentId | null
  ): Promise<SessionIdentityResult> {
    return {
      studentId: existingActiveId ?? createStudentId(),
      authProvider: 'local_demo',
    };
  }

  public async syncAttempt(
    _attempt: ActivityAttempt & {
      readonly idempotencyKey?: string;
      readonly runId?: string;
    }
  ): Promise<AttemptSyncResult> {
    return {
      synced: false,
      status: 'local_demo_sandbox',
      detailAr: 'تم التقييم والحفظ في مساحة العرض المحلية المعزولة.',
    };
  }

  public async getAdminSessionStatus(): Promise<AdminSessionStatus> {
    if (typeof window !== 'undefined') {
      if (isAdminSessionUnlocked()) {
        return {
          isAuthenticatedAdmin: true,
          adminRole: 'curriculum_editor',
          email: 'admin@demo.local',
          authMethod: 'demo_passcode',
          detailAr: 'جلسة مشرف نشطة في وضع العرض المحلي.',
        };
      }
    }
    return {
      isAuthenticatedAdmin: false,
      adminRole: null,
      email: null,
      authMethod: 'unauthenticated',
      detailAr: 'يرجى تسجيل دخول المشرف للوصول إلى إدارة المحتوى.',
    };
  }

  public async signInAdmin(credentials: {
    readonly email?: string;
    readonly password: string;
  }): Promise<AdminAuthResult> {
    // No passcode is embedded in source: verify against env or the locally initialized hash
    if (verifyAdminPasscode(credentials.password, this.env)) {
      const status = await this.getAdminSessionStatus();
      return { ok: true, status, errorAr: null };
    }
    const status = await this.getAdminSessionStatus();
    return {
      ok: false,
      status,
      errorAr: 'رمز دخول المشرف غير صحيح.',
    };
  }

  public async signOutAdmin(): Promise<void> {
    lockAdminSession();
  }

  public async listContentVersions(): Promise<readonly ContentVersionSummary[]> {
    const store = loadDemoCmsVersionStore();
    return Array.from(store.values()).map((e) => e.summary);
  }

  public async createDraftVersion(
    newVersionId: string,
    baseVersionId: ContentVersionId
  ): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly versionSummary?: ContentVersionSummary;
  }> {
    const admin = await this.getAdminSessionStatus();
    if (!admin.isAuthenticatedAdmin) {
      return {
        ok: false,
        messageAr: 'غير مصرح: يجب تسجيل دخول المشرف أولاً.',
      };
    }

    const cleanId = newVersionId.trim();
    if (!cleanId) {
      return { ok: false, messageAr: 'يرجى إدخال معرّف صالح للإصدار الجديد.' };
    }

    const store = loadDemoCmsVersionStore();
    if (store.has(cleanId)) {
      return {
        ok: false,
        messageAr: `الإصدار (${cleanId}) موجود مسبقاً. اختر معرّفاً جديداً.`,
      };
    }

    const baseEntry =
      store.get(baseVersionId) ??
      store.get(DIGESTION_CURRICULUM_MANIFEST.contentVersionId)!;
    const nowIso = new Date().toISOString();
    const clonedManifest: CurriculumManifest = JSON.parse(
      JSON.stringify({
        ...baseEntry.fullManifest,
        contentVersionId: asContentVersionId(cleanId),
        lastUpdatedIso: nowIso,
      })
    );

    const summary: ContentVersionSummary = {
      contentVersionId: asContentVersionId(cleanId),
      status: 'draft',
      baseVersionId,
      titleAr: `${clonedManifest.titleAr} (${cleanId})`,
      levelsCount: clonedManifest.levels.length,
      activitiesCount: clonedManifest.levels.reduce(
        (s, l) => s + l.activities.length,
        0
      ),
      totalPoints: clonedManifest.levels.reduce(
        (s, l) => s + l.activities.reduce((acc, a) => acc + a.maxScore, 0),
        0
      ),
      publishedAtIso: null,
      updatedAtIso: nowIso,
    };

    store.set(cleanId, { summary, fullManifest: clonedManifest });
    registerManifestInProtectedVault(clonedManifest);
    saveDemoCmsVersionStore(store);

    return {
      ok: true,
      messageAr: `تم إنشاء مسودة الإصدار (${cleanId}) بنجاح بالاعتماد على (${baseVersionId}).`,
      versionSummary: summary,
    };
  }

  public async saveActivityDraft(
    versionId: ContentVersionId,
    updatedActivity: LearningActivityDefinition
  ): Promise<{ readonly ok: boolean; readonly messageAr: string }> {
    const admin = await this.getAdminSessionStatus();
    if (!admin.isAuthenticatedAdmin) {
      return {
        ok: false,
        messageAr: 'غير مصرح: يجب تسجيل دخول المشرف لتعديل المسودات.',
      };
    }

    const store = loadDemoCmsVersionStore();
    const entry = store.get(versionId);
    if (!entry) {
      return { ok: false, messageAr: `الإصدار (${versionId}) غير موجود.` };
    }
    if (entry.summary.status === 'published') {
      return {
        ok: false,
        messageAr: `الإصدار (${versionId}) منشور وغير قابل للتعديل المباشر (Immutable). أنشئ مسودة إصدار جديد لتعديل المحتوى دون التأثير على رحلات الطلاب الحالية.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatedLevels = entry.fullManifest.levels.map((lvl) => ({
      ...lvl,
      activities: lvl.activities.map((act) =>
        act.activityId === updatedActivity.activityId ? updatedActivity : act
      ),
    }));

    const updatedManifest: CurriculumManifest = {
      ...entry.fullManifest,
      lastUpdatedIso: nowIso,
      levels: updatedLevels,
    };

    const updatedSummary: ContentVersionSummary = {
      ...entry.summary,
      updatedAtIso: nowIso,
    };

    store.set(versionId, {
      summary: updatedSummary,
      fullManifest: updatedManifest,
    });
    registerManifestInProtectedVault(updatedManifest);
    saveDemoCmsVersionStore(store);

    return {
      ok: true,
      messageAr: `تم حفظ تعديلات النشاط (${updatedActivity.activityId}) في المسودة (${versionId}).`,
    };
  }

  public async publishDraftVersion(draftVersionId: ContentVersionId): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly validation?: PublicationValidationResult;
    readonly publishedVersionId?: ContentVersionId;
  }> {
    const admin = await this.getAdminSessionStatus();
    if (!admin.isAuthenticatedAdmin) {
      return {
        ok: false,
        messageAr: 'غير مصرح: يجب تسجيل دخول المشرف لنشر إصدارات المحتوى.',
      };
    }

    const store = loadDemoCmsVersionStore();
    const entry = store.get(draftVersionId);
    if (!entry) {
      return { ok: false, messageAr: `المسودة (${draftVersionId}) غير موجودة.` };
    }
    if (entry.summary.status === 'published') {
      return {
        ok: false,
        messageAr: `الإصدار (${draftVersionId}) منشور بالفعل.`,
      };
    }

    const validation = validateDraftManifestForPublication(entry.fullManifest);
    if (!validation.isValid) {
      return {
        ok: false,
        messageAr: `فشل التحقق قبل النشر: ${validation.errorsAr.join(' | ')}`,
        validation,
      };
    }

    const nowIso = new Date().toISOString();
    const publishedSummary: ContentVersionSummary = {
      ...entry.summary,
      status: 'published',
      publishedAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    store.set(draftVersionId, {
      summary: publishedSummary,
      fullManifest: entry.fullManifest,
    });
    registerManifestInProtectedVault(entry.fullManifest);
    saveDemoCmsVersionStore(store);

    return {
      ok: true,
      messageAr: `تم نشر الإصدار (${draftVersionId}) كإصدار ثابت غير قابل للتعديل (Immutable) مع الحفاظ على جميع رحلات ونتائج الإصدارات السابقة دون مساس.`,
      validation,
      publishedVersionId: draftVersionId,
    };
  }

  public async uploadCurriculumAsset(
    fileName: string,
    _fileBlob: Blob
  ): Promise<{
    readonly ok: boolean;
    readonly publicUrl: string | null;
    readonly messageAr: string;
  }> {
    const admin = await this.getAdminSessionStatus();
    if (!admin.isAuthenticatedAdmin) {
      return {
        ok: false,
        publicUrl: null,
        messageAr: 'غير مصرح برفع ملفات الوسائط.',
      };
    }
    return {
      ok: false,
      publicUrl: null,
      messageAr: `رفع الملفات إلى حاوية التخزين السحابية (curriculum-assets/${fileName}) يتطلب اتصال Supabase Storage في بيئة الإنتاج.`,
    };
  }

  public async deleteCurriculumAsset(
    assetPath: string
  ): Promise<{ readonly ok: boolean; readonly messageAr: string }> {
    const admin = await this.getAdminSessionStatus();
    if (!admin.isAuthenticatedAdmin) {
      return {
        ok: false,
        messageAr: 'غير مصرح بحذف ملفات الوسائط.',
      };
    }
    return {
      ok: false,
      messageAr: `حذف الملف (${assetPath}) مقيد بمشرفي Supabase Storage في بيئة الإنتاج.`,
    };
  }
}

class ProductionBackendAdapter implements BackendPort {
  private readonly env: AppEnvironmentConfig;

  public constructor(env: AppEnvironmentConfig) {
    this.env = env;
  }

  public async getHealthReport(): Promise<BackendHealthReport> {
    if (!this.env.isSupabaseConfigured) {
      const missingText = this.env.missingProductionConfigItems.join(' ، ');
      return {
        mode: 'production',
        status: 'production_unconfigured',
        endpointUrl: null,
        missingConfigItems: this.env.missingProductionConfigItems,
        messageAr: `وضع الإنتاج غير مكتمل الإعداد — العناصر المفقودة: [${missingText}]. التزاماً بقواعد النزاهة، تم تعطيل التخزين المحلي الصامت لنتائج الإنتاج لحين تزويد إعدادات Supabase.`,
      };
    }

    const client = getSupabaseClient(this.env);
    if (client) {
      try {
        const { error } = await client.auth.getSession();
        const {error: databaseError} = await client.from('content_versions').select('content_version_id').limit(1);
        if (!error && !databaseError) {
          return {
            mode: 'production',
            status: 'production_connected',
            endpointUrl: this.env.supabaseUrl,
            missingConfigItems: [],
            messageAr:
              'تم الوصول لخدمة الهوية وقراءة قاعدة البيانات. التحقق من الصلاحيات وحفظ المحاولات يحتاج اختبار جلسة فعلية.',
          };
        }
        return {
          mode: 'production',
          status: 'production_unreachable',
          endpointUrl: this.env.supabaseUrl,
          missingConfigItems: [],
          messageAr: `تعذر التحقق من جلسة Supabase (${error?.message ?? databaseError?.message}). لن يتم تخزين درجات الإنتاج محلياً بشكل صامت.`,
        };
      } catch (err) {
        return {
          mode: 'production',
          status: 'production_unreachable',
          endpointUrl: this.env.supabaseUrl,
          missingConfigItems: [],
          messageAr: `تعذر الاتصال بخادم Supabase (${
            err instanceof Error ? err.message : 'خطأ شبكة'
          }). لن يتم تخزين درجات الإنتاج محلياً بشكل صامت.`,
        };
      }
    }

    return {
      mode: 'production',
      status: 'production_unconfigured',
      endpointUrl: null,
      missingConfigItems: this.env.missingProductionConfigItems,
      messageAr: 'إعدادات خادم الإنتاج غير متوفرة.',
    };
  }

  public async ensureSessionStudentId(
    existingActiveId: StudentId | null,
    displayName?: string,
    avatarId?: string
  ): Promise<SessionIdentityResult> {
    if (!this.env.isSupabaseConfigured) {
      return resolveProductionSessionIdentity(
        this.env,
        displayName,
        avatarId
      );
    }
    if (existingActiveId && !displayName) {
      return {
        studentId: existingActiveId,
        authProvider: 'supabase_anonymous',
      };
    }
    return resolveProductionSessionIdentity(this.env, displayName, avatarId);
  }

  public async syncAttempt(
    attempt: ActivityAttempt & {
      readonly idempotencyKey?: string;
      readonly runId?: string;
    }
  ): Promise<AttemptSyncResult> {
    if (!this.env.isSupabaseConfigured) {
      const missingText = this.env.missingProductionConfigItems.join(' ، ');
      return {
        synced: false,
        status: 'production_unconfigured',
        detailAr: `لم يتم حفظ المحاولة: اتصال Supabase لبيئة الإنتاج غير مضبوط (${missingText}). يُمنع حفظ درجات الإنتاج محلياً عند فشل الخادم.`,
      };
    }

    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        synced: false,
        status: 'production_unconfigured',
        detailAr: 'عميل Supabase غير مهيأ؛ لم يتم حفظ نقاط الإنتاج محلياً.',
      };
    }

    const idempotencyKey =
      attempt.idempotencyKey ?? `idem_${attempt.attemptId}`;
    const runId =
      attempt.runId ?? `run_${attempt.studentId}_${attempt.levelId}`;

    try {
      const { data, error } = await client.rpc('rpc_submit_activity_attempt', {
        p_run_id: runId,
        p_content_version_id: attempt.contentVersionId,
        p_level_id: attempt.levelId,
        p_activity_id: attempt.activityId,
        p_submitted_answer: attempt.selectedOptionId,
        p_duration_ms: attempt.durationMs,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        return {
          synced: false,
          status: 'production_unreachable',
          detailAr: `رفض الخادم تسجيل المحاولة: ${error.message}. لم يتم حفظ نقاط الإنتاج محلياً.`,
        };
      }

      const payload = (data ?? {}) as Record<string, unknown>;
      return {
        synced: true,
        status: 'production_connected',
        detailAr: 'تم التحقق من الإجابة وحساب النقاط وحفظها على خادم الإنتاج بنجاح.',
        idempotentReplay: Boolean(payload.idempotentReplay),
        serverScoreEarned:
          typeof payload.scoreEarned === 'number'
            ? payload.scoreEarned
            : attempt.scoreEarned,
        revealedHintAr:
          typeof payload.revealedHintAr === 'string'
            ? payload.revealedHintAr
            : null,
        revealedExplanationAr:
          typeof payload.revealedExplanationAr === 'string'
            ? payload.revealedExplanationAr
            : null,
        revealedCorrectAnswer:
          typeof payload.revealedCorrectAnswer === 'string'
            ? payload.revealedCorrectAnswer
            : null,
      };
    } catch (err) {
      return {
        synced: false,
        status: 'production_unreachable',
        detailAr: `فشل الاتصال بخادم الإنتاج (${
          err instanceof Error ? err.message : 'خطأ شبكة'
        }). لم يتم حفظ درجات الإنتاج محلياً.`,
      };
    }
  }

  public async getAdminSessionStatus(): Promise<AdminSessionStatus> {
    if (!this.env.isSupabaseConfigured) {
      return {
        isAuthenticatedAdmin: false,
        adminRole: null,
        email: null,
        authMethod: 'unauthenticated',
        detailAr: `مصادقة المشرف في وضع الإنتاج تتطلب ضبط (${this.env.missingProductionConfigItems.join(
          ' ، '
        )}).`,
      };
    }

    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        isAuthenticatedAdmin: false,
        adminRole: null,
        email: null,
        authMethod: 'unauthenticated',
        detailAr: 'عميل Supabase غير متصل.',
      };
    }

    try {
      const { data: userResp } = await client.auth.getUser();
      const { data, error } = await client.rpc('rpc_get_admin_session_status');
      if (error || !data) {
        return {
          isAuthenticatedAdmin: false,
          adminRole: null,
          email: userResp?.user?.email ?? null,
          authMethod: 'unauthenticated',
          detailAr: 'الحساب الحالي لا يملك صلاحية مشرف في جدول admin_roles.',
        };
      }
      const parsed = data as {
        isAdmin?: boolean;
        roleName?: 'super_admin' | 'curriculum_editor' | null;
      };
      return {
        isAuthenticatedAdmin: Boolean(parsed.isAdmin),
        adminRole: parsed.roleName ?? null,
        email: userResp?.user?.email ?? null,
        authMethod: parsed.isAdmin
          ? 'supabase_admin_auth'
          : 'unauthenticated',
        detailAr: parsed.isAdmin
          ? `تم التحقق من صلاحية المشرف (${parsed.roleName}) على الخادم.`
          : 'غير مصرح كمشرف في قاعدة البيانات.',
      };
    } catch {
      return {
        isAuthenticatedAdmin: false,
        adminRole: null,
        email: null,
        authMethod: 'unauthenticated',
        detailAr: 'تعذر التحقق من صلاحية المشرف عبر الخادم.',
      };
    }
  }

  public async signInAdmin(credentials: {
    readonly email?: string;
    readonly password: string;
  }): Promise<AdminAuthResult> {
    if (!this.env.isSupabaseConfigured) {
      const status = await this.getAdminSessionStatus();
      return {
        ok: false,
        status,
        errorAr: `لا يمكن تسجيل دخول المشرف في بيئة الإنتاج قبل ضبط: ${this.env.missingProductionConfigItems.join(
          ' ، '
        )}`,
      };
    }

    const client = getSupabaseClient(this.env);
    if (!client || !credentials.email?.trim()) {
      const status = await this.getAdminSessionStatus();
      return {
        ok: false,
        status,
        errorAr:
          'في بيئة الإنتاج يجب إدخال البريد الإلكتروني وكلمة المرور لحساب المشرف المسجل في Supabase Auth.',
      };
    }

    const { error } = await client.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (error) {
      const status = await this.getAdminSessionStatus();
      return {
        ok: false,
        status,
        errorAr: `فشل مصادقة المشرف عبر Supabase Auth: ${error.message}`,
      };
    }

    const status = await this.getAdminSessionStatus();
    if (!status.isAuthenticatedAdmin) {
      return {
        ok: false,
        status,
        errorAr:
          'تم الدخول، لكن هذا المستخدم غير مدرج في جدول المشرفين (public.admin_roles) على الخادم.',
      };
    }

    return { ok: true, status, errorAr: null };
  }

  public async signOutAdmin(): Promise<void> {
    const client = getSupabaseClient(this.env);
    if (client) {
      await client.auth.signOut();
    }
  }

  public async listContentVersions(): Promise<readonly ContentVersionSummary[]> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      const base = DIGESTION_CURRICULUM_MANIFEST;
      return [
        {
          contentVersionId: base.contentVersionId,
          status: 'published',
          baseVersionId: null,
          titleAr: base.titleAr,
          levelsCount: 6,
          activitiesCount: 26,
          totalPoints: 186,
          publishedAtIso: base.lastUpdatedIso,
          updatedAtIso: base.lastUpdatedIso,
        },
      ];
    }

    const { data, error } = await client
      .from('content_versions')
      .select(
        'content_version_id, status, base_version_id, title_ar, published_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      contentVersionId: asContentVersionId(String(row.content_version_id)),
      status: (row.status as 'draft' | 'published' | 'archived') ?? 'published',
      baseVersionId: row.base_version_id
        ? asContentVersionId(String(row.base_version_id))
        : null,
      titleAr: String(row.title_ar ?? ''),
      levelsCount: 6,
      activitiesCount: 26,
      totalPoints: 186,
      publishedAtIso: row.published_at ? String(row.published_at) : null,
      updatedAtIso: String(row.updated_at ?? new Date().toISOString()),
    }));
  }

  public async createDraftVersion(
    newVersionId: string,
    baseVersionId: ContentVersionId
  ): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly versionSummary?: ContentVersionSummary;
  }> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        ok: false,
        messageAr: `لا يمكن إنشاء مسودة في بيئة الإنتاج بدون ضبط: ${this.env.missingProductionConfigItems.join(
          ' ، '
        )}`,
      };
    }

    const { error } = await client.rpc('rpc_admin_create_draft_version', {
      p_new_version_id: newVersionId.trim(),
      p_base_version_id: baseVersionId,
    });

    if (error) {
      return {
        ok: false,
        messageAr: `رفض الخادم إنشاء المسودة: ${error.message}`,
      };
    }

    return {
      ok: true,
      messageAr: `تم إنشاء المسودة (${newVersionId.trim()}) في قاعدة بيانات Supabase بنجاح.`,
    };
  }

  public async saveActivityDraft(
    versionId: ContentVersionId,
    updatedActivity: LearningActivityDefinition
  ): Promise<{ readonly ok: boolean; readonly messageAr: string }> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        ok: false,
        messageAr: `لا يمكن حفظ المسودة في بيئة الإنتاج بدون ضبط: ${this.env.missingProductionConfigItems.join(
          ' ، '
        )}`,
      };
    }

    const canonical = extractCanonicalCorrectAnswer(updatedActivity);
    const { error } = await client.rpc('rpc_admin_save_activity_draft', {
      p_draft_version_id: versionId,
      p_activity_id: updatedActivity.activityId,
      p_title_ar: updatedActivity.titleAr,
      p_prompt_ar: updatedActivity.promptAr,
      p_public_options_json: updatedActivity.options.map((o) => ({
        optionId: o.optionId,
        labelAr: o.labelAr,
        feedbackAr: '',
      })),
      p_canonical_correct_answer: canonical,
      p_scientific_hint_ar: updatedActivity.scientificHintAr,
      p_scientific_explanation_ar: updatedActivity.scientificExplanationAr,
      p_visual_asset_url:
        updatedActivity.imageIdentificationConfig?.assetId ??
        updatedActivity.villiComparisonConfig?.assetId ??
        null,
    });

    if (error) {
      return {
        ok: false,
        messageAr: `رفض الخادم حفظ النشاط: ${error.message}`,
      };
    }

    return {
      ok: true,
      messageAr: `تم حفظ النشاط (${updatedActivity.activityId}) في مسودة قاعدة البيانات (${versionId}).`,
    };
  }

  public async publishDraftVersion(draftVersionId: ContentVersionId): Promise<{
    readonly ok: boolean;
    readonly messageAr: string;
    readonly validation?: PublicationValidationResult;
    readonly publishedVersionId?: ContentVersionId;
  }> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        ok: false,
        messageAr: `لا يمكن نشر الإصدار في بيئة الإنتاج بدون ضبط: ${this.env.missingProductionConfigItems.join(
          ' ، '
        )}`,
      };
    }

    const localManifest = getAdminFullManifestForVersion(draftVersionId);
    const validation = validateDraftManifestForPublication(localManifest);

    const { error } = await client.rpc('rpc_admin_publish_version', {
      p_draft_version_id: draftVersionId,
    });

    if (error) {
      return {
        ok: false,
        messageAr: `رفض الخادم نشر الإصدار: ${error.message}`,
        validation,
      };
    }

    return {
      ok: true,
      messageAr: `تم نشر الإصدار (${draftVersionId}) في قاعدة بيانات الإنتاج كإصدار غير قابل للتعديل.`,
      validation,
      publishedVersionId: draftVersionId,
    };
  }

  public async uploadCurriculumAsset(
    fileName: string,
    fileBlob: Blob
  ): Promise<{
    readonly ok: boolean;
    readonly publicUrl: string | null;
    readonly messageAr: string;
  }> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        ok: false,
        publicUrl: null,
        messageAr: 'خدمة Supabase Storage غير مضبوطة.',
      };
    }

    const safePath = `uploads/${Date.now()}_${fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )}`;
    const { error } = await client.storage
      .from('curriculum-assets')
      .upload(safePath, fileBlob, { upsert: false });

    if (error) {
      return {
        ok: false,
        publicUrl: null,
        messageAr: `رفضت سياسة RLS في Supabase Storage رفع الملف: ${error.message}`,
      };
    }

    const { data } = client.storage
      .from('curriculum-assets')
      .getPublicUrl(safePath);

    return {
      ok: true,
      publicUrl: data.publicUrl,
      messageAr: 'تم رفع الصورة التعليمية بنجاح.',
    };
  }

  public async deleteCurriculumAsset(
    assetPath: string
  ): Promise<{ readonly ok: boolean; readonly messageAr: string }> {
    const client = getSupabaseClient(this.env);
    if (!client) {
      return {
        ok: false,
        messageAr: 'خدمة Supabase Storage غير مضبوطة.',
      };
    }

    const { error } = await client.storage
      .from('curriculum-assets')
      .remove([assetPath]);

    if (error) {
      return {
        ok: false,
        messageAr: `رفضت سياسة RLS حذف الملف: ${error.message}`,
      };
    }

    return {
      ok: true,
      messageAr: `تم حذف الملف (${assetPath}) بنجاح.`,
    };
  }
}

export function createBackendAdapter(env: AppEnvironmentConfig): BackendPort {
  if (env.mode === 'production') {
    return new ProductionBackendAdapter(env);
  }
  return new LocalDemoBackendAdapter(env);
}
