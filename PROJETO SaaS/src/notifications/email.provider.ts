export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  send(message: TransactionalEmail, signal: AbortSignal): Promise<void>;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}
