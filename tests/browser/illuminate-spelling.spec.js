import { test, expect } from '@playwright/test';
import sample from '../../src/illuminate/spelling-example.json' with { type: 'json' };

async function openSpelling(page, { failure = false } = {}) {
  await page.addInitScript(({ failure }) => {
    window.spoken = []; window.cancelCount = 0;
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'en-US', localService: true }], cancel: () => window.cancelCount++, speak: (u) => { window.spoken.push({ text: u.text, rate: u.rate }); queueMicrotask(() => failure ? u.onerror() : u.onend()); } } });
  }, { failure });
  await page.goto('/'); await page.getByRole('button', { name: 'Play Illuminate' }).click(); await page.getByRole('button', { name: 'Open spelling quiz' }).click();
}
async function targetWord(page) {
  await expect.poll(() => page.evaluate(() => window.spoken.filter((s) => !s.text.includes(' ')).at(-1)?.text)).toBeTruthy();
  return page.evaluate(() => window.spoken.filter((s) => !s.text.includes(' ')).at(-1).text);
}

test('mixed round hides targets, supports keyboard audio, grades all 15 and retries only misses', async ({ page }) => {
  await openSpelling(page);
  await page.locator('[data-sp-mode]').selectOption('mixed'); await expect(page.locator('[data-sp-summary]')).toContainText('15 words');
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Type the word you hear' });
  for (const [attribute, value] of [['spellcheck', 'false'], ['writingsuggestions', 'false'], ['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'none'], ['inputmode', 'text']]) await expect(input).toHaveAttribute(attribute, value);
  let missed;
  for (let index = 0; index < 15; index++) {
    await expect(page.locator('[data-sp-position]')).toHaveText(`Question ${index + 1} of 15`);
    await expect(input).toBeFocused();
    await page.getByRole('button', { name: 'Hear Word', exact: true }).focus(); await page.keyboard.press('Enter');
    const word = await targetWord(page);
    await expect(page.locator('[data-sp-player]').getByText(word, { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-sp-feedback]')).toBeEmpty();
    if (index === 0) {
      await page.screenshot({ path: '.runtime/screenshots/spelling-desktop.png', fullPage: true });
      missed = word;
      await page.getByRole('button', { name: 'Hear Sentence', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.spoken.at(-1).text)).toContain(word);
      await page.getByRole('button', { name: 'Replay / Repeat Word' }).click();
    }
    await input.fill(index === 0 ? 'oops' : ` ${word.toUpperCase()} `); await input.press('Enter');
    await expect(page.locator('[data-sp-feedback]')).toContainText(index === 0 ? 'Not quite' : 'Correct!');
    await expect(page.locator('[data-sp-feedback]')).toContainText(word);
    await page.getByRole('button', { name: 'Next word', exact: true }).click();
  }
  await expect(page.locator('[data-sp-score]')).toContainText('14/15 correct (93%)');
  await expect(page.locator('[data-sp-groups]')).toContainText('Weekly spelling:'); await expect(page.locator('[data-sp-groups]')).toContainText('Extra practice:');
  await page.getByRole('button', { name: 'Retry Missed Words', exact: true }).click();
  await expect(page.locator('[data-sp-position]')).toHaveText('Question 1 of 1');
  await page.getByRole('button', { name: 'Hear Word', exact: true }).click(); expect(await targetWord(page)).toBe(missed);
  await input.fill(missed); await input.press('Enter'); await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.locator('[data-sp-score]')).toContainText('1/1 correct (100%)');
  await expect(page.getByRole('button', { name: 'Retry Missed Words' })).toBeDisabled();
});

test('audio failure permits retry or unscored skip, cancels on exit, and fits at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 }); await openSpelling(page, { failure: true });
  await page.locator('[data-sp-mode]').selectOption('grade'); await page.locator('[data-sp-count]').fill('1'); await page.locator('[data-sp-count]').dispatchEvent('change');
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(page.locator('[data-sp-audio-status]')).toContainText('Audio could not play');
  const word = await targetWord(page); await expect(page.locator('[data-sp-player]').getByText(word, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hear Word', exact: true }).click();
  await page.screenshot({ path: '.runtime/screenshots/spelling-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Skip without scoring' }).click();
  await expect(page.locator('[data-sp-score]')).toHaveText('0/0 correct (0%) · 0 attempted · 0 incorrect · 1 skipped');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restart Quiz', exact: true }).click();
  const before = await page.evaluate(() => window.cancelCount);
  await page.locator('[data-il-home]').click();
  expect(await page.evaluate(() => window.cancelCount)).toBeGreaterThan(before);
});

test('spelling JSON uses atomic library imports and survives reload alongside numeric quizzes', async ({ page }) => {
  await openSpelling(page); await page.getByRole('button', { name: 'Return to Quiz Selection' }).click();
  const ordered = structuredClone(sample); ordered.settings.shuffle = false;
  await page.locator('[data-il-file]').setInputFiles({ name: 'weekly.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ordered)) });
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
  await page.reload(); await expect(page.locator('section.il-library')).toBeVisible();
  await page.locator('[data-il-open-quiz="spelling-week-01"]').click();
  await expect(page.locator('[data-sp-summary]')).toContainText('10 words');
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(page.locator('[data-sp-position]')).toHaveText('Question 1 of 10');
  expect((await page.locator('[data-sp-player]').innerHTML()).toLowerCase()).not.toContain('curious');
  await page.locator('[data-sp-hear]').click();
  await expect.poll(() => page.evaluate(() => window.spoken.at(-1)?.text)).toBe('curious');
  const cancellations = await page.evaluate(() => window.cancelCount);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.cancelCount)).toBeGreaterThan(cancellations);
  await expect(page.locator('section.il-library')).toBeVisible();
});

