import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearAuthToken, getAuthToken, setAuthToken } from "../lib/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthContextValue {
  loading: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthPayload {
  status: "success";
  data: {
    user: AuthUser;
    token: string;
  };
}

interface MePayload {
  status: "success";
  data: {
    user: AuthUser;
  };
}

interface ApiErrorLike {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown, fallback: string): string {
  const response = (error as ApiErrorLike).response;
  return response?.data?.message || (error instanceof Error ? error.message : fallback);
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get<MePayload>("/api/auth/me");
        if (!active) return;
        setUser(data.data.user);
        setToken(storedToken);
      } catch {
        clearAuthToken();
        if (!active) return;
        setUser(null);
        setToken(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<AuthPayload>("/api/auth/login", {
        email,
        password,
      });
      setAuthToken(data.data.token);
      setToken(data.data.token);
      setUser(data.data.user);
    } catch (error) {
      throw new Error(getErrorMessage(error, "Login failed"));
    }
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const { data } = await api.post<AuthPayload>("/api/auth/signup", {
          name,
          email,
          password,
        });
        setAuthToken(data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
      } catch (error) {
        throw new Error(getErrorMessage(error, "Signup failed"));
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Local auth state should still be cleared if the token is expired.
    } finally {
      clearAuthToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      token,
      login,
      signup,
      logout,
    }),
    [loading, login, logout, signup, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
