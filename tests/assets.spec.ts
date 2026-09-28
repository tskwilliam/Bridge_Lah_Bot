import { expect, test } from '@playwright/test';
import worker from '../worker/index';

test('card and suit images receive a browser cache lifetime', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('image', { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=0, must-revalidate' } }),
    },
  } as unknown as Parameters<typeof worker.fetch>[1];
  for (const path of ['/cards/clubs/cA.png', '/card-previews/clubs/cA.png', '/card-fast/clubs/cA.webp', '/card-table/clubs/cA.webp', '/icons/club.png']) {
    const response = await worker.fetch(new Request(`https://bridge.test${path}`), env);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  }
  const page = await worker.fetch(new Request('https://bridge.test/index.html'), env);
  expect(page.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
});
