import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Compass,
  BookOpen,
  LayoutDashboard,
  Trophy,
  Settings,
  Volume2,
  VolumeX,
  Lock,
  Check,
} from "lucide-react";
import {
  ActivityRendererRegistry,
  type ActivitySubmissionPayload,
} from "./activities/ActivityRendererRegistry";
import {
  cloud,
  loadManifest,
  loadProgress,
  rpc,
  startStudent,
} from "./backend/cloud";
import { DIGESTION_CURRICULUM_MANIFEST } from "./content/digestionManifest";
import type {
  AvatarId,
  StudentProgressState,
  ActivityAttempt,
} from "./domain/types";
import {
  computeAllLevelsProgress,
  computeOverallJourneyStats,
  isActivityFinished,
} from "./domain/rules";
import {
  AVATAR_OPTIONS,
  StudentAvatarIllustration,
  StationIllustration,
  LevelBadgeIllustration,
} from "./ui/illustrations/TransparentIllustrations";
import { FiveCardInstructionsScreen } from "./ui/screens/EntryAndInstructionsScreens";
import {
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  applyAccessibilityToDocument,
} from "./persistence/accessibilityStorage";
import { soundEffects } from "./audio/soundEffects";
const Admin = React.lazy(() =>
  import("./ui/Admin").then((m) => ({ default: m.Admin })),
);
import "./styles/production.css";
type Screen =
  | "entry"
  | "instructions"
  | "map"
  | "activity"
  | "complete"
  | "dashboard"
  | "final"
  | "leaderboard"
  | "about"
  | "settings"
  | "admin";
type Leader = {
  rank: number;
  studentId: string;
  displayName: string;
  avatarId: AvatarId;
  totalScoreEarned: number;
};
const fmt = (n: number | null) => (n ?? 0).toLocaleString("ar-EG");
export function ProductionApp() {
  const [manifest, setManifest] = useState(DIGESTION_CURRICULUM_MANIFEST),
    [state, setState] = useState<StudentProgressState | null>(null),
    [screen, setScreen] = useState<Screen>(
      location.pathname === "/admin" ? "admin" : "entry",
    );
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [avatar, setAvatar] = useState<AvatarId>("girl-noor");
  const [li, setLi] = useState(0),
    [ai, setAi] = useState(0),
    [practice, setPractice] = useState(false),
    [practiceAttempts, setPracticeAttempts] = useState<ActivityAttempt[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("rehlat-drafts") ?? "{}");
    } catch {
      return {};
    }
  });
  const [settings, setSettings] = useState(loadAccessibilitySettings),
    [leaders, setLeaders] = useState<Leader[]>([]),
    [page, setPage] = useState(0),
    [returnTo, setReturnTo] = useState<Screen>("map");
  const [confirm, setConfirm] = useState<"level" | "full" | null>(null);
  const progress = useMemo(
      () => computeAllLevelsProgress(manifest, state),
      [manifest, state],
    ),
    stats = useMemo(
      () => computeOverallJourneyStats(manifest, state),
      [manifest, state],
    );
  const level = manifest.levels[li],
    activity = level.activities[ai],
    summary = progress.get(level.levelId),
    run = state?.activeRunIdByLevelId?.[level.levelId];
  const draftKey = `${state?.student.studentId}:${manifest.contentVersionId}:${practice ? "practice" : run}:${activity.activityId}`;
  const attempts = (
    practice ? practiceAttempts : (state?.attempts ?? [])
  ).filter(
    (a) =>
      a.activityId === activity.activityId && (practice || a.runId === run),
  );
  function go(s: Screen) {
    setError("");
    setScreen(s);
    window.scrollTo({
      top: 0,
      behavior: settings.reducedMotion ? "auto" : "smooth",
    });
  }
  async function refresh() {
    const s = await loadProgress();
    if (s) {
      setState(s);
      setName(s.student.displayName);
      setAvatar(s.student.avatarId);
    }
    return s;
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!cloud) throw Error();
        const s = await loadProgress(),
          m = await loadManifest(s?.lastContentVersionId);
        if (!live) return;
        setManifest(m);
        setState(s);
        if (s) {
          setName(s.student.displayName);
          setAvatar(s.student.avatarId);
          if (location.pathname !== "/admin") setScreen("map");
        }
      } catch {
        if (live) setError("تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    applyAccessibilityToDocument(settings);
    saveAccessibilitySettings(settings);
  }, [settings]);
  useEffect(() => {
    if (!state) return;
    const sync = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [state?.student.studentId]);
  useEffect(() => {
    if (screen !== "leaderboard") return;
    let live = true;
    setLoading(true);
    rpc("rpc_get_competition_leaderboard", {
      p_content_version_id: manifest.contentVersionId,
    })
      .then((d) => {
        if (live) setLeaders(d.eligibleEntries ?? []);
      })
      .catch(() => {
        if (live) setError("تعذّر تحميل الترتيب.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [screen, manifest.contentVersionId]);
  function draft(value: string) {
    const d = { ...drafts, [draftKey]: value };
    setDrafts(d);
    if (!practice) localStorage.setItem("rehlat-drafts", JSON.stringify(d));
  }
  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const s = await startStudent(
        name.trim(),
        avatar,
        manifest.contentVersionId,
      );
      if (!s) throw Error();
      setState(s);
      setReturnTo("map");
      go("instructions");
    } catch {
      setError("تعذّر بدء الرحلة. حاول مرة أخرى أو اطلب مساعدة مسؤول الموقع.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(p: ActivitySubmissionPayload) {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    const pk = `pending:${draftKey}:${attempts.length + 1}`;
    try {
      if (practice) {
        const d = await rpc("rpc_practice_activity", {
          p_content_version_id: manifest.contentVersionId,
          p_activity_id: activity.activityId,
          p_answer: p.selectedOptionId,
          p_attempt_number: attempts.length + 1,
        });
        setPracticeAttempts((prev) => [
          ...prev,
          {
            ...d,
            attemptId: crypto.randomUUID(),
            studentId: state.student.studentId,
            contentVersionId: manifest.contentVersionId,
            levelId: level.levelId,
            activityId: activity.activityId,
            selectedOptionId: p.selectedOptionId,
            isPractice: true,
            runId: "practice",
            scoreEarned: 0,
            maxScore: activity.maxScore,
            durationMs: p.durationMs,
            submittedAtIso: new Date().toISOString(),
            syncedToBackend: false,
          } as ActivityAttempt,
        ]);
        soundEffects.play(d.isCorrect ? "success" : "retry");
        return;
      }
      if (!run) throw Error();
      const saved = localStorage.getItem(pk);
      const args = saved
        ? JSON.parse(saved)
        : {
            p_run_id: run,
            p_content_version_id: manifest.contentVersionId,
            p_level_id: level.levelId,
            p_activity_id: activity.activityId,
            p_submitted_answer: p.selectedOptionId,
            p_duration_ms: p.durationMs,
            p_idempotency_key: crypto.randomUUID(),
          };
      localStorage.setItem(pk, JSON.stringify(args));
      const d = await rpc("rpc_submit_activity_attempt", args);
      await refresh();
      localStorage.removeItem(pk);
      soundEffects.play(d.isCorrect ? "success" : "retry");
    } catch {
      await refresh().catch(() => {});
      setError(
        "تعذّر تأكيد الحفظ. إجابتك محفوظة؛ اضغط التأكيد لإعادة المحاولة.",
      );
      throw Error("Submission failed");
    } finally {
      setBusy(false);
    }
  }
  function open(index: number, training = false, at?: number) {
    const l = manifest.levels[index],
      r = state?.activeRunIdByLevelId?.[l.levelId];
    const first = l.activities.findIndex(
      (a) =>
        !isActivityFinished(
          state?.attempts.filter(
            (t) => t.runId === r && t.activityId === a.activityId,
          ) ?? [],
        ),
    );
    setLi(index);
    setAi(at ?? (training ? 0 : Math.max(0, first)));
    setPractice(training);
    setPracticeAttempts([]);
    go("activity");
  }
  async function replay(kind: "level" | "full", confirmed = false) {
    setBusy(true);
    try {
      await rpc(
        kind === "level" ? "rpc_start_level_replay" : "rpc_start_full_replay",
        {
          p_content_version_id: manifest.contentVersionId,
          ...(kind === "level" ? { p_level_id: level.levelId } : {}),
          p_confirm_discard_unfinished: confirmed,
        },
      );
      await refresh();
      setConfirm(null);
      setAi(0);
      setPractice(false);
      go(kind === "full" ? "map" : "activity");
    } catch (e) {
      if (
        String((e as { message?: string }).message).includes(
          "CONFIRMATION_REQUIRED",
        )
      )
        setConfirm(kind);
      else setError("تعذّر بدء جولة جديدة.");
    } finally {
      setBusy(false);
    }
  }
  const nav = [
    { id: "map", label: "المستويات", Icon: Compass },
    { id: "dashboard", label: "لوحتي", Icon: LayoutDashboard },
    { id: "leaderboard", label: "المتصدرون", Icon: Trophy },
    { id: "instructions", label: "المساعدة", Icon: BookOpen },
  ] as const;
  return (
    <div className="journey-app" dir="rtl">
      <a className="skip-link" href="#content">
        تخطّي للمحتوى
      </a>
      <header className="journey-header">
        <button
          className="journey-brand"
          onClick={() => go(state ? "map" : "entry")}
        >
          <img src="/assets/3d/anatomy.webp" alt="" />
          <span>
            رحلة الهضم<small>مغامرة صغيرة.. اكتشاف كبير</small>
          </span>
        </button>
        {state && (
          <nav aria-label="التنقل الرئيسي">
            {nav.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-current={screen === id ? "page" : undefined}
                onClick={() => {
                  if (id === "instructions") setReturnTo(screen);
                  go(id);
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="header-tools">
          <button
            aria-label={settings.soundMuted ? "تشغيل الصوت" : "كتم الصوت"}
            onClick={() => {
              soundEffects.stopCurrentEffect();
              setSettings((s) => ({ ...s, soundMuted: !s.soundMuted }));
            }}
          >
            {settings.soundMuted ? <VolumeX /> : <Volume2 />}
          </button>
          <button aria-label="الإعدادات" onClick={() => go("settings")}>
            <Settings />
          </button>
        </div>
      </header>
      <main id="content" className="journey-main" tabIndex={-1}>
        {error && (
          <div role="alert" className="journey-error">
            {error}
            <button onClick={() => location.reload()}>إعادة الاتصال</button>
          </div>
        )}
        {loading ? (
          <div className="loading-card" role="status">
            بنجهّز رحلتك…
          </div>
        ) : (
          <>
            {screen === "entry" && (
              <section className="entry-layout">
                <div className="hero-copy">
                  <span className="eyebrow">علوم الصف السادس الابتدائي</span>
                  <h1>
                    كل لقمة..
                    <br />
                    وراها <em>رحلة!</em>
                  </h1>
                  <p>
                    اكتشف عالم جسمك من الداخل، حلّ التحديات، واجمع شاراتك في
                    رحلة الطعام.
                  </p>
                  <div className="hero-facts">
                    <span>
                      <b>٦</b> مستويات
                    </span>
                    <span>
                      <b>٢٦</b> تحدّيًا
                    </span>
                    <span>
                      <b>١٨٦</b> نقطة
                    </span>
                  </div>
                  <img
                    className="hero-anatomy"
                    src="/assets/3d/anatomy.webp"
                    alt="نموذج توضيحي للجهاز الهضمي"
                  />
                </div>
                <form className="entry-card" onSubmit={enter}>
                  <span className="eyebrow">أهلًا بالمستكشف الصغير</span>
                  <h2>جاهز تبدأ المغامرة؟</h2>
                  <label htmlFor="student-name">اسمك إيه؟</label>
                  <input
                    id="student-name"
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={40}
                    placeholder="اسمك الأول كفاية"
                  />
                  <fieldset>
                    <legend>اختار صاحبك في الرحلة</legend>
                    <div className="avatar-grid">
                      {AVATAR_OPTIONS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={avatar === a.id}
                          onClick={() => setAvatar(a.id)}
                        >
                          <StudentAvatarIllustration
                            avatarId={a.id}
                            size={86}
                          />
                          <span>{a.nameAr}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    className="btn btn--primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "بنحفظ رحلتك…" : "يلا نبدأ الرحلة"}
                    <ArrowLeft size={20} />
                  </button>
                  <small>اسمك للعرض. تقدمك مرتبط بجلستك على هذا المتصفح.</small>
                </form>
              </section>
            )}
            {screen === "instructions" && (
              <FiveCardInstructionsScreen
                titleAr={manifest.instructionsTitleAr}
                subtitleAr={manifest.instructionsSubtitleAr}
                cards={manifest.instructionCards}
                primaryActionAr={manifest.instructionsPrimaryActionAr}
                progressState={state}
                reminderAr={manifest.instructionsReminderAr}
                onPrimaryAction={() => go(returnTo)}
              />
            )}
            {screen === "map" && (
              <section>
                <div className="page-heading">
                  <span className="eyebrow">خطوة وراء خطوة</span>
                  <h1>رحلتك يا {state?.student.displayName}</h1>
                  <p>كمّل تحديات كل مستوى، واجمع شارتك وافتح اللي بعده.</p>
                </div>
                <div className="journey-overview">
                  <StudentAvatarIllustration
                    avatarId={state?.student.avatarId}
                    size={85}
                  />
                  <div>
                    <b>
                      {fmt(stats.totalBestScoreEarned)}{" "}
                      <small>من ١٨٦ نقطة</small>
                    </b>
                    <p>{fmt(stats.completedLevelsCount)} من ٦ مستويات مكتملة</p>
                  </div>
                  <progress
                    aria-label="تقدم الرحلة"
                    value={stats.completedLevelsCount}
                    max={6}
                  />
                </div>
                <div className="level-grid">
                  {manifest.levels.map((l, i) => {
                    const p = progress.get(l.levelId)!;
                    return (
                      <article
                        className={`level-card ${p.isUnlocked ? "" : "is-locked"}`}
                        key={l.levelId}
                      >
                        <div className="level-card-top">
                          <span>المستوى {fmt(i + 1)}</span>
                          {p.isCompleted ? (
                            <Check aria-label="مكتمل" />
                          ) : !p.isUnlocked ? (
                            <Lock aria-label="مغلق" />
                          ) : (
                            <span>جاهز للاكتشاف</span>
                          )}
                        </div>
                        <div className="level-art">
                          <StationIllustration
                            illustrationKey={l.illustrationKey}
                          />
                        </div>
                        <h2>
                          {l.stationNameAr.replace(/^المستوى[^:]+:\s*/, "")}
                        </h2>
                        <p>
                          {fmt(l.activities.length)} تحديات ·{" "}
                          {fmt(p.maxPossibleScore)} نقطة
                        </p>
                        <button
                          className="btn btn--primary"
                          disabled={!p.isUnlocked || !state}
                          onClick={() => open(i)}
                        >
                          {p.isCurrentRunCompleted
                            ? "راجع إنجازك"
                            : p.currentRunAttemptsCount
                              ? "كمّل رحلتك"
                              : "ابدأ الاكتشاف"}
                          <ArrowLeft size={18} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {screen === "activity" && state && (
              <section className="focused-activity">
                <button className="text-button" onClick={() => go("map")}>
                  الرجوع للمستويات
                </button>
                <div className="activity-trail">
                  <span>
                    {practice
                      ? "تدريب دون تغيير النتيجة"
                      : `المستوى ${fmt(li + 1)}`}
                  </span>
                  <span>
                    التحدي {fmt(ai + 1)} من {fmt(level.activities.length)}
                  </span>
                </div>
                <progress
                  aria-label="تحديات المستوى"
                  value={ai}
                  max={level.activities.length}
                />
                <details>
                  <summary>هنتعلم إيه؟</summary>
                  <ul>
                    {level.learningObjectivesAr.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>
                <ActivityRendererRegistry
                  key={`${run}:${activity.activityId}:${practice}`}
                  activity={activity}
                  activityIndex={ai}
                  totalActivitiesInLevel={level.activities.length}
                  studentName={state.student.displayName}
                  draftSelectedOptionId={drafts[draftKey] ?? ""}
                  previousAttempts={attempts}
                  disabled={busy}
                  onDraftOptionChange={draft}
                  onSubmitAttempt={submit}
                  nextActionLabelAr={
                    ai === level.activities.length - 1
                      ? "شوف إنجازك"
                      : "التحدي التالي"
                  }
                  onNextAction={() => {
                    if (ai < level.activities.length - 1) setAi((i) => i + 1);
                    else {
                      soundEffects.play("badge");
                      go("complete");
                    }
                  }}
                />
                {ai > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setAi((i) => i - 1)}
                  >
                    التحدي السابق
                  </button>
                )}
              </section>
            )}
            {screen === "complete" && (
              <section className="celebration">
                <LevelBadgeIllustration
                  order={li + 1}
                  earned={!!summary?.isCompleted}
                  size={140}
                />
                <span className="eyebrow">كل خطوة تستاهل فرحة</span>
                <h1>برافو يا {state?.student.displayName}!</h1>
                <h2>
                  {practice ? "التدريب بيقوّي معرفتك" : level.stationNameAr}
                </h2>
                <p>
                  {practice
                    ? "تدريبك لا يغير نتيجتك المحفوظة."
                    : `جمعت ${fmt(summary?.currentRunScoreEarned ?? 0)} من ${fmt(summary?.maxPossibleScore ?? 0)} نقطة`}
                </p>
                <div className="button-row">
                  {li < 5 && !practice && (
                    <button
                      className="btn btn--primary"
                      onClick={() => open(li + 1)}
                    >
                      المستوى التالي
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() =>
                      go(li === 5 && !practice ? "final" : "dashboard")
                    }
                  >
                    {li === 5 && !practice
                      ? "شوف نتيجتك النهائية"
                      : "شوف إنجازاتك"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void replay("level")}
                  >
                    إعادة المستوى
                  </button>
                </div>
              </section>
            )}
            {(screen === "dashboard" || screen === "final") && (
              <section>
                <div className="page-heading">
                  <span className="eyebrow">كل محاولة بتعلّمك</span>
                  <h1>
                    {screen === "final"
                      ? "أنهيت رحلة الهضم، برافو يا"
                      : "إنجازاتك يا"}{" "}
                    {state?.student.displayName}
                  </h1>
                </div>
                <div className="stat-grid">
                  {[
                    [stats.totalBestScoreEarned, "أفضل نقاط مكتسبة"],
                    [stats.completedLevelsCount, "مستويات مكتملة"],
                    [stats.completedActivitiesCount, "أنشطة مكتملة"],
                    [stats.correctFirstAttemptCount, "صح من أول مرة"],
                  ].map(([n, t]) => (
                    <article key={t}>
                      <strong>{fmt(Number(n))}</strong>
                      <span>{t}</span>
                    </article>
                  ))}
                </div>
                <div className="badge-row">
                  {manifest.levels.map((l) => (
                    <div key={l.levelId}>
                      <LevelBadgeIllustration
                        order={l.order}
                        earned={progress.get(l.levelId)?.isCompleted ?? false}
                      />
                      <small>المستوى {fmt(l.order)}</small>
                    </div>
                  ))}
                </div>
                {!stats.hasSufficientActivityForAnalytics ? (
                  <div className="empty-state">
                    <BookOpen />
                    <h2>لسه أول الرحلة</h2>
                    <p>حلّ بعض التحديات عشان تشوف تحليلك وخطة مراجعتك هنا.</p>
                  </div>
                ) : (
                  <>
                    <div className="summary-card">
                      <h2>إجاباتك بتحكي تقدمك</h2>
                      <p>
                        صح من أول محاولة: {fmt(stats.correctFirstAttemptCount)}{" "}
                        · بعد التلميح: {fmt(stats.correctSecondAttemptCount)} ·
                        محتاج تدريب: {fmt(stats.incorrectAfterTwoAttemptsCount)}
                      </p>
                      <p>
                        دقة أول محاولة: {fmt(stats.firstAttemptAccuracyPercent)}
                        ٪ من الأنشطة المحلولة.
                      </p>
                    </div>
                    <h2>نراجع ونتدرّب</h2>
                    {stats.reviewPlan.length ? (
                      stats.reviewPlan.map((r) => (
                        <article className="review-card" key={r.activityId}>
                          <div>
                            <h3>{r.topicTitleAr}</h3>
                            <p>{r.reasonLabelAr}</p>
                            <p>
                              {
                                state?.attempts.find(
                                  (a) =>
                                    a.activityId === r.activityId &&
                                    a.revealedExplanationAr,
                                )?.revealedExplanationAr
                              }
                            </p>
                          </div>
                          <button
                            className="btn"
                            onClick={() =>
                              open(
                                r.levelOrder - 1,
                                true,
                                manifest.levels[
                                  r.levelOrder - 1
                                ].activities.findIndex(
                                  (a) => a.activityId === r.activityId,
                                ),
                              )
                            }
                          >
                            اتدرّب هنا
                          </button>
                        </article>
                      ))
                    ) : (
                      <p>أحسنت! مفيش موضوعات محتاجة مراجعة حاليًا.</p>
                    )}
                  </>
                )}
                <button
                  className="btn"
                  onClick={() => void replay("full")}
                  disabled={busy}
                >
                  إعادة الرحلة مع حفظ أفضل النتائج
                </button>
              </section>
            )}
            {screen === "leaderboard" && (
              <section>
                <div className="page-heading">
                  <span className="eyebrow">نتعلّم ونحتفل سوا</span>
                  <h1>أبطال الرحلة</h1>
                  <p>
                    تظهر بعد إكمال المستويات الستة. الترتيب من مجموع أفضل درجاتك
                    المكتملة في نفس نسخة المحتوى.
                  </p>
                </div>
                {!leaders.length ? (
                  <div className="empty-state">
                    <Trophy />
                    <h2>مكانك مستنيك هنا!</h2>
                    <p>لم يكمل أحد الرحلة بعد. كمّل المستويات واجمع شاراتك.</p>
                  </div>
                ) : (
                  <>
                    <div className="summary-card">
                      {leaders.find(
                        (l) => l.studentId === state?.student.studentId,
                      )
                        ? `مركزك: ${fmt(leaders.find((l) => l.studentId === state?.student.studentId)!.rank)}`
                        : "كمّل المستويات الستة للظهور في الترتيب."}
                    </div>
                    <ol className="leader-list">
                      {(page === 0
                        ? leaders.filter((l) => l.rank <= 10)
                        : leaders.slice((page - 1) * 10, page * 10)
                      ).map((l) => (
                        <li key={l.studentId}>
                          <strong>{fmt(l.rank)}</strong>
                          <StudentAvatarIllustration avatarId={l.avatarId} />
                          <span>{l.displayName}</span>
                          <b>{fmt(l.totalScoreEarned)} نقطة</b>
                        </li>
                      ))}
                    </ol>
                    <div className="button-row">
                      <button
                        className="btn"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        السابق
                      </button>
                      <span>
                        {page === 0
                          ? "أول ١٠ مراكز مع التعادل"
                          : `صفحة ${fmt(page)}`}
                      </span>
                      <button
                        className="btn"
                        disabled={page > 0 && page * 10 >= leaders.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        التالي
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
            {screen === "settings" && (
              <section className="settings-card">
                <h1>على راحتك</h1>
                <label>
                  حجم الخط
                  <select
                    value={settings.fontScale}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        fontScale: e.target.value as typeof settings.fontScale,
                      }))
                    }
                  >
                    <option value="normal">عادي</option>
                    <option value="large">كبير</option>
                    <option value="xlarge">كبير جدًا</option>
                    <option value="xxlarge">الأكبر</option>
                  </select>
                </label>
                {(
                  ["highContrast", "reducedMotion", "enhancedFocus"] as const
                ).map((k, i) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={settings[k]}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, [k]: e.target.checked }))
                      }
                    />
                    {["تباين أوضح", "حركة أقل", "تحديد أوضح للوحة المفاتيح"][i]}
                  </label>
                ))}
                <button
                  className="btn"
                  onClick={() => go(state ? "map" : "entry")}
                >
                  رجوع
                </button>
              </section>
            )}
            {screen === "about" && (
              <section className="settings-card">
                <h1>عن رحلة الهضم</h1>
                <p>
                  مشروع تعليمي تفاعلي من فكرة وإعداد الطالبة نورهان السيد محمد
                  أبو شادي، بالفرقة الثالثة، قسم تكنولوجيا التعليم، ضمن مقرر طرق
                  واستراتيجيات التدريس في التخصص.
                </p>
                {import.meta.env.VITE_DEVELOPER_ATTRIBUTION && (
                  <p>{import.meta.env.VITE_DEVELOPER_ATTRIBUTION}</p>
                )}
                <button className="text-button" onClick={() => go("admin")}>
                  دخول المسؤول
                </button>
              </section>
            )}
            {screen === "admin" && (
              <React.Suspense fallback={<p role="status">تحميل الإدارة…</p>}>
                <Admin
                  manifest={manifest}
                  onPublished={async () => setManifest(await loadManifest())}
                />
              </React.Suspense>
            )}
          </>
        )}
      </main>
      <footer className="journey-footer">
        <span>رحلة الهضم · فضولك بداية المعرفة</span>
        <button onClick={() => go("about")}>عن المشروع</button>
      </footer>
      {confirm && (
        <div className="modal-shade">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">
              توجد جولة غير مكتملة. تبدأ من جديد مع الاحتفاظ بأفضل نتيجة مكتملة؟
            </h2>
            <div className="button-row">
              <button
                autoFocus
                className="btn"
                onClick={() => setConfirm(null)}
              >
                كمّل الجولة الحالية
              </button>
              <button
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void replay(confirm, true)}
              >
                ابدأ من جديد
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
