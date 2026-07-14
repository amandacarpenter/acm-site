import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useKbSections, type KbArticle } from "./useKb";

const ADMIN_EMAIL = "amandathecarpenter@gmail.com";

function StatusBadge({ status }: { status: string }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700/50">
      <span aria-hidden="true">●</span> Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-300/50">
      <span aria-hidden="true">○</span> Coming soon
    </span>
  );
}

function EditModal({ article, onClose, onSaved, token }: {
  article: KbArticle;
  onClose: () => void;
  onSaved: (updated: KbArticle) => void;
  token: string;
}) {
  const [form, setForm] = useState({
    summary: article.summary,
    video_url: article.video_url || "",
    video_status: article.video_status,
    transcript: article.transcript || "",
    captions_url: article.captions_url || "",
    duration: article.duration || "",
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUploadVideo() {
    if (!videoFile) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      const res = await fetch(`/api/kb/articles/${article.id}/upload-video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm(f => ({ ...f, video_url: data.video_url, video_status: "published" }));
      setVideoFile(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kb/articles/${article.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          video_url: form.video_url || null,
          transcript: form.transcript || null,
          captions_url: form.captions_url || null,
          duration: form.duration || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs text-[#0d9488] font-medium uppercase tracking-wide">Edit Article</p>
              <h2 id="edit-modal-title" className="text-gray-900 font-semibold text-lg leading-snug mt-0.5">{article.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] rounded" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Status toggle */}
            <div>
              <label htmlFor="edit-status" className="block text-text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                id="edit-status"
                value={form.video_status}
                onChange={e => setForm(f => ({ ...f, video_status: e.target.value as any }))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                <option value="coming_soon">Coming soon</option>
                <option value="published">Published</option>
              </select>
            </div>

            {/* Summary */}
            <div>
              <label htmlFor="edit-summary" className="block text-text-xs font-medium text-gray-700 mb-1">Summary</label>
              <textarea
                id="edit-summary"
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-none"
              />
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="edit-duration" className="block text-text-xs font-medium text-gray-700 mb-1">Duration (e.g. 2:14)</label>
              <input
                id="edit-duration"
                type="text"
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="2:14"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>

            {/* Video upload */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Upload Video File (MP4)</p>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  onChange={e => setVideoFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-300 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#0d9488]/20 file:text-[#0d9488] hover:file:bg-[#0d9488]/30"
                  aria-label="Select video file to upload"
                />
                {videoFile && (
                  <button
                    onClick={handleUploadVideo}
                    disabled={uploading}
                    className="px-3 py-1.5 rounded-lg bg-[#0d9488] text-white text-xs font-medium hover:bg-[#0d9488]/80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                )}
              </div>
              {form.video_url && (
                <p className="text-xs text-green-600 mt-1">Video URL: {form.video_url}</p>
              )}
            </div>

            {/* Video URL (manual) */}
            <div>
              <label htmlFor="edit-video-url" className="block text-text-xs font-medium text-gray-700 mb-1">Or paste Video URL</label>
              <input
                id="edit-video-url"
                type="url"
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="https://…"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>

            {/* Captions URL */}
            <div>
              <label htmlFor="edit-captions-url" className="block text-text-xs font-medium text-gray-700 mb-1">Captions URL (.vtt)</label>
              <input
                id="edit-captions-url"
                type="url"
                value={form.captions_url}
                onChange={e => setForm(f => ({ ...f, captions_url: e.target.value }))}
                placeholder="https://…captions.vtt"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>

            {/* Transcript */}
            <div>
              <label htmlFor="edit-transcript" className="block text-text-xs font-medium text-gray-700 mb-1">Transcript</label>
              <textarea
                id="edit-transcript"
                value={form.transcript}
                onChange={e => setForm(f => ({ ...f, transcript: e.target.value }))}
                rows={8}
                placeholder="Paste the full transcript here…"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-y font-mono"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm" role="alert">{error}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#0d9488] text-white text-sm font-medium hover:bg-[#0d9488]/80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KbAdmin() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { sections, loading } = useKbSections();
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [localUpdates, setLocalUpdates] = useState<Record<string, KbArticle>>({});

  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = email === ADMIN_EMAIL;

  if (!isLoaded) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isSignedIn || !isAdmin) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-900 text-lg font-semibold">Admin access only</p>
        <Link href="/kb"><a className="text-[#0d9488] text-sm mt-2 hover:underline">← Back to Knowledge Base</a></Link>
      </div>
    </div>
  );

  const handleSaved = (updated: KbArticle) => {
    setLocalUpdates(prev => ({ ...prev, [updated.id]: updated }));
  };

  const allArticles = sections.flatMap(s => s.articles).map(a => localUpdates[a.id] || a);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/kb"><a className="text-[#0d9488] text-sm hover:underline">← Knowledge Base</a></Link>
          <span className="text-gray-400" aria-hidden="true">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Admin — Manage Videos</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map(sec => (
              <section key={sec.section} aria-labelledby={`admin-section-${sec.section}`}>
                <h2 id={`admin-section-${sec.section}`} className="text-base font-semibold text-gray-900 mb-3">
                  {sec.section_name}
                </h2>
                <div className="bg-white rounded-xl border border-gray-200/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/50">
                        <th scope="col" className="text-left px-4 py-2 text-xs text-gray-500 font-medium w-8">#</th>
                        <th scope="col" className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Title</th>
                        <th scope="col" className="text-left px-4 py-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Status</th>
                        <th scope="col" className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sec.articles.map(rawArticle => {
                        const article = localUpdates[rawArticle.id] || rawArticle;
                        return (
                          <tr key={article.id} className="hover:hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-500 text-xs">{article.order_num}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium">{article.title}</td>
                            <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={article.video_status} /></td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={async () => {
                                  const token = await getToken();
                                  setEditing({ ...article, _token: token } as any);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#0d9488]/20 text-[#0d9488] text-xs font-medium hover:bg-[#0d9488]/30 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
                                aria-label={`Edit ${article.title}`}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {editing && (
        <EditModal
          article={editing}
          token={(editing as any)._token || ""}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
