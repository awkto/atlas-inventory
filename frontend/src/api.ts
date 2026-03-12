import type { Item, Network, Range, SearchResults } from "./types";

function getToken(): string | null {
  return localStorage.getItem("atlas_token");
}

export function setToken(token: string) {
  localStorage.setItem("atlas_token", token);
}

export function clearToken() {
  localStorage.removeItem("atlas_token");
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

// Auth check
export const checkAuth = async (): Promise<boolean> => {
  try {
    await checkHealth();
    return true;
  } catch {
    return false;
  }
};
