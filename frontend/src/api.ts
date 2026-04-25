import type { Item, Network, Range, SearchResults } from "./types";

const TOKEN_KEY = "atlas_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || res.statusText);
  }
  return res.json();
}

// Items
export const listItems = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<Item[]>(`/api/items${qs}`);
};
export const getItem = (id: number) => request<Item>(`/api/items/${id}`);
export const createItem = (data: Partial<Item>) =>
  request<Item>("/api/items", { method: "POST", body: JSON.stringify(data) });
export const updateItem = (id: number, data: Partial<Item>) =>
  request<Item>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteItem = (id: number) =>
  request<void>(`/api/items/${id}`, { method: "DELETE" });

// Networks
export const listNetworks = () => request<Network[]>("/api/networks");
export const getNetwork = (id: number) => request<Network>(`/api/networks/${id}`);
export const createNetwork = (data: Partial<Network>) =>
  request<Network>("/api/networks", { method: "POST", body: JSON.stringify(data) });
export const updateNetwork = (id: number, data: Partial<Network>) =>
  request<Network>(`/api/networks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteNetwork = (id: number) =>
  request<void>(`/api/networks/${id}`, { method: "DELETE" });

// Ranges
export const createRange = (networkId: number, data: Partial<Range>) =>
  request<Range>(`/api/networks/${networkId}/ranges`, { method: "POST", body: JSON.stringify(data) });
export const updateRange = (networkId: number, rangeId: number, data: Partial<Range>) =>
  request<Range>(`/api/networks/${networkId}/ranges/${rangeId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteRange = (networkId: number, rangeId: number) =>
  request<void>(`/api/networks/${networkId}/ranges/${rangeId}`, { method: "DELETE" });

// Search
export const searchByTag = (tag: string) =>
  request<SearchResults>(`/api/search?tag=${encodeURIComponent(tag)}`);

// Health
export const checkHealth = () => request<{ status: string }>("/api/health");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthStatus {
  noauth: boolean;
  first_run: boolean;
}

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const res = await fetch("/api/auth/status");
  return res.json();
};

export const login = async (password: string): Promise<{ success: boolean; session_token?: string; error?: string }> => {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.detail || "Login failed" };
  }
  return data;
};

export const setup = async (password: string): Promise<{ success: boolean; session_token?: string; api_token?: string; error?: string }> => {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.detail || "Setup failed" };
  }
  return data;
};

export const logout = async () => {
  const token = getToken();
  if (token) {
    fetch("/api/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearToken();
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  return request<{ success: boolean; session_token: string; expires_in: number }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
};

export const getApiToken = () => request<{ api_token: string | null; noauth?: boolean }>("/api/auth/token");

export const regenerateApiToken = () =>
  request<{ success: boolean; api_token: string }>("/api/auth/token/regenerate", { method: "POST" });

// ---------------------------------------------------------------------------
// HA
// ---------------------------------------------------------------------------

export interface HAStatus {
  enabled: boolean;
  role: "primary" | "standby";
  self_id?: string;
  peer_id?: string;
  peer_url?: string;
  peer_reachable?: boolean;
  peer_role?: "primary" | "standby" | null;
  last_promoted_at?: string | null;
  last_demoted_at?: string | null;
  sync_interval_seconds?: number;
  replication_paused?: boolean;
  is_orphaned?: boolean;
  replica_meta?: {
    last_pushed_at?: string;
    last_pushed_data_version?: number;
    last_pushed_size_bytes?: number;
    last_received_at?: string;
    last_received_data_version?: string;
    last_received_size_bytes?: number;
    last_seen_peer_at?: string;
    peer_replication_paused?: boolean;
    sender_id?: string;
  };
  last_backup?: { name: string; size_bytes: number; mtime: string } | null;
  data_version?: number | null;
}

export const getHAStatus = async (): Promise<HAStatus> => {
  // Open endpoint — works even from a standby without a session.
  const res = await fetch("/api/ha/status");
  return res.json();
};

export const triggerFailover = async (force: boolean, haToken?: string) => {
  // Use the HA token if provided (standby without session), else session bearer.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["Authorization"] = `Bearer ${haToken ?? localStorage.getItem(TOKEN_KEY) ?? ""}`;
  const res = await fetch("/api/ha/failover", {
    method: "POST",
    headers,
    body: JSON.stringify({ force }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail?.error || body.detail || res.statusText);
  return body;
};

export const triggerBackup = () =>
  request<{ ok: boolean; skipped: boolean; reason?: string; path?: string; size_bytes?: number }>(
    "/api/ha/backup",
    { method: "POST" },
  );

export const listBackups = () =>
  request<Array<{ name: string; size_bytes: number; mtime: string }>>("/api/ha/backups");

export interface HAConfig {
  enabled: boolean;
  self_id: string;
  peer_id: string;
  token_set: boolean;
  sync_interval_seconds: number;
  replication_paused: boolean;
  node_a: { base_url: string };
  node_b: { base_url: string };
}

export const getHAConfig = () => request<HAConfig>("/api/ha/config");

export const updateHAConfig = (patch: {
  enabled?: boolean;
  node_a_base_url?: string;
  node_b_base_url?: string;
  sync_interval_seconds?: number;
  replication_paused?: boolean;
}) =>
  request<{ ok: boolean; changed: string[] }>("/api/ha/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const leaveCluster = () =>
  request<{ ok: boolean; message: string }>("/api/ha/leave-cluster", { method: "POST" });

export const generatePairing = (my_base_url?: string) =>
  request<{ pairing_secret: string }>("/api/ha/generate-pairing", {
    method: "POST",
    body: JSON.stringify({ my_base_url }),
  });

export const acceptPairing = async (pairing_secret: string, my_base_url: string) => {
  const res = await fetch("/api/ha/accept-pairing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairing_secret, my_base_url }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || res.statusText);
  return body as {
    ok: boolean;
    self_id: string;
    registered_with_peer: boolean;
    register_msg: string;
    peer_reachable: boolean;
    peer_role: string | null;
  };
};

export const syncNow = () =>
  request<{ ok: boolean; skipped?: boolean; size_bytes?: number; data_version?: number; reason?: string }>(
    "/api/ha/sync-now",
    { method: "POST" },
  );

export const demoteSelf = async () => {
  const res = await fetch("/api/ha/demote", {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` },
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
};
