import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DeviceTree } from "../types";
import { getDeviceTree } from "../api";

function TreeNode({ device, depth = 0 }: { device: DeviceTree; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = device.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="flex items-center gap-2 py-1 hover:bg-[var(--bg-card-hover)] rounded px-2 group">
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="text-[var(--text-muted)] w-4 text-xs">
            {open ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4 text-[var(--text-muted)] text-xs text-center">·</span>
        )}
        <span className={`w-2 h-2 rounded-full`} style={{
          backgroundColor: device.status === "active" ? "var(--status-active)"
            : device.status === "inactive" ? "var(--status-inactive)"
            : "var(--status-unknown)"
        }} />
        <Link to={`/devices/${device.id}`} className="text-[var(--accent-text)] hover:underline text-sm">
          {device.name}
        </Link>
        <span className="text-[var(--text-muted)] text-xs">{device.type}</span>
        {device.platform && <span className="text-[var(--text-muted)] text-xs">/ {device.platform}</span>}
        {device.ips.length > 0 && (
          <span className="ml-auto text-xs font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition">
            {device.ips.join(", ")}
          </span>
        )}
      </div>
      {open && hasChildren && device.children.map((c) => (
        <TreeNode key={c.id} device={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function TreePage() {
  const [tree, setTree] = useState<DeviceTree[]>([]);

  useEffect(() => { getDeviceTree().then(setTree); }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6 text-[var(--text-heading)]">Hierarchy</h1>
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-4">
        {tree.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No devices. Add some from the Devices page.</p>
        ) : (
          tree.map((d) => <TreeNode key={d.id} device={d} />)
        )}
      </div>
    </div>
  );
}
