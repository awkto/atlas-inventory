export interface Range {
  id: number;
  network_id: number;
  label: string;
  start_ip: string;
  end_ip: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Network {
  id: number;
  name: string;
  cidr: string;
  description: string | null;
  ranges: Range[];
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: number;
  name: string;
  fqdn: string | null;
  ips: string[];
  type: string;
  platform: string | null;
  status: string;
  notes: string | null;
  openbao_paths: string[];
  tags: string[];
  parent_id: number | null;
  network_id: number | null;
  network: Network | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceTree extends Device {
  children: DeviceTree[];
}

export type DeviceType =
  | "server"
  | "container"
  | "service"
  | "network-device"
  | "vm"
  | "cloud-resource";

export const DEVICE_TYPES: DeviceType[] = [
  "server",
  "container",
  "service",
  "network-device",
  "vm",
  "cloud-resource",
];

export const PLATFORMS = [
  "proxmox",
  "digitalocean",
  "cloudflare",
  "bare-metal",
  "docker",
  "k8s",
  "aws",
  "gcp",
  "azure",
  "hetzner",
  "linode",
  "other",
];

export const STATUSES = ["active", "inactive", "unknown"] as const;

export interface Endpoint {
  id: number;
  label: string;
  url: string;
  protocol: string | null;
  device_id: number | null;
  tags: string[];
  openbao_paths: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PROTOCOLS = [
  "http",
  "https",
  "ssh",
  "tcp",
  "udp",
  "grpc",
  "ws",
  "wss",
  "other",
];

export interface SearchResults {
  devices: Device[];
  endpoints: Endpoint[];
}
