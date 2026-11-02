import { Prisma } from '@prisma/client';
import { ErrorRequestHandler } from 'express';

type PublicError = {
  status: number;
  code: string;
  message: string;
};

type ErrorLogger = (context: { name: string; prismaCode?: string }) => void;

const CLIENT_ERRORS: Record<number, PublicError> = {
  400: { status: 400, code: 'BAD_REQUEST', message: 'Pedido inválido' },
  401: { status: 401, code: 'UNAUTHORIZED', message: 'Autenticação obrigatória' },
  403: { status: 403, code: 'FORBIDDEN', message: 'Acesso não permitido' },
  404: { status: 404, code: 'NOT_FOUND', message: 'Recurso não encontrado' },
  409: { status: 409, code: 'CONFLICT', message: 'Conflito ao processar o pedido' },
  413: { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Pedido excede o tamanho permitido' },
  415: { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Formato do pedido não suportado' },
  422: { status: 422, code: 'UNPROCESSABLE_ENTITY', message: 'Pedido não pode ser processado' },
  429: { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Demasiados pedidos; tente novamente' },
  503: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function prismaError(error: unknown): PublicError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
      case 'P2006':
      case 'P2011':
      case 'P2012':
        return CLIENT_ERRORS[400];
      case 'P2002':
      case 'P2003':
      case 'P2014':
        return CLIENT_ERRORS[409];
      case 'P2025':
        return CLIENT_ERRORS[404];
      default:
        return null;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return CLIENT_ERRORS[400];
  }
  return null;
}

function publicError(error: unknown): PublicError {
  const knownPrismaError = prismaError(error);
  if (knownPrismaError) return knownPrismaError;

  if (isRecord(error)) {
    const status = typeof error.status === 'number'
      ? error.status
      : typeof error.statusCode === 'number'
        ? error.statusCode
        : null;
    if (status !== null && CLIENT_ERRORS[status]) return CLIENT_ERRORS[status];
  }

  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor',
  };
}

export function createApiErrorHandler(
  logger: ErrorLogger = ({ name, prismaCode }) => {
    console.error('Erro não tratado na API', { name, prismaCode });
  },
): ErrorRequestHandler {
  return (error, _req, res, next) => {
    if (res.headersSent) return next(error);

    const result = publicError(error);
    if (result.status >= 500) {
      const context: { name: string; prismaCode?: string } = {
        name: error instanceof Error ? error.name : 'UnknownError',
      };
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        context.prismaCode = error.code;
      }
      logger(context);
    }

    return res.status(result.status).json({
      error: result.message,
      code: result.code,
    });
  };
}

export const apiErrorHandler = createApiErrorHandler();
