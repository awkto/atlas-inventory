import { useState } from "react";
import type { Repository } from "../types";
import { REPO_PLATFORMS } from "../types";

interface Props {
  initial?: Partial<Repository>;
  onSubmit: (data: Partial<Repository>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export default function RepositoryForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [platform, setPlatform] = useState(initial?.platform || "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") || "");
  const [openbao, setOpenbao] = useState(initial?.openbao_paths?.join(", ") || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      url,
      description: description || null,
      platform: platform || null,
      tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      openbao_paths: openbao ? openbao.split(",").map((s) => s.trim()).filter(Boolean) : [],
      notes: notes || null,
    });
  };

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";
  const labelCls = "block text-xs text-[var(--text-muted)] mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="atlas" />
        </div>
        <div>
          <label className={labelCls}>URL *</label>
          <input required value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://github.com/awkto/atlas" />
        </div>
        <div>
          <label className={labelCls}>Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {REPO_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Tags (comma-separated)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="atlas, infrastructure" />
      </div>
      <div>
        <label className={labelCls}>OpenBao Paths (comma-separated)</label>
        <input value={openbao} onChange={(e) => setOpenbao(e.target.value)} className={inputCls} placeholder="secret/data/myapp" />
      </div>
      <div>
        <label className={labelCls}>Notes (markdown)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputCls} />
      </div>
      <div className="flex gap-3">
        <button type="submit" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded px-4 py-1.5 text-sm border border-[var(--border-card)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
