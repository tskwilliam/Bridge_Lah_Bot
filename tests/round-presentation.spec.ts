import { expect, test, type Page } from '@playwright/test';
import { applySharedAction, newSharedGame, sharedView, type SharedGame, type SharedPlayer } from '../src/game/shared';

const id = 'e'.repeat(32);
const players: SharedPlayer[] = [1, 2, 3, 4].map(n => ({ id: String(n), username: `@player${n}`, initials: String(n) }));
function fullGame() {
  let game = newSharedGame(id, -123, players[0], { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 }, 1000);
  for (const player of players.slice(1)) game = applySharedAction(game, player.id, { type: 'join', player }, 1001);
  return game;
}
async function live(page: Page, state: () => SharedGame, platform = 'tdesktop') {
  await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({ contentType: 'application/javascript', body: `window.Telegram={WebApp:{platform:'${platform}',initData:'test',ready(){},expand(){}}};` }));
  await page.route('**/api/context', route => route.fulfill({ json: { token: 'test', user: { id: 1 }, groupToken: 'test', startGameId: id, resumeId: id } }));
  const stateResponse = () => ({ state: sharedView(state(), '1', [{ id: '9', username: '@watcher', initials: 'W' }]) });
  await page.route(`**/api/games/${id}/join`, route => route.fulfill({ json: stateResponse() }));
  await page.route(`**/api/games/${id}`, route => route.fulfill({ json: stateResponse() }));
  await page.routeWebSocket('**/api/live?*', socket => socket.onMessage(() => undefined));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.circle-seat')).toHaveCount(4);
}

test('start announcement precedes the shuffle and smooth hand reveal', async ({ page }) => {
  await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.clock.install();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.start-announcement')).toHaveText('Start!');
  await expect(page.locator('.hand-area')).toHaveClass(/is-covering/);
  await expect(page.locator('.shuffle-notice')).toHaveCount(0);
  await expect(page.locator('.hand')).toBeHidden();
  await page.clock.runFor(900);
  await expect(page.getByRole('img', { name: 'Shuffling cards', exact: true })).toBeVisible();
  await expect(page.locator('.hand')).toBeHidden();
  await page.clock.runFor(1400);
  await expect(page.locator('.hand-area')).toHaveClass(/is-revealing/);
  await expect(page.locator('.hand')).toBeVisible();
  await page.clock.runFor(350);
  await expect(page.locator('.shuffle-notice, .start-announcement')).toHaveCount(0);
  await expect(page.locator('.playing-card')).toHaveCount(13);
});

for (const platform of ['tdesktop', 'android']) test(`round result preserves names and keeps each hand in one row on ${platform}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let game: SharedGame = { ...applySharedAction(fullGame(), '1', { type: 'start' }, 1002), phase: 'ended', shuffleStage: null, dueAt: null, declarer: 0, partnerSeat: 1, counts: [7, 0, 0, 0] };
  await live(page, () => game, platform);
  await expect(page.locator('.round-result')).toHaveText('@player1 & @player2 win');
  await expect(page.locator('.viewers-row > svg')).toHaveCSS('stroke-width', '2.8px');
  for (const [width, height] of [[307, 473], [390, 700], [430, 932], [667, 375], [800, 600]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const table = [...document.querySelectorAll('.play-orbit, .seat-avatar-button, .seat-username, .kick-player')].map(el => el.getBoundingClientRect());
      return {
        top: Math.min(...table.map(b => b.top)), bottom: Math.max(...table.map(b => b.bottom)), right: Math.max(...table.map(b => b.right)),
        result: rect('.round-result').toJSON(), hands: rect('.remaining-cards').toJSON(),
        rows: [...document.querySelectorAll('.remaining-row')].map(row => ({ box: row.getBoundingClientRect().toJSON(), cards: [...row.querySelectorAll('.remain-card')].map(card => card.getBoundingClientRect().toJSON()) })),
      };
    });
    expect(bounds.result.bottom).toBeLessThan(bounds.top);
    if (height >= width) expect(bounds.bottom).toBeLessThan(bounds.hands.top);
    else expect(bounds.right).toBeLessThan(bounds.hands.left);
    for (const row of bounds.rows) {
      expect(new Set(row.cards.map(card => card.y)).size).toBe(1);
      expect(row.cards.at(-1)!.right).toBeLessThanOrEqual(row.box.right + 1);
    }
    await page.screenshot({ path: `.local/round-end-${platform}-${width}x${height}.png`, animations: 'disabled' });
  }
  game = applySharedAction(game, '2', { type: 'quit' }, 1003);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.round-result')).toHaveText('@player1 & @player2 win');
  await expect(page.locator('.remaining-row')).toHaveCount(3);
  await expect(page.getByText('waiting for a player', { exact: false })).toHaveCount(0);
});

test('a transient move failure retries without shifting the hand or displaying status text', async ({ page }) => {
  let game: SharedGame = { ...applySharedAction(fullGame(), '1', { type: 'start' }, 1002), shuffleStage: null, dueAt: null, notice: '', auction: { ...fullGame().auction, turn: 0 } };
  await live(page, () => game);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const before = await page.locator('.minimal-hand').boundingBox();
  const ids: string[] = [];
  await page.route(`**/api/games/${id}/actions`, async route => {
    ids.push(route.request().headers()['x-action-id']);
    if (ids.length === 1) { await route.abort('failed'); return; }
    // Lose a response after commit too: the retry still carries the same ID.
    if (ids.length === 2) { game = { ...applySharedAction(game, '1', route.request().postDataJSON(), Date.now()), revision: game.revision + 1 }; await route.abort('failed'); return; }
    await route.fulfill({ json: { state: sharedView(game, '1') } });
  });
  await page.getByRole('button', { name: 'Bid 1 clubs', exact: true }).click();
  await expect.poll(() => ids.length).toBe(3);
  await expect(page.locator('.table-error, .live-saving, .live-error')).toHaveCount(0);
  expect(new Set(ids).size).toBe(1);
  expect(await page.locator('.minimal-hand').boundingBox()).toEqual(before);
  await expect(page.locator('.centre-bid-suit')).toContainText('1');
});

test('an expired session renews and resumes the same move', async ({ page }) => {
  let game: SharedGame = { ...applySharedAction(fullGame(), '1', { type: 'start' }, 1002), shuffleStage: null, dueAt: null, notice: '', auction: { ...fullGame().auction, turn: 0 } };
  await live(page, () => game);
  await page.route('**/api/context', route => route.fulfill({ json: { token: 'renewed', user: { id: 1 }, groupToken: 'test', startGameId: id, resumeId: id } }));
  const ids: string[] = [];
  const auth: string[] = [];
  await page.route(`**/api/games/${id}/actions`, async route => {
    ids.push(route.request().headers()['x-action-id']);
    auth.push(route.request().headers().authorization);
    if (auth.at(-1) === 'Bearer test') { await route.fulfill({ status: 401, json: { error: 'Session expired' } }); return; }
    game = { ...applySharedAction(game, '1', route.request().postDataJSON(), Date.now()), revision: game.revision + 1 };
    await route.fulfill({ json: { state: sharedView(game, '1') } });
  });
  await page.getByRole('button', { name: 'Bid 1 clubs', exact: true }).click();
  await expect.poll(() => auth).toEqual(['Bearer test', 'Bearer renewed']);
  expect(new Set(ids).size).toBe(1);
  await expect(page.locator('.table-error, .live-saving, .live-error')).toHaveCount(0);
});
