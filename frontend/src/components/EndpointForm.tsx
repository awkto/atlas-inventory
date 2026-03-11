import { useEffect, useState } from "react";
import type { Device, Endpoint } from "../types";
import { PROTOCOLS } from "../types";
import { listDevices } from "../api";

interface Props {
  initial?: Partial<Endpoint>;
  onSubmit: (data: Partial<Endpoint>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export default function EndpointForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const [label, setLabel] = useState(initial?.label || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [protocol, setProtocol] = useState(initial?.protocol || "");
  const [deviceId, setDeviceId] = useState<number | null>(initial?.device_id ?? null);
  const [tags, setTags] = useState(initial?.tags?.join(", ") || "");
  const [openbao, setOpenbao] = useState(initial?.openbao_paths?.join(", ") || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    listDevices().then(setDevices);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      label,
      url,
      protocol: protocol || null,
      device_id: deviceId,
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
          <label className={labelCls}>Label *</label>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>URL *</label>
          <input required value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://example.com:8080/path" />
        </div>
        <div>
          <label className={labelCls}>Protocol</label>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Device</label>
          <select value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">None</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Tags (comma-separated)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="web, production, critical" />
      </div>
      <div>
        <label className={labelCls}>OpenBao Paths (comma-separated)</label>
        <input value={openbao} onChange={(e) => setOpenbao(e.target.value)} className={inputCls} placeholder="secret/data/myapp, kv/infra/cert" />
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
