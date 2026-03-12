import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import type { SearchResults } from "../types";
import { searchByTag } from "../api";
import TagBadge from "../components/TagBadge";

export default function TagSearchPage() {
  const [params] = useSearchParams();
  const tag = params.get("tag") || "";
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (!tag) return;
    setResults(null);
    searchByTag(tag).then(setResults);
  }, [tag]);

  if (!tag) return <p className="text-[var(--text-muted)]">No tag specified.</p>;

  const total = results ? results.items.length : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">
          Tag: <span className="text-[var(--accent-text)]">{tag}</span>
        </h1>
        {total !== null && (
          <p className="text-[var(--text-muted)] text-sm mt-1">{total} item{total !== 1 ? "s" : ""} found</p>
        )}
      </div>

      {!results && <p className="text-[var(--text-muted)]">Loading...</p>}

      {results && (
        <div>
          {results.items.length > 0 ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Platform</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {results.items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                      <td className="px-4 py-2">
                        <Link to={`/items/${item.id}`} className="text-[var(--accent-text)] hover:underline">{item.name}</Link>
                      </td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{item.type}</td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{item.platform || "—"}</td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{item.status || "—"}</td>
                      <td className="px-4 py-2">{item.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[var(--text-muted)]">No items found with tag "{tag}".</p>
          )}
        </div>
      )}
    </div>
  );
}
