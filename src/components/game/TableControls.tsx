import { useState } from 'react';
import type { useTablePreview } from '../../hooks/useTablePreview';
import { ranks, suits, type Rank, type Suit, type Card } from '../../types/game';
import { BiddingControls } from './BiddingControls';
import { Button } from '../ui/Button';
import { SuitIcon } from '../ui/SuitIcon';

function PartnerControls({ table }: { table: ReturnType<typeof useTablePreview> }) {
  const [rank, setRank] = useState<Rank>(table.partner.rank);
  const [suit, setSuit] = useState<Suit>(table.partner.suit);
  const card: Card = { id: `${rank}-${suit}`, rank, suit };
  const held = table.declarerHand.some(item => item.id === card.id);
  return <div className="inline-controls partner-controls"><div className="bidding-controls"><div className="partner-pickers"><label>Rank<select aria-label="Partner rank" value={rank} onChange={event => setRank(event.target.value as Rank)}>{[...ranks].reverse().map(value => <option key={value}>{value}</option>)}</select></label><label>Suit<select aria-label="Partner suit" value={suit} onChange={event => setSuit(event.target.value as Suit)}>{suits.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div><div className="flex gap-3"><Button className="flex-1" disabled={held} aria-label={`Call ${rank} ${suit}${held ? ' (card in your hand)' : ''}`} onClick={() => table.callPartner(card)}>{held ? 'Card in your hand' : <>Call {rank}<SuitIcon suit={suit}/></>}</Button></div></div></div>;
}
export function TableControls({ table }: { table: ReturnType<typeof useTablePreview> }) {
  if (table.phase === 'waiting') return null;
  if (table.phase === 'bidding') return <div className="inline-controls"><fieldset disabled={table.biddingBusy}><BiddingControls key={`${table.active}-${table.highestBid?.level}-${table.highestBid?.suit}`} previous={table.highestBid} onBid={table.placeBid} onPass={() => table.placeBid(null)}/></fieldset></div>;
  if (table.phase === 'partner') return table.declarer === 0 ? <PartnerControls table={table}/> : <div className="inline-controls partner-controls partner-waiting"><p className="tap-instruction">Waiting for the declarer to call a partner?</p></div>;
  return null;
}
