import { applySharedAction, advanceSharedGame, GameActionError, newSharedGame, sharedView, type SharedAction, type SharedGame, type SharedPlayer, type SharedSettings } from '../src/game/shared';
import { playerFrom, verifySession, type GameSession } from './telegram';

interface RoomEnv { LINK_SECRET: string }
interface Scores { player: SharedPlayer; wins: number; games: number }
interface SocketAuth { type: 'auth'; token: string; gameId: string }
interface Attachment { gameId: string; userId: string; role?: 'player' | 'spectator'; player?: SharedPlayer }

const answer = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const gameKey = (id: string) => `game:${id}`;
const settingsKey = (id: string) => `settings:${id}`;
const scoreKey = (id: string) => `score:${id}`;

export class GroupRoom {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private ctx: DurableObjectState, private env: RoomEnv) {
    // Heartbeats are answered without waking the room, so clients can tell a dead connection from a quiet one.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async game(id: string) {
    if (!/^[a-f0-9]{32}$/.test(id)) return null;
    return await this.ctx.storage.get<SharedGame>(gameKey(id)) ?? null;
  }

  private async schedule() {
    const games = await this.ctx.storage.list<SharedGame>({ prefix: 'game:' });
    const due = [...games.values()].map(game => game.dueAt).filter((value): value is number => value !== null);
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
    else await this.ctx.storage.deleteAlarm();
  }

  // Everyone connected to this game without a seat is watching, once each, in the order they arrived.
  private spectators(game: SharedGame, except?: WebSocket): SharedPlayer[] {
    const seen = new Map<string, SharedPlayer>();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (attachment?.gameId !== game.id || attachment.role !== 'spectator' || !attachment.player) continue;
      if (game.seats.some(player => player?.id === attachment.userId)) continue;
      seen.set(attachment.userId, attachment.player);
    }
    return [...seen.values()];
  }

  private view(game: SharedGame, userId: string, except?: WebSocket) { return sharedView(game, userId, this.spectators(game, except)); }

  private sendState(game: SharedGame, userId: string, socket: WebSocket, except?: WebSocket) {
    try { socket.send(JSON.stringify({ type: 'state', state: this.view(game, userId, except) })); }
    catch { /* The player can reconnect and fetch the current state. */ }
  }

  private broadcast(game: SharedGame, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (attachment?.gameId !== game.id) continue;
      if (game.seats.some(player => player?.id === attachment.userId)) {
        // A spectator who took a seat becomes a player here, and is told if they are removed later.
        if (attachment.role !== 'player') socket.serializeAttachment({ ...attachment, role: 'player' } satisfies Attachment);
        this.sendState(game, attachment.userId, socket, except);
      } else if (attachment.role === 'spectator') this.sendState(game, attachment.userId, socket, except);
      else { try { socket.send(JSON.stringify({ type: 'removed' })); socket.close(1000, 'Left game'); } catch { /* Closed already. */ } }
    }
  }

  private async save(previous: SharedGame | null, game: SharedGame): Promise<SharedGame> {
    const saved = { ...game, revision: (previous?.revision ?? -1) + 1 };
    if (saved.seats.every(player => !player)) await this.ctx.storage.delete(gameKey(saved.id));
    else await this.ctx.storage.put(gameKey(saved.id), saved);
    // Players see the move as soon as it is stored; scores and the alarm are bookkeeping.
    this.broadcast(saved);
    if (previous) for (const player of previous.seats) {
      if (!player) continue;
      const extraGames = (game.games[player.id] ?? 0) - (previous.games[player.id] ?? 0);
      const extraWins = (game.wins[player.id] ?? 0) - (previous.wins[player.id] ?? 0);
      if (!extraGames && !extraWins) continue;
      const record = await this.ctx.storage.get<Scores>(scoreKey(player.id)) ?? { player, wins: 0, games: 0 };
      await this.ctx.storage.put(scoreKey(player.id), { player, wins: record.wins + extraWins, games: record.games + extraGames });
    }
    await this.schedule();
    return saved;
  }

  private async fresh(id: string) {
    const game = await this.game(id);
    if (!game) return null;
    const advanced = advanceSharedGame(game, Date.now());
    return advanced !== game ? this.save(game, advanced) : game;
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/clear' && request.method === 'POST') return this.serial(async () => {
      await this.ctx.storage.deleteAll();
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(JSON.stringify({ type: 'removed' })); socket.close(1000, 'Bot left group'); } catch { /* Socket already closed. */ }
      }
      return answer({ ok: true });
    });
    if (path === '/live' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    let body: { session: GameSession; id?: string; player?: SharedPlayer; action?: SharedAction; actionId?: string | null; revision?: number };
    try { body = await request.json() as typeof body; } catch { return answer({ error: 'Invalid request' }, 400); }
    if (!body.session || !Number.isSafeInteger(body.session.chatId) || !Number.isSafeInteger(body.session.user?.id)) return answer({ error: 'Unauthorized' }, 401);
    const userId = String(body.session.user.id);
    return this.serial(async () => {
      try {
        if (path === '/home') {
          const games = await this.ctx.storage.list<SharedGame>({ prefix: 'game:' });
          const active = [...games.values()].filter(game => game.seats.some(player => player?.id === userId)).sort((a, b) => b.updatedAt - a.updatedAt);
          return answer({ resumeId: active[0]?.id ?? null });
        }
        if (path === '/leaderboard') {
          const scores = await this.ctx.storage.list<Scores>({ prefix: 'score:' });
          return answer({ scores: [...scores.values()] });
        }
        if (path === '/create') {
          if (!body.id || !/^[a-f0-9]{32}$/.test(body.id) || !body.player || body.player.id !== userId) return answer({ error: 'Invalid game' }, 400);
          if (await this.game(body.id)) return answer({ error: 'Game already exists' }, 409);
          const settings = await this.ctx.storage.get<SharedSettings>(settingsKey(userId)) ?? { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 };
          const game = await this.save(null, newSharedGame(body.id, body.session.chatId, body.player, settings, Date.now()));
          return answer({ state: this.view(game, userId) }, 201);
        }
        if (!body.id) return answer({ error: 'Game ID required' }, 400);
        const game = await this.fresh(body.id);
        if (!game || game.groupId !== body.session.chatId) return answer({ error: 'Game not found' }, 404);
        if (path === '/undo-create') {
          if (game.seats[0]?.id === userId && game.phase === 'waiting' && game.seats.filter(Boolean).length === 1) {
            await this.ctx.storage.delete(gameKey(game.id)); await this.schedule();
          }
          return answer({ ok: true });
        }
        if (path === '/join') {
          if (!body.player || body.player.id !== userId) return answer({ error: 'Invalid player' }, 400);
          const next = applySharedAction(game, userId, { type: 'join', player: body.player }, Date.now());
          const committed = next !== game ? await this.save(game, next) : game;
          return answer({ state: this.view(committed, userId) });
        }
        if (path === '/state') return answer({ state: this.view(game, userId) });
        if (path === '/action') {
          if (!body.action || typeof body.action.type !== 'string') return answer({ error: 'Action required' }, 400);
          if (body.actionId && !/^[a-zA-Z0-9-]{16,80}$/.test(body.actionId)) return answer({ error: 'Invalid action ID' }, 400);
          const actionText = JSON.stringify(body.action);
          const receipt = game.actionReceipts?.find(item => item.id === body.actionId && item.userId === userId);
          if (receipt) {
            if (receipt.action !== actionText) return answer({ error: 'Action ID already used' }, 409);
            return answer({ state: game.seats.some(player => player?.id === userId) ? this.view(game, userId) : null });
          }
          if (body.revision !== undefined && (!Number.isSafeInteger(body.revision) || body.revision !== game.revision)) return answer({ error: 'The table changed. Please choose your move again.' }, 409);
          let next = applySharedAction(game, userId, body.action, Date.now());
          // The receipt and move share a single durable write. Retrying a lost
          // acknowledgement can never replay a bid, card, swap, or round start.
          if (body.actionId) next = { ...next, actionReceipts: [...(game.actionReceipts ?? []).slice(-127), { id: body.actionId, userId, action: actionText }] };
          let committed = next;
          if (next !== game) {
            if (body.action.type === 'start') {
              const settings: SharedSettings = { breakTrump: next.breakTrump, reshuffleEnabled: next.reshuffleEnabled, reshuffleThreshold: next.reshuffleThreshold };
              await Promise.all(next.seats.filter((player): player is SharedPlayer => player !== null).map(player => this.ctx.storage.put(settingsKey(player.id), settings)));
            }
            committed = await this.save(game, next);
          }
          return answer({ state: committed.seats.some(player => player?.id === userId) ? this.view(committed, userId) : null });
        }
        return answer({ error: 'Not found' }, 404);
      } catch (error) {
        if (error instanceof GameActionError) return answer({ error: error.message, ...(error.code === 'started' ? { spectate: true } : {}) }, 409);
        console.error(error instanceof Error ? error.message : 'Room failed');
        return answer({ error: 'Game unavailable' }, 503);
      }
    });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    await this.serial(async () => {
      if (typeof data !== 'string' || socket.deserializeAttachment()) return;
      let message: SocketAuth;
      try { message = JSON.parse(data) as SocketAuth; } catch { socket.close(1008, 'Invalid message'); return; }
      if (message.type !== 'auth' || typeof message.token !== 'string' || typeof message.gameId !== 'string') { socket.close(1008, 'Unauthorized'); return; }
      const session = await verifySession(message.token, this.env.LINK_SECRET);
      const game = await this.fresh(message.gameId);
      if (!session || !game || session.chatId !== game.groupId) { socket.close(1008, 'Unauthorized'); return; }
      // Any member of the group may watch; being seated decides which view they get.
      const seated = game.seats.some(player => player?.id === String(session.user.id));
      socket.serializeAttachment({ gameId: game.id, userId: String(session.user.id), role: seated ? 'player' : 'spectator', ...(seated ? {} : { player: playerFrom(session.user) }) } satisfies Attachment);
      // Arriving spectators change what everyone sees, so tell the whole table.
      if (seated) this.sendState(game, String(session.user.id), socket); else this.broadcast(game);
    });
  }

  // A spectator leaving updates the list for everyone still at the table.
  private async spectatorLeft(socket: WebSocket) {
    await this.serial(async () => {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (attachment?.role !== 'spectator') return;
      const game = await this.game(attachment.gameId);
      if (game) this.broadcast(game, socket);
    });
  }

  async webSocketClose(socket: WebSocket) { await this.spectatorLeft(socket); }
  async webSocketError(socket: WebSocket) { await this.spectatorLeft(socket); }

  async alarm() {
    await this.serial(async () => {
      const games = await this.ctx.storage.list<SharedGame>({ prefix: 'game:' });
      for (const game of games.values()) {
        const next = advanceSharedGame(game, Date.now());
        if (next !== game) await this.save(game, next);
      }
      await this.schedule();
    });
  }
}
