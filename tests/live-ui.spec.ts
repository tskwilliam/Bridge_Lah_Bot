import { expect, test } from '@playwright/test';
import { applySharedAction, newSharedGame, sharedView, type SharedPlayer } from '../src/game/shared';

const id = 'c'.repeat(32);
const photoUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="80"%3E%3Crect width="120" height="80" fill="%23f46386"/%3E%3C/svg%3E';
const players: SharedPlayer[] = [1, 2, 3, 4].map(number => ({ id: String(number), username: `@live${number}`, initials: String(number), photoUrl }));
let game = newSharedGame(id, -100123, players[0], { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 }, 1000);
for (const player of players.slice(1)) game = applySharedAction(game, player.id, { type: 'join', player }, 1001);

for (const number of [1, 2]) {
  test(`Telegram launch seats player ${number} at the bottom`, async ({ page }) => {
    await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:"signed-test-launch",ready(){},expand(){}}};' }));
    await page.route('**/api/context', route => route.fulfill({ json: { token: 'test-session', user: { id: number, first_name: `Live ${number}` }, groupToken: 'test-group', startGameId: id, resumeId: id } }));
    await page.route(`**/api/games/${id}/join`, route => route.fulfill({ json: { state: sharedView(game, String(number)) } }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-seat="bottom"]')).toContainText(`@live${number}`);
    await expect(page.getByText('Marcus', { exact: true })).toHaveCount(0);
    await expect(page.locator('.circle-seat')).toHaveCount(4);
    const avatar = page.locator('[data-seat="bottom"] .member-avatar');
    const photo = avatar.locator('img');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveCSS('object-fit', 'cover');
    const avatarBox = (await avatar.boundingBox())!;
    const photoBox = (await photo.boundingBox())!;
    expect(photoBox.width).toBe(avatarBox.width);
    expect(photoBox.height).toBe(avatarBox.height);
  });
}

test('Telegram connection shows only the four-suit slideshow', async ({ page }) => {
  await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:"signed-test-launch",ready(){},expand(){}}};' }));
  let finishConnection: () => void = () => undefined;
  const connection = new Promise<void>(resolve => { finishConnection = resolve; });
  await page.route('**/api/context', async route => {
    await connection;
    await route.fulfill({ json: { token: 'test-session', user: { id: 1, first_name: 'Live 1' }, groupToken: 'test-group', startGameId: null, resumeId: null } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loader = page.getByRole('status', { name: 'Loading Bridge Lah!' });
  await expect(loader).toBeVisible();
  expect(await loader.innerText()).toBe('');
  const firstSuit = await loader.locator('img').getAttribute('src');
  await expect.poll(() => loader.locator('img').getAttribute('src')).not.toBe(firstSuit);
  finishConnection();
  await expect(page.getByRole('button', { name: 'Create game', exact: true })).toBeVisible();
});

async function openAsStranger(page: import('@playwright/test').Page, shown: ReturnType<typeof newSharedGame>) {
  await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:"signed-test-launch",ready(){},expand(){}}};' }));
  await page.route('**/api/context', route => route.fulfill({ json: { token: 'test-session', user: { id: 9, first_name: 'Watcher' }, groupToken: 'test-group', startGameId: id, resumeId: null } }));
  await page.route(`**/api/games/${id}/join`, route => route.fulfill({ status: 409, json: { error: 'The game has already started.', spectate: true } }));
  await page.route(`**/api/games/${id}`, route => route.fulfill({ json: { state: sharedView(shown, '9') } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test('a late arrival can spectate and look at a player\'s cards', async ({ page }) => {
  const started = applySharedAction(game, players[0].id, { type: 'start' }, 1002);
  await openAsStranger(page, started);
  await expect(page.getByRole('alert')).toContainText('The game has already started.');
  await page.getByRole('button', { name: 'Spectate', exact: true }).click();
  await expect(page.getByText(/Spectating/)).toBeVisible();
  await expect(page.locator('.minimal-hand')).toHaveCount(0);
  await page.getByRole('button', { name: "See @live2's cards" }).click();
  await expect(page.locator('.peek-hand .playing-card')).toHaveCount(13);
  await page.getByRole('button', { name: "See @live2's cards" }).click();
  await expect(page.locator('.peek-hand')).toHaveCount(0);
});

test('a seat left open after a round can be joined', async ({ page }) => {
  const ended = applySharedAction({ ...applySharedAction(game, players[0].id, { type: 'start' }, 1002), phase: 'ended' }, players[2].id, { type: 'quit' }, 1003);
  await openAsStranger(page, ended);
  await page.getByRole('button', { name: 'Spectate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join this seat' })).toBeEnabled();
  await expect(page.locator('.remaining-row')).toHaveCount(3);
});
