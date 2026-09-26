import { test, expect, type Page } from '@playwright/test';
import { handStrength } from '../src/game/deal';
async function create(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Create game', exact: true }).click(); }
async function snapshot(page: Page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem('bridge-session:' + new URLSearchParams(location.search).get('game'))!)); }
async function seed(page: Page, patch: Record<string, unknown>) { await page.evaluate(p => { const key = 'bridge-session:' + new URLSearchParams(location.search).get('game'); const state = JSON.parse(sessionStorage.getItem(key)!); sessionStorage.setItem(key, JSON.stringify({ ...state, ...p })); }, patch); await page.reload(); }
async function aligned(page: Page) {
  await page.locator('.circle-stage').evaluate(async el => { await Promise.all(el.closest('main')!.getAnimations().map(a => a.finished)); });
  const orbit = (await page.locator('.play-orbit').boundingBox())!;
  const stage = (await page.locator('.circle-stage').boundingBox())!;
  expect(Math.abs(orbit.width - orbit.height)).toBeLessThan(1);
  for (const [pos, x, y] of [['top', .5, .12], ['bottom', .5, .88], ['left', .12, .5], ['right', .88, .5]] as const) {
    const a = (await page.locator('[data-seat=' + pos + '] .seat-avatar-button').boundingBox())!;
    expect(Math.abs(a.x + a.width / 2 - stage.x - stage.width * x)).toBeLessThan(1);
    expect(Math.abs(a.y + a.height / 2 - stage.y - stage.height * y)).toBeLessThan(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}
test('normal games deal all cards randomly without the reshuffle test hand', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const first = await snapshot(page);
  expect(first.testReshuffle).toBeNull();
  expect(first.hands.map((hand: unknown[]) => hand.length)).toEqual([13, 13, 13, 13]);
  expect(new Set(first.hands.flat().map((card: { id: string }) => card.id)).size).toBe(52);
  await page.getByRole('button', { name: 'Back home' }).click();
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const second = await snapshot(page);
  expect(second.testReshuffle).toBeNull();
  expect(second.hands).not.toEqual(first.hands);
});

test('short phone viewport keeps the home and every game phase on one screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight);
  await expect.poll(fits).toBe(true);
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect.poll(fits).toBe(true);
  const waitingSize = (await page.locator('.circle-stage').boundingBox())!.width;
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect.poll(fits).toBe(true);
  const biddingSize = (await page.locator('.circle-stage').boundingBox())!.width;
  expect(biddingSize).toBe(waitingSize);
  const state = await snapshot(page);
  await seed(page, { phase: 'partner', declarer: 0, partner: state.hands[0][0] });
  await expect.poll(fits).toBe(true);
  await seed(page, { phase: 'playing' });
  await expect.poll(fits).toBe(true);
  await expect(page.locator('.target-split')).toHaveCSS('border-top-width', '0px');
});
test('mobile copy, settings, dealer crosses, random deal and resume', async ({ page }, info) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Bridge. Singapore Style' })).toBeVisible();
  await page.screenshot({ path: 'test-results/session-home-' + info.project.name + '.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect(page.getByText('Mai tu liao, play leh...')).toBeVisible();
  const breakTrump = page.getByRole('button', { name: /Break trump/ });
  await expect(breakTrump).toHaveText('Break trump');
  await breakTrump.click(); await expect(breakTrump).toHaveAttribute('aria-pressed', 'true'); await expect(breakTrump).toHaveText('Break trump');
  await breakTrump.click(); await expect(breakTrump).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.kick-player')).toHaveCount(3);
  await expect(page.locator('[data-seat=bottom] .kick-player')).toHaveCount(0);
  await expect(page.locator('.session-wins')).toHaveCount(4);
  await aligned(page);
  await page.getByRole('button', { name: 'Swap seat for @marcus' }).click(); await page.getByRole('button', { name: 'Swap seat for @rachel' }).click();
  await expect(page.locator('[data-seat=left]')).toContainText('@rachel');
  const settings = page.getByRole('button', { name: /Allow reshuffle/ }); await settings.click();
  await expect(settings).toHaveText('Allow reshuffle for hand value');
  await expect(page.getByLabel('less than')).toHaveText('<');
  await expect(page.getByLabel('Reshuffle threshold').locator('option')).toHaveCount(5);
  await page.getByLabel('Reshuffle threshold').selectOption('5');
  await expect(page.getByLabel('Reshuffle threshold')).toHaveValue('5');
  expect((await snapshot(page)).reshuffleThreshold).toBe(5);
  await expect(settings).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/session-lobby-' + info.project.name + '.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.minimal-hand button')).toHaveCount(13);
  await expect(page.locator('.minimal-hand button').first()).toHaveCSS('opacity', '1');
  const first = await snapshot(page); expect(new Set(first.hands.flat().map((c: { id: string }) => c.id)).size).toBe(52);
  const labels = await page.locator('.minimal-hand .playing-card').allTextContents(); expect(labels.every(label => !label)).toBeTruthy();
  await page.getByRole('button', { name: 'Back home' }).click();
  await page.getByRole('button', { name: 'Resume game', exact: true }).click();
  expect((await snapshot(page)).hands).toEqual(first.hands);
  await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', 'bidding');
  await page.getByRole('button', { name: 'Kick @rachel' }).click();
  await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', 'waiting');
  await expect(page.getByText('Tap two profiles to swap seats.')).toBeVisible();
  await expect(page.getByText('Use × to kick a player.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fill left seat' }).click(); await page.getByRole('dialog').getByRole('button', { name: '@rachel' }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click(); expect((await snapshot(page)).hands).not.toEqual(first.hands);
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume game', exact: true })).toHaveCount(0);
});
test('every viewer is at bottom and only dealer can kick; quit resets the table', async ({ page }) => {
  await create(page); const url = page.url();
  for (const viewer of ['marcus', 'rachel', 'wei']) {
    await page.goto(url + '&viewer=' + viewer);
    await expect(page.locator('[data-seat=bottom]')).toContainText(viewer === 'wei' ? '@weijie' : '@' + viewer);
    await expect(page.locator('.kick-player')).toHaveCount(0); await aligned(page);
  }
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await page.goto(url);
  await expect(page.locator('.empty-seat')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeDisabled();
});
test('resume follows active players and the last exit discards the game', async ({ page }) => {
  await create(page);
  const url = page.url();
  const gameId = new URL(url).searchParams.get('game')!;
  await page.goto(url + '&viewer=marcus');
  expect((await snapshot(page)).activePlayers).toEqual(['you', 'marcus']);
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume game' })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume game' }).click();
  expect((await snapshot(page)).activePlayers).toEqual(['you']);
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume game' })).toHaveCount(0);
  expect(await page.evaluate(id => ({ game: sessionStorage.getItem('bridge-session:' + id), host: sessionStorage.getItem('bridge-host:' + id), you: sessionStorage.getItem('bridge-resume:you'), marcus: sessionStorage.getItem('bridge-resume:marcus') }), gameId)).toEqual({ game: null, host: null, you: null, marcus: null });
});
test('last started settings belong to each player and survive a closed game', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: /Break trump/ }).click();
  await page.getByRole('button', { name: /Allow reshuffle/ }).click();
  await page.getByLabel('Reshuffle threshold').selectOption('5');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect(page.getByRole('button', { name: /Break trump/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Allow reshuffle/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Reshuffle threshold')).toHaveValue('5');
  await page.getByRole('button', { name: /Break trump/ }).click();
  await page.getByRole('button', { name: 'Back home' }).click();
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect(page.getByRole('button', { name: /Break trump/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/?viewer=marcus');
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect(page.getByRole('button', { name: /Break trump/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /Allow reshuffle/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Reshuffle threshold')).toHaveValue('4');
});
test('stale resume pointers and games with no active player are cleared', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('bridge-session:stale', JSON.stringify({ version: 3, seats: ['you', null, null, null], activePlayers: [], wins: {}, games: {} }));
    sessionStorage.setItem('bridge-resume:you', 'stale');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume game' })).toHaveCount(0);
  expect(await page.evaluate(() => [sessionStorage.getItem('bridge-session:stale'), sessionStorage.getItem('bridge-resume:you')])).toEqual([null, null]);
});
test('reshuffle test game gives the creator two different zero-point hands', async ({ page }) => {
  await page.goto('/?reshuffleTest=1');
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await expect(page.getByRole('button', { name: /Allow reshuffle/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const first = await snapshot(page);
  expect(first.testReshuffle).toBe('after-first');
  expect(handStrength(first.hands[0])).toBe(0);
  await page.getByRole('button', { name: 'Reshuffle', exact: true }).click();
  await expect(page.getByText('@you requested a reshuffle')).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).testReshuffle, { timeout: 5000 }).toBe('done');
  const second = await snapshot(page);
  expect(handStrength(second.hands[0])).toBe(0);
  expect(new Set(second.hands[0].map((card: { id: string }) => card.id))).not.toEqual(new Set(first.hands[0].map((card: { id: string }) => card.id)));
  expect(new Set(second.hands.flat().map((card: { id: string }) => card.id)).size).toBe(52);
  await page.getByRole('button', { name: 'Back home' }).click();
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  expect((await snapshot(page)).testReshuffle).toBeNull();
});
test('reshuffle covers a stationary hand with its button below', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?reshuffleTest=1');
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const handTop = () => page.locator('.hand-area').evaluate(el => el.getBoundingClientRect().top + scrollY);
  const cardSlots = () => page.locator('.hand-slot').evaluateAll(elements => elements.map(el => { const rect = el.getBoundingClientRect(); return { x: rect.x + scrollX, y: rect.y + scrollY }; }));
  const before = await handTop();
  const beforeSlots = await cardSlots();
  const area = (await page.locator('.hand-area').boundingBox())!;
  const action = (await page.getByRole('button', { name: 'Reshuffle', exact: true }).boundingBox())!;
  expect(action.y).toBeGreaterThanOrEqual(area.y + area.height);
  expect(Math.abs(action.x + action.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Reshuffle', exact: true }).click();
  await expect(page.locator('.reshuffle-table-message')).toHaveText('@you requested a reshuffle');
  await expect(page.locator('.centre-bid-suit')).toHaveCount(0);
  await expect(page.locator('.shuffle-notice')).not.toContainText('requested');
  await expect(page.locator('.shuffle-spark')).toHaveCount(0);
  const cover = (await page.locator('.hand-area .shuffle-notice').boundingBox())!;
  const coveredArea = (await page.locator('.hand-area').boundingBox())!;
  expect(Math.abs(cover.y - coveredArea.y - 24)).toBeLessThan(1);
  expect(Math.abs(cover.height - 98)).toBeLessThan(1);
  expect(Math.abs(cover.width - coveredArea.width)).toBeLessThan(1);
  expect(await handTop()).toBe(before);
  expect(await cardSlots()).toEqual(beforeSlots);
  await page.screenshot({ path: 'test-results/reshuffle-cover-' + info.project.name + '.png' });
  await expect(page.locator('.shuffle-notice')).toHaveCount(0, { timeout: 5000 });
  expect(await handTop()).toBe(before);
  expect(await cardSlots()).toEqual(beforeSlots);
  expect(handStrength((await snapshot(page)).hands[0])).toBe(0);
});
test('placing a bid removes reshuffle even when the hand is weak', async ({ page }) => {
  await page.goto('/?reshuffleTest=1');
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.bid-turn-message')).toHaveText('@you to bid');
  await expect(page.getByText('Thinking…')).toHaveCount(0);
  await expect(page.getByText('Your call.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reshuffle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bid 1 clubs', exact: true }).click();
  expect(handStrength((await snapshot(page)).hands[0])).toBe(0);
  await expect(page.getByRole('button', { name: 'Reshuffle', exact: true })).toHaveCount(0);
});
test('bidding and partner panels share their footprint and even hand spacing', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await create(page);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const measure = async () => {
    const username = (await page.locator('[data-seat=bottom] .seat-username').boundingBox())!;
    const panel = (await page.locator('.round-control-slot > .inline-controls').boundingBox())!;
    const selectors = (await page.locator('.round-control-slot .partner-pickers').boundingBox())!;
    const action = (await page.locator('.round-control-slot .bidding-controls > .flex').boundingBox())!;
    const hand = (await page.locator('.hand-area').boundingBox())!;
    return { panel, selectors, action, above: panel.y - username.y - username.height, below: hand.y - panel.y - panel.height };
  };
  const bidding = await measure();
  await page.screenshot({ path: 'test-results/short-bidding-' + info.project.name + '.png', animations: 'disabled' });
  expect(bidding.panel.height).toBeLessThan(150);
  expect(Math.abs(bidding.above - bidding.below)).toBeLessThan(4);
  const state = await snapshot(page);
  await seed(page, { phase: 'partner', declarer: 0, partner: state.hands[0][0] });
  const partner = await measure();
  await page.screenshot({ path: 'test-results/short-partner-' + info.project.name + '.png', animations: 'disabled' });
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(partner.panel[key] - bidding.panel[key])).toBeLessThan(1);
  for (const part of ['selectors', 'action'] as const) for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(partner[part][key] - bidding[part][key])).toBeLessThan(1);
  expect(Math.abs(partner.above - partner.below)).toBeLessThan(4);
  await expect(page.getByRole('button', { name: /^Call .*card in your hand/ })).toBeDisabled();
  await expect(page.locator('.partner-controls .bidding-controls > .flex button')).toHaveText('Card in your hand');
  const call = (await page.locator('.partner-controls .bidding-controls > .flex button').boundingBox())!;
  expect(Math.abs(call.x - partner.action.x)).toBeLessThan(1);
  expect(Math.abs(call.width - partner.action.width)).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Pass' })).toHaveCount(0);
});
test('rules slides use the original playful illustrations and bundled font', async ({ page }, info) => {
  await page.goto('/rules');
  await expect(page.locator('.deal-graphic .suit-icon')).toHaveCount(4);
  await expect(page.locator('.deal-graphic small')).toHaveCount(4);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.dealer-graphic small')).toHaveText('Dealer');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.bid-graphic .suit-icon')).toHaveAttribute('src', '/icons/spade.png');
  await expect(page.locator('.bid-graphic strong')).toHaveCSS('font-family', /Bricolage Grotesque/);
  await page.screenshot({ path: 'test-results/rules-bid-' + info.project.name + '.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.partner-graphic .crown')).toBeVisible();
  await expect(page.locator('.partner-graphic .card-art')).toHaveAttribute('src', '/card-previews/hearts/hK.png');
  await expect.poll(() => page.locator('.partner-graphic .card-art').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.trick-graphic .playing-card')).toHaveCount(4);
  await expect(page.locator('.trick-graphic .card-art').first()).toHaveAttribute('src', '/card-previews/spades/s3.png');
  await expect.poll(() => page.locator('.trick-graphic .card-art').evaluateAll((images: HTMLImageElement[]) => images.every(image => image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/rules-trick-' + info.project.name + '.png', animations: 'disabled' });
});
test('isolated reshuffle preview shows the same covering animation', async ({ page }) => {
  await page.goto('/dev/reshuffle');
  await expect(page.getByRole('heading', { name: 'Reshuffle preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Reshuffle' }).click();
  await expect(page.locator('.hand-area .shuffle-notice')).toBeVisible();
  await expect(page.locator('.hand-area .shuffle-notice')).toHaveCount(0, { timeout: 5000 });
});
test('completed scores remain on the leaderboard after a game closes', async ({ page }) => {
  await create(page);
  const id = new URL(page.url()).searchParams.get('game')!;
  await seed(page, { wins: { you: 2, marcus: 0, rachel: 0, wei: 0 }, games: { you: 3, marcus: 0, rachel: 0, wei: 0 } });
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  expect(await page.evaluate(gameId => sessionStorage.getItem('bridge-session:' + gameId), id)).toBeNull();
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await expect(page.getByText('2 wins in 3 games')).toBeVisible();
});
test('weak hands can request a reshuffle, announce it, and reset bidding', async ({ page }, info) => {
  await create(page);
  const state = await snapshot(page);
  // Give the viewer thirteen low cards distributed across suits: no honours or length points.
  const all = state.hands.flat(); const weak = all.filter((c: { rank: string }) => ['2','3','4'].includes(c.rank)); weak.push(all.find((c: { rank: string; suit: string }) => c.rank === '5' && c.suit === 'clubs'));
  const ids = new Set(weak.map((c: { id: string }) => c.id)); const rest = all.filter((c: { id: string }) => !ids.has(c.id));
  expect(handStrength(weak)).toBe(0);
  const equal = weak.map((c: { rank: string; suit: string }) => c.rank === '5' && c.suit === 'clubs' ? all.find((item: { rank: string; suit: string }) => item.rank === 'J' && item.suit === 'clubs') : c);
  await seed(page, { phase: 'bidding', reshuffleEnabled: true, reshuffleThreshold: 1, hands: [equal, rest.slice(0,13), rest.slice(13,26), rest.slice(26)] });
  await expect(page.getByRole('button', { name: 'Reshuffle', exact: true })).toHaveCount(0);
  await seed(page, { phase: 'bidding', reshuffleEnabled: true, reshuffleThreshold: 1, hands: [weak, rest.slice(0,13), rest.slice(13,26), rest.slice(26)] });
  await page.getByRole('button', { name: 'Reshuffle', exact: true }).click();
  await expect(page.getByText('@you requested a reshuffle')).toBeVisible();
  await expect(page.getByRole('button', { name: /Bid 1 clubs/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/session-shuffle-' + info.project.name + '.png', animations: 'disabled' });
  await expect(page.locator('.shuffle-notice')).toHaveCount(0, { timeout: 5000 });
  const after = await snapshot(page); expect(after.hands).not.toEqual([weak, rest.slice(0,13), rest.slice(13,26), rest.slice(26)]); expect(after.hands.every((h: unknown[]) => h.length === 13)).toBeTruthy(); expect(after.auction.highest).toBeNull();
});
test('completed trick pauses, awards session wins once, and feeds percentage leaderboard', async ({ page }, info) => {
  await create(page);
  const card = (rank: string, suit: string) => ({ id: rank + '-' + suit, rank, suit });
  await seed(page, { phase: 'playing', bid: { level: 7, suit: 'no-trump' }, declarer: 0, partnerSeat: 2, counts: [0,0,0,0], plays: [ { seat: 0, card: card('2','clubs') }, { seat: 1, card: card('A','clubs') }, { seat: 2, card: card('3','clubs') }, { seat: 3, card: card('4','clubs') } ], trickStatus: 'holding' });
  await expect(page.locator('.table-play')).toHaveCount(4); await page.waitForTimeout(1300);
  await expect(page.locator('.table-play')).toHaveCount(4); await expect(page.locator('.trick-layer')).not.toHaveClass(/collecting/);
  await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', 'ended', { timeout: 5000 });
  await expect(page.locator('.win-bounce')).toHaveCount(2);
  expect((await snapshot(page)).wins).toEqual({ you: 0, marcus: 1, rachel: 0, wei: 1 });
  await page.screenshot({ path: 'test-results/session-ended-' + info.project.name + '.png', animations: 'disabled' });
  await page.reload(); expect((await snapshot(page)).wins.marcus).toBe(1);
  await page.getByRole('button', { name: 'Play another round' }).click(); await expect(page.locator('[data-seat=left] .dealer-badge')).toBeVisible(); await expect(page.locator('.kick-player')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back home' }).click(); await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await page.getByRole('button', { name: 'Win percentage', exact: true }).click(); await expect(page.getByText('1 wins in 1 games')).toHaveCount(2); await expect(page.locator('.wins-list strong').filter({ hasText: '100%' })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/session-leaderboard-' + info.project.name + '.png', animations: 'disabled' });
});
test('random auction defaults, partner call, two-tap play and selected-card resume', async ({ page }) => {
  test.setTimeout(60000);
  await create(page); await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('button', { name: 'Bid 1 clubs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bid 1 hearts', exact: true })).toBeEnabled({ timeout: 6000 });
  await page.getByLabel('Bid level').selectOption('7'); await page.getByLabel('Bid suit').selectOption('no-trump');
  await page.getByRole('button', { name: 'Bid 7 no-trump', exact: true }).click();
  await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', 'partner', { timeout: 6000 });
  const state = await snapshot(page); expect(state.hands[0].some((c: { id: string }) => c.id === state.partner.id)).toBeFalsy();
  expect(state.hands[state.partnerSeat].some((c: { id: string }) => c.id === state.partner.id)).toBeTruthy();
  await page.getByRole('button', { name: /^Call / }).click();
  await expect(page.locator('[data-seat=left]')).toHaveClass(/is-turn/);
  const card = page.locator('.minimal-hand .playing-card:enabled').first(); await expect(card).toBeVisible({ timeout: 6000 });
  const name = await card.getAttribute('aria-label'); await card.click({ position: { x: 10, y: 18 } }); await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back home' }).click(); await page.getByRole('button', { name: 'Resume game' }).click();
  const selected = page.getByRole('button', { name: name!, exact: true }); await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await selected.click({ position: { x: 10, y: 18 } }); await expect(page.locator('.minimal-hand .playing-card')).toHaveCount(12);
  await expect(page.locator('.table-play')).toHaveCount(4);
  await page.getByRole('button', { name: 'Kick @marcus' }).click(); await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', 'waiting');
  expect((await snapshot(page)).wins).toEqual({ you: 0, marcus: 0, rachel: 0, wei: 0 });
});

test('clear table geometry, inward labels and matching round actions', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await create(page);
  const start = (await page.getByRole('button', { name: 'Start game', exact: true }).boundingBox())!;
  const title = (await page.locator('.table-title').boundingBox())!;
  expect(Math.abs(title.x + title.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Game invite link' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Quit', exact: true })).toHaveCSS('border-radius', '50%');
  await expect(page.locator('.trick-count')).toHaveCount(0);
  await expect(page.locator('.kick-player').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (const position of ['left', 'right', 'top', 'bottom']) {
    const icon = (await page.locator('[data-seat=' + position + '] .seat-avatar-button').boundingBox())!;
    const label = (await page.locator('[data-seat=' + position + '] .session-wins').boundingBox())!;
    if (position === 'left') expect(label.x).toBeGreaterThan(icon.x + icon.width);
    if (position === 'right') expect(label.x + label.width).toBeLessThan(icon.x);
    if (position === 'top') expect(label.y).toBeGreaterThan(icon.y + icon.height);
    if (position === 'bottom') expect(label.y + label.height).toBeLessThan(icon.y);
  }
  await seed(page, { phase: 'bidding', bids: [{ level: 1, suit: 'clubs' }, 'Pass', 'Pass', 'Pass'] });
  await expect(page.locator('.trick-count')).toHaveCount(0);
  await expect(page.locator('.seat-bid').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: 'test-results/clear-bidding-' + info.project.name + '.png', animations: 'disabled' });
  await seed(page, { phase: 'partner' });
  await expect(page.locator('.trick-count')).toHaveCount(0);
  const card = (rank: string) => ({ id: rank + '-clubs', rank, suit: 'clubs' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await seed(page, { phase: 'playing', plays: [0,1,2,3].map(seat => ({ seat, card: card(String(seat + 2)) })), trickStatus: 'holding' });
  await expect(page.locator('.trick-count .trick-pile')).toHaveCount(4);
  await expect(page.locator('.table-play .card-art').first()).toHaveAttribute('src', '/cards/clubs/c2.png');
  await expect(page.locator('.table-play .table-card-rank')).toHaveCount(4);
  await expect(page.locator('.minimal-hand .table-card-rank')).toHaveCount(0);
  const rects = await page.locator('.table-play .card-trick').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  expect(rects[0].right - rects[0].x).toBeGreaterThanOrEqual(63);
  expect(rects[0].bottom - rects[0].y).toBeGreaterThanOrEqual(85);
  const seatRects = await page.locator('.seat-avatar-button, .seat-username, .trick-count, .crown').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { name: el.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  await page.screenshot({ path: 'test-results/clear-four-cards-' + info.project.name + '.png', animations: 'disabled' });
  const overlaps = (a: typeof rects[number], b: typeof rects[number]) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBeFalsy();
    for (const seat of seatRects) expect(overlaps(rects[i], seat), JSON.stringify({ card: rects[i], seat })).toBeFalsy();
  }
  await seed(page, { phase: 'ended' });
  const again = (await page.getByRole('button', { name: 'Play another round' }).boundingBox())!;
  expect(again).toEqual(start);
  await expect(page.getByRole('button', { name: 'Play another round' })).toHaveCSS('font-size', '20px');
  await page.screenshot({ path: 'test-results/clear-ended-' + info.project.name + '.png', animations: 'disabled' });
});

test('seat labels, suits, outcome copy and raised hand fit the phone table', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await create(page);
  const startAction = (await page.getByRole('button', { name: 'Start game', exact: true }).boundingBox())!;
  const startButtonBottom = startAction.y + startAction.height;
  const initialSuit = await page.locator('.centre-suit-slide img').getAttribute('src');
  await expect.poll(() => page.locator('.centre-suit-slide img').getAttribute('src')).not.toBe(initialSuit);
  for (const seat of ['bottom', 'left', 'top', 'right']) {
    const icon = (await page.locator(`[data-seat=${seat}] .seat-avatar-button`).boundingBox())!;
    const tag = (await page.locator(`[data-seat=${seat}] .seat-username`).boundingBox())!;
    expect(Math.abs(tag.y - (icon.y + icon.height) - 2)).toBeLessThan(2);
  }
  const topIcon = (await page.locator('[data-seat=top] .seat-avatar-button').boundingBox())!;
  const topKick = (await page.locator('[data-seat=top] .kick-player').boundingBox())!;
  expect(topKick.x + topKick.width).toBeGreaterThan(topIcon.x + 3);
  expect(topKick.x + topKick.width).toBeLessThanOrEqual(topIcon.x + 13);
  expect(topKick.y).toBeLessThan(topIcon.y);
  expect(topKick.y + topKick.height).toBeLessThan(topIcon.y + topIcon.height / 2);
  for (const side of ['left', 'right']) {
    const icon = (await page.locator(`[data-seat=${side}] .seat-avatar-button`).boundingBox())!;
    const kick = (await page.locator(`[data-seat=${side}] .kick-player`).boundingBox())!;
    expect(kick.y).toBeLessThan(icon.y);
    expect(kick.y + kick.height).toBeLessThan(icon.y + icon.height / 2);
    if (side === 'left') {
      expect(kick.x + kick.width).toBeGreaterThan(icon.x + 3);
      expect(kick.x + kick.width).toBeLessThanOrEqual(icon.x + 13);
    } else {
      expect(kick.x).toBeLessThan(icon.x + icon.width - 3);
      expect(kick.x).toBeGreaterThanOrEqual(icon.x + icon.width - 13);
    }
  }
  await seed(page, { phase: 'bidding', auction: { highest: { level: 4, suit: 'hearts' }, bidder: 1, turn: 0, passes: 0, complete: false, allPassed: false } });
  await expect(page.locator('.centre-bid-suit')).toContainText('4');
  await expect(page.locator('.centre-bid-suit img')).toHaveAttribute('src', '/icons/heart.png');
  await seed(page, { phase: 'playing', plays: [{ seat: 0, card: { id: '2-clubs', rank: '2', suit: 'clubs' } }, { seat: 1, card: { id: 'A-clubs', rank: 'A', suit: 'clubs' } }, { seat: 2, card: { id: '3-clubs', rank: '3', suit: 'clubs' } }, { seat: 3, card: { id: '4-clubs', rank: '4', suit: 'clubs' } }], trickStatus: 'holding' });
  const topCount = (await page.locator('[data-seat=top] .trick-count').boundingBox())!;
  const topIconDuringPlay = (await page.locator('[data-seat=top] .seat-avatar-button').boundingBox())!;
  expect(topCount.x).toBeGreaterThan(topIconDuringPlay.x + topIconDuringPlay.width);
  expect(topCount.x - topIconDuringPlay.x - topIconDuringPlay.width).toBeLessThan(8);
  expect(Math.abs(topCount.y + topCount.height / 2 - topIconDuringPlay.y - topIconDuringPlay.height / 2)).toBeLessThan(2);
  const hand = (await page.locator('.minimal-hand .playing-card').first().boundingBox())!;
  const handBottom = hand.y + hand.height;
  expect(Math.abs(handBottom - startButtonBottom)).toBeLessThan(50);
  await page.screenshot({ path: 'test-results/new-table-' + info.project.name + '.png', animations: 'disabled' });
  await seed(page, { phase: 'ended', counts: [9, 0, 0, 0] });
  await expect(page.getByText('Win liao, power lah!')).toBeVisible();
  await expect(page.getByText('Round complete.')).toBeVisible();
  await page.screenshot({ path: 'test-results/win-message-' + info.project.name + '.png', animations: 'disabled' });
  await seed(page, { phase: 'ended', counts: [0, 5, 0, 0] });
  await expect(page.getByText('Walao, cannot make it sia...')).toBeVisible();
  const headline = (await page.locator('.winner-message h1').boundingBox())!;
  const leftScore = (await page.locator('[data-seat=left] .session-wins').boundingBox())!;
  const rightScore = (await page.locator('[data-seat=right] .session-wins').boundingBox())!;
  expect(headline.x).toBeGreaterThan(leftScore.x + leftScore.width);
  expect(headline.x + headline.width).toBeLessThan(rightScore.x);
  await page.screenshot({ path: 'test-results/loss-message-' + info.project.name + '.png', animations: 'disabled' });
});
