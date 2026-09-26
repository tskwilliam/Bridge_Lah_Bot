import type { SharedGameView, SharedAction, SharedPlayer } from './shared';

interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
}

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

export interface LiveContext {
  token: string;
  user: { id: number; first_name: string; username?: string; photo_url?: string };
  groupToken: string;
  startGameId: string | null;
  resumeId: string | null;
}
export interface LeaderboardRecord { player: SharedPlayer; wins: number; games: number }

export function inTelegram() { return Boolean(window.Telegram?.WebApp?.initData); }

async function unpack<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export async function connectTelegram(): Promise<LiveContext> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) throw new Error('Open Bridge Lah! inside Telegram.');
  webApp.ready(); webApp.expand();
  return unpack<LiveContext>(await fetch('/api/context', { headers: { Authorization: `tma ${webApp.initData}` }, cache: 'no-store' }));
}

export async function liveRequest<T>(context: LiveContext, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  return unpack<T>(await fetch(path, { method, headers: { Authorization: `Bearer ${context.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }));
}

export const liveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}`);
export const joinLiveGame = (context: LiveContext, id: string) => liveRequest<{ state: SharedGameView }>(context, `/api/games/${id}/join`, 'POST');
export const createLiveGame = (context: LiveContext) => liveRequest<{ id: string; state: SharedGameView }>(context, '/api/games', 'POST');
export const liveAction = (context: LiveContext, id: string, action: SharedAction) => liveRequest<{ state: SharedGameView | null }>(context, `/api/games/${id}/actions`, 'POST', action);
export const liveLeaderboard = (context: LiveContext) => liveRequest<{ scores: LeaderboardRecord[] }>(context, '/api/leaderboard');
