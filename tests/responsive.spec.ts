import { expect, test } from '@playwright/test';
import { seatUsernameFontSize } from '../src/components/game/TableSeat';

test('usernames keep their base size through twelve characters and shrink after', () => {
  expect(seatUsernameFontSize('@wwwwwwwwwwww', 130)).toBe(11);
  expect(seatUsernameFontSize('@wwwwwwwwwwwww', 130)).toBeLessThan(11);
  expect(seatUsernameFontSize('@wwwwwwwwwwww', 160)).toBeLessThan(11);
});

test('short portrait keeps the table clear and landscape puts the hand beside it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  const stage = page.locator('.circle-stage');
  expect((await stage.boundingBox())!.width).toBeGreaterThanOrEqual(280);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const key = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(game => {
    const key = `bridge-session:${game}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    const plays = [0, 1, 2, 3].map(seat => ({ seat, card: state.hands[seat][0] }));
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', plays, trickStatus: 'holding', announcementUntil: null }));
  }, key);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: 'test-results/responsive-portrait.png', animations: 'disabled' });
  const overlaps = await page.evaluate(() => {
    const rects = (selector: string) => [...document.querySelectorAll(selector)].map(element => element.getBoundingClientRect());
    const cards = rects('.table-play .card-trick');
    const seats = rects('.seat-avatar-button, .seat-username, .trick-count, .crown');
    return cards.flatMap((card, index) => [...cards.slice(index + 1), ...seats].filter(other => card.left < other.right && card.right > other.left && card.top < other.bottom && card.bottom > other.top).map(other => ({ card: card.toJSON(), other: other.toJSON() })));
  });
  expect(overlaps).toHaveLength(0);
  await page.setViewportSize({ width: 430, height: 932 });
  expect((await stage.boundingBox())!.width).toBeGreaterThan(350);
  await page.setViewportSize({ width: 800, height: 500 });
  const table = (await stage.boundingBox())!;
  const hand = (await page.locator('.minimal-hand').boundingBox())!;
  expect(table.x + table.width).toBeLessThan(hand.x);
  expect(Math.abs(hand.y + hand.height / 2 - 250)).toBeLessThan(1);
  await page.setViewportSize({ width: 667, height: 375 });
  const narrowTable = (await stage.boundingBox())!;
  const narrowHand = (await page.locator('.minimal-hand').boundingBox())!;
  expect(narrowTable.x + narrowTable.width).toBeLessThan(narrowHand.x);
  expect(Math.abs(narrowHand.y + narrowHand.height / 2 - 187.5)).toBeLessThan(1);
});

test('four by three layouts keep the table, hand, and controls in their assigned spaces', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 520 });
  const portraitTop = await page.locator('.seat-avatar-button, .seat-username, .play-orbit, .kick-player').evaluateAll(elements => Math.min(...elements.map(element => element.getBoundingClientRect().top)));
  const portraitHand = (await page.locator('.minimal-hand').boundingBox())!;
  const portraitControls = (await page.locator('.round-control-slot').boundingBox())!;
  expect(portraitTop).toBeGreaterThanOrEqual(83.5);
  expect(Math.abs(portraitHand.y + portraitHand.height + 20 - portraitControls.y)).toBeLessThan(1);
  expect(Math.abs(520 - portraitControls.y - portraitControls.height - 50)).toBeLessThan(1);
  await page.setViewportSize({ width: 800, height: 600 });
  await expect.poll(async () => {
    return page.locator('.seat-avatar-button, .seat-username, .play-orbit, .kick-player').evaluateAll(elements => {
      const boxes = elements.map(element => element.getBoundingClientRect());
      return Math.abs((Math.min(...boxes.map(box => box.top)) + Math.max(...boxes.map(box => box.bottom))) / 2 - 300);
    });
  }).toBeLessThan(1);
  const group = (await page.locator('.table-group-frame').boundingBox())!;
  const hand = (await page.locator('.minimal-hand').boundingBox())!;
  const controls = (await page.locator('.round-control-slot').boundingBox())!;
  expect(group.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(hand.y + hand.height / 2 - 300)).toBeLessThan(1);
  const visibleRight = await page.locator('.seat-avatar-button, .seat-username, .play-orbit, .kick-player, .seat-bid').evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().right)));
  expect(hand.x - visibleRight).toBeGreaterThanOrEqual(19.5);
  expect(Math.abs(controls.y - hand.y - hand.height - 20)).toBeLessThan(1);
});

test('landscape starts at any wide ratio and preserves the center gutter', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  for (const [width, height] of [[400, 250], [550, 450], [800, 600], [838, 451], [1200, 1100]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.minimal-table')).toHaveAttribute('data-layout', 'landscape');
    await expect.poll(async () => {
      const orbit = (await page.locator('.play-orbit').boundingBox())!;
      return Math.abs(orbit.y + orbit.height / 2 - height / 2);
    }).toBeLessThan(width === 838 ? 14 : 1);
    await page.locator('.round-control-slot > .inline-controls').evaluate(element => element.getAnimations().forEach(animation => animation.finish()));
    const hand = (await page.locator('.minimal-hand').boundingBox())!;
    const controls = (await page.locator('.round-control-slot').boundingBox())!;
    const panel = (await page.locator('.round-control-slot > .inline-controls').boundingBox())!;
    const visibleRight = await page.locator('.seat-avatar-button, .seat-username, .play-orbit, .kick-player, .seat-bid').evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().right)));
    expect(hand.x - visibleRight, `${width}x${height}`).toBeGreaterThanOrEqual(19.5);
    expect(Math.abs(hand.y + hand.height / 2 - height / 2)).toBeLessThan(1);
    expect(Math.abs(controls.y - hand.y - hand.height - 20)).toBeLessThan(1);
    expect(controls.y + controls.height).toBeLessThanOrEqual(height - 19);
    expect(panel.y + panel.height).toBeLessThanOrEqual(height - 19);
    expect(panel.x).toBeGreaterThanOrEqual(hand.x - 1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width - 19);
    const inputBoxes = await page.locator('.round-control-slot button, .round-control-slot select').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
    for (const box of inputBoxes) {
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.right).toBeLessThanOrEqual(panel.x + panel.width);
      expect(box.bottom).toBeLessThanOrEqual(panel.y + panel.height);
    }
    await page.screenshot({ path: `test-results/game-landscape-${width}x${height}.png`, animations: 'disabled' });
  }
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', announcementUntil: null }));
  }, game);
  await page.setViewportSize({ width: 838, height: 451 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(async () => (await page.locator('.position-bottom .trick-count').boundingBox())!.y + (await page.locator('.position-bottom .trick-count').boundingBox())!.height).toBeLessThanOrEqual(431);
});

test('partner call shows the card for three seconds without naming its holder', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', announcementUntil: Date.now() + 3000, playTurn: 1 }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const announcement = page.locator('.partner-announcement');
  await expect(announcement).toContainText('Partner called');
  await expect(announcement.locator('img')).toHaveAttribute('alt', /of/);
  await expect(announcement).not.toContainText('Marcus');
  await page.screenshot({ path: 'test-results/partner-call.png', animations: 'disabled' });
  await expect(announcement).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.play-turn-message')).toContainText('to play');
});

test('the score stays twenty pixels above the landscape hand', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', announcementUntil: null }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const hand = (await page.locator('.minimal-hand').boundingBox())!;
  const score = (await page.locator('.round-scoreboard').boundingBox())!;
  expect(Math.abs(hand.y - score.y - score.height - 20)).toBeLessThan(1);
  expect(score.x).toBeGreaterThanOrEqual(410);
  expect(Math.abs(hand.y + hand.height / 2 - 300)).toBeLessThan(1);
});

test('played cards leave a centered hand with five pixel gaps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  for (const count of [13, 4, 3, 1]) {
    await page.evaluate(({ id, count }) => {
      const key = `bridge-session:${id}`;
      const state = JSON.parse(sessionStorage.getItem(key)!);
      const hands = [...state.hands];
      hands[0] = hands[0].slice(0, count);
      sessionStorage.setItem(key, JSON.stringify({ ...state, hands, phase: 'playing', announcementUntil: null, playTurn: 0 }));
    }, { id: game, count });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const hand = (await page.locator('.minimal-hand').boundingBox())!;
    const cards = await page.locator('.minimal-hand .playing-card').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
    expect(cards).toHaveLength(count);
    expect(Math.abs(cards[0].width - 80)).toBeLessThan(1);
    if (count <= 4) {
      for (let index = 1; index < count; index++) expect(Math.abs(cards[index].x - cards[index - 1].right - 5)).toBeLessThan(1);
      expect(Math.abs((cards[0].x + cards[count - 1].right) / 2 - (hand.x + hand.width / 2))).toBeLessThan(1);
    }
  }
});

test('default usernames use the reduced font without clipping', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  const labels = await page.locator('.circle-seat .seat-username').evaluateAll(elements => elements.map(element => ({ text: element.textContent, font: getComputedStyle(element).fontSize, width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })));
  expect(labels).toHaveLength(4);
  for (const label of labels) {
    expect(label.font).toBe('11px');
    expect(label.width).toBeGreaterThan(10);
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
  }
  expect(labels.some(label => label.text === '@wwwwwwwwwwww')).toBeTruthy();
});

test('leaderboard rows align and only the current player has an outlined avatar', async ({ page }) => {
  await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
  const rows = await page.locator('.wins-list li').evaluateAll(elements => elements.map(element => {
    const avatar = element.querySelector('.member-avatar')!.getBoundingClientRect();
    const name = element.querySelector('.leader-name')!.getBoundingClientRect();
    const result = element.querySelector('strong')!.getBoundingClientRect();
    return { avatarX: avatar.x, nameX: name.x, resultRight: result.right, current: element.classList.contains('current-player'), avatarBorder: getComputedStyle(element.querySelector('.member-avatar')!).borderColor, nameWeight: getComputedStyle(element.querySelector('.leader-name')!).fontWeight };
  }));
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(Math.abs(row.avatarX - rows[0].avatarX)).toBeLessThan(1);
    expect(Math.abs(row.nameX - rows[0].nameX)).toBeLessThan(1);
    expect(Math.abs(row.resultRight - rows[0].resultRight)).toBeLessThan(1);
  }
  expect(rows.filter(row => row.current)).toHaveLength(1);
  expect(rows.find(row => row.current)!.nameWeight).toBe('800');
  expect(rows.find(row => row.current)!.avatarBorder).not.toBe(rows.find(row => !row.current)!.avatarBorder);
  await page.screenshot({ path: 'test-results/leaderboard-aligned.png', animations: 'disabled' });
});

test('leaderboard entries scroll without moving the page', async ({ page }) => {
  await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
  let scrollCases = 0;
  for (const viewport of [{ width: 320, height: 400 }, { width: 390, height: 250 }, { width: 838, height: 451 }]) {
    await page.setViewportSize(viewport);
    await page.locator('.wins-list').evaluate(element => { element.scrollTop = 0; });
    const overflow = await page.locator('.wins-list').evaluate(element => element.scrollHeight > element.clientHeight + 1);
    if (overflow) {
      scrollCases++;
      await expect(page.locator('.leader-scroll')).toHaveClass(/has-more/);
    } else await expect(page.locator('.leader-scroll')).not.toHaveClass(/has-more/);
    if (overflow && scrollCases === 1) await page.screenshot({ path: 'test-results/leaderboard-scroll-shadow.png', animations: 'disabled' });
    const positions = await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>('.wins-list')!;
      const header = document.querySelector<HTMLElement>('.info-header')!;
      const views = document.querySelector<HTMLElement>('.leader-views')!;
      const before = { header: header.getBoundingClientRect().y, views: views.getBoundingClientRect().y };
      list.scrollTop = list.scrollHeight;
      return { pageHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight, listScroll: list.scrollTop, before, after: { header: header.getBoundingClientRect().y, views: views.getBoundingClientRect().y } };
    });
    expect(positions.pageHeight).toBeLessThanOrEqual(positions.viewportHeight);
    if (overflow) expect(positions.listScroll).toBeGreaterThan(0);
    expect(positions.after).toEqual(positions.before);
    await expect(page.locator('.leader-scroll')).not.toHaveClass(/has-more/);
  }
  expect(scrollCases).toBeGreaterThan(0);
});

test('resume game has a play icon', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Back home' }).click();
  await expect(page.getByRole('button', { name: 'Resume game' }).locator('svg')).toBeVisible();
});

test('bidding fills the portrait clear area and keeps every name visible', async ({ page }) => {
  await page.setViewportSize({ width: 557, height: 795 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const layout = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.play-orbit, .seat-avatar-button, .seat-username, .kick-player, .seat-bid')].map(element => element.getBoundingClientRect());
    const labels = [...document.querySelectorAll('.seat-username')].map(element => ({ height: element.getBoundingClientRect().height, text: element.textContent }));
    const frame = document.querySelector<HTMLElement>('.minimal-table')!;
    const orbit = document.querySelector('.play-orbit')!.getBoundingClientRect();
    return { left: Math.min(...rects.map(rect => rect.left)), right: Math.max(...rects.map(rect => rect.right)), top: Math.min(...rects.map(rect => rect.top)), bottom: Math.max(...rects.map(rect => rect.bottom)), circleCenterX: orbit.left + orbit.width / 2, headerBottom: document.querySelector('.table-header')!.getBoundingClientRect().bottom, handTop: document.querySelector('.minimal-hand')!.getBoundingClientRect().top, groupSize: frame.style.getPropertyValue('--group-size'), groupTop: frame.style.getPropertyValue('--group-top'), labels };
  });
  expect(layout.labels).toHaveLength(4);
  for (const label of layout.labels) { expect(label.text).toMatch(/^@/); expect(label.height).toBeGreaterThan(10); }
  expect(layout.left).toBeGreaterThanOrEqual(19);
  expect(layout.right).toBeLessThanOrEqual(538);
  expect(layout.top - layout.headerBottom).toBeGreaterThanOrEqual(19);
  expect(layout.handTop - layout.bottom).toBeGreaterThanOrEqual(19);
  await page.screenshot({ path: 'test-results/bidding-557x795.png', animations: 'disabled' });
  expect(layout.right - layout.left, JSON.stringify(layout)).toBeGreaterThan(430);
  expect(Math.abs(layout.circleCenterX - 557 / 2)).toBeLessThan(.1);
  expect(Math.min(layout.top - layout.headerBottom, layout.handTop - layout.bottom)).toBeLessThan(35);
});

test('hand and table card labels keep the same proportion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', plays: [{ seat: 1, card: state.hands[1][0] }], announcementUntil: null }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const tags = await page.evaluate(() => {
    const size = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().width;
    return { handCard: size('.minimal-hand .playing-card'), handTag: size('.minimal-hand .table-card-rank'), tableCard: size('.table-play .playing-card'), tableTag: size('.table-play .table-card-rank') };
  });
  expect(tags.handTag / tags.handCard).toBeGreaterThan(.3);
  expect(Math.abs(tags.handTag / tags.handCard - tags.tableTag / tags.tableCard)).toBeLessThan(.02);
});

test('circular table, quadrant seats, crown, and twenty pixel page inset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  const header = (await page.locator('.table-header').boundingBox())!;
  const action = (await page.getByRole('button', { name: 'Start game', exact: true }).boundingBox())!;
  expect(header.y).toBe(20);
  expect(Math.abs(844 - action.y - action.height - 50)).toBeLessThan(1);
  const orbit = (await page.locator('.play-orbit').boundingBox())!;
  const stage = (await page.locator('.circle-stage').boundingBox())!;
  expect(Math.abs(orbit.width - orbit.height)).toBeLessThan(1);
  expect(Math.abs(orbit.width / stage.width - .68)).toBeLessThan(.01);
  for (const [seat, x, y] of [['top', .5, .145], ['right', .855, .5], ['bottom', .5, .855], ['left', .145, .5]] as const) {
    const icon = (await page.locator(`[data-seat=${seat}] .seat-avatar-button`).boundingBox())!;
    expect(Math.abs(icon.x + icon.width / 2 - stage.x - stage.width * x)).toBeLessThan(1);
    expect(Math.abs(icon.y + icon.height / 2 - stage.y - stage.height * y)).toBeLessThan(1);
  }
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.getByText(/To beat/i)).toHaveCount(0);
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', declarer: 0, announcementUntil: null }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const icon = (await page.locator('[data-seat=bottom] .seat-avatar-button').boundingBox())!;
  const crown = (await page.locator('[data-seat=bottom] .crown').boundingBox())!;
  expect((await page.locator('.table-header').boundingBox())!.y).toBe(20);
  expect(crown.x + crown.width / 2).toBeGreaterThan(icon.x + icon.width / 2);
  expect(crown.y + crown.height).toBeGreaterThan(icon.y);
  await page.screenshot({ path: 'test-results/circle-and-crown.png', animations: 'disabled' });
});

test('portrait frame scales down, keeps clearances, centres the table, and caps tall screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    const plays = [0, 1, 2, 3].map(seat => ({ seat, card: state.hands[seat][0] }));
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'playing', plays, trickStatus: 'holding', announcementUntil: null }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  let shortTableWidth = 0;
  for (const [width, height] of [[390, 520], [320, 568], [390, 700], [390, 844], [430, 932], [390, 1100]]) {
    await page.setViewportSize({ width, height });
    if ([520, 568, 700, 1100].includes(height)) await page.screenshot({ path: `test-results/frame-${width}x${height}.png`, fullPage: true, animations: 'disabled' });
    const layout = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const stage = box('.circle-stage');
      const header = box('.table-header');
      const score = box('.round-scoreboard');
      const hand = box('.minimal-hand');
      const cards = [...document.querySelectorAll('.table-play .card-trick')].map(el => el.getBoundingClientRect());
      const seats = [...document.querySelectorAll('.seat-avatar-button, .seat-username, .trick-count, .crown')].map(el => el.getBoundingClientRect());
      const groupContent = [...document.querySelectorAll('.play-orbit, .seat-avatar-button, .seat-username, .kick-player, .crown, .dealer-badge, .trick-count, .session-wins, .seat-bid, .table-play .card-trick, .table-center .center-message, .table-center .partner-announcement, .table-center .play-turn-message')].map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      const visualBottom = Math.max(...groupContent.map(rect => rect.bottom));
      const orbit = box('.play-orbit');
      const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        stage: { top: stage.top, bottom: stage.bottom, width: stage.width, visualMiddle: orbit.top + orbit.height / 2, visualBottom },
        targetMiddle: (header.bottom + hand.top - 90) / 2,
        scoreTop: score.top, scoreToHand: hand.top - score.bottom, handTop: hand.top, frameBottom: box('.minimal-table').bottom,
        font: Number.parseFloat(getComputedStyle(document.querySelector('.seat-username')!).fontSize),
        collisions: cards.flatMap((card, index) => [...cards.slice(index + 1), ...seats].filter(other => overlaps(card, other)).map(other => ({ card: card.toJSON(), other: other.toJSON() })))
      };
    });
    expect(layout.collisions, `${width}×${height}`).toHaveLength(0);
    expect(Math.abs(layout.stage.visualMiddle - layout.targetMiddle), `${width}×${height}: ${layout.stage.visualMiddle} vs ${layout.targetMiddle}`).toBeLessThan(3);
    expect(layout.stage.visualBottom).toBeLessThan(layout.scoreTop);
    expect(layout.scoreTop).toBeLessThan(layout.handTop);
    expect(Math.abs(layout.scoreToHand - 20)).toBeLessThan(1);
    if (height === 700) shortTableWidth = layout.stage.width;
    if (height === 844) expect(layout.stage.width).toBeGreaterThanOrEqual(shortTableWidth);
    if (height === 1100) expect(layout.frameBottom).toBe(1100);
  }
});

test('compact bidding keeps the controls and reshuffle button apart', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?reshuffleTest=1', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const controls = (await page.locator('.round-control-slot').boundingBox())!;
  const hand = (await page.locator('.minimal-hand').boundingBox())!;
  const reshuffle = (await page.getByRole('button', { name: 'Reshuffle', exact: true }).boundingBox())!;
  expect(Math.abs(hand.y - reshuffle.y - reshuffle.height - 5)).toBeLessThan(1);
  expect(hand.y + hand.height + 8).toBeLessThanOrEqual(controls.y);
  const buttons = await page.locator('.round-control-slot button, .round-control-slot select').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
  for (let index = 0; index < buttons.length; index++) {
    expect(buttons[index].x).toBeGreaterThanOrEqual(controls.x);
    expect(buttons[index].right).toBeLessThanOrEqual(controls.x + controls.width);
    for (let other = index + 1; other < buttons.length; other++) {
      expect(buttons[index].right <= buttons[other].x || buttons[other].right <= buttons[index].x || buttons[index].bottom <= buttons[other].y || buttons[other].bottom <= buttons[index].y).toBeTruthy();
    }
  }
  await page.screenshot({ path: 'test-results/compact-bidding.png', fullPage: true, animations: 'disabled' });
  const game = new URL(page.url()).searchParams.get('game')!;
  await page.evaluate(id => {
    const key = `bridge-session:${id}`;
    const state = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...state, phase: 'partner', declarer: 0, partner: state.hands[0][0] }));
  }, game);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const rank = (await page.getByLabel('Partner rank').boundingBox())!;
  const suit = (await page.getByLabel('Partner suit').boundingBox())!;
  const call = (await page.locator('.partner-controls .call-action').boundingBox())!;
  await page.screenshot({ path: 'test-results/compact-partner.png', fullPage: true, animations: 'disabled' });
  expect(rank.x + rank.width + 4).toBeLessThanOrEqual(suit.x);
  expect(suit.x + suit.width + 4).toBeLessThanOrEqual(call.x);
});

test('home fits without scrolling and keeps portrait actions fifty pixels from the bottom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[320, 568], [390, 520], [390, 844], [667, 375], [800, 600]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
    expect(fits, `${width}×${height}`).toBeTruthy();
    const last = (await page.getByRole('button', { name: 'How to play', exact: true }).boundingBox())!;
    if (height > width) expect(Math.abs(height - last.y - last.height - 50), `${width}×${height}`).toBeLessThan(2);
    await page.screenshot({ path: `test-results/home-${width}x${height}.png`, animations: 'disabled' });
  }
});

test('home buttons stay inside compact portrait and landscape columns', async ({ page }) => {
  for (const [width, height] of [[250, 250], [250, 320], [400, 250], [550, 450], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const bounds = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.home-buttons .btn')].map(el => el.getBoundingClientRect());
      const leftPadding = [...document.querySelectorAll('.home-buttons .btn')].map(el => getComputedStyle(el).paddingLeft);
      const textSizes = [...document.querySelectorAll('.home-buttons .btn')].map(el => ({ text: el.textContent, font: getComputedStyle(el).fontSize, scroll: el.scrollWidth, client: el.clientWidth }));
      const textFits = [...document.querySelectorAll('.home-buttons .btn')].every(el => el.scrollWidth <= el.clientWidth);
      return { hero: rect('.home-hero').toJSON(), buttonGroup: rect('.home-buttons').toJSON(), buttons: buttons.map(box => box.toJSON()), leftPadding, textSizes, textFits, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
    });
    expect(bounds.scrollWidth, `${width}x${height}`).toBeLessThanOrEqual(width);
    expect(bounds.scrollHeight, `${width}x${height}`).toBeLessThanOrEqual(height);
    expect(bounds.buttonGroup.x).toBeGreaterThanOrEqual(19);
    expect(bounds.buttonGroup.right).toBeLessThanOrEqual(width - 19);
    expect(bounds.textFits, `${width}x${height}: ${JSON.stringify(bounds.textSizes)}`).toBeTruthy();
    if (width > height) {
      expect(bounds.buttonGroup.x - bounds.hero.right).toBeGreaterThanOrEqual(19);
      expect(bounds.leftPadding).toEqual(bounds.leftPadding.map(() => '22px'));
    }
    await page.screenshot({ path: `test-results/compact-home-${width}x${height}.png`, animations: 'disabled' });
  }
});

test('resume and create share the first row when the home page is short', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.getByRole('button', { name: 'Back home' }).click();
  await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
  for (const [width, height] of [[250, 320], [390, 520], [667, 375]]) {
    await page.setViewportSize({ width, height });
    const resume = (await page.getByRole('button', { name: 'Resume game' }).boundingBox())!;
    const create = (await page.getByRole('button', { name: 'Create game', exact: true }).boundingBox())!;
    const leaders = (await page.getByRole('button', { name: 'Leaderboard', exact: true }).boundingBox())!;
    const rules = (await page.getByRole('button', { name: 'How to play', exact: true }).boundingBox())!;
    expect(Math.abs(resume.y - create.y)).toBeLessThan(2);
    expect(resume.x + resume.width).toBeLessThan(create.x);
    expect(Math.abs(leaders.y - rules.y)).toBeLessThan(1);
    expect(leaders.y).toBeGreaterThan(resume.y + resume.height);
    expect(rules.x + rules.width).toBeLessThanOrEqual(width - 19);
    await page.screenshot({ path: `test-results/resume-home-${width}x${height}.png`, animations: 'disabled' });
  }
});

test('rules slides fit without scrolling outside the leaderboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[320, 568], [390, 520], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/rules', { waitUntil: 'domcontentloaded' });
    for (const rule of [1, 3, 6]) {
      await page.getByRole('button', { name: `Rule ${rule}` }).click();
      const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
      expect(fits, `${width}×${height} rule ${rule}`).toBeTruthy();
      const actions = (await page.locator('.slide-actions').boundingBox())!;
      const back = (await page.getByRole('button', { name: 'Back home' }).boundingBox())!;
      const graphic = (await page.locator('.rule-graphic').boundingBox())!;
      const copy = (await page.locator('.rule-copy').boundingBox())!;
      const dots = (await page.locator('.slide-dots').boundingBox())!;
      expect(back.x).toBe(20);
      expect(back.y).toBe(20);
      expect(back.width).toBe(44);
      expect(Math.abs(graphic.y - back.y - back.height - 20)).toBeLessThan(1);
      expect(Math.abs(actions.y + actions.height - (height - (width > height ? 20 : 50)))).toBeLessThan(1);
      expect(Math.abs(actions.y - dots.y - dots.height - 20)).toBeLessThan(1);
      if (width > height) {
        expect(Math.abs(copy.x - graphic.x - graphic.width - 20)).toBeLessThan(1);
        expect(Math.abs(dots.y - graphic.y - graphic.height - 20)).toBeLessThan(1);
        expect(Math.abs(copy.x + copy.width - (width - 20))).toBeLessThan(1);
      } else {
        expect(Math.abs(copy.y - graphic.y - graphic.height - 20)).toBeLessThan(1);
        expect(Math.abs(dots.y - copy.y - copy.height - 20)).toBeLessThan(1);
      }
      expect(page.locator('.slide-number')).toHaveCount(0);
    }
    await page.screenshot({ path: `test-results/rules-${width}x${height}.png`, animations: 'disabled' });
  }
});

test('rules and leaderboard use the landscape center gutter', async ({ page }) => {
  await page.setViewportSize({ width: 550, height: 450 });
  await page.goto('/rules', { waitUntil: 'domcontentloaded' });
  const graphic = (await page.locator('.rule-graphic').boundingBox())!;
  const copy = (await page.locator('.rule-copy').boundingBox())!;
  expect(Math.abs(copy.x - graphic.x - graphic.width - 20)).toBeLessThan(1);
  await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
  const views = (await page.locator('.leader-views').boundingBox())!;
  const list = (await page.locator('.wins-list').boundingBox())!;
  expect(Math.abs(list.x - views.x - views.width - 20)).toBeLessThan(1);
});
