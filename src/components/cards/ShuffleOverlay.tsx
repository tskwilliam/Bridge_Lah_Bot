export function ShuffleOverlay({ revealing = false, starting = false }: { revealing?: boolean; starting?: boolean }) {
  return <div className={`shuffle-notice${revealing ? ' is-revealing' : ''}`} aria-label={starting ? 'Shuffling cards' : 'Reshuffling cards'} role="img">
    <div className="shuffle-cards" aria-hidden="true"><img src="/cards/cardback.png" alt=""/><img src="/cards/cardback.png" alt=""/><img src="/cards/cardback.png" alt=""/></div>
  </div>;
}
