import { useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { RuleGraphic } from '../components/game/RuleGraphic';
const slides = [
  { title: 'Four friends. Thirteen cards.', text: 'Deal all 52 cards equally. Everyone gets 13, and keeps their hand to themselves.' },
  { title: 'Take turns dealing.', text: 'The first person to join deals first. After each game, the dealer moves one seat clockwise.' },
  { title: 'Make your bid.', text: 'Every bid must beat the last: clubs, diamonds, hearts, spades, then no trump. After 1 no trump comes 2 clubs. A 3-level bid sets targets of 9 and 5.' },
  { title: 'Find your secret teammate.', text: 'The winning bidder calls a card they do not hold. Its holder is their partner. The player clockwise from the declarer leads first.' },
  { title: 'One card. Then around we go.', text: 'Follow the led suit if you can. Highest trump wins; otherwise, highest of the led suit wins. The winner collects the trick and leads next.' },
  { title: 'Reach your target. Win together.', text: 'Each trick counts for its winner. The game ends as soon as either pair reaches its target. Tap a card to raise it, then tap again to play.' },
];
export function Rules({ onHome }: { onHome: () => void }) {
  const [slide, setSlide] = useState(0);
  const touchStart = useRef<number | null>(null);
  const move = (direction: number) => setSlide(value => Math.max(0, Math.min(slides.length - 1, value + direction)));
  return <main className="info-page rules-page"><header className="info-header"><button className="table-icon" aria-label="Back home" onClick={onHome}><Icon name="back" size={24}/></button><h1>How to play</h1></header><section className="rules-carousel" aria-label="Rules slideshow" aria-roledescription="carousel" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1); }} onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => { if (touchStart.current !== null) { const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 50) move(distance < 0 ? 1 : -1); } touchStart.current = null; }}><RuleGraphic slide={slide}/><div className="rule-copy" aria-live="polite"><h2>{slides[slide].title}</h2><p>{slides[slide].text}</p></div></section><nav className="slide-dots" aria-label="Choose a rule">{slides.map((item, index) => <button key={item.title} aria-label={`Rule ${index + 1}`} aria-current={slide === index ? 'step' : undefined} onClick={() => setSlide(index)}><span/></button>)}</nav><div className="slide-actions"><Button variant="secondary" disabled={slide === 0} onClick={() => move(-1)}>Previous</Button><Button onClick={() => slide === slides.length - 1 ? onHome() : move(1)}>{slide === slides.length - 1 ? 'Got it!' : 'Next'}<Icon name="arrow"/></Button></div></main>;
}
