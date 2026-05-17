export interface AliasRow {
  aliasId: number;
  alias: string | null;
  clickCount: number;
  URLId: number;
  longURL: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AnalyticsSuccessPayload {
  aliasId: number;
  totalClicks: number;
  uniqueClicks: number;
  countries: Record<string, number>;
  referrers: Record<string, number>;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  os: Record<string, number>;
}

export interface AnalyticsErrorPayload {
  error: string;
}

export type AnalyticsPayload = AnalyticsSuccessPayload | AnalyticsErrorPayload;

export interface ClickUpdatePayload {
  aliasId: number;
  totalClicks: number;
  browser: string | null;
  os: string | null;
  device: string | null;
}

export function isAnalyticsError(
  payload: AnalyticsPayload
): payload is AnalyticsErrorPayload {
  return "error" in payload;
}
