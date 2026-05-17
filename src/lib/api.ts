import axios from "axios";

const TOKEN_KEY = "tinyurl.jwt";

export const apiPrefix = import.meta.env.VITE_API_PREFIX ?? "";

export const api = axios.create({
  baseURL: apiPrefix,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
