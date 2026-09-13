const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:3001/api";

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function api<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const requestHeaders: Record<string, string> = { ...headers };

  if (!isFormData) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
    // httpOnly session cookie — sent automatically, never stored client-side.
    credentials: "include",
  };

  if (body) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `API error: ${response.status}`) as
      Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CHECKER";
  institution?: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  totpRequired: boolean;
  createdAt?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "CHECKER";
  institution?: string;
  inviteCode?: string;
}

export interface RegisterResponse {
  user?: User;
  emailVerified?: boolean;
  totpSetupRequired?: boolean;
  message?: string;
  // Anti-enumeration (F8): when the address is already registered the server
  // returns 201 with the same shape but NO user and NO session — the client
  // shows the same "check your inbox" message either way.
  emailVerificationSent?: boolean;
}

export interface LoginResponse {
  user?: User;
  requires2fa?: boolean;
  totpSetupRequired?: boolean;
  email?: string;
  message?: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

// Auth API
export const authApi = {
  register: (data: RegisterPayload) =>
    api<RegisterResponse>("/auth/register", {
      method: "POST",
      body: data,
    }),

  login: (data: { email: string; password: string }) =>
    api<LoginResponse>("/auth/login", { method: "POST", body: data }),

  logout: () => api<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => api<{ user: User & { counts: any } }>("/auth/me"),

  verifyEmail: (token: string) =>
    api<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: { token },
    }),

  resendVerification: () =>
    api<{ message: string }>("/auth/resend-verification", { method: "POST" }),

  forgot: (email: string) =>
    api<{ message: string }>("/auth/forgot", { method: "POST", body: { email } }),

  reset: (token: string, password: string) =>
    api<{ message: string }>("/auth/reset", {
      method: "POST",
      body: { token, password },
    }),

  twoFactor: {
    // F1: enrolling 2FA requires the account password so a stolen session
    // alone can't reroute/lock out the owner's second factor.
    setup: (password: string) =>
      api<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", {
        method: "POST",
        body: { password },
      }),
    enable: (code: string, password: string) =>
      api<{ message: string; recoveryCodes: string[] }>("/auth/2fa/enable", {
        method: "POST",
        body: { code, password },
      }),
    disable: (code: string) =>
      api<{ message: string }>("/auth/2fa/disable", {
        method: "POST",
        body: { code },
      }),
    verify: (code: string) =>
      api<{ user: User }>("/auth/2fa/verify", { method: "POST", body: { code } }),
  },

  sessions: {
    list: () => api<{ sessions: SessionInfo[] }>("/auth/sessions"),
    revokeAll: () =>
      api<{ message: string }>("/auth/sessions", { method: "DELETE" }),
    revoke: (id: string) =>
      api<{ message: string }>(`/auth/sessions/${id}`, { method: "DELETE" }),
  },
};

// Certificate API (Admin)
export const certificateApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("certificate", file);
    return api<{
      message: string;
      certificate: any;
      ocrProcessingTimeMs: number;
    }>("/certificates/upload", { method: "POST", body: formData, isFormData: true });
  },

  list: (page = 1, limit = 20) =>
    api<{ certificates: any[]; pagination: any }>(
      `/certificates?page=${page}&limit=${limit}`
    ),

  delete: (id: string) =>
    api<{ message: string }>(`/certificates/${id}`, { method: "DELETE" }),
};

// Verification API (Checker)
export const verifyApi = {
  verify: (file: File) => {
    const formData = new FormData();
    formData.append("certificate", file);
    return api<{
      verdict: "VERIFIED" | "TAMPERED" | "UNREGISTERED";
      message: string;
      similarity: number;
      certificate?: any;
      verificationId: string;
      ocrProcessingTimeMs: number;
    }>("/verify", { method: "POST", body: formData, isFormData: true });
  },

  history: (page = 1, limit = 20) =>
    api<{ logs: any[]; pagination: any }>(
      `/verify/history?page=${page}&limit=${limit}`
    ),
};

// Stats API
export const statsApi = {
  get: () => api<{ stats: any }>("/stats"),
};

// System API
export const systemApi = {
  health: () =>
    api<{
      status: string;
      timestamp: string;
      chain: {
        enabled: boolean;
        available: boolean;
        chainId: number | null;
        blockNumber: number | null;
        contractAddress: string | null;
      };
    }>("/health"),
};