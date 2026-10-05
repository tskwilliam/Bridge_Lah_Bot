import { useEffect, useRef, useState } from 'react';
import { connectTelegram, createLiveGame, liveLeaderboard, liveRequest, type LeaderboardRecord, type LiveContext } from './game/telegram';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { Rules } from './pages/Rules';
import { GameTable } from './pages/GameTable';
import type { Screen } from './types/game';
import { SuitLoader } from './components/ui/SuitLoader';

export function LiveApp() {
  const [context, setContext] = useState<LiveContext | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [gameId, setGameId] = useState('');
  const [scores, setScores] = useState<LeaderboardRecord[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const openedLaunch = useRef(false);

  useEffect(() => {
    let active = true;
    const refresh = () => connectTelegram().then(result => {
      if (!active) return;
      setContext(result);
      if (!openedLaunch.current) {
        openedLaunch.current = true;
        if (result.startGameId) { setGameId(result.startGameId); setScreen('game'); }
      }
      setError('');
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not connect to Telegram.'); });
    void refresh();
    const renewed = (event: Event) => { if (active) setContext((event as CustomEvent<LiveContext>).detail); };
    window.addEventListener('bridge-session-refreshed', renewed);
    const timer = window.setInterval(() => { void refresh(); }, 10 * 60 * 1000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('bridge-session-refreshed', renewed); };
  }, []);

  function navigate(next: Screen) {
    setScreen(next); setError('');
    if (next === 'leaderboard' && context) liveLeaderboard(context).then(result => setScores(result.scores)).catch(reason => setError(reason instanceof Error ? reason.message : 'Leaderboard unavailable.'));
  }
  async function create() {
    if (!context || creating) return;
    setCreating(true);
    try {
      const result = await createLiveGame(context);
      setContext({ ...context, resumeId: result.id });
      setGameId(result.id); setScreen('game'); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create a game.'); }
    finally { setCreating(false); }
  }
  function home() {
    setScreen('home'); setGameId(''); setError('');
    if (context) liveRequest<{ resumeId: string | null }>(context, '/api/home').then(result => setContext(previous => previous ? { ...previous, resumeId: result.resumeId } : previous)).catch(() => undefined);
  }
  if (!context) return error ? <main className="simple-home live-entry"><p role="alert">{error}</p></main> : <SuitLoader/>;
  return <div className={`simple-app ${screen === 'game' ? 'on-game' : 'on-home'}`}>
    {screen === 'home' && <><Home live creating={creating} onCreate={() => { void create(); }} navigate={navigate} onResume={context.resumeId ? () => { setGameId(context.resumeId!); setScreen('game'); } : undefined}/>{error && <p className="live-home-error" role="alert">{error}</p>}</>}
    {screen === 'leaderboard' && <><Leaderboard onHome={home} records={scores} currentPlayerId={String(context.user.id)}/>{error && <p className="live-home-error" role="alert">{error}</p>}</>}
    {screen === 'rules' && <Rules onHome={home}/>}
    {screen === 'game' && <GameTable key={gameId} gameId={gameId} initialPhase="waiting" embedded={false} host onHome={home} live={context}/>}
  </div>;
}
