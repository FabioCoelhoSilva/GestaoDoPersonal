import { PrismaClient } from '@prisma/client';

// Cliente base: NÃO exportado. Só este módulo acessa o cliente sem escopo.
const basePrisma = new PrismaClient();

type TenantRule = {
  where: (personalId: string) => Record<string, unknown>;
  data?: (personalId: string) => Record<string, unknown>;
};

const byTenant: TenantRule = {
  where: (p) => ({ personalId: p }),
  data: (p) => ({ personalId: p }),
};

// Default-deny: model fora desta lista é bloqueado.
// User, AccessLog e ConsentGrant não são de tenant: acessados só via funções dedicadas abaixo.
const TENANT_RULES: Record<string, TenantRule> = {
  Personal: { where: (p) => ({ id: p }) },
  Student: byTenant,
  Lead: byTenant,
  Contract: byTenant,
  PaymentParcel: byTenant,
  ExtraPayment: byTenant,
  Workout: byTenant,
  Exam: byTenant,
};

const READ_OPS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
];
const WHERE_OPS = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
const CREATE_OPS = ['create', 'createMany', 'upsert'];

export function getScopedPrisma(personalId: string) {
  if (!personalId || typeof personalId !== 'string') {
    throw new Error('getScopedPrisma: personalId obrigatório');
  }

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const rule = TENANT_RULES[model];
          if (!rule) throw new Error(`Model ${model} não é de tenant e não pode ser acessado pelo escopo`);

          const a: Record<string, any> = { ...(args ?? {}) };

          if (READ_OPS.includes(operation) || WHERE_OPS.includes(operation)) {
            a.where = a.where
              ? { AND: [a.where, rule.where(personalId)] }
              : rule.where(personalId);
          }

          if (CREATE_OPS.includes(operation)) {
            if (!rule.data) throw new Error(`${model}: criação fora do escopo do tenant`);
            const scoped = rule.data(personalId);
            if (operation === 'create') a.data = { ...a.data, ...scoped };
            if (operation === 'createMany') {
              const list = Array.isArray(a.data) ? a.data : [a.data];
              a.data = list.map((d: object) => ({ ...d, ...scoped }));
            }
            if (operation === 'upsert') a.create = { ...a.create, ...scoped };
          }

          // Atualização não pode mover registro para outro tenant
          if (['update', 'updateMany'].includes(operation) && a.data) delete a.data.personalId;
          if (operation === 'upsert' && a.update) delete a.update.personalId;

          return query(a as any);
        },
      },
    },
  });
}

// Auditoria: gravação em AccessLog pelo cliente base, fora do escopo de tenant.
export async function logAccess(entry: {
  userId?: string | null;
  personalId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  purpose?: string | null;
  ip?: string | null;
}) {
  return basePrisma.accessLog.create({ data: entry });
}

// Autenticação: busca de usuário pelo cliente base (não é dado de tenant).
export function findUserById(id: string) {
  return basePrisma.user.findUnique({ where: { id }, include: { personal: true, student: true } });
}
