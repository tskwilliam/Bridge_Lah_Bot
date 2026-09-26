export interface TelegramUser {
  id: number;
  username?: string;
  photo_url?: string;
}

export interface VerifiedLaunch {
  user: TelegramUser;
  startParam?: string;
}

export interface GameSession {
  user: TelegramUser;
  chatId: number;
  expiresAt: number;
}

const encoder = new TextEncoder();

async function hmac(key: Uint8Array<ArrayBuffer>, message: string): Promise<Uint8Array<ArrayBuffer>> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(message)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64url(text: string) {
  const bytes = encoder.encode(text);
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** Verify Telegram's raw Mini App initData before trusting any identity or chat field. */
export async function verifyInitData(raw: string, botToken: string, now = Date.now()): Promise<VerifiedLaunch | null> {
  if (!raw || raw.length > 16_384) return null;
  const params = new URLSearchParams(raw);
  const keys = Array.from(params.keys());
  if (new Set(keys).size !== keys.length) return null;
  const suppliedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash) || !Number.isSafeInteger(authDate)) return null;
  const age = Math.floor(now / 1000) - authDate;
  if (age < -60 || age > 24 * 60 * 60) return null;
  const userText = params.get('user');
  if (!userText) return null;
  let rawUser: TelegramUser & { first_name?: unknown };
  try { rawUser = JSON.parse(userText) as typeof rawUser; } catch { return null; }
  if (!rawUser || typeof rawUser !== 'object' || !Number.isSafeInteger(rawUser.id) || rawUser.id <= 0 || typeof rawUser.first_name !== 'string') return null;
  if (rawUser.username !== undefined && typeof rawUser.username !== 'string') return null;
  if (rawUser.photo_url !== undefined && typeof rawUser.photo_url !== 'string') return null;
  const check = keys.filter(key => key !== 'hash').sort().map(key => `${key}=${params.get(key)}`).join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const expected = hex(await hmac(secret, check));
  if (!sameHash(expected, suppliedHash.toLowerCase())) return null;
  const user: TelegramUser = { id: rawUser.id, username: rawUser.username, photo_url: rawUser.photo_url };
  return { user, startParam: params.get('start_param') ?? undefined };
}

/** An opaque group link token that can be verified without storing a chat mapping. */
export async function groupToken(chatId: number, secret: string) {
  const id = String(chatId);
  const signature = hex(await hmac(encoder.encode(secret), `group:${id}`)).slice(0, 24);
  return `g_${id}_${signature}`;
}

export async function verifyGroupToken(token: string, secret: string): Promise<number | null> {
  const match = /^g_(-?\d+)_([a-f0-9]{24})$/.exec(token);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) return null;
  const expected = await groupToken(id, secret);
  return sameHash(expected, token) ? id : null;
}

export async function parseStartParam(value: string, secret: string) {
  const match = /^(g_-?\d+_[a-f0-9]{24})(?:__j_([a-f0-9]{32}))?$/.exec(value);
  if (!match) return null;
  const chatId = await verifyGroupToken(match[1], secret);
  return chatId === null ? null : { chatId, groupToken: match[1], gameId: match[2] ?? null };
}

export async function issueSession(user: TelegramUser, chatId: number, secret: string, now = Date.now()) {
  const payload = base64url(JSON.stringify({ user, chatId, expiresAt: now + 15 * 60 * 1000 } satisfies GameSession));
  const signature = hex(await hmac(encoder.encode(secret), `session:${payload}`));
  return `${payload}.${signature}`;
}

export async function verifySession(value: string, secret: string, now = Date.now()): Promise<GameSession | null> {
  const match = /^([A-Za-z0-9_-]{1,2048})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const signature = hex(await hmac(encoder.encode(secret), `session:${match[1]}`));
  if (!sameHash(signature, match[2])) return null;
  try {
    const session = JSON.parse(fromBase64url(match[1])) as GameSession;
    if (!session || !session.user || !Number.isSafeInteger(session.user.id) || !Number.isSafeInteger(session.chatId) || !Number.isSafeInteger(session.expiresAt) || session.expiresAt < now) return null;
    return session;
  } catch { return null; }
}
