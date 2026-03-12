import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Repository } from "../types";
import { REPO_PLATFORMS } from "../types";
import { listRepositories, createRepository, deleteRepository } from "../api";
import RepositoryForm from "../components/RepositoryForm";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterPlatform) params.platform = filterPlatform;
    listRepositories(params).then(setRepos);
  };

  useEffect(() => { load(); }, [search, filterPlatform]);

  const handleCreate = async (data: Partial<Repository>) => {
    await createRepository(data);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this repository?")) return;
    await deleteRepository(id);
    load();
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">Repositories</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add Repository"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">Add Repository</h2>
            <RepositoryForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Create" />
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, URL, tag..."
          className={`${inputCls} w-72`}
        />
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className={inputCls}>
          <option value="">All platforms</option>
          {REPO_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">URL</th>
              <th className="px-4 py-2.5 font-medium">Platform</th>
              <th className="px-4 py-2.5 font-medium">Tags</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                <td className="px-4 py-2">
                  <Link to={`/repositories/${r.id}`} className="text-[var(--accent-text)] hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)] font-mono text-xs">{r.url}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{r.platform || "—"}</td>
                <td className="px-4 py-2">
                  {r.tags.map((t) => (
                    <span key={t} className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)]">
                      {t}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(r.id)} className="text-[var(--danger)] hover:opacity-70 text-xs">
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {repos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No repositories found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
