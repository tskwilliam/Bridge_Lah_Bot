import { ranks, suits, type Card, type Player } from '../types/game';
// Visual fixtures only. These are not a rules engine or a simulated deal.
export const deck: Card[] = suits.flatMap(suit => ranks.map(rank => ({ id: `${rank}-${suit}`, rank, suit })));
export const hand: Card[] = [
  ...(['A', 'K', '10', '7'] as const).map(rank => ({ id: `${rank}-spades`, rank, suit: 'spades' as const })),
  ...(['Q', '9', '4'] as const).map(rank => ({ id: `${rank}-hearts`, rank, suit: 'hearts' as const })),
  ...(['A', 'J', '6'] as const).map(rank => ({ id: `${rank}-clubs`, rank, suit: 'clubs' as const })),
  ...(['K', '8', '2'] as const).map(rank => ({ id: `${rank}-diamonds`, rank, suit: 'diamonds' as const })),
];
export const players: Player[] = [
  { id: 'you', name: 'You', initials: 'Y', position: 'bottom', ready: true, tricks: 2 },
  { id: 'marcus', name: 'Marcus', initials: 'M', position: 'left', ready: true, tricks: 1, dealer: true },
  { id: 'rachel', name: 'Rachel', initials: 'R', position: 'top', ready: true, tricks: 2 },
  { id: 'wei', name: 'Wei Jie', initials: 'W', position: 'right', ready: true, tricks: 0 },
];
export const trickCards: Card[] = [
  { id: '5-spades', rank: '5', suit: 'spades' }, { id: 'J-spades', rank: 'J', suit: 'spades' },
  { id: '3-spades', rank: '3', suit: 'spades' }, { id: 'A-spades', rank: 'A', suit: 'spades' },
];
