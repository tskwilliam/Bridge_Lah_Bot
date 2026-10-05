import { expect, test } from '@playwright/test';
import { liveAction, type LiveContext } from '../src/game/telegram';

const context: LiveContext = { token: 'test', user: { id: 1 }, groupToken: 'group', startGameId: null, resumeId: null };

test('moves retry connection failures, server failures, and interrupted bodies with the same identity', async () => {
  const original = globalThis.fetch;
  const requests: RequestInit[] = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(init!);
    if (requests.length === 1) throw new TypeError('Load failed');
    if (requests.length === 2) return new Response('Unavailable', { status: 503 });
    if (requests.length === 3) return new Response('{"state":');
    return Response.json({ state: { revision: 8 } });
  };
  try {
    const result = await liveAction(context, 'game', { type: 'bid', bid: null }, 7);
    expect(result.state?.revision).toBe(8);
    expect(requests).toHaveLength(4);
    const ids = requests.map(init => new Headers(init.headers).get('X-Action-ID'));
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTruthy();
    expect(requests.every(init => new Headers(init.headers).get('X-Game-Revision') === '7')).toBe(true);
  } finally { globalThis.fetch = original; }
});

test('invalid decisions are not retried as transport failures', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: 'It is not your turn to play.' }, { status: 409 }); };
  try {
    await expect(liveAction(context, 'game', { type: 'play', cardId: 'A-clubs' }, 7)).rejects.toThrow('not your turn');
    expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});
