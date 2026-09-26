import { test, expect } from '@playwright/test';
import { targets, trickWinner, trumpWonTrick, roundOutcome, legalCards, type Play } from '../src/game/round';
import type { Card } from '../src/types/game';
const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ id: `${rank}-${suit}`, rank, suit });
test('targets and early wins at every bid level', () => {
  for (let level = 1; level <= 7; level++) {
    const goal = targets(level);
    expect(goal.declaring + goal.defending).toBe(14);
    expect(roundOutcome([goal.declaring - 1, 0, 0, 0], 0, 2, level)).toBeNull();
    expect(roundOutcome([goal.declaring - 1, 0, 1, 0], 0, 2, level)).toBe('declaring');
    expect(roundOutcome([0, goal.defending - 1, 0, 0], 0, 2, level)).toBeNull();
    expect(roundOutcome([0, goal.defending - 1, 0, 1], 0, 2, level)).toBe('defending');
  }
});
test('trump beats the led suit; off-suit aces do not win no-trump tricks', () => {
  const plays: Play[] = [{ seat: 2, card: card('K', 'hearts') }, { seat: 3, card: card('2', 'spades') }, { seat: 0, card: card('A', 'clubs') }, { seat: 1, card: card('Q', 'hearts') }];
  expect(trickWinner(plays, 'spades')).toBe(3);
  expect(trickWinner(plays, 'no-trump')).toBe(2);
  expect(legalCards([card('2', 'hearts'), card('A', 'spades')], plays)).toEqual([card('2', 'hearts')]);
  expect(legalCards([card('A', 'spades')], plays)).toHaveLength(1);
});
test('high trump wins and a self-called card does not count a player twice', () => {
  expect(trickWinner([{ seat: 0, card: card('A', 'hearts') }, { seat: 1, card: card('7', 'spades') }, { seat: 2, card: card('K', 'spades') }, { seat: 3, card: card('Q', 'spades') }], 'spades')).toBe(2);
  expect(roundOutcome([5, 1, 0, 0], 0, 0, 3)).toBeNull();
});

test('Break trump restricts only unbroken leads and preserves follow-suit rules', () => {
  const trump = card('A', 'spades'), other = card('2', 'hearts');
  const rule = { trump: 'spades' as const, breakTrump: true, trumpBroken: false };
  expect(legalCards([trump, other], [], rule)).toEqual([other]);
  expect(legalCards([trump], [], rule)).toEqual([trump]);
  expect(legalCards([trump, other], [], { ...rule, trumpBroken: true })).toEqual([trump, other]);
  expect(legalCards([trump, other], [], { ...rule, breakTrump: false })).toEqual([trump, other]);
  expect(legalCards([trump, other], [], { ...rule, trump: 'no-trump' })).toEqual([trump, other]);
  expect(legalCards([trump, other], [{ seat: 1, card: card('3', 'spades') }], rule)).toEqual([trump]);
  expect(legalCards([trump, other], [{ seat: 1, card: card('3', 'hearts') }], rule)).toEqual([other]);
  expect(legalCards([trump], [{ seat: 1, card: other }], rule)).toEqual([trump]);
});
test('Trump breaks only upon a completed trick won with trump', () => {
  const plays: Play[] = [{ seat: 0, card: card('A', 'hearts') }, { seat: 1, card: card('2', 'spades') }, { seat: 2, card: card('K', 'hearts') }, { seat: 3, card: card('Q', 'hearts') }];
  expect(trumpWonTrick(plays.slice(0, 3), 'spades')).toBe(false);
  expect(trumpWonTrick(plays, 'spades')).toBe(true);
  expect(trumpWonTrick(plays, 'clubs')).toBe(false);
  expect(trumpWonTrick(plays, 'no-trump')).toBe(false);
});
