import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppEnvironmentConfig } from '../config/env';
import { asStudentId } from '../domain/ids';
import type { SessionIdentityResult } from './backendPort';

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(
  env: AppEnvironmentConfig
): SupabaseClient | null {
  const publicKey = env.supabasePublishableKey ?? env.supabaseAnonKey;
  if (!env.isSupabaseConfigured || !env.supabaseUrl || !publicKey) {
    return null;
  }

  const key = `${env.supabaseUrl}::${publicKey}`;
  if (cachedSupabaseClient && cachedConfigKey === key) {
    return cachedSupabaseClient;
  }

  cachedSupabaseClient = createClient(env.supabaseUrl, publicKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'rehlat_alhadm_supabase_auth_v1',
    },
  });
  cachedConfigKey = key;
  return cachedSupabaseClient;
}

/**
 * Ensures a persistent, independent internal StudentId for Production Mode.
 * Uses Supabase Anonymous Auth (`signInAnonymously`) with session persistence and
 * calls `rpc_ensure_student_session` when configured.
 *
 * SECURITY & INTEGRITY RULE:
 * Never silently fall back to creating a fake local production session or storing
 * production scores locally when Supabase is unconfigured or unreachable.
 */
export async function resolveProductionSessionIdentity(
  env: AppEnvironmentConfig,
  displayName?: string,
  avatarId?: string
): Promise<SessionIdentityResult> {
  if (!env.isSupabaseConfigured) {
    const missing = env.missingProductionConfigItems.join(' ، ');
    return {
      studentId: null,
      authProvider: 'unconfigured',
      errorAr: `تعذر بدء جلسة الإنتاج: المتغيرات المطلوبة غير مضبوطة (${missing}). يُمنع التخزين المحلي الصامت لنتائج الإنتاج عند غياب اتصال الخادم.`,
    };
  }

  const client = getSupabaseClient(env);
  if (!client) {
    return {
      studentId: null,
      authProvider: 'unconfigured',
      errorAr: 'عميل Supabase غير مهيأ في بيئة الإنتاج.',
    };
  }

  try {
    let authUserId: string | null = null;
    const { data: sessionData, error: sessionErr } =
      await client.auth.getSession();
    if (!sessionErr && sessionData?.session?.user?.id) {
      authUserId = sessionData.session.user.id;
    } else {
      const { data: anonData, error: anonErr } =
        await client.auth.signInAnonymously();
      if (anonErr || !anonData?.user?.id) {
        return {
          studentId: null,
          authProvider: 'unconfigured',
          errorAr: `فشل تسجيل الدخول المجهول في Supabase (${
            anonErr?.message ?? 'خطأ اتصال'
          }). لم يتم حفظ أي بيانات إنتاج محلياً.`,
        };
      }
      authUserId = anonData.user.id;
    }

    if (displayName && displayName.trim().length > 0) {
      const { data: profile, error: profileError } = await client.rpc(
        'rpc_ensure_student_session',
        {
          p_display_name: displayName.trim(),
          p_avatar_id: avatarId ?? 'girl-noor',
          p_content_version_id: env.contentVersionId,
        }
      );
      if (profileError || !profile?.studentId) {
        console.error(
          'Supabase rpc_ensure_student_session error:',
          profileError
        );
        return {
          studentId: null,
          authProvider: 'unconfigured',
          errorAr: `تعذّر حفظ ملف الطالب على الخادم (${
            profileError?.message ?? 'استجابة غير مكتملة'
          }).`,
        };
      }
      return {
        studentId: asStudentId(String(profile.studentId)),
        authProvider: 'supabase_anonymous',
      };
    }

    return {
      studentId: asStudentId(`stu_${authUserId.replace(/-/g, '')}`),
      authProvider: 'supabase_anonymous',
    };
  } catch (err) {
    return {
      studentId: null,
      authProvider: 'unconfigured',
      errorAr: `تعذر الاتصال بخادم Supabase (${
        err instanceof Error ? err.message : 'خطأ شبكة'
      }). يُمنع التخزين المحلي الصامت لنتائج الإنتاج.`,
    };
  }
}
