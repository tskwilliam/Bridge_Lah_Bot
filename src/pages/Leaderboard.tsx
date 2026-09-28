import { useLayoutEffect, useRef, useState } from 'react';
import { members } from '../game/preview';
import { MemberAvatar } from '../components/game/MemberAvatar';
import { Crown } from '../components/game/Crown';
import { Icon } from '../components/ui/Icon';
import type { LeaderboardRecord } from '../game/telegram';
export function Leaderboard({ onHome, records, currentPlayerId = 'you' }: { onHome: () => void; records?: LeaderboardRecord[]; currentPlayerId?: string }) {
  const [view, setView] = useState<'wins' | 'percentage'>('wins');
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLOListElement>(null);
  const displayed = records ? records.map(record => ({ ...record.player, wins: record.wins })) : members;
  const totals = Object.fromEntries(displayed.map(m => [m.id, { wins: records?.find(record => record.player.id === m.id)?.wins ?? 0, games: records?.find(record => record.player.id === m.id)?.games ?? 0 }]));
  for (let i = 0; !records && i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i); if (!key?.startsWith('bridge-session:') && !key?.startsWith('bridge-results:')) continue;
    try { const session = JSON.parse(sessionStorage.getItem(key)!); for (const m of members) { totals[m.id].wins += Number(session.wins?.[m.id] ?? 0); totals[m.id].games += Number(session.games?.[m.id] ?? 0); } } catch { /* Ignore unavailable local records. */ }
  }
  const percentage = (id: string) => totals[id].games ? totals[id].wins / totals[id].games * 100 : 0;
  useLayoutEffect(() => {
    const list = scrollRef.current;
    if (!list) return;
    const update = () => setHasMore(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); list.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [view, records, displayed.length]);
  return <main className="info-page leaderboard-page"><header className="info-header"><button className="table-icon" aria-label="Back home" onClick={onHome}><Icon name="back" size={24}/></button><h1>Leaderboard</h1></header><div className="leader-views"><button aria-pressed={view === 'wins'} onClick={() => setView('wins')}>Most wins</button><button aria-pressed={view === 'percentage'} onClick={() => setView('percentage')}>Win percentage</button></div><div className={`leader-scroll${hasMore ? " has-more" : ""}`}><ol ref={scrollRef} className="wins-list">{[...displayed].sort((a, b) => view === 'wins' ? totals[b.id].wins - totals[a.id].wins : percentage(b.id) - percentage(a.id)).map((member, index) => <li key={member.id} className={member.id === currentPlayerId ? 'current-player' : undefined}><span className="rank-number">{index + 1}</span><span className="leader-avatar">{index === 0 && <Crown/>}<MemberAvatar member={member}/></span><span className="leader-name">{member.username}<small className="win-record">{totals[member.id].wins} wins in {totals[member.id].games} games</small></span><strong>{view === 'percentage' ? (totals[member.id].games ? Math.round(percentage(member.id)) + '%' : '—') : totals[member.id].wins}<small>{view === 'percentage' ? 'win rate' : 'wins'}</small></strong></li>)}</ol></div></main>;
}
