// Timer / timeout tests for the real Game class.
// Uses fake timers + setSystemTime so Date.now()-based elapsed timing is deterministic.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from '../../js/game.js';
import { Storage } from '../../js/storage.js';

const CATEGORY = 'add_easy';

// Build the minimal DOM the Game touches.
function buildDom() {
  document.body.innerHTML = `
    <div id="timerDisplay"></div>
    <input id="answer" />
    <div id="question"></div>
    <div id="feedback"></div>
    <div id="progressCircles"></div>
    <div id="categoryDisplay"></div>
    <ul id="leaderboardList"></ul>
  `;
}

function makeAuth(userId = 'timer-user') {
  return {
    getUserId: () => userId,
    getUsername: () => 'Patrick',
  };
}

function timerText() {
  return document.getElementById('timerDisplay').textContent;
}

function setAnswerAndCheck(game, value) {
  document.getElementById('answer').value = String(value);
  return game.checkAnswer();
}

describe('Game timer / timeouts', () => {
  let game;

  beforeEach(() => {
    // Fake only the timer primitives + Date. Leave microtask scheduling
    // (queueMicrotask/nextTick) real so awaited promises resolve normally.
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
    });
    vi.setSystemTime(new Date('2026-06-19T00:00:00.000Z'));
    buildDom();

    // The Game touches the IndexedDB-backed Storage during start()/completeGame().
    // We are testing the timer, not persistence, so stub Storage to avoid the
    // real async DB event loop (which would never settle under fake timers).
    vi.spyOn(Storage, 'getTopScores').mockResolvedValue([]);
    vi.spyOn(Storage, 'saveScore').mockResolvedValue(true);

    game = new Game(makeAuth());
    // Avoid real 500/1200ms waits between questions; we drive time explicitly.
    vi.spyOn(game, 'delay').mockResolvedValue();
  });

  afterEach(() => {
    if (game) game.cleanup();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('updates #timerDisplay to a MM:SS value reflecting elapsed time after start', async () => {
    await game.start(CATEGORY);

    // At start, 0 elapsed -> '0:00'
    expect(timerText()).toBe('0:00');

    // advanceTimersByTime advances the fake Date clock AND fires the 1s interval.
    vi.advanceTimersByTime(3000);

    expect(timerText()).toBe('0:03');
  });

  it('getElapsedTime() increases as system time advances', async () => {
    await game.start(CATEGORY);

    const t0 = game.getElapsedTime();
    expect(t0).toBe(0);

    vi.setSystemTime(new Date('2026-06-19T00:00:02.500Z'));
    const t1 = game.getElapsedTime();
    expect(t1).toBe(2500);
    expect(t1).toBeGreaterThan(t0);

    vi.setSystemTime(new Date('2026-06-19T00:00:10.000Z'));
    expect(game.getElapsedTime()).toBe(10000);
  });

  it('formats MM:SS correctly for known elapsed values (65s -> 1:05)', async () => {
    await game.start(CATEGORY);

    vi.advanceTimersByTime(65000); // 65s

    expect(timerText()).toBe('1:05');
    expect(game.getStats().elapsedTime).toBe(65000);
  });

  it('formats MM:SS correctly for a larger elapsed value (610s -> 10:10)', async () => {
    await game.start(CATEGORY);

    vi.advanceTimersByTime(610000); // 610s

    expect(timerText()).toBe('10:10');
  });

  it('cleanup() stops the interval so the display no longer changes', async () => {
    await game.start(CATEGORY);

    vi.advanceTimersByTime(5000);
    expect(timerText()).toBe('0:05');

    game.cleanup();
    expect(game.timerInterval).toBeNull();

    // Advance more time and tick: display must stay frozen (no interval firing).
    vi.advanceTimersByTime(30000);
    expect(timerText()).toBe('0:05');
  });

  it('stopTimer() called twice is safe and idempotent', async () => {
    await game.start(CATEGORY);
    game.stopTimer();
    expect(game.timerInterval).toBeNull();
    // second call must not throw
    expect(() => game.stopTimer()).not.toThrow();
    expect(game.timerInterval).toBeNull();
  });

  it('captures a positive elapsed-time (ms) at game completion', async () => {
    const saveSpy = Storage.saveScore; // already a mock from beforeEach

    await game.start(CATEGORY);

    // Drive a full 10-question game, advancing time between answers.
    let result = { isComplete: false };
    for (let i = 0; i < 10; i++) {
      // advance ~1.5s per question so total elapsed is clearly > 0
      const elapsedSoFar = (i + 1) * 1500;
      vi.setSystemTime(new Date('2026-06-19T00:00:00.000Z').getTime() + elapsedSoFar);
      const correct = game.currentQuestion.answer;
      result = await setAnswerAndCheck(game, correct);
    }

    expect(result.isComplete).toBe(true);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    const savedTimeMs = saveSpy.mock.calls[0][3]; // (userId, category, score, timeMs)
    expect(typeof savedTimeMs).toBe('number');
    expect(savedTimeMs).toBeGreaterThan(0);
    expect(savedTimeMs).toBe(15000); // 10 * 1500ms

    // Timer should have been stopped on completion.
    expect(game.timerInterval).toBeNull();
  });
});
