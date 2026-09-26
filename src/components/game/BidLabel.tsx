import type { Bid } from '../../types/game';
import { SuitIcon } from '../ui/SuitIcon';
export function BidLabel({ bid }: { bid: Bid }) { return <span className="bid-label" aria-label={`${bid.level} ${bid.suit}`}>{bid.level}{bid.suit === 'no-trump' ? ' NT' : <SuitIcon suit={bid.suit}/>}</span>; }
