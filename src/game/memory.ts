export interface PlayerSettings {
  breakTrump: boolean;
  reshuffleEnabled: boolean;
  reshuffleThreshold: number;
}

export interface ActiveGameRecord {
  version: number;
  seats: (string | null)[];
  activePlayers: string[];
  savedAt?: number;
  wins: Record<string, number>;
  games: Record<string, number>;
}

const gameKey = (id: string) => `bridge-session:${id}`;
const resumeKey = (id: string) => `bridge-resume:${id}`;
const settingsKey = (id: string) => `bridge-settings:${id}`;

export function playerSettings(id: string): PlayerSettings {
  const defaults = { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 };
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey(id)) ?? 'null') as Partial<PlayerSettings> | null;
    const threshold = saved?.reshuffleThreshold;
    return {
      breakTrump: typeof saved?.breakTrump === 'boolean' ? saved.breakTrump : defaults.breakTrump,
      reshuffleEnabled: typeof saved?.reshuffleEnabled === 'boolean' ? saved.reshuffleEnabled : defaults.reshuffleEnabled,
      reshuffleThreshold: typeof threshold === 'number' && Number.isInteger(threshold) && threshold >= 1 && threshold <= 5 ? threshold : defaults.reshuffleThreshold,
    };
  } catch { return defaults; }
}

export function rememberPlayerSettings(id: string, settings: PlayerSettings) {
  localStorage.setItem(settingsKey(id), JSON.stringify(settings));
}

export function readActiveGame(id: string): ActiveGameRecord | null {
  try {
    const game = JSON.parse(sessionStorage.getItem(gameKey(id)) ?? 'null') as ActiveGameRecord | null;
    if (!game || !Array.isArray(game.seats)) return null;
    if (game.version === 2) {
      const activePlayers: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('bridge-resume:') && sessionStorage.getItem(key) === id && game.seats.includes(key.slice('bridge-resume:'.length))) activePlayers.push(key.slice('bridge-resume:'.length));
      }
      const upgraded = { ...game, version: 3, activePlayers };
      if (activePlayers.length) { saveActiveGame(id, upgraded); return upgraded; }
      closeGame(id, upgraded);
      return null;
    }
    if (game.version !== 3 || !Array.isArray(game.activePlayers)) return null;
    const activePlayers = game.activePlayers.filter(player => typeof player === 'string' && game.seats.includes(player));
    if (activePlayers.length) {
      if (activePlayers.length === game.activePlayers.length) return game;
      const normalized = { ...game, activePlayers };
      saveActiveGame(id, normalized);
      return normalized;
    }
    closeGame(id, game);
    return null;
  } catch { return null; }
}

export function saveActiveGame(id: string, game: ActiveGameRecord) {
  sessionStorage.setItem(gameKey(id), JSON.stringify({ ...game, savedAt: Date.now() }));
}

export function forgetPlayerInGame(id: string, player: string) {
  if (sessionStorage.getItem(resumeKey(player)) === id) sessionStorage.removeItem(resumeKey(player));
}

export function closeGame(id: string, game: ActiveGameRecord) {
  if (Object.values(game.games).some(Boolean)) {
    sessionStorage.setItem(`bridge-results:${id}`, JSON.stringify({ wins: game.wins, games: game.games }));
  }
  sessionStorage.removeItem(gameKey(id));
  sessionStorage.removeItem(`bridge-host:${id}`);
  sessionStorage.removeItem(`bridge-reshuffle-test:${id}`);
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('bridge-resume:') && sessionStorage.getItem(key) === id) sessionStorage.removeItem(key);
  }
}

export function resumableGame(player: string): string | null {
  const latest = sessionStorage.getItem(resumeKey(player));
  if (latest && readActiveGame(latest)?.activePlayers.includes(player)) return latest;
  if (latest) sessionStorage.removeItem(resumeKey(player));
  let found: { id: string; time: number } | null = null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith('bridge-session:')) continue;
    const game = readActiveGame(key.slice('bridge-session:'.length));
    if (!game?.activePlayers.includes(player)) continue;
    if (!found || (game.savedAt ?? 0) > found.time) found = { id: key.slice('bridge-session:'.length), time: game.savedAt ?? 0 };
  }
  if (found) sessionStorage.setItem(resumeKey(player), found.id);
  return found?.id ?? null;
}
