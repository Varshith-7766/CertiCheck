import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type User, type RegisterPayload, type RegisterResponse, setSessionToken, clearSessionToken } from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requires2fa: boolean }>;
  complete2FA: (code: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<string | null>;
  isAuthenticated: boolean;
  pending2FA: boolean;
  pending2FAEmail: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending2FA, setPending2FA] = useState(false);
  const [pending2FAEmail, setPending2FAEmail] = useState("");

  // Session is an httpOnly cookie — validate it on mount.
  useEffect(() => {
    authApi
      .me()
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    if (data.sessionToken) setSessionToken(data.sessionToken);
    if (data.requires2fa) {
      setPending2FA(true);
      setPending2FAEmail(data.email || "");
      setUser(null);
      return { requires2fa: true };
    }
    setUser(data.user ?? null);
    return { requires2fa: false };
  }, []);

  const complete2FA = useCallback(async (code: string) => {
    const data = await authApi.twoFactor.verify(code);
    setUser(data.user);
    setPending2FA(false);
    setPending2FAEmail("");
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    const result = await authApi.register(data);
    // A fresh registration mints a session; an already-registered address
    // returns 201 with no user (anti-enumeration) — leave auth state untouched.
    if (result.sessionToken) setSessionToken(result.sessionToken);
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    clearSessionToken();
    try {
      await authApi.logout();
    } catch {
      // cookie may already be gone — still clear client state
    }
    setUser(null);
    setPending2FA(false);
    setPending2FAEmail("");
  }, []);

  const resendVerification = useCallback(async () => {
    const data = await authApi.resendVerification();
    return (data as Record<string, unknown>).devVerifyUrl as string | null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        complete2FA,
        register,
        logout,
        refreshUser,
        resendVerification,
        isAuthenticated: !!user,
        pending2FA,
        pending2FAEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
