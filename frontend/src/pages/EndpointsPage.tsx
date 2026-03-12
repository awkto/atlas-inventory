import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Endpoint, Device } from "../types";
import { PROTOCOLS } from "../types";
import { listEndpoints, createEndpoint, deleteEndpoint, listDevices } from "../api";
import EndpointForm from "../components/EndpointForm";
import TagBadge from "../components/TagBadge";

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterProtocol, setFilterProtocol] = useState("");

  const load = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterProtocol) params.protocol = filterProtocol;
    listEndpoints(params).then(setEndpoints);
  };

  useEffect(() => { load(); }, [search, filterProtocol]);
  useEffect(() => { listDevices().then(setDevices); }, []);

  const handleCreate = async (data: Partial<Endpoint>) => {
    await createEndpoint(data);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this endpoint?")) return;
    await deleteEndpoint(id);
    load();
  };

  const deviceName = (deviceId: number | null) => {
    if (!deviceId) return "—";
    const d = devices.find((dev) => dev.id === deviceId);
    return d ? d.name : "—";
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">Endpoints</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add Endpoint"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">Add Endpoint</h2>
            <EndpointForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Create" />
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search label, URL, tag..."
          className={`${inputCls} w-72`}
        />
        <select value={filterProtocol} onChange={(e) => setFilterProtocol(e.target.value)} className={inputCls}>
          <option value="">All protocols</option>
          {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
              <th className="px-4 py-2.5 font-medium">Label</th>
              <th className="px-4 py-2.5 font-medium">URL</th>
              <th className="px-4 py-2.5 font-medium">Protocol</th>
              <th className="px-4 py-2.5 font-medium">Device</th>
              <th className="px-4 py-2.5 font-medium">Tags</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                <td className="px-4 py-2">
                  <Link to={`/endpoints/${ep.id}`} className="text-[var(--accent-text)] hover:underline">
                    {ep.label}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)] font-mono text-xs">{ep.url}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{ep.protocol || "—"}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">
                  {ep.device_id ? (
                    <Link to={`/devices/${ep.device_id}`} className="text-[var(--accent-text)] hover:underline">
                      {deviceName(ep.device_id)}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-2">
                  {ep.tags.map((t) => <TagBadge key={t} tag={t} />)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(ep.id)} className="text-[var(--danger)] hover:opacity-70 text-xs">
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {endpoints.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No endpoints found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
