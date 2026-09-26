import { PlayingCard } from '../cards/PlayingCard';
import { Crown } from './Crown';
import { SuitIcon } from '../ui/SuitIcon';
import { suits } from '../../types/game';

export function RuleGraphic({ slide }: { slide: number }) {
  return <div className={`rule-graphic graphic-${slide}`} aria-hidden="true">
    {slide === 0 && <div className="deal-graphic">{suits.map(suit => <span key={suit}><SuitIcon suit={suit}/><small>13</small></span>)}</div>}
    {slide === 1 && <div className="dealer-graphic"><span>Y<small>Dealer</small></span><b>↻</b><span>M</span></div>}
    {slide === 2 && <div className="bid-graphic"><strong>3<SuitIcon suit="spades"/></strong><span>9 <small>vs</small> 5</span></div>}
    {slide === 3 && <div className="partner-graphic"><span className="illustrated-avatar">Y<Crown/></span><span className="partner-dots">···</span><PlayingCard card={{ id: 'rule-k', rank: 'K', suit: 'hearts' }}/></div>}
    {slide === 4 && <div className="trick-graphic">{(['3', 'J', 'A', '7'] as const).map(rank => <PlayingCard key={rank} card={{ id: `rule-${rank}`, rank, suit: 'spades' }} selected={rank === 'A'}/>)}</div>}
    {slide === 5 && <div className="win-graphic"><span>✦</span><strong>9 / 9</strong><b>You did it!</b><span>✧</span></div>}
  </div>;
}
