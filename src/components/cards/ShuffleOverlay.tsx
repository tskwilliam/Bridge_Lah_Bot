export function ShuffleOverlay({ revealing = false }: { revealing?: boolean }) {
  return <div className={`shuffle-notice${revealing ? ' is-revealing' : ''}`} aria-label="Reshuffling cards" role="img">
    <div className="shuffle-cards" aria-hidden="true"><img src="/cards/cardback.png" alt=""/><img src="/cards/cardback.png" alt=""/><img src="/cards/cardback.png" alt=""/></div>
  </div>;
}
