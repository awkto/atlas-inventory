import { useEffect, useState } from "react";
import type { Item, Network } from "../types";
import { INFRA_TYPES, PLATFORMS, PROTOCOLS, STATUSES } from "../types";
import { listItems, listNetworks } from "../api";

interface Props {
  initial?: Partial<Item>;
  initialType?: string;
  onSubmit: (data: Partial<Item>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)] w-full";
const selectCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)] w-full";
const labelCls = "block text-xs text-[var(--text-muted)] mb-1";

export default function ItemForm({ initial, initialType, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const [type, setType] = useState(initial?.type ?? initialType ?? "server");
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [fqdn, setFqdn] = useState(initial?.fqdn ?? "");
  const [ipsRaw, setIpsRaw] = useState((initial?.ips ?? []).join(", "));
  const [protocol, setProtocol] = useState(initial?.protocol ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [status, setStatus] = useState(initial?.status ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState<string>(initial?.parent_id?.toString() ?? "");
  const [networkId, setNetworkId] = useState<string>(initial?.network_id?.toString() ?? "");
  const [vmid, setVmid] = useState<string>(initial?.vmid?.toString() ?? "");
  const [portsRaw, setPortsRaw] = useState((initial?.ports ?? []).join(", "));
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [openbaoRaw, setOpenbaoRaw] = useState((initial?.openbao_paths ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listItems().then(setAllItems).catch(() => {});
    listNetworks().then(setNetworks).catch(() => {});
  }, []);

  const isVm = type === "vm";
  const isContainer = type === "container";
  const isInfra = INFRA_TYPES.includes(type);
  const isEndpoint = type === "endpoint";
  const isRepository = type === "repository";
  const isDocument = type === "document";
  const isSecret = type === "secret";

  const parseList = (raw: string) =>
    raw.split(",").map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data: Partial<Item> = {
        type,
        name,
        tags: parseList(tagsRaw),
        openbao_paths: parseList(openbaoRaw),
        notes: notes || null,
        parent_id: parentId ? parseInt(parentId) : null,
      };
      if (isInfra) {
        data.fqdn = fqdn || null;
        data.platform = platform || null;
        data.status = status || null;
        data.network_id = networkId ? parseInt(networkId) : null;
        data.ips = parseList(ipsRaw);
      }
      if (isVm) {
        data.vmid = vmid ? parseInt(vmid) : null;
      }
      if (isContainer) {
        data.ports = parseList(portsRaw);
      }
      if (isEndpoint) {
        data.url = url || null;
        data.protocol = protocol || null;
      }
      if (isRepository) {
        data.url = url || null;
        data.platform = platform || null;
        data.description = description || null;
      }
      if (isDocument) {
        data.url = url || null;
        data.description = description || null;
      }
      if (isSecret) {
        data.url = url || null;
        data.description = description || null;
      }
      await onSubmit(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type */}
      <div>
        <label className={labelCls}>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
          {["server", "vm", "container", "service", "device", "endpoint", "repository", "secret", "document"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div>
        <label className={labelCls}>Name *</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="my-server" />
      </div>

      {/* Infra fields */}
      {isInfra && (
        <>
          <div>
            <label className={labelCls}>FQDN</label>
            <input value={fqdn} onChange={(e) => setFqdn(e.target.value)} className={inputCls} placeholder="server.example.com" />
          </div>
          <div>
            <label className={labelCls}>IPs (comma-separated)</label>
            <input value={ipsRaw} onChange={(e) => setIpsRaw(e.target.value)} className={inputCls} placeholder="10.0.0.1, 192.168.1.5" />
          </div>
          <div>
            <label className={labelCls}>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectCls}>
              <option value="">— select —</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">— select —</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Network</label>
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)} className={selectCls}>
              <option value="">— none —</option>
              {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          {isVm && (
            <div>
              <label className={labelCls}>VM ID (Proxmox)</label>
              <input type="number" value={vmid} onChange={(e) => setVmid(e.target.value)} className={inputCls} placeholder="100" />
            </div>
          )}
          {isContainer && (
            <div>
              <label className={labelCls}>Ports (comma-separated)</label>
              <input value={portsRaw} onChange={(e) => setPortsRaw(e.target.value)} className={inputCls} placeholder="8080:80, 5432:5432" />
            </div>
          )}
        </>
      )}

      {/* Endpoint fields */}
      {isEndpoint && (
        <>
          <div>
            <label className={labelCls}>URL *</label>
            <input required value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://example.com" />
          </div>
          <div>
            <label className={labelCls}>Protocol</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className={selectCls}>
              <option value="">— select —</option>
              {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </>
      )}

      {/* Repository fields */}
      {isRepository && (
        <>
          <div>
            <label className={labelCls}>URL *</label>
            <input required value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://github.com/org/repo" />
          </div>
          <div>
            <label className={labelCls}>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectCls}>
              <option value="">— select —</option>
              {["github", "gitlab", "gitea", "bitbucket", "other"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
        </>
      )}

      {/* Secret fields */}
      {isSecret && (
        <>
          <div>
            <label className={labelCls}>URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://toke.dnsif.ca/ui/vault/secrets/kv/show/..." />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
        </>
      )}

      {/* Document fields */}
      {isDocument && (
        <>
          <div>
            <label className={labelCls}>URL *</label>
            <input required value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://docs.example.com" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
        </>
      )}

      {/* Parent */}
      <div>
        <label className={labelCls}>Parent Item</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={selectCls}>
          <option value="">— none —</option>
          {allItems
            .filter((i) => i.id !== initial?.id)
            .map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
            ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className={labelCls}>Tags (comma-separated)</label>
        <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} className={inputCls} placeholder="prod, backend, k8s" />
      </div>

      {/* OpenBao paths */}
      <div>
        <label className={labelCls}>OpenBao Paths (comma-separated)</label>
        <input value={openbaoRaw} onChange={(e) => setOpenbaoRaw(e.target.value)} className={inputCls} placeholder="secret/data/myapp" />
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)] w-full resize-none"
        />
      </div>

      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-sm px-4 py-1.5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
