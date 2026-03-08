import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Device } from "../types";
import { getDevice, updateDevice, deleteDevice, listDevices } from "../api";
import DeviceForm from "../components/DeviceForm";

export default function DeviceDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [editing, setEditing] = useState(false);
  const [children, setChildren] = useState<Device[]>([]);

  useEffect(() => {
    if (!id) return;
    getDevice(Number(id)).then(setDevice);
    listDevices({ parent_id: id }).then(setChildren);
  }, [id]);

  if (!device) return <p className="text-[var(--text-muted)]">Loading...</p>;

  const handleUpdate = async (data: Partial<Device>) => {
    const updated = await updateDevice(device.id, data);
    setDevice(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this device?")) return;
    await deleteDevice(device.id);
    nav("/");
  };

  if (editing) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6 text-[var(--text-heading)]">Edit: {device.name}</h1>
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <DeviceForm initial={device} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      </div>
    );
  }

  const field = (label: string, value: React.ReactNode) => (
    <div className="mb-3">
      <span className="text-[var(--text-muted)] text-xs block">{label}</span>
      <span className="text-[var(--text-heading)]">{value || <span className="text-[var(--text-muted)]">—</span>}</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">&larr; Back</Link>
          <h1 className="text-xl font-bold text-[var(--text-heading)]">{device.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded border ${
            device.status === "active"
              ? "bg-[var(--status-active-bg)] text-[var(--status-active)] border-[var(--status-active)]"
              : device.status === "inactive"
              ? "bg-[var(--status-inactive-bg)] text-[var(--status-inactive)] border-[var(--status-inactive)]"
              : "bg-[var(--status-unknown-bg)] text-[var(--status-unknown)] border-[var(--status-unknown)]"
          }`} style={{ borderColor: "currentColor", borderWidth: 1 }}>{device.status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded px-3 py-1.5 text-sm border border-[var(--border-card)]">
            Edit
          </button>
          <button onClick={handleDelete} className="bg-[var(--danger-bg)] hover:opacity-80 text-[var(--danger)] rounded px-3 py-1.5 text-sm border border-[var(--danger-border)]">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <div className="grid grid-cols-2 gap-x-8">
            {field("FQDN", device.fqdn)}
            {field("Type", device.type)}
            {field("Platform", device.platform)}
            {field("IPs", device.ips.length > 0 && (
              <span className="font-mono text-sm">{device.ips.join(", ")}</span>
            ))}
            {field("Network", device.network && `${device.network.name} (${device.network.cidr})`)}
            {field("Tags", device.tags.length > 0 && device.tags.map((t) => (
              <span key={t} className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)]">{t}</span>
            )))}
          </div>
          {device.openbao_paths.length > 0 && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">OpenBao Paths</span>
              <div className="font-mono text-xs text-[var(--text-primary)] space-y-1">
                {device.openbao_paths.map((p) => <div key={p}>{p}</div>)}
              </div>
            </div>
          )}
          {device.notes && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">Notes</span>
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{device.notes}</pre>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] mb-3">Children</h2>
          {children.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No child devices</p>
          ) : (
            <div className="space-y-2">
              {children.map((c) => (
                <Link key={c.id} to={`/devices/${c.id}`} className="block text-[var(--accent-text)] hover:underline text-sm">
                  {c.name} <span className="text-[var(--text-muted)] text-xs">({c.type})</span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)]">
            <div>Created: {new Date(device.created_at).toLocaleString()}</div>
            <div>Updated: {new Date(device.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
