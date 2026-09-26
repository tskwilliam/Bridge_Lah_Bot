import { useState } from 'react';
import { denominations, higherBids, isHigherBid, lowestBid } from '../../game/bidding';
import type { Bid } from '../../types/game';
import { Button } from '../ui/Button';
import { BidLabel } from './BidLabel';
export function BiddingControls({ previous, onBid, onPass }: { previous: Bid | null; onBid: (bid: Bid) => void; onPass: () => void }) {
  const [choice, setChoice] = useState<Bid | null>(() => lowestBid(previous));
  const options = higherBids(previous);
  const selected = choice && isHigherBid(choice, previous) ? choice : lowestBid(previous);
  if (!selected) return <div className="bidding-controls"><p>7 no trump is the highest bid.</p><Button onClick={onPass}>Pass</Button></div>;
  return <div className="bidding-controls"><div className="partner-pickers"><label>Level<select aria-label="Bid level" value={selected.level} onChange={event => { const level = Number(event.target.value); setChoice(options.find(item => item.level === level && item.suit === selected.suit) ?? options.find(item => item.level === level)!); }}>{[1, 2, 3, 4, 5, 6, 7].map(value => <option key={value} disabled={!options.some(item => item.level === value)}>{value}</option>)}</select></label><label>Suit<select aria-label="Bid suit" value={selected.suit} onChange={event => setChoice({ ...selected, suit: event.target.value as Bid['suit'] })}>{denominations.map(value => <option key={value} value={value} disabled={!options.some(item => item.level === selected.level && item.suit === value)}>{value === 'no-trump' ? 'No trump' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div><div className="flex gap-3"><Button variant="secondary" onClick={onPass}>Pass</Button><Button className="flex-1" aria-label={`Bid ${selected.level} ${selected.suit}`} onClick={() => onBid(selected)}>Bid <BidLabel bid={selected}/></Button></div></div>;
}
