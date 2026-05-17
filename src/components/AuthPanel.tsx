import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AuthPanelProps {
  mode: "login" | "signup";
}

interface RedirectState {
  from?: {
    pathname?: string;
  };
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50";
const labelClass = "text-sm font-normal leading-relaxed text-gray-400";
const primaryButtonClass =
  "rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60";

export function AuthPanel({ mode }: AuthPanelProps) {
  const { login, signup } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }

      setPassword("");
      const from = (location.state as RedirectState | null)?.from?.pathname;
      navigate(from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {isSignup ? "Sign up" : "Log in"}
        </h1>
        <p className="text-sm font-normal leading-relaxed text-gray-400">
          {isSignup
            ? "Create your TinyURL account."
            : "Welcome back to TinyURL."}
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {isSignup ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="auth-name" className={labelClass}>
              Name
            </label>
            <input
              id="auth-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              disabled={submitting}
              required
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="auth-email" className={labelClass}>
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            disabled={submitting}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="auth-password" className={labelClass}>
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            disabled={submitting}
            required
            minLength={isSignup ? 8 : undefined}
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

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
    </section>
  );
}
