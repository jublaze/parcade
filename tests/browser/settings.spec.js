import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('.runtime/screenshots', { recursive: true });

test('Classic settings validate, apply fresh snapshots, cancel paused drafts, and persist across reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await page.getByRole('button', { name: '⚙ Game settings' }).click();
  const dialog = page.locator('.settings-dialog'); await expect(dialog).toBeVisible();
  await dialog.locator('[name="preset"]').selectOption('custom');
  await dialog.locator('[name="boardSize"]').fill('11'); await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(dialog.locator('[role="alert"]')).toContainText('12 to 40');
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await dialog.locator('[name="boardSize"]').fill('24'); await dialog.locator('[name="tickMs"]').fill('200');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(dialog).toBeHidden(); await expect(page.locator('#classic-config-summary')).toContainText('24 × 24 · 200 ms');
  await page.keyboard.press('Space'); await expect(page.locator('#status-text')).toHaveText('IN THE ZONE');
  const canvas = page.locator('#board'); await page.waitForTimeout(80); const pausedFrame = await canvas.evaluate((node) => node.toDataURL());
  await page.getByRole('button', { name: '⚙ Game settings' }).click(); await expect(page.locator('#status-text')).toHaveText('TAKE A BREATHER');
  await page.waitForTimeout(260); expect(await canvas.evaluate((node) => node.toDataURL())).toBe(pausedFrame);
  await dialog.locator('[name="preset"]').selectOption('hard'); await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#status-text')).toHaveText('TAKE A BREATHER'); expect(await canvas.evaluate((node) => node.toDataURL())).toBe(pausedFrame);
  await page.locator('#start-button').click(); await expect(page.locator('#status-text')).toHaveText('IN THE ZONE'); await page.keyboard.press('Escape');
  await page.reload(); await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await expect(page.locator('#classic-config-summary')).toContainText('24 × 24 · 200 ms');
});

test('Classic Space shortcuts preserve focused native controls', async ({ page }) => {
  await page.goto('/'); await page.locator('#open-snake').click();
  await page.locator('#settings-button').focus(); await page.keyboard.press('Space');
  await expect(page.locator('.settings-dialog[open]')).toBeVisible();
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await page.keyboard.press('Escape'); await expect(page.locator('.settings-dialog[open]')).toBeHidden();
  await page.locator('#restart-button').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await page.locator('#start-button').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#status-text')).toHaveText('IN THE ZONE');
});

test('each game settings dialog exposes its own computed accessible name after Arcade navigation', async ({ page }) => {
  await page.goto('/'); await page.locator('#open-snake').click(); await page.locator('#settings-button').click();
  let dialog = page.getByRole('dialog', { name: 'Classic Snake', exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Classic Snake', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click(); await page.locator('#back-home').click();

  await page.locator('#open-maze').click(); await page.locator('#maze-pregame-settings').click();
  dialog = page.getByRole('dialog', { name: 'Snake Maze', exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Snake Maze', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click(); await page.locator('#maze-home').click();

  await page.locator('#open-holm').click(); await page.locator('[data-game-settings]').first().click();
  dialog = page.getByRole('dialog', { name: 'Snakeholm', exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Snakeholm', exact: true })).toBeVisible();
});

test('Maze settings apply a persistent trap policy and custom speed/count, and validate the floor relation', async ({ page }) => {
  await page.goto('/'); await page.locator('#open-maze').click();
  const dialog = page.locator('.settings-dialog[open]'); await page.locator('#maze-pregame-settings').click(); await expect(dialog).toBeVisible();
  await dialog.locator('[name="preset"]').selectOption('custom');
  await dialog.locator('[name="startMs"]').fill('40'); await dialog.locator('[name="floorMs"]').fill('41');
  await dialog.getByRole('button', { name: 'Apply settings' }).click(); await expect(dialog.locator('[role="alert"]')).toContainText('cannot exceed');
  await dialog.locator('[name="startMs"]').fill('140'); await dialog.locator('[name="floorMs"]').fill('50');
  await dialog.locator('[name="levelStepMs"]').fill('3'); await dialog.locator('[name="trapsPerLevel"]').fill('2'); await dialog.locator('[name="trapMode"]').selectOption('persist');
  await dialog.getByRole('button', { name: 'Apply settings' }).click(); await expect(page.locator('[data-maze-mode="persist"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#maze-start-run').click(); await expect(page.locator('#maze-mode-readout')).toHaveText('PERSIST + ADD');
  await expect(page.locator('#maze-config-summary')).toContainText('CUSTOM · 140/50 ms · 2 traps/level');
  await page.locator('#maze-home').click(); await page.locator('#open-maze').click();
  await expect(page.locator('[data-maze-mode="persist"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#maze-pregame-settings').click(); await expect(dialog.locator('[name="preset"]')).toHaveValue('custom');
});

test('Maze menu descriptions reflect six-trap Hard and zero-trap custom settings', async ({ page }) => {
  await page.goto('/'); await page.locator('#open-maze').click();
  const dialog = page.locator('.settings-dialog[open]'); await page.locator('#maze-pregame-settings').click();
  await dialog.locator('[name="preset"]').selectOption('hard');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('[data-maze-mode="persist"] small')).toContainText('Add 6 traps');
  await expect(page.locator('#maze-menu-note')).toContainText('6 traps per level');
  await expect(page.locator('#maze-config-summary')).toContainText('6 traps/level');
  await page.locator('#maze-pregame-settings').click();
  await dialog.locator('[name="preset"]').selectOption('custom');
  await dialog.locator('[name="trapsPerLevel"]').fill('0');
  await dialog.locator('[name="trapMode"]').selectOption('refresh');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('[data-maze-mode="refresh"] small')).toContainText('no new traps');
  await expect(page.locator('[data-maze-mode="persist"] small')).toContainText('Add no new traps');
  await expect(page.locator('#maze-menu-note')).toContainText('0 traps per level');
});

test('Snakeholm settings update a fresh name-entry config without recording the interrupted run', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Play Snakeholm' }).click();
  await page.locator('#holm-name').fill('Settings Test'); await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE');
  await page.locator('[data-game-settings]').first().click(); const dialog = page.locator('.settings-dialog[open]'); await expect(dialog).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveText('PAUSED');
  await dialog.locator('[name="preset"]').selectOption('easy'); await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('.holm-app')).toHaveAttribute('data-screen', 'name'); await expect(page.locator('#holm-name')).toBeVisible();
  await expect(page.locator('[data-history] tr')).toHaveCount(0); await expect(page.locator('[data-config-summary]')).toContainText('EASY · 180 ms · 180s · pop 8 · barbarian off');
  await expect(page.locator('[data-active-time]')).toHaveText('180 SECONDS ACTIVE');
  await page.locator('#holm-name').fill('Fresh'); await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.locator('[data-status]')).toHaveText('EXPEDITION LIVE'); await expect(page.locator('[data-population]')).toHaveText('7');
  await page.locator('.holm-home').click(); await page.getByRole('button', { name: 'Play Snakeholm' }).click();
  await expect(page.locator('[data-config-summary]')).toContainText('EASY · 180 ms · 180s · pop 8 · barbarian off');
});

test('settings storage failure and corrupt data fall back to playable source values with a notice', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('parcade.settings.classic.v1', '{broken'); });
  await page.goto('/'); await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await page.getByRole('button', { name: '⚙ Game settings' }).click();
  const dialog = page.locator('.settings-dialog'); await expect(dialog.locator('[data-settings-storage]')).toContainText('unavailable');
  await expect(dialog.locator('[name="preset"]')).toHaveValue('source'); await dialog.locator('[name="preset"]').selectOption('easy');
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.includes('settings.classic')) throw new DOMException('blocked', 'QuotaExceededError'); return set.call(this, key, value); }; });
  await dialog.getByRole('button', { name: 'Apply settings' }).click(); await expect(page.locator('#classic-config-summary')).toContainText('24 × 24 · 180 ms');
  await expect(page.locator('.settings-notice')).toBeVisible();
  await page.getByRole('button', { name: '⚙ Game settings' }).click(); await expect(dialog.locator('[data-settings-storage]')).toContainText('unavailable');
});

test('blocked settings writes announce immediately and keep latest presets across game remounts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('parcade.settings.classic.v1', JSON.stringify({ preset: 'hard', boardSize: 14, tickMs: 80 }));
    localStorage.setItem('parcade.settings.maze.v1', JSON.stringify({ preset: 'hard', startMs: 60, floorMs: 30, levelStepMs: 2, trapsPerLevel: 6, trapMode: 'persist' }));
    localStorage.setItem('parcade.settings.holm.v1', JSON.stringify({ preset: 'hard', tickMs: 80, timeLimitSeconds: 90, startingPopulation: 3, obstacles: 90, traps: 10, foodEveryTicks: 15, barbarianEnabled: true }));
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('parcade.settings.')) throw new DOMException('blocked', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await page.goto('/');
  await page.locator('#open-snake').click();
  await page.locator('#settings-button').click();
  let dialog = page.locator('.settings-dialog[open]'); await dialog.locator('[name="preset"]').selectOption('easy');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#classic-config-summary')).toContainText('24 × 24 · 180 ms'); await expect(page.locator('#game .settings-notice')).toBeVisible();
  await page.locator('#back-home').click(); await page.locator('#open-snake').click(); await page.locator('#settings-button').click();
  await expect(page.locator('.settings-dialog[open] [name="preset"]')).toHaveValue('easy'); await page.keyboard.press('Escape'); await page.locator('#back-home').click();

  await page.locator('#open-maze').click(); await page.locator('#maze-pregame-settings').click(); dialog = page.locator('.settings-dialog[open]');
  await dialog.locator('[name="preset"]').selectOption('easy'); await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#maze-config-summary')).toContainText('EASY · 120/60 ms · 1 traps/level'); await expect(page.locator('#maze-view .settings-notice')).toBeVisible();
  await page.locator('#maze-home').click(); await page.locator('#open-maze').click(); await page.locator('#maze-pregame-settings').click();
  await expect(page.locator('.settings-dialog[open] [name="preset"]')).toHaveValue('easy'); await page.keyboard.press('Escape'); await page.locator('#maze-home').click();

  await page.locator('#open-holm').click(); await page.locator('[data-game-settings]').first().click(); dialog = page.locator('.settings-dialog[open]');
  await dialog.locator('[name="preset"]').selectOption('easy'); await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('[data-config-summary]')).toContainText('EASY · 180 ms · 180s · pop 8'); await expect(page.locator('#holm-view .settings-notice')).toBeVisible();
  await page.locator('.holm-home').click(); await page.locator('#open-holm').click();
  await expect(page.locator('[data-config-summary]')).toContainText('EASY · 180 ms · 180s · pop 8');
  await page.locator('[data-game-settings]').first().click(); await expect(page.locator('.settings-dialog[open] [name="preset"]')).toHaveValue('easy');
});

test('Maze Start announces blocked trap-mode saves, survives remount, and clears notice after storage recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    window.__parcadeSetItem = set;
    Storage.prototype.setItem = function(key, value) { if (key === 'parcade.settings.maze.v1') throw new DOMException('blocked', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await page.goto('/'); await page.locator('#open-maze').click();
  await page.locator('[data-maze-mode="persist"]').click(); await page.locator('#maze-start-run').click();
  await expect(page.locator('#maze-mode-readout')).toHaveText('PERSIST + ADD');
  await expect(page.locator('#maze-view .settings-notice')).toBeVisible();
  await page.locator('#maze-home').click(); await page.locator('#open-maze').click();
  await expect(page.locator('[data-maze-mode="persist"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#maze-view .settings-notice')).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = window.__parcadeSetItem; });
  await page.locator('#maze-pregame-settings').click(); const dialog = page.locator('.settings-dialog[open]');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#maze-view .settings-notice')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('parcade.settings.maze.v1')).trapMode)).toBe('persist');
});

test('all three settings forms fit and remain operable on a 320px touch viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true }); const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message)); await page.goto('/');
  async function checkDialog(open, screenshot) {
    await open(); const dialog = page.locator('.settings-dialog[open]'); await expect(dialog).toBeVisible();
    const layout = await dialog.evaluate((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }; });
    expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.right).toBeLessThanOrEqual(320); expect(layout.top).toBeGreaterThanOrEqual(0); expect(layout.bottom).toBeLessThanOrEqual(layout.height); expect(layout.scrollWidth).toBeLessThanOrEqual(320);
    await page.screenshot({ path: `.runtime/screenshots/${screenshot}`, fullPage: true });
    await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    await page.screenshot({ path: `.runtime/screenshots/${screenshot.replace('.png', '-lower.png')}`, fullPage: true });
    await dialog.evaluate((node) => { node.scrollTop = 0; });
    await dialog.locator('[name="tickMs"], [name="startMs"]').first().tap(); await dialog.getByRole('button', { name: 'Cancel' }).tap(); await expect(dialog).toBeHidden();
  }
  await page.getByRole('button', { name: 'Play Snake', exact: true }).tap(); await checkDialog(() => page.locator('#touch-settings').tap(), 'settings-repair1-classic-320.png');
  await page.locator('#touch-home').tap(); await page.locator('#open-maze').tap(); await checkDialog(() => page.locator('#maze-pregame-settings').tap(), 'settings-repair1-maze-320.png');
  await page.locator('#maze-home').tap(); await page.getByRole('button', { name: 'Play Snakeholm' }).tap(); await checkDialog(() => page.locator('[data-game-settings]').last().tap(), 'settings-repair1-holm-320.png');
  expect(errors).toEqual([]); await context.close();
});
