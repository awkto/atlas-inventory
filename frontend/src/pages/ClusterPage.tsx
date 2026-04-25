import { useEffect, useState, type ReactNode } from "react";
import {
  getHAStatus,
  getHAConfig,
  updateHAConfig,
  generatePairing,
  triggerBackup,
  listBackups,
  demoteSelf,
  syncNow,
  type HAStatus,
  type HAConfig,
} from "../api";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--text-heading)] font-mono text-right break-all max-w-[60%]">{value}</dd>
    </div>
  );
}

function StatusCard({ status }: { status: HAStatus }) {
  if (!status.enabled) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
        <h2 className="text-sm font-bold text-[var(--text-heading)] mb-2">HA is disabled</h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Two ways to turn it on:
        </p>
        <ul className="text-xs text-[var(--text-muted)] list-disc ml-5 mt-2 space-y-1">
          <li>
            This is the <strong>primary</strong> — scroll to <em>Pair a standby</em>, generate a
            secret, paste it into the standby's setup screen.
          </li>
          <li>
            This is the <strong>standby</strong> — that's done from this node's first-run setup
            screen by selecting "Join existing cluster".
          </li>
        </ul>
      </div>
    );
  }

  const meta = status.replica_meta || {};
  const isPrimary = status.role === "primary";
  const lastSync = isPrimary ? meta.last_pushed_at : meta.last_received_at;
  const lastSize = isPrimary ? meta.last_pushed_size_bytes : meta.last_received_size_bytes;
  const lastVersion = isPrimary ? meta.last_pushed_data_version : meta.last_received_data_version;
  const lastSeen = meta.last_seen_peer_at;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-3">Status</h2>
      <dl className="space-y-1">
        <Row
          label="Role"
          value={
            <span className={isPrimary ? "text-green-500" : "text-amber-500"}>
              {status.role}
            </span>
          }
        />
        <Row label="Self ID" value={status.self_id ?? "—"} />
        <Row
          label="Peer"
          value={
            <>
              <span>{status.peer_url || "(unset)"}</span>{" "}
              <span className={status.peer_reachable ? "text-green-500" : "text-red-500"}>
                — {status.peer_reachable ? "reachable" : "unreachable"}
              </span>
            </>
          }
        />
        <Row label="Sync interval" value={`${status.sync_interval_seconds ?? "—"} s`} />
        <Row label="Last contact" value={lastSeen ?? "never"} />
        <Row
          label={isPrimary ? "Last data push" : "Last data receive"}
          value={lastSync ? `${lastSync} · ${lastSize ? formatBytes(lastSize) : "?"} · v${lastVersion ?? "?"}` : "never (no writes since pairing)"}
        />
        <Row label="Last promoted" value={status.last_promoted_at ?? "never"} />
        <Row label="Last demoted" value={status.last_demoted_at ?? "never"} />
        <Row label="data_version" value={String(status.data_version ?? "—")} />
      </dl>
    </div>
  );
}

function ConfigEditor({ config, onSaved }: { config: HAConfig; onSaved: () => void }) {
  const [nodeA_base, setNodeA_base] = useState(config.node_a.base_url);
  const [nodeB_base, setNodeB_base] = useState(config.node_b.base_url);
  const [interval, setInterval_] = useState(config.sync_interval_seconds);
  const [enabled, setEnabled] = useState(config.enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await updateHAConfig({
        enabled,
        node_a_base_url: nodeA_base,
        node_b_base_url: nodeB_base,
        sync_interval_seconds: interval,
      });
      setMsg("Saved.");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
    setBusy(false);
  };

  const input =
    "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-xs font-mono text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-3">Configuration</h2>

      <label className="flex items-center gap-2 mb-4 text-sm text-[var(--text-heading)]">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        HA enabled
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-xs font-bold text-[var(--text-heading)] mb-2">
            Node A {config.self_id === "A" && <span className="text-[var(--text-muted)]">(this)</span>}
          </h3>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Base URL</label>
          <input
            type="text"
            value={nodeA_base}
            onChange={(e) => setNodeA_base(e.target.value)}
            placeholder="https://host-a:8000"
            className={input}
          />
        </div>
        <div>
          <h3 className="text-xs font-bold text-[var(--text-heading)] mb-2">
            Node B {config.self_id === "B" && <span className="text-[var(--text-muted)]">(this)</span>}
          </h3>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Base URL</label>
          <input
            type="text"
            value={nodeB_base}
            onChange={(e) => setNodeB_base(e.target.value)}
            placeholder="https://host-b:8000"
            className={input}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-[var(--text-muted)] mb-1">Sync interval (seconds)</label>
        <input
          type="number"
          value={interval}
          min={5}
          onChange={(e) => setInterval_(parseInt(e.target.value, 10) || 30)}
          className={input + " max-w-[10rem]"}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] rounded px-4 py-1.5 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <p className="text-xs text-[var(--text-muted)]">
          Token: <span className={config.token_set ? "text-green-500" : "text-amber-500"}>{config.token_set ? "set" : "not set"}</span>
        </p>
      </div>
      {msg && <p className="text-xs mt-2 text-[var(--text-muted)]">{msg}</p>}
    </div>
  );
}

function PairingCard({ config, onChanged }: { config: HAConfig; onChanged: () => void }) {
  const me = config.self_id.toLowerCase() === "a" ? config.node_a : config.node_b;
  const [myBaseUrl, setMyBaseUrl] = useState(me.base_url || window.location.origin);
  const [secret, setSecret] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const input =
    "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-1.5 text-xs font-mono text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]";

  const generate = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await generatePairing(myBaseUrl);
      setSecret(r.pairing_secret);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to generate pairing");
    }
    setBusy(false);
  };

  const copy = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-2">Pair a standby</h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Confirm how this node should be reached, then generate a secret and paste it into the
        new standby's setup screen.
      </p>

      <label className="block text-xs text-[var(--text-muted)] mb-1">This node's base URL</label>
      <input
        type="text"
        value={myBaseUrl}
        onChange={(e) => setMyBaseUrl(e.target.value)}
        className={input + " mb-3"}
      />

      <button
        onClick={generate}
        disabled={busy || !myBaseUrl}
        className="text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] rounded px-4 py-1.5 disabled:opacity-50 mb-3"
      >
        {busy ? "Generating…" : secret ? "Regenerate" : "Generate pairing secret"}
      </button>

      {err && <p className="text-red-500 text-xs">{err}</p>}

      {secret && (
        <div>
          <textarea
            value={secret}
            readOnly
            rows={4}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded p-2 text-xs font-mono text-[var(--text-heading)] mb-2"
          />
          <button
            onClick={copy}
            className="text-sm border border-[var(--border-input)] rounded px-3 py-1"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

function SyncCard({ status, onSynced }: { status: HAStatus; onSynced: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (status.role !== "primary") return null;

  const trigger = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await syncNow();
      setMsg(r.ok ? `Pushed ${r.size_bytes ? formatBytes(r.size_bytes) : "?"} (data_version=${r.data_version ?? "?"})` : `Failed: ${r.reason}`);
      onSynced();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    }
    setBusy(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-3">Replication</h2>
      <button
        onClick={trigger}
        disabled={busy}
        className="text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] rounded px-3 py-1.5 disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Push snapshot now"}
      </button>
      {msg && <p className="text-xs mt-2 text-[var(--text-muted)]">{msg}</p>}
      <p className="text-xs text-[var(--text-muted)] mt-3">
        Snapshots are pushed automatically every {status.sync_interval_seconds ?? 30}s, but only
        when <code>PRAGMA data_version</code> has changed since the last push.
      </p>
    </div>
  );
}

function BackupsCard() {
  const [backups, setBackups] = useState<Array<{ name: string; size_bytes: number; mtime: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    try {
      setBackups(await listBackups());
    } catch {
      setBackups([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const runBackup = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await triggerBackup();
      setMsg(r.skipped ? `Skipped — ${r.reason}` : `Backup created: ${formatBytes(r.size_bytes ?? 0)}`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Backup failed");
    }
    setBusy(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-3">Backups</h2>
      <button
        onClick={runBackup}
        disabled={busy}
        className="text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] rounded px-3 py-1.5 disabled:opacity-50 mb-3"
      >
        Run backup now
      </button>
      {msg && <p className="text-xs mb-2 text-[var(--text-muted)]">{msg}</p>}
      {backups.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">None yet.</p>
      ) : (
        <ul className="text-xs font-mono space-y-0.5 max-h-56 overflow-auto">
          {backups.map((b) => (
            <li key={b.name} className="flex justify-between text-[var(--text-muted)]">
              <span>{b.name}</span>
              <span>{formatBytes(b.size_bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DangerCard({ role, onChanged }: { role: string | undefined; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (role !== "primary") return null;

  const demote = async () => {
    if (!confirm("Demote this node to standby? Writes will stop here.")) return;
    setBusy(true);
    setMsg("");
    try {
      await demoteSelf();
      setMsg("Demoted.");
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Demote failed");
    }
    setBusy(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--danger-border)] rounded-lg p-6 mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-3">Danger zone</h2>
      <button
        onClick={demote}
        disabled={busy}
        className="text-sm text-[var(--danger)] border border-[var(--danger-border)] rounded px-3 py-1.5 disabled:opacity-50"
      >
        Demote this node to standby
      </button>
      {msg && <p className="text-xs mt-2 text-[var(--text-muted)]">{msg}</p>}
    </div>
  );
}

export default function ClusterPage() {
  const [status, setStatus] = useState<HAStatus | null>(null);
  const [config, setConfig] = useState<HAConfig | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const refresh = async () => {
    try {
      const [s, c] = await Promise.all([getHAStatus(), getHAConfig().catch(() => null)]);
      setStatus(s);
      setConfig(c);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!status) return null;

  const showPairing = !status.enabled || status.role === "primary";

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--text-heading)] mb-6">Cluster</h1>
      <StatusCard status={status} />
      {showPairing && config && <PairingCard config={config} onChanged={refresh} />}
      {status.enabled && <SyncCard status={status} onSynced={refresh} />}
      <BackupsCard />
      <DangerCard role={status.role} onChanged={refresh} />
      {config && (
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)] underline"
          >
            {showAdvanced ? "Hide advanced configuration" : "Show advanced configuration"}
          </button>
          {showAdvanced && (
            <div className="mt-3">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Populated by pairing. Edit only if a host moves or you need to retroactively
                correct a base URL.
              </p>
              <ConfigEditor config={config} onSaved={refresh} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
