import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Compass,
  FileCheck2,
  Info,
  LayoutDashboard,
  Shield,
  ShieldAlert,
  Sliders,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import type { ActivitySubmissionPayload } from '../../activities/ActivityRendererRegistry';
import { soundEffects } from '../../audio/soundEffects';
import { getPublicManifestForVersion } from '../../backend/answerKeyVault';
import type {
  BackendHealthReport,
  BackendPort,
} from '../../backend/backendPort';
import {
  setRuntimeModeOverride,
  type AppEnvironmentConfig,
} from '../../config/env';
import { getUnresolvedDependencies } from '../../config/unresolvedDependencies';
import type { CurriculumManifest } from '../../content/schema';
import {
  createAttemptId,
  createStudentId,
  type ActivityId,
  type ContentVersionId,
  type LevelId,
  type StudentId,
} from '../../domain/ids';
import {
  computeAllLevelsProgress,
  computeCompetitionLeaderboard,
  computeOverallJourneyStats,
  isActivityFinished,
} from '../../domain/rules';
import type {
  AccessibilitySettings,
  ActivityAttempt,
  AppOperatingMode,
  AppScreenId,
  AvatarId,
  StudentProfile,
  StudentProgressState,
} from '../../domain/types';
import {
  applyAccessibilityToDocument,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
} from '../../persistence/accessibilityStorage';
import type { PersistencePort } from '../../persistence/storagePort';
import {
  FiveCardInstructionsScreen,
  StudentEntryScreen,
} from '../screens/EntryAndInstructionsScreens';
import {
  LevelActivityScreen,
  LevelCompletionBadgeScreen,
  SixLevelMapScreen,
} from '../screens/MapAndActivityScreens';
import {
  AboutScreen,
  AccessibilitySettingsScreen,
  ProtectedAdminAreaScreen,
} from '../screens/SettingsAboutAdminScreens';
import {
  DashboardAndLeaderboardScreens_FinalResults,
  DashboardAndLeaderboardScreens_Leaderboard,
  DashboardAndLeaderboardScreens_StudentDashboard,
} from './screenExports';

interface AppShellProps {
  readonly env: AppEnvironmentConfig;
  readonly manifest: CurriculumManifest;
  readonly persistence: PersistencePort;
  readonly backend: BackendPort;
  readonly onModeChange: (nextMode: AppOperatingMode) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  env,
  manifest,
  persistence,
  backend,
  onModeChange,
}) => {
  const [a11ySettings, setA11ySettings] = useState<AccessibilitySettings>(() =>
    loadAccessibilitySettings()
  );

  useEffect(() => {
    applyAccessibilityToDocument(a11ySettings);
  }, [a11ySettings]);

  const [allStates, setAllStates] = useState<readonly StudentProgressState[]>(
    () => persistence.listAllProgressStates()
  );
  const [activeStudentId, setActiveStudentId] = useState<StudentId | null>(() =>
    persistence.getActiveStudentId()
  );
  const [progressState, setProgressState] =
    useState<StudentProgressState | null>(() => {
      const id = persistence.getActiveStudentId();
      return id ? persistence.getStudentProgress(id) : null;
    });

  // Track unsubmitted draft answers in state as well as persistence so drafts survive any navigation
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, string>>(
    () => {
      const id = persistence.getActiveStudentId();
      const st = id ? persistence.getStudentProgress(id) : null;
      return { ...(st?.draftSelectionsByActivityId ?? {}) };
    }
  );

  const [activeScreen, setActiveScreen] = useState<AppScreenId>(() =>
    persistence.getActiveStudentId() ? 'map' : 'entry'
  );

  // Track which screen to return to when exiting Instructions ("فهمت، يلا نبدأ! ←")
  const [returnScreenAfterInstructions, setReturnScreenAfterInstructions] =
    useState<AppScreenId>('map');

  const [selectedLevelId, setSelectedLevelId] = useState<LevelId>(
    manifest.levels[0].levelId
  );

  // Stage 6: Practice Mode state (never persisted or scored) & Leaderboard content version
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [practiceAttempts, setPracticeAttempts] = useState<
    readonly ActivityAttempt[]
  >([]);
  const [practiceDrafts, setPracticeDrafts] = useState<Record<string, string>>(
    {}
  );
  const [selectedLeaderboardVersionId, setSelectedLeaderboardVersionId] =
    useState<ContentVersionId>(manifest.contentVersionId);
  const [activePublishedVersionId, setActivePublishedVersionId] =
    useState<ContentVersionId>(manifest.contentVersionId);

  const [backendHealth, setBackendHealth] =
    useState<BackendHealthReport | null>(null);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);
  const [productionBackendError, setProductionBackendError] = useState<
    string | null
  >(null);

  // Each student journey stays bound to its own immutable contentVersionId;
  // new sessions use the latest activePublishedVersionId
  const effectiveManifest = useMemo(() => {
    const targetVersion =
      progressState?.lastContentVersionId ?? activePublishedVersionId;
    return getPublicManifestForVersion(targetVersion);
  }, [progressState?.lastContentVersionId, activePublishedVersionId]);

  const refreshPersistenceView = (port: PersistencePort) => {
    const states = port.listAllProgressStates();
    const activeId = port.getActiveStudentId();
    const activeProgress = activeId ? port.getStudentProgress(activeId) : null;
    setAllStates(states);
    setActiveStudentId(activeId);
    setProgressState(activeProgress);
    if (activeProgress?.draftSelectionsByActivityId) {
      setSessionDrafts((prev) => ({
        ...prev,
        ...activeProgress.draftSelectionsByActivityId,
      }));
    }
  };

  useEffect(() => {
    refreshPersistenceView(persistence);
    setLastSyncNotice(null);
    setProductionBackendError(null);
  }, [persistence]);

  useEffect(() => {
    let cancelled = false;
    backend.getHealthReport().then((report) => {
      if (!cancelled) {
        setBackendHealth(report);
        if (
          report.mode === 'production' &&
          (report.status === 'production_unconfigured' ||
            report.status === 'production_unreachable')
        ) {
          setProductionBackendError(report.messageAr);
        } else {
          setProductionBackendError(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const levelsProgressMap = useMemo(
    () => computeAllLevelsProgress(effectiveManifest, progressState),
    [effectiveManifest, progressState]
  );

  const overallStats = useMemo(
    () => computeOverallJourneyStats(effectiveManifest, progressState),
    [effectiveManifest, progressState]
  );

  const leaderboardData = useMemo(
    () =>
      computeCompetitionLeaderboard(
        effectiveManifest,
        allStates,
        selectedLeaderboardVersionId,
        activeStudentId
      ),
    [
      effectiveManifest,
      allStates,
      selectedLeaderboardVersionId,
      activeStudentId,
    ]
  );

  const unresolvedDependencies = useMemo(
    () => getUnresolvedDependencies(env),
    [env]
  );

  const selectedLevel =
    effectiveManifest.levels.find((l) => l.levelId === selectedLevelId) ??
    effectiveManifest.levels[0];

  const selectedLevelSummary = levelsProgressMap.get(selectedLevel.levelId);

  const nextLevel =
    effectiveManifest.levels.find(
      (l) => l.order === selectedLevel.order + 1
    ) ?? null;

  const handleUpdateA11y = (next: AccessibilitySettings) => {
    setA11ySettings(next);
    saveAccessibilitySettings(next);
  };

  const handleToggleSoundMuted = () => {
    const nextMuted = !Boolean(a11ySettings.soundMuted);
    if (nextMuted) {
      soundEffects.stopCurrentEffect();
    }
    handleUpdateA11y({ ...a11ySettings, soundMuted: nextMuted });
  };

  const handleOpenInstructionsWithReturn = () => {
    if (activeScreen !== 'instructions' && activeScreen !== 'entry') {
      setReturnScreenAfterInstructions(activeScreen);
    } else {
      setReturnScreenAfterInstructions('map');
    }
    setActiveScreen('instructions');
  };

  const handleStartOrUpdateSession = async (
    displayName: string,
    avatarId: AvatarId,
    startFreshSession: boolean
  ) => {
    const trimmedName = displayName.trim();
    if (!trimmedName) return;

    // Production Mode Guard: NEVER create a silent local session if backend is unconfigured/unreachable
    if (env.mode === 'production') {
      const identity = await backend.ensureSessionStudentId(
        activeStudentId,
        trimmedName,
        avatarId
      );
      if (!identity.studentId || identity.authProvider === 'unconfigured') {
        setProductionBackendError(
          identity.errorAr ??
            'تعذر بدء جلسة الإنتاج: اتصال Supabase غير مضبوط. يُمنع حفظ الجلسات والدرجات محلياً في وضع الإنتاج.'
        );
        return;
      }

      const nowIso = new Date().toISOString();
      const profile: StudentProfile = {
        studentId: identity.studentId,
        displayName: trimmedName,
        gradeLevel: 'grade-6',
        avatarId,
        authProvider: identity.authProvider,
        createdAtIso: nowIso,
        lastActiveAtIso: nowIso,
      };

      const initialState: StudentProgressState = {
        schemaVersion: 1,
        student: profile,
        lastContentVersionId: activePublishedVersionId,
        hasCompletedInstructions: false,
        draftSelectionsByActivityId: {},
        attempts: [],
        updatedAtIso: nowIso,
      };

      persistence.saveStudentProfile(profile, initialState);
      setSessionDrafts({});
      setProductionBackendError(null);
      refreshPersistenceView(persistence);
      setReturnScreenAfterInstructions('map');
      setActiveScreen('instructions');
      return;
    }

    // Reuse existing valid session on return unless explicitly creating a new Demo session
    if (activeStudentId && !startFreshSession) {
      persistence.updateStudentAvatarOrName(activeStudentId, {
        displayName: trimmedName,
        avatarId,
      });
      refreshPersistenceView(persistence);
      setReturnScreenAfterInstructions('map');
      setActiveScreen('instructions');
      return;
    }

    // Create an independent internal identity (NEVER lookup by displayName!)
    const identity = startFreshSession
      ? { studentId: createStudentId(), authProvider: 'local_demo' as const }
      : await backend.ensureSessionStudentId(null);

    if (!identity.studentId || identity.authProvider === 'unconfigured') {
      return;
    }

    const nowIso = new Date().toISOString();
    const profile: StudentProfile = {
      studentId: identity.studentId,
      displayName: trimmedName,
      gradeLevel: 'grade-6',
      avatarId,
      authProvider: identity.authProvider,
      createdAtIso: nowIso,
      lastActiveAtIso: nowIso,
    };

    const initialState: StudentProgressState = {
      schemaVersion: 1,
      student: profile,
      lastContentVersionId: activePublishedVersionId,
      hasCompletedInstructions: false,
      draftSelectionsByActivityId: {},
      attempts: [],
      updatedAtIso: nowIso,
    };

    persistence.saveStudentProfile(profile, initialState);
    setSessionDrafts({});
    refreshPersistenceView(persistence);
    setReturnScreenAfterInstructions('map');
    setActiveScreen('instructions');
  };

  const handleLiveAvatarChange = (avatarId: AvatarId) => {
    if (!activeStudentId) return;
    persistence.updateStudentAvatarOrName(activeStudentId, { avatarId });
    refreshPersistenceView(persistence);
  };

  const handleDraftOptionChange = (
    activityId: ActivityId,
    optionId: string
  ) => {
    if (isPracticeMode) {
      setPracticeDrafts((prev) => ({
        ...prev,
        [activityId]: optionId,
      }));
      return;
    }

    setSessionDrafts((prev) => ({
      ...prev,
      [activityId]: optionId,
    }));
    if (activeStudentId) {
      persistence.saveDraftSelection(activeStudentId, activityId, optionId);
      refreshPersistenceView(persistence);
    }
  };

  const handleCompleteInstructions = () => {
    if (activeStudentId) {
      persistence.markInstructionsCompleted(activeStudentId);
      refreshPersistenceView(persistence);
    }
    setActiveScreen(returnScreenAfterInstructions);
  };

  const handleOpenLevelActivity = (levelId: LevelId) => {
    setSelectedLevelId(levelId);
    setIsPracticeMode(false);
    setActiveScreen('activity');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenPracticeActivity = (
    levelId: LevelId,
    activityId: ActivityId
  ) => {
    setSelectedLevelId(levelId);
    setIsPracticeMode(true);
    setPracticeAttempts([]);
    setPracticeDrafts({});
    setActiveScreen('activity');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(`activity-card-${activityId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleTogglePracticeMode = (nextPractice: boolean) => {
    setIsPracticeMode(nextPractice);
    if (nextPractice) {
      setPracticeAttempts([]);
      setPracticeDrafts({});
    }
  };

  const handleResetPracticeSession = () => {
    setPracticeAttempts([]);
    setPracticeDrafts({});
  };

  const handleStartLevelReplay = (levelId: LevelId) => {
    if (!activeStudentId) return;
    const levelDef = manifest.levels.find((l) => l.levelId === levelId);
    if (!levelDef) return;
    const summary = levelsProgressMap.get(levelId);
    const activityIds = levelDef.activities.map((a) => a.activityId);

    persistence.startLevelReplay(
      activeStudentId,
      levelId,
      activityIds,
      summary?.bestCompletedScoreEarned ?? null,
      manifest.contentVersionId
    );

    setSessionDrafts((prev) => {
      const next = { ...prev };
      for (const actId of activityIds) {
        delete next[actId];
      }
      return next;
    });
    setIsPracticeMode(false);
    setPracticeAttempts([]);
    setPracticeDrafts({});
    refreshPersistenceView(persistence);
  };

  const handleStartFullReplay = () => {
    if (!activeStudentId) return;
    const preservedBestScores: Record<string, number> = {};
    for (const level of manifest.levels) {
      const summary = levelsProgressMap.get(level.levelId);
      if (
        summary &&
        summary.bestCompletedScoreEarned !== null &&
        summary.bestCompletedScoreEarned !== undefined
      ) {
        preservedBestScores[level.levelId] = summary.bestCompletedScoreEarned;
      }
    }

    persistence.startFullReplay(
      activeStudentId,
      manifest.levels.map((l) => l.levelId),
      preservedBestScores,
      manifest.contentVersionId
    );

    setSessionDrafts({});
    setIsPracticeMode(false);
    setPracticeAttempts([]);
    setPracticeDrafts({});
    refreshPersistenceView(persistence);
  };

  const handleOpenLevelBadge = (levelId: LevelId) => {
    setSelectedLevelId(levelId);
    setActiveScreen('level_complete');
    soundEffects.play('badge');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmitAttempt = async (
    activityId: ActivityId,
    payload: ActivitySubmissionPayload
  ) => {
    if (!activeStudentId) return;

    // Practice Mode: evaluate in memory only — never affects persisted scores or leaderboard
    if (isPracticeMode) {
      const existingPracticeForActivity = practiceAttempts.filter(
        (a) => a.activityId === activityId
      );
      if (isActivityFinished(existingPracticeForActivity)) {
        return;
      }

      const practiceAttempt: ActivityAttempt = {
        attemptId: createAttemptId(),
        studentId: activeStudentId,
        contentVersionId: manifest.contentVersionId,
        levelId: selectedLevel.levelId,
        activityId,
        runId: 'practice-session',
        isPractice: true,
        attemptNumber: payload.attemptNumber,
        selectedOptionId: payload.selectedOptionId,
        isCorrect: payload.isCorrect,
        scoreEarned: Math.max(0, payload.scoreEarned),
        maxScore: payload.maxScore,
        durationMs: payload.durationMs,
        submittedAtIso: new Date().toISOString(),
        syncedToBackend: false,
      };

      setPracticeAttempts((prev) => [...prev, practiceAttempt]);
      if (payload.isCorrect) {
        soundEffects.play('success');
      } else {
        soundEffects.play('retry');
      }
      return;
    }

    // Scored Run Guard: Completed activities cannot award points again in the same run
    const activeRunId = selectedLevelSummary?.activeRunId ?? 'run-initial';
    const existingForActivity =
      progressState?.attempts.filter(
        (a) =>
          a.activityId === activityId &&
          !a.isPractice &&
          (a.runId ?? 'run-initial') === activeRunId
      ) ?? [];
    if (isActivityFinished(existingForActivity)) {
      return;
    }

    const wasLevelCompleted =
      selectedLevelSummary?.isCurrentRunCompleted ?? false;

    const attempt: ActivityAttempt = {
      attemptId: createAttemptId(),
      studentId: activeStudentId,
      contentVersionId: effectiveManifest.contentVersionId,
      levelId: selectedLevel.levelId,
      activityId,
      runId: activeRunId,
      isPractice: false,
      attemptNumber: payload.attemptNumber,
      selectedOptionId: payload.selectedOptionId,
      isCorrect: payload.isCorrect,
      scoreEarned: Math.max(0, payload.scoreEarned),
      maxScore: payload.maxScore,
      durationMs: payload.durationMs,
      submittedAtIso: new Date().toISOString(),
      syncedToBackend: false,
    };

    // Strict Production Rule: Do NOT enable a fallback that silently stores production scores locally when the backend fails!
    if (env.mode === 'production') {
      const syncResult = await backend.syncAttempt({
        ...attempt,
        idempotencyKey: payload.idempotencyKey,
        runId: activeRunId,
      });
      if (!syncResult.synced) {
        setProductionBackendError(syncResult.detailAr);
        setLastSyncNotice(syncResult.detailAr);
        return;
      }

      const syncedAttempt: ActivityAttempt = {
        ...attempt,
        scoreEarned: syncResult.serverScoreEarned ?? attempt.scoreEarned,
        syncedToBackend: true,
      };
      const updatedState = persistence.appendAttempt(
        activeStudentId,
        syncedAttempt
      );
      refreshPersistenceView(persistence);
      setLastSyncNotice(syncResult.detailAr);
      setProductionBackendError(null);

      const updatedMap = computeAllLevelsProgress(
        effectiveManifest,
        updatedState
      );
      const isNowLevelCompleted =
        updatedMap.get(selectedLevel.levelId)?.isCurrentRunCompleted ?? false;

      if (!wasLevelCompleted && isNowLevelCompleted) {
        soundEffects.play('badge');
      } else if (payload.isCorrect) {
        soundEffects.play('success');
      } else {
        soundEffects.play('retry');
      }
      return;
    }

    const updatedState = persistence.appendAttempt(activeStudentId, attempt);
    refreshPersistenceView(persistence);

    const updatedMap = computeAllLevelsProgress(
      effectiveManifest,
      updatedState
    );
    const isNowLevelCompleted =
      updatedMap.get(selectedLevel.levelId)?.isCurrentRunCompleted ?? false;

    if (!wasLevelCompleted && isNowLevelCompleted) {
      soundEffects.play('badge');
    } else if (payload.isCorrect) {
      soundEffects.play('success');
    } else {
      soundEffects.play('retry');
    }

    const syncResult = await backend.syncAttempt({
      ...attempt,
      idempotencyKey: payload.idempotencyKey,
      runId: activeRunId,
    });
    setLastSyncNotice(syncResult.detailAr);
    if (syncResult.synced) {
      persistence.markAttemptSynced(activeStudentId, attempt.attemptId);
      refreshPersistenceView(persistence);
    }
  };

  const handleModeSwitch = (targetMode: AppOperatingMode) => {
    setRuntimeModeOverride(targetMode);
    onModeChange(targetMode);
  };

  const handleClearDemoData = () => {
    if (env.mode !== 'demo') return;
    persistence.clearAllData();
    setSessionDrafts({});
    refreshPersistenceView(persistence);
    setActiveScreen('entry');
  };

  const primaryNavItems: readonly {
    readonly id: AppScreenId;
    readonly labelAr: string;
    readonly shortLabelAr: string;
    readonly Icon: LucideIcon;
  }[] = [
    {
      id: 'entry',
      labelAr: 'دخول الطالب',
      shortLabelAr: 'الدخول',
      Icon: UserCheck,
    },
    {
      id: 'instructions',
      labelAr: 'التعليمات (؟)',
      shortLabelAr: 'التعليمات',
      Icon: BookOpen,
    },
    {
      id: 'map',
      labelAr: 'خريطة المستويات (٦)',
      shortLabelAr: 'الخريطة',
      Icon: Compass,
    },
    {
      id: 'activity',
      labelAr: 'شاشة النشاط',
      shortLabelAr: 'النشاط',
      Icon: Award,
    },
    {
      id: 'dashboard',
      labelAr: 'لوحة الطالب',
      shortLabelAr: 'لوحتي',
      Icon: LayoutDashboard,
    },
    {
      id: 'leaderboard',
      labelAr: 'المتصدرون',
      shortLabelAr: 'الترتيب',
      Icon: Trophy,
    },
    {
      id: 'final_results',
      labelAr: 'النتائج والمراجعة',
      shortLabelAr: 'النتائج',
      Icon: FileCheck2,
    },
    {
      id: 'accessibility',
      labelAr: 'إمكانية الوصول',
      shortLabelAr: 'الوصول',
      Icon: Sliders,
    },
    {
      id: 'about',
      labelAr: 'حول المشروع',
      shortLabelAr: 'حول',
      Icon: Info,
    },
    {
      id: 'admin',
      labelAr: 'المسؤول',
      shortLabelAr: 'الإدارة',
      Icon: Shield,
    },
  ];

  const activeStudentName = progressState?.student.displayName ?? null;

  return (
    <div className="app-root" dir="rtl">
      <a href="#main-content" className="skip-link">
        تخطّي إلى المحتوى الرئيسي
      </a>

      {/* Main Brand & Desktop Navigation Header */}
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__brand">
            <button
              type="button"
              className="brand-home-btn btn--touch"
              onClick={() => setActiveScreen(activeStudentId ? 'map' : 'entry')}
            >
              <img className="brand-organ" src="/assets/3d/anatomy.webp" alt="" />
              <div className="brand-text">
                <strong className="brand-title">{manifest.titleAr}</strong>
                <span className="brand-subtitle">
                  {activeStudentName
                    ? `مرحباً يا ${activeStudentName}`
                    : manifest.gradeAr}
                </span>
              </div>
            </button>
          </div>

          <nav
            className="desktop-nav"
            aria-label="التنقل الرئيسي بين شاشات التطبيق"
          >
            {primaryNavItems.filter(item => activeStudentId ? ['map','dashboard','leaderboard','instructions'].includes(item.id) : item.id === 'instructions').map(({ id, shortLabelAr }) => {
              const isCurrent =
                activeScreen === id ||
                (id === 'activity' && activeScreen === 'level_complete');
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`nav-pill btn--touch ${
                    isCurrent ? 'nav-pill--active' : ''
                  }`}
                  onClick={() => {
                    if (id === 'instructions') {
                      handleOpenInstructionsWithReturn();
                    } else {
                      setActiveScreen(id);
                    }
                  }}
                >
                  <span className={`navigation-3d navigation-3d--${id}`} aria-hidden="true"></span>
                  <span>{shortLabelAr}</span>
                </button>
              );
            })}
          </nav>
          <div className="compact-controls">
            <button className="btn icon-button" onClick={handleToggleSoundMuted} aria-label={a11ySettings.soundMuted ? 'تشغيل الصوت' : 'كتم الصوت'}>{a11ySettings.soundMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
            <button className="btn icon-button" onClick={() => setActiveScreen('accessibility')} aria-label="الإعدادات"><Sliders size={18}/></button>
          </div>
        </div>
      </header>

      {/* Main Screen Content Area */}
      <main id="main-content" className="main-viewport">
        {env.mode === 'production' && productionBackendError && (
          <div
            className="ds-callout ds-callout--error"
            role="alert"
            data-testid="production-backend-alert"
            style={{ marginBottom: '1rem' }}
          >
            <ShieldAlert size={20} aria-hidden="true" />
            <div>
              <strong>تعذّر الاتصال لحفظ تقدمك</strong>
              <p>اختياراتك محفوظة على الشاشة. حاول مرة ثانية بعد رجوع الاتصال، أو اطلب مساعدة مسؤول الموقع.</p>
              {env.enableDiagnostics && (
                <p style={{ fontSize: '0.82rem', marginTop: '0.35rem', opacity: 0.85 }}>
                  {productionBackendError}
                </p>
              )}
            </div>
          </div>
        )}

        {lastSyncNotice && activeScreen === 'admin' && (
          <div className="sync-toast" role="status" aria-live="polite">
            <span>{lastSyncNotice}</span>
          </div>
        )}

        {activeScreen === 'entry' && (
          <StudentEntryScreen
            mode={env.mode}
            activeStudent={progressState?.student ?? null}
            onStartOrUpdateSession={handleStartOrUpdateSession}
            onLiveAvatarChange={handleLiveAvatarChange}
            onContinueExistingSession={() => setActiveScreen('map')}
            onNavigateInstructions={handleOpenInstructionsWithReturn}
            onNavigateAdmin={() => setActiveScreen('admin')}
          />
        )}

        {activeScreen === 'instructions' && (
          <FiveCardInstructionsScreen
            titleAr={effectiveManifest.instructionsTitleAr}
            subtitleAr={effectiveManifest.instructionsSubtitleAr}
            cards={effectiveManifest.instructionCards}
            reminderAr={effectiveManifest.instructionsReminderAr}
            primaryActionAr={effectiveManifest.instructionsPrimaryActionAr}
            progressState={progressState}
            onPrimaryAction={handleCompleteInstructions}
          />
        )}

        {activeScreen === 'map' && (
          <SixLevelMapScreen
            manifest={effectiveManifest}
            levelsProgressMap={levelsProgressMap}
            activeStudentName={activeStudentName}
            hasUnfinishedScoredRunAnyLevel={
              overallStats.hasUnfinishedScoredRunAnyLevel
            }
            onOpenLevelActivity={handleOpenLevelActivity}
            onOpenLevelBadge={handleOpenLevelBadge}
            onOpenFinalResults={() => setActiveScreen('final_results')}
            onRequireStudentEntry={() => setActiveScreen('entry')}
            onStartFullReplay={handleStartFullReplay}
          />
        )}

        {activeScreen === 'activity' && (
          <LevelActivityScreen
            level={selectedLevel}
            totalLevelsCount={effectiveManifest.levels.length}
            levelSummary={selectedLevelSummary}
            progressState={progressState}
            draftSelections={sessionDrafts}
            isPracticeMode={isPracticeMode}
            practiceAttempts={practiceAttempts}
            practiceDrafts={practiceDrafts}
            onTogglePracticeMode={handleTogglePracticeMode}
            onResetPracticeLevel={handleResetPracticeSession}
            onStartLevelReplay={() =>
              handleStartLevelReplay(selectedLevel.levelId)
            }
            onDraftOptionChange={handleDraftOptionChange}
            onSubmitAttempt={handleSubmitAttempt}
            onBackToMap={() => setActiveScreen('map')}
            onOpenInstructions={handleOpenInstructionsWithReturn}
            onViewBadgeAward={() => handleOpenLevelBadge(selectedLevel.levelId)}
            onRequireStudentEntry={() => setActiveScreen('entry')}
          />
        )}

        {activeScreen === 'level_complete' && (
          <LevelCompletionBadgeScreen
            level={selectedLevel}
            studentName={activeStudentName}
            levelSummary={selectedLevelSummary}
            nextLevel={nextLevel}
            onProceedNextLevel={(nextId) => handleOpenLevelActivity(nextId)}
            onReturnToMap={() => setActiveScreen('map')}
            onOpenFinalResults={() => setActiveScreen('final_results')}
          />
        )}

        {activeScreen === 'dashboard' && (
          <DashboardAndLeaderboardScreens_StudentDashboard
            manifest={effectiveManifest}
            progressState={progressState}
            levelsProgressMap={levelsProgressMap}
            overallStats={overallStats}
            onOpenLevel={handleOpenLevelActivity}
            onOpenPracticeActivity={handleOpenPracticeActivity}
            onStartLevelReplay={handleStartLevelReplay}
            onStartFullReplay={handleStartFullReplay}
            onNavigateEntry={() => setActiveScreen('entry')}
            onNavigateFinalResults={() => setActiveScreen('final_results')}
          />
        )}

        {activeScreen === 'leaderboard' && (
          <DashboardAndLeaderboardScreens_Leaderboard
            mode={env.mode}
            storageNamespace={persistence.namespace}
            leaderboardData={leaderboardData}
            activeStudentId={activeStudentId}
            onSelectContentVersion={setSelectedLeaderboardVersionId}
            onNavigateEntry={() => setActiveScreen('entry')}
          />
        )}

        {activeScreen === 'final_results' && (
          <DashboardAndLeaderboardScreens_FinalResults
            manifest={effectiveManifest}
            progressState={progressState}
            levelsProgressMap={levelsProgressMap}
            overallStats={overallStats}
            onOpenLevelActivity={handleOpenLevelActivity}
            onReturnToMap={() => setActiveScreen('map')}
          />
        )}

        {activeScreen === 'accessibility' && (
          <AccessibilitySettingsScreen
            settings={a11ySettings}
            onUpdateSettings={handleUpdateA11y}
          />
        )}

        {activeScreen === 'about' && (
          <AboutScreen
            manifest={effectiveManifest}
            env={env}
            onOpenAdmin={() => setActiveScreen('admin')}
          />
        )}

        {activeScreen === 'admin' && (
          <ProtectedAdminAreaScreen
            env={env}
            manifest={effectiveManifest}
            backend={backend}
            storageNamespace={persistence.namespace}
            allStates={allStates}
            backendHealth={backendHealth}
            unresolvedDependencies={unresolvedDependencies}
            onSwitchMode={handleModeSwitch}
            onClearDemoData={handleClearDemoData}
            onSelectActivePublishedVersion={(vId) => {
              setActivePublishedVersionId(vId);
              setSelectedLeaderboardVersionId(vId);
            }}
          />
        )}
      </main>

      <footer className="site-footer"><span>رحلة الهضم · نتعلم ونكتشف معًا</span><div><button onClick={() => setActiveScreen('about')}>عن المشروع</button><button onClick={() => setActiveScreen('admin')}>الإدارة</button>{activeStudentId && <button onClick={() => setActiveScreen('entry')}>تغيير الاسم والشخصية</button>}</div></footer>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="التنقل السريع للهاتف">
        {primaryNavItems.filter(item => activeStudentId ? ['map','dashboard','leaderboard','instructions'].includes(item.id) : ['entry','instructions','about'].includes(item.id)).map(({ id, shortLabelAr, Icon }) => {
          const isCurrent = activeScreen === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={isCurrent ? 'page' : undefined}
              className={`mobile-nav-item ${
                isCurrent ? 'mobile-nav-item--active' : ''
              }`}
              onClick={() => {
                if (id === 'instructions') {
                  handleOpenInstructionsWithReturn();
                } else {
                  setActiveScreen(id);
                }
              }}
            >
              <Icon size={18} />
              <span>{shortLabelAr}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
