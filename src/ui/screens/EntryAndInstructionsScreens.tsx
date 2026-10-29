import React, { useEffect, useState } from 'react';
import {
  Award,
  Calculator,
  CheckCircle2,
  HelpCircle,
  LifeBuoy,
  LockOpen,
  Sparkles,
} from 'lucide-react';
import type {
  InstructionCardDefinition,
  InstructionIconKey,
} from '../../content/schema';
import {
  DEFAULT_AVATAR_ID,
  normalizeAvatarId,
  type AppOperatingMode,
  type AvatarId,
  type StudentProfile,
  type StudentProgressState,
} from '../../domain/types';
import {
  AVATAR_OPTIONS,
  StudentAvatarIllustration,
} from '../illustrations/TransparentIllustrations';

interface StudentEntryScreenProps {
  readonly mode: AppOperatingMode;
  readonly activeStudent: StudentProfile | null;
  readonly onStartOrUpdateSession: (
    displayName: string,
    avatarId: AvatarId,
    startFreshSession: boolean
  ) => void;
  readonly onLiveAvatarChange: (avatarId: AvatarId) => void;
  readonly onContinueExistingSession: () => void;
  readonly onNavigateInstructions: () => void;
  readonly onNavigateAdmin: () => void;
}

export const StudentEntryScreen: React.FC<StudentEntryScreenProps> = ({
  mode,
  activeStudent,
  onStartOrUpdateSession,
  onLiveAvatarChange,
  onContinueExistingSession,
  onNavigateInstructions,
}) => {
  const [studentName, setStudentName] = useState<string>(
    () => activeStudent?.displayName ?? ''
  );
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>(() =>
    activeStudent ? normalizeAvatarId(activeStudent.avatarId) : DEFAULT_AVATAR_ID
  );

  useEffect(() => {
    if (activeStudent) {
      setStudentName(activeStudent.displayName);
      setSelectedAvatar(normalizeAvatarId(activeStudent.avatarId));
    }
  }, [activeStudent]);

  const handleAvatarSelect = (avatarId: AvatarId) => {
    setSelectedAvatar(avatarId);
    // Selecting an avatar on an active session updates only the visual avatar without altering scores or identity
    if (activeStudent) {
      onLiveAvatarChange(avatarId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentName.trim();
    if (!trimmed) return;
    onStartOrUpdateSession(trimmed, selectedAvatar, false);
  };

  const handleStartBrandNewDemoSession = () => {
    if (mode !== 'demo') return;
    const trimmed = studentName.trim() || 'مستكشف الهضم';
    onStartOrUpdateSession(trimmed, selectedAvatar, true);
  };

  const girlsAvatars = AVATAR_OPTIONS.filter((a) => a.genderGroup === 'girl');
  const boysAvatars = AVATAR_OPTIONS.filter((a) => a.genderGroup === 'boy');

  return (
    <div className="screen-container entry-layout">
      <section className="entry-story"><span className="editorial-eyebrow">العلوم · الصف السادس الابتدائي</span><h1>كل لقمة<br/>وراها حكاية.</h1><p>جاهز تكتشف جسمك من جوّه؟<br/>جرّب، اتعلّم، واجمع شاراتك خطوة بخطوة.</p><div className="entry-story__art"><img src="/assets/3d/boy-omar.webp" alt="المستكشف الصغير"/><img src="/assets/3d/anatomy.webp" alt="نموذج ثلاثي الأبعاد للجهاز الهضمي"/></div><div className="entry-facts"><span><b>٦</b> مستويات</span><span><b>٢٦</b> نشاطًا</span><span><b>٦</b> شارات</span></div></section>
      <section className="surface-card entry-onboarding-card" aria-labelledby="entry-title">
        <span className="editorial-eyebrow">رحلتك تبدأ من هنا</span>
        <h2 id="entry-title">{activeStudent ? `أهلاً بعودتك يا ${activeStudent.displayName}!` : 'نقولك يا إيه؟'}</h2><p className="screen-lead">اكتب اسمك واختار صاحب رحلتك.</p>
        {activeStudent && <button className="btn btn--secondary btn--full" onClick={onContinueExistingSession}>كمّل رحلتك من مكانك ←</button>}
        <form onSubmit={handleSubmit} className="ds-form">
          <div className="form-field"><label htmlFor="student-name-input" className="form-label">اسمك</label><input id="student-name-input" className="form-input" value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="اكتب اسمك هنا…" autoComplete="given-name" maxLength={40} required/><small className="field-hint">اسمك الأول كفاية. مش محتاج كلمة سر.</small></div>
          <fieldset className="avatar-fieldset"><legend className="form-label">اختار شخصيتك</legend><div className="avatar-picker-compact">{[...girlsAvatars,...boysAvatars].map(av=><label key={av.id} className={`avatar-choice ${selectedAvatar===av.id?'avatar-choice--selected':''}`}><input type="radio" name="student-avatar" checked={selectedAvatar===av.id} onChange={()=>handleAvatarSelect(av.id)} className="sr-only-radio"/><StudentAvatarIllustration avatarId={av.id} size={110}/><span>{av.nameAr}</span>{selectedAvatar===av.id&&<span className="avatar-check" aria-label="محددة">✓</span>}</label>)}</div></fieldset>
          <button type="submit" className="btn btn--primary btn--touch btn--full">{activeStudent?'حفظ ومتابعة الرحلة ←':'يلا نبدأ الرحلة ←'}</button>
          {mode==='demo'&&activeStudent&&<button type="button" className="btn btn--ghost btn--full" onClick={handleStartBrandNewDemoSession}>ابدأ باسم جديد على الجهاز</button>}
        </form>
        <p className="entry-footnote">تقدمك بيرجع لما تفتح من نفس المتصفح.</p><button className="entry-help" onClick={onNavigateInstructions}>إزاي ألعب؟</button>
      </section>
    </div>
  );
};

function renderInstructionCardIcon(iconKey: InstructionIconKey) {
  switch (iconKey) {
    case 'sparkles-points':
      return <Sparkles size={26} aria-hidden="true" />;
    case 'two-attempts-help':
      return <LifeBuoy size={26} aria-hidden="true" />;
    case 'score-calculator':
      return <Calculator size={26} aria-hidden="true" />;
    case 'badge-medal':
      return <Award size={26} aria-hidden="true" />;
    case 'unlock-next':
    default:
      return <LockOpen size={26} aria-hidden="true" />;
  }
}

interface FiveCardInstructionsScreenProps {
  readonly titleAr: string;
  readonly subtitleAr: string;
  readonly cards: readonly InstructionCardDefinition[];
  readonly reminderAr: string;
  readonly primaryActionAr: string;
  readonly progressState: StudentProgressState | null;
  readonly onPrimaryAction: () => void;
}

export const FiveCardInstructionsScreen: React.FC<
  FiveCardInstructionsScreenProps
> = ({
  titleAr,
  subtitleAr,
  cards,
  reminderAr,
  primaryActionAr,
  progressState,
  onPrimaryAction,
}) => {
  const studentName = progressState?.student.displayName;

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="instructions-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--neutral">
              {studentName
                ? `مرحباً يا ${studentName} • قواعد الرحلة الخمس`
                : 'قواعد الرحلة الخمس'}
            </span>
            <h1 id="instructions-heading" className="screen-title">
              {titleAr}
            </h1>
            <p className="screen-lead">{subtitleAr}</p>
          </div>

          {progressState?.hasCompletedInstructions && (
            <span className="status-chip status-chip--correct">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>تقدمك ومسودات إجاباتك محفوظة بالكامل ✓</span>
            </span>
          )}
        </div>

        {/* Five Concise Cards with Meaningful Icons */}
        <div
          className="five-rules-grid"
          role="list"
          aria-label={titleAr}
        >
          {cards.map((card) => (
            <article
              key={card.id}
              role="listitem"
              className="rule-card"
            >
              <div className="rule-card__top">
                <span className="rule-card__icon-box">
                  {renderInstructionCardIcon(card.iconKey)}
                </span>
                <span className="rule-card__number">
                  القاعدة {card.cardNumber}
                </span>
              </div>
              <h2 className="rule-card__title">{card.titleAr}</h2>
              <p className="rule-card__body">{card.bodyAr}</p>
            </article>
          ))}
        </div>

        {/* Authoritative Reminder Banner */}
        <div className="ds-callout ds-callout--hint" role="note">
          <HelpCircle size={22} aria-hidden="true" />
          <p className="instructions-reminder-text">{reminderAr}</p>
        </div>

        {/* Primary Action Button */}
        <div className="instructions-primary-action-row">
          <button
            type="button"
            className="btn btn--primary btn--touch instructions-cta-btn"
            onClick={onPrimaryAction}
          >
            <span>{primaryActionAr}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
