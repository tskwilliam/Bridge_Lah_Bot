import type { CSSProperties } from 'react';
import type { Card } from '../../types/game';
import { PlayingCard } from './PlayingCard';
import { sortCards } from '../../game/bidding';
export function Hand({ cards, selected, onSelect, disabled = false, playableIds }: { cards: Card[]; selected: string | null; onSelect: (id: string) => void; disabled?: boolean; playableIds?: string[] }) {
  return <div className="hand" aria-label={`Your hand, ${cards.length} cards`} style={{ '--card-count': Math.max(cards.length, 2) } as CSSProperties}>{sortCards(cards).map((card, index) => <div className="hand-slot" key={card.id} style={{ '--card-index': index } as CSSProperties}><PlayingCard card={card} selected={selected === card.id} playable={!disabled && (!playableIds || playableIds.includes(card.id))} disabled={disabled || (!!playableIds && !playableIds.includes(card.id))} onClick={() => onSelect(card.id)}/></div>)}</div>;
}
