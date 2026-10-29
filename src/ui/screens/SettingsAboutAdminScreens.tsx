import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  FileWarning,
  Info,
  KeyRound,
  Lock,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Type,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  getAdminFullManifestForVersion,
  validateDraftManifestForPublication,
} from '../../backend/answerKeyVault';
import type {
  BackendHealthReport,
  BackendPort,
  ContentVersionSummary,
} from '../../backend/backendPort';
import type { AppEnvironmentConfig } from '../../config/env';
import {
  ANATOMICAL_ASSET_MANIFEST,
  type AnatomicalAssetId,
} from '../../content/assetManifest';
import type {
  CurriculumManifest,
  LearningActivityDefinition,
} from '../../content/schema';
import { asContentVersionId, type ContentVersionId } from '../../domain/ids';
import type {
  AccessibilitySettings,
  AppOperatingMode,
  FontScaleOption,
  StudentProgressState,
  UnresolvedDependencyRecord,
} from '../../domain/types';
import {
  getDeveloperAttribution,
  initializeLocalAdminPasscode,
  isAdminPasscodeInitialized,
  isAdminSessionUnlocked,
  lockAdminSession,
  saveDeveloperAttributionOverride,
} from '../../persistence/adminStorage';

interface AccessibilitySettingsScreenProps {
  readonly settings: AccessibilitySettings;
  readonly onUpdateSettings: (next: AccessibilitySettings) => void;
}

const FONT_SCALE_OPTIONS: readonly {
  readonly id: FontScaleOption;
  readonly labelAr: string;
  readonly percentText: string;
}[] = [
  { id: 'normal', labelAr: 'الحجم القياسي (١٠٠٪)', percentText: '100%' },
  { id: 'large', labelAr: 'كبير (١١٢.٥٪)', percentText: '112.5%' },
  { id: 'xlarge', labelAr: 'كبير جداً (١٢٥٪)', percentText: '125%' },
  { id: 'xxlarge', labelAr: 'أكبر للوضوح العالي (١٣٧.٥٪)', percentText: '137.5%' },
];

export const AccessibilitySettingsScreen: React.FC<
  AccessibilitySettingsScreenProps
> = ({ settings, onUpdateSettings }) => {
  const handleFontScaleChange = (fontScale: FontScaleOption) => {
    onUpdateSettings({ ...settings, fontScale });
  };

  const handleResetDefaults = () => {
    onUpdateSettings({
      fontScale: 'normal',
      highContrast: false,
      reducedMotion: false,
      enhancedFocus: true,
      soundMuted: false,
    });
  };

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="a11y-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--neutral">
              تخصيص القراءة والوصول الشامل
            </span>
            <h1 id="a11y-heading" className="screen-title">
              إعدادات إمكانية الوصول والعرض
            </h1>
            <p className="screen-lead">
              يتم حفظ تفضيلاتك تلقائياً وتطبيقها فوراً على جميع شاشات التطبيق مع
              إعادة تدفق النصوص بسلاسة دون أي اقتطاع.
            </p>
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--touch"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={17} aria-hidden="true" />
            <span>استعادة الإعدادات الافتراضية</span>
          </button>
        </div>

        {/* Persistent Font-Size Control */}
        <div className="a11y-section">
          <div className="section-header-inline">
            <Type size={20} aria-hidden="true" />
            <h2>التحكم المستدام في حجم الخط العربي</h2>
          </div>

          <div
            className="font-scale-grid"
            role="radiogroup"
            aria-label="حجم الخط العربي"
          >
            {FONT_SCALE_OPTIONS.map((opt) => {
              const isSelected = settings.fontScale === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`font-scale-card btn--touch ${
                    isSelected ? 'font-scale-card--selected' : ''
                  }`}
                  onClick={() => handleFontScaleChange(opt.id)}
                >
                  <strong>{opt.labelAr}</strong>
                  <span className="status-chip status-chip--selected">
                    {isSelected ? `✓ مفعّل (${opt.percentText})` : opt.percentText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contrast, Motion, Focus Controls */}
        <div className="a11y-toggles-grid">
          <div className="a11y-toggle-card">
            <div>
              <h3>وضع التباين العالي (High Contrast)</h3>
              <p>
                يزيد من حدة تباين النصوص والحدود والأزرار لتسهيل القراءة لضعاف
                البصر.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.highContrast}
              className={`btn btn--touch ${
                settings.highContrast ? 'btn--primary' : 'btn--secondary'
              }`}
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  highContrast: !settings.highContrast,
                })
              }
            >
              <span>
                {settings.highContrast ? '✓ التباين العالي مفعّل' : '○ تفعيل التباين العالي'}
              </span>
            </button>
          </div>

          <div className="a11y-toggle-card">
            <div>
              <h3>تقليل الحركة والتأثيرات (Reduced Motion)</h3>
              <p>
                يلغي انتقالات الحركة السريعة لتوفير تجربة هادئة ومريحة للتركيز.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reducedMotion}
              className={`btn btn--touch ${
                settings.reducedMotion ? 'btn--primary' : 'btn--secondary'
              }`}
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  reducedMotion: !settings.reducedMotion,
                })
              }
            >
              <span>
                {settings.reducedMotion ? '✓ تقليل الحركة مفعّل' : '○ تفعيل تقليل الحركة'}
              </span>
            </button>
          </div>

          <div className="a11y-toggle-card">
            <div>
              <h3>إبراز مؤشر التركيز للوحة المفاتيح (Visible Focus)</h3>
              <p>
                يعرض إطاراً واضحاً وعالي التباين حول العنصر النشط عند التنقل بزر
                Tab.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enhancedFocus}
              className={`btn btn--touch ${
                settings.enhancedFocus ? 'btn--primary' : 'btn--secondary'
              }`}
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  enhancedFocus: !settings.enhancedFocus,
                })
              }
            >
              <span>
                {settings.enhancedFocus ? '✓ إطار التركيز الواضح مفعّل' : '○ تفعيل إطار التركيز'}
              </span>
            </button>
          </div>

          <div className="a11y-toggle-card">
            <div>
              <h3>كتم المؤثرات الصوتية الخفيفة (Mute Sound Effects)</h3>
              <p>
                يتحكم في المؤثرات الصوتية القصيرة لتأكيد الإجابة والنجاح والشارة
                (لا توجد موسيقى خلفية أو مؤقت زمني).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.soundMuted)}
              className={`btn btn--touch ${
                settings.soundMuted ? 'btn--primary' : 'btn--secondary'
              }`}
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  soundMuted: !Boolean(settings.soundMuted),
                })
              }
            >
              <span>
                {settings.soundMuted
                  ? '✓ الصوت مكتوم حالياً'
                  : '○ المؤثرات الصوتية مفعّلة'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Reflow Sample Box */}
        <div className="ds-callout ds-callout--hint">
          <Eye size={20} aria-hidden="true" />
          <div>
            <strong>معاينة مباشرة لوضوح النص وإعادة التدفق:</strong>
            <p>
              تبدأ عملية الهضم في الفم، حيث تقطع الأسنان الطعام وتطحنه، ويمزجه
              اللسان باللعاب المحتوي على إنزيم الأميليز لتحويل النشويات إلى
              سكريات أبسط.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

interface AboutScreenProps {
  readonly manifest: CurriculumManifest;
  readonly env: AppEnvironmentConfig;
  readonly onOpenAdmin: () => void;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({
  manifest,
  env,
  onOpenAdmin,
}) => {
  const developerAttribution = getDeveloperAttribution(env);

  return (
    <div className="screen-container">
      <section className="surface-card about-card" aria-labelledby="about-heading">
        <span className="status-chip status-chip--neutral">
          بطاقة تعريف المشروع الأكاديمي
        </span>
        <h1 id="about-heading" className="screen-title">
          حول مشروع «رحلة الهضم»
        </h1>

        {/* Authoritative Required About Text */}
        <blockquote className="authoritative-about-quote">
          «{manifest.aboutTextAr}»
        </blockquote>

        <div className="about-details-grid">
          <div className="info-card">
            <h2>البيانات الأكاديمية والتربوية</h2>
            <ul>
              <li>
                <strong>اسم التطبيق:</strong> {manifest.titleAr}
              </li>
              <li>
                <strong>الفئة المستهدفة:</strong> {manifest.gradeAr}
              </li>
              <li>
                <strong>المادة العلمية:</strong> {manifest.subjectAr}
              </li>
              <li>
                <strong>إصدار المحتوى المعتمد:</strong>{' '}
                <code>{manifest.contentVersionId}</code>
              </li>
            </ul>
          </div>

          <div className="info-card">
            <h2>التنفيذ البرمجي (قابل للضبط)</h2>
            <p>
              وفقاً لقواعد النزاهة التوثيقية، لا يتم اختلاق اسم المبرمج تلقائياً،
              ويُترك حقل التنفيذ البرمجي قابلاً للضبط عبر المتغير البيئي{' '}
              <code>VITE_DEVELOPER_ATTRIBUTION</code> أو من خلال منطقة المسؤول.
            </p>
            <div className="attribution-status-box">
              <strong>البيان البرمجي المسجل حالياً:</strong>
              <span>
                {developerAttribution
                  ? developerAttribution
                  : 'غير محدد حالياً (قابل للضبط من قِبل المسؤول)'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--touch"
              onClick={onOpenAdmin}
            >
              <Sliders size={16} aria-hidden="true" />
              <span>ضبط البيان البرمجي في منطقة المسؤول المحمية</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

interface ProtectedAdminAreaScreenProps {
  readonly env: AppEnvironmentConfig;
  readonly manifest: CurriculumManifest;
  readonly backend: BackendPort;
  readonly storageNamespace: string;
  readonly allStates: readonly StudentProgressState[];
  readonly backendHealth: BackendHealthReport | null;
  readonly unresolvedDependencies: readonly UnresolvedDependencyRecord[];
  readonly onSwitchMode: (mode: AppOperatingMode) => void;
  readonly onClearDemoData: () => void;
  readonly onSelectActivePublishedVersion?: (versionId: ContentVersionId) => void;
}

export const ProtectedAdminAreaScreen: React.FC<
  ProtectedAdminAreaScreenProps
> = ({
  env,
  manifest,
  backend,
  storageNamespace,
  allStates,
  backendHealth,
  unresolvedDependencies,
  onSwitchMode,
  onClearDemoData,
  onSelectActivePublishedVersion,
}) => {
  const [unlocked, setUnlocked] = useState<boolean>(() =>
    env.mode === 'demo' ? isAdminSessionUnlocked() : false
  );
  const [passcodeInitialized, setPasscodeInitialized] = useState<boolean>(() =>
    isAdminPasscodeInitialized(env)
  );
  const [adminEmailInput, setAdminEmailInput] = useState<string>('');
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [devAttributionInput, setDevAttributionInput] = useState<string>(
    () => getDeveloperAttribution(env) ?? ''
  );
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Stage 7 CMS state: Versions, Draft Creator, Activity Editor, Pre-Publication Validator
  const [versionsList, setVersionsList] = useState<
    readonly ContentVersionSummary[]
  >([]);
  const [selectedCmsVersionId, setSelectedCmsVersionId] =
    useState<ContentVersionId>(manifest.contentVersionId);
  const [newDraftVersionInput, setNewDraftVersionInput] = useState<string>(
    'content-ar-g6-digestion-v1.5.0'
  );
  const [selectedActivityIdForEdit, setSelectedActivityIdForEdit] =
    useState<string>('act-l1-1');
  const [cmsFeedbackNotice, setCmsFeedbackNotice] = useState<{
    readonly ok: boolean;
    readonly textAr: string;
  } | null>(null);
  const [cmsVersionBump, setCmsVersionBump] = useState<number>(0);

  // Check backend admin status on mount/mode change
  useEffect(() => {
    let cancelled = false;
    if (env.mode === 'production') {
      backend.getAdminSessionStatus().then((st) => {
        if (!cancelled) {
          setUnlocked(st.isAuthenticatedAdmin);
        }
      });
    } else {
      setUnlocked(isAdminSessionUnlocked());
    }
    return () => {
      cancelled = true;
    };
  }, [env, backend]);

  // Load CMS versions list when unlocked
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    backend.listContentVersions().then((list) => {
      if (!cancelled && list.length > 0) {
        setVersionsList(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [unlocked, backend, cmsVersionBump]);

  const currentVersionSummary = useMemo(
    () =>
      versionsList.find((v) => v.contentVersionId === selectedCmsVersionId) ??
      versionsList[0] ??
      null,
    [versionsList, selectedCmsVersionId]
  );

  const selectedFullManifest = useMemo(() => {
    void cmsVersionBump;
    return getAdminFullManifestForVersion(selectedCmsVersionId);
  }, [selectedCmsVersionId, cmsVersionBump]);

  const allActivitiesInSelectedVersion = useMemo(() => {
    const list: {
      readonly levelOrder: number;
      readonly levelTitleAr: string;
      readonly activity: LearningActivityDefinition;
    }[] = [];
    for (const lvl of selectedFullManifest.levels) {
      for (const act of lvl.activities) {
        list.push({
          levelOrder: lvl.order,
          levelTitleAr: lvl.stationNameAr,
          activity: act,
        });
      }
    }
    return list;
  }, [selectedFullManifest]);

  const selectedActivityRecord = useMemo(() => {
    return (
      allActivitiesInSelectedVersion.find(
        (item) => item.activity.activityId === selectedActivityIdForEdit
      )?.activity ??
      allActivitiesInSelectedVersion[0]?.activity ??
      null
    );
  }, [allActivitiesInSelectedVersion, selectedActivityIdForEdit]);

  // Editable form fields for the selected activity
  const [editTitleAr, setEditTitleAr] = useState<string>('');
  const [editPromptAr, setEditPromptAr] = useState<string>('');
  const [editCorrectOptionId, setEditCorrectOptionId] = useState<string>('');
  const [editHintAr, setEditHintAr] = useState<string>('');
  const [editExplanationAr, setEditExplanationAr] = useState<string>('');
  const [editOptionsJsonText, setEditOptionsJsonText] = useState<string>('');
  const [editAssetId, setEditAssetId] = useState<string>('');

  useEffect(() => {
    if (!selectedActivityRecord) return;
    setEditTitleAr(selectedActivityRecord.titleAr);
    setEditPromptAr(selectedActivityRecord.promptAr);
    setEditCorrectOptionId(selectedActivityRecord.correctOptionId);
    setEditHintAr(selectedActivityRecord.scientificHintAr);
    setEditExplanationAr(selectedActivityRecord.scientificExplanationAr);
    setEditOptionsJsonText(
      JSON.stringify(selectedActivityRecord.options, null, 2)
    );
    setEditAssetId(
      selectedActivityRecord.imageIdentificationConfig?.assetId ??
        selectedActivityRecord.villiComparisonConfig?.assetId ??
        ''
    );
  }, [selectedActivityRecord, selectedCmsVersionId]);

  const publicationValidation = useMemo(
    () => validateDraftManifestForPublication(selectedFullManifest),
    [selectedFullManifest]
  );

  const handleSetupPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim().length < 4) {
      setAuthError('يرجى إدخال رمز مرور للمسؤول مكوّن من ٤ خانات على الأقل.');
      return;
    }
    const ok = initializeLocalAdminPasscode(passcodeInput);
    if (ok) {
      setPasscodeInitialized(true);
      setUnlocked(true);
      setPasscodeInput('');
      setAuthError(null);
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (env.mode === 'production') {
      const res = await backend.signInAdmin({
        email: adminEmailInput,
        password: passcodeInput,
      });
      if (res.ok) {
        setUnlocked(true);
        setPasscodeInput('');
        setAuthError(null);
      } else {
        setAuthError(
          res.errorAr ?? 'فشل التحقق من صلاحية المشرف على خادم الإنتاج.'
        );
      }
      return;
    }

    const res = await backend.signInAdmin({ password: passcodeInput });
    if (res.ok) {
      setUnlocked(true);
      setPasscodeInput('');
      setAuthError(null);
    } else {
      setAuthError('رمز مرور المسؤول غير صحيح. حاول مرة أخرى.');
    }
  };

  const handleLock = async () => {
    lockAdminSession();
    await backend.signOutAdmin();
    setUnlocked(false);
  };

  const handleSaveAttribution = (e: React.FormEvent) => {
    e.preventDefault();
    saveDeveloperAttributionOverride(devAttributionInput);
    setSaveNotice('تم حفظ بيان التنفيذ البرمجي القابل للضبط بنجاح.');
  };

  const handleCreateDraftVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await backend.createDraftVersion(
      newDraftVersionInput,
      selectedCmsVersionId
    );
    setCmsFeedbackNotice({ ok: res.ok, textAr: res.messageAr });
    if (res.ok && res.versionSummary) {
      setCmsVersionBump((v) => v + 1);
      setSelectedCmsVersionId(res.versionSummary.contentVersionId);
    }
  };

  const handleSaveActivityDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivityRecord) return;

    let parsedOptions = selectedActivityRecord.options;
    try {
      const parsed = JSON.parse(editOptionsJsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setCmsFeedbackNotice({
          ok: false,
          textAr: 'قائمة الخيارات يجب أن تكون مصفوفة JSON غير فارغة.',
        });
        return;
      }
      parsedOptions = parsed;
    } catch {
      setCmsFeedbackNotice({
        ok: false,
        textAr: 'صيغة JSON الخاصة بالخيارات غير صالحة.',
      });
      return;
    }

    const updatedActivity: LearningActivityDefinition = {
      ...selectedActivityRecord,
      titleAr: editTitleAr,
      promptAr: editPromptAr,
      correctOptionId: editCorrectOptionId,
      scientificHintAr: editHintAr,
      scientificExplanationAr: editExplanationAr,
      options: parsedOptions,
      imageIdentificationConfig:
        selectedActivityRecord.imageIdentificationConfig && editAssetId
          ? {
              ...selectedActivityRecord.imageIdentificationConfig,
              assetId: editAssetId as AnatomicalAssetId,
            }
          : selectedActivityRecord.imageIdentificationConfig,
    };

    const res = await backend.saveActivityDraft(
      selectedCmsVersionId,
      updatedActivity
    );
    setCmsFeedbackNotice({ ok: res.ok, textAr: res.messageAr });
    if (res.ok) {
      setCmsVersionBump((v) => v + 1);
    }
  };

  const handlePublishDraftVersion = async () => {
    const res = await backend.publishDraftVersion(selectedCmsVersionId);
    setCmsFeedbackNotice({ ok: res.ok, textAr: res.messageAr });
    if (res.ok && res.publishedVersionId) {
      setCmsVersionBump((v) => v + 1);
      if (onSelectActivePublishedVersion) {
        onSelectActivePublishedVersion(res.publishedVersionId);
      }
    }
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await backend.uploadCurriculumAsset(file.name, file);
    setCmsFeedbackNotice({ ok: res.ok, textAr: res.messageAr });
  };

  const handleExportJson = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      mode: env.mode,
      storageNamespace,
      contentVersionId: manifest.contentVersionId,
      studentsCount: allStates.length,
      records: allStates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rehlat-alhadm-${env.mode}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!unlocked) {
    return (
      <div className="screen-container">
        <section
          className="surface-card admin-gate-card"
          aria-labelledby="admin-gate-heading"
        >
          <div className="section-header-inline">
            <Lock size={22} aria-hidden="true" />
            <h1 id="admin-gate-heading" className="screen-title">
              منطقة المسؤول المحمية (Administrator Area)
            </h1>
          </div>

          <p className="screen-lead">
            هذه المنطقة مخصصة للمعلم أو مسؤول النظام لإدارة بيئة التشغيل
            (Demo / Production)، وتحرير المحتوى التعليمي وإصداراته، ومراجعة سجلات
            الطلاب الفعلية.
          </p>

          {env.mode === 'production' ? (
            <form onSubmit={handleVerifyPasscode} className="ds-form">
              <div className="ds-callout ds-callout--hint">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>مصادقة المشرف المستقلة لبيئة الإنتاج (Supabase Auth + RLS):</strong>
                  <p>
                    في وضع الإنتاج، يتم التحقق من هوية المشرف وصلاحياته على الخادم
                    عبر <code>public.is_authenticated_admin()</code> وجدول{' '}
                    <code>public.admin_roles</code>، وليس بمجرد إخفاء الأزرار في
                    المتصفح.
                  </p>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="admin-prod-email" className="form-label">
                  البريد الإلكتروني لحساب المشرف (Supabase Auth)
                </label>
                <input
                  id="admin-prod-email"
                  type="email"
                  className="form-input"
                  placeholder="admin@school.edu.eg"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="admin-verify-pass" className="form-label">
                  كلمة المرور
                </label>
                <input
                  id="admin-verify-pass"
                  type="password"
                  className="form-input"
                  placeholder="كلمة مرور المشرف..."
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  required
                />
              </div>

              {authError && (
                <div className="ds-callout ds-callout--error" role="alert">
                  <span>{authError}</span>
                </div>
              )}

              <div className="header-actions-inline">
                <button type="submit" className="btn btn--primary btn--touch">
                  <Unlock size={18} aria-hidden="true" />
                  <span>مصادقة المشرف عبر خادم الإنتاج</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  onClick={() => onSwitchMode('demo')}
                >
                  <span>العودة إلى وضع العرض المحلي (Demo)</span>
                </button>
              </div>
            </form>
          ) : !passcodeInitialized ? (
            <form onSubmit={handleSetupPasscode} className="ds-form">
              <div className="ds-callout ds-callout--hint">
                <Info size={18} aria-hidden="true" />
                <div>
                  <strong>إعداد رمز مرور المسؤول لأول مرة على هذا الجهاز:</strong>
                  <p>
                    لا يتم تضمين أي كلمات سر ثابتة داخل الكود المصدري. قم بتعيين
                    رمز مرور محلي للمسؤول (٤ خانات على الأقل) لحماية هذه اللوحة.
                  </p>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="admin-setup-pass" className="form-label">
                  تعيين رمز مرور المسؤول الجديد
                </label>
                <input
                  id="admin-setup-pass"
                  type="password"
                  className="form-input"
                  placeholder="أدخل رمزاً من ٤ خانات أو أكثر..."
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  required
                />
              </div>

              {authError && (
                <div className="ds-callout ds-callout--error" role="alert">
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" className="btn btn--primary btn--touch">
                <KeyRound size={18} aria-hidden="true" />
                <span>حفظ الرمز وفتح منطقة المسؤول</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPasscode} className="ds-form">
              <div className="form-field">
                <label htmlFor="admin-verify-pass" className="form-label">
                  أدخل رمز مرور المسؤول للدخول
                </label>
                <input
                  id="admin-verify-pass"
                  type="password"
                  className="form-input"
                  placeholder="رمز المرور..."
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  required
                />
              </div>

              {authError && (
                <div className="ds-callout ds-callout--error" role="alert">
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" className="btn btn--primary btn--touch">
                <Unlock size={18} aria-hidden="true" />
                <span>تحقق وفتح لوحة المسؤول</span>
              </button>
            </form>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <section className="surface-card" aria-labelledby="admin-panel-heading">
        <div className="screen-header-row">
          <div>
            <span className="status-chip status-chip--correct">
              <Shield size={16} aria-hidden="true" />
              <span>جلسة مسؤول موثّقة ✓</span>
            </span>
            <h1 id="admin-panel-heading" className="screen-title">
              لوحة إدارة النظام والمحتوى التعليمي
            </h1>
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--touch"
            onClick={handleLock}
          >
            <Lock size={17} aria-hidden="true" />
            <span>قفل جلسة المسؤول</span>
          </button>
        </div>

        {/* 1. Environment & Mode Separation Controls */}
        <div className="admin-section">
          <h2>١. إدارة بيئة التشغيل (فصل وضع العرض عن وضع الإنتاج)</h2>
          <p className="helper-text">
            المساحة النشطة حالياً: <code>{storageNamespace}</code> • حالة الخادم:{' '}
            {backendHealth?.messageAr ?? 'جاري الفحص...'}
          </p>

          <div className="mode-cards-grid">
            <div
              className={`mode-admin-card ${
                env.mode === 'demo' ? 'mode-admin-card--active' : ''
              }`}
            >
              <div className="section-header-inline">
                <ShieldAlert size={20} aria-hidden="true" />
                <strong>وضع العرض المحلي (Local Demo Mode)</strong>
              </div>
              <p>
                يستخدم مساحة التخزين المعزولة{' '}
                <code>rehlat_alhadm_demo_v1</code> ويسمح بتجربة سريعة دون المساس
                ببيانات الإنتاج.
              </p>
              <button
                type="button"
                className={`btn btn--touch ${
                  env.mode === 'demo' ? 'btn--primary' : 'btn--secondary'
                }`}
                onClick={() => onSwitchMode('demo')}
              >
                {env.mode === 'demo'
                  ? '✓ وضع العرض المحلي نشط حالياً'
                  : 'التبديل إلى وضع العرض المحلي'}
              </button>
            </div>

            <div
              className={`mode-admin-card ${
                env.mode === 'production' ? 'mode-admin-card--active' : ''
              }`}
            >
              <div className="section-header-inline">
                <ShieldCheck size={20} aria-hidden="true" />
                <strong>وضع الإنتاج الفعلي (Production Mode)</strong>
              </div>
              <p>
                يستخدم Supabase PostgreSQL + RLS + Anonymous Auth ويمنع التخزين
                المحلي الصامت للنقاط عند غياب الخادم.
              </p>
              <button
                type="button"
                className={`btn btn--touch ${
                  env.mode === 'production' ? 'btn--primary' : 'btn--secondary'
                }`}
                onClick={() => onSwitchMode('production')}
              >
                {env.mode === 'production'
                  ? '✓ وضع الإنتاج نشط حالياً'
                  : 'التبديل إلى وضع الإنتاج الفعلي'}
              </button>
            </div>
          </div>
        </div>

        {/* 2. CMS: Immutable Content Versions & Draft Editor */}
        <div
          className="admin-section"
          data-testid="admin-cms-section"
          aria-labelledby="cms-section-heading"
        >
          <h2 id="cms-section-heading">
            ٢. إدارة إصدارات المحتوى والمسودات ومفاتيح الإجابة (CMS & Immutable Versions)
          </h2>
          <p className="helper-text">
            إصدارات المحتوى المنشورة (<code>published</code>) غير قابلة للتعديل
            المباشر لحماية نزاهة رحلات الطلاب المرتبطة بها. لتعديل الأسئلة أو
            الخيارات أو مفاتيح الإجابة أو التلميحات، أنشئ مسودة إصدار جديد (
            <code>draft</code>)، ثم تحقق من اكتمال ٢٦ نشاطاً (١٨٦ نقطة) وانشره
            كإصدار مستقل.
          </p>

          {/* Version Selector & Draft Creator */}
          <div className="about-details-grid" style={{ marginBottom: '1rem' }}>
            <div className="info-card">
              <h3>الإصدارات المسجلة ({versionsList.length})</h3>
              <div className="form-field">
                <label htmlFor="cms-version-select" className="form-label">
                  اختر الإصدار للمعاينة أو التحرير
                </label>
                <select
                  id="cms-version-select"
                  className="form-input"
                  data-testid="cms-version-select"
                  value={selectedCmsVersionId}
                  onChange={(e) =>
                    setSelectedCmsVersionId(
                      asContentVersionId(e.target.value)
                    )
                  }
                >
                  {versionsList.map((v) => (
                    <option
                      key={v.contentVersionId}
                      value={v.contentVersionId}
                    >
                      {v.contentVersionId} —{' '}
                      {v.status === 'published'
                        ? 'منشور (ثابت غير قابل للتعديل)'
                        : 'مسودة قابلة للتحرير (Draft)'}
                    </option>
                  ))}
                </select>
              </div>

              {currentVersionSummary && (
                <div style={{ marginTop: '0.75rem' }}>
                  <span
                    className={`status-chip ${
                      currentVersionSummary.status === 'published'
                        ? 'status-chip--correct'
                        : 'status-chip--selected'
                    }`}
                    data-testid="cms-version-status-chip"
                  >
                    {currentVersionSummary.status === 'published'
                      ? 'إصدار منشور ثابت (Immutable Published)'
                      : 'مسودة قابلة للتحرير (Editable Draft)'}
                  </span>
                  <p className="helper-text" style={{ marginTop: '0.5rem' }}>
                    المستويات: {currentVersionSummary.levelsCount} • الأنشطة:{' '}
                    {currentVersionSummary.activitiesCount} • مجموع النقاط:{' '}
                    {currentVersionSummary.totalPoints}
                  </p>
                </div>
              )}
            </div>

            <div className="info-card">
              <h3>إنشاء مسودة إصدار جديد (بدون المساس بالرحلات السابقة)</h3>
              <form onSubmit={handleCreateDraftVersion} className="ds-form">
                <div className="form-field">
                  <label htmlFor="cms-new-draft-id" className="form-label">
                    معرّف المسودة الجديدة (New Version ID)
                  </label>
                  <input
                    id="cms-new-draft-id"
                    type="text"
                    className="form-input"
                    data-testid="cms-new-draft-input"
                    value={newDraftVersionInput}
                    onChange={(e) => setNewDraftVersionInput(e.target.value)}
                    placeholder="content-ar-g6-digestion-v1.5.0"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn--secondary btn--touch"
                  data-testid="cms-create-draft-btn"
                >
                  <FilePlus2 size={17} aria-hidden="true" />
                  <span>استنساخ الإصدار الحالي في مسودة قابلة للتحرير</span>
                </button>
              </form>
            </div>
          </div>

          {/* Activity Editor Form */}
          {selectedActivityRecord && (
            <form
              onSubmit={handleSaveActivityDraft}
              className="ds-form info-card"
              data-testid="cms-activity-editor-form"
            >
              <div className="screen-header-row">
                <h3>
                  تحرير النشاط ومفتاح الإجابة والتلميح والشرح العلمي (
                  <code>{selectedActivityRecord.activityId}</code>)
                </h3>
                <span className="status-chip status-chip--neutral">
                  النقاط: {selectedActivityRecord.maxScore} • النوع:{' '}
                  {selectedActivityRecord.type}
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="cms-activity-select" className="form-label">
                  اختر النشاط من بين الأنشطة الـ ٢٦
                </label>
                <select
                  id="cms-activity-select"
                  className="form-input"
                  data-testid="cms-activity-select"
                  value={selectedActivityIdForEdit}
                  onChange={(e) => setSelectedActivityIdForEdit(e.target.value)}
                >
                  {allActivitiesInSelectedVersion.map(
                    ({ levelOrder, levelTitleAr, activity }) => (
                      <option
                        key={activity.activityId}
                        value={activity.activityId}
                      >
                        المستوى {levelOrder} ({levelTitleAr}) —{' '}
                        {activity.activityId}: {activity.titleAr} (
                        {activity.maxScore} نقاط)
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="about-details-grid">
                <div className="form-field">
                  <label htmlFor="cms-edit-title" className="form-label">
                    عنوان النشاط
                  </label>
                  <input
                    id="cms-edit-title"
                    type="text"
                    className="form-input"
                    data-testid="cms-edit-title-input"
                    value={editTitleAr}
                    onChange={(e) => setEditTitleAr(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="cms-edit-answer-key" className="form-label">
                    مفتاح الإجابة الصحيحة المحمي على الخادم (Correct Answer Key)
                  </label>
                  <input
                    id="cms-edit-answer-key"
                    type="text"
                    className="form-input"
                    data-testid="cms-edit-answer-key-input"
                    value={editCorrectOptionId}
                    onChange={(e) => setEditCorrectOptionId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="cms-edit-prompt" className="form-label">
                  نص السؤال العلمي
                </label>
                <textarea
                  id="cms-edit-prompt"
                  className="form-input"
                  rows={2}
                  data-testid="cms-edit-prompt-input"
                  value={editPromptAr}
                  onChange={(e) => setEditPromptAr(e.target.value)}
                  required
                />
              </div>

              <div className="about-details-grid">
                <div className="form-field">
                  <label htmlFor="cms-edit-hint" className="form-label">
                    التلميح العلمي المعتمد (يُكشف فقط بعد الخطأ الأول)
                  </label>
                  <textarea
                    id="cms-edit-hint"
                    className="form-input"
                    rows={2}
                    data-testid="cms-edit-hint-input"
                    value={editHintAr}
                    onChange={(e) => setEditHintAr(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="cms-edit-explanation" className="form-label">
                    التفسير العلمي النهائي (يُكشف فقط عند إتمام النشاط)
                  </label>
                  <textarea
                    id="cms-edit-explanation"
                    className="form-input"
                    rows={2}
                    data-testid="cms-edit-explanation-input"
                    value={editExplanationAr}
                    onChange={(e) => setEditExplanationAr(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="cms-edit-options" className="form-label">
                  خيارات النشاط (JSON Array: optionId, labelAr, feedbackAr)
                </label>
                <textarea
                  id="cms-edit-options"
                  className="form-input"
                  rows={4}
                  data-testid="cms-edit-options-input"
                  value={editOptionsJsonText}
                  onChange={(e) => setEditOptionsJsonText(e.target.value)}
                  required
                />
              </div>

              <div className="about-details-grid">
                <div className="form-field">
                  <label htmlFor="cms-edit-asset" className="form-label">
                    الرسم التشريحي المرتبط (إن وجد)
                  </label>
                  <select
                    id="cms-edit-asset"
                    className="form-input"
                    value={editAssetId}
                    onChange={(e) => setEditAssetId(e.target.value)}
                  >
                    <option value="">بدون رسم تشريحي مخصص</option>
                    {Object.values(ANATOMICAL_ASSET_MANIFEST).map((asset) => (
                      <option key={asset.assetId} value={asset.assetId}>
                        {asset.assetId} — {asset.scientificCaptionAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="cms-upload-asset" className="form-label">
                    رفع صورة تعليمية إلى حاوية التخزين المحمية (curriculum-assets)
                  </label>
                  <label
                    htmlFor="cms-upload-asset"
                    className="btn btn--secondary btn--touch"
                    style={{ display: 'inline-flex', cursor: 'pointer' }}
                  >
                    <Upload size={16} aria-hidden="true" />
                    <span>اختيار ملف صورة للرفع (للمشرف فقط)</span>
                  </label>
                  <input
                    id="cms-upload-asset"
                    type="file"
                    accept="image/png,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={handleAssetUpload}
                  />
                </div>
              </div>

              {/* Pre-Publication Validation Summary & Action Buttons */}
              <div
                className="ds-callout ds-callout--hint"
                data-testid="cms-validation-summary"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>
                    حالة التحقق قبل النشر ({selectedCmsVersionId}):{' '}
                    {publicationValidation.isValid
                      ? 'جميع الحقول والـ ٢٦ نشاطاً (١٨٦ نقطة) مكتملة وصحيحة ✓'
                      : `يوجد ${publicationValidation.errorsAr.length} خطأ يمنع النشر`}
                  </strong>
                  {!publicationValidation.isValid && (
                    <ul>
                      {publicationValidation.errorsAr.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {cmsFeedbackNotice && (
                <div
                  className={`ds-callout ${
                    cmsFeedbackNotice.ok
                      ? 'ds-callout--correct'
                      : 'ds-callout--error'
                  }`}
                  role="status"
                  data-testid="cms-feedback-notice"
                >
                  <span>{cmsFeedbackNotice.textAr}</span>
                </div>
              )}

              <div className="header-actions-inline">
                <button
                  type="submit"
                  className="btn btn--primary btn--touch"
                  data-testid="cms-save-activity-btn"
                >
                  <Save size={17} aria-hidden="true" />
                  <span>حفظ تعديلات النشاط في المسودة</span>
                </button>

                <button
                  type="button"
                  className="btn btn--secondary btn--touch"
                  data-testid="cms-publish-version-btn"
                  disabled={currentVersionSummary?.status === 'published'}
                  onClick={handlePublishDraftVersion}
                >
                  <ShieldCheck size={17} aria-hidden="true" />
                  <span>
                    تحقق وانشر كإصدار ثابت غير قابل للتعديل (Publish Immutable
                    Version)
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 3. Configurable Developer Attribution */}
        <div className="admin-section">
          <h2>٣. ضبط بيان التنفيذ البرمجي (Developer Attribution)</h2>
          <form onSubmit={handleSaveAttribution} className="ds-form">
            <div className="form-field">
              <label htmlFor="dev-attribution-input" className="form-label">
                نص التنفيذ البرمجي (يظهر في شاشة «حول المشروع» — اتركه فارغاً
                لإبقائه غير محدد)
              </label>
              <input
                id="dev-attribution-input"
                type="text"
                className="form-input"
                placeholder="اختياري: أدخل اسم المطور أو جهة التنفيذ البرمجي..."
                value={devAttributionInput}
                onChange={(e) => setDevAttributionInput(e.target.value)}
              />
            </div>
            <div className="header-actions-inline">
              <button type="submit" className="btn btn--primary btn--touch">
                <Save size={17} aria-hidden="true" />
                <span>حفظ بيان التنفيذ البرمجي</span>
              </button>
              {saveNotice && (
                <span className="status-chip status-chip--correct">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <span>{saveNotice}</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* 4. Real Student Roster & Export */}
        <div className="admin-section">
          <h2>٤. إدارة سجلات الطلاب الفعلية ({allStates.length})</h2>
          <div className="header-actions-inline">
            <button
              type="button"
              className="btn btn--secondary btn--touch"
              onClick={handleExportJson}
              disabled={allStates.length === 0}
            >
              <Download size={17} aria-hidden="true" />
              <span>تصدير سجلات التقدم الفعلية (JSON)</span>
            </button>

            {env.mode === 'demo' && allStates.length > 0 && (
              <button
                type="button"
                className="btn btn--danger btn--touch"
                onClick={onClearDemoData}
              >
                <Trash2 size={17} aria-hidden="true" />
                <span>مسح بيانات العرض التجريبي المحلي فقط</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. Unresolved Dependencies Inspector */}
        <div className="admin-section">
          <div className="section-header-inline">
            <FileWarning size={20} aria-hidden="true" />
            <h2>٥. سجل التبعيات والإعدادات البيئية</h2>
          </div>

          <div className="dependencies-stack">
            {unresolvedDependencies.map((dep) => (
              <div key={dep.id} className="dependency-card">
                <div className="dependency-card__header">
                  <strong>
                    <code>{dep.id}</code> — {dep.titleAr}
                  </strong>
                  <span
                    className={`status-chip ${
                      dep.status === 'resolved'
                        ? 'status-chip--correct'
                        : 'status-chip--locked'
                    }`}
                  >
                    {dep.status}
                  </span>
                </div>
                <p>{dep.descriptionAr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
