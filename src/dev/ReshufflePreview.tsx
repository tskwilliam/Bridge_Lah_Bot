import { useEffect, useState } from 'react';
import { Hand } from '../components/cards/Hand';
import { ShuffleOverlay } from '../components/cards/ShuffleOverlay';
import { dealWeakPreviewHand } from '../game/deal';

export function ReshufflePreview() {
  const [deal, setDeal] = useState(0);
  const [stage, setStage] = useState<'idle' | 'mixing' | 'revealing'>('idle');
  useEffect(() => {
    if (stage === 'idle') return;
    const timer = window.setTimeout(() => {
      if (stage === 'mixing') { setDeal(count => count + 1); setStage('revealing'); }
      else setStage('idle');
    }, stage === 'mixing' ? 2000 : 350);
    return () => window.clearTimeout(timer);
  }, [stage]);
  return <main className="reshuffle-preview-page">
    <a href="/dev">← Design gallery</a>
    <h1>Reshuffle preview</h1>
    <p>The hand stays fixed while the shuffle box covers it. Both deals are deliberately weak.</p>
    <div className="reshuffle-preview-frame minimal-hand">
      <div className={`hand-area${stage === 'mixing' ? ' is-covering' : ''}`}>
        <Hand cards={dealWeakPreviewHand(0, deal % 2 === 1)[0]} selected={null} onSelect={() => {}} disabled/>
        {stage !== 'idle' && <ShuffleOverlay revealing={stage === 'revealing'}/>}
      </div>
      <div className="hand-actions"><button className="reshuffle-button" disabled={stage !== 'idle'} onClick={() => setStage('mixing')}>Reshuffle</button></div>
    </div>
    <a className="reshuffle-game-link" href="/?reshuffleTest=1">Try it in a game ↗</a>
  </main>;
}
