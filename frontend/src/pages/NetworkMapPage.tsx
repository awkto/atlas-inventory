import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Device, Network } from "../types";
import { listDevices, listNetworks } from "../api";

export default function NetworkMapPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [unassigned, setUnassigned] = useState<Device[]>([]);

  useEffect(() => {
    Promise.all([listNetworks(), listDevices()]).then(([nets, devs]) => {
      setNetworks(nets);
      setDevices(devs);
      setUnassigned(devs.filter((d) => !d.network_id));
    });
  }, []);

  const devicesInNetwork = (netId: number) => devices.filter((d) => d.network_id === netId);

  const statusDot = (status: string) => (
    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{
      backgroundColor: status === "active" ? "var(--status-active)"
        : status === "inactive" ? "var(--status-inactive)"
        : "var(--status-unknown)"
    }} />
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-6 text-[var(--text-heading)]">Network Map</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {networks.map((net) => {
          const netDevices = devicesInNetwork(net.id);
          return (
            <div key={net.id} className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[var(--accent-text)]">{net.name}</h2>
                <span className="text-xs font-mono text-[var(--text-muted)]">{net.cidr}</span>
              </div>
              {net.description && <p className="text-xs text-[var(--text-muted)] mb-3">{net.description}</p>}
              {netDevices.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No devices</p>
              ) : (
                <div className="space-y-1.5">
                  {netDevices.map((d) => (
                    <div key={d.id} className="flex items-center text-sm">
                      {statusDot(d.status)}
                      <Link to={`/devices/${d.id}`} className="text-[var(--text-primary)] hover:text-[var(--accent-text)] truncate">
                        {d.name}
                      </Link>
                      {d.ips.length > 0 && (
                        <span className="ml-auto text-xs font-mono text-[var(--text-muted)] pl-2">
                          {d.ips[0]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-2 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)]">
                {netDevices.length} device{netDevices.length !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div className="bg-[var(--bg-card-hover)] border border-[var(--border-card)] border-dashed rounded-lg p-4">
            <h2 className="font-bold text-[var(--text-muted)] mb-3">Unassigned</h2>
            <div className="space-y-1.5">
              {unassigned.map((d) => (
                <div key={d.id} className="flex items-center text-sm">
                  {statusDot(d.status)}
                  <Link to={`/devices/${d.id}`} className="text-[var(--text-primary)] hover:text-[var(--accent-text)] truncate">
                    {d.name}
                  </Link>
                  {d.ips.length > 0 && (
                    <span className="ml-auto text-xs font-mono text-[var(--text-muted)] pl-2">
                      {d.ips[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)]">
              {unassigned.length} device{unassigned.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {networks.length === 0 && unassigned.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm col-span-full">
            No networks or devices yet. Add some from the Networks and Devices pages.
          </p>
        )}
      </div>
    </div>
  );
}
