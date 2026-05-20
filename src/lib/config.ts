const configuredApiURL = import.meta.env.VITE_API_URL?.trim() ?? "";

export const apiBaseURL = configuredApiURL;

export const backendOrigin =
  configuredApiURL ||
  (typeof window !== "undefined" ? window.location.origin : "");

