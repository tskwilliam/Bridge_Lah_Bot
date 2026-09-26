import type { CSSProperties } from 'react';
import type { Play } from '../../game/round';
import { positions } from '../../game/preview';
import { PlayingCard } from '../cards/PlayingCard';
const offsets = [{ x: 0, y: 49 }, { x: -64, y: 0 }, { x: 0, y: -37 }, { x: 64, y: 0 }];
export function TrickCards({ plays, collecting, winner }: { plays: Play[]; collecting: boolean; winner: number | null }) {
  return <div className={`trick-layer ${collecting && winner !== null ? `collecting collect-${positions[winner]}` : ''}`} aria-label="Current trick">{plays.map(play => <div key={play.card.id} className={`table-play from-${positions[play.seat]}`} style={{ '--from-x': `${offsets[play.seat].x}px`, '--from-y': `${offsets[play.seat].y}px` } as CSSProperties}><PlayingCard card={play.card} trick/></div>)}</div>;
}
