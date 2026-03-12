import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Repository } from "../types";
import { getRepository, updateRepository, deleteRepository } from "../api";
import RepositoryForm from "../components/RepositoryForm";

export default function RepositoryDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRepository(Number(id)).then(setRepo);
  }, [id]);

  if (!repo) return <p className="text-[var(--text-muted)]">Loading...</p>;

  const handleUpdate = async (data: Partial<Repository>) => {
    const updated = await updateRepository(repo.id, data);
    setRepo(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this repository?")) return;
    await deleteRepository(repo.id);
    nav("/repositories");
  };

  if (editing) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6 text-[var(--text-heading)]">Edit: {repo.name}</h1>
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <RepositoryForm initial={repo} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
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
          <Link to="/repositories" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">&larr; Back</Link>
          <h1 className="text-xl font-bold text-[var(--text-heading)]">{repo.name}</h1>
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
            {field("URL", <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline font-mono text-sm">{repo.url}</a>)}
            {field("Platform", repo.platform)}
            {field("Description", repo.description)}
            {field("Tags", repo.tags.length > 0 && repo.tags.map((t) => (
              <span key={t} className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)]">{t}</span>
            )))}
          </div>
          {repo.openbao_paths.length > 0 && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">OpenBao Paths</span>
              <div className="font-mono text-xs text-[var(--text-primary)] space-y-1">
                {repo.openbao_paths.map((p) => <div key={p}>{p}</div>)}
              </div>
            </div>
          )}
          {repo.notes && (
            <div className="mt-4">
              <span className="text-[var(--text-muted)] text-xs block mb-1">Notes</span>
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{repo.notes}</pre>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6">
          <div className="text-xs text-[var(--text-muted)]">
            <div>Created: {new Date(repo.created_at).toLocaleString()}</div>
            <div>Updated: {new Date(repo.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
