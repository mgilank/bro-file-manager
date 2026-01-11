import { API_BASE } from "../constants";

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
