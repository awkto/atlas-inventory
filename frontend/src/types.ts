export interface Network {
  id: number;
  name: string;
  cidr: string;
  description: string | null;
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
