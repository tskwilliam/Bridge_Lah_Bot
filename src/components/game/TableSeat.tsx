import { useLayoutEffect, useRef } from 'react';
import { MemberAvatar } from './MemberAvatar';
import { Crown } from './Crown';
import { BidLabel } from './BidLabel';
import { TrickPile } from './TrickPile';
import type { Bid, Member, PlayerPosition } from '../../types/game';
export function seatUsernameFontSize(username: string, measuredWidth: number): number {
  const baseSize = 10;
  const defaultLength = 10;
  const lengthScale = defaultLength / Math.max(username.length, defaultLength);
  const widthScale = 138 / Math.max(measuredWidth, 138);
  return Math.max(8, baseSize * Math.min(lengthScale, widthScale));
}
export function TableSeat({ member, position, active, dealer, crowned, round, tricks, showTricks, editable, removable, chosen, onSwap, onRemove, bid, wins, showWins, celebrating }: { member: Member; position: PlayerPosition; active: boolean; dealer: boolean; crowned: boolean; round: number; tricks: number; showTricks: boolean; editable: boolean; removable: boolean; chosen: boolean; onSwap: () => void; onRemove: () => void; bid?: Bid | 'Pass' | null; wins: number; showWins: boolean; celebrating: boolean }) {
  const usernameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const label = usernameRef.current;
    if (!label) return;
    const fit = () => {
      label.style.setProperty('--seat-font-size', '10px');
      label.style.setProperty('--seat-font-size', `${seatUsernameFontSize(member.username, label.scrollWidth).toFixed(2)}px`);
    };
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; };
  }, [member.username]);
  return <div data-seat={position} className={`circle-seat position-${position} ${active ? 'is-turn' : ''}`}>
    <div className="avatar-stack">{crowned && <Crown key={round} animated/>}<button className={`seat-avatar-button ${chosen ? 'swap-selected' : ''}`} disabled={!editable} aria-pressed={editable ? chosen : undefined} aria-label={editable ? `Swap seat for ${member.username}` : member.username} onClick={onSwap}><MemberAvatar member={member}/></button>{dealer && <span className="dealer-badge" aria-label="Dealer" title="Dealer">D</span>}</div>
    <span ref={usernameRef} className={`seat-username${member.username.length >= 10 ? ' long-seat-name' : ''}`}>{member.username}</span>
    {removable && <button className="remove-player kick-player" aria-label={`Kick ${member.username}`} title={`Kick ${member.username}`} onClick={onRemove}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 7C12 11 19 22 25 25M24 6C21 11 12 20 7 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/><path d="m9 6 16 18M25 8 8 25" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg></button>}
    {showTricks && <span key={tricks} className={`trick-count ${tricks ? 'count-pop' : ''}`} aria-label={`${member.username}: ${tricks} tricks won`}><TrickPile count={tricks}/></span>}
    {showWins && <span key={wins} className={`session-wins inward-label ${celebrating ? 'win-bounce' : ''}`} aria-label={`${member.username}: ${wins} session wins`}><b>{wins}</b> W</span>}
    {bid && <span className="seat-bid inward-label">{bid === 'Pass' ? 'Pass' : <BidLabel bid={bid}/>}</span>}
  </div>;
}
