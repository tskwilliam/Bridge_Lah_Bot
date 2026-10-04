import { useEffect, useRef, useState } from 'react';
import { sortCards } from '../game/bidding';
import { joinLiveGame, liveAction, liveGame, type LiveContext } from '../game/telegram';
import type { SharedAction, SharedGameView } from '../game/shared';
import type { Card } from '../types/game';
import type { useTablePreview } from './useTablePreview';

type Table = ReturnType<typeof useTablePreview>;

export function useLiveTable(gameId: string, context: LiveContext | undefined, fallback: Table) {
  const [view, setView] = useState<SharedGameView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    if (!context) return;
    let active = true;
    let removed = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let failures = 0;
    let heardAt = Date.now();
    const update = (state: SharedGameView) => setView(current => !current || state.revision >= current.revision ? state : current);
    const connect = () => {
      if (!active || removed) return;
      const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const current = new WebSocket(`${scheme}//${location.host}/api/live?group=${encodeURIComponent(context.groupToken)}`);
      socket = current;
      heardAt = Date.now();
      current.onopen = () => { failures = 0; current.send(JSON.stringify({ type: 'auth', token: context.token, gameId })); };
      current.onmessage = event => {
        heardAt = Date.now();
        if (event.data === 'pong') return;
        try {
          const message = JSON.parse(event.data) as { type: string; state?: SharedGameView };
          if (!active) return;
          if (message.type === 'state' && message.state) { update(message.state); setError(''); }
          if (message.type === 'removed') { removed = true; setView(null); setError('You have left this game.'); current.close(); }
        } catch { /* Ignore malformed connection messages. */ }
      };
      current.onclose = () => { if (active && !removed && socket === current) retry = window.setTimeout(connect, Math.min(300 * 2 ** failures++, 3000)); };
    };
    // A phone that slept leaves the socket looking open while nothing arrives, so drop it and start again.
    const reconnect = () => {
      if (!active || removed) return;
      if (retry) clearTimeout(retry);
      const old = socket;
      socket = null;
      if (old) { old.onclose = null; old.close(); }
      failures = 0;
      connect();
    };
    joinLiveGame(context, gameId).then(result => {
      if (!active) return;
      update(result.state); setError(''); connect();
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not join the game.'); });
    const resume = () => {
      if (!active || removed || document.visibilityState !== 'visible') return;
      liveGame(context, gameId).then(result => { if (active) update(result.state); }).catch(() => undefined);
      if (!socket || socket.readyState !== WebSocket.OPEN || Date.now() - heardAt > 20000) reconnect();
    };
    const beat = window.setInterval(() => {
      if (!active || removed || !socket || socket.readyState !== WebSocket.OPEN) return;
      if (Date.now() - heardAt > 20000) { reconnect(); return; }
      try { socket.send('ping'); } catch { reconnect(); }
    }, 8000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    return () => {
      active = false; clearInterval(beat); if (retry) clearTimeout(retry);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('focus', resume);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [context?.token, context?.groupToken, gameId]);

  async function send(action: SharedAction) {
    if (!context || sending.current) return;
    sending.current = true;
    setPending(true);
    try {
      const result = await liveAction(context, gameId, action);
      if (result.state) setView(current => !current || result.state!.revision >= current.revision ? result.state : current);
      else setView(null);
      setError('');
    } catch (reason) {
      try {
        const latest = await liveGame(context, gameId);
        setView(latest.state);
        if (view && latest.state.revision > view.revision) { setError(''); return; }
      } catch { /* Keep the last known table. */ }
      setError(reason instanceof Error ? reason.message : 'Move could not be saved.');
    } finally { sending.current = false; setPending(false); }
  }

  if (!view || !context) return { table: null as Table | null, error, pending };
  const canonical = (visual: number) => (view.seatIndex + visual) % 4;
  const memberList = view.seats.filter((player): player is NonNullable<typeof player> => player !== null).map(player => ({ ...player, wins: view.wins[player.id] ?? 0 }));
  const table: Table = {
    ...fallback,
    members: memberList,
    viewerId: String(context.user.id), wins: view.wins, games: view.games, isDealer: view.isDealer,
    phase: view.phase, seats: view.seats.map(player => player?.id ?? null), dealerId: view.dealerId,
    round: view.round, bid: view.bid, declarer: view.declarer, partner: view.partner, partnerSeat: view.partnerSeat, announcementUntil: view.announcementUntil,
    declarerHand: view.declarerHand, cards: sortCards(view.cards), selected, active: view.active,
    plays: view.plays, counts: view.counts, trickStatus: view.trickStatus, winner: view.winner,
    bids: view.bids, highestBid: view.highestBid, biddingBusy: view.biddingBusy,
    breakTrump: view.breakTrump, reshuffleEnabled: view.reshuffleEnabled, reshuffleThreshold: view.reshuffleThreshold,
    shuffling: view.shuffling, shuffleReveal: view.shuffleReveal, canReshuffle: view.canReshuffle,
    goal: view.goal, outcome: view.outcome, validIds: view.validIds, ready: view.ready, notice: view.notice,
    callPartner: (card: Card) => { void send({ type: 'partner', card }); },
    placeBid: bid => { void send({ type: 'bid', bid }); },
    tapCard: id => {
      if (sending.current || view.phase !== 'playing' || (view.announcementUntil !== null && Date.now() < view.announcementUntil) || !view.validIds.includes(id)) return;
      if (selected !== id) setSelected(id);
      else if (view.active === 0) { setSelected(null); void send({ type: 'play', cardId: id }); }
    },
    restart: () => { void send({ type: 'restart' }); },
    start: () => { void send({ type: 'start' }); },
    removeSeat: index => { void send({ type: 'kick', seat: canonical(index) }); },
    quit: () => { void send({ type: 'quit' }); },
    fillSeat: () => undefined,
    swapSeats: (from, to) => { void send({ type: 'swap', from: canonical(from), to: canonical(to) }); },
    toggleBreakTrump: () => { void send({ type: 'breakTrump', enabled: !view.breakTrump }); },
    toggleReshuffle: () => { void send({ type: 'reshuffleSetting', enabled: !view.reshuffleEnabled, threshold: view.reshuffleThreshold }); },
    setReshuffleThreshold: threshold => { void send({ type: 'reshuffleSetting', enabled: view.reshuffleEnabled, threshold }); },
    requestReshuffle: () => { void send({ type: 'reshuffle' }); },
  };
  return { table, error, pending };
}
