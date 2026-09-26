import { ranks, suits, type Bid, type Card, type Suit } from '../types/game';
export const denominations: Bid['suit'][] = [...suits, 'no-trump'];
export const allBids: Bid[] = Array.from({ length: 7 }, (_, index) => denominations.map(suit => ({ level: index + 1, suit }))).flat();
export function bidValue(bid: Bid) { return (bid.level - 1) * denominations.length + denominations.indexOf(bid.suit); }
export function higherBids(previous: Bid | null) { return allBids.filter(bid => !previous || bidValue(bid) > bidValue(previous)); }
export function lowestBid(previous: Bid | null) { return higherBids(previous)[0] ?? null; }
export function isHigherBid(bid: Bid, previous: Bid | null) { return allBids.some(item => item.level === bid.level && item.suit === bid.suit) && (!previous || bidValue(bid) > bidValue(previous)); }
export interface Auction { highest: Bid | null; bidder: number | null; turn: number; passes: number; complete: boolean; allPassed: boolean }
export function newAuction(dealer: number): Auction { return { highest: null, bidder: null, turn: dealer, passes: 0, complete: false, allPassed: false }; }
export function auctionCall(auction: Auction, seat: number, bid: Bid | null): Auction {
  if (auction.complete || auction.allPassed || seat !== auction.turn || (bid && !isHigherBid(bid, auction.highest))) return auction;
  const passes = bid ? 0 : auction.passes + 1;
  return { highest: bid ?? auction.highest, bidder: bid ? seat : auction.bidder, turn: (seat + 1) % 4, passes, complete: !bid && !!auction.highest && passes === 3, allPassed: !bid && !auction.highest && passes === 4 };
}
export function sortCards(cards: Card[]) { return [...cards].sort((a, b) => suits.indexOf(a.suit) - suits.indexOf(b.suit) || ranks.indexOf(a.rank) - ranks.indexOf(b.rank)); }
export function suggestPartner(hand: Card[], bid: Bid): Card {
  // No-trump has no winning suit: use spades as a consistent suggestion.
  const preferred: Suit = bid.suit === 'no-trump' ? 'spades' : bid.suit;
  for (const suit of [preferred, ...[...suits].reverse().filter(value => value !== preferred)]) {
    const rank = [...ranks].reverse().find(value => !hand.some(card => card.suit === suit && card.rank === value));
    if (rank) return { id: `${rank}-${suit}`, rank, suit };
  }
  throw new Error('No partner card is available.');
}
