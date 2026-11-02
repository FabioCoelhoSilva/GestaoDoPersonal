import { describe, expect, it } from 'vitest';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/saas_test?schema=public';

describe('isolated test database safety', () => {
  it('accepts only the dedicated local saas_test database', () => {
    expect(assertSafeTestDatabaseEnv({
      TEST_DATABASE_URL: localUrl,
      DATABASE_URL: localUrl,
    })).toBe(localUrl);
  });

  it.each([
    'postgresql://user:pass@db.example.com:5432/saas_test?schema=public',
    'postgresql://user:pass@127.0.0.1:5432/postgres?schema=public',
    'postgresql://user:pass@127.0.0.1:5433/saas_test?schema=public',
  ])('rejects unsafe database URLs', (databaseUrl) => {
    expect(() => assertSafeTestDatabaseEnv({
      TEST_DATABASE_URL: databaseUrl,
      DATABASE_URL: databaseUrl,
    })).toThrow();
  });

  it('rejects a runtime database different from the dedicated test database', () => {
    expect(() => assertSafeTestDatabaseEnv({
      TEST_DATABASE_URL: localUrl,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/other?schema=public',
    })).toThrow();
  });
});
