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

  const total = results
    ? results.devices.length + results.endpoints.length + results.repositories.length
    : null;

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
        <div className="space-y-6">

          {/* Devices */}
          {results.devices.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Devices ({results.devices.length})
              </h2>
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">FQDN</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.devices.map((d) => (
                      <tr key={d.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                        <td className="px-4 py-2">
                          <Link to={`/devices/${d.id}`} className="text-[var(--accent-text)] hover:underline">{d.name}</Link>
                        </td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{d.type}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] text-xs font-mono">{d.fqdn || "—"}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{d.status}</td>
                        <td className="px-4 py-2">{d.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Endpoints */}
          {results.endpoints.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Endpoints ({results.endpoints.length})
              </h2>
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
                      <th className="px-4 py-2.5 font-medium">Label</th>
                      <th className="px-4 py-2.5 font-medium">URL</th>
                      <th className="px-4 py-2.5 font-medium">Protocol</th>
                      <th className="px-4 py-2.5 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.endpoints.map((ep) => (
                      <tr key={ep.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                        <td className="px-4 py-2">
                          <Link to={`/endpoints/${ep.id}`} className="text-[var(--accent-text)] hover:underline">{ep.label}</Link>
                        </td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] font-mono text-xs">{ep.url}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{ep.protocol || "—"}</td>
                        <td className="px-4 py-2">{ep.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Repositories */}
          {results.repositories.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Repositories ({results.repositories.length})
              </h2>
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-thead)] bg-[var(--bg-thead)] text-[var(--text-thead)] text-left">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">URL</th>
                      <th className="px-4 py-2.5 font-medium">Platform</th>
                      <th className="px-4 py-2.5 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.repositories.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]">
                        <td className="px-4 py-2">
                          <Link to={`/repositories/${r.id}`} className="text-[var(--accent-text)] hover:underline">{r.name}</Link>
                        </td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] font-mono text-xs">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.url}</a>
                        </td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{r.platform || "—"}</td>
                        <td className="px-4 py-2">{r.tags.map((t) => <TagBadge key={t} tag={t} />)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {total === 0 && (
            <p className="text-[var(--text-muted)]">No items found with tag "{tag}".</p>
          )}
        </div>
      )}
    </div>
  );
}
