import { BillingStatus, PrismaClient } from '@prisma/client';

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
  WorkoutExercise: byTenant,
  Exam: byTenant,
  BillingSubscription: byTenant,
  StripeWebhookEvent: byTenant,
};

const READ_OPS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
];
const WHERE_OPS = ['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert'];
const CREATE_OPS = ['create', 'createMany', 'createManyAndReturn', 'upsert'];
const TENANT_RELATION_FIELDS = new Set([
  'personal',
  'user',
  'student',
  'students',
  'lead',
  'leads',
  'contract',
  'contracts',
  'paymentParcels',
  'extraPayments',
  'workouts',
  'exercises',
  'exams',
  'parcels',
  'convertedStudent',
  'convertedLeads',
  'billingSubscription',
  'stripeWebhookEvents',
]);

function mergeTenantWhere(
  currentWhere: unknown,
  tenantWhere: Record<string, unknown>,
  requiresUniqueWhere: boolean,
) {
  if (!currentWhere) return tenantWhere;
  if (requiresUniqueWhere && typeof currentWhere === 'object' && !Array.isArray(currentWhere)) {
    const where = currentWhere as Record<string, unknown>;
    const existingAnd = where.AND;
    const andConditions = Array.isArray(existingAnd)
      ? existingAnd
      : existingAnd
        ? [existingAnd]
        : [];
    return { ...where, AND: [...andConditions, tenantWhere] };
  }
  if (Array.isArray(currentWhere)) return { AND: [...currentWhere, tenantWhere] };
  if (typeof currentWhere === 'object') return { AND: [currentWhere, tenantWhere] };
  return { AND: [currentWhere, tenantWhere] };
}

function stripTenantMutationData(
  data: Record<string, any> | undefined,
  allowedRelations: readonly string[] = [],
  tenantId?: string,
) {
  if (!data) return data;
  const nestedRelations = Object.keys(data).filter(
    (key) => TENANT_RELATION_FIELDS.has(key) && !allowedRelations.includes(key),
  );
  if (nestedRelations.length > 0) {
    throw new Error(`getScopedPrisma: escrita relacional aninhada não permitida (${nestedRelations.join(', ')})`);
  }
  if (allowedRelations.includes('exercises') && 'exercises' in data) {
    const exercises = data.exercises;
    if (
      typeof exercises !== 'object' ||
      exercises === null ||
      Array.isArray(exercises) ||
      Object.keys(exercises).some((key) => key !== 'create') ||
      !Array.isArray((exercises as { create?: unknown }).create)
    ) {
      throw new Error('getScopedPrisma: exercícios devem ser criados como uma lista no plano');
    }
  }
  if (allowedRelations.includes('personal') && 'personal' in data) {
    const personal = data.personal;
    if (
      typeof personal !== 'object' ||
      personal === null ||
      Array.isArray(personal) ||
      Object.keys(personal).length !== 1 ||
      !('connect' in personal) ||
      typeof personal.connect !== 'object' ||
      personal.connect === null ||
      Array.isArray(personal.connect) ||
      Object.keys(personal.connect).length !== 1 ||
      personal.connect.id !== tenantId
    ) {
      throw new Error('getScopedPrisma: o plano só pode ser associado ao personal do tenant autenticado');
    }
  }
  if (allowedRelations.includes('student') && 'student' in data) {
    const student = data.student;
    if (
      typeof student !== 'object' ||
      student === null ||
      Array.isArray(student) ||
      Object.keys(student).length !== 1 ||
      !('connect' in student) ||
      typeof student.connect !== 'object' ||
      student.connect === null ||
      Array.isArray(student.connect) ||
      Object.keys(student.connect).length !== 1 ||
      typeof student.connect.id !== 'string'
    ) {
      throw new Error('getScopedPrisma: aluno do plano deve ser ligado por um identificador');
    }
  }
  const next = { ...data };
  delete next.personalId;
  return next;
}

export function scopedPrisma(tenantId: string) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('getScopedPrisma: tenantId obrigatório');
  }

  const scopedClient = basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const rule = TENANT_RULES[model];
          if (!rule) throw new Error(`Model ${model} não é de tenant e não pode ser acessado pelo escopo`);

          const a: Record<string, any> = { ...(args ?? {}) };

          if (READ_OPS.includes(operation) || WHERE_OPS.includes(operation)) {
            const requiresUniqueWhere = [
              'findUnique',
              'findUniqueOrThrow',
              'update',
              'delete',
              'upsert',
            ].includes(operation);
            a.where = mergeTenantWhere(a.where, rule.where(tenantId), requiresUniqueWhere);
          }

          if (CREATE_OPS.includes(operation)) {
            if (!rule.data) throw new Error(`${model}: criação fora do escopo do tenant`);
            const scoped = rule.data(tenantId);

            if (operation === 'create') {
              const allowedRelations =
                model === 'Workout'
                  ? ['exercises', 'personal', 'student']
                  : model === 'Student'
                    ? ['personal']
                    : [];
              const data = stripTenantMutationData(a.data ?? {}, allowedRelations, tenantId);
              a.data =
                ['Workout', 'Student'].includes(model) && 'personal' in data
                  ? data
                  : { ...data, ...scoped };
            }
            if (operation === 'createMany' || operation === 'createManyAndReturn') {
              const list = Array.isArray(a.data) ? a.data : [a.data ?? {}];
              a.data = list.map((d: Record<string, any> = {}) => ({
                ...stripTenantMutationData(d),
                ...scoped,
              }));
            }
            if (operation === 'upsert') {
              a.create = { ...stripTenantMutationData(a.create ?? {}), ...scoped };
              a.update = stripTenantMutationData(a.update);
            }
          }

          // Atualização não pode mover registro para outro tenant.
          if (['update', 'updateMany', 'updateManyAndReturn'].includes(operation)) {
            a.data = stripTenantMutationData(a.data);
          }
          if (operation === 'upsert' && a.update) {
            a.update = stripTenantMutationData(a.update);
          }

          return query(a as any);
        },
      },
    },
  });

  const blockedClientMethods = new Set([
    '$executeRaw',
    '$executeRawUnsafe',
    '$queryRaw',
    '$queryRawUnsafe',
    '$transaction',
    '$extends',
  ]);
  return new Proxy(scopedClient, {
    get(target, property, receiver) {
      if (typeof property === 'string' && blockedClientMethods.has(property)) {
        return () => {
          throw new Error(`getScopedPrisma: ${property} indisponível; use operações tenant-scoped`);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export const getScopedPrisma = scopedPrisma;

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

export function findPersonalAuthContextById(personalId: string) {
  return basePrisma.personal.findUnique({
    where: { id: personalId },
    select: { id: true, userId: true },
  });
}

export async function findPersonalAuthContextByProviderSub(providerSub: string) {
  const user = await basePrisma.user.findUnique({
    where: { providerSub },
    select: {
      id: true,
      role: true,
      personal: { select: { id: true } },
    },
  });
  if (!user || !user.personal) return null;
  return { userId: user.id, role: user.role, tenantId: user.personal.id };
}

export class BillingWebhookRejectedError extends Error {}

export async function applyStripeSubscriptionEvent(input: {
  eventId: string;
  eventType: string;
  eventCreated: number;
  personalId: string;
  subscriptionId: string;
  customerId: string | null;
  priceId: string;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  return basePrisma.$transaction(async (tx) => {
    const personal = await tx.personal.findUnique({
      where: { id: input.personalId },
      select: { id: true },
    });
    if (!personal) throw new BillingWebhookRejectedError('Tenant de assinatura inexistente');

    const inserted = await tx.stripeWebhookEvent.createMany({
      data: [{
        eventId: input.eventId,
        type: input.eventType,
        personalId: input.personalId,
        subscriptionId: input.subscriptionId,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { duplicate: true, stale: false };

    const current = await tx.billingSubscription.findUnique({
      where: { personalId: input.personalId },
    });
    const data = {
      stripeSubscriptionId: input.subscriptionId,
      stripeCustomerId: input.customerId,
      stripePriceId: input.priceId,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      lastEventCreated: input.eventCreated,
    };

    let stale = false;
    if (current && input.eventCreated < current.lastEventCreated) {
      stale = true;
    } else if (current && current.stripeSubscriptionId !== input.subscriptionId) {
      if (current.status !== BillingStatus.CANCELED && current.status !== BillingStatus.INCOMPLETE_EXPIRED) {
        throw new BillingWebhookRejectedError('Tenant já possui outra assinatura não encerrada');
      }
      const updated = await tx.billingSubscription.updateMany({
        where: {
          personalId: input.personalId,
          stripeSubscriptionId: current.stripeSubscriptionId,
          lastEventCreated: current.lastEventCreated,
        },
        data,
      });
      if (updated.count !== 1) throw new Error('Concorrência ao atualizar assinatura; solicite nova tentativa');
    } else if (current) {
      const updated = await tx.billingSubscription.updateMany({
        where: {
          personalId: input.personalId,
          stripeSubscriptionId: input.subscriptionId,
          lastEventCreated: current.lastEventCreated,
        },
        data,
      });
      if (updated.count !== 1) throw new Error('Concorrência ao atualizar assinatura; solicite nova tentativa');
    } else {
      await tx.billingSubscription.create({
        data: { personalId: input.personalId, ...data },
      });
    }

    await tx.accessLog.create({
      data: {
        personalId: input.personalId,
        action: stale ? 'BILLING_EVENT_IGNORED' : 'BILLING_SUBSCRIPTION_UPDATED',
        resource: 'billing.subscription',
        resourceId: input.subscriptionId,
        purpose: 'gestao_financeira',
      },
    });
    return { duplicate: false, stale };
  });
}

export async function applyStripeInvoiceEvent(input: {
  eventId: string;
  eventType: string;
  eventCreated: number;
  subscriptionId: string;
  status: 'ACTIVE' | 'PAST_DUE';
}) {
  return basePrisma.$transaction(async (tx) => {
    const subscription = await tx.billingSubscription.findUnique({
      where: { stripeSubscriptionId: input.subscriptionId },
      select: { personalId: true, lastEventCreated: true, status: true },
    });
    if (!subscription) throw new BillingWebhookRejectedError('Assinatura da fatura inexistente');

    const inserted = await tx.stripeWebhookEvent.createMany({
      data: [{
        eventId: input.eventId,
        type: input.eventType,
        personalId: subscription.personalId,
        subscriptionId: input.subscriptionId,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { duplicate: true, stale: false };

    let stale =
      input.eventCreated < subscription.lastEventCreated ||
      subscription.status === BillingStatus.CANCELED ||
      subscription.status === BillingStatus.INCOMPLETE_EXPIRED;
    if (!stale) {
      const updated = await tx.billingSubscription.updateMany({
        where: {
          personalId: subscription.personalId,
          stripeSubscriptionId: input.subscriptionId,
          lastEventCreated: subscription.lastEventCreated,
        },
        data: { status: input.status, lastEventCreated: input.eventCreated },
      });
      if (updated.count !== 1) throw new Error('Concorrência ao atualizar assinatura; solicite nova tentativa');
    }

    await tx.accessLog.create({
      data: {
        personalId: subscription.personalId,
        action: stale
          ? 'BILLING_EVENT_IGNORED'
          : input.status === BillingStatus.ACTIVE
            ? 'BILLING_INVOICE_CONFIRMED'
            : 'BILLING_INVOICE_PAYMENT_FAILED',
        resource: 'billing.subscription',
        resourceId: input.subscriptionId,
        purpose: 'gestao_financeira',
      },
    });
    return { duplicate: false, stale };
  });
}

// Autenticação: busca de usuário pelo cliente base (não é dado de tenant).
export function findUserById(id: string) {
  return basePrisma.user.findUnique({ where: { id }, include: { personal: true, student: true } });
}
