import type { Screen } from '../types/game';
import { PlayingCard } from '../components/cards/PlayingCard';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import '../styles/home.css';
import { SuitIcon } from '../components/ui/SuitIcon';
export function Home({ onCreate, navigate, onResume, live = false }: { onResume?: () => void; onCreate: () => void; navigate: (screen: Screen) => void; live?: boolean }) {
  return <main className="simple-home"><header className="simple-brand"><SuitIcon suit="spades"/><h1>bridge lah!</h1></header><div className="home-play"><div className="friendly-cards" aria-hidden="true"><span className="card-spark">✦</span><PlayingCard card={{ id: 'hero-q', rank: 'Q', suit: 'hearts' }}/><PlayingCard card={{ id: 'hero-a', rank: 'A', suit: 'spades' }}/></div><h2>Bridge.<br/>Singapore Style</h2><div className="home-buttons">{onResume && <Button className="resume-button" onClick={onResume}>Resume game</Button>}<Button onClick={onCreate}><Icon name="plus" size={24}/>Create game</Button><Button variant="secondary" onClick={() => navigate('leaderboard')}><Icon name="trophy" size={24}/>Leaderboard</Button><Button variant="secondary" onClick={() => navigate('rules')}><Icon name="book" size={24}/>Rules</Button></div></div><footer className="simple-home-footer">{live ? 'Your group’s table' : 'Local preview'}</footer></main>;
}

