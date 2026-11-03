import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const {
  findActiveStripePlan,
  findPersonalBillingEmail,
  listActiveStripePlans,
  readBillingSubscriptionForManagement,
} = vi.hoisted(() => ({
  findActiveStripePlan: vi.fn(),
  findPersonalBillingEmail: vi.fn(),
  listActiveStripePlans: vi.fn(),
  readBillingSubscriptionForManagement: vi.fn(),
}));

vi.mock('../src/db/scoped-prisma', () => ({
  findActiveStripePlan,
  findPersonalBillingEmail,
  listActiveStripePlans,
  readBillingSubscriptionForManagement,
}));

import {
  createStripeCheckout,
  createStripePortal,
  listStripeInvoices,
  listStripePlanOptions,
  StripeBillingError,
} from '../src/billing/stripe-billing.service';

const previousSecretKey = process.env.STRIPE_SECRET_KEY;
const previousWebAppUrl = process.env.WEB_APP_URL;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_validsecret123';
  process.env.WEB_APP_URL = 'http://localhost:3001';
  readBillingSubscriptionForManagement.mockResolvedValue(null);
  findActiveStripePlan.mockResolvedValue({
    id: 'plan-1',
    name: 'Pro',
    stripePriceId: 'price_pro',
  });
  findPersonalBillingEmail.mockResolvedValue({ user: { email: 'trainer@example.com' } });
  listActiveStripePlans.mockResolvedValue([{ id: 'plan-1', name: 'Pro', stripePriceId: 'price_pro' }]);
});

afterEach(() => {
  if (previousSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousSecretKey;
  if (previousWebAppUrl === undefined) delete process.env.WEB_APP_URL;
  else process.env.WEB_APP_URL = previousWebAppUrl;
  vi.unstubAllGlobals();
});

describe('Stripe billing service', () => {
  it('creates a checkout session with tenant metadata and a configured return origin', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/session' }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createStripeCheckout('tenant-1', 'plan-1')).resolves.toEqual({
      url: 'https://checkout.stripe.com/c/pay/session',
    });

    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(Object.fromEntries(new URLSearchParams(String(options.body)))).toEqual({
      mode: 'subscription',
      'line_items[0][price]': 'price_pro',
      'line_items[0][quantity]': '1',
      customer_email: 'trainer@example.com',
      client_reference_id: 'tenant-1',
      'metadata[personalId]': 'tenant-1',
      'subscription_data[metadata][personalId]': 'tenant-1',
      success_url: 'http://localhost:3001/perfil?checkout=success',
      cancel_url: 'http://localhost:3001/perfil?checkout=cancelled',
    });
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer sk_test_validsecret123');
  });

  it('blocks duplicate subscription checkout and only lists active plan choices', async () => {
    readBillingSubscriptionForManagement.mockResolvedValueOnce({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'ACTIVE',
    });
    await expect(createStripeCheckout('tenant-1', 'plan-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_ALREADY_EXISTS',
      status: 409,
    });
    expect(listActiveStripePlans).toHaveBeenCalledTimes(0);
    await expect(listStripePlanOptions()).resolves.toEqual([{ id: 'plan-1', name: 'Pro' }]);
  });

  it('uses the tenant Stripe customer for billing portal and invoices', async () => {
    readBillingSubscriptionForManagement.mockResolvedValue({
      stripeCustomerId: 'cus_tenant_1',
      stripeSubscriptionId: 'sub_tenant_1',
      status: 'ACTIVE',
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ url: 'https://billing.stripe.com/session/portal' }),
        { status: 200 },
      ))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'in_test',
          number: 'INV-1',
          status: 'paid',
          currency: 'eur',
          amount_due: 1250,
          amount_paid: 1250,
          created: 1_800_000_000,
          hosted_invoice_url: 'https://invoice.stripe.com/i/test',
          invoice_pdf: 'https://invoice.stripe.com/i/test/pdf',
        }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createStripePortal('tenant-1')).resolves.toEqual({
      url: 'https://billing.stripe.com/session/portal',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    expect(new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get('customer')).toBe('cus_tenant_1');

    await expect(listStripeInvoices('tenant-1')).resolves.toEqual([{
      id: 'in_test',
      number: 'INV-1',
      status: 'paid',
      currency: 'EUR',
      amountDue: 1250,
      amountPaid: 1250,
      createdAt: new Date(1_800_000_000_000).toISOString(),
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      invoicePdf: 'https://invoice.stripe.com/i/test/pdf',
    }]);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.stripe.com/v1/invoices?customer=cus_tenant_1&limit=20');
  });

  it('rejects unconfigured Stripe, untrusted app origins and absent tenant customers explicitly', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(listStripeInvoices('tenant-1')).rejects.toBeInstanceOf(StripeBillingError);

    process.env.STRIPE_SECRET_KEY = 'sk_test_validsecret123';
    process.env.WEB_APP_URL = 'http://attacker.example';
    await expect(createStripeCheckout('tenant-1', 'plan-1')).rejects.toMatchObject({
      code: 'BILLING_RETURN_URL_NOT_CONFIGURED',
      status: 503,
    });

    process.env.WEB_APP_URL = 'http://localhost:3001';
    await expect(listStripeInvoices('tenant-1')).rejects.toMatchObject({
      code: 'STRIPE_CUSTOMER_NOT_LINKED',
      status: 409,
    });
  });
});
