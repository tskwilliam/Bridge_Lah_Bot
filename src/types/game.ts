export const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Suit = typeof suits[number];
export type Rank = typeof ranks[number];
export type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';
export interface Card { id: string; rank: Rank; suit: Suit }
export interface Player { id: string; name: string; initials: string; position: PlayerPosition; ready: boolean; tricks: number; dealer?: boolean }
export interface Bid { level: number; suit: Suit | 'no-trump' }
export type GamePhase = 'waiting' | 'bidding' | 'partner' | 'playing' | 'ended';
export interface Member { id: string; username: string; initials: string; photoUrl?: string; wins: number }
export type Screen = 'home' | 'game' | 'leaderboard' | 'rules';
export const screens: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'game', label: 'Game' },
];
