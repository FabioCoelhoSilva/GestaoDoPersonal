import { BillingStatus } from '@prisma/client';
import { findPersonalBillingEmail } from '../db/scoped-prisma';
import { EmailProvider, EmailProviderError, TransactionalEmail } from './email.provider';
import { ResendEmailProvider } from './resend-email.provider';

export type EmailNotification =
  | { type: 'welcome'; name: string; to: string }
  | { type: 'password-recovery'; to: string; recoveryUrl: string }
  | {
      type: 'subscription-alert';
      to: string;
        status: SubscriptionNoticeStatus;
    };

type SubscriptionNoticeStatus =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID';

export type EmailSendResult =
  | { sent: true }
  | { sent: false; reason: 'not-configured' | 'provider-failure' };

export type EmailServiceOptions = {
  provider?: EmailProvider;
  logger?: (event: { notificationType: EmailNotification['type']; attempt: number }) => void;
  timeoutMs?: number;
  maxAttempts?: number;
  delay?: (ms: number) => Promise<void>;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function requireEmail(value: string) {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error('Endereço de e-mail inválido');
  }
  return email;
}

function requireSecureUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Link de recuperação inválido');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Link de recuperação deve usar HTTPS');
  }
  return url.toString();
}

function buildMessage(notification: EmailNotification): TransactionalEmail {
  const to = requireEmail(notification.to);
  switch (notification.type) {
    case 'welcome': {
      const name = notification.name.trim();
      if (!name || name.length > 120) throw new Error('Nome inválido para e-mail de boas-vindas');
      const safeName = escapeHtml(name);
      return {
        to,
        subject: 'Bem-vindo ao GestaoDoPersonal',
        html: `<p>Olá, ${safeName}!</p><p>A sua conta está pronta para começar.</p>`,
        text: `Olá, ${name}!\n\nA sua conta está pronta para começar.`,
      };
    }
    case 'password-recovery': {
      const recoveryUrl = requireSecureUrl(notification.recoveryUrl);
      const safeUrl = escapeHtml(recoveryUrl);
      return {
        to,
        subject: 'Recuperação da sua palavra-passe',
        html: `<p>Recebemos um pedido para recuperar a sua palavra-passe.</p><p><a href="${safeUrl}">Definir nova palavra-passe</a></p><p>Se não pediu esta alteração, ignore este e-mail.</p>`,
        text: `Recebemos um pedido para recuperar a sua palavra-passe.\n\nDefina uma nova palavra-passe: ${recoveryUrl}\n\nSe não pediu esta alteração, ignore este e-mail.`,
      };
    }
    case 'subscription-alert': {
      const content: Record<SubscriptionNoticeStatus, { subject: string; message: string }> = {
        [BillingStatus.ACTIVE]: {
          subject: 'A sua subscrição está ativa',
          message: 'A sua subscrição foi ativada e o acesso ao serviço está disponível.',
        },
        [BillingStatus.PAST_DUE]: {
          subject: 'Ação necessária: pagamento da subscrição',
          message: 'Não foi possível confirmar o pagamento. Atualize os dados de pagamento para evitar interrupções.',
        },
        [BillingStatus.CANCELED]: {
          subject: 'Subscrição cancelada',
          message: 'A sua subscrição foi cancelada. Consulte a sua conta para mais informações.',
        },
        [BillingStatus.UNPAID]: {
          subject: 'Ação necessária: subscrição sem pagamento',
          message: 'A subscrição está sem pagamento e o acesso pode estar limitado. Consulte a sua conta.',
        },
      };
      const { subject, message } = content[notification.status];
      return {
        to,
        subject,
        html: `<p>${escapeHtml(message)}</p>`,
        text: message,
      };
    }
  }
}

export class EmailService {
  private readonly provider: EmailProvider;
  private readonly logger: NonNullable<EmailServiceOptions['logger']>;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly delay: NonNullable<EmailServiceOptions['delay']>;

  constructor(options: EmailServiceOptions = {}) {
    this.provider = options.provider ?? new ResendEmailProvider();
    this.logger = options.logger ?? ((event) => {
      console.warn('E-mail transacional não enviado', event);
    });
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.delay = options.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('timeoutMs deve ser um inteiro positivo');
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 5) {
      throw new Error('maxAttempts deve estar entre 1 e 5');
    }
  }

  async send(notification: EmailNotification): Promise<EmailSendResult> {
    const message = buildMessage(notification);
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await this.provider.send(message, AbortSignal.timeout(this.timeoutMs));
        return { sent: true };
      } catch (error) {
        const retryable = error instanceof EmailProviderError && error.retryable;
        const notConfigured = error instanceof EmailProviderError &&
          error.message === 'Provedor de e-mail não configurado';
        this.logger({ notificationType: notification.type, attempt });
        if (notConfigured) return { sent: false, reason: 'not-configured' };
        if (!retryable || attempt === this.maxAttempts) {
          return { sent: false, reason: 'provider-failure' };
        }
        await this.delay(100 * attempt);
      }
    }
    return { sent: false, reason: 'provider-failure' };
  }

  sendWelcome(to: string, name: string) {
    return this.send({ type: 'welcome', to, name });
  }

  sendPasswordRecovery(to: string, recoveryUrl: string) {
    return this.send({ type: 'password-recovery', to, recoveryUrl });
  }

  sendSubscriptionAlert(to: string, status: SubscriptionNoticeStatus) {
    return this.send({ type: 'subscription-alert', to, status });
  }
}

export const emailService = new EmailService();

export async function notifyPersonalSubscriptionStatus(
  personalId: string,
  status: BillingStatus,
): Promise<EmailSendResult> {
  if (
    status !== BillingStatus.ACTIVE &&
    status !== BillingStatus.PAST_DUE &&
    status !== BillingStatus.CANCELED &&
    status !== BillingStatus.UNPAID
  ) {
    return { sent: false, reason: 'provider-failure' };
  }

  try {
    const personal = await findPersonalBillingEmail(personalId);
    if (!personal?.user.email) {
      console.warn('Alerta de subscrição sem destinatário', { notificationType: 'subscription-alert' });
      return { sent: false, reason: 'provider-failure' };
    }
    return await emailService.send({
      type: 'subscription-alert',
      to: personal.user.email,
      status,
    });
  } catch {
    console.warn('Falha ao preparar alerta de subscrição', {
      notificationType: 'subscription-alert',
    });
    return { sent: false, reason: 'provider-failure' };
  }
}
