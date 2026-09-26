import { deck } from './fixtures';
import { suits, type Card } from '../types/game';
export function randomIndex(limit: number): number {
  const cap = Math.floor(0x100000000 / limit) * limit;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= cap);
  return value[0] % limit;
}
export function dealHands(pick = randomIndex): Card[][] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) { const j = pick(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return Array.from({ length: 4 }, (_, seat) => cards.slice(seat * 13, seat * 13 + 13));
}
// Local reshuffle preview only: a balanced, zero-point hand in a chosen seat.
export function dealWeakPreviewHand(seat: number, second = false): Card[][] {
  const ranks = second ? ['6', '7', '8'] : ['2', '3', '4'];
  const extra = second ? { rank: '9', suit: 'diamonds' } : { rank: '5', suit: 'clubs' };
  const weak = deck.filter(card => ranks.includes(card.rank) || (card.rank === extra.rank && card.suit === extra.suit));
  const weakIds = new Set(weak.map(card => card.id));
  const others = dealHands().flat().filter(card => !weakIds.has(card.id));
  let offset = 0;
  return Array.from({ length: 4 }, (_, index) => {
    if (index === seat) return weak;
    const hand = others.slice(offset, offset + 13);
    offset += 13;
    return hand;
  });
}
const honours: Partial<Record<Card['rank'], number>> = { J: 1, Q: 2, K: 3, A: 4 };
export function handStrength(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + (honours[card.rank] ?? 0), 0)
    + suits.reduce((sum, suit) => sum + Math.max(0, cards.filter(card => card.suit === suit).length - 4), 0);
}
export function relativeSeat(seat: number, viewer: number) { return (seat - viewer + 4) % 4; }
