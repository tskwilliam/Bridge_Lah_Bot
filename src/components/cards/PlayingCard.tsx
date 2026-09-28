import type { Card } from '../../types/game';
import { SuitIcon } from '../ui/SuitIcon';
import '../../styles/cards.css';
export interface PlayingCardProps { card?: Card; faceDown?: boolean; selected?: boolean; playable?: boolean; disabled?: boolean; compact?: boolean; opponent?: boolean; trick?: boolean; hand?: boolean; onClick?: () => void }
export function PlayingCard({ card, faceDown, selected, playable, disabled, compact, opponent, trick, hand, onClick }: PlayingCardProps) {
  const back = faceDown || !card;
  const label = back ? 'Face-down card' : `${card.rank} of ${card.suit}`;
  const className = ['playing-card', back && 'card-back', !back && `suit-${card.suit}`, selected && 'card-selected', playable && 'card-playable', disabled && 'card-disabled', compact && 'card-compact', opponent && 'card-opponent', trick && 'card-trick'].filter(Boolean).join(' ');
  const name = back ? 'cardback' : `${card.suit}/${card.suit[0]}${card.rank}`;
  const source = `/${trick ? 'card-table' : 'card-fast'}/${name}.webp`;
  const fallback = back ? '/cards/cardback.png' : `/cards/${name}.png`;
  const valueTags = card && (trick || hand) && <><span className={`table-card-rank${hand ? ' hand-index' : ''}`} aria-hidden="true"><b>{card.rank}</b><SuitIcon suit={card.suit}/></span><span className={`table-card-rank card-rank-bottom${hand ? ' hand-index' : ''}`} aria-hidden="true"><b>{card.rank}</b><SuitIcon suit={card.suit}/></span></>;
  const content = <><picture><source srcSet={source} type="image/webp"/><img className="card-art" src={fallback} alt="" aria-hidden="true" draggable={false} loading="eager" decoding="async" fetchPriority={trick ? 'high' : 'auto'}/></picture>{valueTags}</>;
  return onClick ? <button type="button" aria-label={label} aria-pressed={!!selected} disabled={disabled} className={className} onClick={onClick}>{content}</button> : <div role="img" aria-label={label} className={className}>{content}</div>;
}
