import { useEffect, useState } from "react";
import { adminCloud, loadManifest } from "../backend/cloud";
const client = () => {
  if (!adminCloud) throw Error("الاتصال غير مهيأ");
  return adminCloud;
};
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}
import type {
  CurriculumManifest,
  LearningActivityDefinition,
} from "../content/schema";
type Version = { content_version_id: string; status: string };
export function Admin({
  manifest,
  onPublished,
}: {
  manifest: CurriculumManifest;
  onPublished: () => Promise<void>;
}) {
  const [allowed, setAllowed] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]),
    [version, setVersion] = useState(manifest.contentVersionId as string),
    [newId, setNewId] = useState(""),
    [activities, setActivities] = useState<LearningActivityDefinition[]>([]),
    [selected, setSelected] = useState(""),
    [editor, setEditor] = useState("");
  async function status() {
    const d = await rpc("rpc_get_admin_session_status");
    setAllowed(d.isAdmin === true);
    if (d.isAdmin) {
      const { data, error } = await client()
        .from("content_versions")
        .select("content_version_id,status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVersions(data ?? []);
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as { message?: string }).message ?? "تعذّر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void status().catch(() => {});
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    void (async () => {
      try {
        const m = await loadManifest(version, client()),
          kr = await client()
            .from("activity_answer_keys")
            .select("*")
            .eq("content_version_id", version);
        if (kr.error) throw kr.error;
        const list = m.levels
          .flatMap((l) => l.activities)
          .map((a) => {
            const k = kr.data?.find((k) => k.activity_id === a.activityId);
            return {
              ...a,
              correctOptionId: k?.canonical_correct_answer ?? "",
              scientificHintAr: k?.scientific_hint_ar ?? "",
              scientificExplanationAr: k?.scientific_explanation_ar ?? "",
            };
          });
        if (live) {
          setActivities(list);
          setSelected(list[0]?.activityId ?? "");
        }
      } catch (e) {
        if (live) setNotice((e as { message: string }).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [allowed, version]);
  useEffect(() => {
    const a = activities.find((a) => a.activityId === selected);
    setEditor(a ? JSON.stringify(a, null, 2) : "");
  }, [selected, activities]);
  const isDraft =
    versions.find((v) => v.content_version_id === version)?.status === "draft";
  return (
    <section className="admin-panel settings-card">
      <h1>إدارة رحلة الهضم</h1>
      <p>حساب المسؤول مستقل. تُفرض صلاحية الإدارة على الخادم.</p>
      {notice && <p role="status">{notice}</p>}
      {!allowed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const { error } = await client().auth.signInWithPassword({
                email,
                password,
              });
              setPassword("");
              if (error) throw error;
              await status();
            });
          }}
        >
          <label>
            البريد الإلكتروني
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn btn--primary" disabled={busy}>
            دخول المسؤول
          </button>
        </form>
      ) : (
        <>
          <button
            className="btn"
            onClick={() =>
              void action(async () => {
                await client().auth.signOut();
                setAllowed(false);
                location.reload();
              })
            }
          >
            تسجيل الخروج
          </button>
          <label>
            نسخة المحتوى
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.content_version_id} value={v.content_version_id}>
                  {v.content_version_id} — {v.status}
                </option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await rpc("rpc_admin_create_draft_version", {
                  p_source_version_id: version,
                  p_new_draft_version_id: newId.trim(),
                });
                await status();
                setVersion(newId.trim());
                setNewId("");
              });
            }}
          >
            <label>
              معرّف المسودة الجديدة
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                required
                placeholder="content-ar-g6-digestion-v1.5.0"
              />
            </label>
            <button className="btn" disabled={busy}>
              إنشاء مسودة من هذه النسخة
            </button>
          </form>
          <label>
            النشاط
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {activities.map((a) => (
                <option key={a.activityId} value={a.activityId}>
                  {a.titleAr}
                </option>
              ))}
            </select>
          </label>
          <label>
            بيانات النشاط المعتمد
            <textarea
              rows={22}
              dir="ltr"
              value={editor}
              readOnly={!isDraft}
              onChange={(e) => setEditor(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button
              className="btn"
              disabled={!isDraft || busy}
              onClick={() =>
                void action(async () => {
                  const a = JSON.parse(editor) as LearningActivityDefinition;
                  if (a.activityId !== selected)
                    throw Error("لا تغير معرّف النشاط.");
                  await rpc("rpc_admin_save_activity", {
                    p_draft_version_id: version,
                    p_activity: a,
                  });
                  setNotice("تم حفظ النشاط على الخادم.");
                })
              }
            >
              حفظ المسودة
            </button>
            <button
              className="btn btn--primary"
              disabled={!isDraft || busy}
              onClick={() =>
                void action(async () => {
                  await rpc("rpc_admin_publish_version", {
                    p_draft_version_id: version,
                  });
                  await status();
                  await onPublished();
                  setNotice("تم نشر النسخة بعد فحص اكتمالها.");
                })
              }
            >
              فحص ونشر النسخة
            </button>
          </div>
          <label>
            رفع صورة معتمدة
            <input
              type="file"
              accept="image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void action(async () => {
                  if (file.size > 5 * 1024 * 1024)
                    throw Error("الحد الأقصى ٥ ميجابايت.");
                  const path = `${version}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "webp"}`;
                  const { error } = await client()
                    .storage.from("curriculum-assets")
                    .upload(path, file, { contentType: file.type });
                  if (error) throw error;
                  setNotice(
                    `تم الرفع: ${client().storage.from("curriculum-assets").getPublicUrl(path).data.publicUrl}`,
                  );
                });
              }}
            />
          </label>
        </>
      )}
    </section>
  );
}
