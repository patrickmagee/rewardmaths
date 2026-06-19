/**
 * Unit tests for the real Game class scoring + persistence.
 * Exercises js/game.js + js/storage.js against the fake-indexeddb backed localdb.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../../js/game.js';
import { Storage } from '../../js/storage.js';
import { APP_CONFIG, MESSAGES } from '../../js/config.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="categoryDisplay"></div>
        <div id="question"></div>
        <input id="answer" />
        <div id="feedback"></div>
        <div id="progressCircles"></div>
        <div id="timerDisplay"></div>
        <ol id="leaderboardList"></ol>
    `;
}

function makeAuth(userId, username = 'Tom') {
    return {
        getUserId: () => userId,
        getUsername: () => username
    };
}

/** Answer the current question correctly and advance. */
async function answerCorrect(game) {
    const input = document.getElementById('answer');
    input.value = String(game.currentQuestion.answer);
    return game.checkAnswer();
}

/** Answer the current question with a deliberately wrong value and advance. */
async function answerWrong(game) {
    const input = document.getElementById('answer');
    // Pick something guaranteed to differ from the real answer.
    input.value = String(game.currentQuestion.answer + 1);
    return game.checkAnswer();
}

describe('Game scoring + persistence', () => {
    beforeEach(() => {
        // Clear any spies/mocks from the previous test first.
        vi.restoreAllMocks();
        buildDom();
        // Skip the inter-question delays so tests are fast + deterministic.
        vi.spyOn(Game.prototype, 'delay').mockResolvedValue(undefined);
    });

    it('1. all-correct game scores 10 and final checkAnswer reports complete', async () => {
        const userId = 'user-allcorrect';
        const category = 'add_easy';
        const game = new Game(makeAuth(userId));
        await game.start(category);

        let lastResult;
        for (let i = 0; i < APP_CONFIG.QUESTIONS_PER_GAME; i++) {
            lastResult = await answerCorrect(game);
        }

        expect(lastResult).toEqual({ isComplete: true });
        expect(game.getStats().correctAnswers).toBe(10);
        expect(game.correctAnswers).toBe(10);
        expect(game.isComplete).toBe(true);

        game.cleanup();
    });

    it('2. mixed game saves a score equal to correct count, within 0..QUESTIONS_PER_GAME', async () => {
        const userId = 'user-mixed';
        const category = 'multiply_5';
        const saveSpy = vi.spyOn(Storage, 'saveScore');

        const game = new Game(makeAuth(userId));
        await game.start(category);

        // 7 correct, 3 wrong, in a deterministic interleaved pattern.
        const pattern = [true, false, true, true, false, true, true, false, true, true];
        let expectedCorrect = 0;
        for (const correct of pattern) {
            if (correct) {
                expectedCorrect++;
                await answerCorrect(game);
            } else {
                await answerWrong(game);
            }
        }

        expect(expectedCorrect).toBe(7);
        expect(game.correctAnswers).toBe(7);

        // saveScore called once with the correct count as the score.
        expect(saveSpy).toHaveBeenCalledTimes(1);
        const [savedUserId, savedCategory, savedScore] = saveSpy.mock.calls[0];
        expect(savedUserId).toBe(userId);
        expect(savedCategory).toBe(category);
        expect(savedScore).toBe(7);
        expect(savedScore).toBeGreaterThanOrEqual(0);
        expect(savedScore).toBeLessThanOrEqual(APP_CONFIG.QUESTIONS_PER_GAME);

        game.cleanup();
    });

    it('3. score is persisted once and readable back via Storage.getTopScores', async () => {
        const userId = 'user-persist';
        const category = 'sub_easy';
        const saveSpy = vi.spyOn(Storage, 'saveScore');

        const game = new Game(makeAuth(userId));
        await game.start(category);

        for (let i = 0; i < APP_CONFIG.QUESTIONS_PER_GAME; i++) {
            await answerCorrect(game);
        }

        expect(saveSpy).toHaveBeenCalledTimes(1);
        const [uId, cat, score, timeMs] = saveSpy.mock.calls[0];
        expect(uId).toBe(userId);
        expect(cat).toBe(category);
        expect(score).toBe(10);
        expect(typeof timeMs).toBe('number');
        expect(timeMs).toBeGreaterThanOrEqual(0);

        const rows = await Storage.getTopScores(userId, category);
        expect(rows.length).toBe(1);
        expect(rows[0].user_id).toBe(userId);
        expect(rows[0].category).toBe(category);
        expect(rows[0].score).toBe(10);

        game.cleanup();
    });

    it('4. double-submit guard: second Enter after completion does not inflate or re-save', async () => {
        const userId = 'user-doublesubmit';
        const category = 'add_medium';
        const saveSpy = vi.spyOn(Storage, 'saveScore');

        const game = new Game(makeAuth(userId));
        await game.start(category);

        let finalResult;
        for (let i = 0; i < APP_CONFIG.QUESTIONS_PER_GAME; i++) {
            finalResult = await answerCorrect(game);
        }

        expect(finalResult).toEqual({ isComplete: true });
        expect(saveSpy).toHaveBeenCalledTimes(1);
        const resultsAfterCompletion = game.sessionResults.length;
        expect(resultsAfterCompletion).toBe(10);

        // Simulate a stray second Enter press: input still has a value.
        document.getElementById('answer').value = String(game.currentQuestion.answer);
        const second = await game.checkAnswer();

        expect(second).toEqual({ isComplete: false });
        // No 11th result pushed.
        expect(game.sessionResults.length).toBe(resultsAfterCompletion);
        expect(game.sessionResults.length).toBe(10);
        // Score not inflated past the max.
        expect(game.getStats().correctAnswers).toBeLessThanOrEqual(APP_CONFIG.QUESTIONS_PER_GAME);
        expect(game.correctAnswers).toBe(10);
        // No second save.
        expect(saveSpy).toHaveBeenCalledTimes(1);

        game.cleanup();
    });

    it('4b. in-flight guard: a second submit while isProcessing is true is ignored mid-game', async () => {
        const game = new Game(makeAuth('user-inflight'));
        await game.start('add_easy');

        // Answer two questions normally — still mid-game, not complete.
        await answerCorrect(game);
        await answerCorrect(game);
        expect(game.isComplete).toBe(false);
        expect(game.sessionResults.length).toBe(2);
        const questionBefore = game.currentQuestion.text;
        const numberBefore = game.currentQuestionNumber;

        // Simulate the inter-question processing window (isProcessing === true,
        // isComplete === false). A stray Enter/submit must be ignored without
        // recording a result or advancing. This exercises the isProcessing
        // branch of the guard, which the post-completion test (#4) cannot reach
        // because isComplete is also true there.
        game.isProcessing = true;
        document.getElementById('answer').value = String(game.currentQuestion.answer);
        const result = await game.checkAnswer();

        expect(result).toEqual({ isComplete: false });
        expect(game.sessionResults.length).toBe(2);            // no extra result
        expect(game.currentQuestionNumber).toBe(numberBefore); // did not advance
        expect(game.currentQuestion.text).toBe(questionBefore);

        game.cleanup();
    });

    it('5. leaderboard ordering: score DESC then time_ms ASC', async () => {
        const userId = 'user-leaderboard';
        const category = 'multiply_7';

        // Insert in scrambled order; expect a specific sorted result.
        await Storage.saveScore(userId, category, 8, 5000);
        await Storage.saveScore(userId, category, 10, 9000);  // top: highest score
        await Storage.saveScore(userId, category, 10, 4000);  // tie on score, lower time -> beats the 9000
        await Storage.saveScore(userId, category, 6, 1000);
        await Storage.saveScore(userId, category, 8, 2000);   // tie on 8, lower time -> beats the 5000

        const rows = await Storage.getTopScores(userId, category);
        expect(rows.length).toBe(5);

        const ordered = rows.map(r => [r.score, r.time_ms]);
        expect(ordered).toEqual([
            [10, 4000],
            [10, 9000],
            [8, 2000],
            [8, 5000],
            [6, 1000]
        ]);

        // Explicitly assert the ordering invariant pairwise.
        for (let i = 1; i < rows.length; i++) {
            const prev = rows[i - 1];
            const cur = rows[i];
            const ok = prev.score > cur.score ||
                (prev.score === cur.score && prev.time_ms <= cur.time_ms);
            expect(ok).toBe(true);
        }
    });

    it('5b. getTopScores respects the limit argument', async () => {
        const userId = 'user-limit';
        const category = 'multiply_9';
        for (let i = 0; i < 5; i++) {
            await Storage.saveScore(userId, category, i, 1000 + i);
        }
        const limited = await Storage.getTopScores(userId, category, 3);
        expect(limited.length).toBe(3);
        // Highest scores first.
        expect(limited[0].score).toBe(4);
        expect(limited[1].score).toBe(3);
        expect(limited[2].score).toBe(2);
    });
});

describe('Game UI helpers (leaderboard / formatting / messages)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        buildDom();
    });

    it('renderLeaderboard: empty list shows "No scores yet"', () => {
        const game = new Game(makeAuth('u'));
        game.renderLeaderboard([]);
        const list = document.getElementById('leaderboardList');
        expect(list.querySelectorAll('li').length).toBe(1);
        expect(list.textContent).toContain('No scores yet');
    });

    it('renderLeaderboard: one row per score with score/N and formatted time', () => {
        const game = new Game(makeAuth('u'));
        game.renderLeaderboard([
            { score: 10, time_ms: 65000, played_at: '2026-06-19T14:05:00.000Z' },
            { score: 8, time_ms: 4000, played_at: '2026-06-18T09:30:00.000Z' }
        ]);
        const items = document.getElementById('leaderboardList').querySelectorAll('li');
        expect(items.length).toBe(2);
        expect(items[0].textContent).toContain(`10/${APP_CONFIG.QUESTIONS_PER_GAME}`);
        expect(items[0].textContent).toContain('1:05'); // 65000ms -> 1:05
        expect(items[1].textContent).toContain(`8/${APP_CONFIG.QUESTIONS_PER_GAME}`);
        expect(items[1].textContent).toContain('0:04'); // 4000ms -> 0:04
    });

    it('formatTime: renders milliseconds as M:SS', () => {
        const game = new Game(makeAuth('u'));
        expect(game.formatTime(5000)).toBe('0:05');
        expect(game.formatTime(65000)).toBe('1:05');
        expect(game.formatTime(610000)).toBe('10:10');
    });

    it('formatDate: blank input -> empty string; ISO -> DD/MM HH:MM (local time)', () => {
        const game = new Game(makeAuth('u'));
        expect(game.formatDate('')).toBe('');
        expect(game.formatDate(null)).toBe('');
        // Build the date in local time and round-trip through ISO so the
        // assertion is timezone-independent.
        const d = new Date(2026, 5, 9, 8, 7); // 9 Jun 2026, 08:07 local
        expect(game.formatDate(d.toISOString())).toBe('09/06 08:07');
    });

    it("getCompletionMessage: returns one of the known user's messages", () => {
        const game = new Game(makeAuth('u', 'Tom'));
        expect(MESSAGES.GAME_COMPLETE.Tom).toContain(game.getCompletionMessage());
    });

    it('getCompletionMessage: unknown user falls back to the Patrick set', () => {
        const game = new Game(makeAuth('u', 'Nobody'));
        expect(MESSAGES.GAME_COMPLETE.Patrick).toContain(game.getCompletionMessage());
    });
});
