import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = []; page.__errors = errors; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Snakeholm' }).click();
  await expect(page.getByRole('heading', { name: 'Who’s heading out?' })).toBeVisible();
});

test('name entry, start, board movement, pause, resume, and restart use explicit focus-safe controls', async ({ page }) => {
  const name = page.locator('#holm-name'); await name.fill('Ada');
  const start = page.getByRole('button', { name: 'Start expedition' }); await start.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.screenshot({ path: '.runtime/holm-desktop-running.png', fullPage: true });
  const frame = await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(160); expect(await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL())).not.toBe(frame);
  await page.keyboard.press('Space'); await expect(page.locator('[data-status]')).toHaveText('PAUSED');
  const paused = await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL()); await page.waitForTimeout(300);
  expect(await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL())).toBe(paused);
  await page.getByRole('button', { name: 'Resume expedition' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.keyboard.press('r'); await expect(page.locator('#holm-name')).toBeVisible();
  await expect(page.locator('[data-barbarian]')).toBeChecked();
  expect(page.__errors).toEqual([]);
});

test('editor typing and focused buttons keep native keyboard behavior; home returns to selector', async ({ page }) => {
  const input = page.locator('#holm-name'); await input.focus(); await page.keyboard.type('A Name');
  await expect(input).toHaveValue('A Name'); await page.keyboard.press('Space'); await expect(input).toHaveValue('A Name ');
  await input.fill('Ada'); await page.getByRole('button', { name: 'Start expedition' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.getByRole('button', { name: '↻ Restart' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#holm-name')).toBeVisible();
  await page.locator('.holm-home').click(); await expect(page.locator('#home')).toBeVisible();
  await page.getByRole('button', { name: 'Play Snakeholm' }).click(); await page.locator('#holm-name').fill('Grace');
  await page.locator('[data-barbarian]').uncheck(); await expect(page.locator('#holm-name')).toHaveValue('Grace');
  await page.locator('[data-barbarian]').check(); await expect(page.locator('#holm-name')).toHaveValue('Grace');
  await page.getByRole('button', { name: 'Start expedition' }).click(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expect(page.locator('[data-status]')).toHaveText('PAUSED');
  const pausedFrame = await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL()); await page.waitForTimeout(300);
  expect(await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL())).toBe(pausedFrame);
  await page.getByRole('button', { name: 'Resume expedition' }).click(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE'); expect(page.__errors).toEqual([]);
});

test('records a natural end once, renders a hostile-looking name as text, and exports local JSON', async ({ page }) => {
  await page.locator('#holm-name').fill('<b>Rae</b>'); await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.locator('[data-status]')).toHaveText(/TIME EXPIRED|NO POPULATION/, { timeout: 15000 });
  await expect(page.locator('[data-history] tr')).toHaveCount(1);
  expect(await page.locator('[data-history]').locator('b').count()).toBe(0);
  const rowText = await page.locator('[data-history]').innerText(); expect(rowText).toContain('<b>Rae</b>');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('parcade.holm.history.v1')));
  expect(saved).toHaveLength(1); expect(saved[0].name).toBe('<b>Rae</b>'); expect(saved[0].timestamp).toBeTruthy();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download local Snakeholm history as JSON' }).click();
  expect((await download).suggestedFilename()).toBe('snakeholm-history.json');
  expect(page.__errors).toEqual([]);
});

test('mobile board and controls fit 320px; real touch input changes the board and shortcuts ignore focused controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; }); await page.goto('/');
  await page.getByRole('button', { name: 'Play Snakeholm' }).tap(); await page.locator('#holm-name').fill('Jo');
  await page.getByRole('button', { name: 'Start expedition' }).tap(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  const width = await page.evaluate(() => document.documentElement.scrollWidth); expect(width).toBeLessThanOrEqual(320);
  const dims = await page.locator('.holm-board-wrap').evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight })); expect(dims.width).toBeLessThanOrEqual(296); expect(Math.abs(dims.width - dims.height)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '.runtime/holm-mobile-320.png', fullPage: true });
  const barb = page.locator('[data-barbarian-mobile]'); await expect(barb).toBeChecked(); await barb.tap(); await expect(barb).not.toBeChecked(); await expect(page.locator('[data-barbarian-side]')).not.toBeChecked();
  await barb.tap(); await expect(barb).toBeChecked(); await expect(page.locator('[data-barbarian-side]')).toBeChecked();
  const frame = await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL()); await page.getByRole('button', { name: 'Move left' }).tap();
  await page.waitForTimeout(150); expect(await page.locator('.holm-board').evaluate((canvas) => canvas.toDataURL())).not.toBe(frame);
  await page.getByRole('button', { name: 'Arcade', exact: true }).tap(); await expect(page.locator('#home')).toBeVisible(); expect(errors).toEqual([]); await context.close();
});

test('mobile name setup fits without clipping validation or Start, then pauses with a full-size Resume control', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; }); await page.goto('/');
  await page.getByRole('button', { name: 'Play Snakeholm' }).tap();
  await expect(page.locator('.holm-app')).toHaveAttribute('data-screen', 'name');
  const setup = page.locator('.holm-board-wrap'); await expect(setup).toHaveAttribute('data-screen', 'name');
  await page.screenshot({ path: '.runtime/holm-repair1-mobile-setup-320.png', fullPage: true });
  const name = page.locator('#holm-name'); await name.fill('A'.repeat(21)); await page.getByRole('button', { name: 'Start expedition' }).tap();
  await expect(page.locator('[data-error]')).toContainText('20 characters or fewer');
  await page.screenshot({ path: '.runtime/holm-repair1-mobile-validation-320.png', fullPage: true });
  const start = page.getByRole('button', { name: 'Start expedition' });
  const startLayout = await start.evaluate((button) => {
    const rect = button.getBoundingClientRect(); const viewport = { width: innerWidth, height: innerHeight };
    const clipped = []; let parent = button.parentElement;
    while (parent) { const style = getComputedStyle(parent); if (/(hidden|clip)/.test(`${style.overflow} ${style.overflowY}`)) { const box = parent.getBoundingClientRect(); if (rect.top < box.top || rect.bottom > box.bottom || rect.left < box.left || rect.right > box.right) clipped.push(parent.className); } parent = parent.parentElement; }
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewport, clipped };
  });
  expect(startLayout.x).toBeGreaterThanOrEqual(0); expect(startLayout.y).toBeGreaterThanOrEqual(0); expect(startLayout.x + startLayout.width).toBeLessThanOrEqual(320); expect(startLayout.y + startLayout.height).toBeLessThanOrEqual(startLayout.viewport.height); expect(startLayout.height).toBeGreaterThanOrEqual(44); expect(startLayout.clipped).toEqual([]);
  await name.fill('Ada'); await start.tap(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.getByRole('button', { name: 'Pause / resume' }).tap(); await expect(page.locator('[data-status]')).toHaveText('PAUSED');
  const resume = page.getByRole('button', { name: 'Resume expedition' });
  const resumeLayout = await resume.evaluate((button) => { const a = button.getBoundingClientRect(); const b = document.querySelector('.holm-board-wrap').getBoundingClientRect(); return { top: a.top, bottom: a.bottom, height: a.height, boardTop: b.top, boardBottom: b.bottom, left: a.left, right: a.right, boardLeft: b.left, boardRight: b.right }; });
  expect(resumeLayout.height).toBeGreaterThanOrEqual(44); expect(resumeLayout.top).toBeGreaterThanOrEqual(resumeLayout.boardTop); expect(resumeLayout.bottom).toBeLessThanOrEqual(resumeLayout.boardBottom); expect(resumeLayout.left).toBeGreaterThanOrEqual(resumeLayout.boardLeft); expect(resumeLayout.right).toBeLessThanOrEqual(resumeLayout.boardRight);
  await resume.tap(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE'); expect(errors).toEqual([]); await context.close();
});

test('a saturated tenth-tick food skip is shown in the production desktop and mobile notice renderer', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const outcome = await page.evaluate(async () => {
    const { startHolmGame, tickHolmGame, HOLM_WIDTH, HOLM_HEIGHT } = await import('/src/holm/game.js');
    const { renderPlacementNotice } = await import('/src/holm/notices.js');
    const obstacles = Array.from({ length: HOLM_WIDTH * HOLM_HEIGHT }, (_, index) => ({ x: index % HOLM_WIDTH, y: Math.floor(index / HOLM_WIDTH) }));
    const initial = startHolmGame('QA', { barbarianEnabled: false, random: () => 0 });
    const state = tickHolmGame({ ...initial, ticks: 9, home: { x: 13, y: 13 }, runnerPos: { x: 29, y: 29 }, runnerDirection: 'up', obstacles, traps: [], food: [], population: 4 }, { random: () => 0, timestamp: 'saturation' });
    const desktop = document.querySelector('[data-notice]'); const mobile = document.querySelector('[data-notice-mobile]');
    renderPlacementNotice({ ...state, barbarianUnavailable: true, trapPlacementShortage: 2 }, desktop, mobile);
    return { ticks: state.ticks, shortage: state.foodPlacementShortage, food: state.food, status: state.status, population: state.population };
  });
  expect(outcome).toEqual({ ticks: 10, shortage: 1, food: [], status: 'running', population: 3 });
  const mobileNotice = page.locator('[data-notice-mobile]'); await expect(mobileNotice).toBeVisible(); await expect(mobileNotice).toContainText('barbarian'); await expect(mobileNotice).toContainText('2 extra trap'); await expect(mobileNotice).toContainText('1 food placement');
  await page.setViewportSize({ width: 1280, height: 800 }); const desktopNotice = page.locator('[data-notice]'); await expect(desktopNotice).toBeVisible(); await expect(desktopNotice).toContainText('1 food placement'); await expect(desktopNotice).toContainText('2 extra trap');
  expect(page.__errors).toEqual([]);
});

test('blocked storage keeps the run usable and exposes a clear notice', async ({ page }) => {
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.includes('holm')) throw new DOMException('blocked', 'QuotaExceededError'); return original.call(this, key, value); }; });
  await page.locator('.holm-home').click(); await page.getByRole('button', { name: 'Play Snakeholm' }).click();
  await expect(page.locator('[data-storage]')).toContainText('unavailable'); await page.locator('#holm-name').fill('Sam');
  await page.getByRole('button', { name: 'Start expedition' }).click(); await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
});
