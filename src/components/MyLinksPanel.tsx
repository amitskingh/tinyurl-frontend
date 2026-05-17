import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRealtimeAnalytics } from "../hooks/useRealtimeAnalytics";
import { api, apiPrefix } from "../lib/api";
import {
  isAnalyticsError,
  type AliasRow,
  type AnalyticsPayload,
  type AnalyticsSuccessPayload,
  type ClickUpdatePayload,
} from "../types/analytics";

interface ListPayload {
  status: string;
  message?: string;
  data: { aliases: AliasRow[] };
}

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const secondaryButtonClass =
  "rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const badgeClass =
  "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600";

function incrementMetric(
  metrics: Record<string, number>,
  key: string | null
): Record<string, number> {
  if (!key) return metrics;
  return {
    ...metrics,
    [key]: (metrics[key] ?? 0) + 1,
  };
}

function mergeClickUpdate(
  analytics: AnalyticsSuccessPayload,
  update: ClickUpdatePayload
): AnalyticsSuccessPayload {
  return {
    ...analytics,
    totalClicks: update.totalClicks,
    devices: incrementMetric(analytics.devices, update.device),
    browsers: incrementMetric(analytics.browsers, update.browser),
    os: incrementMetric(analytics.os, update.os),
  };
}

function realtimeStatusText(
  isConnected: boolean,
  state: string,
  error: string | null
) {
  if (isConnected) return "Live updates connected";
  if (state === "reconnecting") return "Live updates reconnecting";
  if (state === "connecting") return "Live updates connecting";
  if (error) return `Live updates unavailable: ${error}`;
  return "Live updates disconnected";
}

function formatMetricLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
        {value}
      </p>
    </div>
  );
}

interface MetricListProps {
  title: string;
  metrics: Record<string, number>;
}

function MetricList({ title, metrics }: MetricListProps) {
  const entries = Object.entries(metrics).sort(([, first], [, second]) => second - first);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-xs font-medium text-gray-400">{title}</p>
      {entries.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {entries.map(([name, count]) => (
            <li key={name} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-gray-900">
                {formatMetricLabel(name)}
              </span>
              <span className={badgeClass}>{count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-400">No data</p>
      )}
    </div>
  );
}

interface AnalyticsDetailsProps {
  aliasId: number;
  analytics: AnalyticsPayload;
  onClickUpdate: (update: ClickUpdatePayload) => void;
}

function AnalyticsDetails({
  aliasId,
  analytics,
  onClickUpdate,
}: AnalyticsDetailsProps) {
  const { clickUpdate, status, isConnected, error } =
    useRealtimeAnalytics(aliasId);

  useEffect(() => {
    if (clickUpdate) {
      onClickUpdate(clickUpdate);
    }
  }, [clickUpdate, onClickUpdate]);

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-900">
      <p className="sm:col-span-2 text-xs font-medium text-gray-400">
        {realtimeStatusText(isConnected, status.state, error)}
      </p>
      {isAnalyticsError(analytics) ? (
        <p className="mt-3">{analytics.error}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Alias ID" value={analytics.aliasId} />
          <StatCard label="Total clicks" value={analytics.totalClicks} />
          <StatCard label="Unique clicks" value={analytics.uniqueClicks} />
          <MetricList title="Countries" metrics={analytics.countries} />
          <MetricList title="Referrers" metrics={analytics.referrers} />
          <MetricList title="Devices" metrics={analytics.devices} />
          <MetricList title="Browsers" metrics={analytics.browsers} />
          <MetricList title="Operating systems" metrics={analytics.os} />
        </div>
      )}
    </div>
  );
}

export function MyLinksPanel() {
  const { user } = useAuth();
  const [aliases, setAliases] = useState<AliasRow[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [analyticsById, setAnalyticsById] = useState<
    Record<number, AnalyticsPayload | null>
  >({});
  const [loadingAnalytics, setLoadingAnalytics] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setListErr(null);
    setLoadingList(true);
    try {
      const { data: json } = await api.get<ListPayload>("/api/v1/");
      if (json.status !== "success" || !json.data?.aliases) {
        throw new Error(json.message || "Could not load links");
      }
      setAliases(json.data.aliases);
    } catch (error) {
      setListErr(error instanceof Error ? error.message : "Failed to load links");
      setAliases(null);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (aliasId: number) => {
    setLoadingAnalytics(aliasId);
    try {
      const { data } = await api.get<AnalyticsPayload>(
        `/api/v1/analytics/${aliasId}`
      );
      setAnalyticsById((prev) => ({ ...prev, [aliasId]: data }));
    } catch (error) {
      const response = (error as ErrorResponse).response;
      setAnalyticsById((prev) => ({
        ...prev,
        [aliasId]: {
          error: response?.data?.message || "Analytics failed",
        },
      }));
    } finally {
      setLoadingAnalytics(null);
    }
  }, []);

  const deleteAlias = useCallback(async (aliasId: number) => {
    setListErr(null);
    try {
      await api.delete(`/api/v1/${aliasId}`);
      setAliases((prev) =>
        prev ? prev.filter((alias) => alias.aliasId !== aliasId) : prev
      );
    } catch (error) {
      const response = (error as ErrorResponse).response;
      setListErr(response?.data?.message || "Could not delete link");
    }
  }, []);

  const applyRealtimeUpdate = useCallback((update: ClickUpdatePayload) => {
    setAliases((prev) =>
      prev
        ? prev.map((alias) =>
            alias.aliasId === update.aliasId
              ? { ...alias, clickCount: update.totalClicks }
              : alias
          )
        : prev
    );

    setAnalyticsById((prev) => {
      const current = prev[update.aliasId];
      if (!current || isAnalyticsError(current)) {
        return prev;
      }

      return {
        ...prev,
        [update.aliasId]: mergeClickUpdate(current, update),
      };
    });
  }, []);

  if (!user) {
    return null;
  }

  const origin =
    (typeof import.meta.env.VITE_PUBLIC_ORIGIN === "string" &&
      import.meta.env.VITE_PUBLIC_ORIGIN) ||
    window.location.origin;
  const shortUrlBase = apiPrefix.startsWith("http")
    ? apiPrefix
    : `${origin}${apiPrefix}`;

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-colors duration-150 hover:border-gray-300">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Your short links
            </h2>
            <p className="text-sm font-normal leading-relaxed text-gray-400">
              Only links created while signed in are tied to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loadingList}
            className={secondaryButtonClass}
          >
            {loadingList ? "Loading..." : aliases ? "Refresh" : "Load links"}
          </button>
        </div>

        {listErr ? (
          <p
            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-normal leading-relaxed text-gray-900"
            role="alert"
          >
            {listErr}
          </p>
        ) : null}

        {aliases && aliases.length === 0 ? (
          <p className="text-sm font-normal leading-relaxed text-gray-400">
            No links yet. Shorten one from the main page.
          </p>
        ) : null}

        {aliases && aliases.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {aliases.map((row) => {
              const shortPath = `${apiPrefix}/api/v1/${encodeURIComponent(
                row.alias ?? ""
              )}`;
              const shortUrl = apiPrefix.startsWith("http")
                ? shortPath
                : `${shortUrlBase}/api/v1/${encodeURIComponent(row.alias ?? "")}`;
              const analytics = analyticsById[row.aliasId];

              return (
                <li
                  key={row.aliasId}
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-colors duration-150 hover:bg-gray-50 hover:border-gray-300"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="break-all font-mono text-sm text-gray-900">
                          {shortUrl}
                        </p>
                        <p className="break-all text-sm font-normal leading-relaxed text-gray-400">
                          to {row.longURL}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className={badgeClass}>
                            Alias ID {row.aliasId}
                          </span>
                          <span className={badgeClass}>URL ID {row.URLId}</span>
                          <span className={badgeClass}>
                            {row.clickCount} clicks
                          </span>
                          <span className={badgeClass}>
                            Created {new Date(row.createdAt).toLocaleDateString()}
                          </span>
                          {row.expiresAt ? (
                            <span className={badgeClass}>
                              Expires{" "}
                              {new Date(row.expiresAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loadingAnalytics === row.aliasId}
                          onClick={() => void loadAnalytics(row.aliasId)}
                          className={secondaryButtonClass}
                        >
                          {loadingAnalytics === row.aliasId
                            ? "Loading..."
                            : analytics
                              ? "Refresh stats"
                              : "Analytics"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAlias(row.aliasId)}
                          className={secondaryButtonClass}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {analytics ? (
                      <AnalyticsDetails
                        aliasId={row.aliasId}
                        analytics={analytics}
                        onClickUpdate={applyRealtimeUpdate}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
