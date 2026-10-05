import type { SharedGameView, SharedAction, SharedPlayer } from './shared';

interface TelegramWebApp {
  initData: string;
  platform?: string;
  ready(): void;
  expand(): void;
}

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

export interface LiveContext {
  token: string;
  user: { id: number; username?: string; photo_url?: string };
  groupToken: string;
  startGameId: string | null;
  resumeId: string | null;
}
export interface LeaderboardRecord { player: SharedPlayer; wins: number; games: number }

export function inTelegram() { return Boolean(window.Telegram?.WebApp?.initData); }

export class RequestError extends Error {
  constructor(message: string, readonly status: number, readonly spectate = false) { super(message); }
}

async function request<T>(path: string, init: RequestInit, retry = false): Promise<T> {
  const delays = [250, 600, 1200];
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(path, { ...init, signal: controller.signal });
      // Reading the response is part of the attempt: a dropped response body
      // must be retried just like a connection that failed before the headers.
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string; spectate?: boolean };
        throw new RequestError(data.error ?? 'The game is temporarily unavailable.', response.status, data.spectate === true);
      }
      return await response.json() as T;
    } catch (error) {
      const transient = !(error instanceof RequestError) || error.status >= 500 || [408, 429].includes(error.status);
      if (!retry || !transient || attempt >= delays.length) throw error instanceof RequestError ? error : new RequestError('Connection interrupted. Please try again.', 0);
    } finally { clearTimeout(timeout); }
    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
  }
}

export async function connectTelegram(): Promise<LiveContext> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) throw new Error('Open Bridge Lah! inside Telegram.');
  webApp.ready(); webApp.expand();
  return request<LiveContext>('/api/context', { headers: { Authorization: `tma ${webApp.initData}` }, cache: 'no-store' }, true);
}

const renewals = new WeakMap<LiveContext, Promise<LiveContext>>();
async function authenticatedRequest<T>(context: LiveContext, path: string, init: RequestInit, retry: boolean): Promise<T> {
  const send = (token: string) => request<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }, retry);
  try { return await send(context.token); }
  catch (error) {
    if (!(error instanceof RequestError) || error.status !== 401 || typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) throw error;
    // Desktop sleep can suspend the ten-minute refresh timer past token expiry.
    // Renew once, preserving the action ID when retrying the original decision.
    let renewal = renewals.get(context);
    if (!renewal) {
      renewal = request<LiveContext>('/api/context', { headers: { Authorization: `tma ${window.Telegram.WebApp.initData}` }, cache: 'no-store' }, true).then(fresh => {
        if (fresh.user.id !== context.user.id || fresh.groupToken !== context.groupToken) throw new RequestError('Please reopen this game from your Telegram group.', 401);
        window.dispatchEvent(new CustomEvent('bridge-session-refreshed', { detail: fresh }));
        return fresh;
      }).finally(() => renewals.delete(context));
      renewals.set(context, renewal);
    }
    const fresh = await renewal;
    return send(fresh.token);
  }
}

export async function liveRequest<T>(context: LiveContext, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  return authenticatedRequest<T>(context, path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }, method === 'GET' || path.endsWith('/join'));
}

export const liveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}`);
export const joinLiveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}/join`, 'POST');
export const createLiveGame = (context: LiveContext) => liveRequest<{ id: string; state: SharedGameView }>(context, '/api/games', 'POST');
export const liveAction = (context: LiveContext, id: string, action: SharedAction, revision?: number, actionId = crypto.randomUUID()) => authenticatedRequest<{ state: SharedGameView | null }>(context, `/api/games/${id}/actions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Action-ID': actionId, ...(revision === undefined ? {} : { 'X-Game-Revision': String(revision) }) }, body: JSON.stringify(action), cache: 'no-store',
}, true);
export const liveLeaderboard = (context: LiveContext) => liveRequest<{ scores: LeaderboardRecord[] }>(context, '/api/leaderboard');
