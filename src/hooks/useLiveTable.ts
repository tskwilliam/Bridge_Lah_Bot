import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!context) return;
    let active = true;
    let removed = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    const update = (state: SharedGameView) => setView(current => !current || state.revision >= current.revision ? state : current);
    const connect = () => {
      if (!active || removed) return;
      const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${scheme}//${location.host}/api/live?group=${encodeURIComponent(context.groupToken)}`);
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'auth', token: context.token, gameId }));
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as { type: string; state?: SharedGameView };
          if (!active) return;
          if (message.type === 'state' && message.state) { update(message.state); setError(''); }
          if (message.type === 'removed') { removed = true; setView(null); setError('You have left this game.'); socket?.close(); }
        } catch { /* Ignore malformed connection messages. */ }
      };
      socket.onclose = () => { if (active && !removed) retry = window.setTimeout(connect, 1800); };
    };
    joinLiveGame(context, gameId).then(result => {
      if (!active) return;
      update(result.state); setError(''); connect();
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not join the game.'); });
    const resume = () => {
      if (!active || removed || document.visibilityState !== 'visible') return;
      liveGame(context, gameId).then(result => { if (active) update(result.state); }).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; document.removeEventListener('visibilitychange', resume); if (retry) clearTimeout(retry); socket?.close(); };
  }, [context?.token, context?.groupToken, gameId]);

  async function send(action: SharedAction) {
    if (!context) return;
    try {
      const result = await liveAction(context, gameId, action);
      if (result.state) setView(current => !current || result.state!.revision >= current.revision ? result.state : current);
      else setView(null);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Move could not be saved.'); }
  }

  if (!view || !context) return { table: null as Table | null, error };
  const canonical = (visual: number) => (view.seatIndex + visual) % 4;
  const memberList = view.seats.filter((player): player is NonNullable<typeof player> => player !== null).map(player => ({ ...player, wins: view.wins[player.id] ?? 0 }));
  const table: Table = {
    ...fallback,
    members: memberList,
    viewerId: String(context.user.id), wins: view.wins, games: view.games, isDealer: view.isDealer,
    phase: view.phase, seats: view.seats.map(player => player?.id ?? null), dealerId: view.dealerId,
    round: view.round, bid: view.bid, declarer: view.declarer, partner: view.partner, partnerSeat: view.partnerSeat,
    declarerHand: view.declarerHand, cards: sortCards(view.cards), selected, active: view.active,
    plays: view.plays, counts: view.counts, trickStatus: view.trickStatus, winner: view.winner,
    bids: view.bids, highestBid: view.highestBid, biddingBusy: view.biddingBusy,
    breakTrump: view.breakTrump, reshuffleEnabled: view.reshuffleEnabled, reshuffleThreshold: view.reshuffleThreshold,
    shuffling: view.shuffling, shuffleReveal: view.shuffleReveal, canReshuffle: view.canReshuffle,
    goal: view.goal, outcome: view.outcome, validIds: view.validIds, ready: view.ready, notice: view.notice,
    callPartner: (card: Card) => { void send({ type: 'partner', card }); },
    placeBid: bid => { void send({ type: 'bid', bid }); },
    tapCard: id => {
      if (view.phase !== 'playing' || view.active !== 0 || !view.validIds.includes(id)) return;
      if (selected !== id) setSelected(id);
      else { setSelected(null); void send({ type: 'play', cardId: id }); }
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
  return { table, error };
}
