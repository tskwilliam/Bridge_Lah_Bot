import type { Screen } from '../types/game';
import { PlayingCard } from '../components/cards/PlayingCard';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import '../styles/home.css';
import { SuitIcon } from '../components/ui/SuitIcon';
export function Home({ onCreate, navigate, onResume, creating = false }: { onResume?: () => void; onCreate: () => void; navigate: (screen: Screen) => void; live?: boolean; creating?: boolean }) {
  return <main className="simple-home"><header className="simple-brand"><SuitIcon suit="spades"/><h1>bridge lah!</h1></header><div className="home-play"><div className="home-hero"><div className="friendly-cards" aria-hidden="true"><span className="card-spark">✦</span><PlayingCard card={{ id: 'hero-q', rank: 'Q', suit: 'hearts' }}/><PlayingCard card={{ id: 'hero-a', rank: 'A', suit: 'spades' }}/></div><h2>Bridge.<br/>The Kopitiam Style.</h2></div><div className="home-buttons">{onResume && <Button className="resume-button" onClick={onResume}><Icon name="play" size={24}/>Resume game</Button>}<Button onClick={onCreate} disabled={creating}><Icon name="plus" size={24}/>{creating ? 'Creating game…' : 'Create game'}</Button><Button variant="secondary" onClick={() => navigate('leaderboard')}><Icon name="trophy" size={24}/>Leaderboard</Button><Button variant="secondary" onClick={() => navigate('rules')}><Icon name="book" size={24}/>How to play</Button></div></div></main>;
}

