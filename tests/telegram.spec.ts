import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { groupToken, verifyGroupToken, verifyInitData } from '../worker/telegram';
import worker from '../worker/index';

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
  expect((await verifyInitData(valid.toString(), botToken))?.user).toEqual({ id: 123456, username: 'test_player', photo_url: undefined });
  valid.set('user', JSON.stringify({ id: 999999, first_name: 'Imposter' }));
  expect(await verifyInitData(valid.toString(), botToken)).toBeNull();
  expect(await verifyInitData(signedLaunch(Math.floor(Date.now() / 1000) - 86_401).toString(), botToken)).toBeNull();
  const duplicate = signedLaunch();
  duplicate.append('user', duplicate.get('user')!);
  expect(await verifyInitData(duplicate.toString(), botToken)).toBeNull();
});

test('bot removal update clears only its group room', async () => {
  const calls: string[] = [];
  const env = {
    TELEGRAM_WEBHOOK_SECRET: 'webhook-test',
    ROOMS: { idFromName: (id: string) => id, get: (id: string) => ({ fetch: async (request: Request) => { calls.push(`${id}:${new URL(request.url).pathname}`); return Response.json({ ok: true }); } }) },
  } as unknown as Parameters<typeof worker.fetch>[1];
  const update = (status: string) => new Request('https://bridge.test/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-test' }, body: JSON.stringify({ my_chat_member: { chat: { id: -100123456, type: 'supergroup' }, old_chat_member: { status: 'member' }, new_chat_member: { status } } }) });
  expect((await worker.fetch(update('left'), env)).status).toBe(200);
  expect(calls).toEqual(['-100123456:/clear']);
  await worker.fetch(update('administrator'), env);
  expect(calls).toHaveLength(1);
  const denied = await worker.fetch(new Request('https://bridge.test/telegram/webhook', { method: 'POST', body: '{}' }), env);
  expect(denied.status).toBe(401);
});

test('group links cannot be changed to a different chat', async () => {
  const token = await groupToken(-100123456, 'local-link-test-secret');
  expect(await verifyGroupToken(token, 'local-link-test-secret')).toBe(-100123456);
  expect(await verifyGroupToken(token.replace('123456', '123457'), 'local-link-test-secret')).toBeNull();
});
