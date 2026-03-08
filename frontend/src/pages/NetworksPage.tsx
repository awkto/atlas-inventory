import { useEffect, useState } from "react";
import type { Network } from "../types";
import { listNetworks, createNetwork, deleteNetwork } from "../api";

export default function NetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cidr, setCidr] = useState("");
  const [desc, setDesc] = useState("");

  const load = () => listNetworks().then(setNetworks);
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNetwork({ name, cidr, description: desc || null });
    setName(""); setCidr(""); setDesc("");
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this network?")) return;
    await deleteNetwork(id);
    load();
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">Networks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add Network"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 flex gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="home-lan" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">CIDR</label>
            <input required value={cidr} onChange={(e) => setCidr(e.target.value)} className={inputCls} placeholder="10.0.0.0/24" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <button type="submit" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm">
            Create
          </button>
        </form>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">CIDR</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                <td className="px-4 py-2 text-[var(--accent-text)]">{n.name}</td>
                <td className="px-4 py-2 font-mono text-[var(--text-secondary)]">{n.cidr}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{n.description || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(n.id)} className="text-[var(--danger)] hover:opacity-70 text-xs">
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {networks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No networks defined
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
