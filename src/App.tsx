import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthPanel } from "./components/AuthPanel";
import { MyLinksPanel } from "./components/MyLinksPanel";
import { useAuth } from "./context/AuthContext";
import { api, apiPrefix } from "./lib/api";

interface ApiSuccess {
  status: "success";
  message: string;
  data: {
    alias: {
      id: number;
      userId: number | null;
      longURLId: number;
      alias: string | null;
      clickCount: number;
      createdAt: string;
      expiresAt: string | null;
    };
    longURL: {
      id: number;
      originalUrl: string;
      createdAt: string;
    };
  };
}

interface ApiErrorBody {
  status: "error";
  message: string;
  errorCode?: string;
  details?: Record<string, string[] | undefined>;
}

interface ProtectedRouteProps {
  children: ReactNode;
}

interface PublicOnlyRouteProps {
  children: ReactNode;
}

interface ShellProps {
  children: ReactNode;
}

interface AuthPageProps {
  mode: "login" | "signup";
}

const textButtonClass =
  "rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-50";
const primaryButtonClass =
  "rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-sm font-normal leading-relaxed text-gray-400";
const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50";
const cardClass =
  "rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-colors duration-150 hover:border-gray-300";

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p className="text-sm font-normal leading-relaxed text-gray-400">
        Checking session...
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <p className="text-sm font-normal leading-relaxed text-gray-400">
        Checking session...
      </p>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Shell({ children }: ShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = useCallback(() => {
    logout();
    navigate("/", { replace: true });
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4 min-[450px]:gap-6">
          <Link
            to="/"
            aria-label="TinyURL home"
            className="flex items-center gap-2 text-gray-900 transition-colors duration-150 hover:text-gray-900"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-lg font-semibold tracking-tight">TinyURL</span>
          </Link>

          <nav className="order-2 flex w-full items-center gap-3 min-[450px]:order-none min-[450px]:w-auto">
            <Link
              to="/"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                location.pathname === "/"
                  ? "bg-blue-50 text-blue-500"
                  : "text-gray-900 hover:bg-gray-50"
              }`}
            >
              Shorten URL
            </Link>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    location.pathname === "/dashboard"
                      ? "bg-blue-50 text-blue-500"
                      : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Dashboard
                </Link>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-500"
                  title={user.email}
                >
                  {initials(user.name, user.email)}
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2 py-2 text-sm font-medium text-gray-900 transition-colors duration-150 hover:text-blue-500"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={textButtonClass}>
                  Log in
                </Link>
                <Link to="/signup" className={primaryButtonClass}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function Shortener() {
  const [longURL, setLongURL] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAlias, setCreatedAlias] = useState<ApiSuccess["data"] | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const resolvedShortUrl = useMemo(() => {
    const shortCode = createdAlias?.alias.alias;
    if (!shortCode) return null;
    const origin = import.meta.env.VITE_PUBLIC_ORIGIN ?? window.location.origin;
    const base = apiPrefix.startsWith("http") ? apiPrefix : `${origin}${apiPrefix}`;
    return `${base}/api/v1/${encodeURIComponent(shortCode)}`;
  }, [createdAlias]);

  const submit = useCallback(async () => {
    setError(null);
    setCopied(false);

    const normalized = normalizeUrlInput(longURL);
    if (!normalized) {
      setError("Enter a URL to shorten.");
      return;
    }
    if (!isValidHttpUrl(normalized)) {
      setError("Invalid URL format.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { longURL: normalized };
      if (customAlias.trim()) body.customAlias = customAlias.trim();

      const days = Number(expiresInDays);
      if (expiresInDays.trim() && Number.isFinite(days) && days > 0) {
        body.expiresInDays = Math.floor(days);
      }

      const { data } = await api.post<ApiSuccess>("/api/v1/short", body);
      const alias = data.data.alias.alias;
      if (data.status !== "success" || !alias) {
        setError("Server did not return a short code.");
        return;
      }

      setCreatedAlias(data.data);
    } catch (err) {
      const response = (err as { response?: { data?: ApiErrorBody } }).response;
      const data = response?.data;
      const message =
        data?.details && Object.keys(data.details).length
          ? `${data.message}: ${JSON.stringify(data.details)}`
          : data?.message || "Network error. Is the API running?";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [customAlias, expiresInDays, longURL]);

  const copy = useCallback(async () => {
    if (!resolvedShortUrl) return;
    try {
      await navigator.clipboard.writeText(resolvedShortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [resolvedShortUrl]);

  return (
    <section className={`${cardClass} flex flex-col gap-6 p-8`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Shorten URL
        </h1>
        <p className="text-sm font-normal leading-relaxed text-gray-400">
          Create a short link that is easy to share.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="flex flex-col gap-2">
            <label htmlFor="url" className={labelClass}>
              Long URL
            </label>
            <input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/page"
              className={inputClass}
              value={longURL}
              onChange={(event) => setLongURL(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="expires" className={labelClass}>
              Expires in days
            </label>
            <input
              id="expires"
              type="number"
              min={1}
              max={365}
              placeholder="30"
              className={inputClass}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="alias" className={labelClass}>
            Custom alias
          </label>
          <input
            id="alias"
            type="text"
            placeholder="my-brand"
            className={inputClass}
            value={customAlias}
            onChange={(event) => setCustomAlias(event.target.value)}
            disabled={loading}
          />
        </div>

        {error ? (
          <p
            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-normal leading-relaxed text-gray-900"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Shortening..." : "Shorten"}
        </button>
      </form>

      {resolvedShortUrl ? (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-6">
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Short link
            </span>
            <p className="break-all font-mono text-sm text-gray-900">
              {resolvedShortUrl}
            </p>
            {createdAlias ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  Alias ID {createdAlias.alias.id}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  URL ID {createdAlias.alias.longURLId}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {createdAlias.alias.clickCount} clicks
                </span>
                {createdAlias.alias.expiresAt ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    Expires{" "}
                    {new Date(createdAlias.alias.expiresAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => void copy()} className={textButtonClass}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function AuthPage({ mode }: AuthPageProps) {
  return (
    <PublicOnlyRoute>
      <AuthPanel mode={mode} />
    </PublicOnlyRoute>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Shortener />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MyLinksPanel />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Shell>
  );
}
