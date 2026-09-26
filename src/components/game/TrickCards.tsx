import type { Play } from '../../game/round';
import { positions } from '../../game/preview';
import { PlayingCard } from '../cards/PlayingCard';
export function TrickCards({ plays, collecting, winner }: { plays: Play[]; collecting: boolean; winner: number | null }) {
  return <div className={`trick-layer ${collecting && winner !== null ? `collecting collect-${positions[winner]}` : ''}`} aria-label="Current trick">{plays.map(play => <div key={play.card.id} className={`table-play from-${positions[play.seat]}`}><PlayingCard card={play.card} trick/></div>)}</div>;
}
