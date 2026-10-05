import { expect, test, type Page } from '@playwright/test';

async function openTable(page: Page, platform: string) {
  await page.route('https://telegram.org/js/telegram-web-app.js?63', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.Telegram={WebApp:{platform:${JSON.stringify(platform)},initData:"",ready(){},expand(){}}};`,
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.Telegram?.WebApp?.platform)).toBe(platform);
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
}

test('desktop lobby fills the free space and keeps settings on one line while resizing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTable(page, 'tdesktop');
  await expect(page.locator('.minimal-table')).toHaveAttribute('data-desktop', 'true');
  for (const [width, height] of [[307, 473], [384, 590], [320, 400], [390, 844], [576, 886], [800, 600], [550, 450]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('.minimal-table').evaluate(el => el.clientWidth)).toBe(width);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `.local/desktop-lobby-${width}x${height}.png`, animations: 'disabled' });
    const bounds = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const seats = [...document.querySelectorAll('.seat-avatar-button, .seat-username, .kick-player, .play-orbit')].map(el => el.getBoundingClientRect());
      const controls = box('.table-bottom');
      return {
        top: Math.min(...seats.map(b => b.top)), bottom: Math.max(...seats.map(b => b.bottom)),
        left: Math.min(...seats.map(b => b.left)), right: Math.max(...seats.map(b => b.right)),
        controls: controls.toJSON(), orbit: box('.play-orbit').toJSON(),
        settingsFit: [...document.querySelectorAll('.trump-toggle')].every(el => {
          const text = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE)!;
          const range = document.createRange(); range.selectNode(text);
          const rect = range.getBoundingClientRect(); const button = el.getBoundingClientRect();
          return range.getClientRects().length === 1 && rect.right <= button.right && el.scrollWidth <= el.clientWidth;
        }),
      };
    });
    expect(bounds.settingsFit, `${width}x${height}`).toBeTruthy();
    expect(bounds.left, JSON.stringify({ width, height, ...bounds })).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.controls.bottom).toBeLessThanOrEqual(height - 9);
    if (height >= width) {
      expect(bounds.top).toBeGreaterThanOrEqual(83);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.controls.top - 15);
      // Small desktop windows should use substantially more than the old tiny orbit.
      if (width === 307) expect(bounds.orbit.width).toBeGreaterThan(130);
      if (height < 600) expect(height - bounds.controls.bottom).toBeLessThan(25);
    } else {
      expect(bounds.right).toBeLessThan(bounds.controls.left);
    }
  }
});

test('mobile platforms retain the default table and control geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const layouts = [];
  for (const platform of ['unknown', 'android', 'ios']) {
    await openTable(page, platform);
    await expect(page.locator('.minimal-table')).not.toHaveAttribute('data-desktop');
    layouts.push(await page.locator('.table-group-frame, .table-bottom, .trump-toggle').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON())));
  }
  expect(layouts[1]).toEqual(layouts[0]);
  expect(layouts[2]).toEqual(layouts[0]);
});

test('desktop table stays clear of the hand and controls throughout a round', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTable(page, 'macos');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const game = new URL(page.url()).searchParams.get('game')!;
  for (const phase of ['bidding', 'partner', 'playing', 'ended']) {
    await page.evaluate(({ game, phase }) => {
      const key = `bridge-session:${game}`;
      const state = JSON.parse(sessionStorage.getItem(key)!);
      sessionStorage.setItem(key, JSON.stringify({ ...state, phase, announcementUntil: null, shuffling: false, shuffleReveal: false, shuffleStart: false, starting: false }));
    }, { game, phase });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.minimal-table')).toHaveAttribute('data-phase', phase);
    for (const [width, height] of [[307, 473], [390, 844], [800, 600], [1536, 640]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `.local/desktop-${phase}-${width}x${height}.png`, animations: 'disabled' });
      const bounds = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('.seat-avatar-button, .seat-username, .play-orbit, .trick-count, .crown')].map(el => el.getBoundingClientRect());
        const controls = document.querySelector('.table-bottom')!.getBoundingClientRect();
        const score = document.querySelector('.round-scoreboard')?.getBoundingClientRect();
        return { top: Math.min(...rects.map(b => b.top)), bottom: Math.max(...rects.map(b => b.bottom)), right: Math.max(...rects.map(b => b.right)), controls: controls.toJSON(), score: score?.toJSON() };
      });
      expect(bounds.controls.bottom, `${phase} ${width}x${height}`).toBeLessThanOrEqual(height);
      if (height >= width) {
        expect(bounds.top).toBeGreaterThanOrEqual(83);
        expect(bounds.bottom, JSON.stringify({ phase, width, height, ...bounds })).toBeLessThanOrEqual((bounds.score ?? bounds.controls).top - 10);
      } else {
        expect(bounds.controls.left - bounds.right).toBeGreaterThanOrEqual(40);
        expect(bounds.top).toBeGreaterThanOrEqual(84);
        expect(bounds.bottom).toBeLessThanOrEqual(height - 32);
      }
    }
  }
});
