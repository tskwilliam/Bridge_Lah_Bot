/// <reference types="@cloudflare/workers-types" />
import { expect, test } from '@playwright/test';
import { GroupRoom } from '../worker/room';
import type { SharedPlayer } from '../src/game/shared';

const groupId = -100123456;
const players: SharedPlayer[] = [1, 2, 3, 4].map(id => ({ id: String(id), username: `@player${id}`, initials: String(id) }));
const session = (id: number) => ({ user: { id, first_name: `Player ${id}` }, chatId: groupId, expiresAt: Date.now() + 60_000 });

function testRoom() {
  const values = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: unknown) => { values.set(key, value); },
    delete: async (key: string) => { values.delete(key); },
    list: async ({ prefix }: { prefix: string }) => new Map([...values].filter(([key]) => key.startsWith(prefix))),
    setAlarm: async () => undefined,
    deleteAlarm: async () => undefined,
  };
  const ctx = { storage, getWebSockets: () => [] } as unknown as ConstructorParameters<typeof GroupRoom>[0];
  const room = new GroupRoom(ctx, { LINK_SECRET: 'test-only-secret' });
  const call = async (path: string, user: number, extra: object = {}) => {
    const response = await room.fetch(new Request(`https://room.internal${path}`, { method: 'POST', body: JSON.stringify({ session: session(user), ...extra }) }));
    return { status: response.status, body: await response.json() as { state?: { revision: number; cards: unknown[]; seats: (SharedPlayer | null)[]; breakTrump: boolean; reshuffleThreshold: number }; resumeId?: string | null; error?: string } };
  };
  return { call, values };
}

test('a room stores one authoritative deal, private views, settings, and active resumes', async () => {
  const { call, values } = testRoom();
  const id = 'a'.repeat(32);
  expect((await call('/create', 1, { id, player: players[0] })).status).toBe(201);
  for (const player of players.slice(1)) expect((await call('/join', Number(player.id), { id, player })).status).toBe(200);
  expect((await call('/action', 1, { id, action: { type: 'breakTrump', enabled: true } })).status).toBe(200);
  expect((await call('/action', 1, { id, action: { type: 'reshuffleSetting', enabled: true, threshold: 5 } })).status).toBe(200);
  const started = await call('/action', 1, { id, action: { type: 'start' } });
  expect(started.status).toBe(200);
  expect(started.body.state?.cards).toHaveLength(13);
  const second = await call('/state', 2, { id });
  expect(second.body.state?.cards).toHaveLength(13);
  expect(second.body.state?.cards).not.toEqual(started.body.state?.cards);
  expect(second.body.state?.revision).toBe(started.body.state?.revision);
  expect(second.body).not.toHaveProperty('hands');
  expect(values.get('settings:2')).toEqual({ breakTrump: true, reshuffleEnabled: true, reshuffleThreshold: 5 });
  expect((await call('/home', 2)).body.resumeId).toBe(id);
  await call('/action', 2, { id, action: { type: 'quit' } });
  expect((await call('/home', 2)).body.resumeId).toBeNull();
  expect((await call('/home', 1)).body.resumeId).toBe(id);
  const nextId = 'b'.repeat(32);
  const next = await call('/create', 2, { id: nextId, player: players[1] });
  expect(next.status).toBe(201);
  expect(next.body.state?.breakTrump).toBe(true);
  expect(next.body.state?.reshuffleThreshold).toBe(5);
  expect((await call('/home', 2)).body.resumeId).toBe(nextId);
});
