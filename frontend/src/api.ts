import type { Device, DeviceTree, Network } from "./types";

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

// Devices
export const listDevices = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<Device[]>(`/api/devices${qs}`);
};
export const getDevice = (id: number) => request<Device>(`/api/devices/${id}`);
export const createDevice = (data: Partial<Device>) =>
  request<Device>("/api/devices", { method: "POST", body: JSON.stringify(data) });
export const updateDevice = (id: number, data: Partial<Device>) =>
  request<Device>(`/api/devices/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDevice = (id: number) =>
  request<void>(`/api/devices/${id}`, { method: "DELETE" });
export const getDeviceTree = () => request<DeviceTree[]>("/api/devices/tree");

// Networks
export const listNetworks = () => request<Network[]>("/api/networks");
export const getNetwork = (id: number) => request<Network>(`/api/networks/${id}`);
export const createNetwork = (data: Partial<Network>) =>
  request<Network>("/api/networks", { method: "POST", body: JSON.stringify(data) });
export const updateNetwork = (id: number, data: Partial<Network>) =>
  request<Network>(`/api/networks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteNetwork = (id: number) =>
  request<void>(`/api/networks/${id}`, { method: "DELETE" });

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
