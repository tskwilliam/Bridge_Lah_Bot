import { test, expect } from '@playwright/test';
import { dealHands, dealWeakPreviewHand, handStrength, relativeSeat } from '../src/game/deal';
import { deck } from '../src/game/fixtures';
test('deal partitions a shuffled full deck into four unique thirteen-card hands', () => {
  for (let n = 0; n < 30; n++) { const hands = dealHands(); expect(hands.map(h => h.length)).toEqual([13,13,13,13]); expect(new Set(hands.flat().map(c => c.id)).size).toBe(52); }
  expect(dealHands()).not.toEqual(dealHands()); expect(deck).toHaveLength(52);
});
test('hand strength adds honours and each card past four in each suit', () => {
  expect(handStrength(deck.filter(c => c.suit === 'clubs'))).toBe(19);
  expect(handStrength(deck.filter(c => ['2','3','4','5'].includes(c.rank)))).toBe(0);
  expect(handStrength(deck.filter(c => ['J','Q','K','A'].includes(c.rank)))).toBe(40);
  for (let viewer=0; viewer<4; viewer++) { expect(relativeSeat(viewer, viewer)).toBe(0); expect(relativeSeat((viewer+1)%4,viewer)).toBe(1); }
});
test('reshuffle preview hands are different, weak, and still use the full deck', () => {
  for (let seat = 0; seat < 4; seat++) {
    const first = dealWeakPreviewHand(seat);
    const second = dealWeakPreviewHand(seat, true);
    for (const hands of [first, second]) {
      expect(hands.map(hand => hand.length)).toEqual([13, 13, 13, 13]);
      expect(new Set(hands.flat().map(card => card.id)).size).toBe(52);
      expect(handStrength(hands[seat])).toBe(0);
    }
    expect(new Set(first[seat].map(card => card.id))).not.toEqual(new Set(second[seat].map(card => card.id)));
  }
});
