import { auctionCall, newAuction, sortCards, suggestPartner, type Auction } from './bidding';
import { dealHands, handStrength, relativeSeat } from './deal';
import { legalCards, roundOutcome, targets, trickWinner, trumpWonTrick, type Play } from './round';
import { ranks, suits, type Bid, type Card, type GamePhase, type Member } from '../types/game';

export interface SharedPlayer extends Pick<Member, 'id' | 'username' | 'initials' | 'photoUrl'> {}
export interface SharedSettings { breakTrump: boolean; reshuffleEnabled: boolean; reshuffleThreshold: number }
export interface SharedGame {
  version: 1;
  revision: number;
  id: string;
  groupId: number;
  phase: GamePhase;
  seats: (SharedPlayer | null)[];
  dealerId: string;
  round: number;
  hands: Card[][];
  auction: Auction;
  bids: (Bid | 'Pass' | null)[];
  bid: Bid;
  declarer: number;
  partner: Card;
  partnerSeat: number;
  announcementUntil: number | null;
  playTurn: number;
  plays: Play[];
  counts: number[];
  trickStatus: 'playing' | 'holding' | 'collecting';
  winner: number | null;
  dueAt: number | null;
  breakTrump: boolean;
  trumpBroken: boolean;
  reshuffleEnabled: boolean;
  reshuffleThreshold: number;
  shuffleStage: 'start' | 'cover' | 'reveal' | null;
  notice: string;
  wins: Record<string, number>;
  games: Record<string, number>;
  winnerNames?: string[];
  actionReceipts?: { id: string; userId: string; action: string }[];
  updatedAt: number;
}

export type SharedAction =
  | { type: 'join'; player: SharedPlayer }
  | { type: 'start' }
  | { type: 'swap'; from: number; to: number }
  | { type: 'kick'; seat: number }
  | { type: 'quit' }
  | { type: 'breakTrump'; enabled: boolean }
  | { type: 'reshuffleSetting'; enabled: boolean; threshold: number }
  | { type: 'bid'; bid: Bid | null }
  | { type: 'partner'; card: Card }
  | { type: 'play'; cardId: string }
  | { type: 'reshuffle' }
  | { type: 'restart' };

export class GameActionError extends Error { constructor(message: string, readonly code?: 'started') { super(message); } }
const invalid = (message: string, code?: 'started'): never => { throw new GameActionError(message, code); };
const emptyHands = (): Card[][] => [[], [], [], []];
const defaultBid: Bid = { level: 1, suit: 'clubs' };
const defaultPartner: Card = { id: 'A-clubs', rank: 'A', suit: 'clubs' };

export function newSharedGame(id: string, groupId: number, first: SharedPlayer, settings: SharedSettings, now: number): SharedGame {
  return {
    version: 1, revision: 0, id, groupId, phase: 'waiting', seats: [first, null, null, null], dealerId: first.id,
    round: 1, hands: emptyHands(), auction: newAuction(0), bids: [null, null, null, null],
    bid: defaultBid, declarer: 0, partner: defaultPartner, partnerSeat: 1, announcementUntil: null, playTurn: 0,
    plays: [], counts: [0, 0, 0, 0], trickStatus: 'playing', winner: null, dueAt: null,
    breakTrump: settings.breakTrump, trumpBroken: false, reshuffleEnabled: settings.reshuffleEnabled,
    reshuffleThreshold: settings.reshuffleThreshold, shuffleStage: null, notice: '',
    wins: { [first.id]: 0 }, games: { [first.id]: 0 }, updatedAt: now,
  };
}

function lobby(game: SharedGame): SharedGame {
  return { ...game, winnerNames: undefined, phase: 'waiting', hands: emptyHands(), auction: newAuction(Math.max(0, game.seats.findIndex(player => player?.id === game.dealerId))), bids: [null, null, null, null], plays: [], counts: [0, 0, 0, 0], trickStatus: 'playing', winner: null, dueAt: null, announcementUntil: null, trumpBroken: false, shuffleStage: null };
}

function roundWinnerNames(game: SharedGame) {
  if (game.winnerNames) return game.winnerNames;
  const outcome = roundOutcome(game.counts, game.declarer, game.partnerSeat, game.bid.level);
  return outcome ? game.seats.filter((player, seat) => player && ((seat === game.declarer || seat === game.partnerSeat) === (outcome === 'declaring'))).map(player => player!.username) : [];
}

function playerSeat(game: SharedGame, userId: string) { return game.seats.findIndex(player => player?.id === userId); }
function dealerSeat(game: SharedGame) { return playerSeat(game, game.dealerId); }
function assertDealer(game: SharedGame, userId: string) { if (game.dealerId !== userId) invalid('Only the dealer can do that.'); }
function assertWaiting(game: SharedGame) { if (game.phase !== 'waiting') invalid('The game has already started.'); }
// A seat can be taken in the lobby, or after a round while its result is still on screen.
function assertJoinable(game: SharedGame) { if (game.phase !== 'waiting' && game.phase !== 'ended') invalid('The game has already started.', 'started'); }

export function advanceSharedGame(game: SharedGame, now: number): SharedGame {
  if (game.dueAt === null || now < game.dueAt) return game;
  if (game.shuffleStage === 'start') return { ...game, shuffleStage: 'cover', dueAt: now + 1400, updatedAt: now };
  if (game.shuffleStage === 'cover') return { ...game, shuffleStage: 'reveal', dueAt: now + 350, updatedAt: now };
  if (game.shuffleStage === 'reveal') return { ...game, shuffleStage: null, notice: '', dueAt: null, updatedAt: now };
  if (game.phase !== 'playing' || game.plays.length !== 4) return { ...game, dueAt: null };
  if (game.trickStatus === 'holding') return { ...game, trickStatus: 'collecting', winner: trickWinner(game.plays, game.bid.suit), dueAt: now + 750, updatedAt: now };
  if (game.trickStatus !== 'collecting') return game;
  const winner = game.winner ?? trickWinner(game.plays, game.bid.suit);
  const counts = game.counts.map((value, seat) => value + Number(seat === winner));
  const outcome = roundOutcome(counts, game.declarer, game.partnerSeat, game.bid.level);
  const wins = { ...game.wins }, games = { ...game.games };
  if (outcome) game.seats.forEach((player, seat) => {
    if (!player) return;
    games[player.id] = (games[player.id] ?? 0) + 1;
    const declaring = seat === game.declarer || seat === game.partnerSeat;
    if (declaring === (outcome === 'declaring')) wins[player.id] = (wins[player.id] ?? 0) + 1;
  });
  return { ...game, counts, wins, games, winnerNames: outcome ? roundWinnerNames({ ...game, counts }) : undefined, phase: outcome ? 'ended' : 'playing', plays: [], trickStatus: 'playing', winner: null, playTurn: winner, trumpBroken: game.trumpBroken || trumpWonTrick(game.plays, game.bid.suit), dueAt: null, updatedAt: now };
}

export function applySharedAction(original: SharedGame, userId: string, action: SharedAction, now: number): SharedGame {
  const game = advanceSharedGame(original, now);
  const own = playerSeat(game, userId);
  if (action.type === 'join') {
    if (action.player.id !== userId) invalid('Player identity mismatch.');
    if (own >= 0) return game;
    assertJoinable(game);
    const seat = game.seats.findIndex(player => player === null);
    if (seat < 0) invalid('This game is full.');
    const seats = [...game.seats]; seats[seat] = action.player;
    return { ...game, seats, wins: { ...game.wins, [userId]: game.wins[userId] ?? 0 }, games: { ...game.games, [userId]: game.games[userId] ?? 0 }, updatedAt: now };
  }
  if (own < 0) invalid('Join this game first.');
  if (action.type === 'quit' || action.type === 'kick') {
    if (action.type === 'kick') assertDealer(game, userId);
    const target = action.type === 'quit' ? own : action.seat;
    if (!Number.isInteger(target) || target < 0 || target > 3 || target === dealerSeat(game) && action.type === 'kick' || !game.seats[target]) invalid('Cannot remove that player.');
    const seats = [...game.seats]; const removed = seats[target]!; seats[target] = null;
    const nextDealer = removed.id === game.dealerId ? [1, 2, 3].map(offset => seats[(target + offset) % 4]).find(Boolean)?.id ?? '' : game.dealerId;
    const verb = action.type === 'quit' ? 'left' : 'was kicked';
    // The result is already counted, so the table keeps it on screen with the seat open.
    if (game.phase === 'ended') return { ...game, winnerNames: roundWinnerNames(game), seats, hands: game.hands.map((hand, seat) => seat === target ? [] : hand), dealerId: nextDealer, notice: `${removed.username} ${verb}.`, updatedAt: now };
    return { ...lobby({ ...game, seats, dealerId: nextDealer }), notice: `${removed.username} ${verb}. Round forfeited.`, updatedAt: now };
  }
  if (action.type === 'swap') {
    assertDealer(game, userId); assertWaiting(game);
    if (![action.from, action.to].every(index => Number.isInteger(index) && index > 0 && index < 4)) invalid('The dealer stays in their seat.');
    const seats = [...game.seats]; [seats[action.from], seats[action.to]] = [seats[action.to], seats[action.from]];
    return { ...game, seats, updatedAt: now };
  }
  if (action.type === 'breakTrump' || action.type === 'reshuffleSetting') {
    assertDealer(game, userId); assertWaiting(game);
    if (typeof action.enabled !== 'boolean') invalid('Choose a valid setting.');
    if (action.type === 'breakTrump') return { ...game, breakTrump: action.enabled, updatedAt: now };
    if (!Number.isInteger(action.threshold) || action.threshold < 1 || action.threshold > 5) invalid('Reshuffle threshold must be from 1 to 5.');
    return { ...game, reshuffleEnabled: action.enabled, reshuffleThreshold: action.threshold, updatedAt: now };
  }
  if (action.type === 'start') {
    assertDealer(game, userId); assertWaiting(game);
    if (game.seats.some(player => !player)) invalid('Four players must join before starting.');
    return { ...game, phase: 'bidding', hands: dealHands(), auction: newAuction(dealerSeat(game)), bids: [null, null, null, null], shuffleStage: 'start', dueAt: now + 900, notice: 'Start!', updatedAt: now };
  }
  if (action.type === 'bid') {
    if (game.phase !== 'bidding' || game.shuffleStage || game.auction.turn !== own) invalid('It is not your turn to bid.');
    const auction = auctionCall(game.auction, own, action.bid);
    if (auction === game.auction) invalid('That bid is not allowed.');
    const bids = game.bids.map((value, seat) => seat === own ? action.bid ?? 'Pass' as const : value);
    if (auction.allPassed) return { ...lobby({ ...game, auction, bids }), notice: 'Everyone passed. Ready for another deal?', updatedAt: now };
    if (auction.complete && auction.highest && auction.bidder !== null) {
      const partner = suggestPartner(game.hands[auction.bidder], auction.highest);
      return { ...game, phase: 'partner', auction, bids, bid: auction.highest, declarer: auction.bidder, partner, partnerSeat: game.hands.findIndex(hand => hand.some(card => card.id === partner.id)), updatedAt: now };
    }
    return { ...game, auction, bids, updatedAt: now };
  }
  if (action.type === 'reshuffle') {
    if (game.phase !== 'bidding' || game.shuffleStage || !game.reshuffleEnabled || game.bids[own] !== null || handStrength(game.hands[own]) >= game.reshuffleThreshold) invalid('This hand cannot be reshuffled.');
    return { ...game, hands: dealHands(), auction: newAuction(dealerSeat(game)), bids: [null, null, null, null], shuffleStage: 'cover', dueAt: now + 2000, notice: `${game.seats[own]!.username} requested a reshuffle`, updatedAt: now };
  }
  if (action.type === 'partner') {
    if (game.phase !== 'partner' || game.declarer !== own) invalid('Only the declarer can call a partner.');
    const card = action.card;
    if (!card || !ranks.includes(card.rank) || !suits.includes(card.suit) || card.id !== `${card.rank}-${card.suit}` || game.hands[own].some(item => item.id === card.id)) invalid('Choose a card outside your hand.');
    const partnerSeat = game.hands.findIndex(hand => hand.some(item => item.id === card.id));
    if (partnerSeat < 0) invalid('Partner card not found.');
    return { ...game, partner: card, partnerSeat, announcementUntil: now + 3000, playTurn: (own + 1) % 4, phase: 'playing', updatedAt: now };
  }
  if (action.type === 'play') {
    if (game.phase !== 'playing' || game.trickStatus !== 'playing' || game.playTurn !== own || (game.announcementUntil !== null && now < game.announcementUntil)) invalid('It is not your turn to play.');
    const card = game.hands[own].find(item => item.id === action.cardId);
    if (!card) throw new GameActionError('That card is not in your hand.');
    if (!legalCards(game.hands[own], game.plays, { trump: game.bid.suit, breakTrump: game.breakTrump, trumpBroken: game.trumpBroken }).some(item => item.id === action.cardId)) invalid('That card cannot be played.');
    const hands = game.hands.map((hand, seat) => seat === own ? hand.filter(item => item.id !== card.id) : hand);
    const plays = [...game.plays, { seat: own, card }];
    return { ...game, hands, plays, playTurn: plays.length === 4 ? own : (own + 1) % 4, trickStatus: plays.length === 4 ? 'holding' : 'playing', dueAt: plays.length === 4 ? now + 2200 : null, updatedAt: now };
  }
  if (action.type === 'restart') {
    if (game.phase !== 'ended') invalid('The round is not over.');
    if (!game.seats.every(Boolean)) invalid('Four players must join before the next round.');
    const nextDealer = game.seats[(dealerSeat(game) + 1) % 4]?.id ?? game.dealerId;
    return { ...lobby({ ...game, dealerId: nextDealer, round: game.round + 1 }), notice: '', updatedAt: now };
  }
  return game;
}

export function sharedView(game: SharedGame, userId: string, spectators: SharedPlayer[] = []) {
  // Someone without a seat watches from the first seat's point of view and sees every hand.
  const spectating = playerSeat(game, userId) < 0;
  const own = spectating ? 0 : playerSeat(game, userId);
  const seat = (index: number) => (index + own) % 4;
  const rotate = <T,>(items: T[]) => [0, 1, 2, 3].map(index => items[seat(index)]);
  const active = game.phase === 'bidding' ? game.auction.turn : game.playTurn;
  const cards = spectating ? [] : game.hands[own];
  const validIds = !spectating && game.phase === 'playing' && game.trickStatus === 'playing' ? legalCards(cards, game.plays, { trump: game.bid.suit, breakTrump: game.breakTrump, trumpBroken: game.trumpBroken }).map(card => card.id) : [];
  return {
    id: game.id, version: game.version, revision: game.revision, phase: game.phase, seatIndex: own, seats: rotate(game.seats), dealerId: game.dealerId,
    round: game.round, bid: game.bid, declarer: relativeSeat(game.declarer, own), partner: game.partner, announcementUntil: game.announcementUntil,
    partnerSeat: relativeSeat(game.partnerSeat, own), cards, active: relativeSeat(active, own),
    plays: game.plays.map(play => ({ ...play, seat: relativeSeat(play.seat, own) })), counts: rotate(game.counts),
    trickStatus: game.trickStatus, winner: game.winner === null ? null : relativeSeat(game.winner, own),
    bids: rotate(game.bids), highestBid: game.auction.highest, breakTrump: game.breakTrump,
    reshuffleEnabled: game.reshuffleEnabled, reshuffleThreshold: game.reshuffleThreshold,
    shuffling: game.shuffleStage !== null, shuffleReveal: game.shuffleStage === 'reveal',
    starting: game.notice === 'Start!' && game.shuffleStage !== null, shuffleStart: game.shuffleStage === 'start',
    winnerNames: game.phase === 'ended' ? roundWinnerNames(game) : [],
    notice: game.notice, wins: game.wins, games: game.games, validIds,
    ready: game.seats.every(Boolean), isDealer: game.dealerId === userId,
    canReshuffle: !spectating && game.phase === 'bidding' && !game.shuffleStage && game.bids[own] === null && game.reshuffleEnabled && handStrength(cards) < game.reshuffleThreshold,
    goal: targets(game.bid.level), outcome: roundOutcome(game.counts, game.declarer, game.partnerSeat, game.bid.level),
    biddingBusy: spectating || game.phase !== 'bidding' || game.auction.turn !== own || game.shuffleStage !== null,
    declarerHand: game.declarer === own ? cards : [],
    // Hands stay private until the round is over, then everyone sees what was left.
    spectators, spectating, spectatorHands: spectating ? rotate(game.hands).map(hand => sortCards(hand)) : null,
    revealedHands: game.phase === 'ended' ? rotate(game.hands).map(hand => sortCards(hand)) : null,
  };
}

export type SharedGameView = ReturnType<typeof sharedView>;
