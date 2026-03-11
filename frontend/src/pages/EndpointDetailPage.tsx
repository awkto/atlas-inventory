import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Endpoint, Device } from "../types";
import { getEndpoint, updateEndpoint, deleteEndpoint, getDevice } from "../api";
import EndpointForm from "../components/EndpointForm";

export default function EndpointDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [editing, setEditing] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!id) return;
    getEndpoint(Number(id)).then((ep) => {
      setEndpoint(ep);
      if (ep.device_id) getDevice(ep.device_id).then(setDevice);
    });
  }, [id]);

  if (!endpoint) return <p className="text-[var(--text-muted)]">Loading...</p>;

  const handleUpdate = async (data: Partial<Endpoint>) => {
    const updated = await updateEndpoint(endpoint.id, data);
    setEndpoint(updated);
    setEditing(false);
    if (updated.device_id) {
      getDevice(updated.device_id).then(setDevice);
    } else {
      setDevice(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this endpoint?")) return;
    await deleteEndpoint(endpoint.id);
    nav("/endpoints");
  };

  if (editing) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6 text-[var(--text-heading)]">Edit: {endpoint.label}</h1>
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <EndpointForm initial={endpoint} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
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
          <Link to="/endpoints" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">&larr; Back</Link>
          <h1 className="text-xl font-bold text-[var(--text-heading)]">{endpoint.label}</h1>
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
            {field("URL", <span className="font-mono text-sm">{endpoint.url}</span>)}
            {field("Protocol", endpoint.protocol)}
            {field("Device", device && (
              <Link to={`/devices/${device.id}`} className="text-[var(--accent-text)] hover:underline">
                {device.name}
              </Link>
            ))}
            {field("Tags", endpoint.tags.length > 0 && endpoint.tags.map((t) => (
              <span key={t} className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)]">{t}</span>
            )))}
          </div>
          {endpoint.openbao_paths.length > 0 && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">OpenBao Paths</span>
              <div className="font-mono text-xs text-[var(--text-primary)] space-y-1">
                {endpoint.openbao_paths.map((p) => <div key={p}>{p}</div>)}
              </div>
            </div>
          )}
          {endpoint.notes && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">Notes</span>
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{endpoint.notes}</pre>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <div className="text-xs text-[var(--text-muted)]">
            <div>Created: {new Date(endpoint.created_at).toLocaleString()}</div>
            <div>Updated: {new Date(endpoint.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
