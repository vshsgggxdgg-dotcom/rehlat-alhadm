// ============================================================================
// Supabase Edge Function: submit-activity-attempt
// Verifies authenticated student caller identity (not merely an API key),
// validates request payload and idempotency key, and executes transactional
// server-side scoring via `public.rpc_submit_activity_attempt`.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SubmitAttemptRequestBody {
  readonly runId: string;
  readonly contentVersionId: string;
  readonly levelId: string;
  readonly activityId: string;
  readonly submittedAnswer: string;
  readonly durationMs: number;
  readonly idempotencyKey: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'METHOD_NOT_ALLOWED', messageAr: 'يُسمح بطلبات POST فقط.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED_CALLER',
        messageAr: 'مطلوب رمز مصادقة جلسة صالح (JWT) وليس مجرد مفتاح عام.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create user-scoped Supabase client so `auth.uid()` is verified inside Postgres RLS/RPC
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_SESSION',
        messageAr: 'تعذر التحقق من هوية الطالب في الخادم.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: SubmitAttemptRequestBody;
  try {
    body = (await req.json()) as SubmitAttemptRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: 'INVALID_JSON', messageAr: 'بيانات الطلب غير صالحة.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const headerIdempotencyKey = req.headers.get('x-idempotency-key') ?? '';
  const idempotencyKey = (body.idempotencyKey || headerIdempotencyKey).trim();

  if (
    !idempotencyKey ||
    !body.runId ||
    !body.contentVersionId ||
    !body.levelId ||
    !body.activityId ||
    typeof body.submittedAnswer !== 'string'
  ) {
    return new Response(
      JSON.stringify({
        error: 'MISSING_FIELDS',
        messageAr:
          'جميع حقول الإرسال (المستوى، النشاط، الجولة، الإجابة، ومفتاح منع التكرار) إلزامية.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data, error } = await supabase.rpc('rpc_submit_activity_attempt', {
    p_run_id: body.runId,
    p_content_version_id: body.contentVersionId,
    p_level_id: body.levelId,
    p_activity_id: body.activityId,
    p_submitted_answer: body.submittedAnswer,
    p_duration_ms: Math.max(0, Math.round(Number(body.durationMs) || 0)),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return new Response(
      JSON.stringify({
        error: 'SUBMISSION_REJECTED',
        messageAr: error.message,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
