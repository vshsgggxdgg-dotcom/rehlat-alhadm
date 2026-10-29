// ============================================================================
// Supabase Edge Function: admin-publish-version
// Enforces non-anonymous Administrator authorization on the backend and
// publishes an immutable curriculum version via `rpc_admin_publish_version`.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PublishVersionBody {
  readonly draftVersionId: string;
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
        error: 'UNAUTHORIZED',
        messageAr: 'مطلوب تسجيل دخول مسؤول النظام بحساب موثق.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.is_anonymous) {
    return new Response(
      JSON.stringify({
        error: 'FORBIDDEN_ADMIN_ONLY',
        messageAr: 'هذه العملية مقصورة على مسؤولي النظام الموثقين فقط.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: adminStatus, error: statusError } = await supabase.rpc(
    'rpc_get_admin_session_status'
  );

  if (statusError || !adminStatus?.isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'FORBIDDEN_NOT_IN_ADMIN_ROLES',
        messageAr: 'الحساب الحالي لا يمتلك صلاحية مسؤول في جدول admin_roles.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: PublishVersionBody;
  try {
    body = (await req.json()) as PublishVersionBody;
  } catch {
    return new Response(
      JSON.stringify({ error: 'INVALID_JSON', messageAr: 'بيانات الطلب غير صالحة.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const draftVersionId = (body.draftVersionId ?? '').trim();
  if (!draftVersionId) {
    return new Response(
      JSON.stringify({
        error: 'MISSING_DRAFT_VERSION_ID',
        messageAr: 'يرجى تحديد معرّف مسودة الإصدار المراد نشره.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data, error } = await supabase.rpc('rpc_admin_publish_version', {
    p_draft_version_id: draftVersionId,
  });

  if (error) {
    return new Response(
      JSON.stringify({
        error: 'PUBLISH_FAILED',
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
