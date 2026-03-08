import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Device } from "../types";
import { listDevices, createDevice, deleteDevice } from "../api";
import DeviceForm from "../components/DeviceForm";

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");

  const load = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterType) params.type = filterType;
    if (filterPlatform) params.platform = filterPlatform;
    listDevices(params).then(setDevices);
  };

  useEffect(() => { load(); }, [search, filterType, filterPlatform]);

  const handleCreate = async (data: Partial<Device>) => {
    await createDevice(data);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this device?")) return;
    await deleteDevice(id);
    load();
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">Devices</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add Device"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <DeviceForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Create" />
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, IP, FQDN, tag..."
          className={`${inputCls} w-72`}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputCls}>
          <option value="">All types</option>
          <option value="server">server</option>
          <option value="vm">vm</option>
          <option value="container">container</option>
          <option value="service">service</option>
          <option value="network-device">network-device</option>
          <option value="cloud-resource">cloud-resource</option>
        </select>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className={inputCls}>
          <option value="">All platforms</option>
          <option value="proxmox">proxmox</option>
          <option value="docker">docker</option>
          <option value="k8s">k8s</option>
          <option value="bare-metal">bare-metal</option>
          <option value="digitalocean">digitalocean</option>
          <option value="cloudflare">cloudflare</option>
          <option value="aws">aws</option>
          <option value="hetzner">hetzner</option>
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Platform</th>
              <th className="px-4 py-2.5 font-medium">IPs</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Tags</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                <td className="px-4 py-2">
                  <Link to={`/devices/${d.id}`} className="text-[var(--accent-text)] hover:underline">
                    {d.name}
                  </Link>
                  {d.fqdn && <span className="text-[var(--text-muted)] text-xs ml-2">{d.fqdn}</span>}
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{d.type}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{d.platform || "—"}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)] font-mono text-xs">{d.ips.join(", ") || "—"}</td>
                <td className={`px-4 py-2 text-[var(--status-${d.status})]`}>{d.status}</td>
                <td className="px-4 py-2">
                  {d.tags.map((t) => (
                    <span key={t} className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)]">
                      {t}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(d.id)} className="text-[var(--danger)] hover:opacity-70 text-xs">
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No devices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
