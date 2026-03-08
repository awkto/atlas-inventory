import { useEffect, useState } from "react";
import type { Device, Network } from "../types";
import { DEVICE_TYPES, PLATFORMS, STATUSES } from "../types";
import { listDevices, listNetworks } from "../api";

interface Props {
  initial?: Partial<Device>;
  onSubmit: (data: Partial<Device>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export default function DeviceForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [fqdn, setFqdn] = useState(initial?.fqdn || "");
  const [ips, setIps] = useState(initial?.ips?.join(", ") || "");
  const [type, setType] = useState(initial?.type || "server");
  const [platform, setPlatform] = useState(initial?.platform || "");
  const [status, setStatus] = useState(initial?.status || "active");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [openbao, setOpenbao] = useState(initial?.openbao_paths?.join(", ") || "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") || "");
  const [parentId, setParentId] = useState<number | null>(initial?.parent_id ?? null);
  const [networkId, setNetworkId] = useState<number | null>(initial?.network_id ?? null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);

  useEffect(() => {
    listDevices().then(setDevices);
    listNetworks().then(setNetworks);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      fqdn: fqdn || null,
      ips: ips ? ips.split(",").map((s) => s.trim()).filter(Boolean) : [],
      type,
      platform: platform || null,
      status,
      notes: notes || null,
      openbao_paths: openbao ? openbao.split(",").map((s) => s.trim()).filter(Boolean) : [],
      tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      parent_id: parentId,
      network_id: networkId,
    });
  };

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";
  const labelCls = "block text-xs text-[var(--text-muted)] mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>FQDN</label>
          <input value={fqdn} onChange={(e) => setFqdn(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>IPs (comma-separated)</label>
          <input value={ips} onChange={(e) => setIps(e.target.value)} className={inputCls} placeholder="10.0.0.1, 192.168.1.5" />
        </div>
        <div>
          <label className={labelCls}>Parent Device</label>
          <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">None</option>
            {devices.filter((d) => d.id !== initial?.id).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Network</label>
          <select value={networkId ?? ""} onChange={(e) => setNetworkId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">None</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>{n.name} ({n.cidr})</option>
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
