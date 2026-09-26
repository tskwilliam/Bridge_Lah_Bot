import { useState } from 'react';
import type { useTablePreview } from '../../hooks/useTablePreview';
import { ranks, suits, type Rank, type Suit, type Card } from '../../types/game';
import { BiddingControls } from './BiddingControls';
import { Button } from '../ui/Button';

function PartnerControls({ table }: { table: ReturnType<typeof useTablePreview> }) {
  const [rank, setRank] = useState<Rank>(table.partner.rank);
  const [suit, setSuit] = useState<Suit>(table.partner.suit);
  const card: Card = { id: `${rank}-${suit}`, rank, suit };
  const held = table.declarerHand.some(item => item.id === card.id);
  return <div className="inline-controls partner-controls"><div className="bidding-controls auction-row partner-row"><div className="partner-pickers"><label><span className="sr-only">Rank</span><select aria-label="Partner rank" value={rank} onChange={event => setRank(event.target.value as Rank)}>{[...ranks].reverse().map(value => <option key={value}>{value}</option>)}</select></label><label><span className="sr-only">Suit</span><select aria-label="Partner suit" value={suit} onChange={event => setSuit(event.target.value as Suit)}>{suits.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div><Button className="call-action" disabled={held} title={held ? 'Card in your hand' : undefined} aria-label={`Call ${rank} ${suit}${held ? ' (card in your hand)' : ''}`} onClick={() => table.callPartner(card)}>Call</Button></div></div>;
}
export function TableControls({ table }: { table: ReturnType<typeof useTablePreview> }) {
  if (table.phase === 'waiting') return null;
  if (table.phase === 'bidding') return <div className="inline-controls"><fieldset disabled={table.biddingBusy}><BiddingControls key={`${table.active}-${table.highestBid?.level}-${table.highestBid?.suit}`} previous={table.highestBid} onBid={table.placeBid} onPass={() => table.placeBid(null)}/></fieldset></div>;
  if (table.phase === 'partner') return table.declarer === 0 ? <PartnerControls table={table}/> : <div className="inline-controls partner-controls partner-waiting"><p className="tap-instruction">Waiting for the declarer to call a partner?</p></div>;
  return null;
}
