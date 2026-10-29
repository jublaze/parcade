import { test, expect } from '@playwright/test';

const makeQuiz = ({ id = 'browser-quiz', title = 'Browser practice', questions = [{ id: 2, prompt: 'What is 2 + 2?', answer: 4 }, { id: 1, prompt: 'What is 1 + 1?', answer: 2 }], time = 0 } = {}) => ({ quiz_id: id, title, time_limit_seconds: time, questions });

async function openIlluminate(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Illuminate' }).click();
  await expect(page.locator('section.il-library')).toBeVisible();
}

async function importByKeyboard(page, files) {
  const chooserPromise = page.waitForEvent('filechooser');
  const button = page.locator('[data-il-choose-files]');
  await button.focus();
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles(files.map(({ name, payload }) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })));
}

async function importBuffersByKeyboard(page, files) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-il-choose-files]').focus(); await page.keyboard.press('Enter');
  const chooser = await chooserPromise; await chooser.setFiles(files);
}

test('library keyboard file chooser imports legacy JSON and renders user text literally', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Object.defineProperty(Crypto.prototype, 'randomUUID', { configurable: true, value: undefined }); });
  await openIlluminate(page);
  const quiz = makeQuiz({ id: undefined, title: '<img src=x onerror=alert(1)>', questions: [{ id: 2, prompt: '<svg onload=alert(1)> literal prompt', answer: 4 }, { id: 1, prompt: 'First', answer: 2 }] }); delete quiz.quiz_id;
  await importByKeyboard(page, [{ name: 'literal.json', payload: quiz }]);
  await expect(page.locator('[data-il-notice]')).toContainText('1 quiz added');
  await expect(page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeVisible();
  await expect(page.locator('.il-quiz-info img')).toHaveCount(0);
  const generatedId = await page.locator('[data-il-open-quiz]').last().getAttribute('data-il-open-quiz');
  expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await page.locator('[data-il-open-quiz]').last().click(); await page.locator('[data-il-start]').click();
  await expect(page.locator('[data-il-prompt]')).toHaveText('First');
  await expect(page.locator('[data-il-question-nav] button')).toHaveCount(2);
  await page.locator('[data-il-question-nav] [data-il-question-index="1"]').click();
  await expect(page.locator('[data-il-prompt]')).toHaveText('<svg onload=alert(1)> literal prompt');
  expect(errors).toEqual([]);
});

test('file imports are atomic, reject duplicate IDs, and persist across reload', async ({ page }) => {
  await openIlluminate(page);
  await importByKeyboard(page, [{ name: 'first.json', payload: makeQuiz() }]);
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
  await page.reload(); await openIlluminate(page);
  await expect(page.getByRole('heading', { name: 'Browser practice' })).toBeVisible();
  await importByKeyboard(page, [
    { name: 'valid.json', payload: makeQuiz({ id: 'should-not-commit', title: 'Should not commit' }) },
    { name: 'invalid.json', payload: { title: 'Broken', questions: [{ id: 1, prompt: 'bad', answer: '3' }] } },
  ]);
  await expect(page.locator('[data-il-notice]')).toContainText('No files were imported');
  await expect(page.locator('.il-quiz-info h4', { hasText: 'Should not commit' })).toHaveCount(0);
  await importByKeyboard(page, [{ name: 'duplicate.json', payload: makeQuiz() }]);
  await expect(page.locator('[data-il-notice]')).toContainText('already in the library');
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
});

test('blocked writes keep a new import across arcade remount and preserve stale disk data', async ({ page }) => {
  const stale = { quizzes: [makeQuiz({ id: 'stale', title: 'Old disk quiz', questions: [{ id: 1, prompt: 'Old', answer: 1 }] })], selectedId: 'stale' };
  await page.addInitScript((state) => {
    const key = 'parcade.illuminate.library.v1';
    Storage.prototype.setItem.call(localStorage, key, JSON.stringify(state));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('blocked', 'QuotaExceededError'); return original.call(this, name, value); };
  }, stale);
  await openIlluminate(page);
  await importByKeyboard(page, [{ name: 'new.json', payload: makeQuiz({ id: 'session-new', title: 'Session import' }) }]);
  await expect(page.locator('[data-il-notice]')).toContainText('storage is unavailable');
  await expect(page.locator('[data-il-notice]')).toContainText('1 quiz added');
  await page.locator('[data-il-home]').click(); await page.getByRole('button', { name: 'Play Illuminate' }).click();
  await expect(page.getByRole('heading', { name: 'Session import' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Old disk quiz' })).toBeVisible();
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
  const disk = await page.evaluate(() => JSON.parse(localStorage.getItem('parcade.illuminate.library.v1')));
  expect(disk.selectedId).toBe('stale'); expect(disk.quizzes[0].quiz_id).toBe('stale');
});

test('corrupt stored data shows a visible fallback notice and remains recoverable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('parcade.illuminate.library.v1', '{ broken json'));
  await openIlluminate(page);
  await expect(page.locator('[data-il-notice]')).toContainText('Browser storage could not be read');
  await expect(page.getByRole('heading', { name: '6th Grade Percentages Practice (10 questions)' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('parcade.illuminate.library.v1'))).toBe('{ broken json');
});

test('oversized and invalid UTF-8 files reject without changing the library', async ({ page }) => {
  await openIlluminate(page);
  const validText = JSON.stringify(makeQuiz({ id: 'exact-file-limit', title: 'Exact file limit' }));
  const exactLimit = validText + ' '.repeat(512 * 1024 - validText.length);
  await importBuffersByKeyboard(page, [{ name: 'exact-limit.json', mimeType: 'application/json', buffer: Buffer.from(exactLimit) }]);
  await expect(page.locator('[data-il-notice]')).toContainText('1 quiz added');
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
  await importBuffersByKeyboard(page, [{ name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.alloc(512 * 1024 + 1, 0x20) }]);
  await expect(page.locator('[data-il-notice]')).toContainText('512 KiB or smaller');
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
  await importBuffersByKeyboard(page, [{ name: 'invalid-utf8.json', mimeType: 'application/json', buffer: Buffer.from([0xc3, 0x28]) }]);
  await expect(page.locator('[data-il-notice]')).toContainText('invalid JSON');
  await expect(page.locator('[data-il-quiz-list] .il-quiz-card')).toHaveCount(2);
});

test('review submission grades sorted answers, flags, and locks finalized attempts', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openIlluminate(page);
  await importByKeyboard(page, [{ name: 'two.json', payload: makeQuiz() }]);
  await page.locator('[data-il-open-quiz="browser-quiz"]').click(); await page.locator('[data-il-start]').click();
  await page.locator('[data-il-answer]').fill('2'); await page.locator('[data-il-flag]').click();
  await page.locator('[data-il-next]').click(); await expect(page.locator('[data-il-prompt]')).toHaveText('What is 2 + 2?');
  await page.locator('[data-il-answer]').fill('4'); await page.locator('[data-il-review]').click();
  await expect(page.locator('[data-il-review-panel]')).toBeVisible();
  await expect(page.locator('.il-review-row')).toHaveCount(2);
  await page.locator('[data-il-submit-quiz]').click();
  await expect(page.locator('[data-il-score]')).toHaveText('100%');
  await page.locator('[data-il-answer]').evaluate((input) => { input.value = '999'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-il-key="9"]').evaluate((button) => button.click());
  await expect(page.locator('[data-il-score]')).toHaveText('100%');
  await expect(page.locator('.il-result-row').first()).toContainText('2');
  expect(errors).toEqual([]);
});

test('latest answer and flag states reach navigation, last-question review, results, and retry', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openIlluminate(page);
  await importByKeyboard(page, [{ name: 'one.json', payload: makeQuiz({ id: 'one', questions: [{ id: 1, prompt: 'What is 2 + 2?', answer: 4 }] }) }]);
  await page.locator('[data-il-open-quiz="one"]').click(); await page.locator('[data-il-start]').click();
  await page.locator('[data-il-flag]').click(); await page.locator('[data-il-answer]').fill('4');
  await expect(page.locator('[data-il-question-nav] button')).toHaveAccessibleName('Question 1, answered, flagged');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-il-review-panel]')).toBeVisible();
  const reviewRow = page.locator('.il-review-row');
  await expect(reviewRow).toContainText('Answered'); await expect(reviewRow).toContainText('Flagged');
  await page.locator('[data-il-submit-quiz]').click();
  await expect(page.locator('.il-result-row')).toContainText('Correct · Flagged');
  await expect(page.locator('.il-result-row span[aria-label="Correct; flagged for review"]')).toBeVisible();

  await page.locator('[data-il-retry]').click();
  await expect(page.locator('[data-il-answer]')).toHaveValue('');
  await expect(page.locator('[data-il-question-nav] button')).toHaveAccessibleName('Question 1, blank');
  await expect(page.locator('[data-il-flag]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-il-review]').click(); await page.locator('[data-il-submit-quiz]').click();
  await expect(page.locator('.il-result-row')).toContainText('Review · Not flagged');
  await expect(page.locator('.il-result-row span[aria-label="Review; not flagged for review"]')).toBeVisible();
  expect(errors).toEqual([]);
});

async function solveGeneratedRound(page) {
  const prompts = [];
  for (let index = 0; index < 10; index += 1) {
    const prompt = await page.locator('[data-il-prompt]').textContent();
    const match = prompt.match(/^(\d+) × (\d+) = \?$/);
    expect(match, `multiplication prompt: ${prompt}`).not.toBeNull();
    prompts.push(prompt);
    await page.locator('[data-il-answer]').fill(String(Number(match[1]) * Number(match[2])));
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('[data-il-review-panel]')).toBeVisible();
  await expect(page.locator('.il-review-row')).toHaveCount(10);
  await expect(page.locator('.il-answered')).toHaveCount(10);
  await page.locator('[data-il-submit-quiz]').click();
  await expect(page.locator('[data-il-score]')).toHaveText('100%');
  return prompts;
}

test('both multiplication practice modes create fresh untimed 100-percent rounds without changing uploads', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let state = 321;
    Math.random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
  });
  await openIlluminate(page);
  const libraryBefore = await page.evaluate(() => localStorage.getItem('parcade.illuminate.library.v1'));
  for (const [mode, title] of [['one-digit', '1-digit × 1-digit'], ['two-digits', '1-digit × 2-digits']]) {
    const choice = page.locator(`[data-il-practice-mode="${mode}"]`);
    await choice.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-il-setup-title]')).toHaveText(`Multiplication · ${title}`);
    await expect(page.locator('[data-il-setup-count]')).toHaveText('10 QUESTIONS');
    await expect(page.locator('[data-il-setup-time]')).toHaveText('UNTIMED');
    await expect(page.locator('[data-il-setup-type]')).toHaveText('FRESH GENERATED ROUND');
    await page.locator('[data-il-start]').click(); await expect(page.locator('[data-il-clock]')).toHaveText('UNTIMED');
    const firstRound = await solveGeneratedRound(page);
    await page.locator('[data-il-retry]').click(); await expect(page.locator('[data-il-clock]')).toHaveText('UNTIMED');
    const nextRound = await solveGeneratedRound(page);
    expect(nextRound).not.toEqual(firstRound);
    await expect(page.locator('[data-il-count]')).toHaveText('1 / 50');
    await page.locator('[data-il-results] [data-il-library]').click();
    await expect(page.locator('section.il-library')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('parcade.illuminate.library.v1'))).toBe(libraryBefore);
  }

  await importByKeyboard(page, [{ name: 'uploaded.json', payload: makeQuiz({ id: 'uploaded-unchanged', title: 'Uploaded unchanged', questions: [{ id: 7, prompt: 'What is 4 + 1?', answer: 5 }] }) }]);
  await page.locator('[data-il-open-quiz="uploaded-unchanged"]').click(); await page.locator('[data-il-start]').click();
  await expect(page.locator('[data-il-prompt]')).toHaveText('What is 4 + 1?');
  await page.locator('[data-il-answer]').fill('5'); await page.locator('[data-il-review]').click(); await page.locator('[data-il-submit-quiz]').click();
  await page.locator('[data-il-retry]').click(); await expect(page.locator('[data-il-prompt]')).toHaveText('What is 4 + 1?');
  expect(errors).toEqual([]);
});

test('mobile multiplication choice and keypad fit 320px with touch controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openIlluminate(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('[data-il-practice-mode="two-digits"]').tap();
  await expect(page.locator('[data-il-setup-title]')).toHaveText('Multiplication · 1-digit × 2-digits');
  await page.locator('[data-il-start]').tap();
  const prompt = await page.locator('[data-il-prompt]').textContent();
  const match = prompt.match(/^(\d+) × (\d+) = \?$/); expect(match).not.toBeNull();
  for (const digit of String(Number(match[1]) * Number(match[2]))) await page.locator(`[data-il-key="${digit}"]`).tap();
  await expect(page.locator('[data-il-answer]')).toHaveValue(String(Number(match[1]) * Number(match[2])));
  await page.screenshot({ path: '.runtime/screenshots/illuminate-multiplication-320.png', fullPage: true });
  expect(errors).toEqual([]); await context.close();
});

test('deadline finalizes with last timely draft and ignores a late field change', async ({ page }) => {
  await openIlluminate(page);
  await importByKeyboard(page, [{ name: 'timed.json', payload: makeQuiz({ id: 'timed', questions: [{ id: 1, prompt: 'Answer 16', answer: 16 }], time: 5 }) }]);
  await page.locator('[data-il-open-quiz="timed"]').click(); await page.locator('[data-il-start]').click();
  await page.locator('[data-il-answer]').fill('16');
  await page.waitForTimeout(5200);
  await page.locator('[data-il-answer]').evaluate((input) => { input.value = '99'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('[data-il-results]')).toBeVisible();
  await expect(page.locator('.il-result-row')).toContainText('16');
  await expect(page.locator('.il-result-row')).not.toContainText('99');
});

test('touch keypad, blur pause, and 320px layout remain usable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await openIlluminate(page);
  const width = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(width.page).toBeLessThanOrEqual(width.viewport);
  await page.locator('[data-il-open-quiz="illuminate-percentages-example"]').tap(); await page.locator('[data-il-start]').tap();
  const key = page.locator('[data-il-key="1"]');
  const keySize = await key.boundingBox(); expect(keySize.width).toBeGreaterThanOrEqual(40); expect(keySize.height).toBeGreaterThanOrEqual(44);
  await key.tap(); await expect(page.locator('[data-il-answer]')).toHaveValue('1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('[data-il-run-state]')).toHaveText('PAUSED');
  const pausedText = await page.locator('[data-il-prompt]').textContent();
  await page.waitForTimeout(250); await expect(page.locator('[data-il-prompt]')).toHaveText(pausedText);
  await page.locator('[data-il-resume]').tap(); await expect(page.locator('[data-il-run-state]')).toHaveText('IN PROGRESS');
  await page.screenshot({ path: '.runtime/screenshots/illuminate-player-320.png', fullPage: true });
  expect(errors).toEqual([]); await context.close();
});
