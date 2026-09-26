import type { Card } from '../../types/game';
import '../../styles/cards.css';
export interface PlayingCardProps { card?: Card; faceDown?: boolean; selected?: boolean; playable?: boolean; disabled?: boolean; compact?: boolean; opponent?: boolean; trick?: boolean; onClick?: () => void }
export function PlayingCard({ card, faceDown, selected, playable, disabled, compact, opponent, trick, onClick }: PlayingCardProps) {
  const back = faceDown || !card;
  const label = back ? 'Face-down card' : `${card.rank} of ${card.suit}`;
  const className = ['playing-card', back && 'card-back', !back && `suit-${card.suit}`, selected && 'card-selected', playable && 'card-playable', disabled && 'card-disabled', compact && 'card-compact', opponent && 'card-opponent', trick && 'card-trick'].filter(Boolean).join(' ');
  const source = back ? '/card-previews/cardback.png' : `/${trick ? 'cards' : 'card-previews'}/${card.suit}/${card.suit[0]}${card.rank}.png`;
  const preview = trick && card ? `/card-previews/${card.suit}/${card.suit[0]}${card.rank}.png` : null;
  const artStyle = preview ? { backgroundImage: `url("${preview}")`, backgroundSize: '100% 100%' } : undefined;
  const content = <><img className="card-art" src={source} alt="" aria-hidden="true" draggable={false} loading="eager" decoding="async"/>{trick && card && <span className="table-card-rank" aria-hidden="true">{card.rank}</span>}</>;
  return onClick ? <button type="button" aria-label={label} aria-pressed={!!selected} disabled={disabled} className={className} style={artStyle} onClick={onClick}>{content}</button> : <div role="img" aria-label={label} className={className} style={artStyle}>{content}</div>;
}
