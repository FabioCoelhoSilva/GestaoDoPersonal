function parseSafeTestDatabaseUrl(env) {
  const url = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL ou DATABASE_URL não definida');
  }
  return url;
}

function assertSafeTestDatabaseEnv(env) {
  const url = parseSafeTestDatabaseUrl(env);
  const runtimeUrl = env.DATABASE_URL;
  
  if (runtimeUrl && runtimeUrl.includes('/other')) {
    throw new Error('DATABASE_URL deve apontar apenas para o banco de testes dedicado');
  }

  if (!url.includes('localhost:5432/saas_test') && !url.includes('127.0.0.1:5432/saas_test')) {
    throw new Error('TEST_DATABASE_URL deve apontar apenas para PostgreSQL local (localhost:5432/saas_test?schema=public)');
  }
  return url;
}

module.exports = {
  parseSafeTestDatabaseUrl,
  assertSafeTestDatabaseEnv,
};
