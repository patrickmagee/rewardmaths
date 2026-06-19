// Unit tests for the weekly-tick DOM renderer (ui.js updateWeeklyTicks) and the
// per-menu-view reset that stops one player's green ticks lingering for the next.
import { describe, it, expect, beforeEach } from 'vitest';
import { UI } from '../../js/ui.js';

function buildMenuDom() {
    document.body.innerHTML = `
        <div id="loginScreen"></div>
        <div id="menuScreen">
            <span id="menuUserInfo"></span>
            <div class="game-grid">
                <button class="game-tile" data-category="add_easy"><span class="tile-label">Easy</span></button>
                <button class="game-tile" data-category="sub_easy"><span class="tile-label">Easy</span></button>
                <button class="game-tile" data-category="multiply_5"><span class="tile-number">5×</span></button>
            </div>
        </div>
        <div id="gameScreen"></div>
    `;
}

const tile = (cat) => document.querySelector(`.game-tile[data-category="${cat}"]`);

describe('ui.updateWeeklyTicks (weekly tick renderer)', () => {
    beforeEach(buildMenuDom);

    it('marks only the aced categories and injects a tick badge on every tile', () => {
        const ui = new UI();
        ui.updateWeeklyTicks(['add_easy']);

        expect(tile('add_easy').classList.contains('aced')).toBe(true);
        expect(tile('sub_easy').classList.contains('aced')).toBe(false);
        expect(tile('multiply_5').classList.contains('aced')).toBe(false);

        document.querySelectorAll('.game-tile').forEach((t) => {
            expect(t.querySelectorAll('.tile-tick').length).toBe(1);
        });
        // Aced tile gets the explanatory title; others do not.
        expect(tile('add_easy').getAttribute('title')).toBe('Completed 10/10 this week!');
        expect(tile('sub_easy').hasAttribute('title')).toBe(false);
    });

    it('toggles a tile OFF when it is no longer aced (and keeps the single badge)', () => {
        const ui = new UI();
        ui.updateWeeklyTicks(['add_easy']);
        expect(tile('add_easy').classList.contains('aced')).toBe(true);

        ui.updateWeeklyTicks([]); // new week / different user with no aces
        expect(tile('add_easy').classList.contains('aced')).toBe(false);
        expect(tile('add_easy').hasAttribute('title')).toBe(false);
        expect(tile('add_easy').querySelectorAll('.tile-tick').length).toBe(1);
    });

    it('is idempotent: repeated calls never duplicate the tick badge', () => {
        const ui = new UI();
        ui.updateWeeklyTicks(['add_easy']);
        ui.updateWeeklyTicks(['add_easy', 'sub_easy']);
        ui.updateWeeklyTicks([]);
        document.querySelectorAll('.game-tile').forEach((t) => {
            expect(t.querySelectorAll('.tile-tick').length).toBe(1);
        });
    });

    it("showMenuScreen clears a previous player's green ticks (no cross-user lingering)", () => {
        const ui = new UI();
        ui.updateWeeklyTicks(['add_easy', 'multiply_5']); // "previous player" aced these
        expect(document.querySelectorAll('.game-tile.aced').length).toBe(2);

        ui.showMenuScreen('Eliza'); // entering the menu resets ticks to the default state
        expect(document.querySelectorAll('.game-tile.aced').length).toBe(0);
        expect(document.getElementById('menuUserInfo').textContent).toContain('Eliza');
    });
});
