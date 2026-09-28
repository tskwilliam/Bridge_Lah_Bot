import { useEffect, useState } from 'react';
import { members, previewHands } from '../game/preview';
import { legalCards, roundOutcome, targets, trickWinner, trumpWonTrick, type Play } from '../game/round';
import { auctionCall, lowestBid, newAuction, sortCards, suggestPartner } from '../game/bidding';
import { dealHands, dealWeakPreviewHand, handStrength, relativeSeat } from '../game/deal';
import { closeGame, forgetPlayerInGame, playerSettings, rememberPlayerSettings, saveActiveGame } from '../game/memory';
import type { Bid, Card, GamePhase } from '../types/game';
export const TRICK_PAUSE_MS = 2200;
const viewerFromUrl = () => new URLSearchParams(location.search).get('viewer') ?? 'you';
export function useTablePreview(gameId: string, initialPhase: GamePhase, embedded: boolean) {
  const viewerId = embedded ? 'you' : members.some(m => m.id === viewerFromUrl()) ? viewerFromUrl() : 'you';
  const key = 'bridge-session:' + gameId;
  function fresh() {
    const testReshuffle = !embedded && import.meta.env.DEV && sessionStorage.getItem(`bridge-reshuffle-test:${gameId}`) === viewerId;
    const testSeat = members.findIndex(member => member.id === viewerId);
    const hands = embedded ? previewHands() : testReshuffle ? dealWeakPreviewHand(testSeat) : dealHands();
    const settings = embedded ? { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 } : playerSettings(viewerId);
    const bid: Bid = { level: 3, suit: 'spades' };
    const partner = suggestPartner(hands[0], bid);
    return { version: 3, phase: initialPhase, seats: ['you', 'marcus', 'rachel', 'wei'] as (string | null)[], activePlayers: [viewerId], dealerId: viewerId, round: 1, bid, declarer: 0, partner,
      partnerSeat: hands.findIndex(h => h.some(c => c.id === partner.id)), announcementUntil: null as number | null, hands, selected: null as string | null, playTurn: initialPhase === 'playing' ? 1 : 0,
      plays: [] as Play[], counts: initialPhase === 'ended' ? [9, 0, 0, 0] : [0, 0, 0, 0], trickStatus: 'playing' as 'playing' | 'holding' | 'collecting', winner: null as number | null,
      bids: [null, null, null, null] as (Bid | 'Pass' | null)[], auction: newAuction(0), sampleRaiseUsed: false, breakTrump: settings.breakTrump, trumpBroken: false,
      reshuffleEnabled: testReshuffle || settings.reshuffleEnabled, reshuffleThreshold: settings.reshuffleThreshold, testReshuffle: (testReshuffle ? 'initial' : null) as 'initial' | 'after-first' | 'done' | null, testSeat,
      shuffling: false, shuffleReveal: false, notice: '', wins: Object.fromEntries(members.map(m => [m.id, 0])), games: Object.fromEntries(members.map(m => [m.id, 0])) };
  }
  const [s, set] = useState(() => { if (!embedded) { try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as ReturnType<typeof fresh> | null;
    if (saved?.version === 3 && Array.isArray(saved.activePlayers)) return saved.seats.includes(viewerId) && !saved.activePlayers.includes(viewerId) ? { ...saved, activePlayers: [...saved.activePlayers, viewerId] } : saved;
    // Upgrade local previews created before active membership was recorded.
    if (saved?.version === 2 && saved.seats.includes(viewerId)) return { ...saved, version: 3, activePlayers: [viewerId] };
  } catch { /* Start a new local session if storage is unavailable. */ } } return fresh(); });
  const own = s.seats.indexOf(viewerId);
  const origin = Math.max(0, own);
  const visual = (seat: number) => relativeSeat(seat, origin);
  const canonical = (seat: number) => (seat + origin) % 4;
  const rotate = <T,>(items: T[]) => Array.from({ length: 4 }, (_, i) => items[canonical(i)]);
  const dealer = s.dealerId === viewerId && own >= 0;
  const active = s.phase === 'bidding' ? s.auction.turn : s.playTurn;
  const trumpRule = { trump: s.bid.suit, breakTrump: s.breakTrump, trumpBroken: s.trumpBroken };
  const outcome = roundOutcome(s.counts, s.declarer, s.partnerSeat, s.bid.level);
  const ready = s.seats.every(Boolean);
  const validIds = own < 0 ? [] : legalCards(s.hands[own], s.plays, trumpRule).map(c => c.id);
  const canReshuffle = own >= 0 && s.phase === 'bidding' && !s.shuffling && s.bids[own] === null && s.reshuffleEnabled && handStrength(s.hands[own]) < s.reshuffleThreshold;
  useEffect(() => {
    if (embedded || !s.activePlayers.some(id => s.seats.includes(id))) return;
    saveActiveGame(gameId, s);
    if (own >= 0 && s.activePlayers.includes(viewerId)) sessionStorage.setItem('bridge-resume:' + viewerId, gameId);
  }, [s, gameId, embedded, viewerId, own]);
  function reset(next: typeof s, phase: GamePhase = 'waiting'): typeof s {
    return { ...next, phase, hands: dealHands(), selected: null, plays: [], counts: [0, 0, 0, 0], trickStatus: 'playing', winner: null, announcementUntil: null, bids: [null, null, null, null], auction: newAuction(Math.max(0, next.seats.indexOf(next.dealerId))), sampleRaiseUsed: false, trumpBroken: false, shuffling: false, shuffleReveal: false, notice: '' };
  }
  function submitBid(value: Bid | null, seat: number) {
    set(prev => {
      if (prev.phase !== 'bidding' || prev.shuffling) return prev;
      const auction = auctionCall(prev.auction, seat, value); if (auction === prev.auction) return prev;
      let next = { ...prev, auction, bids: prev.bids.map((b, i) => i === seat ? value ?? 'Pass' : b), sampleRaiseUsed: prev.sampleRaiseUsed || (seat !== own && value !== null) };
      if (auction.complete && auction.highest && auction.bidder !== null) {
        const partner = suggestPartner(prev.hands[auction.bidder], auction.highest);
        next = { ...next, bid: auction.highest, declarer: auction.bidder, partner, partnerSeat: prev.hands.findIndex(h => h.some(c => c.id === partner.id)), phase: 'partner' };
      } else if (auction.allPassed) next = { ...reset(next), notice: 'Everyone passed. Ready for another deal?' };
      return next;
    });
  }
  useEffect(() => {
    if (s.phase !== 'bidding' || active === own || s.auction.complete || s.shuffling || own < 0) return;
    const timer = window.setTimeout(() => submitBid(!s.sampleRaiseUsed ? lowestBid(s.auction.highest) : null, active), 900);
    return () => clearTimeout(timer);
  }, [s.phase, active, own, s.auction, s.sampleRaiseUsed, s.shuffling]);
  function callPartner(card: Card) {
    set(prev => {
      if (prev.phase !== 'partner' || prev.hands[prev.declarer].some(c => c.id === card.id)) return prev;
      return { ...prev, partner: card, partnerSeat: prev.hands.findIndex(h => h.some(c => c.id === card.id)), announcementUntil: Date.now() + 3000, playTurn: (prev.declarer + 1) % 4, phase: 'playing' };
    });
  }
  useEffect(() => { if (s.phase !== 'partner' || s.declarer === own || own < 0) return; const timer = window.setTimeout(() => callPartner(s.partner), 1200); return () => clearTimeout(timer); }, [s.phase, s.declarer, own, s.partner]);
  function playCard(seat: number, card: Card) {
    set(prev => {
      if (prev.phase !== 'playing' || seat !== prev.playTurn || prev.trickStatus !== 'playing' || (prev.announcementUntil !== null && Date.now() < prev.announcementUntil) || !legalCards(prev.hands[seat], prev.plays, { trump: prev.bid.suit, breakTrump: prev.breakTrump, trumpBroken: prev.trumpBroken }).some(c => c.id === card.id)) return prev;
      const plays = [...prev.plays, { seat, card }];
      return { ...prev, hands: prev.hands.map((h, i) => i === seat ? h.filter(c => c.id !== card.id) : h), plays, selected: seat === own ? null : prev.selected, trickStatus: plays.length === 4 ? 'holding' : 'playing', playTurn: plays.length === 4 ? seat : (seat + 1) % 4 };
    });
  }
  useEffect(() => { if (s.phase !== 'playing' || s.trickStatus !== 'playing' || active === own || own < 0) return; const timer = window.setTimeout(() => { const card = legalCards(s.hands[active], s.plays, trumpRule)[0]; if (card) playCard(active, card); }, Math.max(900, (s.announcementUntil ?? 0) - Date.now() + 900)); return () => clearTimeout(timer); }, [s.phase, active, own, s.plays, s.hands, s.trickStatus, s.announcementUntil]);
  useEffect(() => {
    if (s.phase !== 'playing' || s.plays.length !== 4 || own < 0) return;
    const timer = window.setTimeout(() => set(prev => {
      if (prev.phase !== 'playing' || prev.plays.length !== 4) return prev;
      const winner = trickWinner(prev.plays, prev.bid.suit);
      if (prev.trickStatus === 'holding') return { ...prev, winner, trickStatus: 'collecting' };
      const counts = prev.counts.map((n, i) => n + Number(i === winner));
      const result = roundOutcome(counts, prev.declarer, prev.partnerSeat, prev.bid.level);
      const wins = { ...prev.wins }, games = { ...prev.games };
      if (result) prev.seats.forEach((id, seat) => { if (!id) return; games[id] = (games[id] ?? 0) + 1; const declaring = seat === prev.declarer || seat === prev.partnerSeat; if (declaring === (result === 'declaring')) wins[id] = (wins[id] ?? 0) + 1; });
      return { ...prev, counts, wins, games, phase: result ? 'ended' : 'playing', plays: [], selected: null, trickStatus: 'playing', playTurn: winner, trumpBroken: prev.trumpBroken || trumpWonTrick(prev.plays, prev.bid.suit) };
    }), s.trickStatus === 'holding' ? TRICK_PAUSE_MS : 750);
    return () => clearTimeout(timer);
  }, [s.phase, s.plays, s.trickStatus, own]);
  useEffect(() => {
    if (!s.shuffling) return;
    const timer = window.setTimeout(() => set(prev => {
      if (!prev.shuffling) return prev;
      if (prev.shuffleReveal) return { ...prev, shuffling: false, shuffleReveal: false, notice: '' };
      const next = reset(prev, 'bidding');
      const dealt = prev.testReshuffle === 'after-first' ? { ...next, hands: dealWeakPreviewHand(prev.testSeat, true), testReshuffle: 'done' as const } : next;
      return { ...dealt, shuffling: true, shuffleReveal: true, notice: prev.notice };
    }), s.shuffleReveal ? 350 : 2000);
    return () => clearTimeout(timer);
  }, [s.shuffling, s.shuffleReveal]);
  function leave(index: number) {
    if (index !== own && !dealer) return;
    const id = s.seats[index]; if (!id) return;
    const seats = s.seats.map((member, seat) => seat === index ? null : member);
    const dealerId = id === s.dealerId ? [1, 2, 3].map(offset => seats[(index + offset) % 4]).find(Boolean) ?? '' : s.dealerId;
    const next = { ...reset({ ...s, seats, dealerId, activePlayers: s.activePlayers.filter(player => player !== id) }), notice: members.find(m => m.id === id)?.username + (index === own ? ' left.' : ' was kicked.') + (s.phase !== 'waiting' && s.phase !== 'ended' ? ' Round forfeited. Fill the seat to start again.' : ' Fill the seat to start.') };
    if (!embedded) {
      forgetPlayerInGame(gameId, id);
      if (next.activePlayers.some(player => next.seats.includes(player))) saveActiveGame(gameId, next);
      else closeGame(gameId, next);
    }
    set(next);
  }
  return {
    members, viewerId, wins: s.wins, games: s.games, isDealer: dealer, phase: s.phase, seats: rotate(s.seats), dealerId: s.dealerId, round: s.round, bid: s.bid, declarer: visual(s.declarer), partner: s.partner, partnerSeat: visual(s.partnerSeat), announcementUntil: s.announcementUntil, callPartner,
    declarerHand: s.hands[s.declarer], cards: own < 0 ? [] : sortCards(s.hands[own]), selected: s.selected, active: visual(active), plays: s.plays.map(p => ({ ...p, seat: visual(p.seat) })), counts: rotate(s.counts), trickStatus: s.trickStatus, winner: s.winner === null ? null : visual(s.winner), bids: rotate(s.bids), highestBid: s.auction.highest, biddingBusy: active !== own || s.shuffling,
    placeBid: (value: Bid | null) => { if (own >= 0) submitBid(value, own); }, tapCard: (id: string) => { if (s.phase !== 'playing' || s.trickStatus !== 'playing' || (s.announcementUntil !== null && Date.now() < s.announcementUntil) || !validIds.includes(id)) return; if (s.selected !== id) set(prev => ({ ...prev, selected: id })); else if (active === own) { const card = s.hands[own].find(c => c.id === id); if (card) playCard(own, card); } },
    restart: () => { if (s.phase === 'ended') set(prev => reset({ ...prev, dealerId: prev.seats[(prev.seats.indexOf(prev.dealerId) + 1) % 4]!, round: prev.round + 1 })); },
    start: () => { if (ready && s.phase === 'waiting' && own >= 0) { if (!embedded) rememberPlayerSettings(viewerId, s); set(prev => {
      const next = reset(prev, 'bidding');
      return prev.testReshuffle === 'initial' ? { ...next, hands: dealWeakPreviewHand(prev.testSeat), testReshuffle: 'after-first' } : next;
    }); } }, goal: targets(s.bid.level), outcome, validIds, ready, notice: s.notice,
    removeSeat: (index: number) => { if (dealer && index !== 0) leave(canonical(index)); }, quit: () => { if (own >= 0) leave(own); },
    fillSeat: (index: number, id: string) => { if (dealer && s.phase === 'waiting' && members.some(m => m.id === id) && !s.seats.includes(id)) set(prev => ({ ...prev, seats: prev.seats.map((m, i) => i === canonical(index) ? id : m) })); },
    swapSeats: (from: number, to: number) => { if (!dealer || s.phase !== 'waiting' || !from || !to) return; set(prev => { const seats = [...prev.seats]; [seats[canonical(from)], seats[canonical(to)]] = [seats[canonical(to)], seats[canonical(from)]]; return { ...prev, seats }; }); },
    breakTrump: s.breakTrump, toggleBreakTrump: () => { if (s.phase === 'waiting' && dealer) set(prev => ({ ...prev, breakTrump: !prev.breakTrump })); },
    reshuffleEnabled: s.reshuffleEnabled, reshuffleThreshold: s.reshuffleThreshold, canReshuffle, shuffling: s.shuffling, shuffleReveal: s.shuffleReveal,
    toggleReshuffle: () => { if (s.phase === 'waiting' && dealer) set(prev => ({ ...prev, reshuffleEnabled: !prev.reshuffleEnabled })); },
    setReshuffleThreshold: (value: number) => { if (dealer && s.phase === 'waiting' && Number.isInteger(value) && value >= 1 && value <= 5) set(prev => ({ ...prev, reshuffleThreshold: value })); },
    requestReshuffle: () => { if (canReshuffle) set(prev => ({ ...prev, selected: null, shuffling: true, notice: members.find(m => m.id === viewerId)?.username + ' requested a reshuffle' })); },
  };
}
