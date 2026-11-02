type Filters = Record<string, string>;

const PAGE_SIZE = 1000;
const IN_FILTER_BATCH_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function assertUuid(value: string, field: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`${field} inválido`);
}

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configuradas');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL precisa ser uma URL válida');
  }

  if (
    baseUrl.protocol !== 'https:' &&
    !(baseUrl.protocol === 'http:' && baseUrl.hostname === 'localhost')
  ) {
    throw new Error('SUPABASE_URL precisa usar HTTPS');
  }

  return { baseUrl: baseUrl.origin, secretKey };
}

function buildUrl(table: string, filters: Filters) {
  const { baseUrl } = getConfig();
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function request(
  url: URL,
  method: 'GET' | 'HEAD' | 'POST',
  options: { range?: string; body?: object; count?: boolean } = {},
) {
  const { secretKey } = getConfig();
  const headers: Record<string, string> = {
    apikey: secretKey,
  };

  if (options.range) {
    headers.Range = options.range;
    headers['Range-Unit'] = 'items';
  }
  if (options.count) headers.Prefer = 'count=exact';
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=minimal';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${method} ${url.pathname} falhou (${response.status}): ${details}`);
  }
  return response;
}

async function selectRows<T>(table: string, filters: Filters): Promise<T[]> {
  const url = buildUrl(table, filters);
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await request(url, 'GET', {
      range: `${offset}-${offset + PAGE_SIZE - 1}`,
    });
    const page: unknown = await response.json();
    if (!Array.isArray(page)) {
      throw new Error(`Resposta inesperada do Supabase ao consultar ${table}`);
    }

    rows.push(...(page as T[]));
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function selectTenantRows<T>(
  table: string,
  personalId: string,
  filters: Filters,
): Promise<T[]> {
  assertUuid(personalId, 'personalId');
  return selectRows<T>(table, { ...filters, personalId: `eq.${personalId}` });
}

function validateFilterValues(values: string[]) {
  if (values.some((value) => !/^[a-zA-Z0-9_-]+$/.test(value))) {
    throw new Error('Valor inválido para filtro Supabase');
  }
}

export async function selectTenantRowsByValues<T>(
  table: string,
  personalId: string,
  column: string,
  values: string[],
  filters: Filters = {},
): Promise<T[]> {
  validateFilterValues(values);
  const rows: T[] = [];

  for (let offset = 0; offset < values.length; offset += IN_FILTER_BATCH_SIZE) {
    const batch = values.slice(offset, offset + IN_FILTER_BATCH_SIZE);
    rows.push(
      ...(await selectTenantRows<T>(table, personalId, {
        ...filters,
        [column]: `in.(${batch.join(',')})`,
      })),
    );
  }
  return rows;
}

export async function countTenantRows(
  table: string,
  personalId: string,
  filters: Filters,
): Promise<number> {
  assertUuid(personalId, 'personalId');

  const url = buildUrl(table, {
    ...filters,
    personalId: `eq.${personalId}`,
  });
  const response = await request(url, 'HEAD', { range: '0-0', count: true });
  const contentRange = response.headers.get('content-range');
  const match = contentRange?.match(/\/(\d+)$/);
  if (!match) {
    throw new Error(`Resposta de contagem inválida do Supabase para ${table}`);
  }
  return Number(match[1]);
}

export async function countTenantRowsByValues(
  table: string,
  personalId: string,
  column: string,
  values: string[],
  filters: Filters = {},
): Promise<number> {
  validateFilterValues(values);
  let total = 0;

  for (let offset = 0; offset < values.length; offset += IN_FILTER_BATCH_SIZE) {
    const batch = values.slice(offset, offset + IN_FILTER_BATCH_SIZE);
    total += await countTenantRows(table, personalId, {
      ...filters,
      [column]: `in.(${batch.join(',')})`,
    });
  }
  return total;
}

export async function insertRow(table: string, row: object): Promise<void> {
  await request(buildUrl(table, {}), 'POST', { body: row });
}

export async function findUserById(id: string) {
  assertUuid(id, 'id do usuário');
  const users = await selectRows<{
    id: string;
    email: string;
    name: string;
    role: string;
    provider: string;
    providerSub: string | null;
    passwordHash: string | null;
    createdAt: string;
    updatedAt: string;
  }>('users', {
    select: 'id,email,name,role,provider,providerSub,passwordHash,createdAt,updatedAt',
    id: `eq.${id}`,
    limit: '1',
  });
  const user = users[0];
  if (!user) return null;

  const [personals, students] = await Promise.all([
    selectRows<Record<string, unknown>>('personals', {
      select: '*',
      userId: `eq.${id}`,
      limit: '1',
    }),
    selectRows<Record<string, unknown>>('students', {
      select: '*',
      userId: `eq.${id}`,
      limit: '1',
    }),
  ]);
  return { ...user, personal: personals[0] ?? null, student: students[0] ?? null };
}

export function logAccess(entry: {
  userId?: string | null;
  personalId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  purpose?: string | null;
  ip?: string | null;
}) {
  return insertRow('access_logs', entry);
}
