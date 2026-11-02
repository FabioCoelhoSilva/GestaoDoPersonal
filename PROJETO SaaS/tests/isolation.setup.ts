const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'Defina TEST_DATABASE_URL para um banco/schema isolado de teste. Estes testes apagam os dados do alvo.',
  );
}

const database = new URL(testDatabaseUrl);
const targetNames = [
  database.searchParams.get('schema') ?? '',
  database.pathname.split('/').pop() ?? '',
];

if (!targetNames.some((name) => /(?:^|[_-])test$/i.test(name))) {
  throw new Error(
    'TEST_DATABASE_URL precisa apontar para um banco ou schema cujo nome termine em _test.',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
