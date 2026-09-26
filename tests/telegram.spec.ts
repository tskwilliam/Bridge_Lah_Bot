import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { groupToken, verifyGroupToken, verifyInitData } from '../worker/telegram';

const botToken = 'test-token-only';

function signedLaunch(date = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(date),
    start_param: 'g_-100123456_abc',
    user: JSON.stringify({ id: 123456, first_name: 'Test', username: 'test_player' }),
  });
  const check = Array.from(params.keys()).sort().map(key => `${key}=${params.get(key)}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params;
}

test('Telegram launch verification rejects altered and expired identities', async () => {
  const valid = signedLaunch();
  expect((await verifyInitData(valid.toString(), botToken))?.user.id).toBe(123456);
  valid.set('user', JSON.stringify({ id: 999999, first_name: 'Imposter' }));
  expect(await verifyInitData(valid.toString(), botToken)).toBeNull();
  expect(await verifyInitData(signedLaunch(Math.floor(Date.now() / 1000) - 86_401).toString(), botToken)).toBeNull();
  const duplicate = signedLaunch();
  duplicate.append('user', duplicate.get('user')!);
  expect(await verifyInitData(duplicate.toString(), botToken)).toBeNull();
});

test('group links cannot be changed to a different chat', async () => {
  const token = await groupToken(-100123456, 'local-link-test-secret');
  expect(await verifyGroupToken(token, 'local-link-test-secret')).toBe(-100123456);
  expect(await verifyGroupToken(token.replace('123456', '123457'), 'local-link-test-secret')).toBeNull();
});
