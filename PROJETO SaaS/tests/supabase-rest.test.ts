import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectTenantRows, selectTenantRowsByValues } from '../src/db/supabase-rest';

const personalId = '20b3b674-88df-4695-8e8f-469d7964c206';

describe('acesso REST Supabase', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(new Response('[]')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sempre restringe consultas pelo personalId autenticado', async () => {
    await selectTenantRows('students', personalId, {
      select: 'id',
      personalId: 'eq.outro-tenant',
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get('personalId')).toBe(`eq.${personalId}`);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      apikey: 'sb_secret_test',
      Range: '0-999',
      'Range-Unit': 'items',
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('rejeita personalId fora do formato UUID', async () => {
    await expect(selectTenantRows('students', 'tenant-controlado', { select: 'id' }))
      .rejects.toThrow('personalId inválido');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('divide listas longas de ids em consultas limitadas', async () => {
    const ids = Array.from({ length: 101 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );

    await selectTenantRowsByValues('workouts', personalId, 'studentId', ids, {
      select: 'studentId,updatedAt',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(firstUrl.searchParams.get('studentId')?.split(',')).toHaveLength(100);
    expect(secondUrl.searchParams.get('studentId')?.split(',')).toHaveLength(1);
  });
});
