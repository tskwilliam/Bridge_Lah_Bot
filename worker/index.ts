import { groupToken, issueSession, parseStartParam, verifyGroupToken, verifyInitData, verifySession, playerFrom } from './telegram';
import type { SharedAction } from '../src/game/shared';
export { GroupRoom } from './room';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  BOT_APP_SHORT_NAME: string;
  LINK_SECRET: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}
interface BotMessage { text?: string; chat: { id: number; type: string } }
interface BotUpdate { message?: BotMessage; my_chat_member?: { chat: { id: number; type: string }; old_chat_member: { status: string }; new_chat_member: { status: string } } }
interface ChatMemberResponse { ok: boolean; result?: { status: string; is_member?: boolean } }

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function botCall(env: Env, method: string, body: object) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram ${method} returned HTTP ${response.status}`);
  const result = await response.json() as { ok: boolean };
  if (!result.ok) throw new Error(`Telegram ${method} failed`);
  return result;
}

function room(env: Env, chatId: number) { return env.ROOMS.get(env.ROOMS.idFromName(String(chatId))); }
function appLink(env: Env, startParam: string) {
  const username = env.BOT_USERNAME.replace(/^@/, '');
  const shortName = env.BOT_APP_SHORT_NAME;
  if (!/^[A-Za-z0-9_]+$/.test(shortName)) throw new Error('Invalid Mini App short name');
  return `https://t.me/${username}/${shortName}?startapp=${startParam}`;
}
function roomCall(env: Env, chatId: number, path: string, body: object) {
  return room(env, chatId).fetch(new Request(`https://room.internal${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
}

// Telegram only guarantees getChatMember for other users when the bot is an admin.
// A valid signed group launch link still permits regular-member bots to host games.
async function knownNonMember(env: Env, chatId: number, userId: number) {
  try {
    const result = await botCall(env, 'getChatMember', { chat_id: chatId, user_id: userId }) as ChatMemberResponse;
    return !result.result || ['left', 'kicked'].includes(result.result.status) || (result.result.status === 'restricted' && result.result.is_member === false);
  } catch {
    return false;
  }
}

async function handleWebhook(request: Request, env: Env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'Unauthorized' }, 401);
  const update = await request.json() as BotUpdate;
  const membership = update.my_chat_member;
  if (membership && ['group', 'supergroup'].includes(membership.chat.type) && !['left', 'kicked'].includes(membership.old_chat_member.status) && ['left', 'kicked'].includes(membership.new_chat_member.status)) {
    return roomCall(env, membership.chat.id, '/clear', {});
  }
  const message = update.message;
  if (!message || !['group', 'supergroup'].includes(message.chat.type)) return json({ ok: true });
  const command = /^\/(play|bridge)(?:@(\w+))?(?:\s|$)/i.exec(message.text ?? '');
  if (!command || (command[2] && command[2].toLowerCase() !== env.BOT_USERNAME.replace(/^@/, '').toLowerCase())) return json({ ok: true });
  const token = await groupToken(message.chat.id, env.LINK_SECRET);
  const link = appLink(env, token);
  await botCall(env, 'sendMessage', { chat_id: message.chat.id, text: 'Bridge Lah! Tap below to open your group table.', reply_markup: { inline_keyboard: [[{ text: 'Open Bridge Lah!', url: link }]] } });
  return json({ ok: true });
}

async function handleContext(request: Request, env: Env) {
  const raw = request.headers.get('Authorization')?.replace(/^tma\s+/i, '') ?? '';
  const launch = await verifyInitData(raw, env.BOT_TOKEN);
  if (!launch) return json({ error: 'Invalid Telegram launch' }, 401);
  const context = await parseStartParam(launch.startParam ?? '', env.LINK_SECRET);
  if (!context) return json({ error: 'Open the app from your group’s Bridge Lah! link' }, 400);
  if (await knownNonMember(env, context.chatId, launch.user.id)) return json({ error: 'Not a group member' }, 403);
  const token = await issueSession(launch.user, context.chatId, env.LINK_SECRET);
  const homeResponse = await roomCall(env, context.chatId, '/home', { session: { user: launch.user, chatId: context.chatId } });
  const home = await homeResponse.json() as { resumeId?: string };
  return json({ token, user: launch.user, groupToken: context.groupToken, startGameId: context.gameId, resumeId: home.resumeId ?? null });
}

async function handleApi(request: Request, env: Env, url: URL) {
  if (url.pathname === '/api/context' && request.method === 'GET') return handleContext(request, env);
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true });
  if (url.pathname === '/api/live' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    const context = await verifyGroupToken(url.searchParams.get('group') ?? '', env.LINK_SECRET);
    if (context === null) return json({ error: 'Invalid group link' }, 401);
    return room(env, context).fetch(new Request('https://room.internal/live', request));
  }
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const session = await verifySession(token, env.LINK_SECRET);
  if (!session) return json({ error: 'Session expired' }, 401);
  if (url.pathname === '/api/home' && request.method === 'GET') return roomCall(env, session.chatId, '/home', { session });
  if (url.pathname === '/api/leaderboard' && request.method === 'GET') return roomCall(env, session.chatId, '/leaderboard', { session });
  if (url.pathname === '/api/games' && request.method === 'POST') {
    if (await knownNonMember(env, session.chatId, session.user.id)) return json({ error: 'Not a group member' }, 403);
    const id = crypto.randomUUID().replace(/-/g, '');
    const response = await roomCall(env, session.chatId, '/create', { session, id, player: playerFrom(session.user) });
    if (!response.ok) return response;
    try {
      const link = appLink(env, `${await groupToken(session.chatId, env.LINK_SECRET)}__j_${id}`);
      await botCall(env, 'sendMessage', { chat_id: session.chatId, text: 'New Bridge Lah! game. Four seats—mai tu liao!', reply_markup: { inline_keyboard: [[{ text: 'Take a seat', url: link }]] } });
    } catch (error) {
      await roomCall(env, session.chatId, '/undo-create', { session, id });
      throw error;
    }
    const result = await response.json() as { state: unknown };
    return json({ ...result, id }, 201);
  }
  const match = /^\/api\/games\/([a-f0-9]{32})(?:\/(join|actions))?$/.exec(url.pathname);
  if (!match) return json({ error: 'Not found' }, 404);
  const [, id, operation] = match;
  if (!operation && request.method === 'GET') return roomCall(env, session.chatId, '/state', { session, id });
  if (operation === 'join' && request.method === 'POST') return roomCall(env, session.chatId, '/join', { session, id, player: playerFrom(session.user) });
  if (operation === 'actions' && request.method === 'POST') {
    const action = await request.json() as SharedAction;
    return roomCall(env, session.chatId, '/action', { session, id, action });
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/telegram/webhook' && request.method === 'POST') return handleWebhook(request, env);
      if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
      if (url.pathname.startsWith('/telegram/')) return json({ error: 'Not found' }, 404);
      const asset = await env.ASSETS.fetch(request);
      if (asset.ok && /^\/(cards|card-previews|card-fast|card-table|icons)\/.+\.(png|webp)$/i.test(url.pathname)) {
        const headers = new Headers(asset.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
      }
      return asset;
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Worker request failed');
      return json({ error: 'Service unavailable' }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
