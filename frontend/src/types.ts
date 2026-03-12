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

export interface Item {
  id: number;
  type: string;
  name: string;
  url: string | null;
  fqdn: string | null;
  ips: string[];
  protocol: string | null;
  platform: string | null;
  status: string | null;
  description: string | null;
  parent_id: number | null;
  network_id: number | null;
  network: Network | null;
  vmid: number | null;
  ports: string[];
  tags: string[];
  openbao_paths: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ITEM_TYPES = ["server", "vm", "container", "service", "device", "endpoint", "repository", "secret", "document"] as const;
export type ItemType = typeof ITEM_TYPES[number];

export const INFRA_TYPES = ["server", "vm", "container", "service", "device"];
export const PLATFORMS = ["proxmox", "docker", "digitalocean", "github", "gitlab", "gitea", "bare-metal", "k8s", "aws", "gcp", "azure", "hetzner", "other"];
export const PROTOCOLS = ["http", "https", "ssh", "tcp", "udp", "grpc", "ws", "wss", "other"];
export const STATUSES = ["active", "inactive", "unknown"] as const;

export interface SearchResults {
  items: Item[];
}
