import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeSignature } from '../src/webhooks/stripe.routes';

const SECRET = 'whsec_test_secret';
const NOW = 1_800_000_000_000;

function sign(body: Buffer, timestamp = Math.floor(NOW / 1000)) {
  const signature = createHmac('sha256', SECRET)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('verifyStripeSignature', () => {
  it('accepts a valid signature over the exact raw body', () => {
    const body = Buffer.from('{"id":"evt_test","type":"customer.subscription.updated"}');
    expect(verifyStripeSignature(body, sign(body), SECRET, NOW)).toBe(true);
  });

  it('rejects a signature when the body has changed', () => {
    const signedBody = Buffer.from('{"id":"evt_test"}');
    const changedBody = Buffer.from('{"id": "evt_test"}');
    expect(verifyStripeSignature(changedBody, sign(signedBody), SECRET, NOW)).toBe(false);
  });

  it('rejects signatures outside the timestamp tolerance', () => {
    const body = Buffer.from('{"id":"evt_test"}');
    const staleSignature = sign(body, Math.floor(NOW / 1000) - 301);
    expect(verifyStripeSignature(body, staleSignature, SECRET, NOW)).toBe(false);
  });

  it('rejects malformed or duplicate timestamps', () => {
    const body = Buffer.from('{}');
    expect(verifyStripeSignature(body, 't=abc,v1=deadbeef', SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, `${sign(body)},t=1`, SECRET, NOW)).toBe(false);
  });
});
