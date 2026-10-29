import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('.runtime/screenshots', { recursive: true });

async function openMath(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Math Ladder' }).click();
}

async function answerCurrent(page, wrong = false) {
  const prompt = await page.locator('[data-math-question]').textContent();
  const match = prompt.match(/(-?\d+) ([+−×]) (-?\d+) =/);
  expect(match, `question format: ${prompt}`).not.toBeNull();
  const [, left, symbol, right] = match;
  const a = Number(left); const b = Number(right);
  const value = symbol === '+' ? a + b : symbol === '−' ? a - b : a * b;
  await page.locator('[data-math-answer]').fill(String(value + (wrong ? 1 : 0)));
  await page.keyboard.press('Enter');
}

test('Math Ladder source defaults, feedback, win and terminal return', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openMath(page);
  await expect(page.locator('[data-math-summary]')).toContainText('Addition · 2 digits · 45s · 6 to win · 3 misses');
  await page.screenshot({ path: '.runtime/screenshots/math-ready-desktop.png', fullPage: true });
  await page.locator('[data-math-start]').click();
  await expect(page.getByRole('progressbar', { name: 'Ladder progress' })).toHaveAttribute('aria-valuemax', '6');
  await page.locator('[data-math-answer]').fill(''); await page.keyboard.press('Enter');
  await expect(page.locator('[data-math-rung]')).toHaveText('0 / 6');
  await page.locator('[data-math-answer]').fill('1.5'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-math-feedback]')).toHaveText('Numbers only');
  await expect(page.locator('[data-math-wrong]')).toHaveText('0 / 3');
  for (let rung = 1; rung <= 6; rung += 1) await answerCurrent(page);
  await expect(page.locator('[data-math-terminal-title]')).toHaveText('You made it to the top.');
  await expect(page.getByRole('progressbar', { name: 'Ladder progress' })).toHaveAttribute('aria-valuenow', '6');
  await page.keyboard.press('Enter'); await expect(page.locator('[data-math-setup]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('wrong integers advance the question and end at the configured miss limit', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; }); await openMath(page);
  await page.locator('[data-math-start]').click();
  for (let miss = 1; miss <= 3; miss += 1) await answerCurrent(page, true);
  await expect(page.locator('[data-math-terminal-title]')).toHaveText('Time for another try.');
  await expect(page.locator('[data-math-wrong]')).toHaveText('3 / 3');
  await page.locator('[data-math-terminal-action]').click(); await expect(page.locator('[data-math-setup]')).toBeVisible();
});

test('custom 50-rung progress stays within a 320px touch viewport and settings persist', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; }); await openMath(page);
  await page.locator('[data-math-settings]').first().tap();
  const dialog = page.locator('.settings-dialog[open]');
  await dialog.locator('[name="preset"]').selectOption('custom');
  await dialog.locator('[name="correctToWin"]').fill('50');
  await dialog.locator('[name="operations"][value="addition"]').check();
  await dialog.getByRole('button', { name: 'Apply settings' }).tap();
  await expect(page.locator('[data-math-summary]')).toContainText('50 to win');
  await page.locator('[data-math-start]').tap();
  const progress = page.getByRole('progressbar', { name: 'Ladder progress' });
  await expect(progress).toHaveAttribute('aria-valuemax', '50');
  await expect(page.locator('[data-math-rungs] li')).toHaveCount(50);
  const geometry = await page.evaluate(() => {
    const progress = document.querySelector('[data-math-progress]').getBoundingClientRect();
    const card = document.querySelector('.math-play-card').getBoundingClientRect();
    const submit = document.querySelector('.math-submit').getBoundingClientRect();
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, progressLeft: progress.left, progressRight: progress.right, cardLeft: card.left, cardRight: card.right, submitLeft: submit.left, submitRight: submit.right };
  });
  expect(geometry.document).toBeLessThanOrEqual(320); expect(geometry.progressLeft).toBeGreaterThanOrEqual(0); expect(geometry.progressRight).toBeLessThanOrEqual(320);
  expect(geometry.cardLeft).toBeGreaterThanOrEqual(0); expect(geometry.cardRight).toBeLessThanOrEqual(320); expect(geometry.submitLeft).toBeGreaterThanOrEqual(0); expect(geometry.submitRight).toBeLessThanOrEqual(320);
  await page.screenshot({ path: '.runtime/screenshots/math-50-rungs-320.png', fullPage: true });
  await page.locator('[data-math-pause]').tap(); const prompt = await page.locator('[data-math-question]').textContent();
  const pausedTime = await page.locator('[data-math-time]').textContent();
  await page.waitForTimeout(250); await expect(page.locator('[data-math-question]')).toHaveText(prompt); await expect(page.locator('[data-math-time]')).toHaveText(pausedTime);
  await page.locator('[data-math-terminal-action]').tap(); await page.locator('[data-math-settings]').first().tap();
  await expect(dialog.locator('[name="preset"]')).toHaveValue('custom'); await expect(dialog.locator('[name="correctToWin"]')).toHaveValue('50');
  await dialog.getByRole('button', { name: 'Cancel' }).tap(); await page.locator('[data-math-home]').tap();
  await page.reload(); await page.locator('#open-math').tap(); await expect(page.locator('[data-math-summary]')).toContainText('50 to win');
  expect(errors).toEqual([]); await context.close();
});

test('settings reject empty operation/range, and Cancel preserves a paused question', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openMath(page); await page.locator('[data-math-start]').click();
  await page.locator('[data-math-settings]').first().click(); const dialog = page.locator('.settings-dialog[open]');
  await dialog.locator('[name="preset"]').selectOption('custom');
  await dialog.locator('[name="operations"][value="addition"]').uncheck(); await dialog.getByRole('button', { name: 'Apply settings' }).click();
  const operationError = dialog.locator('[role="alert"]');
  await expect(operationError).toContainText('Choose at least one');
  await expect(dialog.locator('[data-settings-group="operations"]')).toHaveAttribute('aria-describedby', await operationError.getAttribute('id'));
  await expect(dialog.locator('[name="operations"][value="addition"]')).toBeFocused();
  await expect(page.locator('[data-math-config]')).toContainText('Addition · 2 digits');
  await dialog.locator('[name="operations"][value="addition"]').check(); await dialog.locator('[name="customRangeEnabled"]').check();
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
  const rangeError = dialog.locator('[role="alert"]'); await expect(rangeError).toContainText('Custom minimum');
  await expect(dialog.locator('[name="operandMin"]')).toBeFocused();
  await expect(dialog.locator('[name="operandMin"]')).toHaveAttribute('aria-describedby', await rangeError.getAttribute('id'));
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('[data-math-status]')).toHaveText('PAUSED');
  const question = await page.locator('[data-math-question]').textContent(); await page.waitForTimeout(250);
  await expect(page.locator('[data-math-question]')).toHaveText(question);
  expect(errors).toEqual([]);
});

test('mobile keypad submits answers and reduced-motion win remains static', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.addInitScript(() => { Math.random = () => 0; }); await openMath(page);
  await page.locator('[data-math-settings]').first().tap(); const dialog = page.locator('.settings-dialog[open]');
  await dialog.locator('[name="preset"]').selectOption('custom'); await dialog.locator('[name="operations"][value="addition"]').uncheck(); await dialog.locator('[name="operations"][value="subtraction"]').check();
  await dialog.locator('[name="correctToWin"]').fill('1'); await dialog.getByRole('button', { name: 'Apply settings' }).tap(); await page.locator('[data-math-start]').tap();
  await page.locator('[data-math-key="1"]').tap(); await page.locator('[data-math-key="backspace"]').tap();
  await page.locator('[data-math-key="-"]').tap(); await page.locator('[data-math-key="0"]').tap(); await page.locator('[data-math-form] button[type="submit"]').tap();
  await expect(page.locator('[data-math-terminal-title]')).toHaveText('You made it to the top.');
  expect(await page.locator('[data-math-terminal]').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  const bounds = await page.locator('[data-math-terminal-action]').evaluate((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, height: innerHeight, width: innerWidth, scroll: document.documentElement.scrollWidth }; });
  expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height); expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  await page.screenshot({ path: '.runtime/screenshots/math-terminal-320.png', fullPage: true }); await context.close();
});

test('Math settings Space activation, blur pause, resume, restart and arcade cleanup', async ({ page }) => {
  await openMath(page); await page.locator('[data-math-settings]').first().focus(); await page.keyboard.press('Space');
  await expect(page.locator('.settings-dialog[open]')).toBeVisible(); await page.keyboard.press('Escape');
  await page.locator('[data-math-start]').click(); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('[data-math-status]')).toHaveText('PAUSED');
  await page.locator('[data-math-terminal-action]').click(); await expect(page.locator('[data-math-status]')).toHaveText('CLIMBING');
  await page.locator('[data-math-answer]').fill('2'); await page.keyboard.press('r'); await expect(page.locator('[data-math-answer]')).toHaveValue('2r');
  await page.locator('[data-math-answer]').fill(''); await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('r'); await expect(page.locator('[data-math-setup]')).toBeVisible();
  await page.locator('[data-math-start]').click(); await page.keyboard.press('Escape'); await expect(page.locator('#home')).toBeVisible();
  await page.waitForTimeout(250); await page.locator('#open-math').click(); await expect(page.locator('[data-math-setup]')).toBeVisible();
});
