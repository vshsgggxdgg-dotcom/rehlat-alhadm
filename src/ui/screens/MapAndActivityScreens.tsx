import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  CircleDot,
  Compass,
  FlaskConical,
  HelpCircle,
  Lock,
  Play,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import {
  ActivityRendererRegistry,
  type ActivitySubmissionPayload,
} from '../../activities/ActivityRendererRegistry';
import type {
  CurriculumManifest,
  LearningLevelDefinition,
} from '../../content/schema';
import type { ActivityId, LevelId } from '../../domain/ids';
import type {
  ActivityAttempt,
  LevelProgressSummary,
  StudentProgressState,
} from '../../domain/types';
import {
  LevelBadgeIllustration,
  StationIllustration,
} from '../illustrations/TransparentIllustrations';

interface SixLevelMapScreenProps {
  readonly manifest: CurriculumManifest;
  readonly levelsProgressMap: ReadonlyMap<LevelId, LevelProgressSummary>;
  readonly activeStudentName: string | null;
  readonly hasUnfinishedScoredRunAnyLevel: boolean;
  readonly onOpenLevelActivity: (levelId: LevelId) => void;
  readonly onOpenLevelBadge: (levelId: LevelId) => void;
  readonly onStartFullReplay: () => void;
  readonly onOpenFinalResults: () => void;
  readonly onRequireStudentEntry: () => void;
}

export const SixLevelMapScreen: React.FC<SixLevelMapScreenProps> = ({
  manifest,
  levelsProgressMap,
  activeStudentName,
  hasUnfinishedScoredRunAnyLevel,
  onOpenLevelActivity,
  onOpenLevelBadge,
  onStartFullReplay,
  onOpenFinalResults,
  onRequireStudentEntry,
}) => {
  const [confirmingFullReplay, setConfirmingFullReplay] =
    useState<boolean>(false);

  const summaries = Array.from(levelsProgressMap.values());
  const completedCount = summaries.filter((s) => s.isCompleted).length;
  const hasAnyProgress = summaries.some((s) => s.attemptsCount > 0);

  const handleRequestFullReplay = () => {
    if (hasUnfinishedScoredRunAnyLevel) {
      setConfirmingFullReplay(true);
      return;
    }
    onStartFullReplay();
  };

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="map-screen-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--neutral">
              خريطة المسار العلمي • ٦ مستويات متتابعة
            </span>
            <h1 id="map-screen-heading" className="screen-title">
              {activeStudentName
                ? `خريطة رحلة الهضم الخاصة بك يا ${activeStudentName}`
                : 'خريطة المستويات الستة لرحلة الهضم'}
            </h1>
            <p className="screen-lead">
              تدرّج عبر محطات الجهاز الهضمي بالترتيب التشريحي. إكمال أنشطة كل
              مستوى يمنحك شارته العلمية ويفتح المستوى التالي.
            </p>
          </div>

          <div className="map-progress-summary">
            <span className="status-chip status-chip--selected">
              <span>
                المستويات المكتملة: {completedCount} من {manifest.levels.length}
              </span>
            </span>

            {activeStudentName && hasAnyProgress && (
              <button
                type="button"
                className="btn btn--secondary btn--touch"
                onClick={handleRequestFullReplay}
                data-testid="full-replay-btn"
              >
                <RotateCcw size={17} aria-hidden="true" />
                <span>إعادة الرحلة الكاملة (مع حفظ أفضل نتائجك)</span>
              </button>
            )}

            {completedCount === manifest.levels.length && (
              <button
                type="button"
                className="btn btn--primary btn--touch"
                onClick={onOpenFinalResults}
              >
                <Trophy size={18} aria-hidden="true" />
                <span>عرض النتيجة النهائية والمراجعة الشاملة</span>
              </button>
            )}
          </div>
        </div>

        {confirmingFullReplay && (
          <div
            className="ds-callout ds-callout--warning"
            role="alertdialog"
            aria-labelledby="confirm-full-replay-title"
            data-testid="confirm-full-replay-dialog"
          >
            <AlertTriangle size={22} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong id="confirm-full-replay-title">
                  تأكيد قبل استبدال جولة غير مكتملة
                </strong>
                <p>
                  لديك جولة حالية غير مكتملة في أحد المستويات. بدء رحلة جديدة
                  سيُصفّر محاولات الجولة الحالية غير المكتملة، مع الاحتفاظ التام
                  بأفضل نتيجة مكتملة حققتها سابقاً في كل مستوى وبالشارات المكتسبة.
                </p>
              </div>
              <div className="header-actions-inline">
                <button
                  type="button"
                  className="btn btn--primary btn--touch"
                  onClick={() => {
                    setConfirmingFullReplay(false);
                    onStartFullReplay();
                  }}
                  data-testid="confirm-full-replay-yes-btn"
                >
                  <span>تأكيد بدء رحلة جديدة</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={() => setConfirmingFullReplay(false)}
                  data-testid="confirm-full-replay-cancel-btn"
                >
                  <span>إلغاء والبقاء في الجولة الحالية</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {!activeStudentName && (
          <div className="ds-callout ds-callout--warning" role="status">
            <div>
              <strong>تنبيه: اكتب اسمك لبدء حفظ تقدمك</strong>
              <p>
                يمكنك استعراض خريطة المستويات والمادة العلمية، ولكن لحفظ
                إجاباتك وفتح المستويات المتتالية يرجى كتابة اسمك أولاً.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onRequireStudentEntry}
            >
              <span>كتابة الاسم والبدء</span>
            </button>
          </div>
        )}

        <div className="six-levels-grid">
          {manifest.levels.map((level) => {
            const summary = levelsProgressMap.get(level.levelId);
            const isUnlocked = summary?.isUnlocked ?? level.order === 1;
            const isCompleted = summary?.isCompleted ?? false;
            const currentScore = summary?.currentRunScoreEarned ?? 0;
            const bestCompletedScore = summary?.bestCompletedScoreEarned ?? null;
            const maxScore = summary?.maxPossibleScore ?? 20;
            const completedActs = summary?.completedActivityIds.length ?? 0;

            return (
              <article
                key={level.levelId}
                className={`level-map-card ${
                  isCompleted
                    ? 'level-map-card--completed'
                    : isUnlocked
                    ? 'level-map-card--unlocked'
                    : 'level-map-card--locked'
                }`}
                aria-labelledby={`lvl-title-${level.levelId}`}
              >
                <div className="level-map-card__top">
                  <span className="level-order-badge">
                    المستوى {level.order}
                  </span>

                  {/* Status distinguished by text + shape + icon, never color alone */}
                  {isCompleted ? (
                    <span className="status-chip status-chip--correct">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>مكتمل بشارة ✓</span>
                    </span>
                  ) : isUnlocked ? (
                    <span className="status-chip status-chip--selected">
                      <CircleDot size={16} aria-hidden="true" />
                      <span>مفتوح للتعلم ◆</span>
                    </span>
                  ) : (
                    <span className="status-chip status-chip--locked">
                      <Lock size={15} aria-hidden="true" />
                      <span>مقفل ■ (أكمل المستوى {level.order - 1})</span>
                    </span>
                  )}
                </div>

                <div className="level-map-card__illustration">
                  <StationIllustration
                    illustrationKey={level.illustrationKey}
                  />
                </div>

                <h2
                  id={`lvl-title-${level.levelId}`}
                  className="level-map-card__title"
                >
                  {level.stationNameAr}
                </h2>
                <p className="level-map-card__organ">{level.organNameAr}</p>
                <p className="level-map-card__subtitle">{level.subtitleAr}</p>

                <div className="level-map-card__metrics">
                  <span>
                    أنشطة الجولة الحالية: {completedActs} /{' '}
                    {level.activities.length}
                  </span>
                  <span>
                    الجولة الحالية: {currentScore} / {maxScore}
                  </span>
                  {bestCompletedScore !== null && (
                    <span>
                      أفضل نتيجة مكتملة: {bestCompletedScore} / {maxScore}
                    </span>
                  )}
                </div>

                <div className="level-map-card__actions">
                  <button
                    type="button"
                    className={`btn btn--touch ${
                      isUnlocked ? 'btn--primary' : 'btn--secondary'
                    } btn--full`}
                    onClick={() => onOpenLevelActivity(level.levelId)}
                  >
                    {isCompleted ? (
                      <>
                        <BookOpen size={18} aria-hidden="true" />
                        <span>مراجعة المستوى والأنشطة</span>
                      </>
                    ) : isUnlocked ? (
                      <>
                        <Play size={18} aria-hidden="true" />
                        <span>ابدأ المستوى ←</span>
                      </>
                    ) : (
                      <>
                        <BookOpen size={18} aria-hidden="true" />
                        <span>يفتح بعد إكمال المستوى السابق</span>
                      </>
                    )}
                  </button>

                  {isCompleted && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--touch btn--full"
                      onClick={() => onOpenLevelBadge(level.levelId)}
                    >
                      <Award size={18} aria-hidden="true" />
                      <span>عرض الشارة: {level.badge.titleAr}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

interface LevelActivityScreenProps {
  readonly level: LearningLevelDefinition;
  readonly totalLevelsCount: number;
  readonly levelSummary: LevelProgressSummary | undefined;
  readonly progressState: StudentProgressState | null;
  readonly draftSelections: Readonly<Record<string, string>>;
  readonly isPracticeMode: boolean;
  readonly practiceAttempts: readonly ActivityAttempt[];
  readonly practiceDrafts: Readonly<Record<string, string>>;
  readonly onTogglePracticeMode: (next: boolean) => void;
  readonly onResetPracticeLevel: () => void;
  readonly onStartLevelReplay: () => void;
  readonly onDraftOptionChange: (
    activityId: ActivityId,
    optionId: string
  ) => void;
  readonly onSubmitAttempt: (
    activityId: ActivityId,
    payload: ActivitySubmissionPayload
  ) => void | Promise<void>;
  readonly onBackToMap: () => void;
  readonly onOpenInstructions: () => void;
  readonly onViewBadgeAward: () => void;
  readonly onRequireStudentEntry: () => void;
}

export const LevelActivityScreen: React.FC<LevelActivityScreenProps> = ({
  level,
  totalLevelsCount,
  levelSummary,
  progressState,
  draftSelections,
  isPracticeMode,
  practiceAttempts,
  practiceDrafts,
  onTogglePracticeMode,
  onResetPracticeLevel,
  onStartLevelReplay,
  onDraftOptionChange,
  onSubmitAttempt,
  onBackToMap,
  onOpenInstructions,
  onViewBadgeAward,
  onRequireStudentEntry,
}) => {
  const [activeActivityIndex,setActiveActivityIndex] = useState(0);
  useEffect(()=>setActiveActivityIndex(0),[level.levelId,isPracticeMode]);
  const [confirmingLevelReplay, setConfirmingLevelReplay] =
    useState<boolean>(false);

  const isUnlocked = levelSummary?.isUnlocked ?? level.order === 1;
  const isCompleted = levelSummary?.isCompleted ?? false;
  const isCurrentRunCompleted = levelSummary?.isCurrentRunCompleted ?? false;
  const hasUnfinishedCurrentRun =
    levelSummary?.hasUnfinishedCurrentRun ?? false;
  const currentRunAttemptsCount = levelSummary?.currentRunAttemptsCount ?? 0;
  const bestCompletedScore = levelSummary?.bestCompletedScoreEarned ?? null;
  const currentRunScore = levelSummary?.currentRunScoreEarned ?? 0;
  const maxPossibleScore =
    levelSummary?.maxPossibleScore ??
    level.activities.reduce((acc, a) => acc + a.maxScore, 0);

  const hasActiveStudent = progressState !== null;
  const studentName = progressState?.student.displayName ?? null;
  const activeRunId = levelSummary?.activeRunId ?? 'run-initial';

  const handleRequestLevelReplay = () => {
    if (hasUnfinishedCurrentRun) {
      setConfirmingLevelReplay(true);
      return;
    }
    onStartLevelReplay();
  };

  return (
    <div className="screen-container">
      {/* Top Level Header */}
      <article className="surface-card" aria-labelledby="activity-level-heading">
        <div className="screen-header-row">
          <div>
            <div className="breadcrumb-row">
              <button
                type="button"
                className="btn btn--ghost btn--touch"
                onClick={onBackToMap}
              >
                <ArrowRight size={17} aria-hidden="true" />
                <span>العودة إلى خريطة المستويات الستة</span>
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--touch"
                onClick={onOpenInstructions}
                title="الرجوع للتعليمات مع حفظ تقدمك ومسودة إجابتك"
              >
                <HelpCircle size={17} aria-hidden="true" />
                <span>قواعد اللعب (؟)</span>
              </button>

              {hasActiveStudent && isUnlocked && (
                <button
                  type="button"
                  className={`btn btn--touch ${
                    isPracticeMode ? 'btn--primary' : 'btn--secondary'
                  }`}
                  onClick={() => onTogglePracticeMode(!isPracticeMode)}
                  aria-pressed={isPracticeMode}
                  data-testid="toggle-practice-mode-btn"
                >
                  <FlaskConical size={17} aria-hidden="true" />
                  <span>
                    {isPracticeMode
                      ? 'وضع التدريب الحر نشط (انقر للعودة للجولة المحسوبة)'
                      : 'تفعيل وضع التدريب الحر'}
                  </span>
                </button>
              )}

              {hasActiveStudent &&
                isUnlocked &&
                !isPracticeMode &&
                (currentRunAttemptsCount > 0 || isCompleted) && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--touch"
                    onClick={handleRequestLevelReplay}
                    data-testid="level-replay-btn"
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    <span>إعادة جولة المستوى (مع حفظ أفضل نتيجة)</span>
                  </button>
                )}

              <span className="status-chip status-chip--neutral">
                المستوى {level.order} من {totalLevelsCount}
              </span>
            </div>
            <h1 id="activity-level-heading" className="screen-title">
              {level.stationNameAr}
            </h1>
            <p className="screen-lead">{level.subtitleAr}</p>
          </div>

          <div
            className="level-score-pill"
            data-testid="level-header-score-pill"
          >
            <span>نقاط الجولة الحالية</span>
            <strong>
              {currentRunScore} / {maxPossibleScore}
            </strong>
            <small>
              الأنشطة المنجزة في الجولة:{' '}
              {levelSummary?.completedActivityIds.length ?? 0} /{' '}
              {level.activities.length}
            </small>
            {bestCompletedScore !== null && (
              <small data-testid="level-best-completed-score">
                أفضل نتيجة مكتملة محفوظة: {bestCompletedScore} /{' '}
                {maxPossibleScore}
              </small>
            )}
          </div>
        </div>

        {/* Practice Mode Banner: does not affect scores or leaderboard */}
        {isPracticeMode && (
          <div
            className="ds-callout ds-callout--hint"
            role="status"
            data-testid="practice-mode-banner"
          >
            <FlaskConical size={20} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong>وضع التدريب الحر نشط حالياً</strong>
                <p>
                  إجاباتك في وضع التدريب الحر مخصصة للمراجعة والتجربة العلمية فقط،
                  ولا تؤثر إطلاقاً على نقاط جولتك المحسوبة أو أفضل نتيجة مكتملة أو
                  ترتيبك في لوحة المتصدرين.
                </p>
              </div>
              <div className="header-actions-inline">
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={onResetPracticeLevel}
                  data-testid="reset-practice-level-btn"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>إعادة تصفير التدريب الحر</span>
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--touch"
                  onClick={() => onTogglePracticeMode(false)}
                >
                  <span>العودة إلى الجولة المحسوبة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm before discarding an unfinished scored run */}
        {confirmingLevelReplay && (
          <div
            className="ds-callout ds-callout--warning"
            role="alertdialog"
            aria-labelledby="confirm-level-replay-heading"
            data-testid="confirm-discard-unfinished-run-dialog"
          >
            <AlertTriangle size={22} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong id="confirm-level-replay-heading">
                  تأكيد قبل استبدال جولة المستوى غير المكتملة
                </strong>
                <p>
                  لديك جولة محسوبة غير مكتملة حالياً في هذا المستوى (أنجزت{' '}
                  {levelSummary?.completedActivityIds.length ?? 0} من{' '}
                  {level.activities.length} أنشطة). هل تريد استبدالها بجولة
                  جديدة؟ علماً أن أفضل نتيجة مكتملة سابقة ({bestCompletedScore ?? 0}/
                  {maxPossibleScore}) تظل محفوظة ولا تنقص أبداً.
                </p>
              </div>
              <div className="header-actions-inline">
                <button
                  type="button"
                  className="btn btn--primary btn--touch"
                  onClick={() => {
                    setConfirmingLevelReplay(false);
                    onStartLevelReplay();
                  }}
                  data-testid="confirm-replay-yes-btn"
                >
                  <span>نعم، ابدأ جولة جديدة للمستوى</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={() => setConfirmingLevelReplay(false)}
                  data-testid="confirm-replay-cancel-btn"
                >
                  <span>إلغاء والبقاء في الجولة الحالية</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {!hasActiveStudent && (
          <div className="ds-callout ds-callout--warning" role="status">
            <div>
              <strong>جلسة الطالب مطلوبة لتسجيل المحاولات</strong>
              <p>
                يرجى كتابة اسمك أولاً لتفعيل إرسال الإجابات وحفظ النقاط والشارات.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onRequireStudentEntry}
            >
              <span>كتابة الاسم والبدء</span>
            </button>
          </div>
        )}

        {hasActiveStudent && !isUnlocked && (
          <div className="ds-callout ds-callout--locked" role="note">
            <Lock size={20} aria-hidden="true" />
            <div>
              <strong>هذا المستوى مقفل تسلسلياً حالياً</strong>
              <p>
                كمّل كل أنشطة مستواك السابق عشان تبدأ هذا المستوى. يمكنك قراءة
                الشرح العلمي أدناه.
              </p>
            </div>
          </div>
        )}

        {isCompleted && !isPracticeMode && (
          <div className="ds-callout ds-callout--success" role="status">
            <CheckCircle2 size={22} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong>
                  أحسنت{studentName ? ` يا ${studentName}` : ''}!{' '}
                  {isCurrentRunCompleted
                    ? 'خلّصت أنشطة هذه الجولة واستحقيت شارة المستوى!'
                    : 'هذا المستوى مكتمل مسبقاً وشارته محفوظة في رصيدك!'}
                </strong>
                <p>
                  حصلت على «{level.badge.titleAr}» • أفضل نتيجة مكتملة:{' '}
                  <strong>
                    {bestCompletedScore ?? currentRunScore} / {maxPossibleScore}
                  </strong>
                  .
                </p>
              </div>
              <div className="header-actions-inline">
                <button
                  type="button"
                  className="btn btn--primary btn--touch"
                  onClick={onViewBadgeAward}
                >
                  <Award size={18} aria-hidden="true" />
                  <span>عرض الشارة والانتقال للمستوى التالي</span>
                </button>
                {isCurrentRunCompleted && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--touch"
                    onClick={handleRequestLevelReplay}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    <span>إعادة جولة المستوى لتحسين نتيجتك</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <details className="learning-objectives"><summary>هنتعلّم إيه في المستوى ده؟</summary><ul>{level.learningObjectivesAr.map((obj,i)=><li key={i}>{obj}</li>)}</ul></details>
      </article>

      {/* Interactive Activities Section */}
      <section
        className="activities-stack"
        aria-label={`الأنشطة التفاعلية لـ ${level.stationNameAr}`}
      >
        {level.activities.map((activity, idx) => {
          if(idx!==activeActivityIndex)return null;
          const activityAttempts = isPracticeMode
            ? practiceAttempts.filter(
                (a) => a.activityId === activity.activityId
              )
            : progressState?.attempts.filter(
                (a) =>
                  !a.isPractice &&
                  a.activityId === activity.activityId &&
                  (a.runId ?? 'run-initial') === activeRunId
              ) ?? [];

          const isInteractionDisabled =
            !hasActiveStudent || (!isUnlocked && !isPracticeMode);
          const draftOptionId = isPracticeMode
            ? practiceDrafts[activity.activityId] ?? ''
            : draftSelections[activity.activityId] ?? '';

          // Determine next action when this activity is finished
          const completedIds = new Set(
            levelSummary?.completedActivityIds ?? []
          );
          const nextIncompleteActivity =
            level.activities
              .slice(idx + 1)
              .find((a) => !completedIds.has(a.activityId)) ??
            level.activities.find(
              (a) =>
                a.activityId !== activity.activityId &&
                !completedIds.has(a.activityId)
            ) ??
            level.activities[idx + 1] ??
            null;

          const nextActionLabelAr = isPracticeMode
            ? 'إعادة التدريب على هذا النشاط'
            : isCurrentRunCompleted
            ? `استلام شارة المستوى (${level.badge.titleAr})`
            : nextIncompleteActivity
            ? `الانتقال إلى النشاط التالي (${nextIncompleteActivity.titleAr})`
            : `استلام شارة المستوى (${level.badge.titleAr})`;

          const handleNextAction = () => {
            if (isPracticeMode) {
              onResetPracticeLevel();
              return;
            }
            if (isCurrentRunCompleted || !nextIncompleteActivity) {
              onViewBadgeAward();
              return;
            }
            const nextIndex=level.activities.findIndex(a=>a.activityId===nextIncompleteActivity.activityId);
            setActiveActivityIndex(nextIndex<0?Math.min(idx+1,level.activities.length-1):nextIndex);
            window.scrollTo({top:0,behavior:'smooth'});
          };

          return (
            <ActivityRendererRegistry
              key={`${activity.activityId}-${
                isPracticeMode ? 'practice' : activeRunId
              }`}
              activity={activity}
              activityIndex={idx}
              totalActivitiesInLevel={level.activities.length}
              studentName={studentName}
              draftSelectedOptionId={draftOptionId}
              previousAttempts={activityAttempts}
              disabled={isInteractionDisabled}
              nextActionLabelAr={nextActionLabelAr}
              onNextAction={handleNextAction}
              onDraftOptionChange={(optionId) =>
                onDraftOptionChange(activity.activityId, optionId)
              }
              onSubmitAttempt={(payload) =>
                onSubmitAttempt(activity.activityId, payload)
              }
            />
          );
        })}
      </section>
    </div>
  );
};

interface LevelCompletionBadgeScreenProps {
  readonly level: LearningLevelDefinition;
  readonly studentName: string | null;
  readonly levelSummary: LevelProgressSummary | undefined;
  readonly nextLevel: LearningLevelDefinition | null;
  readonly onProceedNextLevel: (nextLevelId: LevelId) => void;
  readonly onReturnToMap: () => void;
  readonly onOpenFinalResults: () => void;
}

export const LevelCompletionBadgeScreen: React.FC<
  LevelCompletionBadgeScreenProps
> = ({
  level,
  studentName,
  levelSummary,
  nextLevel,
  onProceedNextLevel,
  onReturnToMap,
  onOpenFinalResults,
}) => {
  const isEarned = levelSummary?.isCompleted ?? false;
  const maxPossible =
    levelSummary?.maxPossibleScore ??
    level.activities.reduce((acc, a) => acc + a.maxScore, 0);
  const achievedScore = levelSummary?.bestScoreEarned ?? 0;

  return (
    <div className="screen-container">
      <section
        className="surface-card badge-award-card"
        aria-labelledby="badge-award-heading"
        data-testid="level-completion-card"
      >
        <span className="status-chip status-chip--correct">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            {isEarned
              ? `مبارك${studentName ? ` يا ${studentName}` : ''}! أتممت المستوى ${level.order} بنجاح ✓`
              : `معاينة شارة المستوى ${level.order}`}
          </span>
        </span>

        <div className="badge-award-card__medal">
          <LevelBadgeIllustration
            order={level.order}
            earned={isEarned}
            size={120}
          />
        </div>

        <h1 id="badge-award-heading" className="screen-title">
          {level.badge.titleAr}
        </h1>
        <p className="screen-lead">
          {studentName
            ? `إنجاز رائع يا ${studentName}! ${level.badge.descriptionAr}`
            : level.badge.descriptionAr}
        </p>

        {/* Prominent Structured Reward & Score Summary Card */}
        <div
          className="reward-points-card reward-points-card--earned"
          data-testid="level-reward-summary-card"
        >
          <div className="reward-points-card__badge">
            <Award size={22} aria-hidden="true" />
            <div>
              <span className="reward-points-card__label">
                النقاط المكتسبة في {level.stationNameAr}
              </span>
              <strong className="reward-points-card__score">
                {achievedScore} / {maxPossible} نقطة
              </strong>
            </div>
          </div>
          <span className="reward-points-card__tier">
            {nextLevel
              ? `المستوى التالي متاح الآن: ${nextLevel.stationNameAr} ✓`
              : 'اكتملت جميع المستويات الستة — التقرير الختامي متاح الآن ✓'}
          </span>
        </div>

        <div className="badge-stats-row">
          <div className="stat-box">
            <span>اسم الطالب</span>
            <strong>{studentName ?? 'طالب الجلسة الحالية'}</strong>
          </div>
          <div className="stat-box">
            <span>المستوى والمحطة</span>
            <strong>
              المستوى {level.order}: {level.organNameAr}
            </strong>
          </div>
          <div className="stat-box">
            <span>الشارة العلمية</span>
            <strong>{level.badge.titleAr}</strong>
          </div>
          <div className="stat-box">
            <span>الأنشطة المكتملة</span>
            <strong>
              {levelSummary?.completedActivityIds.length ?? 0} /{' '}
              {level.activities.length}
            </strong>
          </div>
        </div>

        <div className="ds-callout ds-callout--hint">
          <Award size={20} aria-hidden="true" />
          <div>
            <strong>الخلاصة العلمية المكتسبة من هذا المستوى:</strong>
            <p>{level.badge.scientificTakeawayAr}</p>
          </div>
        </div>

        <div className="badge-award-card__actions">
          {nextLevel ? (
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={() => onProceedNextLevel(nextLevel.levelId)}
              data-testid="proceed-next-level-btn"
            >
              <span>الانتقال إلى {nextLevel.stationNameAr}</span>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onOpenFinalResults}
              data-testid="open-final-results-btn"
            >
              <Trophy size={18} aria-hidden="true" />
              <span>عرض النتيجة النهائية والمراجعة الشاملة للرحلة</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn--secondary btn--touch"
            onClick={onReturnToMap}
          >
            <Compass size={18} aria-hidden="true" />
            <span>العودة إلى خريطة المستويات الستة</span>
          </button>
        </div>
      </section>
    </div>
  );
};
