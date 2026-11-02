import { createHmac, timingSafeEqual } from 'node:crypto';
import { BillingStatus } from '@prisma/client';
import {
  applyStripeInvoiceEvent,
  applyStripeSubscriptionEvent,
  BillingWebhookRejectedError,
} from '../db/scoped-prisma';

const SIGNATURE_TOLERANCE_SECONDS = 300;
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
const INVOICE_EVENTS = new Set(['invoice.paid', 'invoice.payment_failed']);

type RawRequest = {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type WebhookResponse = {
  status(code: number): WebhookResponse;
  json(body: unknown): unknown;
};

type Next = (error?: unknown) => void;

type StripeSubscription = {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
};

type StripeInvoice = {
  subscription?: string | { id?: string } | null;
  parent?: {
    subscription_details?: { subscription?: string | { id?: string } | null } | null;
  } | null;
};

const BILLING_STATUSES: Record<string, BillingStatus> = {
  trialing: BillingStatus.TRIALING,
  active: BillingStatus.ACTIVE,
  past_due: BillingStatus.PAST_DUE,
  canceled: BillingStatus.CANCELED,
  unpaid: BillingStatus.UNPAID,
  incomplete: BillingStatus.INCOMPLETE,
  incomplete_expired: BillingStatus.INCOMPLETE_EXPIRED,
  paused: BillingStatus.PAUSED,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
  now = Date.now(),
) {
  const fields = signatureHeader.split(',');
  const timestamps = fields.filter((field) => field.startsWith('t='));
  if (timestamps.length !== 1) return false;

  const timestampText = timestamps[0].slice(2);
  if (!/^\d+$/.test(timestampText)) return false;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = Buffer.concat([Buffer.from(`${timestampText}.`), rawBody]);
  const expected = createHmac('sha256', secret).update(signedPayload).digest();
  const signatures = fields
    .filter((field) => field.startsWith('v1='))
    .map((field) => field.slice(3))
    .filter((value) => /^[a-f\d]{64}$/i.test(value));

  return signatures.some((signature) => timingSafeEqual(Buffer.from(signature, 'hex'), expected));
}

function parseStripeEvent(body: Buffer): StripeEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id.startsWith('evt_') ||
    typeof value.type !== 'string' ||
    !Number.isSafeInteger(value.created) ||
    (value.created as number) < 0 ||
    !isRecord(value.data) ||
    !('object' in value.data)
  ) {
    return null;
  }
  return value as unknown as StripeEvent;
}

function invoiceSubscriptionId(event: StripeEvent) {
  const invoice = event.data.object as StripeInvoice;
  if (!isRecord(invoice)) return null;
  const subscription =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  const id = typeof subscription === 'string' ? subscription : subscription?.id;
  return typeof id === 'string' && id.startsWith('sub_') ? id : null;
}

function subscriptionInput(event: StripeEvent) {
  const subscription = event.data.object as StripeSubscription;
  if (
    !isRecord(subscription) ||
    typeof subscription.id !== 'string' ||
    !subscription.id.startsWith('sub_') ||
    !isRecord(subscription.metadata) ||
    typeof subscription.metadata.personalId !== 'string' ||
    subscription.metadata.personalId.length === 0 ||
    !Array.isArray(subscription.items?.data) ||
    subscription.items.data.length !== 1
  ) {
    return null;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const billingStatus = BILLING_STATUSES[subscription.status ?? ''];
  const periodEnd = subscription.current_period_end;
  if (
    typeof priceId !== 'string' ||
    !priceId.startsWith('price_') ||
    !billingStatus ||
    typeof subscription.cancel_at_period_end !== 'boolean' ||
    (periodEnd !== undefined && (!Number.isSafeInteger(periodEnd) || periodEnd <= 0))
  ) {
    return null;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : typeof subscription.customer?.id === 'string'
        ? subscription.customer.id
        : null;

  return {
    eventId: event.id,
    eventType: event.type,
    eventCreated: event.created,
    personalId: subscription.metadata.personalId,
    subscriptionId: subscription.id,
    customerId,
    priceId,
    status: event.type === 'customer.subscription.deleted' ? BillingStatus.CANCELED : billingStatus,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

// Mount before express.json(); the route must receive the untouched bytes via express.raw().
export async function stripeWebhookHandler(req: RawRequest, res: WebhookResponse, next: Next) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET não configurado' });
  if (!secret.startsWith('whsec_')) {
    return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET inválido; configure o segredo whsec_ do endpoint Stripe' });
  }

  const signature = req.headers['stripe-signature'];
  if (!Buffer.isBuffer(req.body) || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Corpo bruto ou assinatura Stripe inválidos' });
  }
  if (!verifyStripeSignature(req.body, signature, secret)) {
    return res.status(400).json({ error: 'Assinatura Stripe inválida' });
  }

  const event = parseStripeEvent(req.body);
  if (!event) return res.status(400).json({ error: 'Evento Stripe inválido' });
  if (!SUBSCRIPTION_EVENTS.has(event.type) && !INVOICE_EVENTS.has(event.type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    if (INVOICE_EVENTS.has(event.type)) {
      const subscriptionId = invoiceSubscriptionId(event);
      if (!subscriptionId) return res.status(200).json({ received: true, ignored: true });
      const result = await applyStripeInvoiceEvent({
        eventId: event.id,
        eventType: event.type,
        eventCreated: event.created,
        subscriptionId,
        status: event.type === 'invoice.paid' ? BillingStatus.ACTIVE : BillingStatus.PAST_DUE,
      });
      return res.status(200).json({ received: true, ...result });
    }

    const input = subscriptionInput(event);
    if (!input) return res.status(400).json({ error: 'Evento de assinatura incompleto ou incompatível' });
    const result = await applyStripeSubscriptionEvent(input);
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    if (error instanceof BillingWebhookRejectedError) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}
