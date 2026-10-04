import type { SharedGameView, SharedAction, SharedPlayer } from './shared';

interface TelegramWebApp {
  initData: string;
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

async function unpack<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string; spectate?: boolean };
  if (!response.ok) throw Object.assign(new Error(data.error ?? `Request failed (${response.status})`), { spectate: data.spectate === true });
  return data;
}

async function request(path: string, init: RequestInit, retry = false): Promise<Response> {
  try {
    const response = await fetch(path, init);
    if (!retry || response.status < 500) return response;
    await new Promise(resolve => setTimeout(resolve, 400));
    return fetch(path, init);
  }
  catch (error) {
    if (!retry) throw error;
    await new Promise(resolve => setTimeout(resolve, 400));
    return fetch(path, init);
  }
}

export async function connectTelegram(): Promise<LiveContext> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) throw new Error('Open Bridge Lah! inside Telegram.');
  webApp.ready(); webApp.expand();
  return unpack<LiveContext>(await request('/api/context', { headers: { Authorization: `tma ${webApp.initData}` }, cache: 'no-store' }, true));
}

export async function liveRequest<T>(context: LiveContext, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  return unpack<T>(await request(path, { method, headers: { Authorization: `Bearer ${context.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }, method === 'GET' || path.endsWith('/join')));
}

export const liveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}`);
export const joinLiveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}/join`, 'POST');
export const createLiveGame = (context: LiveContext) => liveRequest<{ id: string; state: SharedGameView }>(context, '/api/games', 'POST');
export const liveAction = (context: LiveContext, id: string, action: SharedAction) => liveRequest<{ state: SharedGameView | null }>(context, `/api/games/${id}/actions`, 'POST', action);
export const liveLeaderboard = (context: LiveContext) => liveRequest<{ scores: LeaderboardRecord[] }>(context, '/api/leaderboard');
