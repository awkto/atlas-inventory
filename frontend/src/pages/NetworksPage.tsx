import { useEffect, useState } from "react";
import type { Network, Range } from "../types";
import { listNetworks, createNetwork, updateNetwork, deleteNetwork, createRange, updateRange, deleteRange } from "../api";

function RangeRow({ r, networkId, onChanged }: { r: Range; networkId: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(r.label);
  const [startIp, setStartIp] = useState(r.start_ip);
  const [endIp, setEndIp] = useState(r.end_ip);
  const [desc, setDesc] = useState(r.description || "");
  const [error, setError] = useState("");

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-2 py-1 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  const save = async () => {
    try {
      setError("");
      await updateRange(networkId, r.id, { label, start_ip: startIp, end_ip: endIp, description: desc || null });
      setEditing(false);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this range?")) return;
    await deleteRange(networkId, r.id);
    onChanged();
  };

  if (editing) {
    return (
      <>
        <tr className="bg-[var(--bg-page)]">
          <td className="px-4 py-1.5 pl-12">
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputCls} w-full`} />
          </td>
          <td className="px-4 py-1.5">
            <div className="flex gap-1 items-center font-mono">
              <input value={startIp} onChange={(e) => setStartIp(e.target.value)} className={`${inputCls} w-28`} />
              <span className="text-[var(--text-muted)]">–</span>
              <input value={endIp} onChange={(e) => setEndIp(e.target.value)} className={`${inputCls} w-28`} />
            </div>
          </td>
          <td className="px-4 py-1.5">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} w-full`} />
          </td>
          <td className="px-4 py-1.5 text-right whitespace-nowrap">
            <button onClick={save} className="text-[var(--accent-text)] hover:opacity-70 text-xs mr-2">save</button>
            <button onClick={() => { setEditing(false); setError(""); }} className="text-[var(--text-muted)] hover:opacity-70 text-xs">cancel</button>
          </td>
        </tr>
        {error && <tr className="bg-[var(--bg-page)]"><td colSpan={4} className="px-4 pb-1.5 pl-12 text-[var(--danger)] text-xs">{error}</td></tr>}
      </>
    );
  }

  return (
    <tr className="bg-[var(--bg-page)] hover:bg-[var(--bg-card-hover)]">
      <td className="px-4 py-1.5 pl-12 text-[var(--text-secondary)] text-xs">{r.label}</td>
      <td className="px-4 py-1.5 font-mono text-[var(--text-muted)] text-xs">{r.start_ip} – {r.end_ip}</td>
      <td className="px-4 py-1.5 text-[var(--text-muted)] text-xs">{r.description || "—"}</td>
      <td className="px-4 py-1.5 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-[var(--accent-text)] hover:opacity-70 text-xs mr-2">edit</button>
        <button onClick={remove} className="text-[var(--danger)] hover:opacity-70 text-xs">delete</button>
      </td>
    </tr>
  );
}

function NetworkRow({ n, onChanged, forceExpanded }: { n: Network; onChanged: () => void; forceExpanded: boolean }) {
  const [expanded, setExpanded] = useState(forceExpanded);
  useEffect(() => { setExpanded(forceExpanded); }, [forceExpanded]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(n.name);
  const [cidr, setCidr] = useState(n.cidr);
  const [desc, setDesc] = useState(n.description || "");
  const [addingRange, setAddingRange] = useState(false);
  const [rangeLabel, setRangeLabel] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeDesc, setRangeDesc] = useState("");
  const [rangeError, setRangeError] = useState("");

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-2 py-1 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  const save = async () => {
    await updateNetwork(n.id, { name, cidr, description: desc || null });
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm("Delete this network and all its ranges?")) return;
    await deleteNetwork(n.id);
    onChanged();
  };

  const addRange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRangeError("");
      await createRange(n.id, { label: rangeLabel, start_ip: rangeStart, end_ip: rangeEnd, description: rangeDesc || null });
      setRangeLabel(""); setRangeStart(""); setRangeEnd(""); setRangeDesc("");
      setAddingRange(false);
      onChanged();
    } catch (err: any) {
      setRangeError(err.message);
    }
  };

  const rangeInputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-2 py-1 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <>
      {editing ? (
        <tr className="border-b border-[var(--border-subtle)]">
          <td className="px-4 py-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} />
          </td>
          <td className="px-4 py-2">
            <input value={cidr} onChange={(e) => setCidr(e.target.value)} className={`${inputCls} w-full`} />
          </td>
          <td className="px-4 py-2">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} w-full`} />
          </td>
          <td className="px-4 py-2 text-right whitespace-nowrap">
            <button onClick={save} className="text-[var(--accent-text)] hover:opacity-70 text-xs mr-2">save</button>
            <button onClick={() => { setEditing(false); setName(n.name); setCidr(n.cidr); setDesc(n.description || ""); }} className="text-[var(--text-muted)] hover:opacity-70 text-xs">cancel</button>
          </td>
        </tr>
      ) : (
        <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
          <td className="px-4 py-2">
            <button onClick={() => setExpanded(!expanded)} className="text-[var(--accent-text)] hover:underline flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">{expanded ? "▼" : "▶"}</span>
              {n.name}
              {n.ranges.length > 0 && <span className="text-[var(--text-muted)] text-xs ml-1">({n.ranges.length})</span>}
            </button>
          </td>
          <td className="px-4 py-2 font-mono text-[var(--text-secondary)]">{n.cidr}</td>
          <td className="px-4 py-2 text-[var(--text-muted)]">{n.description || "—"}</td>
          <td className="px-4 py-2 text-right whitespace-nowrap">
            <button onClick={() => setEditing(true)} className="text-[var(--accent-text)] hover:opacity-70 text-xs mr-2">edit</button>
            <button onClick={remove} className="text-[var(--danger)] hover:opacity-70 text-xs">delete</button>
          </td>
        </tr>
      )}
      {expanded && (
        <>
          {n.ranges.map((r) => (
            <RangeRow key={r.id} r={r} networkId={n.id} onChanged={onChanged} />
          ))}
          {addingRange ? (
            <>
              <tr className="bg-[var(--bg-page)]">
                <td className="px-4 py-1.5 pl-12">
                  <input required value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} className={`${rangeInputCls} w-full`} placeholder="Label" />
                </td>
                <td className="px-4 py-1.5">
                  <form onSubmit={addRange} className="flex gap-1 items-center font-mono">
                    <input required value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className={`${rangeInputCls} w-28`} placeholder="Start IP" />
                    <span className="text-[var(--text-muted)]">–</span>
                    <input required value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className={`${rangeInputCls} w-28`} placeholder="End IP" />
                  </form>
                </td>
                <td className="px-4 py-1.5">
                  <input value={rangeDesc} onChange={(e) => setRangeDesc(e.target.value)} className={`${rangeInputCls} w-full`} placeholder="Description" />
                </td>
                <td className="px-4 py-1.5 text-right whitespace-nowrap">
                  <button onClick={addRange} className="text-[var(--accent-text)] hover:opacity-70 text-xs mr-2">add</button>
                  <button onClick={() => { setAddingRange(false); setRangeError(""); }} className="text-[var(--text-muted)] hover:opacity-70 text-xs">cancel</button>
                </td>
              </tr>
              {rangeError && <tr className="bg-[var(--bg-page)]"><td colSpan={4} className="px-4 pb-1.5 pl-12 text-[var(--danger)] text-xs">{rangeError}</td></tr>}
            </>
          ) : (
            <tr className="bg-[var(--bg-page)]">
              <td colSpan={4} className="px-4 py-1.5 pl-12">
                <button onClick={() => setAddingRange(true)} className="text-[var(--accent-text)] hover:opacity-70 text-xs">+ add range</button>
              </td>
            </tr>
          )}
          <tr><td colSpan={4} className="h-1"></td></tr>
        </>
      )}
    </>
  );
}

export default function NetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [allExpanded, setAllExpanded] = useState(true);
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
              <th className="px-4 py-2.5 font-medium">
                <button onClick={() => setAllExpanded(!allExpanded)} className="text-[var(--text-thead)] hover:opacity-70 mr-2 text-xs" title={allExpanded ? "Collapse all" : "Expand all"}>
                  {allExpanded ? "▼" : "▶"}
                </button>
                Name
              </th>
              <th className="px-4 py-2.5 font-medium">CIDR</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <NetworkRow key={n.id} n={n} onChanged={load} forceExpanded={allExpanded} />
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
