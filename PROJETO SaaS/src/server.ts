import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { createSupabaseAuthMiddleware } from './api/auth';
import { createApiRouter } from './api/routes';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!process.env.DATABASE_URL) {
  throw new Error('Configure DATABASE_URL no ambiente do servidor.');
}
if (!supabaseUrl || !publishableKey) {
  throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do servidor.');
}

const app = express();
const authenticate = createSupabaseAuthMiddleware();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ supabaseUrl, publishableKey });
});

app.use('/api', createApiRouter(authenticate));
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

app.use(express.static(resolve(process.cwd(), 'dist'), { index: false }));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(resolve(process.cwd(), 'dist', 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Request failed:', error);
  res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
});

app.listen(port, host, () => {
  console.log(`API pronta em http://${host}:${port}`);
});
