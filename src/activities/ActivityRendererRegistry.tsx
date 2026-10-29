import React, { useEffect, useMemo, useRef, useState } from "react";
import { applyRevealedAnswer } from "../backend/disclosure";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  CircleDot,
  GripVertical,
  Lightbulb,
  Link2,
  MousePointerClick,
  RotateCcw,
  Send,
  Unlink,
  XCircle,
} from "lucide-react";
import { soundEffects } from "../audio/soundEffects";
import {
  buildHumanReadableSolutionAr,
  getCompletedActivityForTerminalReview,
  getStateGatedActivityDisclosure,
} from "../backend/answerKeyVault";
import {
  ANATOMICAL_ASSET_MANIFEST,
  type AnatomicalHotspotCoordinate,
} from "../content/assetManifest";
import type { LearningActivityDefinition } from "../content/schema";
import { asContentVersionId } from "../domain/ids";
import {
  deriveActivityMachineSnapshot,
  getCorrectEncouragementHeadingAr,
  processActivitySubmission,
} from "../domain/activityStateMachine";
import {
  getScoredRunAttemptsForActivity,
  isActivityFinished,
  MAX_ATTEMPTS_PER_ACTIVITY,
} from "../domain/rules";
import type { ActivityAttempt } from "../domain/types";

export interface ActivitySubmissionPayload {
  readonly attemptNumber: 1 | 2;
  readonly selectedOptionId: string;
  readonly isCorrect: boolean;
  readonly scoreEarned: number;
  readonly maxScore: number;
  readonly durationMs: number;
  readonly idempotencyKey?: string;
}

interface ActivityRendererProps {
  readonly activity: LearningActivityDefinition;
  readonly activityIndex: number;
  readonly totalActivitiesInLevel: number;
  readonly studentName: string | null;
  readonly draftSelectedOptionId: string;
  readonly previousAttempts: readonly ActivityAttempt[];
  readonly disabled: boolean;
  readonly nextActionLabelAr?: string;
  readonly onNextAction?: () => void;
  readonly onDraftOptionChange: (optionId: string) => void;
  readonly onSubmitAttempt: (
    payload: ActivitySubmissionPayload,
  ) => void | Promise<void>;
}

function parseKeyValueDraft(draft: string): Record<string, string> {
  if (!draft) return {};
  const result: Record<string, string> = {};
  for (const part of draft.split("|")) {
    const [k, v] = part.split(":");
    if (k && v) {
      result[k] = v;
    }
  }
  return result;
}

function serializeKeyValueDraft(map: Record<string, string>): string {
  return Object.keys(map)
    .sort()
    .filter((k) => Boolean(map[k]))
    .map((k) => `${k}:${map[k]}`)
    .join("|");
}

export const ActivityRendererRegistry: React.FC<ActivityRendererProps> = ({
  activity: rawActivity,
  activityIndex,
  totalActivitiesInLevel,
  studentName,
  draftSelectedOptionId,
  previousAttempts: rawPreviousAttempts,
  disabled,
  nextActionLabelAr,
  onNextAction,
  onDraftOptionChange,
  onSubmitAttempt,
}) => {
  const [startedAtMs, setStartedAtMs] = useState<number>(() => Date.now());
  const [isSubmittingTransient, setIsSubmittingTransient] =
    useState<boolean>(false);
  const [validationAlertAr, setValidationAlertAr] = useState<string | null>(
    null,
  );
  const inFlightSubmitLockRef = useRef<boolean>(false);
  const touchOrderRef = useRef<{
    id: string;
    startY: number;
    target: number;
    moved: boolean;
  } | null>(null);
  const suppressTouchClickRef = useRef(false);
  const touchWordRef = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  const previousAttempts = useMemo(
    () => getScoredRunAttemptsForActivity(rawPreviousAttempts),
    [rawPreviousAttempts],
  );

  const attemptsUsed = previousAttempts.length;
  const latestAttempt =
    attemptsUsed > 0 ? previousAttempts[attemptsUsed - 1] : null;

  const isFinished = isActivityFinished(previousAttempts);
  const hasExhaustedBothAttempts =
    attemptsUsed >= MAX_ATTEMPTS_PER_ACTIVITY &&
    !previousAttempts.some((a) => a.isCorrect);

  // Security Rule: Only resolve terminal answer key highlights AFTER the activity is completed!
  // While unanswered, editing, or in 1st-error hint state, `activity` remains stripped of answer keys.
  const activity = useMemo(
    () =>
      applyRevealedAnswer(
        getCompletedActivityForTerminalReview(
          latestAttempt?.contentVersionId ?? "content-ar-g6-digestion-v1.4.0",
          rawActivity,
          isFinished,
        ),
        isFinished ? latestAttempt?.revealedCorrectAnswer : null,
      ),
    [rawActivity, isFinished, latestAttempt],
  );

  const stateGatedDisclosure = useMemo(
    () =>
      getStateGatedActivityDisclosure(
        asContentVersionId(
          latestAttempt?.contentVersionId ?? "content-ar-g6-digestion-v1.4.0",
        ),
        rawActivity.activityId,
        previousAttempts,
      ),
    [latestAttempt?.contentVersionId, rawActivity.activityId, previousAttempts],
  );

  // Sub-interaction states that NEVER consume an attempt
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [activeBlankId, setActiveBlankId] = useState<string | null>(null);
  const [draggedOrderItemId, setDraggedOrderItemId] = useState<string | null>(
    null,
  );
  const [grabbedOrderItemId, setGrabbedOrderItemId] = useState<string | null>(
    null,
  );
  const [dragOverOrderIndex, setDragOverOrderIndex] = useState<number | null>(
    null,
  );
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeImageLabelId, setActiveImageLabelId] = useState<string | null>(
    null,
  );

  // Reset local transient selection helpers when switching activities
  useEffect(() => {
    setStartedAtMs(Date.now());
    setIsSubmittingTransient(false);
    setValidationAlertAr(null);
    inFlightSubmitLockRef.current = false;
    setActiveWordId(null);
    setActiveBlankId(null);
    setDraggedOrderItemId(null);
    setGrabbedOrderItemId(null);
    setDragOverOrderIndex(null);
    setActivePromptId(null);
    setActiveImageLabelId(null);
  }, [rawActivity.activityId]);

  // Clear incomplete-input validation banner as soon as the student edits their draft
  useEffect(() => {
    if (validationAlertAr) {
      setValidationAlertAr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSelectedOptionId]);

  // SVG line measurement for matching renderer
  const matchingBoardRef = useRef<HTMLDivElement | null>(null);
  const promptNodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const targetNodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [matchingLines, setMatchingLines] = useState<
    readonly {
      promptId: string;
      targetId: string;
      pairIndex: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[]
  >([]);

  // Determine effective draft string for each renderer
  const effectiveDraft = useMemo(() => {
    if (draftSelectedOptionId) return draftSelectedOptionId;
    if (activity.type === "ordering" && activity.orderingConfig) {
      return activity.orderingConfig.initialOrderIds.join(">");
    }
    return "";
  }, [activity, draftSelectedOptionId]);

  // Deterministic Activity State Machine Snapshot:
  // unanswered → editing → submitting → hint/editing OR completed
  const machine = useMemo(
    () =>
      deriveActivityMachineSnapshot({
        activity,
        previousAttempts,
        draftString: draftSelectedOptionId,
        isSubmittingTransient,
      }),
    [activity, previousAttempts, draftSelectedOptionId, isSubmittingTransient],
  );

  const isReadyToSubmit =
    !disabled && !isFinished && machine.validation.isComplete;

  // Recompute SVG connection lines for matching renderer
  useEffect(() => {
    if (activity.type !== "matching" || !activity.matchingConfig) return;

    const computeLines = () => {
      const board = matchingBoardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const map = parseKeyValueDraft(effectiveDraft);
      const nextLines: {
        promptId: string;
        targetId: string;
        pairIndex: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[] = [];

      activity.matchingConfig?.prompts.forEach((p, idx) => {
        const tId = map[p.promptId];
        if (!tId) return;
        const pEl = promptNodeRefs.current[p.promptId];
        const tEl = targetNodeRefs.current[tId];
        if (!pEl || !tEl) return;
        const pRect = pEl.getBoundingClientRect();
        const tRect = tEl.getBoundingClientRect();
        // In RTL, prompts are on the right and targets are on the left
        const x1 = pRect.left - boardRect.left;
        const y1 = pRect.top + pRect.height / 2 - boardRect.top;
        const x2 = tRect.right - boardRect.left;
        const y2 = tRect.top + tRect.height / 2 - boardRect.top;
        nextLines.push({
          promptId: p.promptId,
          targetId: tId,
          pairIndex: idx + 1,
          x1,
          y1,
          x2,
          y2,
        });
      });
      setMatchingLines(nextLines);
    };

    computeLines();
    window.addEventListener("resize", computeLines);
    return () => window.removeEventListener("resize", computeLines);
  }, [activity, effectiveDraft]);

  if (activity.contentApprovalStatus !== "approved") {
    return (
      <div className="ds-callout ds-callout--warning" role="status">
        <div className="ds-callout__header">
          <AlertTriangle size={20} aria-hidden="true" />
          <strong>هذا النشاط بانتظار اعتماد المحتوى أو الأصول التعليمية</strong>
        </div>
        <p>
          معرّف النشاط: <code>{activity.activityId}</code> — الحالة:{" "}
          <code>{activity.contentApprovalStatus}</code>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || inFlightSubmitLockRef.current) return;

    const decision = processActivitySubmission({
      activity,
      previousAttempts,
      draftString: draftSelectedOptionId,
    });

    if (!decision.accepted) {
      // Rule: Incomplete input validation or already-completed guard does NOT consume an attempt
      soundEffects.play("confirmation");
      setValidationAlertAr(decision.validationMessageAr);
      return;
    }

    inFlightSubmitLockRef.current = true;
    setIsSubmittingTransient(true);
    setValidationAlertAr(null);
    const durationMs = Math.max(300, Date.now() - startedAtMs);
    const idempotencyKey = `idem_${rawActivity.activityId}_att${decision.attemptNumber}_${startedAtMs}`;

    try {
      await onSubmitAttempt({
        attemptNumber: decision.attemptNumber,
        selectedOptionId: decision.selectedOptionId,
        isCorrect: decision.isCorrect,
        scoreEarned: decision.scoreEarned,
        maxScore: decision.maxScore,
        durationMs,
        idempotencyKey,
      });
      setStartedAtMs(Date.now());
    } catch {
      setValidationAlertAr(
        "تعذّر إرسال الإجابة. اختيارك محفوظ؛ حاول مرة أخرى.",
      );
    } finally {
      inFlightSubmitLockRef.current = false;
      setIsSubmittingTransient(false);
    }
  };

  const handleResetSelection = () => {
    if (disabled || isFinished) return;
    if (activity.type === "ordering" && activity.orderingConfig) {
      onDraftOptionChange(activity.orderingConfig.initialOrderIds.join(">"));
    } else {
      onDraftOptionChange("");
    }
    setValidationAlertAr(null);
    setActiveWordId(null);
    setActiveBlankId(null);
    setGrabbedOrderItemId(null);
    setActivePromptId(null);
    setActiveImageLabelId(null);
    setStartedAtMs(Date.now());
  };

  const correctOption = activity.options.find(
    (o) => o.optionId === activity.correctOptionId,
  );

  const nameSalutation = studentName ? ` يا ${studentName}` : "";

  // =========================================================================
  // 1. MULTIPLE CHOICE RENDERER
  // =========================================================================
  const renderMultipleChoice = () => {
    return (
      <div
        className="options-list"
        role="radiogroup"
        aria-labelledby={`heading-${activity.activityId}`}
      >
        {activity.options.map((opt, idx) => {
          const isSelected = effectiveDraft === opt.optionId;
          const isLatestSubmittedChoice =
            latestAttempt?.selectedOptionId === opt.optionId &&
            (isFinished || effectiveDraft === latestAttempt.selectedOptionId);
          const isThisCorrect = opt.optionId === activity.correctOptionId;

          let stateClass = "option-item--idle";
          let statusLabel = `الخيار ${idx + 1}`;
          let StatusIcon = null;

          if (isLatestSubmittedChoice && latestAttempt) {
            if (latestAttempt.isCorrect) {
              stateClass = "option-item--submitted-correct";
              statusLabel = "إجابة صحيحة ✓";
              StatusIcon = CheckCircle2;
            } else {
              stateClass = "option-item--submitted-incorrect";
              statusLabel = "إجابة غير صحيحة ✕";
              StatusIcon = XCircle;
            }
          } else if (hasExhaustedBothAttempts && isThisCorrect) {
            stateClass = "option-item--submitted-correct";
            statusLabel = "الحل الصحيح ✓";
            StatusIcon = CheckCircle2;
          } else if (isSelected) {
            stateClass = "option-item--selected-unsubmitted";
            statusLabel = "اختيار محدد (بانتظار التأكيد)";
            StatusIcon = CircleDot;
          }

          return (
            <label
              key={opt.optionId}
              className={`option-item ${stateClass} ${
                disabled || isFinished ? "option-item--disabled" : ""
              }`}
            >
              <input
                type="radio"
                name={activity.activityId}
                value={opt.optionId}
                checked={isSelected}
                disabled={disabled || isFinished}
                onChange={() => {
                  if (!disabled && !isFinished) {
                    onDraftOptionChange(opt.optionId);
                  }
                }}
                className="option-item__radio"
              />
              <span className="option-item__content">
                <span className="option-item__label">{opt.labelAr}</span>
                <span className="option-item__shape-tag">
                  {StatusIcon && <StatusIcon size={15} aria-hidden="true" />}
                  <span>{statusLabel}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  // =========================================================================
  // 2. FILL-IN RENDERER (Drag Word Cards + Tap-to-Select / Tap-to-Place)
  // =========================================================================
  const renderFillIn = () => {
    const cfg = activity.fillInConfig;
    if (!cfg) return null;
    const placedMap = parseKeyValueDraft(effectiveDraft);
    const usedWordIds = new Set(Object.values(placedMap));

    const placeWordInBlank = (blankId: string, wordId: string) => {
      if (disabled || isFinished) return;
      const nextMap = { ...placedMap };
      // Remove this word from any other blank first
      for (const k of Object.keys(nextMap)) {
        if (nextMap[k] === wordId) {
          delete nextMap[k];
        }
      }
      nextMap[blankId] = wordId;
      onDraftOptionChange(serializeKeyValueDraft(nextMap));
      setActiveWordId(null);
      setActiveBlankId(null);
    };

    const clearBlank = (blankId: string) => {
      if (disabled || isFinished) return;
      const nextMap = { ...placedMap };
      delete nextMap[blankId];
      onDraftOptionChange(serializeKeyValueDraft(nextMap));
    };

    const handleWordCardClick = (wordId: string) => {
      if (disabled || isFinished) return;
      if (activeBlankId) {
        placeWordInBlank(activeBlankId, wordId);
        return;
      }
      // If a word is tapped and not yet active, either place it in the first empty blank or select it
      if (activeWordId === wordId) {
        setActiveWordId(null);
      } else {
        setActiveWordId(wordId);
      }
    };

    const handleBlankClick = (blankId: string) => {
      if (disabled || isFinished) return;
      if (activeWordId) {
        placeWordInBlank(blankId, activeWordId);
        return;
      }
      if (placedMap[blankId]) {
        clearBlank(blankId);
        return;
      }
      setActiveBlankId((prev) => (prev === blankId ? null : blankId));
    };

    return (
      <div className="fill-in-renderer">
        <div
          className="fill-in-sentence-card"
          role="group"
          aria-label="جملة إكمال الفراغات"
        >
          {cfg.blanks.map((blank, idx) => {
            const placedWordId = placedMap[blank.blankId];
            const placedWord = cfg.wordCards.find(
              (w) => w.wordId === placedWordId,
            );
            const isActiveTarget = activeBlankId === blank.blankId;
            const isCorrectBlank =
              isFinished && placedWordId === blank.correctWordId;
            const isWrongBlank =
              isFinished && placedWordId !== blank.correctWordId;

            return (
              <div key={blank.blankId} className="fill-in-clause">
                <span className="fill-in-text">{blank.beforeTextAr}</span>
                <button
                  type="button"
                  data-blank-id={blank.blankId}
                  disabled={disabled || isFinished}
                  className={`fill-in-blank-slot ${
                    placedWord ? "fill-in-blank-slot--filled" : ""
                  } ${isActiveTarget ? "fill-in-blank-slot--active" : ""} ${
                    isCorrectBlank ? "fill-in-blank-slot--correct" : ""
                  } ${isWrongBlank ? "fill-in-blank-slot--incorrect" : ""}`}
                  aria-label={`الفراغ ${idx + 1}: ${
                    placedWord
                      ? `الكلمة الموضوعة ${placedWord.labelAr}`
                      : "فارغ"
                  }`}
                  onClick={() => handleBlankClick(blank.blankId)}
                  onDragOver={(e) => {
                    if (!disabled && !isFinished) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedWordId = e.dataTransfer.getData("text/plain");
                    if (droppedWordId) {
                      placeWordInBlank(blank.blankId, droppedWordId);
                    }
                  }}
                >
                  {placedWord ? (
                    <>
                      <span className="fill-in-blank-slot__word">
                        {placedWord.labelAr}
                      </span>
                      {!isFinished && (
                        <span
                          className="fill-in-blank-slot__remove"
                          aria-hidden="true"
                        >
                          ×
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="fill-in-blank-slot__placeholder">
                      {activeWordId
                        ? "انقر لوضع الكلمة المختارة هنا"
                        : `الفراغ (${idx + 1}) — اسحب كلمة أو انقر هنا`}
                    </span>
                  )}
                </button>
                <span className="fill-in-text">{blank.afterTextAr}</span>
              </div>
            );
          })}
        </div>

        <div
          className="fill-in-word-bank"
          role="group"
          aria-label="بنك بطاقات الكلمات"
        >
          <p className="renderer-helper-label">
            <MousePointerClick size={16} aria-hidden="true" />
            <span>
              بطاقات الكلمات (اسحب البطاقة إلى الفراغ، أو انقر على البطاقة ثم
              انقر على الفراغ):
            </span>
          </p>
          <div className="fill-in-word-bank__grid">
            {cfg.wordCards.map((word) => {
              const isUsed = usedWordIds.has(word.wordId);
              const isSelected = activeWordId === word.wordId;
              return (
                <button
                  key={word.wordId}
                  type="button"
                  draggable={!disabled && !isFinished}
                  disabled={disabled || isFinished}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", word.wordId);
                    setActiveWordId(word.wordId);
                  }}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse" || disabled || isFinished)
                      return;
                    touchWordRef.current = {
                      id: word.wordId,
                      x: e.clientX,
                      y: e.clientY,
                      moved: false,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const w = touchWordRef.current;
                    if (w && Math.hypot(e.clientX - w.x, e.clientY - w.y) > 8) {
                      w.moved = true;
                      setActiveWordId(w.id);
                    }
                  }}
                  onPointerUp={(e) => {
                    const w = touchWordRef.current;
                    touchWordRef.current = null;
                    if (w?.moved) {
                      suppressTouchClickRef.current = true;
                      const target = document
                        .elementFromPoint(e.clientX, e.clientY)
                        ?.closest<HTMLElement>("[data-blank-id]");
                      if (target?.dataset.blankId)
                        placeWordInBlank(target.dataset.blankId, w.id);
                    }
                  }}
                  onPointerCancel={() => {
                    touchWordRef.current = null;
                  }}
                  onClick={() => {
                    if (suppressTouchClickRef.current) {
                      suppressTouchClickRef.current = false;
                      return;
                    }
                    handleWordCardClick(word.wordId);
                  }}
                  className={`word-card-chip ${
                    isSelected ? "word-card-chip--selected" : ""
                  } ${isUsed ? "word-card-chip--used" : ""}`}
                  aria-pressed={isSelected}
                >
                  <GripVertical size={15} aria-hidden="true" />
                  <span>{word.labelAr}</span>
                  {isUsed && (
                    <span className="word-card-chip__tag">(مستخدمة)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 3. ORDERING RENDERER (Real Drag-and-Drop + Visible Insertion Slots + Touch/Keyboard)
  // =========================================================================
  const renderOrdering = () => {
    const cfg = activity.orderingConfig;
    if (!cfg) return null;

    const currentOrderIds = effectiveDraft
      ? effectiveDraft.split(">")
      : [...cfg.initialOrderIds];

    const moveItemToIndex = (itemId: string, targetIndex: number) => {
      if (disabled || isFinished) return;
      const currentIndex = currentOrderIds.indexOf(itemId);
      if (currentIndex === -1) return;
      const next = [...currentOrderIds];
      next.splice(currentIndex, 1);
      const adjustedTarget =
        currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
      const clampedIndex = Math.max(0, Math.min(next.length, adjustedTarget));
      next.splice(clampedIndex, 0, itemId);
      onDraftOptionChange(next.join(">"));
      setDraggedOrderItemId(null);
      setGrabbedOrderItemId(null);
      setDragOverOrderIndex(null);
    };



    const activeMovingId = draggedOrderItemId ?? grabbedOrderItemId;

    return (
      <div className="ordering-renderer">
        <p className="renderer-helper-label">
          <GripVertical size={16} aria-hidden="true" />
          <span>
            اسحب البطاقات مباشرةً إلى موضع الإدراج المطلوب (أو المس بطاقة
            لالتقاطها ثم اختر موضع الإدراج):
          </span>
        </p>

        <div
          className="ordering-list"
          role="list"
          aria-label="قائمة الترتيب التفاعلي"
        >
          {currentOrderIds.map((itemId, idx) => {
            const item = cfg.items.find((i) => i.itemId === itemId);
            if (!item) return null;
            const isBeingMoved = activeMovingId === itemId;
            const isCorrectPosition =
              isFinished && cfg.correctOrderIds[idx] === itemId;
            const isWrongPosition =
              isFinished && cfg.correctOrderIds[idx] !== itemId;

            return (
              <React.Fragment key={itemId}>
                {/* Visible insertion slot before index idx */}
                {!disabled && !isFinished && (
                  <div
                    className={`ordering-insertion-slot ${
                      dragOverOrderIndex === idx || Boolean(grabbedOrderItemId)
                        ? "ordering-insertion-slot--visible"
                        : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverOrderIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverOrderIndex === idx)
                        setDragOverOrderIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedId =
                        e.dataTransfer.getData("text/plain") || activeMovingId;
                      if (droppedId) {
                        moveItemToIndex(droppedId, idx);
                      }
                    }}
                  >
                    {grabbedOrderItemId && grabbedOrderItemId !== itemId && (
                      <button
                        type="button"
                        className="ordering-insertion-slot__btn"
                        onClick={() => moveItemToIndex(grabbedOrderItemId, idx)}
                      >
                        إدراج البطاقة الملتقطة هنا (في الموضع {idx + 1})
                      </button>
                    )}
                  </div>
                )}

                <div
                  role="listitem"
                  draggable={!disabled && !isFinished}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", itemId);
                    setDraggedOrderItemId(itemId);
                  }}
                  onDragEnd={() => {
                    setDraggedOrderItemId(null);
                    setDragOverOrderIndex(null);
                  }}
                  onDragOver={(e) => {
                    if (!disabled && !isFinished) {
                      e.preventDefault();
                      setDragOverOrderIndex(idx);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedId =
                      e.dataTransfer.getData("text/plain") || activeMovingId;
                    if (droppedId && droppedId !== itemId) {
                      moveItemToIndex(
                        droppedId,
                        idx > currentOrderIds.indexOf(droppedId)
                          ? idx + 1
                          : idx,
                      );
                    }
                  }}
                  className={`ordering-card ${
                    isBeingMoved ? "ordering-card--grabbed" : ""
                  } ${isCorrectPosition ? "ordering-card--correct" : ""} ${
                    isWrongPosition ? "ordering-card--incorrect" : ""
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled || isFinished}
                    className="ordering-card__drag-surface"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" || disabled || isFinished)
                        return;
                      touchOrderRef.current = {
                        id: itemId,
                        startY: e.clientY,
                        target: idx,
                        moved: false,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      const moving = touchOrderRef.current;
                      if (!moving) return;
                      if (
                        Math.abs(e.clientY - moving.startY) < 8 &&
                        !moving.moved
                      )
                        return;
                      moving.moved = true;
                      setDraggedOrderItemId(moving.id);
                      const cards = Array.from(
                        e.currentTarget
                          .closest(".ordering-list")
                          ?.querySelectorAll<HTMLElement>(".ordering-card") ??
                          [],
                      );
                      const target = cards.findIndex((card) => {
                        const r = card.getBoundingClientRect();
                        return e.clientY < r.top + r.height / 2;
                      });
                      moving.target = target < 0 ? cards.length : target;
                      setDragOverOrderIndex(moving.target);
                    }}
                    onPointerUp={() => {
                      const moving = touchOrderRef.current;
                      touchOrderRef.current = null;
                      if (moving?.moved) {
                        suppressTouchClickRef.current = true;
                        moveItemToIndex(moving.id, moving.target);
                      }
                    }}
                    onPointerCancel={() => {
                      touchOrderRef.current = null;
                      setDraggedOrderItemId(null);
                      setDragOverOrderIndex(null);
                    }}
                    onClick={() => {
                      if (suppressTouchClickRef.current) {
                        suppressTouchClickRef.current = false;
                        return;
                      }
                      if (disabled || isFinished) return;
                      if (grabbedOrderItemId && grabbedOrderItemId !== itemId) {
                        moveItemToIndex(
                          grabbedOrderItemId,
                          idx > currentOrderIds.indexOf(grabbedOrderItemId)
                            ? idx + 1
                            : idx,
                        );
                      } else {
                        setGrabbedOrderItemId((prev) =>
                          prev === itemId ? null : itemId,
                        );
                      }
                    }}
                    aria-pressed={grabbedOrderItemId === itemId}
                    aria-label={`الخطوة ${idx + 1}: ${item.labelAr} — ${
                      grabbedOrderItemId === itemId
                        ? "تم التقاط البطاقة، اختر موضع الإدراج"
                        : "اسحب البطاقة أو اضغط لالتقاطها ونقلها"
                    }`}
                  >
                    <span className="ordering-card__handle" aria-hidden="true">
                      <GripVertical size={20} />
                    </span>
                    <span className="ordering-card__step-badge">{idx + 1}</span>
                    <span className="ordering-card__label">{item.labelAr}</span>
                  </button>


                </div>
              </React.Fragment>
            );
          })}

          {/* Final insertion slot at end of list */}
          {!disabled && !isFinished && (
            <div
              className={`ordering-insertion-slot ${
                dragOverOrderIndex === currentOrderIds.length ||
                Boolean(grabbedOrderItemId)
                  ? "ordering-insertion-slot--visible"
                  : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverOrderIndex(currentOrderIds.length);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId =
                  e.dataTransfer.getData("text/plain") || activeMovingId;
                if (droppedId) {
                  moveItemToIndex(droppedId, currentOrderIds.length);
                }
              }}
            >
              {grabbedOrderItemId && (
                <button
                  type="button"
                  className="ordering-insertion-slot__btn"
                  onClick={() =>
                    moveItemToIndex(grabbedOrderItemId, currentOrderIds.length)
                  }
                >
                  إدراج البطاقة الملتقطة في نهاية القائمة (الموضع{" "}
                  {currentOrderIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // 4. MATCHING RENDERER (Interactive Pairing + Visible SVG Connections + Tap/Keyboard)
  // =========================================================================
  const renderMatching = () => {
    const cfg = activity.matchingConfig;
    if (!cfg) return null;

    const pairsMap = parseKeyValueDraft(effectiveDraft);

    const connectPair = (promptId: string, targetId: string) => {
      if (disabled || isFinished) return;
      const next = { ...pairsMap };
      // Ensure 1-to-1 pairing: remove any existing prompt connected to targetId
      for (const k of Object.keys(next)) {
        if (next[k] === targetId) {
          delete next[k];
        }
      }
      next[promptId] = targetId;
      onDraftOptionChange(serializeKeyValueDraft(next));
      setActivePromptId(null);
    };

    const disconnectPrompt = (promptId: string) => {
      if (disabled || isFinished) return;
      const next = { ...pairsMap };
      delete next[promptId];
      onDraftOptionChange(serializeKeyValueDraft(next));
    };

    return (
      <div className="matching-renderer">
        <p className="renderer-helper-label">
          <Link2 size={16} aria-hidden="true" />
          <span>
            انقر على العنصر في العمود الأيمن ثم انقر على ما يناسبه في العمود
            الأيسر لرسم خط الربط (أو اسحب بينهما):
          </span>
        </p>

        <div className="matching-board" ref={matchingBoardRef}>
          {/* Dynamic SVG overlay drawing visible connection curves between paired cards */}
          <svg className="matching-svg-lines" aria-hidden="true">
            {matchingLines.map((line) => {
              const midX = (line.x1 + line.x2) / 2;
              const d = `M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`;
              return (
                <g key={`${line.promptId}-${line.targetId}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#5B1F2A"
                    strokeWidth="3.5"
                    strokeDasharray="6,4"
                  />
                  <circle cx={line.x1} cy={line.y1} r="6" fill="#9E332E" />
                  <circle cx={line.x2} cy={line.y2} r="6" fill="#9E332E" />
                </g>
              );
            })}
          </svg>

          <div className="matching-column matching-column--prompts">
            <h4 className="matching-column__title">{cfg.rightColumnTitleAr}</h4>
            {cfg.prompts.map((prompt, idx) => {
              const pairedTargetId = pairsMap[prompt.promptId];
              const isSelected = activePromptId === prompt.promptId;
              const correctPair = cfg.correctPairs.find(
                (cp) => cp.promptId === prompt.promptId,
              );
              const isCorrectPair =
                isFinished && pairedTargetId === correctPair?.targetId;
              const isWrongPair =
                isFinished && pairedTargetId !== correctPair?.targetId;

              return (
                <div key={prompt.promptId} className="matching-item-wrapper">
                  <button
                    ref={(el) => {
                      promptNodeRefs.current[prompt.promptId] = el;
                    }}
                    type="button"
                    draggable={!disabled && !isFinished}
                    disabled={disabled || isFinished}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", prompt.promptId);
                      setActivePromptId(prompt.promptId);
                    }}
                    onClick={() => {
                      if (disabled || isFinished) return;
                      setActivePromptId((prev) =>
                        prev === prompt.promptId ? null : prompt.promptId,
                      );
                    }}
                    className={`matching-card matching-card--prompt ${
                      isSelected ? "matching-card--active" : ""
                    } ${pairedTargetId ? "matching-card--paired" : ""} ${
                      isCorrectPair ? "matching-card--correct" : ""
                    } ${isWrongPair ? "matching-card--incorrect" : ""}`}
                    aria-pressed={isSelected}
                  >
                    <span className="matching-card__index">{idx + 1}</span>
                    <span className="matching-card__text">
                      {prompt.labelAr}
                    </span>
                    {pairedTargetId && (
                      <span className="matching-pair-badge">
                        مرتبط ({idx + 1})
                      </span>
                    )}
                  </button>
                  {pairedTargetId && !disabled && !isFinished && (
                    <button
                      type="button"
                      className="matching-unlink-btn"
                      onClick={() => disconnectPrompt(prompt.promptId)}
                      aria-label={`فك ارتباط ${prompt.labelAr}`}
                      title="فك الارتباط"
                    >
                      <Unlink size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="matching-column matching-column--targets">
            <h4 className="matching-column__title">{cfg.leftColumnTitleAr}</h4>
            {cfg.targets.map((target) => {
              const pairedPromptEntry = Object.entries(pairsMap).find(
                ([, tId]) => tId === target.targetId,
              );
              const pairedPromptId = pairedPromptEntry?.[0] ?? null;
              const pairedPromptIndex = pairedPromptId
                ? cfg.prompts.findIndex((p) => p.promptId === pairedPromptId) +
                  1
                : null;

              return (
                <button
                  key={target.targetId}
                  ref={(el) => {
                    targetNodeRefs.current[target.targetId] = el;
                  }}
                  type="button"
                  disabled={disabled || isFinished}
                  onDragOver={(e) => {
                    if (!disabled && !isFinished) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const pId =
                      e.dataTransfer.getData("text/plain") || activePromptId;
                    if (pId) connectPair(pId, target.targetId);
                  }}
                  onClick={() => {
                    if (disabled || isFinished) return;
                    if (activePromptId) {
                      connectPair(activePromptId, target.targetId);
                    } else if (pairedPromptId) {
                      disconnectPrompt(pairedPromptId);
                    }
                  }}
                  className={`matching-card matching-card--target ${
                    pairedPromptId ? "matching-card--paired" : ""
                  } ${activePromptId ? "matching-card--ready-target" : ""}`}
                >
                  {pairedPromptIndex && (
                    <span className="matching-pair-badge">
                      مرتبط بـ ({pairedPromptIndex})
                    </span>
                  )}
                  <span className="matching-card__text">{target.labelAr}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 5. IMAGE IDENTIFICATION RENDERER (Illustration as Primary Interaction Surface)
  // =========================================================================
  const renderImageIdentification = () => {
    const cfg = activity.imageIdentificationConfig;
    if (!cfg) return null;
    const baseAsset = ANATOMICAL_ASSET_MANIFEST[cfg.assetId];
    if (!baseAsset) return null;
    const asset = {
      ...baseAsset,
      src: activity.visualAssetUrl ?? baseAsset.src,
      hotspots: cfg.hotspots ?? baseAsset.hotspots,
      intrinsicWidth: cfg.imageWidth ?? baseAsset.intrinsicWidth,
      intrinsicHeight: cfg.imageHeight ?? baseAsset.intrinsicHeight,
    };

    if (cfg.mode === "hotspot_select") {
      const selectedZoneId = effectiveDraft;

      const renderHotspotButton = (
        hs: AnatomicalHotspotCoordinate,
        variant: "organ" | "badge",
      ) => {
        const isSelected = selectedZoneId === hs.zoneId;
        const isCorrectZone = isFinished && hs.zoneId === cfg.correctZoneId;
        const isSubmittedWrong =
          latestAttempt &&
          !latestAttempt.isCorrect &&
          latestAttempt.selectedOptionId === hs.zoneId &&
          (isFinished || selectedZoneId === hs.zoneId);

        const xPct = variant === "organ" ? hs.organXPercent : hs.badgeXPercent;
        const yPct = variant === "organ" ? hs.organYPercent : hs.badgeYPercent;

        return (
          <button
            key={`${hs.zoneId}-${variant}`}
            type="button"
            disabled={disabled || isFinished}
            onClick={() => {
              if (!disabled && !isFinished) {
                onDraftOptionChange(hs.zoneId);
              }
            }}
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
            }}
            className={`anatomy-hotspot anatomy-hotspot--${variant} ${
              isSelected ? "anatomy-hotspot--selected" : ""
            } ${isCorrectZone ? "anatomy-hotspot--correct" : ""} ${
              isSubmittedWrong ? "anatomy-hotspot--incorrect" : ""
            }`}
            aria-label={
              isFinished
                ? `الموضع (${isSelected ? hs.postConfirmationOrganNameAr : ""}): ${hs.postConfirmationOrganNameAr}`
                : hs.preConfirmationPositionLabelAr
            }
            aria-pressed={isSelected}
          >
            <span className="anatomy-hotspot__letter">
              {isSelected ? hs.postConfirmationOrganNameAr : ""}
            </span>
          </button>
        );
      };

      return (
        <div className="image-identification-renderer">
          <p className="renderer-helper-label">
            <MousePointerClick size={16} aria-hidden="true" />
            <span>
              انقر مباشرةً على العضو أو الموضع التشريحي المطلوب فوق الرسم
              التوضيحي؛ سيظهر اسم الجزء عند اختياره:
            </span>
          </p>

          <div className="anatomy-interactive-stage">
            <img
              src={asset.src}
              width={asset.intrinsicWidth}
              height={asset.intrinsicHeight}
              alt={asset.altAr}
              className="anatomy-interactive-stage__img"
            />
            <div className="anatomy-interactive-stage__overlay">
              {asset.hotspots.map((hs) => (
                <React.Fragment key={hs.zoneId}>
                  {renderHotspotButton(hs, "organ")}

                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Non-spoiler Accessible Keyboard/Touch Alternative */}
          <div
            className="anatomy-accessible-controls"
            role="radiogroup"
            aria-label="تحديد الموضع التشريحي عبر لوحة المفاتيح (دون كشف اسم العضو قبل التأكيد)"
          >
            {asset.hotspots.map((hs) => {
              const isSelected = selectedZoneId === hs.zoneId;
              return (
                <button
                  key={hs.zoneId}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={disabled || isFinished}
                  onClick={() => {
                    if (!disabled && !isFinished) {
                      onDraftOptionChange(hs.zoneId);
                    }
                  }}
                  className={`anatomy-zone-pill ${
                    isSelected ? "anatomy-zone-pill--selected" : ""
                  }`}
                >
                  <span className="anatomy-zone-pill__badge">
                    {isSelected ? hs.postConfirmationOrganNameAr : ""}
                  </span>
                  <span className="anatomy-zone-pill__desc">
                    {hs.postConfirmationOrganNameAr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Mode B: label_placement onto defined targets on the anatomical illustration
    const labels = cfg.labelsToPlace ?? [];
    const zoneToLabelMap = parseKeyValueDraft(effectiveDraft);
    const usedLabelIds = new Set(Object.values(zoneToLabelMap));

    const assignLabelToZone = (zoneId: string, labelId: string) => {
      if (disabled || isFinished) return;
      const next = { ...zoneToLabelMap };
      for (const z of Object.keys(next)) {
        if (next[z] === labelId) delete next[z];
      }
      next[zoneId] = labelId;
      onDraftOptionChange(serializeKeyValueDraft(next));
      setActiveImageLabelId(null);
    };

    const clearZoneLabel = (zoneId: string) => {
      if (disabled || isFinished) return;
      const next = { ...zoneToLabelMap };
      delete next[zoneId];
      onDraftOptionChange(serializeKeyValueDraft(next));
    };

    return (
      <div className="image-identification-renderer">
        <p className="renderer-helper-label">
          <MousePointerClick size={16} aria-hidden="true" />
          <span>
            اسحب بطاقة المسمّى وضعها مباشرةً على الموضع التشريحي (أ، ب، ج، د)
            فوق الرسم، أو انقر على البطاقة ثم انقر على الموضع:
          </span>
        </p>

        {/* Draggable / Tappable Label Cards Bank */}
        <div
          className="anatomy-label-bank"
          role="group"
          aria-label="بطاقات المسميات التشريحية"
        >
          {labels.map((lbl) => {
            const isUsed = usedLabelIds.has(lbl.labelId);
            const isSelected = activeImageLabelId === lbl.labelId;
            return (
              <button
                key={lbl.labelId}
                type="button"
                draggable={!disabled && !isFinished}
                disabled={disabled || isFinished}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", lbl.labelId);
                  setActiveImageLabelId(lbl.labelId);
                }}
                onClick={() => {
                  if (disabled || isFinished) return;
                  setActiveImageLabelId((prev) =>
                    prev === lbl.labelId ? null : lbl.labelId,
                  );
                }}
                className={`word-card-chip ${
                  isSelected ? "word-card-chip--selected" : ""
                } ${isUsed ? "word-card-chip--used" : ""}`}
                aria-pressed={isSelected}
              >
                <GripVertical size={15} aria-hidden="true" />
                <span>{lbl.labelAr}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Anatomical Stage with aligned target drop pins */}
        <div className="anatomy-interactive-stage">
          <img
            src={asset.src}
            width={asset.intrinsicWidth}
            height={asset.intrinsicHeight}
            alt={asset.altAr}
            className="anatomy-interactive-stage__img"
          />
          <div className="anatomy-interactive-stage__overlay">
            {asset.hotspots.map((hs) => {
              const assignedLabelId = zoneToLabelMap[hs.zoneId];
              const assignedLabel = labels.find(
                (l) => l.labelId === assignedLabelId,
              );
              const expectedLabel = labels.find(
                (l) => l.correctZoneId === hs.zoneId,
              );
              const isCorrectPin =
                isFinished && assignedLabelId === expectedLabel?.labelId;
              const isWrongPin =
                isFinished && assignedLabelId !== expectedLabel?.labelId;

              return (
                <button
                  key={hs.zoneId}
                  type="button"
                  disabled={disabled || isFinished}
                  style={{
                    left: `${hs.badgeXPercent}%`,
                    top: `${hs.badgeYPercent}%`,
                  }}
                  onDragOver={(e) => {
                    if (!disabled && !isFinished) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedId =
                      e.dataTransfer.getData("text/plain") ||
                      activeImageLabelId;
                    if (droppedId) assignLabelToZone(hs.zoneId, droppedId);
                  }}
                  onClick={() => {
                    if (disabled || isFinished) return;
                    if (activeImageLabelId) {
                      assignLabelToZone(hs.zoneId, activeImageLabelId);
                    } else if (assignedLabelId) {
                      clearZoneLabel(hs.zoneId);
                    }
                  }}
                  className={`anatomy-drop-pin ${
                    assignedLabel ? "anatomy-drop-pin--filled" : ""
                  } ${activeImageLabelId ? "anatomy-drop-pin--ready" : ""} ${
                    isCorrectPin ? "anatomy-drop-pin--correct" : ""
                  } ${isWrongPin ? "anatomy-drop-pin--incorrect" : ""}`}
                  aria-label={`الموضع (${hs.preConfirmationPositionLabelAr}): ${
                    assignedLabel
                      ? assignedLabel.labelAr
                      : "بانتظار وضع المسمّى"
                  }`}
                >
                  <span className="anatomy-drop-pin__letter">
                    {hs.preConfirmationPositionLabelAr}
                  </span>
                  <span className="anatomy-drop-pin__value">
                    {assignedLabel ? assignedLabel.labelAr : "ضع المسمّى هنا"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 6. VILLI COMPARISON RENDERER (Meaningful Comparative Student Task)
  // =========================================================================
  const renderVilliComparison = () => {
    const cfg = activity.villiComparisonConfig;
    if (!cfg) return null;
    const baseAsset = ANATOMICAL_ASSET_MANIFEST[cfg.assetId];
    const asset = {
      ...baseAsset,
      src: activity.visualAssetUrl ?? baseAsset.src,
    };

    const [criteriaPart = "", concPart = ""] = effectiveDraft.split("||");
    const critMap = parseKeyValueDraft(criteriaPart);
    const selectedConcId = concPart.replace(/^conc:/, "");

    const updateComparisonState = (
      nextCritMap: Record<string, string>,
      nextConcId: string,
    ) => {
      if (disabled || isFinished) return;
      const serializedCrit = serializeKeyValueDraft(nextCritMap);
      const nextDraft = `${serializedCrit}||conc:${nextConcId}`;
      onDraftOptionChange(nextDraft);
    };

    return (
      <div className="villi-comparison-renderer">
        <div className="villi-models-grid">
          <div className="villi-model-card">
            <div className="villi-model-card__header">
              <span className="status-chip status-chip--neutral">
                النموذج (أ)
              </span>
              <h4>سطح معوي أملس (بدون خملات)</h4>
            </div>
            <svg
              viewBox="0 0 360 150"
              className="villi-model-card__svg"
              role="img"
              aria-label="رسم تخطيطي لجدار أنبوبي أملس بدون انثناءات"
            >
              <rect
                x="20"
                y="95"
                width="320"
                height="32"
                rx="8"
                fill="#D98B76"
                stroke="#7A3A2E"
                strokeWidth="3"
              />
              <line
                x1="20"
                y1="95"
                x2="340"
                y2="95"
                stroke="#5B1F2A"
                strokeWidth="5"
              />
              <circle cx="95" cy="55" r="7" fill="#E6A817" />
              <circle cx="180" cy="50" r="7" fill="#43936C" />
              <circle cx="265" cy="55" r="7" fill="#E6A817" />
            </svg>
            <ul className="villi-model-card__metrics">
              <li>
                طول خط التلامس المباشر: <strong>١× (مساحة سطح محدودة)</strong>
              </li>
              <li>
                عدد البروزات الإصبعية: <strong>لا يوجد (٠)</strong>
              </li>
            </ul>
          </div>

          <div className="villi-model-card villi-model-card--highlighted">
            <div className="villi-model-card__header">
              <span className="status-chip status-chip--selected">
                النموذج (ب)
              </span>
              <h4>جدار الأمعاء الدقيقة الغني بالخملات</h4>
            </div>
            {asset && (
              <img
                src={asset.src}
                width={asset.intrinsicWidth}
                height={asset.intrinsicHeight}
                alt={asset.altAr}
                className="villi-model-card__img"
              />
            )}
            <ul className="villi-model-card__metrics">
              <li>
                مساحة السطح الفعّالة بفضل الانثناءات:{" "}
                <strong>أكثر من ١٠× أضعاف</strong>
              </li>
              <li>
                التجهيز الوعائي:{" "}
                <strong>شبكة شعيرات دموية ووعاء لمفاوي في كل خملة</strong>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="villi-criteria-section"
          role="group"
          aria-label="جدول المقارنة العلمية بين السطحين"
        >
          <h4>الخطوة ١: صنّف كل خاصية علمية إلى النموذج المناسب لها:</h4>
          {cfg.criteria.map((crit, idx) => {
            const chosen = critMap[crit.criterionId];
            return (
              <div key={crit.criterionId} className="villi-criterion-row">
                <p className="villi-criterion-row__text">
                  <strong>{idx + 1}.</strong> {crit.statementAr}
                </p>
                <div className="villi-criterion-row__buttons">
                  <button
                    type="button"
                    disabled={disabled || isFinished}
                    aria-pressed={chosen === "smooth_surface"}
                    onClick={() =>
                      updateComparisonState(
                        { ...critMap, [crit.criterionId]: "smooth_surface" },
                        selectedConcId,
                      )
                    }
                    className={`btn btn--touch ${
                      chosen === "smooth_surface"
                        ? "btn--selected-state"
                        : "btn--secondary"
                    }`}
                  >
                    النموذج (أ): السطح الأملس
                  </button>
                  <button
                    type="button"
                    disabled={disabled || isFinished}
                    aria-pressed={chosen === "villi_surface"}
                    onClick={() =>
                      updateComparisonState(
                        { ...critMap, [crit.criterionId]: "villi_surface" },
                        selectedConcId,
                      )
                    }
                    className={`btn btn--touch ${
                      chosen === "villi_surface"
                        ? "btn--selected-state"
                        : "btn--secondary"
                    }`}
                  >
                    النموذج (ب): السطح ذو الخملات
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="villi-conclusion-section"
          role="radiogroup"
          aria-label="استنتاج المقارنة العلمية"
        >
          <h4>الخطوة ٢: {cfg.conclusionPromptAr}</h4>
          <div className="options-list">
            {cfg.conclusionOptions.map((opt) => {
              const isSelected = selectedConcId === opt.optionId;
              return (
                <label
                  key={opt.optionId}
                  className={`option-item ${
                    isSelected
                      ? "option-item--selected-unsubmitted"
                      : "option-item--idle"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${activity.activityId}-conclusion`}
                    value={opt.optionId}
                    checked={isSelected}
                    disabled={disabled || isFinished}
                    onChange={() =>
                      updateComparisonState(critMap, opt.optionId)
                    }
                    className="option-item__radio"
                  />
                  <span className="option-item__content">
                    <span className="option-item__label">{opt.labelAr}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const encouragementHeading = latestAttempt
    ? getCorrectEncouragementHeadingAr(
        studentName,
        latestAttempt.attemptNumber ?? 1,
        activityIndex,
      )
    : "";

  return (
    <section
      id={`activity-card-${activity.activityId}`}
      className="activity-card"
      data-activity-id={activity.activityId}
      data-activity-state={machine.state}
      aria-labelledby={`heading-${activity.activityId}`}
    >
      <div className="activity-card__header">
        <div className="activity-card__title-group">
          <span className="status-chip status-chip--neutral">
            النشاط {activityIndex + 1} من {totalActivitiesInLevel} •{" "}
            {activity.maxScore} نقاط
          </span>
          <h3
            id={`heading-${activity.activityId}`}
            className="activity-card__title"
          >
            {activity.titleAr}
          </h3>
        </div>

        {/* Consistent Attempt Indicator in one fixed header location */}
        <div className="activity-card__status-badges">
          <span
            data-testid="attempt-indicator"
            role="status"
            className={`status-chip ${
              machine.isCompleted
                ? machine.isMastered
                  ? "status-chip--correct"
                  : "status-chip--selected"
                : machine.hasFailedFirstAttemptOnly
                  ? "status-chip--selected"
                  : "status-chip--neutral"
            }`}
          >
            {machine.isCompleted ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <CircleDot size={16} aria-hidden="true" />
            )}
            <span>{machine.attemptIndicatorTextAr}</span>
          </span>
        </div>
      </div>

      <p className="activity-card__prompt">{activity.promptAr}</p>

      {/* First-error feedback:
          - One compact hint card
          - Heading: «تلميح»
          - One activity-specific hint in a consistent readable text size
          - No repeated "try again" paragraphs, competing font sizes, or premature solution disclosure
          - Remaining-attempt information stays in the attempt indicator above */}
      {machine.showFirstErrorHintCard && (
        <aside
          className="first-error-hint-card"
          role="note"
          aria-label="تلميح"
          data-testid="first-error-hint-card"
        >
          <div className="first-error-hint-card__header">
            <Lightbulb size={18} aria-hidden="true" />
            <h4 className="first-error-hint-card__title">تلميح</h4>
          </div>
          <p className="first-error-hint-card__body">
            {stateGatedDisclosure.revealedHintAr || activity.scientificHintAr}
          </p>
        </aside>
      )}

      {validationAlertAr && !machine.isCompleted && (
        <div
          className="ds-callout ds-callout--warning"
          role="alert"
          data-testid="incomplete-input-alert"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{validationAlertAr}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="activity-card__form" noValidate>
        {activity.type === "multiple_choice" && renderMultipleChoice()}
        {activity.type === "fill_in" && renderFillIn()}
        {activity.type === "ordering" && renderOrdering()}
        {activity.type === "matching" && renderMatching()}
        {activity.type === "image_identification" &&
          renderImageIdentification()}
        {activity.type === "villi_comparison" && renderVilliComparison()}

        <div className="activity-card__actions">
          {!machine.isCompleted && (
            <button
              type="submit"
              className="btn btn--primary btn--touch"
              disabled={disabled || isSubmittingTransient}
              data-ready={isReadyToSubmit ? "true" : "false"}
            >
              <Send size={18} aria-hidden="true" />
              <span>
                {machine.hasFailedFirstAttemptOnly
                  ? "تأكيد وإرسال المحاولة الثانية"
                  : "تأكيد وإرسال الإجابة"}
              </span>
            </button>
          )}

          {effectiveDraft && !disabled && !machine.isCompleted && (
            <button
              type="button"
              className="btn btn--ghost btn--touch"
              onClick={handleResetSelection}
            >
              <RotateCcw size={17} aria-hidden="true" />
              <span>إعادة ضبط الاختيار</span>
            </button>
          )}
        </div>
      </form>

      {/* Terminal Completed Feedback (Correct on 1st/2nd attempt, OR Incorrect on 2nd attempt) */}
      {machine.isCompleted && latestAttempt && (
        <div
          className={`feedback-panel ${
            machine.isMastered
              ? "feedback-panel--correct"
              : "feedback-panel--incorrect"
          }`}
          role="alert"
          aria-live="polite"
          data-testid="completed-feedback-panel"
        >
          <div className="feedback-panel__header">
            {machine.isMastered ? (
              <span className="status-chip status-chip--correct">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{encouragementHeading}</span>
              </span>
            ) : (
              <span className="status-chip status-chip--incorrect">
                <XCircle size={18} aria-hidden="true" />
                <span>
                  انتهت المحاولتان{nameSalutation} — تعرّف على الحل الصحيح وشرحه
                  العلمي
                </span>
              </span>
            )}
          </div>

          {/* Prominent Structured Reward Points Card */}
          <div
            className={`reward-points-card ${
              machine.isMastered
                ? "reward-points-card--earned"
                : "reward-points-card--zero"
            }`}
            data-testid="activity-reward-points-card"
          >
            <div className="reward-points-card__badge">
              <Award size={20} aria-hidden="true" />
              <div>
                <span className="reward-points-card__label">
                  النقاط المكتسبة في هذا النشاط
                </span>
                <strong className="reward-points-card__score">
                  +{machine.earnedScore} من {activity.maxScore} نقاط
                </strong>
              </div>
            </div>
            <span className="reward-points-card__tier">
              {machine.isMastered
                ? latestAttempt.attemptNumber === 1
                  ? "نقاط النشاط كاملة (من المحاولة الأولى)"
                  : "نصف نقاط النشاط (من المحاولة الثانية)"
                : "٠ نقاط — لا تُخصم أي نقاط بسبب الخطأ"}
            </span>
          </div>

          {/* Why the answer is correct / scientific explanation */}
          <div className="feedback-panel__explanation-block">
            <strong>التفسير العلمي:</strong>
            <p className="feedback-panel__explanation">
              {stateGatedDisclosure.revealedExplanationAr ||
                activity.scientificExplanationAr}
            </p>
          </div>

          {/* Reveal correct solution on 2nd incorrect attempt */}
          {machine.hasExhaustedBothAttempts && (
            <div
              className="solution-reveal-box"
              data-testid="solution-reveal-box"
            >
              <strong>
                الحل العلمي الصحيح:{" "}
                {correctOption?.labelAr ||
                  buildHumanReadableSolutionAr(activity) ||
                  stateGatedDisclosure.revealedSolutionSummaryAr}
              </strong>
              {correctOption?.feedbackAr && <p>{correctOption.feedbackAr}</p>}
            </div>
          )}

          {/* Clear Next Action */}
          {onNextAction && nextActionLabelAr && (
            <div className="feedback-panel__next-action">
              <button
                type="button"
                className="btn btn--primary btn--touch"
                onClick={onNextAction}
                data-testid="feedback-next-action-btn"
              >
                <span>{nextActionLabelAr}</span>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
