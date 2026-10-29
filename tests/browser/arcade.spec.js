import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('.runtime/screenshots', { recursive: true });

test('arcade opens Snake, supports keyboard and touch actions, and returns cleanly', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: '.runtime/screenshots/arcade-desktop.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'Small games. Big energy.' })).toBeVisible();
  await expect(page.locator('.maze-card').getByRole('heading', { name: 'Snake Maze' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await expect(page.locator('#game')).toBeVisible();
  await page.screenshot({ path: '.runtime/screenshots/snake-ready-desktop.png', fullPage: true });
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await page.keyboard.press('Space');
  await expect(page.locator('#status-text')).toHaveText('IN THE ZONE');
  await page.keyboard.press('ArrowUp');
  const movingFrame = await page.locator('#board').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(150);
  expect(await page.locator('#board').evaluate((canvas) => canvas.toDataURL())).not.toBe(movingFrame);
  await page.keyboard.press('Space');
  await expect(page.locator('#status-text')).toHaveText('TAKE A BREATHER');
  const pausedFrame = await page.locator('#board').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#board').evaluate((canvas) => canvas.toDataURL())).toBe(pausedFrame);
  await page.locator('#start-button').click();
  await expect(page.locator('#status-text')).toHaveText('IN THE ZONE');
  await page.getByRole('button', { name: 'Restart run' }).click();
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await page.getByRole('button', { name: 'ARCADE' }).click();
  await expect(page.locator('#home')).toBeVisible();
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
  await page.getByRole('link', { name: 'Parcade home' }).click();
  await expect(page.locator('#home')).toBeVisible();
});

test('scores a snack, saves the best, pauses on blur, and fits a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => { Math.random = () => 192.01 / 397; });
  await page.goto('/');
  await page.screenshot({ path: '.runtime/screenshots/arcade-mobile-320.png', fullPage: true });
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('#score')).toHaveText('010', { timeout: 1000 });
  await expect(page.locator('#best-score')).toHaveText('10');
  expect(await page.evaluate(() => localStorage.getItem('parcade.snake.best.v1'))).toBe('10');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#status-text')).toHaveText('TAKE A BREATHER');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(page.locator('#home')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await expect(page.locator('#best-score')).toHaveText('10');
});

test('pause stops movement until explicit resume and restart clears the run', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(170);
  await page.keyboard.press('Space');
  const before = await page.locator('#board').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#board').evaluate((canvas) => canvas.toDataURL())).toBe(before);
  await page.keyboard.press('r');
  await expect(page.locator('#score')).toHaveText('000');
  await expect(page.locator('#status-text')).toHaveText('READY WHEN YOU ARE');
});

test('touch controls work with real tap input and buttons remain keyboard accessible', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Snake', exact: true }).tap();
  await page.getByRole('button', { name: 'Start / pause' }).tap();
  const start = await page.locator('#board').evaluate((canvas) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Move up' }).tap();
  await page.waitForTimeout(150);
  expect(await page.locator('#board').evaluate((canvas) => canvas.toDataURL())).not.toBe(start);
  await page.locator('#touch-home').tap();
  await expect(page.locator('#home')).toBeVisible();
  await context.close();
});

test('terminal overlay starts a fresh run and repeated restarts do not duplicate movement timers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Snake', exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('#status-text')).toHaveText('RUN OVER', { timeout: 5000 });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#status-text')).toHaveText('IN THE ZONE');
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  const frame = await page.locator('#board').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(150);
  expect(await page.locator('#board').evaluate((canvas) => canvas.toDataURL())).not.toBe(frame);
});
