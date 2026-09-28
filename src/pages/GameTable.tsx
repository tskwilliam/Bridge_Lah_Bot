import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { members, positions } from '../game/preview';
import { suits, type GamePhase } from '../types/game';
import { useTablePreview } from '../hooks/useTablePreview';
import { useLiveTable } from '../hooks/useLiveTable';
import type { LiveContext } from '../game/telegram';
import { TableSeat } from '../components/game/TableSeat';
import { TableControls } from '../components/game/TableControls';
import { TrickCards } from '../components/game/TrickCards';
import { BidLabel } from '../components/game/BidLabel';
import { Hand } from '../components/cards/Hand';
import { ShuffleOverlay } from '../components/cards/ShuffleOverlay';
import { Icon } from '../components/ui/Icon';
import { SuitIcon } from '../components/ui/SuitIcon';
import { SuitLoader } from '../components/ui/SuitLoader';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import '../styles/table.css';

// Fixed 420px canvas bounds: the circle and four seats, with room for all three
// kick hit areas and a short bottom label. Text and phase content never resize it.
const tableLayout = { centerX: 210, centerY: 195, radiusX: 187, radiusY: 183 };
// Landscape reserves the bottom trick pile even before play; usernames do not
// determine the table bounds or move the table between phases.
const landscapeVerticalBounds = { top: 8, bottom: 404 };

export function GameTable({ gameId, initialPhase, embedded, host, onHome, live }: { gameId: string; initialPhase: GamePhase; embedded: boolean; host: boolean; onHome: () => void; live?: LiveContext }) {
  const preview = useTablePreview(gameId, initialPhase, embedded || !!live);
  const remote = useLiveTable(gameId, live, preview);
  const table = live ? remote.table ?? preview : preview;
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [fillAt, setFillAt] = useState<number | null>(null);
  const [suitFrame, setSuitFrame] = useState(0);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementLeaving, setAnnouncementLeaving] = useState(false);
  const layoutRef = useRef<HTMLElement>(null);
  const seated = table.seats.map(id => table.members.find(member => member.id === id) ?? null);
  const waiting = table.phase === 'waiting';
  const inPlay = table.phase === 'playing';
  const afterBidding = ['partner', 'playing', 'ended'].includes(table.phase);
  const canManage = waiting && table.isDealer;
  const canFill = canManage && !live;
  const winnerSeats = [0, 1, 2, 3].filter(seat => table.outcome === 'declaring' ? seat === table.declarer || seat === table.partnerSeat : seat !== table.declarer && seat !== table.partnerSeat);
  const reshuffleRequester = table.notice.split(' requested a reshuffle')[0];
  useLayoutEffect(() => {
    const frame = layoutRef.current;
    if (!frame) return;
    const update = () => {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      const landscape = frame.closest('.simple-embedded') ? width > height : window.innerWidth > window.innerHeight;
      frame.dataset.layout = landscape ? 'landscape' : 'portrait';
      const handHeight = height < 275 ? 56 : height < 335 ? 66 : width < 360 ? 87 : 109;
      let groupSize: number;
      if (landscape) {
        const columnWidth = (Math.min(width - 40, 960) - 20) / 2;
        groupSize = Math.max(32, Math.min(columnWidth * 420 / (tableLayout.radiusX * 2), (height - 40) * 420 / (landscapeVerticalBounds.bottom - landscapeVerticalBounds.top)));
        const scale = groupSize / 420;
        frame.style.setProperty('--group-left', `${20 + columnWidth / 2 - tableLayout.centerX * groupSize / 420}px`);
        frame.style.setProperty('--group-top', `${Math.min(height / 2 - tableLayout.centerY * scale, height - 20 - landscapeVerticalBounds.bottom * scale)}px`);
        frame.style.setProperty('--score-top', `${(height - handHeight) / 2 - 52}px`);
      } else {
        const bottomMargin = 50;
        const handTop = height - bottomMargin - handHeight;
        const scoreTop = handTop - 52;
        // The bidding hand is the lowest shared boundary for every game phase.
        const lowerBoundary = handTop - 90;
        groupSize = Math.max(32, Math.min((width / 2 - 20) * 420 / tableLayout.radiusX, ((lowerBoundary - 64) / 2 - 20) * 420 / tableLayout.radiusY));
        frame.style.setProperty('--group-left', `${width / 2 - tableLayout.centerX * groupSize / 420}px`);
        frame.style.setProperty('--group-top', `${(64 + lowerBoundary) / 2 - tableLayout.centerY * groupSize / 420}px`);
        frame.style.setProperty('--bottom-margin', `${bottomMargin}px`);
        frame.style.setProperty('--score-top', `${scoreTop}px`);
      }
      frame.style.setProperty('--group-size', `${groupSize}px`);
      frame.style.setProperty('--group-scale', String(groupSize / 420));
      frame.style.setProperty('--hand-height', `${handHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const until = table.announcementUntil;
    if (table.phase !== 'playing' || !until || until + 350 <= Date.now()) { setAnnouncementVisible(false); setAnnouncementLeaving(false); return; }
    setAnnouncementVisible(true);
    setAnnouncementLeaving(until <= Date.now());
    const fadeTimer = window.setTimeout(() => setAnnouncementLeaving(true), Math.max(0, until - Date.now()));
    const removeTimer = window.setTimeout(() => setAnnouncementVisible(false), Math.max(0, until + 350 - Date.now()));
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(removeTimer); };
  }, [table.phase, table.announcementUntil]);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setSuitFrame(frame => (frame + 1) % suits.length), 1200);
    return () => window.clearInterval(timer);
  }, [waiting]);
  function swap(index: number) { if (!canManage || index === 0) return; if (swapFrom === null) setSwapFrom(index); else { table.swapSeats(swapFrom, index); setSwapFrom(null); } }
  if (live && !remote.table) return remote.error ? <main className="minimal-table"><p role="alert" className="live-loading">{remote.error}</p><Button onClick={onHome}>Back home</Button></main> : <SuitLoader/>;
  return <main ref={layoutRef} className="minimal-table" data-phase={table.phase}>
    <header className="table-header"><button className="table-icon" aria-label="Back home" onClick={onHome}><Icon name="back" size={24}/></button><div className="table-title">{afterBidding ? <><BidLabel bid={table.bid}/><span className="header-divider">·</span>{table.phase === 'partner' ? 'Call partner' : <span className="bid-label" aria-label={`Partner ${table.partner.rank} ${table.partner.suit}`}>{table.partner.rank}<SuitIcon suit={table.partner.suit}/></span>}</> : table.phase === 'bidding' ? 'Place your bid' : `Game ${table.round}`}</div><button className="table-icon" aria-label="Quit" title="Quit game" onClick={() => { table.quit(); onHome(); }}><Icon name="quit" size={24}/></button></header>
    <div className="table-group-frame"><div className="table-group-canvas"><section className="circle-stage" aria-label="Four players around the table">
      <div className="play-orbit" aria-hidden="true"/>
      {(inPlay || table.phase === 'bidding') && <div className="turn-track" aria-hidden="true" style={{ '--turn-angle': `${table.active * 90}deg` } as CSSProperties}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="49"/></svg></div>}
      {seated.map((member, index) => member ? <TableSeat key={member.id} member={member} position={positions[index]} active={(inPlay || table.phase === 'bidding') && table.active === index && table.trickStatus === 'playing'} dealer={member.id === table.dealerId} crowned={afterBidding && table.declarer === index} round={table.round} tricks={table.counts[index]} showTricks={inPlay} editable={canManage && index !== 0} removable={table.isDealer && index !== 0} wins={table.wins[member.id] ?? 0} showWins={waiting || table.phase === 'ended'} celebrating={table.phase === 'ended' && winnerSeats.includes(index)} chosen={swapFrom === index} onSwap={() => swap(index)} onRemove={() => { setSwapFrom(null); table.removeSeat(index); }} bid={table.phase === 'bidding' ? table.bids[index] : undefined}/> : <div key={`empty-${index}`} data-seat={positions[index]} className={`circle-seat position-${positions[index]} empty-seat`}><button aria-label={`Fill ${positions[index]} seat`} disabled={!canFill} onClick={() => { if (swapFrom !== null) swap(index); else setFillAt(index); }}>+</button></div>)}
      <div className="table-center">
        {waiting && <div className="center-message lobby-center"><span key={suitFrame} className="centre-suit-slide"><SuitIcon suit={suits[suitFrame]}/></span></div>}
        {table.phase === 'bidding' && (table.shuffling ? <div className="center-message reshuffle-table-message" role="status"><span className="reshuffle-requester">{reshuffleRequester}</span>{' '}<span>requested a reshuffle</span></div> : <div className="center-message"><span key={`${table.highestBid?.level}-${table.highestBid?.suit}`} className="centre-bid-suit"><b>{table.highestBid?.level ?? 1}</b>{table.highestBid?.suit === 'no-trump' ? <span>NT</span> : <SuitIcon suit={table.highestBid?.suit ?? 'clubs'}/>}</span><p className="bid-turn-message"><span>{seated[table.active]?.username}</span>{' '}<span>to bid</span></p></div>)}
        {table.phase === 'partner' && <div className="center-message"><SuitIcon suit={table.partner.suit}/><h1>Find your pair.</h1></div>}
        {inPlay && table.plays.length === 0 && (announcementVisible ? <div className={`partner-announcement${announcementLeaving ? ' is-leaving' : ''}`} role="status"><span className="partner-spark" aria-hidden="true">✦</span><span className="partner-announcement-card"><img src={`/card-fast/${table.partner.suit}/${table.partner.suit[0]}${table.partner.rank}.webp`} alt={`${table.partner.rank} of ${table.partner.suit}`}/><span className="table-card-rank" aria-hidden="true"><b>{table.partner.rank}</b><SuitIcon suit={table.partner.suit}/></span><span className="table-card-rank card-rank-bottom" aria-hidden="true"><b>{table.partner.rank}</b><SuitIcon suit={table.partner.suit}/></span></span><strong>Partner called</strong></div> : <p className="play-turn-message turn-arrives"><span>{seated[table.active]?.username}</span>{' '}<span>to play</span></p>)}
        {table.phase === 'ended' && <div className="center-message winner-message"><h1>{winnerSeats.includes(0) ? 'Win liao, power lah!' : 'Cannot make it sia...'}</h1></div>}
      </div>
      {inPlay && <TrickCards plays={table.plays} collecting={table.trickStatus === 'collecting'} winner={table.winner}/>}
    </section></div></div>
    {inPlay && <div className="target-split round-scoreboard" aria-label={`Trick targets: declarers ${table.goal.declaring}, defenders ${table.goal.defending}`}><span>Declarers <b>{table.goal.declaring}</b></span><span className="split-divider">:</span><span><b>{table.goal.defending}</b> Defenders</span></div>}
    <div className="table-bottom">
      {(waiting || table.phase === 'ended') && <div className="lobby-actions">
        <div className="round-settings">{waiting ? <>
          <button className="trump-toggle" type="button" aria-pressed={table.breakTrump} disabled={!table.isDealer} onClick={table.toggleBreakTrump} title="Lead trump only after it wins a trick, or when only trumps remain."><span className="toggle-dot" aria-hidden="true"/>Break trump</button>
          <div className="reshuffle-setting"><button type="button" className="trump-toggle" aria-pressed={table.reshuffleEnabled} disabled={!table.isDealer} onClick={table.toggleReshuffle}><span className="toggle-dot" aria-hidden="true"/>Reshuffle for hand value</button><span className="reshuffle-comparison" aria-label="less than">&lt;</span><select aria-label="Reshuffle threshold" value={table.reshuffleThreshold} disabled={!table.isDealer} onChange={event => table.setReshuffleThreshold(Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        </> : <p className="end-summary">{winnerSeats.map(seat => seated[seat]?.username).join(' + ')} win</p>}</div>
        <Button className="round-action" disabled={waiting && (!table.ready || (!!live && !table.isDealer))} onClick={() => { setSwapFrom(null); if (waiting) table.start(); else table.restart(); }}>{waiting ? (host ? 'Start game' : 'Preview game') : 'Play another round'}</Button>
      </div>}
      {table.phase === 'bidding' && table.canReshuffle && <div className="reshuffle-row"><button className="reshuffle-button" onClick={table.requestReshuffle}>Reshuffle</button></div>}
      {(['bidding', 'partner', 'playing'] as GamePhase[]).includes(table.phase) && <div className="minimal-hand"><div className={`hand-area${table.shuffling && !table.shuffleReveal ? ' is-covering' : ''}`}><Hand cards={table.cards} selected={table.selected} onSelect={table.tapCard} disabled={!inPlay || announcementVisible || table.trickStatus !== 'playing'} playableIds={inPlay ? table.validIds : undefined}/>{table.shuffling && <ShuffleOverlay revealing={table.shuffleReveal}/>}</div></div>}
      {['bidding', 'partner'].includes(table.phase) ? <div className="round-control-slot"><TableControls table={table}/></div> : <TableControls table={table}/>}
      {live && remote.pending && <p role="status" className="live-saving">Saving move…</p>}
      {live && remote.error && <p role="alert" className="live-error">{remote.error}</p>}
    </div>
    {!live && fillAt !== null && <Modal title="Fill this seat" onClose={() => setFillAt(null)}><p className="muted">Choose a sample player for the preview.</p>{members.filter(member => !table.seats.includes(member.id)).map(member => <Button key={member.id} className="w-full mt-4" onClick={() => { table.fillSeat(fillAt, member.id); setFillAt(null); }}>{member.username}</Button>)}</Modal>}
  </main>;
}
