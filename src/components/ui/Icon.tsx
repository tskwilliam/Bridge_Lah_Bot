type IconName = 'arrow' | 'back' | 'close' | 'users' | 'plus' | 'play' | 'copy' | 'check' | 'grid' | 'book' | 'trophy' | 'quit';
const paths: Record<IconName, string> = {
  quit: 'M10 4H4v16h6M9 12h12m-5-5 5 5-5 5',
  arrow: 'M5 12h14m-6-6 6 6-6 6', back: 'M19 12H5m6-6-6 6 6 6', close: 'm6 6 12 12M6 18 18 6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  plus: 'M12 5v14M5 12h14', play: 'M8 5v14l11-7z', copy: 'M9 9h12v12H9zM5 15H3V3h12v2', check: 'm5 12 4 4L19 6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  book: 'M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1',
  trophy: 'M8 3h8v8a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v6m-4 0h8',
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>; }
