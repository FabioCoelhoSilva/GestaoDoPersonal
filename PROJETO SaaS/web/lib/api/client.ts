'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type DashboardMetrics = {
  activeStudents: number;
  workoutPlans: number;
  sessions: {
    executed: number;
    inProgress: number;
    total: number;
  };
};

export type BillingOverview = {
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerLinked: boolean;
  } | null;
  plan: {
    name: string;
    maxStudents: number | null;
    maxWorkouts: number | null;
  } | null;
  usage: {
    activeStudents: number;
    activeWorkouts: number;
  };
  accessAllowed: boolean;
};

type ApiEnvelope<T> = { data: T };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new ApiError('A sua sessão expirou. Inicie sessão novamente.', 401, 'UNAUTHORIZED');
  }

  const response = await fetch(`/api/proxy/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: 'no-store',
  });

  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    throw new ApiError('A API devolveu uma resposta inválida.', response.status, null);
  }

  if (!response.ok) {
    const errorPayload =
      typeof payload === 'object' && payload !== null
        ? (payload as { error?: unknown; code?: unknown })
        : {};
    const message =
      typeof errorPayload.error === 'string'
        ? errorPayload.error
        : 'Não foi possível concluir o pedido.';
    const code = typeof errorPayload.code === 'string' ? errorPayload.code : null;
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new ApiError('A API devolveu dados num formato inesperado.', response.status, null);
  }
  return (payload as ApiEnvelope<T>).data;
}

export { request as apiRequest };

export function getDashboardMetrics() {
  return request<DashboardMetrics>('dashboard/metrics');
}

export function getBillingOverview() {
  return request<BillingOverview>('billing/me');
}

export function provisionPersonal(email: string) {
  return request<{ userId: string; tenantId: string; created: boolean }>('onboarding/provision', {
    method: 'POST',
    body: { email },
  });
}
