import { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDevelopmentAuthMiddleware } from '../src/auth/development-auth.middleware';

const TEST_TOKEN = 'dev-auth-test-token-with-at-least-32-characters';
const originalEnv = {
  nodeEnv: process.env.NODE_ENV,
  token: process.env.DEV_AUTH_TOKEN,
  personalId: process.env.DEV_PERSONAL_ID,
};

function request(authorization?: string) {
  return { headers: { authorization } } as Request;
}

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function makeNext() {
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };
  return { next, wasCalled: () => called };
}

afterEach(() => {
  if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.nodeEnv;
  if (originalEnv.token === undefined) delete process.env.DEV_AUTH_TOKEN;
  else process.env.DEV_AUTH_TOKEN = originalEnv.token;
  if (originalEnv.personalId === undefined) delete process.env.DEV_PERSONAL_ID;
  else process.env.DEV_PERSONAL_ID = originalEnv.personalId;
});

describe('development bearer authentication', () => {
  it('fails closed when development credentials are not configured', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEV_AUTH_TOKEN;
    delete process.env.DEV_PERSONAL_ID;
    const res = response();
    const next = makeNext();

    await createDevelopmentAuthMiddleware()(request(), res, next.next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Configure DEV_PERSONAL_ID e um DEV_AUTH_TOKEN com pelo menos 32 caracteres',
    });
    expect(next.wasCalled()).toBe(false);
  });

  it('rejects missing and invalid bearer tokens', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_TOKEN = TEST_TOKEN;
    process.env.DEV_PERSONAL_ID = 'personal-test';
    const lookup = vi.fn(async () => ({ id: 'personal-test', userId: 'user-test' }));
    const middleware = createDevelopmentAuthMiddleware(lookup);

    const missingResponse = response();
    await middleware(request(), missingResponse, makeNext().next);
    expect(missingResponse.status).toHaveBeenCalledWith(401);

    const invalidResponse = response();
    await middleware(request('Bearer wrong-token'), invalidResponse, makeNext().next);
    expect(invalidResponse.status).toHaveBeenCalledWith(401);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves the configured personal from the database before setting req.auth', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_TOKEN = TEST_TOKEN;
    process.env.DEV_PERSONAL_ID = 'personal-test';
    const lookup = vi.fn(async () => ({ id: 'personal-test', userId: 'user-test' }));
    const middleware = createDevelopmentAuthMiddleware(lookup);
    const req = request(`Bearer ${TEST_TOKEN}`) as Request & {
      auth?: { userId: string; role: string; personalId: string };
    };
    const res = response();
    const next = makeNext();

    await middleware(req, res, next.next);

    expect(lookup).toHaveBeenCalledWith('personal-test');
    expect(req.auth).toEqual({
      userId: 'user-test',
      subject: 'user-test',
      role: 'PERSONAL',
      tenantId: 'personal-test',
      personalId: 'personal-test',
      studentId: null,
    });
    expect(next.wasCalled()).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a configured personal that does not exist', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_TOKEN = TEST_TOKEN;
    process.env.DEV_PERSONAL_ID = 'missing-personal';
    const res = response();

    await createDevelopmentAuthMiddleware(async () => null)(
      request(`Bearer ${TEST_TOKEN}`),
      res,
      makeNext().next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'DEV_PERSONAL_ID não corresponde a um personal existente',
    });
  });

  it('never enables the simulated credentials in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_AUTH_TOKEN = TEST_TOKEN;
    process.env.DEV_PERSONAL_ID = 'personal-test';
    const lookup = vi.fn(async () => ({ id: 'personal-test', userId: 'user-test' }));
    const res = response();

    await createDevelopmentAuthMiddleware(lookup)(
      request(`Bearer ${TEST_TOKEN}`),
      res,
      makeNext().next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(lookup).not.toHaveBeenCalled();
  });
});
