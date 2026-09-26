import { useEffect, useState } from 'react';
import { suits } from '../../types/game';
import { SuitIcon } from './SuitIcon';

export function SuitLoader() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setFrame(current => (current + 1) % suits.length), 900);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="suit-loader" role="status" aria-label="Loading Bridge Lah!">
    <span key={frame} className="suit-loader-frame"><SuitIcon suit={suits[frame]}/></span>
  </div>;
}
