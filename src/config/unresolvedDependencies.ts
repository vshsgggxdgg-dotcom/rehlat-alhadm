import { asDependencyId } from '../domain/ids';
import type { UnresolvedDependencyRecord } from '../domain/types';
import type { AppEnvironmentConfig } from './env';

/**
 * Authoritative Registry of Unresolved Content, Asset, and Configuration Dependencies.
 * Working Rule: Do not silently replace missing educational assets or approved content
 * with invented alternatives. Record unresolved dependencies clearly.
 */
export function getUnresolvedDependencies(
  env: AppEnvironmentConfig
): readonly UnresolvedDependencyRecord[] {
  const missingVarsText =
    env.missingProductionConfigItems.length > 0
      ? env.missingProductionConfigItems.join(' ، ')
      : 'لا توجد متغيرات ناقصة';

  return [
    {
      id: asDependencyId('DEP-CONFIG-SUPABASE'),
      category: 'configuration',
      titleAr:
        'اتصال قاعدة بيانات الإنتاج والمصادقة المجهولة (Supabase PostgreSQL, RLS, Anonymous Auth & Edge Functions)',
      descriptionAr: env.isSupabaseConfigured
        ? `تم ضبط اتصال مشروع Supabase (${env.supabaseUrl}) مع تفعيل RLS، الدوال المخزنة الآمنة (rpc_submit_activity_attempt)، والمصادقة المجهولة المستدامة.`
        : `عناصر الربط المفقودة لبيئة الإنتاج: [${missingVarsText}] بالإضافة إلى ربط مشروع Supabase وتطبيق ملفات الترحيل (supabase/migrations/20261028000001_production_backend_schema.sql و 20261028000002_seed_approved_content_v1_4_0.sql). في وضع الإنتاج يُمنع التخزين المحلي الصامت للنقاط عند غياب الخادم.`,
      affectedScope:
        'src/backend/supabaseClient.ts, src/backend/backendFactory.ts, supabase/migrations/',
      status: env.isSupabaseConfigured
        ? 'resolved'
        : 'unconfigured_in_production',
      requiredForProduction: true,
    },
    {
      id: asDependencyId('DEP-ASSET-001'),
      category: 'asset',
      titleAr: 'مخططات التشريح العلمية الشفافة وسجل إحداثيات التفاعل (7 Transparent PNG Assets)',
      descriptionAr:
        'تم توليد ومراجعة ٧ رسوم تشريحية علمية متخصصة بصيغة PNG شفافة أصيلة (800×520) في public/assets/anatomy/ وربطها بإحداثيات النقاط التفاعلية في src/content/assetManifest.ts دون تكرار صورة عامة للجهاز الهضمي.',
      affectedScope: 'src/content/assetManifest.ts',
      status: 'resolved',
      requiredForProduction: true,
    },
    {
      id: asDependencyId('DEP-CONTENT-001'),
      category: 'content',
      titleAr: 'مصفوفة الأنشطة التعليمية الستة والعشرين (٢٦ نشاطاً — ١٨٦ نقطة)',
      descriptionAr:
        'تم هيكلة ٢٦ نشاطاً عبر المستويات الستة (٤ + ٢٠ + ٤٢ + ٣٢ + ٤٠ + ٤٨ = ١٨٦ نقطة) مع فصل بيانات العرض العامة عن مفاتيح الإجابة المحمية على الخادم (src/backend/answerKeyVault.ts).',
      affectedScope: 'src/content/digestionManifest.ts, src/backend/answerKeyVault.ts',
      status: 'resolved',
      requiredForProduction: true,
    },
    {
      id: asDependencyId('DEP-ASSET-002'),
      category: 'asset',
      titleAr: 'الملفات الصوتية المعتمدة للسرد التعليمي باللغة العربية',
      descriptionAr:
        'ملفات التعليق الصوتي الخاصة بشرح المحطات لطلاب الصف السادس غير مرفقة حالياً. تم إيقاف أزرار التشغيل الصوتي الوهمية لمنع حالات النجاح المزيفة.',
      affectedScope: 'القارئ الصوتي للمحطات والأنشطة',
      status: 'unresolved',
      requiredForProduction: false,
    },
  ];
}
