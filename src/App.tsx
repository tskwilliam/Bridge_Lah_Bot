import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { Rules } from './pages/Rules';
import { GameTable } from './pages/GameTable';
import type { GamePhase, Screen } from './types/game';
import { resumableGame } from './game/memory';
import { inTelegram } from './game/telegram';
import { LiveApp } from './LiveApp';

function route(): Screen { return new URLSearchParams(location.search).has('game') ? 'game' : location.pathname === '/leaderboard' ? 'leaderboard' : location.pathname === '/rules' ? 'rules' : 'home'; }
function LocalApp({ initialScreen = 'home', initialPhase = 'waiting', embedded = false }: { initialScreen?: Screen; initialPhase?: GamePhase; embedded?: boolean }) {
  const [viewer] = useState(() => new URLSearchParams(location.search).get('viewer') ?? 'you');
  const suffix = viewer === 'you' ? '' : 'viewer=' + encodeURIComponent(viewer);
  const resumeId = embedded ? null : resumableGame(viewer);
  const [screen, setScreen] = useState<Screen>(() => embedded ? initialScreen : route());
  const [gameId, setGameId] = useState(() => embedded ? 'gallery' : new URLSearchParams(location.search).get('game') ?? '');
  useEffect(() => { if (embedded) return; const back = () => { setScreen(route()); setGameId(new URLSearchParams(location.search).get('game') ?? ''); }; window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, [embedded]);
  function navigate(next: Screen) { if (!embedded) { history.pushState(null, '', (next === 'home' ? '/' : `/${next}`) + (suffix ? '?' + suffix : '')); window.scrollTo(0, 0); } setScreen(next); }
  function createGame() { const id = crypto.randomUUID(); if (!embedded) { sessionStorage.setItem(`bridge-host:${id}`, 'yes'); if (import.meta.env.DEV && new URLSearchParams(location.search).get('reshuffleTest') === '1') sessionStorage.setItem(`bridge-reshuffle-test:${id}`, viewer); history.pushState(null, '', `/?game=${id}${suffix ? '&' + suffix : ''}`); } setGameId(id); setScreen('game'); }
  function resumeGame() { if (!resumeId) return; history.pushState(null, '', '/?game=' + resumeId + (suffix ? '&' + suffix : '')); setGameId(resumeId); setScreen('game'); }
  return <div className={`simple-app ${embedded ? 'simple-embedded' : ''} ${screen === 'game' ? 'on-game' : 'on-home'}`}>
    {screen === 'home' && <Home onCreate={createGame} navigate={navigate} onResume={resumeId ? resumeGame : undefined}/>}
    {screen === 'leaderboard' && <Leaderboard onHome={() => navigate('home')}/>}
    {screen === 'rules' && <Rules onHome={() => navigate('home')}/>}
    {screen === 'game' && <GameTable key={gameId} gameId={gameId} initialPhase={initialPhase} embedded={embedded} host={embedded || sessionStorage.getItem(`bridge-host:${gameId}`) === 'yes'} onHome={() => navigate('home')}/>}
  </div>;
}

export function App(props: { initialScreen?: Screen; initialPhase?: GamePhase; embedded?: boolean }) {
  return !props.embedded && inTelegram() ? <LiveApp/> : <LocalApp {...props}/>;
}
