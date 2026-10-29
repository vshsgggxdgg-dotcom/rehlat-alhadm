import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Compass,
  FileCheck2,
  FlaskConical,
  Lock,
  Printer,
  RotateCcw,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { getCompletedActivityForTerminalReview } from '../../backend/answerKeyVault';
import type { CurriculumManifest } from '../../content/schema';
import type { ActivityId, ContentVersionId, LevelId } from '../../domain/ids';
import type {
  CompetitionLeaderboardResult,
  OverallJourneyStats,
} from '../../domain/rules';
import type {
  AppOperatingMode,
  LevelProgressSummary,
  StudentProgressState,
} from '../../domain/types';
import {
  LevelBadgeIllustration,
  StudentAvatarIllustration,
} from '../illustrations/TransparentIllustrations';

interface StudentDashboardScreenProps {
  readonly manifest: CurriculumManifest;
  readonly progressState: StudentProgressState | null;
  readonly levelsProgressMap: ReadonlyMap<LevelId, LevelProgressSummary>;
  readonly overallStats: OverallJourneyStats;
  readonly onOpenLevel: (levelId: LevelId) => void;
  readonly onOpenPracticeActivity: (
    levelId: LevelId,
    activityId: ActivityId
  ) => void;
  readonly onStartLevelReplay: (levelId: LevelId) => void;
  readonly onStartFullReplay: () => void;
  readonly onNavigateEntry: () => void;
  readonly onNavigateFinalResults: () => void;
}

export const StudentDashboardScreen: React.FC<StudentDashboardScreenProps> = ({
  manifest,
  progressState,
  levelsProgressMap,
  overallStats,
  onOpenLevel,
  onOpenPracticeActivity,
  onStartLevelReplay,
  onStartFullReplay,
  onNavigateEntry,
  onNavigateFinalResults,
}) => {
  const [confirmingFullReplay, setConfirmingFullReplay] =
    useState<boolean>(false);
  const [confirmingLevelReplayId, setConfirmingLevelReplayId] =
    useState<LevelId | null>(null);

  if (!progressState) {
    return (
      <div className="screen-container">
        <section className="surface-card" aria-labelledby="dash-empty-heading">
          <h1 id="dash-empty-heading" className="screen-title">
            لوحة متابعة الطالب
          </h1>
          <div className="empty-box" role="status" data-testid="dashboard-no-student-empty">
            <p>
              لا يوجد طالب نشط حالياً. لا يقوم التطبيق بعرض أي إحصاءات أو درجات
              مصطنعة. يرجى كتابة اسمك أولاً لعرض لوحة التقدم الحقيقية.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onNavigateEntry}
            >
              <UserCheck size={18} aria-hidden="true" />
              <span>الانتقال إلى شاشة دخول الطالب</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  const { student, attempts } = progressState;
  const scoredAttempts = attempts.filter((a) => !a.isPractice);

  const handleRequestFullReplay = () => {
    if (overallStats.hasUnfinishedScoredRunAnyLevel) {
      setConfirmingFullReplay(true);
      return;
    }
    onStartFullReplay();
  };

  const handleRequestLevelReplay = (
    levelId: LevelId,
    hasUnfinishedRun: boolean
  ) => {
    if (hasUnfinishedRun) {
      setConfirmingLevelReplayId(levelId);
      return;
    }
    onStartLevelReplay(levelId);
  };

  return (
    <div className="screen-container">
      {/* Student Profile & Summary Header */}
      <section className="surface-card" aria-labelledby="dashboard-heading">
        <div className="dashboard-profile-row">
          <div className="dashboard-profile-row__identity">
            <StudentAvatarIllustration
              avatarId={student.avatarId}
              size={72}
            />
            <div>
              <span className="status-chip status-chip--neutral">
                لوحة التقدم والإنجازات الفعلية
              </span>
              <h1 id="dashboard-heading" className="screen-title">
                لوحة متابعة {student.displayName}
              </h1>
              <p className="helper-text">
                إصدار المحتوى المعتمد: <code>{manifest.contentVersionId}</code>
              </p>
            </div>
          </div>

          <div className="header-actions-inline">
            {(overallStats.totalAttemptsCount > 0 ||
              overallStats.completedLevelsCount > 0) && (
              <button
                type="button"
                className="btn btn--secondary btn--touch"
                onClick={handleRequestFullReplay}
                data-testid="dashboard-full-replay-btn"
              >
                <RotateCcw size={17} aria-hidden="true" />
                <span>إعادة الرحلة الكاملة (مع حفظ أفضل نتائجك)</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onNavigateFinalResults}
            >
              <FileCheck2 size={18} aria-hidden="true" />
              <span>النتيجة النهائية والمراجعة العلمية</span>
            </button>
          </div>
        </div>

        {/* Confirm before discarding an unfinished scored run on Full Replay */}
        {confirmingFullReplay && (
          <div
            className="ds-callout ds-callout--warning"
            role="alertdialog"
            aria-labelledby="dash-confirm-full-replay-title"
            data-testid="dashboard-confirm-full-replay-dialog"
          >
            <AlertTriangle size={22} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong id="dash-confirm-full-replay-title">
                  تأكيد قبل استبدال جولة غير مكتملة
                </strong>
                <p>
                  لديك جولة حالية غير مكتملة في أحد المستويات. بدء رحلة جديدة
                  سيُصفّر محاولات الجولة الحالية غير المكتملة، بينما تظل أفضل
                  نتائج المستويات المكتملة سابقاً ({overallStats.bestCompletedTotalScore} /{' '}
                  {overallStats.totalMaxPossibleScore}) والشارات المكتسبة محفوظة
                  دائماً.
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
                  data-testid="dashboard-confirm-full-replay-yes"
                >
                  <span>تأكيد بدء رحلة جديدة</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={() => setConfirmingFullReplay(false)}
                  data-testid="dashboard-confirm-full-replay-cancel"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Metrics: Current Run Score, Best Completed Score, Completed Activities, Completed Levels & Earned Badges */}
        <div className="metrics-grid-4" data-testid="dashboard-primary-metrics">
          <div className="metric-card" data-testid="metric-current-run-score">
            <span>نقاط الجولة الحالية</span>
            <strong>
              {overallStats.currentRunTotalScore} /{' '}
              {overallStats.totalMaxPossibleScore}
            </strong>
          </div>
          <div className="metric-card" data-testid="metric-best-completed-score">
            <span>أفضل مجموع للمستويات المكتملة</span>
            <strong>
              {overallStats.bestCompletedTotalScore} /{' '}
              {overallStats.totalMaxPossibleScore}
            </strong>
          </div>
          <div className="metric-card" data-testid="metric-completed-activities">
            <span>الأنشطة المكتملة (الجولة الحالية)</span>
            <strong>
              {overallStats.completedActivitiesCount} /{' '}
              {overallStats.totalActivitiesCount}
            </strong>
          </div>
          <div className="metric-card" data-testid="metric-completed-levels-badges">
            <span>المستويات المكتملة والشارات</span>
            <strong>
              {overallStats.completedLevelsCount} /{' '}
              {overallStats.totalLevelsCount}
            </strong>
          </div>
        </div>
      </section>

      {/* Attempt Outcome Breakdown & Explicit Accuracy Calculations */}
      <section className="surface-card" aria-labelledby="analytics-breakdown-heading">
        <div className="section-header-inline">
          <Calculator size={20} aria-hidden="true" />
          <h2 id="analytics-breakdown-heading">
            تفصيل المحاولات ومعادلات الدقة المحسوبة
          </h2>
        </div>

        {!overallStats.hasSufficientActivityForAnalytics ? (
          <div
            className="empty-box"
            role="status"
            data-testid="dashboard-analytics-empty-state"
          >
            <p>
              <strong>لا توجد أنشطة مكتملة كافية بعد لعرض مؤشرات الدقة:</strong>{' '}
              أكمل نشاطاً واحداً على الأقل في جولتك الحالية لحساب معدلات الدقة
              وتوليد خطة المراجعة العلمية. لا يقوم النظام باختلاق أي تحليلات أو
              نسب تقديرية قبل توفر إجابات فعلية.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={() => onOpenLevel(manifest.levels[0].levelId)}
            >
              <span>البدء بحل أنشطة المستوى الأول</span>
            </button>
          </div>
        ) : (
          <>
            {/* Guard against unsupported mastery claims from limited answers */}
            {overallStats.completedActivitiesCount <
              overallStats.totalActivitiesCount && (
              <div
                className="ds-callout ds-callout--hint"
                role="note"
                data-testid="limited-answers-disclaimer"
              >
                <BookOpen size={18} aria-hidden="true" />
                <div>
                  <strong>تنبيه منهجي حول نطاق المؤشرات الحالية:</strong>
                  <p>
                    تعكس هذه الأرقام ما أُنجز حتى الآن فقط (
                    <strong>
                      {overallStats.completedActivitiesCount} من أصل{' '}
                      {overallStats.totalActivitiesCount} نشاطاً
                    </strong>
                    )، ولا تُعدّ حكماً شاملاً على إتقان المنهج الكامل إلا بعد
                    إتمام جميع المستويات الستة.
                  </p>
                </div>
              </div>
            )}

            {/* Separate Counts for Correct-First, Correct-Second, and Incorrect-After-Two */}
            <div
              className="metrics-grid-4"
              data-testid="attempt-breakdown-counts"
            >
              <div
                className="metric-card"
                data-testid="count-correct-first-attempt"
              >
                <span>صحيحة من المحاولة الأولى (نقاط كاملة)</span>
                <strong>{overallStats.correctFirstAttemptCount} نشاط</strong>
              </div>
              <div
                className="metric-card"
                data-testid="count-correct-second-attempt"
              >
                <span>صحيحة من المحاولة الثانية (نصف النقاط)</span>
                <strong>{overallStats.correctSecondAttemptCount} نشاط</strong>
              </div>
              <div
                className="metric-card"
                data-testid="count-incorrect-after-two"
              >
                <span>غير صحيحة بعد محاولتين (٠ نقاط)</span>
                <strong>
                  {overallStats.incorrectAfterTwoAttemptsCount} نشاط
                </strong>
              </div>
              <div
                className="metric-card"
                data-testid="accuracy-first-attempt-percent"
              >
                <span>دقة المحاولة الأولى (للأنشطة المكتملة)</span>
                <strong>{overallStats.firstAttemptAccuracyPercent ?? 0}%</strong>
              </div>
            </div>

            {/* Explicit Definitions of All Displayed Accuracy Calculations */}
            <div
              className="study-facts-panel"
              data-testid="explicit-accuracy-definitions"
            >
              <div className="info-card">
                <h3>تعريف معادلات الدقة المعروضة</h3>
                <ul>
                  <li>
                    <strong>
                      ١. دقة المحاولة الأولى (
                      {overallStats.firstAttemptAccuracyPercent ?? 0}%):
                    </strong>{' '}
                    = (عدد الأنشطة الصحيحة من المحاولة الأولى [
                    {overallStats.correctFirstAttemptCount}] ÷ إجمالي الأنشطة
                    المكتملة في الجولة [{overallStats.completedActivitiesCount}])
                    × ١٠٠.
                  </li>
                  <li>
                    <strong>
                      ٢. نسبة الوصول للحل الصحيح (
                      {overallStats.overallResolutionAccuracyPercent ?? 0}%):
                    </strong>{' '}
                    = ((الصحيحة من الأولى [
                    {overallStats.correctFirstAttemptCount}] + الصحيحة من الثانية [
                    {overallStats.correctSecondAttemptCount}]) ÷ إجمالي الأنشطة
                    المكتملة [{overallStats.completedActivitiesCount}]) × ١٠٠.
                  </li>
                  <li>
                    <strong>
                      ٣. نسبة تحصيل نقاط الجولة الحالية (
                      {overallStats.currentRunScoreRatioPercent}%):
                    </strong>{' '}
                    = (مجموع نقاط الجولة الحالية [
                    {overallStats.currentRunTotalScore}] ÷ المجموع الكلي للمنهج [
                    {overallStats.totalMaxPossibleScore}]) × ١٠٠.
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Personalized Review Plan from Activity-to-Topic Mappings & Actual Mistakes / 2nd-Attempt Answers */}
      <section className="surface-card" aria-labelledby="review-plan-heading">
        <div className="section-header-inline">
          <FlaskConical size={20} aria-hidden="true" />
          <h2 id="review-plan-heading">
            خطة المراجعة العلمية المخصصة (حسب أخطائك الفعليّة ومحاولاتك الثانية)
          </h2>
        </div>

        {!overallStats.hasSufficientActivityForAnalytics ? (
          <div className="empty-box" data-testid="review-plan-empty-before-activity">
            ستظهر خطة المراجعة المخصصة هنا تلقائياً فور إكمال الأنشطة، بناءً على
            أي إجابة غير صحيحة بعد محاولتين أو إجابة تطلّبت محاولة ثانية.
          </div>
        ) : overallStats.reviewPlan.length === 0 ? (
          <div className="empty-box" data-testid="review-plan-no-mistakes">
            جميع الأنشطة المكتملة في جولتك الحالية ({overallStats.completedActivitiesCount})
            أُجيب عنها بشكل صحيح من المحاولة الأولى! يمكنك فتح أي مستوى في وضع
            التدريب الحر للمراجعة الإضافية في أي وقت.
          </div>
        ) : (
          <div className="review-activities-list" data-testid="review-plan-list">
            {overallStats.reviewPlan.map((rec) => (
              <article
                key={rec.activityId}
                className="review-activity-item"
                data-testid={`review-plan-item-${rec.activityId}`}
              >
                <div className="review-activity-item__top">
                  <div>
                    <span className="status-chip status-chip--neutral">
                      {rec.levelTitleAr} • {rec.activityTitleAr}
                    </span>
                    <h3 className="activity-card__title" style={{ marginTop: '0.35rem' }}>
                      الموضوع العلمي: {rec.topicTitleAr}
                    </h3>
                  </div>

                  <span
                    className={`status-chip ${
                      rec.reasonKind === 'incorrect_after_two_attempts'
                        ? 'status-chip--incorrect'
                        : 'status-chip--selected'
                    }`}
                  >
                    {rec.reasonKind === 'incorrect_after_two_attempts' ? (
                      <XCircle size={15} aria-hidden="true" />
                    ) : (
                      <CircleDot size={15} aria-hidden="true" />
                    )}
                    <span>{rec.reasonLabelAr}</span>
                  </span>
                </div>

                <div className="review-answer-box review-answer-box--model">
                  <strong>الشرح العلمي المعتمد للمراجعة:</strong>
                  <p>{rec.approvedExplanationAr}</p>
                </div>

                <div className="header-actions-inline" style={{ marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--touch"
                    onClick={() =>
                      onOpenPracticeActivity(rec.levelId, rec.activityId)
                    }
                    data-testid={`review-practice-link-${rec.activityId}`}
                  >
                    <FlaskConical size={17} aria-hidden="true" />
                    <span>تدرّب على هذا النشاط في وضع التدريب الحر ←</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Earned Badges Showcase */}
      <section className="surface-card" aria-labelledby="badges-showcase-heading">
        <div className="section-header-inline">
          <Award size={20} aria-hidden="true" />
          <h2 id="badges-showcase-heading">
            شارات {student.displayName} في المستويات الستة
          </h2>
        </div>

        <div className="badges-showcase-grid">
          {manifest.levels.map((lvl) => {
            const summary = levelsProgressMap.get(lvl.levelId);
            const earned = summary?.isCompleted ?? false;
            return (
              <div
                key={lvl.badge.badgeId}
                className={`badge-showcase-item ${
                  earned
                    ? 'badge-showcase-item--earned'
                    : 'badge-showcase-item--locked'
                }`}
              >
                <LevelBadgeIllustration
                  order={lvl.order}
                  earned={earned}
                  size={64}
                />
                <strong>{lvl.badge.titleAr}</strong>
                <span
                  className={`status-chip ${
                    earned ? 'status-chip--correct' : 'status-chip--locked'
                  }`}
                >
                  {earned ? '✓ مكتسبة' : '■ قيد الإنجاز'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Level-by-Level Breakdown with Level Replay */}
      <section className="surface-card" aria-labelledby="levels-breakdown-heading">
        <div className="section-header-inline">
          <Compass size={20} aria-hidden="true" />
          <h2 id="levels-breakdown-heading">
            تفاصيل التقدم وإعادة اللعب للمستويات الستة
          </h2>
        </div>

        {confirmingLevelReplayId && (
          <div
            className="ds-callout ds-callout--warning"
            role="alertdialog"
            data-testid="dashboard-confirm-level-replay-dialog"
          >
            <AlertTriangle size={20} aria-hidden="true" />
            <div className="ds-callout__flex-body">
              <div>
                <strong>تأكيد قبل استبدال جولة المستوى غير المكتملة</strong>
                <p>
                  لديك محاولات غير مكتملة في الجولة الحالية لهذا المستوى. هل
                  تريد بدء جولة جديدة للمستوى؟ (تظل أفضل نتيجة مكتملة سابقة محفوظة).
                </p>
              </div>
              <div className="header-actions-inline">
                <button
                  type="button"
                  className="btn btn--primary btn--touch"
                  onClick={() => {
                    const targetId = confirmingLevelReplayId;
                    setConfirmingLevelReplayId(null);
                    onStartLevelReplay(targetId);
                  }}
                  data-testid="dashboard-confirm-level-replay-yes"
                >
                  <span>تأكيد إعادة المستوى</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={() => setConfirmingLevelReplayId(null)}
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="table-responsive">
          <table className="ds-table">
            <thead>
              <tr>
                <th>المستوى</th>
                <th>الحالة</th>
                <th>أنشطة الجولة الحالية</th>
                <th>نقاط الجولة الحالية</th>
                <th>أفضل نتيجة مكتملة</th>
                <th>إجراءات المستوى</th>
              </tr>
            </thead>
            <tbody>
              {manifest.levels.map((lvl) => {
                const summary = levelsProgressMap.get(lvl.levelId);
                const isCompleted = summary?.isCompleted ?? false;
                const isUnlocked = summary?.isUnlocked ?? lvl.order === 1;
                const hasUnfinished = summary?.hasUnfinishedCurrentRun ?? false;
                const canReplay =
                  isUnlocked &&
                  ((summary?.currentRunAttemptsCount ?? 0) > 0 || isCompleted);

                return (
                  <tr key={lvl.levelId}>
                    <td>
                      <strong>{lvl.stationNameAr}</strong>
                    </td>
                    <td>
                      {isCompleted ? (
                        <span className="status-chip status-chip--correct">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          <span>مكتمل ✓</span>
                        </span>
                      ) : isUnlocked ? (
                        <span className="status-chip status-chip--selected">
                          <CircleDot size={15} aria-hidden="true" />
                          <span>مفتوح ◆</span>
                        </span>
                      ) : (
                        <span className="status-chip status-chip--locked">
                          <Lock size={15} aria-hidden="true" />
                          <span>مقفل ■</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {summary?.completedActivityIds.length ?? 0} /{' '}
                      {lvl.activities.length}
                    </td>
                    <td>
                      {summary?.currentRunScoreEarned ?? 0} /{' '}
                      {summary?.maxPossibleScore ?? 20}
                    </td>
                    <td>
                      {summary?.bestCompletedScoreEarned !== null &&
                      summary?.bestCompletedScoreEarned !== undefined
                        ? `${summary.bestCompletedScoreEarned} / ${summary.maxPossibleScore}`
                        : '—'}
                    </td>
                    <td>
                      <div className="header-actions-inline">
                        <button
                          type="button"
                          className="btn btn--secondary btn--touch"
                          onClick={() => onOpenLevel(lvl.levelId)}
                        >
                          <span>فتح المستوى</span>
                        </button>
                        {canReplay && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--touch"
                            onClick={() =>
                              handleRequestLevelReplay(
                                lvl.levelId,
                                hasUnfinished
                              )
                            }
                            data-testid={`dashboard-replay-${lvl.levelId}`}
                          >
                            <RotateCcw size={15} aria-hidden="true" />
                            <span>إعادة الجولة</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Real Attempts History */}
      <section className="surface-card" aria-labelledby="attempts-history-heading">
        <div className="section-header-inline">
          <Clock size={20} aria-hidden="true" />
          <h2 id="attempts-history-heading">
            سجل المحاولات المحسوبة لـ {student.displayName} ({scoredAttempts.length})
          </h2>
        </div>

        {scoredAttempts.length === 0 ? (
          <div className="empty-box">
            لم يتم تسجيل أي محاولات محسوبة بعد. ابدأ بحل أنشطة المستوى الأول!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>رقم المحاولة</th>
                  <th>النشاط</th>
                  <th>النتيجة والنقاط</th>
                  <th>المدة</th>
                  <th>التوقيت</th>
                </tr>
              </thead>
              <tbody>
                {[...scoredAttempts].reverse().slice(0, 15).map((att) => (
                  <tr key={att.attemptId}>
                    <td>المحاولة {att.attemptNumber ?? 1}</td>
                    <td>
                      <code>{att.activityId}</code>
                    </td>
                    <td>
                      {att.isCorrect ? (
                        <span className="status-chip status-chip--correct">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          <span>
                            صحيحة (+{att.scoreEarned}/{att.maxScore})
                          </span>
                        </span>
                      ) : (
                        <span className="status-chip status-chip--incorrect">
                          <XCircle size={15} aria-hidden="true" />
                          <span>غير صحيحة (0/{att.maxScore})</span>
                        </span>
                      )}
                    </td>
                    <td>{(att.durationMs / 1000).toFixed(1)} ث</td>
                    <td>
                      {new Date(att.submittedAtIso).toLocaleTimeString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

interface LeaderboardScreenProps {
  readonly mode: AppOperatingMode;
  readonly storageNamespace: string;
  readonly leaderboardData: CompetitionLeaderboardResult;
  readonly activeStudentId: string | null;
  readonly onSelectContentVersion: (versionId: ContentVersionId) => void;
  readonly onNavigateEntry: () => void;
}

const LEADERBOARD_PAGE_SIZE = 10;

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  mode,
  storageNamespace,
  leaderboardData,
  activeStudentId,
  onSelectContentVersion,
  onNavigateEntry,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);

  const {
    contentVersionId,
    availableContentVersions,
    eligibleEntries,
    topTenRanksIncludingTies,
    currentStudentEligibility,
  } = leaderboardData;

  const totalPages = Math.max(
    1,
    Math.ceil(eligibleEntries.length / LEADERBOARD_PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * LEADERBOARD_PAGE_SIZE;
  const paginatedEntries = eligibleEntries.slice(
    startIndex,
    startIndex + LEADERBOARD_PAGE_SIZE
  );

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="leaderboard-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--neutral">
              لوحة المتصدرين التنافسية • حسب إصدار المحتوى المعتمد
            </span>
            <h1 id="leaderboard-heading" className="screen-title">
              ترتيب المتصدرين لرحلة الهضم
            </h1>
            <p className="screen-lead">
              النقاط المعتمدة = مجموع أفضل نتيجة مكتملة لكل طالب في المستويات
              الستة جميعها ضمن نفس إصدار المحتوى. يتأهل الطالب للظهور في الترتيب
              بعد إكمال المستويات الستة جميعها مرة واحدة على الأقل.
            </p>
          </div>

          {/* Content Version Separation Selector */}
          <div className="form-field" style={{ minWidth: '240px', marginBottom: 0 }}>
            <label htmlFor="leaderboard-version-select" className="form-label">
              إصدار المحتوى المعتمد:
            </label>
            <select
              id="leaderboard-version-select"
              className="form-input"
              value={contentVersionId}
              onChange={(e) => {
                setCurrentPage(1);
                onSelectContentVersion(e.target.value as ContentVersionId);
              }}
              data-testid="leaderboard-version-select"
            >
              {availableContentVersions.map((ver) => (
                <option key={ver} value={ver}>
                  {ver}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Student's Rank & Eligibility Card */}
        {currentStudentEligibility && (
          <div
            className={`reward-points-card ${
              currentStudentEligibility.isEligible
                ? 'reward-points-card--earned'
                : 'reward-points-card--zero'
            }`}
            data-testid="current-student-leaderboard-status"
          >
            <div className="reward-points-card__badge">
              <Trophy size={22} aria-hidden="true" />
              <div>
                <span className="reward-points-card__label">
                  مرتبتك وأهليتك في الإصدار ({contentVersionId})
                </span>
                <strong className="reward-points-card__score">
                  {currentStudentEligibility.isEligible
                    ? `المرتبة #${currentStudentEligibility.rank} • مجموع أفضل نتائجك المكتملة: ${currentStudentEligibility.bestCompletedTotalScore} / ${currentStudentEligibility.totalMaxScore}`
                    : `قيد التأهل: أكملت ${currentStudentEligibility.completedLevelsCount} من ${currentStudentEligibility.totalLevelsCount} مستويات`}
                </strong>
              </div>
            </div>
            <span className="reward-points-card__tier">
              {currentStudentEligibility.isEligible
                ? 'مؤهل في الترتيب الرسمي ✓ (النتائج الأقل في الإعادة لا تستبدل نتيجتك الأعلى)'
                : 'أكمل جميع المستويات الستة لدخول الترتيب الرسمي ◆'}
            </span>
          </div>
        )}

        {mode === 'production' && (
          <div className="ds-callout ds-callout--hint" role="note">
            <Trophy size={18} aria-hidden="true" />
            <div>
              <strong>ضمان نزاهة بيانات الإنتاج وخصوصية الطلاب:</strong>
              <p>
                تُعرض فقط حقول الهوية العامة الضرورية (المرتبة، الشخصية الرمزية،
                الاسم، ومجموع أفضل النقاط المكتملة) دون كشف معرّفات المصادقة أو
                تفاصيل المحاولات الخاصة، ودون أي أسماء أو درجات افتراضية.
              </p>
            </div>
          </div>
        )}

        {eligibleEntries.length === 0 ? (
          <div
            className="empty-box"
            role="status"
            data-testid="leaderboard-empty-state"
          >
            <p>
              لا يوجد طلاب مؤهلون أكملوا جميع المستويات الستة بعد في إصدار
              المحتوى (<code>{contentVersionId}</code>) ضمن المساحة (
              <code>{storageNamespace}</code>).
            </p>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onNavigateEntry}
            >
              <span>ابدأ رحلتك وأكمل المستويات الستة</span>
            </button>
          </div>
        ) : (
          <>
            {/* Section 1: First 10 Ranks Including Ties */}
            <div
              className="a11y-section"
              data-testid="leaderboard-top-ten-section"
            >
              <div className="section-header-inline">
                <Award size={20} aria-hidden="true" />
                <h2>
                  قائمة العشرة الأوائل (أول ١٠ مراتب تنافسية شاملة التعادل •{' '}
                  {topTenRanksIncludingTies.length})
                </h2>
              </div>

              <div className="table-responsive">
                <table
                  className="ds-table"
                  data-testid="leaderboard-top-ten-table"
                >
                  <thead>
                    <tr>
                      <th>المرتبة التنافسية</th>
                      <th>الطالب</th>
                      <th>مجموع أفضل النقاط المكتملة (٦ مستويات)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTenRanksIncludingTies.map((entry) => {
                      const isCurrentStudent =
                        entry.studentId === activeStudentId;
                      return (
                        <tr
                          key={`top10-${entry.studentId}`}
                          className={
                            isCurrentStudent ? 'leaderboard-row--current' : ''
                          }
                          data-testid={`top10-row-rank-${entry.rank}`}
                        >
                          <td>
                            <span
                              className="rank-pill"
                              data-testid="competition-rank-pill"
                            >
                              #{entry.rank}
                            </span>
                          </td>
                          <td>
                            <div className="leaderboard-student-cell">
                              <StudentAvatarIllustration
                                avatarId={entry.avatarId}
                                size={44}
                              />
                              <div>
                                <strong>{entry.displayName}</strong>
                                {isCurrentStudent && (
                                  <span className="status-chip status-chip--selected">
                                    أنت ◆
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>
                              {entry.totalScoreEarned} / {entry.totalMaxScore}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Paginated Full List */}
            <div
              className="a11y-section"
              data-testid="leaderboard-paginated-section"
            >
              <div className="screen-header-row">
                <div className="section-header-inline">
                  <Trophy size={20} aria-hidden="true" />
                  <h2>
                    القائمة الكاملة للطلاب المؤهلين ({eligibleEntries.length})
                  </h2>
                </div>

                <div
                  className="header-actions-inline"
                  role="navigation"
                  aria-label="صفحات قائمة المتصدرين الكاملة"
                  data-testid="leaderboard-pagination-controls"
                >
                  <button
                    type="button"
                    className="btn btn--secondary btn--touch"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    data-testid="leaderboard-prev-page-btn"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                    <span>الصفحة السابقة</span>
                  </button>
                  <span
                    className="status-chip status-chip--neutral"
                    data-testid="leaderboard-page-indicator"
                  >
                    الصفحة {safePage} من {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--touch"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    data-testid="leaderboard-next-page-btn"
                  >
                    <span>الصفحة التالية</span>
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table
                  className="ds-table"
                  data-testid="leaderboard-paginated-table"
                >
                  <thead>
                    <tr>
                      <th>المرتبة</th>
                      <th>الطالب</th>
                      <th>مجموع أفضل النقاط المكتملة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry) => {
                      const isCurrentStudent =
                        entry.studentId === activeStudentId;
                      return (
                        <tr
                          key={`full-${entry.studentId}`}
                          className={
                            isCurrentStudent ? 'leaderboard-row--current' : ''
                          }
                        >
                          <td>
                            <span className="rank-pill">#{entry.rank}</span>
                          </td>
                          <td>
                            <div className="leaderboard-student-cell">
                              <StudentAvatarIllustration
                                avatarId={entry.avatarId}
                                size={40}
                              />
                              <div>
                                <strong>{entry.displayName}</strong>
                                {isCurrentStudent && (
                                  <span className="status-chip status-chip--selected">
                                    أنت ◆
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>
                              {entry.totalScoreEarned} / {entry.totalMaxScore}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

interface FinalResultsAndReviewScreenProps {
  readonly manifest: CurriculumManifest;
  readonly progressState: StudentProgressState | null;
  readonly levelsProgressMap: ReadonlyMap<LevelId, LevelProgressSummary>;
  readonly overallStats: OverallJourneyStats;
  readonly onOpenLevelActivity: (levelId: LevelId) => void;
  readonly onReturnToMap: () => void;
}

export const FinalResultsAndReviewScreen: React.FC<
  FinalResultsAndReviewScreenProps
> = ({
  manifest,
  progressState,
  levelsProgressMap,
  overallStats,
  onOpenLevelActivity,
  onReturnToMap,
}) => {
  const attempts = progressState?.attempts ?? [];
  const studentName = progressState?.student.displayName ?? null;

  const handlePrintReport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="final-results-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--neutral">
              التقرير الختامي والمراجعة العلمية الشاملة
            </span>
            <h1 id="final-results-heading" className="screen-title">
              {studentName
                ? `النتيجة النهائية ومراجعة إجاباتك يا ${studentName}`
                : 'النتيجة النهائية ومراجعة إجابات «رحلة الهضم»'}
            </h1>
            <p className="screen-lead">
              {progressState
                ? `ملخص النقاط والشارات والمراجعة العلمية الكاملة للطالب: ${progressState.student.displayName}`
                : 'مراجعة شاملة لجميع أنشطة المستويات الستة والتفسيرات العلمية المعتمدة.'}
            </p>
          </div>

          <div className="header-actions-inline">
            <button
              type="button"
              className="btn btn--secondary btn--touch"
              onClick={handlePrintReport}
            >
              <Printer size={18} aria-hidden="true" />
              <span>طباعة التقرير العلمي</span>
            </button>
            <button
              type="button"
              className="btn btn--primary btn--touch"
              onClick={onReturnToMap}
            >
              <Compass size={18} aria-hidden="true" />
              <span>خريطة المستويات الستة</span>
            </button>
          </div>
        </div>

        <div className="metrics-grid-4" data-testid="final-results-summary-grid">
          <div className="metric-card">
            <span>أفضل مجموع للنقاط</span>
            <strong>
              {overallStats.totalBestScoreEarned} /{' '}
              {overallStats.totalMaxPossibleScore}
            </strong>
          </div>
          <div className="metric-card">
            <span>الشارات المكتسبة</span>
            <strong>
              {overallStats.completedLevelsCount} /{' '}
              {overallStats.totalLevelsCount}
            </strong>
          </div>
          <div className="metric-card">
            <span>الأنشطة المكتملة (الجولة الحالية)</span>
            <strong>
              {overallStats.completedActivitiesCount} /{' '}
              {overallStats.totalActivitiesCount}
            </strong>
          </div>
          <div className="metric-card">
            <span>نقاط الجولة الحالية</span>
            <strong>
              {overallStats.currentRunTotalScore} /{' '}
              {overallStats.totalMaxPossibleScore}
            </strong>
          </div>
        </div>

        {/* Summary of Earned Badges */}
        <div
          className="badges-showcase-grid"
          aria-label="ملخص شارات المستويات الستة"
        >
          {manifest.levels.map((lvl) => {
            const summary = levelsProgressMap.get(lvl.levelId);
            const earned = summary?.isCompleted ?? false;
            return (
              <div
                key={lvl.badge.badgeId}
                className={`badge-showcase-item ${
                  earned
                    ? 'badge-showcase-item--earned'
                    : 'badge-showcase-item--locked'
                }`}
              >
                <LevelBadgeIllustration
                  order={lvl.order}
                  earned={earned}
                  size={54}
                />
                <strong>{lvl.badge.titleAr}</strong>
                <span
                  className={`status-chip ${
                    earned ? 'status-chip--correct' : 'status-chip--locked'
                  }`}
                >
                  {earned
                    ? `✓ مكتسبة (${summary?.bestScoreEarned ?? 0}/${
                        summary?.maxPossibleScore ?? 0
                      })`
                    : '■ غير مكتملة'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Complete Level & Activity Review */}
      {manifest.levels.map((level) => {
        const summary = levelsProgressMap.get(level.levelId);
        const activeRunId = summary?.activeRunId ?? 'run-initial';
        return (
          <section
            key={level.levelId}
            className="surface-card review-level-block"
            aria-labelledby={`review-lvl-${level.levelId}`}
          >
            <div className="review-level-block__header">
              <div className="review-level-block__title">
                <LevelBadgeIllustration
                  order={level.order}
                  earned={summary?.isCompleted ?? false}
                  size={52}
                />
                <div>
                  <h2 id={`review-lvl-${level.levelId}`}>
                    {level.stationNameAr}
                  </h2>
                  <p className="helper-text">
                    {level.badge.scientificTakeawayAr}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn--secondary btn--touch"
                onClick={() => onOpenLevelActivity(level.levelId)}
              >
                <span>مراجعة المحطة</span>
              </button>
            </div>

            <div className="review-activities-list">
              {level.activities.map((rawActivity) => {
                const activityAttempts = attempts.filter(
                  (a) =>
                    !a.isPractice &&
                    a.activityId === rawActivity.activityId &&
                    (a.runId ?? 'run-initial') === activeRunId
                );
                const isActivityCompleted =
                  activityAttempts.some((a) => a.isCorrect) ||
                  activityAttempts.length >= 2;
                const activity = getCompletedActivityForTerminalReview(
                  manifest.contentVersionId,
                  rawActivity,
                  isActivityCompleted
                );
                const latestAttempt =
                  activityAttempts.length > 0
                    ? activityAttempts[activityAttempts.length - 1]
                    : null;
                const bestScore =
                  activityAttempts.length > 0
                    ? Math.max(...activityAttempts.map((a) => a.scoreEarned))
                    : 0;
                const selectedOption =
                  isActivityCompleted && latestAttempt
                    ? activity.options.find(
                        (o) => o.optionId === latestAttempt.selectedOptionId
                      )
                    : null;
                const correctOption = isActivityCompleted
                  ? activity.options.find(
                      (o) => o.optionId === activity.correctOptionId
                    )
                  : null;

                return (
                  <article
                    key={activity.activityId}
                    className="review-activity-item"
                  >
                    <div className="review-activity-item__top">
                      <strong>{activity.titleAr}</strong>
                      {isActivityCompleted && latestAttempt ? (
                        latestAttempt.isCorrect ? (
                          <span className="status-chip status-chip--correct">
                            <CheckCircle2 size={16} aria-hidden="true" />
                            <span>
                              إجابة صحيحة ✓ ({bestScore}/{activity.maxScore})
                            </span>
                          </span>
                        ) : (
                          <span className="status-chip status-chip--incorrect">
                            <XCircle size={16} aria-hidden="true" />
                            <span>
                              إجابة غير صحيحة ✕ (0/{activity.maxScore})
                            </span>
                          </span>
                        )
                      ) : activityAttempts.length === 1 ? (
                        <span className="status-chip status-chip--selected">
                          <span>باقي محاولة واحدة ◆ (يُكشف الحل بعد إتمام النشاط)</span>
                        </span>
                      ) : (
                        <span className="status-chip status-chip--locked">
                          <span>لم تتم الإجابة بعد ○ (الحل محمي حتى إتمام النشاط)</span>
                        </span>
                      )}
                    </div>

                    <p className="review-activity-item__prompt">
                      {activity.promptAr}
                    </p>

                    {isActivityCompleted && selectedOption && (
                      <div
                        className={`review-answer-box ${
                          latestAttempt?.isCorrect
                            ? 'review-answer-box--correct'
                            : 'review-answer-box--incorrect'
                        }`}
                      >
                        <strong>إجابتك المسجلة:</strong> {selectedOption.labelAr}
                        <p>{selectedOption.feedbackAr}</p>
                      </div>
                    )}

                    {isActivityCompleted &&
                      !latestAttempt?.isCorrect &&
                      correctOption && (
                        <div className="review-answer-box review-answer-box--model">
                          <strong>الإجابة العلمية الصحيحة:</strong>{' '}
                          {correctOption.labelAr}
                          <p>{correctOption.feedbackAr}</p>
                        </div>
                      )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
