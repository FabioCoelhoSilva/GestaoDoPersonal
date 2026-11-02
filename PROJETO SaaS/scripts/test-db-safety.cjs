const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const TEST_DATABASE_NAME = 'saas_test';

function parseSafeTestDatabaseUrl(value, variableName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${variableName} é obrigatório; configure a base local saas_test em .env.test`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} não é uma URL PostgreSQL válida`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const schema = url.searchParams.get('schema');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    (url.port && url.port !== '5432') ||
    databaseName !== TEST_DATABASE_NAME ||
    (schema && schema !== 'public')
  ) {
    throw new Error(
      `${variableName} deve apontar apenas para PostgreSQL local (localhost:5432/saas_test?schema=public)`,
    );
  }

  return url;
}

function assertSafeTestDatabaseEnv(env) {
  const testUrl = parseSafeTestDatabaseUrl(env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
  const runtimeUrl = parseSafeTestDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL');
  if (testUrl.host !== runtimeUrl.host || testUrl.pathname !== runtimeUrl.pathname) {
    throw new Error('DATABASE_URL deve apontar para a mesma base local saas_test de TEST_DATABASE_URL');
  }
  return env.TEST_DATABASE_URL;
}

module.exports = { assertSafeTestDatabaseEnv };
