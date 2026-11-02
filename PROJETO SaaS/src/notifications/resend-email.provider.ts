import { EmailProvider, EmailProviderError, TransactionalEmail } from './email.provider';

type Fetch = typeof globalThis.fetch;

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey?: string,
    private readonly from?: string,
    private readonly fetchRequest?: Fetch,
  ) {}

  async send(message: TransactionalEmail, signal: AbortSignal): Promise<void> {
    const apiKey = this.apiKey ?? process.env.RESEND_API_KEY?.trim();
    const from = this.from ?? process.env.EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      throw new EmailProviderError('Provedor de e-mail não configurado', false);
    }

    let response: Response;
    try {
      response = await (this.fetchRequest ?? globalThis.fetch)('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new EmailProviderError('Tempo limite do provedor de e-mail excedido', true);
      }
      throw new EmailProviderError(
        error instanceof Error ? 'Falha de rede no provedor de e-mail' : 'Falha no provedor de e-mail',
        true,
      );
    }

    if (response.ok) return;
    throw new EmailProviderError(
      'O provedor de e-mail recusou a mensagem',
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
}
