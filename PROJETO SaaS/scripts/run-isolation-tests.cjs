const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { assertSafeTestDatabaseEnv } = require('./test-db-safety.cjs');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env.test');
if (!fs.existsSync(envFile) && !process.env.TEST_DATABASE_URL) {
  console.error('Configure TEST_DATABASE_URL no ambiente ou copie .env.test.example para .env.test.');
  process.exit(1);
}

const testEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const databaseUrl = process.env.TEST_DATABASE_URL || testEnv.TEST_DATABASE_URL;
const env = {
  ...process.env,
  TEST_DATABASE_URL: databaseUrl,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
};

try {
  assertSafeTestDatabaseEnv(env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(signal ? `Processo encerrado por ${signal}` : `Processo terminou com código ${code}`));
    });
  });
}

async function main() {
  const prismaCli = require.resolve('prisma/build/index.js');
  const vitestCli = path.join(root, 'node_modules/vitest/vitest.mjs');
  const requestedTests = process.argv.slice(2).filter((argument) => argument !== '--run');
  await run([prismaCli, 'db', 'push', '--schema', 'prisma/schema.prisma']);
  await run([
    prismaCli,
    'db',
    'execute',
    '--schema',
    'prisma/schema.prisma',
    '--file',
    'prisma/migrations/manual_integridade/migration.sql',
  ]);
  await run([
    prismaCli,
    'db',
    'execute',
    '--schema',
    'prisma/schema.prisma',
    '--file',
    'prisma/migrations/manual_workout_exercises/migration.sql',
  ]);
  await run([
    prismaCli,
    'db',
    'execute',
    '--schema',
    'prisma/schema.prisma',
    '--file',
    'prisma/migrations/manual_workout_executions/migration.sql',
  ]);
  await run([
    prismaCli,
    'db',
    'execute',
    '--schema',
    'prisma/schema.prisma',
    '--file',
    'prisma/migrations/manual_billing_plans/migration.sql',
  ]);
  await run([
    prismaCli,
    'db',
    'execute',
    '--schema',
    'prisma/schema.prisma',
    '--file',
    'prisma/migrations/manual_appointments/migration.sql',
  ]);
  if (requestedTests.length > 0) {
    await run([vitestCli, 'run', ...requestedTests]);
    return;
  }

  await run([vitestCli, 'run', 'tests/isolation.test.ts']);
  await run([vitestCli, 'run', '--exclude', 'tests/isolation.test.ts']);
}

main().catch((error) => {
  console.error(`Falha nos testes de isolamento: ${error.message}`);
  process.exitCode = 1;
});
