import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export async function apiRequest(path, options = {}) {
  const response = await apiClient.request({ url: path, ...options });
  return response.data;
}

export function checkBackend() {
  return apiRequest("/health");
}
