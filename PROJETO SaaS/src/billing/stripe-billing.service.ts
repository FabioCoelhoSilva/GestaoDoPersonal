import { BillingStatus } from '@prisma/client';
import {
  findActiveStripePlan,
  findPersonalBillingEmail,
  listActiveStripePlans,
  readBillingSubscriptionForManagement,
} from '../db/scoped-prisma';

const STRIPE_API = 'https://api.stripe.com/v1';

export type StripePlanOption = { id: string; name: string };
export type StripeInvoiceSummary = {
  id: string;
  number: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  currency: string;
  amountDue: number;
  amountPaid: number;
  createdAt: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export class StripeBillingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 502 | 503,
    readonly code: string,
  ) {
    super(message);
    this.name = 'StripeBillingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeBillingError('STRIPE_SECRET_KEY não configurado', 503, 'STRIPE_NOT_CONFIGURED');
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    throw new StripeBillingError('STRIPE_SECRET_KEY inválido', 503, 'STRIPE_NOT_CONFIGURED');
  }
  return key;
}

function appBaseUrl() {
  const configured = process.env.WEB_APP_URL?.trim();
  if (!configured) throw new StripeBillingError('WEB_APP_URL não configurado', 503, 'BILLING_RETURN_URL_NOT_CONFIGURED');

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new StripeBillingError('WEB_APP_URL inválido', 503, 'BILLING_RETURN_URL_NOT_CONFIGURED');
  }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new StripeBillingError('WEB_APP_URL deve ser HTTPS (exceto localhost)', 503, 'BILLING_RETURN_URL_NOT_CONFIGURED');
  }
  return url.origin;
}

async function stripeRequest(path: string, method: 'GET' | 'POST', form?: URLSearchParams) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(form ? { body: form.toString() } : {}),
    signal: AbortSignal.timeout(10_000),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StripeBillingError('Resposta inválida do Stripe', 502, 'STRIPE_INVALID_RESPONSE');
  }
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    const message = error && typeof error.message === 'string'
      ? error.message
      : 'O Stripe não conseguiu processar o pedido';
    throw new StripeBillingError(message, 502, 'STRIPE_REQUEST_FAILED');
  }
  if (!isRecord(payload)) {
    throw new StripeBillingError('Resposta inválida do Stripe', 502, 'STRIPE_INVALID_RESPONSE');
  }
  return payload;
}

async function requireStripeCustomer(personalId: string) {
  const subscription = await readBillingSubscriptionForManagement(personalId);
  if (!subscription?.stripeCustomerId) {
    throw new StripeBillingError('A conta ainda não tem cliente Stripe associado', 409, 'STRIPE_CUSTOMER_NOT_LINKED');
  }
  return { ...subscription, stripeCustomerId: subscription.stripeCustomerId };
}

function isHostedStripeUrl(value: string, host: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function listStripePlanOptions(): Promise<StripePlanOption[]> {
  return (await listActiveStripePlans()).map(({ id, name }) => ({ id, name }));
}

export async function createStripeCheckout(personalId: string, planId: string) {
  const [subscription, plan, contact] = await Promise.all([
    readBillingSubscriptionForManagement(personalId),
    findActiveStripePlan(planId),
    findPersonalBillingEmail(personalId),
  ]);
  if (!plan) throw new StripeBillingError('Plano indisponível', 404, 'PLAN_NOT_FOUND');
  if (!contact?.user?.email) throw new StripeBillingError('Email do perfil não encontrado', 404, 'PROFILE_NOT_FOUND');
  if (
    subscription &&
    subscription.status !== BillingStatus.CANCELED &&
    subscription.status !== BillingStatus.INCOMPLETE_EXPIRED &&
    !(subscription.status === BillingStatus.TRIALING && !subscription.stripeCustomerId)
  ) {
    throw new StripeBillingError('Já existe uma subscrição. Use a gestão de faturação para a alterar.', 409, 'SUBSCRIPTION_ALREADY_EXISTS');
  }

  const baseUrl = appBaseUrl();
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': plan.stripePriceId,
    'line_items[0][quantity]': '1',
    client_reference_id: personalId,
    success_url: `${baseUrl}/perfil?checkout=success`,
    cancel_url: `${baseUrl}/perfil?checkout=cancelled`,
    'metadata[personalId]': personalId,
    'subscription_data[metadata][personalId]': personalId,
  });
  if (subscription?.stripeCustomerId) {
    form.set('customer', subscription.stripeCustomerId);
  } else {
    form.set('customer_email', contact.user.email);
  }
  const session = await stripeRequest('/checkout/sessions', 'POST', form);
  if (
    typeof session.url !== 'string' ||
    !session.url.startsWith('https://checkout.stripe.com/')
  ) {
    throw new StripeBillingError('O Stripe devolveu um URL de checkout inválido', 502, 'STRIPE_INVALID_RESPONSE');
  }
  return { url: session.url };
}

export async function createStripePortal(personalId: string) {
  const subscription = await requireStripeCustomer(personalId);
  if (
    subscription.status === BillingStatus.CANCELED ||
    subscription.status === BillingStatus.INCOMPLETE_EXPIRED
  ) {
    throw new StripeBillingError('A subscrição está encerrada; escolha um plano para voltar a subscrever.', 409, 'SUBSCRIPTION_TERMINAL');
  }

  const form = new URLSearchParams({
    customer: subscription.stripeCustomerId!,
    return_url: `${appBaseUrl()}/perfil`,
  });
  const session = await stripeRequest('/billing_portal/sessions', 'POST', form);
  if (typeof session.url !== 'string' || !isHostedStripeUrl(session.url, 'billing.stripe.com')) {
    throw new StripeBillingError('O Stripe devolveu um URL de gestão inválido', 502, 'STRIPE_INVALID_RESPONSE');
  }
  return { url: session.url };
}

export async function listStripeInvoices(personalId: string): Promise<StripeInvoiceSummary[]> {
  const subscription = await requireStripeCustomer(personalId);
  const query = new URLSearchParams({ customer: subscription.stripeCustomerId!, limit: '20' });
  const payload = await stripeRequest(`/invoices?${query}`, 'GET');
  if (!Array.isArray(payload.data)) {
    throw new StripeBillingError('Lista de faturas inválida do Stripe', 502, 'STRIPE_INVALID_RESPONSE');
  }

  return payload.data.map((invoice: unknown) => {
    if (
      !isRecord(invoice) ||
      typeof invoice.id !== 'string' ||
      typeof invoice.currency !== 'string' ||
      typeof invoice.amount_due !== 'number' ||
      typeof invoice.amount_paid !== 'number' ||
      typeof invoice.created !== 'number' ||
      !Number.isSafeInteger(invoice.created)
    ) {
      throw new StripeBillingError('Fatura inválida recebida do Stripe', 502, 'STRIPE_INVALID_RESPONSE');
    }

    const status = ['draft', 'open', 'paid', 'uncollectible', 'void'].includes(String(invoice.status))
      ? invoice.status as StripeInvoiceSummary['status']
      : null;
    const hostedInvoiceUrl = typeof invoice.hosted_invoice_url === 'string' ? invoice.hosted_invoice_url : null;
    const invoicePdf = typeof invoice.invoice_pdf === 'string' ? invoice.invoice_pdf : null;
    if (
      (hostedInvoiceUrl && !isHostedStripeUrl(hostedInvoiceUrl, 'invoice.stripe.com')) ||
      (invoicePdf && !isHostedStripeUrl(invoicePdf, 'invoice.stripe.com'))
    ) {
      throw new StripeBillingError('URL de fatura inválido recebido do Stripe', 502, 'STRIPE_INVALID_RESPONSE');
    }

    return {
      id: invoice.id,
      number: typeof invoice.number === 'string' ? invoice.number : null,
      status,
      currency: invoice.currency.toUpperCase(),
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      hostedInvoiceUrl,
      invoicePdf,
    };
  });
}
