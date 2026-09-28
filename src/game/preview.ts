import { deck, hand } from './fixtures';
import type { Member, PlayerPosition } from '../types/game';

export const members: Member[] = [
  { id: 'you', username: '@you', initials: 'Y', wins: 12 },
  { id: 'marcus', username: '@hinakrapong', initials: 'M', wins: 8 },
  { id: 'rachel', username: '@angieavitra', initials: 'R', wins: 15 },
  { id: 'wei', username: '@lamweixuan', initials: 'W', wins: 6 },
];
export const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
// Fixed animation fixtures, not AI, turn rules, or a scoring engine.
export const opponentCards = deck.filter(card => !hand.some(own => own.id === card.id));
export function previewHands() { return [[...hand], ...[0, 1, 2].map(index => opponentCards.filter((_, cardIndex) => cardIndex % 3 === index))]; }
