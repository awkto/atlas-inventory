import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Item } from "../types";
import { INFRA_TYPES } from "../types";
import { getItem, listItems, updateItem, deleteItem } from "../api";
import TagBadge from "../components/TagBadge";
import ItemForm from "../components/ItemForm";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--text-heading)]">{value || <span className="text-[var(--text-muted)]">—</span>}</dd>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [children, setChildren] = useState<Item[]>([]);
  const [parent, setParent] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const itemId = parseInt(id ?? "0");

  const load = async () => {
    try {
      const i = await getItem(itemId);
      setItem(i);
      const kids = await listItems({ parent_id: String(itemId) });
      setChildren(kids);
      if (i.parent_id) {
        const p = await getItem(i.parent_id);
        setParent(p);
      } else {
        setParent(null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [itemId]);

  const handleUpdate = async (data: Partial<Item>) => {
    await updateItem(itemId, data);
    setEditing(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this item?")) return;
    await deleteItem(itemId);
    nav("/");
  };

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!item) return <p className="text-[var(--text-muted)]">Loading…</p>;

  const isInfra = INFRA_TYPES.includes(item.type);
  const isEndpoint = item.type === "endpoint";
  const isRepository = item.type === "repository";
  const isDocument = item.type === "document";
  const isSecret = item.type === "secret";

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-sm mb-4">
          ← Cancel edit
        </button>
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-lg">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">Edit {item.name}</h2>
          <ItemForm
            initial={item}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="Save Changes"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-sm">← Back</Link>
        <span className="text-[var(--border-card)]">/</span>
        <h1 className="text-xl font-bold text-[var(--text-heading)]">{item.name}</h1>
        <span className="bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-2 py-0.5 text-xs border border-[var(--border-card)]">{item.type}</span>
        <div className="ml-auto flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="text-[var(--accent-text)] hover:opacity-70 text-sm"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="text-[var(--danger)] hover:opacity-70 text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {parent && (
        <div className="mb-4 text-sm text-[var(--text-muted)]">
          Parent:{" "}
          <Link to={`/items/${parent.id}`} className="text-[var(--accent-text)] hover:underline">
            {parent.name}
          </Link>{" "}
          <span className="text-xs">({parent.type})</span>
        </div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {isInfra && (
            <>
              <Field label="FQDN" value={<span className="font-mono text-xs">{item.fqdn}</span>} />
              <Field label="IPs" value={item.ips.length ? item.ips.join(", ") : null} />
              <Field label="Platform" value={item.platform} />
              <Field label="Status" value={item.status} />
              <Field label="Network" value={item.network ? item.network.name : null} />
            </>
          )}
          {(isEndpoint || isRepository || isDocument || isSecret) && (
            <Field
              label="URL"
              value={
                item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline font-mono text-xs break-all">
                    {item.url}
                  </a>
                ) : null
              }
            />
          )}
          {isEndpoint && <Field label="Protocol" value={item.protocol} />}
          {(isRepository || isDocument || isSecret) && <Field label="Description" value={item.description} />}
          {isRepository && <Field label="Platform" value={item.platform} />}
        </dl>

        {item.tags.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Tags</p>
            <div>{item.tags.map((t) => <TagBadge key={t} tag={t} />)}</div>
          </div>
        )}

        {item.openbao_paths.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">OpenBao Paths</p>
            <ul className="list-disc list-inside space-y-0.5">
              {item.openbao_paths.map((p) => (
                <li key={p} className="text-sm font-mono text-[var(--text-secondary)]">{p}</li>
              ))}
            </ul>
          </div>
        )}

        {item.notes && (
          <div className="mt-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Notes</p>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
            Children ({children.length})
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                    <td className="px-4 py-2">
                      <Link to={`/items/${c.id}`} className="text-[var(--accent-text)] hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{c.type}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{c.status || "—"}</td>
                    <td className="px-4 py-2">{c.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
