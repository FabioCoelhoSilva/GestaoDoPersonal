import { Prisma } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiErrorHandler } from '../src/middleware/api-error-handler';

let server: Server;
let baseUrl: string;
const logger = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.get('/error/:type', (req, _res, next) => {
    switch (req.params.type) {
      case 'unique':
        return next(new Prisma.PrismaClientKnownRequestError(
          'private database detail',
          { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
        ));
      case 'missing':
        return next(new Prisma.PrismaClientKnownRequestError(
          'private database detail',
          { code: 'P2025', clientVersion: 'test', meta: { modelName: 'Student' } },
        ));
      case 'foreign-key':
        return next(new Prisma.PrismaClientKnownRequestError(
          'private database detail',
          { code: 'P2003', clientVersion: 'test' },
        ));
      case 'validation':
        return next(new Prisma.PrismaClientValidationError('private validation detail', {
          clientVersion: 'test',
        }));
      case 'http':
        return next(Object.assign(new Error('private parser detail'), { status: 400 }));
      case 'arbitrary':
        return next(Object.assign(new Error('private status detail'), { status: 418 }));
      default:
        return next(new Error('private stack and database details'));
    }
  });
  app.use(createApiErrorHandler(logger));
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('global API error handler', () => {
  it('maps Prisma unique and foreign-key violations to conflict responses', async () => {
    const unique = await fetch(`${baseUrl}/error/unique`);
    expect(unique.status).toBe(409);
    await expect(unique.json()).resolves.toEqual({
      error: 'Conflito ao processar o pedido',
      code: 'CONFLICT',
    });

    const foreignKey = await fetch(`${baseUrl}/error/foreign-key`);
    expect(foreignKey.status).toBe(409);
  });

  it('maps a missing Prisma record to not found without exposing query details', async () => {
    const response = await fetch(`${baseUrl}/error/missing`);
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({
      error: 'Recurso não encontrado',
      code: 'NOT_FOUND',
    }));
    expect(body).not.toContain('private');
    expect(body).not.toContain('Student');
  });

  it('sanitizes validation and recognized HTTP client errors', async () => {
    const validation = await fetch(`${baseUrl}/error/validation`);
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toEqual({
      error: 'Pedido inválido',
      code: 'BAD_REQUEST',
    });

    const http = await fetch(`${baseUrl}/error/http`);
    expect(http.status).toBe(400);
    expect(await http.text()).not.toContain('private');
  });

  it('returns a generic internal error and logs only safe error metadata', async () => {
    const response = await fetch(`${baseUrl}/error/unexpected`);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR',
    }));
    expect(body).not.toContain('private');
    expect(logger).toHaveBeenCalledWith({ name: 'Error' });
  });

  it('classifies errors with an unsupported arbitrary status as internal errors', async () => {
    const response = await fetch(`${baseUrl}/error/arbitrary`);
    expect(response.status).toBe(500);
  });
});
