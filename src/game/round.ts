import { ranks, type Bid, type Card } from '../types/game';
export interface Play { seat: number; card: Card }
export function targets(level: number) { return { declaring: level + 6, defending: 8 - level }; }
export interface TrumpRule { trump: Bid['suit']; breakTrump: boolean; trumpBroken: boolean }
export function legalCards(hand: Card[], plays: Play[], rule?: TrumpRule) {
  if (!plays.length && rule?.breakTrump && !rule.trumpBroken && rule.trump !== 'no-trump') {
    const nonTrump = hand.filter(card => card.suit !== rule.trump);
    return nonTrump.length ? nonTrump : hand;
  }
  const following = plays.length ? hand.filter(card => card.suit === plays[0].card.suit) : [];
  return following.length ? following : hand;
}
export function trickWinner(plays: Play[], trump: Bid['suit']): number {
  if (plays.length !== 4) throw new Error('A trick needs four cards.');
  const led = plays[0].card.suit;
  const strength = (card: Card) => (card.suit === trump ? 200 : card.suit === led ? 100 : 0) + ranks.indexOf(card.rank);
  return plays.reduce((best, play) => strength(play.card) > strength(best.card) ? play : best).seat;
}
export function trumpWonTrick(plays: Play[], trump: Bid['suit']) {
  return plays.length === 4 && trump !== 'no-trump' && plays.find(play => play.seat === trickWinner(plays, trump))?.card.suit === trump;
}
export function roundOutcome(counts: number[], declarer: number, partner: number, level: number) {
  const team = counts[declarer] + (partner === declarer ? 0 : counts[partner]);
  const defense = counts.reduce((sum, count) => sum + count, 0) - team;
  const goal = targets(level);
  return team >= goal.declaring ? 'declaring' as const : defense >= goal.defending ? 'defending' as const : null;
}
