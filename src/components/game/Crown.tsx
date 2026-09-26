export function Crown({ animated = false }: { animated?: boolean }) {
  return <span className={`crown ${animated ? 'crown-arrives' : ''}`} role="img" aria-label="Winning bidder"><svg viewBox="0 0 64 48" aria-hidden="true"><path d="M9 13 22 24 32 7 42 24 55 13 49 39H15Z" fill="currentColor" stroke="var(--warning)" strokeWidth="2" strokeLinejoin="round"/><path d="M17 33h30" stroke="var(--card-paper)" strokeWidth="3"/><circle cx="9" cy="10" r="4" fill="currentColor"/><circle cx="32" cy="5" r="4" fill="currentColor"/><circle cx="55" cy="10" r="4" fill="currentColor"/></svg></span>;
}
