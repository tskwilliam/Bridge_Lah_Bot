import type { Suit } from '../../types/game';
const names: Record<Suit, string> = { clubs: 'club', diamonds: 'diamond', hearts: 'heart', spades: 'spade' };
export function SuitIcon({ suit, className = '' }: { suit: Suit; className?: string }) { return <img className={`suit-icon ${className}`} src={`/icons/${names[suit]}.png`} alt="" aria-hidden="true" draggable={false}/>; }
