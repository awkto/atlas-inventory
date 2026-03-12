import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Item } from "../types";
import { ITEM_TYPES, INFRA_TYPES, STATUSES } from "../types";
import { listItems, createItem, deleteItem } from "../api";
import TagBadge from "../components/TagBadge";
import ItemForm from "../components/ItemForm";

function getDetails(item: Item): string {
  if (INFRA_TYPES.includes(item.type)) return item.fqdn || "";
  if (item.type === "endpoint" || item.type === "repository" || item.type === "document") return item.url || "";
  if (item.type === "secret") return item.openbao_paths[0] || "";
  return "";
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("server");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = (params?: Record<string, string>) =>
    listItems(params).then(setItems);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;
    load(Object.keys(params).length ? params : undefined);
  }, [search, filterType, filterStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCreate = async (data: Partial<Item>) => {
    await createItem(data);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    await deleteItem(id);
    load();
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";
  const selectCls = "bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">Items</h1>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm flex items-center gap-1"
          >
            + Add <span className="text-xs">▾</span>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg shadow-lg z-20 py-1">
              {ITEM_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setModalType(t);
                    setShowModal(true);
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-1.5 text-sm text-[var(--text-heading)] hover:bg-[var(--bg-card-hover)]"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className={`${inputCls} w-56`}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
          <option value="">All types</option>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
              <th className="px-4 py-2.5 font-medium">Platform</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Tags</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                <td className="px-4 py-2">
                  <Link to={`/items/${item.id}`} className="text-[var(--accent-text)] hover:underline font-medium">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.type}</td>
                <td className="px-4 py-2 text-[var(--text-muted)] font-mono text-xs max-w-xs truncate">
                  {getDetails(item) || "—"}
                </td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.platform || "—"}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.status || "—"}</td>
                <td className="px-4 py-2">{item.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-[var(--danger)] hover:opacity-70 text-xs"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">Add {modalType}</h2>
            <ItemForm
              initialType={modalType}
              onSubmit={handleCreate}
              onCancel={() => setShowModal(false)}
              submitLabel="Create"
            />
          </div>
        </div>
      )}
    </div>
  );
}
