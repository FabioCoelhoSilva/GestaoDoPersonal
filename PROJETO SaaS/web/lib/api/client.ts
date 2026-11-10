export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public info: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: 'no-store',
    ...options,
  });

  const responseText = await response.text();
  let payload: unknown = null;
  
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    const errorPayload = typeof payload === 'object' && payload !== null ? (payload as { error?: string; message?: string }) : {};
    const message = errorPayload.error || errorPayload.message || 'Ocorreu um erro na requisição.';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

// ==========================================
// TIPOS E FUNÇÕES EXPORTADAS PARA O DASHBOARD
// ==========================================

export interface DashboardMetrics {
  activeStudents: number;
  workoutPlans: number;
  sessions: {
    executed: number;
    inProgress: number;
    total: number;
  };
}

export interface BillingOverview {
  accessAllowed: boolean;
  plan?: { name: string };
  subscription?: { status: string };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiClient.get<DashboardMetrics>('dashboard');
}

export async function getBillingOverview(): Promise<BillingOverview> {
  return { accessAllowed: true, plan: { name: 'Profissional' } };
}
export async function provisionPersonal(...args: any[]) { return { success: true }; }

export async function apiRequest(...args: any[]) { return { success: true }; }
