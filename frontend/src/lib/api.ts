const RAW_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) || "http://localhost:3001/api";
// The API lives under /api on every backend (local + Render). Operators
// sometimes set VITE_API_URL to the bare host — normalize so that mistake
// can never 404 every endpoint again.
const _base = RAW_URL.replace(/\/+$/, "");
const API_URL = _base.endsWith("/api") ? _base : `${_base}/api`;

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function api<T = unknown>(
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
    config.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json().catch(() => ({} as unknown));

  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string };
    const error = new Error(payload.error || `API error: ${response.status}`) as Error & {
      status?: number;
    };
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

  me: () => api<{ user: User & { counts?: unknown } }>("/auth/me"),

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

export interface CertificateRow {
  id: string;
  sha256Hash: string;
  fileName: string;
  fileType?: string;
  studentName?: string | null;
  rollNumber?: string | null;
  institution?: string | null;
  blockNumber?: number | null;
  anchoredAt?: string | null;
  txHash?: string | null;
  chainId?: number | null;
  createdAt?: string;
}

export interface Page<T> {
  certificates?: T[];
  logs?: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// Certificate API (Admin)
export const certificateApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("certificate", file);
    return api<{
      message: string;
      certificate: CertificateRow & {
        chain?: {
          txHash: string | null;
          blockNumber: number | null;
          chainId: number | null;
          anchoredAt: string | null;
          chainPending: boolean;
        };
        chainPending?: boolean;
      };
      chain?: {
        enabled: boolean;
        contractAddress: string | null;
        txHash: string | null;
        blockNumber: number | null;
        chainId: number | null;
        anchoredAt: string | null;
        chainPending: boolean;
      };
      ocrProcessingTimeMs: number;
    }>("/certificates/upload", { method: "POST", body: formData, isFormData: true });
  },

  list: (page = 1, limit = 20) =>
    api<{ certificates: CertificateRow[]; pagination: Page<CertificateRow>["pagination"] }>(
      `/certificates?page=${page}&limit=${limit}`
    ),

  delete: (id: string) =>
    api<{ message: string }>(`/certificates/${id}`, { method: "DELETE" }),
};

export type Verdict = "VERIFIED" | "TAMPERED" | "UNREGISTERED";

// Verification API (Checker)
export const verifyApi = {
  verify: (file: File) => {
    const formData = new FormData();
    formData.append("certificate", file);
    return api<{
      verdict: Verdict;
      message: string;
      similarity: number;
      certificate?: Partial<CertificateRow>;
      submittedDetails?: Partial<CertificateRow>;
      verificationId: string;
      ocrProcessingTimeMs: number;
      chain?: {
        enabled: boolean;
        registered: boolean;
        available: boolean;
        blockNumber: number | null;
        registeredAt: string | null;
        contractAddress: string | null;
      };
    }>("/verify", { method: "POST", body: formData, isFormData: true });
  },

  history: (page = 1, limit = 20) =>
    api<{
      logs: Array<{
        id: string;
        result: string;
        similarityScore: number | null;
        fileName: string;
        createdAt: string;
      }>;
      pagination: Page<never>["pagination"];
    }>(`/verify/history?page=${page}&limit=${limit}`),
};

// Stats API
export const statsApi = {
  get: () =>
    api<{
      stats: {
        totalCertificates: number;
        totalVerifications: number;
        verificationRate: number | null;
        tamperedCount: number;
      };
    }>("/stats"),
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
