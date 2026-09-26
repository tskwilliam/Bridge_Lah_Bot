import { useState, type CSSProperties } from 'react';
import { App } from '../App';
import { deck, hand } from '../game/fixtures';
import type { GamePhase, Screen } from '../types/game';
import { PlayingCard, type PlayingCardProps } from '../components/cards/PlayingCard';
import { Hand } from '../components/cards/Hand';

const previews: { label: string; screen: Screen; phase?: GamePhase }[] = [
  { label: 'Home', screen: 'home' }, { label: 'Game · waiting', screen: 'game', phase: 'waiting' },
  { label: 'Game · bidding', screen: 'game', phase: 'bidding' }, { label: 'Game · partner', screen: 'game', phase: 'partner' },
  { label: 'Game · playing', screen: 'game', phase: 'playing' }, { label: 'Game · ended', screen: 'game', phase: 'ended' },
  { label: 'Leaderboard', screen: 'leaderboard' }, { label: 'Rules', screen: 'rules' },
];
const states: { label: string; props: PlayingCardProps }[] = [
  { label: 'Normal', props: {} }, { label: 'Selected', props: { selected: true } }, { label: 'Playable', props: { playable: true } },
  { label: 'Disabled', props: { disabled: true } }, { label: 'Compact', props: { compact: true } }, { label: 'Current trick', props: { trick: true } },
  { label: 'Face down', props: { faceDown: true } }, { label: 'Opponent', props: { faceDown: true, opponent: true } },
];
export function DevGallery() {
  const [preview, setPreview] = useState(4);
  const [width, setWidth] = useState(390);
  const [selected, setSelected] = useState<string | null>(null);
  const [cards, setCards] = useState(hand);
  const view = previews[preview];
  return <div className="dev-page"><header className="dev-header"><h1>Design gallery</h1><a href="/dev/reshuffle">Reshuffle preview</a> · <a href="/">Open app ↗</a></header><div className="dev-workspace"><aside><h2>One steady table.</h2><p>Game phases stay on the same page.</p><nav className="dev-tabs" aria-label="Preview states">{previews.map((item, index) => <button key={item.label} aria-pressed={preview === index} onClick={() => setPreview(index)}>{item.label}</button>)}</nav><label className="field-label" htmlFor="preview-width">Phone width</label><select id="preview-width" value={width} onChange={event => setWidth(Number(event.target.value))}><option value={390}>390 × 844</option><option value={430}>430 × 932</option></select><p className="fine-print">Developer tools only. These controls are not part of the app.</p></aside><section className="dev-stage" aria-label="Screen preview"><div className="device-frame" style={{ width, height: width === 390 ? 844 : 932, '--preview-height': `${width === 390 ? 844 : 932}px` } as CSSProperties}><App key={preview} initialScreen={view.screen} initialPhase={view.phase} embedded/></div></section></div><section className="gallery-section"><h2>Playing cards</h2><div className="deck-grid">{deck.map(card => <PlayingCard key={card.id} card={card}/>)}</div></section><section className="gallery-section"><h2>Card states</h2><div className="card-state-grid">{states.map(state => <div key={state.label}><PlayingCard card={hand[0]} {...state.props}/><span>{state.label}</span></div>)}</div></section><section className="gallery-section"><h2>Two-tap hand</h2><p>Tap to raise. Tap the same card to play.</p><div className="gallery-hand"><Hand cards={cards} selected={selected} onSelect={id => { if (selected === id) { setCards(previous => previous.filter(card => card.id !== id)); setSelected(null); } else setSelected(id); }}/></div><button className="text-button" onClick={() => { setCards(hand); setSelected(null); }}>Reset hand</button></section></div>;
}

