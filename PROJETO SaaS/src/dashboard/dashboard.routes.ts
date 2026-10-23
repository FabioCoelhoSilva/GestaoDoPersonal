import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CycleDuration } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { BiMetricsService } from '../bi/bi-metrics.service';
import { logAccess } from '../db/scoped-prisma';

// Pressuposto: middleware de autenticação existente preenche req.auth a partir da sessão/JWT.
// personalId NUNCA vem de body, query ou params.
type AuthCtx = { userId: string; role: 'ADMIN' | 'PERSONAL' | 'STUDENT'; personalId: string | null };
type AuthedRequest = Request & { auth?: AuthCtx };

const DAY_MS = 24 * 60 * 60 * 1000;
const JANELA_MAX_DIAS = 366;

const rangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((v, ctx) => {
    const to = v.to ?? new Date();
    const from = v.from ?? new Date(to.getTime() - 30 * DAY_MS);
    if (from >= to) ctx.addIssue({ code: 'custom', message: 'from deve ser anterior a to' });
    if (to.getTime() - from.getTime() > JANELA_MAX_DIAS * DAY_MS) {
      ctx.addIssue({ code: 'custom', message: `janela máxima de ${JANELA_MAX_DIAS} dias` });
    }
  });

const retentionSchema = z.object({
  cycle: z.nativeEnum(CycleDuration),
});

function requirePersonal(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth || auth.role !== 'PERSONAL' || !auth.personalId) {
    return res.status(403).json({ error: 'Acesso restrito a personal autenticado' });
  }
  next();
}

function parseOr400<T>(schema: z.ZodType<T>, data: unknown, res: Response): T | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parâmetros inválidos', detalhes: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

export const dashboardRouter = Router();
dashboardRouter.use(requirePersonal);

dashboardRouter.get('/executive', async (req: AuthedRequest, res, next) => {
  try {
    const auth = req.auth!;
    const service = new DashboardService(auth.personalId!);
    const data = await service.executive();

    // Painel inclui contagem de exames (dado de saúde): registrado no AccessLog
    await logAccess({
      userId: auth.userId,
      personalId: auth.personalId,
      action: 'READ',
      resource: 'dashboard.executive',
      purpose: 'gestao_operacional',
      ip: req.ip,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/bi/finance', async (req: AuthedRequest, res, next) => {
  try {
    const params = parseOr400(rangeSchema, req.query, res);
    if (!params) return;

    const to = params.to ?? new Date();
    const from = params.from ?? new Date(to.getTime() - 30 * DAY_MS);
    const auth = req.auth!;
    const service = new BiMetricsService(auth.personalId!);

    const [mrr, churn, ltv] = await Promise.all([
      service.mrr(to),
      service.churn(from, to),
      service.ltvObservado(to),
    ]);

    await logAccess({
      userId: auth.userId,
      personalId: auth.personalId,
      action: 'READ',
      resource: 'bi.finance',
      purpose: 'gestao_financeira',
      ip: req.ip,
    });

    res.json({ periodo: { from, to }, mrr, churn, ltv });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/bi/retention', async (req: AuthedRequest, res, next) => {
  try {
    const params = parseOr400(retentionSchema, req.query, res);
    if (!params) return;

    const service = new BiMetricsService(req.auth!.personalId!);
    const retencao = await service.retencao(params.cycle);
    res.json(retencao);
  } catch (err) {
    next(err);
  }
});
