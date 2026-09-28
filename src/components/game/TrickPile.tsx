export function TrickPile({ count }: { count: number }) {
  return <span className="trick-pile" aria-hidden="true"><svg viewBox="0 0 34 30" fill="none">
    <rect x="3" y="7" width="18" height="21" rx="2" transform="rotate(-14 3 7)" fill="#f9dc8a" stroke="currentColor" strokeWidth="1.8"/>
    <rect x="11" y="3" width="18" height="22" rx="2" transform="rotate(10 11 3)" fill="#ffd1d2" stroke="currentColor" strokeWidth="1.8"/>
    <rect x="7" y="5" width="18" height="22" rx="2" fill="#fffaf0" stroke="currentColor" strokeWidth="1.8"/>
  </svg><b>{count}</b></span>;
}
