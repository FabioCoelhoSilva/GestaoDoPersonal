import { BillingStatus, Prisma, PrismaClient } from '@prisma/client';

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
  WorkoutExecution: byTenant,
  WorkoutSetLog: byTenant,
  Appointment: byTenant,
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
  'executions',
  'appointments',
  'setLogs',
  'workoutExercise',
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
  if (allowedRelations.includes('setLogs') && 'setLogs' in data) {
    const setLogs = data.setLogs;
    if (
      typeof setLogs !== 'object' ||
      setLogs === null ||
      Array.isArray(setLogs) ||
      Object.keys(setLogs).some((key) => key !== 'create') ||
      !Array.isArray((setLogs as { create?: unknown }).create) ||
      !allowedRelations.includes('workout') ||
      typeof data.workout !== 'object' ||
      data.workout === null ||
      !('connect' in data.workout) ||
      typeof data.workout.connect !== 'object' ||
      data.workout.connect === null ||
      !('id_personalId' in data.workout.connect) ||
      typeof data.workout.connect.id_personalId !== 'object' ||
      data.workout.connect.id_personalId === null ||
      !('id' in data.workout.connect.id_personalId) ||
      !('personalId' in data.workout.connect.id_personalId) ||
      typeof data.workout.connect.id_personalId.id !== 'string' ||
      data.workout.connect.id_personalId.personalId !== tenantId
    ) {
      throw new Error('getScopedPrisma: séries devem ser criadas como uma lista no registo do treino');
    }

    const allowedSetFields = new Set([
      'setNumber',
      'repsCompleted',
      'loadKg',
      'personal',
      'workout',
      'workoutExercise',
    ]);
    for (const [index, setLog] of (setLogs as { create: unknown[] }).create.entries()) {
      if (
        typeof setLog !== 'object' ||
        setLog === null ||
        Array.isArray(setLog) ||
        Object.keys(setLog).some((key) => !allowedSetFields.has(key))
      ) {
        throw new Error(`getScopedPrisma: série ${index} inválida`);
      }
      const entry = setLog as Record<string, unknown>;
      const personalConnect = (entry.personal as { connect?: { id?: unknown } } | undefined)?.connect;
      const workoutConnect = (entry.workout as {
        connect?: { id_personalId?: { id?: unknown; personalId?: unknown } };
      } | undefined)?.connect;
      const exerciseConnect = (entry.workoutExercise as { connect?: { id?: unknown } } | undefined)?.connect;
      if (
        personalConnect?.id !== tenantId ||
        workoutConnect?.id_personalId?.id !== data.workout.connect.id_personalId.id ||
        workoutConnect.id_personalId.personalId !== tenantId ||
        typeof exerciseConnect?.id !== 'string'
      ) {
        throw new Error('getScopedPrisma: série deve pertencer ao tenant e plano do registo');
      }
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
      !(
        (Object.keys(student.connect).length === 1 && typeof student.connect.id === 'string') ||
        (Object.keys(student.connect).length === 1 &&
          typeof student.connect.id_personalId === 'object' &&
          student.connect.id_personalId !== null &&
          'id' in student.connect.id_personalId &&
          typeof student.connect.id_personalId.id === 'string' &&
          'personalId' in student.connect.id_personalId &&
          student.connect.id_personalId.personalId === tenantId)
      )
    ) {
      throw new Error('getScopedPrisma: aluno do plano deve ser ligado por um identificador');
    }
  }
  if (allowedRelations.includes('workout') && 'workout' in data && !('setLogs' in data)) {
    const workout = data.workout;
    if (
      typeof workout !== 'object' ||
      workout === null ||
      Array.isArray(workout) ||
      Object.keys(workout).length !== 1 ||
      !('connect' in workout) ||
      typeof workout.connect !== 'object' ||
      workout.connect === null ||
      Array.isArray(workout.connect) ||
      Object.keys(workout.connect).length !== 1 ||
      !('id_personalId' in workout.connect) ||
      typeof workout.connect.id_personalId !== 'object' ||
      workout.connect.id_personalId === null ||
      !('id' in workout.connect.id_personalId) ||
      typeof workout.connect.id_personalId.id !== 'string' ||
      !('personalId' in workout.connect.id_personalId) ||
      workout.connect.id_personalId.personalId !== tenantId
    ) {
      throw new Error('getScopedPrisma: execução deve estar ligada a um treino do tenant autenticado');
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
                  : model === 'WorkoutExercise'
                    ? ['workout']
                  : model === 'WorkoutExecution'
                    ? ['personal', 'student', 'workout', 'setLogs']
                  : model === 'Student'
                    ? ['personal']
                    : [];
              const data = stripTenantMutationData(a.data ?? {}, allowedRelations, tenantId);
              a.data =
                (
                  ['Workout', 'Student', 'WorkoutExecution'].includes(model) &&
                  'personal' in data
                ) || (model === 'WorkoutExercise' && 'workout' in data)
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

export async function readPersonalProfile(userId: string, personalId: string) {
  return basePrisma.personal.findFirst({
    where: { id: personalId, userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true } },
    },
  });
}

export async function updatePersonalProfileName(
  userId: string,
  personalId: string,
  name: string,
) {
  return basePrisma.$transaction(async (tx) => {
    const personal = await tx.personal.findFirst({
      where: { id: personalId, userId },
      select: { id: true, userId: true },
    });
    if (!personal) return null;

    const [updatedPersonal, updatedUser] = await Promise.all([
      tx.personal.update({
        where: { id: personal.id },
        data: { name },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      }),
      tx.user.update({
        where: { id: personal.userId },
        data: { name },
        select: { email: true },
      }),
    ]);

    return { ...updatedPersonal, user: updatedUser };
  });
}

export async function findPersonalAuthContextByProviderSub(providerSub: string) {
  const user = await basePrisma.user.findUnique({
    where: { providerSub },
    select: {
      id: true,
      role: true,
      personal: { select: { id: true } },
      student: { select: { id: true, personalId: true } },
    },
  });
  if (!user) return null;
  if (user.role === 'PERSONAL' && user.personal) {
    return { userId: user.id, role: user.role, tenantId: user.personal.id, studentId: null };
  }
  if (user.role === 'STUDENT' && user.student) {
    return {
      userId: user.id,
      role: user.role,
      tenantId: user.student.personalId,
      studentId: user.student.id,
    };
  }
  return null;
}

export class PersonalProvisioningConflictError extends Error {
  constructor() {
    super('A identidade Supabase já está associada a outra conta');
    this.name = 'PersonalProvisioningConflictError';
  }
}

export class PersonalProvisioningPlanUnavailableError extends Error {
  constructor() {
    super('O plano inicial de avaliação não está disponível');
    this.name = 'PersonalProvisioningPlanUnavailableError';
  }
}

export async function provisionPersonalTenant(input: {
  providerSub: string;
  email: string;
  trialPlanId: string;
  trialDays: number;
}) {
  try {
    return await basePrisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { providerSub: input.providerSub },
        include: { personal: true },
      });

      if (existing) {
        if (existing.role !== 'PERSONAL' || !existing.personal) {
          throw new PersonalProvisioningConflictError();
        }
        return {
          created: false,
          userId: existing.id,
          personalId: existing.personal.id,
        };
      }

      const emailOwner = await tx.user.findUnique({ where: { email: input.email } });
      if (emailOwner) throw new PersonalProvisioningConflictError();

      const plan = await tx.plan.findFirst({
        where: { id: input.trialPlanId, active: true },
        select: { id: true, stripePriceId: true },
      });
      if (!plan) throw new PersonalProvisioningPlanUnavailableError();

      const name = input.email.slice(0, input.email.indexOf('@')).slice(0, 120) || 'Personal';
      const user = await tx.user.create({
        data: {
          email: input.email,
          name,
          role: 'PERSONAL',
          provider: 'OAUTH',
          providerSub: input.providerSub,
          personal: { create: { name } },
        },
        include: { personal: true },
      });

      await tx.billingSubscription.create({
        data: {
          personalId: user.personal!.id,
          planId: plan.id,
          stripeSubscriptionId: `trial_${user.personal!.id}`,
          stripePriceId: plan.stripePriceId,
          status: BillingStatus.TRIALING,
          currentPeriodEnd: new Date(Date.now() + input.trialDays * 24 * 60 * 60 * 1000),
        },
      });

      return {
        created: true,
        userId: user.id,
        personalId: user.personal!.id,
      };
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }

    const [existing, emailOwner] = await Promise.all([
      basePrisma.user.findUnique({
        where: { providerSub: input.providerSub },
        include: { personal: true },
      }),
      basePrisma.user.findUnique({ where: { email: input.email } }),
    ]);

    if (existing?.role === 'PERSONAL' && existing.personal) {
      return {
        created: false,
        userId: existing.id,
        personalId: existing.personal.id,
      };
    }
    if (emailOwner) throw new PersonalProvisioningConflictError();
    throw error;
  }
}

export class TenantStudentUnavailableError extends Error {
  constructor() {
    super('O aluno não existe, está inativo ou não pertence ao tenant autenticado');
    this.name = 'TenantStudentUnavailableError';
  }
}

export class AppointmentTimeConflictError extends Error {
  constructor() {
    super('O horário escolhido conflita com outra aula agendada');
    this.name = 'AppointmentTimeConflictError';
  }
}

export async function createMonthlyContractWithParcels(input: {
  personalId: string;
  studentId: string;
  cycle: 'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12';
  monthlyAmount: string;
  totalAmount: string;
  startDate: Date;
  endDate: Date;
  parcels: Array<{ dueDate: Date; amount: string }>;
}) {
  return basePrisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, personalId: input.personalId, active: true, anonymizedAt: null },
      select: { id: true },
    });
    if (!student) throw new TenantStudentUnavailableError();

    const contract = await tx.contract.create({
      data: {
        personalId: input.personalId,
        studentId: student.id,
        cycle: input.cycle,
        status: 'SIGNED',
        totalAmount: input.totalAmount,
        monthlyAmount: input.monthlyAmount,
        startDate: input.startDate,
        endDate: input.endDate,
        signedAt: new Date(),
      },
    });

    await tx.paymentParcel.createMany({
      data: input.parcels.map((parcel) => ({
        personalId: input.personalId,
        contractId: contract.id,
        dueDate: parcel.dueDate,
        amount: parcel.amount,
        status: 'PENDING',
      })),
    });

    return tx.contract.findUniqueOrThrow({
      where: { id: contract.id },
      include: { parcels: { orderBy: { dueDate: 'asc' } }, student: { select: { id: true, name: true, email: true } } },
    });
  });
}

export async function createTenantAppointment(input: {
  personalId: string;
  studentId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
}) {
  return basePrisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${input.personalId}))`);

    const student = await tx.student.findFirst({
      where: { id: input.studentId, personalId: input.personalId, active: true, anonymizedAt: null },
      select: { id: true },
    });
    if (!student) throw new TenantStudentUnavailableError();

    const conflict = await tx.appointment.findFirst({
      where: {
        personalId: input.personalId,
        status: 'SCHEDULED',
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });
    if (conflict) throw new AppointmentTimeConflictError();

    return tx.appointment.create({
      data: {
        personalId: input.personalId,
        studentId: student.id,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes,
        status: 'SCHEDULED',
      },
      include: { student: { select: { id: true, name: true, email: true, active: true } } },
    });
  });
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
    const plan = await tx.plan.findUnique({
      where: { stripePriceId: input.priceId },
      select: { id: true, active: true },
    });
    if (!plan || !plan.active) {
      throw new BillingWebhookRejectedError('Plano Stripe inexistente ou inativo');
    }

    const inserted = await tx.stripeWebhookEvent.createMany({
      data: [{
        eventId: input.eventId,
        type: input.eventType,
        personalId: input.personalId,
        subscriptionId: input.subscriptionId,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return {
      duplicate: true,
      stale: false,
      statusChanged: false,
      status: input.status,
      personalId: input.personalId,
    };

    const current = await tx.billingSubscription.findUnique({
      where: { personalId: input.personalId },
    });
    const data = {
      planId: plan.id,
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
    return {
      duplicate: false,
      stale,
      statusChanged: !stale && current?.status !== input.status,
      status: input.status,
      personalId: input.personalId,
    };
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
    if (inserted.count === 0) return {
      duplicate: true,
      stale: false,
      statusChanged: false,
      status: input.status,
      personalId: subscription.personalId,
    };

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
    return {
      duplicate: false,
      stale,
      statusChanged: !stale && subscription.status !== input.status,
      status: input.status,
      personalId: subscription.personalId,
    };
  });
}

export function findPersonalBillingEmail(personalId: string) {
  return basePrisma.personal.findUnique({
    where: { id: personalId },
    select: { user: { select: { email: true } } },
  });
}

// Autenticação: busca de usuário pelo cliente base (não é dado de tenant).
export function findUserById(id: string) {
  return basePrisma.user.findUnique({ where: { id }, include: { personal: true, student: true } });
}
