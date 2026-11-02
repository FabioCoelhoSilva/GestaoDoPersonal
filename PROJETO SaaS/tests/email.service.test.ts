import { BillingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailProvider, EmailProviderError, TransactionalEmail } from '../src/notifications/email.provider';
import { EmailService } from '../src/notifications/email.service';
import { ResendEmailProvider } from '../src/notifications/resend-email.provider';

class MockEmailProvider implements EmailProvider {
  send = vi.fn<(message: TransactionalEmail, signal: AbortSignal) => Promise<void>>(
    async () => undefined,
  );
}

describe('transactional email service', () => {
  let provider: MockEmailProvider;
  const logger = vi.fn();

  beforeEach(() => {
    provider = new MockEmailProvider();
    vi.clearAllMocks();
  });

  it('sends a welcome email with escaped user-provided content', async () => {
    const service = new EmailService({ provider, logger });
    await expect(service.sendWelcome('trainer@example.com', '<Trainer>'))
      .resolves.toEqual({ sent: true });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'trainer@example.com',
        html: expect.stringContaining('&lt;Trainer&gt;'),
      }),
      expect.any(AbortSignal),
    );
  });

  it('sends recovery links only over HTTPS and rejects malformed recipients', async () => {
    const service = new EmailService({ provider, logger });
    await expect(service.sendPasswordRecovery('trainer@example.com', 'http://example.com/reset'))
      .rejects.toThrow(/HTTPS/);
    await expect(service.send({
      type: 'welcome',
      to: 'not-an-email',
      name: 'Trainer',
    })).rejects.toThrow(/inválido/);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('sends subscription alerts using a non-sensitive template', async () => {
    const service = new EmailService({ provider, logger });
    await expect(service.sendSubscriptionAlert('trainer@example.com', BillingStatus.PAST_DUE))
      .resolves.toEqual({ sent: true });
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Ação necessária: pagamento da subscrição',
        text: expect.stringContaining('Atualize os dados de pagamento'),
      }),
      expect.any(AbortSignal),
    );
  });

  it('retries transient errors a bounded number of times, then returns failure without throwing', async () => {
    provider.send
      .mockRejectedValueOnce(new EmailProviderError('transient detail', true))
      .mockRejectedValueOnce(new EmailProviderError('transient detail', true));
    const delay = vi.fn(async () => undefined);
    const service = new EmailService({
      provider,
      logger,
      delay,
      maxAttempts: 2,
    });

    await expect(service.send({
      type: 'welcome',
      to: 'trainer@example.com',
      name: 'Trainer',
    })).resolves.toEqual({ sent: false, reason: 'provider-failure' });
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logger.mock.calls)).not.toContain('trainer@example.com');
  });

  it('does not retry permanent provider failures or missing configuration', async () => {
    provider.send.mockRejectedValueOnce(new EmailProviderError('rejected', false));
    const service = new EmailService({ provider, logger });
    await expect(service.send({
      type: 'welcome',
      to: 'trainer@example.com',
      name: 'Trainer',
    })).resolves.toEqual({ sent: false, reason: 'provider-failure' });
    expect(provider.send).toHaveBeenCalledOnce();

    const unconfigured = new EmailService({
      provider: new ResendEmailProvider('', ''),
      logger,
    });
    await expect(unconfigured.send({
      type: 'welcome',
      to: 'trainer@example.com',
      name: 'Trainer',
    })).resolves.toEqual({ sent: false, reason: 'not-configured' });
  });

  it('adapts Resend requests and classifies retryable HTTP failures', async () => {
    const fetchRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 202 }));
    const provider = new ResendEmailProvider('re_test', 'Gestao <no-reply@example.com>', fetchRequest);
    const message = {
      to: 'trainer@example.com',
      subject: 'Welcome',
      html: '<p>Hello</p>',
      text: 'Hello',
    };
    const signal = AbortSignal.timeout(1000);

    await expect(provider.send(message, signal)).rejects.toMatchObject({ retryable: true });
    await expect(provider.send(message, signal)).resolves.toBeUndefined();
    expect(fetchRequest).toHaveBeenNthCalledWith(
      2,
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer re_test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Gestao <no-reply@example.com>',
          to: ['trainer@example.com'],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal,
      }),
    );
  });
});
