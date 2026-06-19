import { test, expect } from '@playwright/test';

// Seeded user (see localdb.js initializeDefaultData): Tom / password 'dino'
const USER = 'Tom';
const PASSWORD = 'dino';

/**
 * Log in as the seeded Tom user and wait for the menu to show.
 */
async function login(page, password = PASSWORD) {
  await page.goto('/index.html');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await page.locator(`.user-btn[data-user="${USER}"]`).click();
  await expect(page.locator('#passwordSection')).toBeVisible();
  await page.locator('#passwordInput').fill(password);
  await page.locator('#loginButton').click();
}

/**
 * Parse a question string like "5 + 3", "9 - 4", "5 × 3" / "5 x 3" and
 * return the correct answer.
 */
function solve(questionText) {
  const text = questionText.replace('=', '').trim();
  const m = text.match(/(-?\d+)\s*([+\-×x*])\s*(-?\d+)/i);
  if (!m) throw new Error(`Cannot parse question: "${questionText}"`);
  const a = parseInt(m[1], 10);
  const op = m[2];
  const b = parseInt(m[3], 10);
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    default: return a * b; // × or x or *
  }
}

/**
 * Play through all 10 questions of the current game, answering each correctly.
 * Returns the number of questions answered.
 */
async function playAllCorrect(page) {
  const questionEl = page.locator('#question');
  const answerEl = page.locator('#answer');

  for (let i = 0; i < 10; i++) {
    // Wait for a fresh, non-empty question to render.
    await expect(questionEl).not.toHaveText('');
    const qText = (await questionEl.textContent()) || '';
    const answer = solve(qText);

    await answerEl.fill(String(answer));
    await page.locator('#submitButton').click();

    if (i < 9) {
      // After a correct answer the game shows "Correct!" then advances to a
      // new question (text changes). Wait for the new question text.
      await expect
        .poll(async () => (await questionEl.textContent()) || '', { timeout: 5000 })
        .not.toBe(qText);
    }
  }
}

test('LOGIN FLOW: correct password advances to menu; wrong password shows error', async ({ page }) => {
  await page.goto('/index.html');

  // Selecting a user reveals the password section.
  await page.locator(`.user-btn[data-user="${USER}"]`).click();
  await expect(page.locator('#passwordSection')).toBeVisible();

  // Wrong password: stays on login, shows error, does NOT advance.
  await page.locator('#passwordInput').fill('definitely-wrong');
  await page.locator('#loginButton').click();
  await expect(page.locator('#loginError')).not.toHaveText('');
  await expect(page.locator('#menuScreen')).toBeHidden();
  await expect(page.locator('#loginScreen')).toBeVisible();

  // Correct password: advances to the menu with the game tile grid.
  await page.locator('#passwordInput').fill(PASSWORD);
  await page.locator('#loginButton').click();
  await expect(page.locator('#menuScreen')).toBeVisible();
  const tiles = page.locator('.game-tile');
  await expect(tiles).toHaveCount(17);
  expect(await tiles.count()).toBeGreaterThanOrEqual(17);
});

const categories = [
  { id: 'add_easy', label: 'addition' },
  { id: 'sub_easy', label: 'subtraction' },
  { id: 'multiply_5', label: 'times table (5x)' },
];

for (const { id, label } of categories) {
  test(`PLAY ${label} (${id}): full game to 10/10 then Play Again`, async ({ page }) => {
    await login(page);
    await expect(page.locator('#menuScreen')).toBeVisible();

    await page.locator(`.game-tile[data-category="${id}"]`).click();
    await expect(page.locator('#gameScreen')).toBeVisible();

    await playAllCorrect(page);

    // Completion popup appears with score + time.
    const modal = page.locator('#popupModal');
    await expect(modal).toBeVisible();
    const popupText = (await page.locator('#popupMessage').innerText()) || '';
    expect(popupText).toContain('10/10');
    expect(popupText).toMatch(/Time:\s*\d+:\d{2}/);

    // Play Again restarts a fresh game (popup closes, game screen shows question 1).
    await page.locator('#popupPlayAgainButton').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#question')).not.toHaveText('');
    // Fresh game: no progress circles filled yet.
    await expect(page.locator('#progressCircles .progress-circle.correct')).toHaveCount(0);
    await expect(page.locator('#progressCircles .progress-circle.incorrect')).toHaveCount(0);
  });
}

test('WRONG-ANSWER VISUAL: feedback shows incorrect state and the correct answer', async ({ page }) => {
  await login(page);
  await page.locator('.game-tile[data-category="add_easy"]').click();
  await expect(page.locator('#gameScreen')).toBeVisible();

  const questionEl = page.locator('#question');
  await expect(questionEl).not.toHaveText('');
  const qText = (await questionEl.textContent()) || '';
  const correct = solve(qText);

  // Submit a deliberately wrong answer.
  await page.locator('#answer').fill(String(correct + 1));
  await page.locator('#submitButton').click();

  const feedback = page.locator('#feedback');
  await expect(feedback).toHaveClass(/incorrect/);
  // Anchor on the "Answer:" label + word boundary so a single-digit value
  // can't match coincidentally inside a larger number (e.g. 7 inside 17).
  await expect(feedback).toHaveText(new RegExp(`Answer:\\s*${correct}\\b`));
  await expect(feedback).toContainText('Wrong');

  // The answered (first) progress circle should be marked incorrect.
  await expect(page.locator('#progressCircles .progress-circle.incorrect')).toHaveCount(1);
});

test('VISUAL SMOKE: screenshots of menu + game, no console/page errors during full play-through', async ({ page }, testInfo) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await login(page);
  await expect(page.locator('#menuScreen')).toBeVisible();

  // Screenshot of the menu.
  const menuShot = await page.screenshot();
  await testInfo.attach('menu', { body: menuShot, contentType: 'image/png' });

  await page.locator('.game-tile[data-category="add_easy"]').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#question')).not.toHaveText('');

  // Screenshot of the game screen.
  const gameShot = await page.screenshot();
  await testInfo.attach('game', { body: gameShot, contentType: 'image/png' });

  // Full play-through to completion.
  await playAllCorrect(page);
  await expect(page.locator('#popupModal')).toBeVisible();

  expect(errors, `console/page errors: ${errors.join('\n')}`).toEqual([]);
});

test('COMPLETION EXIT: the Exit button returns to the menu (does not restart)', async ({ page }) => {
  await login(page);
  await page.locator('.game-tile[data-category="add_easy"]').click();
  await expect(page.locator('#gameScreen')).toBeVisible();

  await playAllCorrect(page);
  const modal = page.locator('#popupModal');
  await expect(modal).toBeVisible();

  // Exit closes the popup and returns to the menu — NOT a fresh game.
  await page.locator('#popupExitButton').click();
  await expect(modal).toBeHidden();
  await expect(page.locator('#menuScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});

test('COMPLETION ESCAPE: pressing Escape on the popup exits to the menu', async ({ page }) => {
  await login(page);
  await page.locator('.game-tile[data-category="add_easy"]').click();
  await expect(page.locator('#gameScreen')).toBeVisible();

  await playAllCorrect(page);
  const modal = page.locator('#popupModal');
  await expect(modal).toBeVisible();

  // The popup's keydown handler maps Escape -> exit (Enter -> play again).
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.locator('#menuScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});
