import { API_BASE } from "../constants";
import type { S3ConfigForm } from "../types";

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
  });
}

export async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// S3 Configuration API
// ============================================================================

export async function s3ListConfigs() {
  return apiFetch("/s3/configs").then(r => r.json());
}

export async function s3GetConfig(id: string) {
  return apiFetch(`/s3/configs/${id}`).then(r => r.json());
}

export async function s3CreateConfig(config: S3ConfigForm) {
  return apiFetch("/s3/configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }).then(r => r.json());
}

export async function s3UpdateConfig(id: string, updates: Partial<S3ConfigForm>) {
  return apiFetch(`/s3/configs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  }).then(r => r.json());
}

export async function s3DeleteConfig(id: string) {
  return apiFetch(`/s3/configs/${id}`, {
    method: "DELETE",
  }).then(r => r.json());
}

export async function s3TestConnection(id: string) {
  return apiFetch(`/s3/configs/${id}/test`, {
    method: "POST",
  }).then(r => r.json());
}

// ============================================================================
// S3 Session API
// ============================================================================

export async function s3Connect(configId: string) {
  return apiFetch("/s3/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configId }),
  }).then(r => r.json());
}

export async function s3Disconnect(configId?: string) {
  return apiFetch("/s3/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configId ? { configId } : {}),
  }).then(r => r.json());
}

export async function s3GetCurrentConnection() {
  return apiFetch("/s3/current").then(r => r.json());
}

export async function s3ListConnections() {
  return apiFetch("/s3/connections").then(r => r.json());
}

// ============================================================================
// S3 File Operations
// ============================================================================

export async function s3List(configId: string, path: string, limit?: number, offset?: number) {
  const params = new URLSearchParams({ path });
  params.set("configId", configId);
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return apiFetch(`/s3/list?${params}`).then(r => r.json());
}

export async function s3Download(configId: string, path: string) {
  const params = new URLSearchParams({ path, configId });
  return apiFetch(`/s3/download?${params}`);
}

export async function s3Preview(configId: string, path: string) {
  const params = new URLSearchParams({ path, configId });
  return apiFetch(`/s3/preview?${params}`).then(r => r.json());
}

export async function s3GetImage(configId: string, path: string) {
  const params = new URLSearchParams({ path, configId });
  return apiFetch(`/s3/image?${params}`);
}

export async function s3GetEdit(configId: string, path: string) {
  const params = new URLSearchParams({ path, configId });
  return apiFetch(`/s3/edit?${params}`).then(r => r.json());
}

export async function s3SaveEdit(configId: string, path: string, content: string) {
  return apiFetch("/s3/edit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configId, path, content }),
  }).then(r => r.json());
}

export async function s3Upload(configId: string, file: File, path: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);
  formData.append("configId", configId);
  return apiFetch("/s3/upload", {
    method: "POST",
    body: formData,
  }).then(r => r.json());
}

export async function s3Delete(configId: string, path: string) {
  const params = new URLSearchParams({ path, configId });
  return apiFetch(`/s3/delete?${params}`, {
    method: "DELETE",
  }).then(r => r.json());
}

export async function s3Move(configId: string, source: string, destination: string) {
  return apiFetch("/s3/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configId, source, destination }),
  }).then(r => r.json());
}

export async function s3Copy(configId: string, source: string, destination: string) {
  return apiFetch("/s3/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configId, source, destination }),
  }).then(r => r.json());
}

export async function s3Mkdir(configId: string, path: string) {
  return apiFetch("/s3/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configId, path }),
  }).then(r => r.json());
}
