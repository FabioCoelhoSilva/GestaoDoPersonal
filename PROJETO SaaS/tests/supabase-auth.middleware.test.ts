import { NextFunction, Request, Response } from 'express';
import type { JWTVerifyGetKey } from 'jose' with { 'resolution-mode': 'import' };
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthMiddleware } from '../src/auth/supabase-auth.middleware';

const ISSUER = 'https://project.supabase.co/auth/v1';
const SUBJECT = 'supabase-user-sub';
const TEST_TOKEN = 'not-a-real-supabase-token';

let validToken: string;
let wrongIssuerToken: string;
let wrongAudienceToken: string;
let expiredToken: string;
let tokenWithEmail: string;
let verifier: JWTVerifyGetKey;

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

beforeAll(async () => {
  const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  verifier = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] });
  validToken = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  tokenWithEmail = await new SignJWT({ role: 'authenticated', email: 'new-personal@example.test' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  wrongIssuerToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer('https://attacker.example/auth/v1')
    .setAudience('authenticated')
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  wrongAudienceToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience('anon')
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  expiredToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(SUBJECT)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
    .sign(privateKey);
});

describe('Supabase JWT authentication', () => {
  it('validates JWT claims and maps the Supabase subject to an internal tenant', async () => {
    const lookupIdentity = vi.fn(async (sub: string) => ({
      userId: 'internal-user-id',
      role: 'PERSONAL' as const,
      tenantId: 'personal-tenant-id',
    }));
    const middleware = createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity,
    });
    const req = request(`Bearer ${validToken}`) as Request & {
      auth?: Record<string, unknown>;
      tenantId?: string;
    };
    const res = response();
    const next = makeNext();

    await middleware(req, res, next.next);

    expect(lookupIdentity).toHaveBeenCalledWith(SUBJECT);
    expect(req.tenantId).toBe('personal-tenant-id');
    expect(req.auth).toEqual({
      userId: 'internal-user-id',
      subject: SUBJECT,
      role: 'PERSONAL',
      tenantId: 'personal-tenant-id',
      personalId: 'personal-tenant-id',
      studentId: null,
    });
    expect(next.wasCalled()).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a missing Bearer token before database lookup', async () => {
    const lookupIdentity = vi.fn(async () => null);
    const res = response();

    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity,
    })(request(), res, makeNext().next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(lookupIdentity).not.toHaveBeenCalled();
  });

  it('rejects tokens signed for another issuer', async () => {
    const lookupIdentity = vi.fn(async () => null);
    const res = response();

    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity,
    })(request(`Bearer ${wrongIssuerToken}`), res, makeNext().next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de acesso inválido ou expirado' });
    expect(lookupIdentity).not.toHaveBeenCalled();
  });

  it('rejects tokens with the wrong audience or an expired expiration claim', async () => {
    const middleware = createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity: async () => null,
    });

    for (const token of [wrongAudienceToken, expiredToken]) {
      const res = response();
      await middleware(request(`Bearer ${token}`), res, makeNext().next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acesso inválido ou expirado' });
    }
  });

  it('rejects verified users without a mapped tenant or student', async () => {
    const res = response();
    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity: async () => null,
    })(request(`Bearer ${validToken}`), res, makeNext().next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Utilizador sem tenant ou vínculo de aluno ativo' });
  });

  it('only accepts an unmapped identity when onboarding is explicitly enabled and the token has an email', async () => {
    const req = request(`Bearer ${tokenWithEmail}`) as Request & {
      auth?: Record<string, unknown>;
      tenantId?: string;
    };
    const next = makeNext();
    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      allowUnprovisioned: true,
      lookupIdentity: async () => null,
    })(req, response(), next.next);

    expect(req.auth).toEqual({
      userId: SUBJECT,
      subject: SUBJECT,
      role: 'PERSONAL',
      tenantId: null,
      personalId: null,
      studentId: null,
      email: 'new-personal@example.test',
    });
    expect(req.tenantId).toBeUndefined();
    expect(next.wasCalled()).toBe(true);
  });

  it('maps a verified student to its own student id and personal tenant', async () => {
    const req = request(`Bearer ${validToken}`) as Request & {
      auth?: Record<string, unknown>;
      tenantId?: string;
    };
    const res = response();
    const next = makeNext();
    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
      lookupIdentity: async () => ({
        userId: 'student-user-id',
        role: 'STUDENT',
        tenantId: 'student-personal-tenant',
        studentId: 'student-record-id',
      }),
    })(req, res, next.next);

    expect(req.tenantId).toBe('student-personal-tenant');
    expect(req.auth).toMatchObject({
      role: 'STUDENT',
      tenantId: 'student-personal-tenant',
      personalId: 'student-personal-tenant',
      studentId: 'student-record-id',
    });
    expect(next.wasCalled()).toBe(true);
  });

  it('does not disclose token details in authentication errors', async () => {
    const res = response();
    await createSupabaseAuthMiddleware({
      keyResolver: verifier,
      issuer: ISSUER,
    })(request(`Bearer ${TEST_TOKEN}`), res, makeNext().next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain(TEST_TOKEN);
  });
});
