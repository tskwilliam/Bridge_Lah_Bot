import { test, expect } from '@playwright/test';
import { allBids, auctionCall, isHigherBid, lowestBid, newAuction, sortCards, suggestPartner } from '../src/game/bidding';
import { hand } from '../src/game/fixtures';
import { ranks, suits, type Card } from '../src/types/game';
test('every bid is strictly ordered, including level boundaries and no trump', () => {
  expect(lowestBid(null)).toEqual({ level: 1, suit: 'clubs' });
  allBids.forEach((bid, index) => {
    expect(isHigherBid(bid, bid)).toBe(false);
    expect(lowestBid(bid)).toEqual(allBids[index + 1] ?? null);
    allBids.slice(0, index).forEach(lower => expect(isHigherBid(lower, bid)).toBe(false));
  });
});
test('auction rejects invalid turns and low bids, ending after three passes', () => {
  let auction = newAuction(0);
  expect(auctionCall(auction, 1, allBids[0])).toBe(auction);
  auction = auctionCall(auction, 0, { level: 1, suit: 'hearts' });
  expect(auctionCall(auction, 1, { level: 1, suit: 'diamonds' })).toBe(auction);
  auction = auctionCall(auction, 1, null);
  auction = auctionCall(auction, 2, null);
  expect(auction.complete).toBe(false);
  auction = auctionCall(auction, 3, null);
  expect(auction.complete).toBe(true);
  expect(auction.bidder).toBe(0);
  let passed = newAuction(0);
  for (let seat = 0; seat < 4; seat++) passed = auctionCall(passed, seat, null);
  expect(passed.allPassed).toBe(true);
});
test('partner defaults to highest unheld winning-suit card and hand is sorted', () => {
  expect(suggestPartner(hand, { level: 1, suit: 'diamonds' })).toMatchObject({ rank: 'A', suit: 'diamonds' });
  expect(suggestPartner([...hand, { id: 'A-diamonds', rank: 'A', suit: 'diamonds' }], { level: 1, suit: 'diamonds' })).toMatchObject({ rank: 'Q', suit: 'diamonds' });
  expect(suggestPartner(hand, { level: 1, suit: 'spades' })).toMatchObject({ rank: 'Q', suit: 'spades' });
  const onlyAce: Card[] = [{ id: 'A-diamonds', rank: 'A', suit: 'diamonds' }];
  expect(suggestPartner(onlyAce, { level: 1, suit: 'diamonds' })).toMatchObject({ rank: 'K', suit: 'diamonds' });
  const sorted = sortCards(hand);
  const strength = (card: Card) => suits.indexOf(card.suit) * 13 + ranks.indexOf(card.rank);
  expect(sorted.map(strength)).toEqual([...sorted.map(strength)].sort((a, b) => a - b));
});
