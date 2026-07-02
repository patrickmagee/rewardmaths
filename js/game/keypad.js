/**
 * Unified number input: on-screen pad always rendered, physical keyboard
 * always accepted (keys light the matching pad button). The answer box is
 * never a real text field, so the tablet OS keyboard never appears.
 *
 * Timing: reports the timestamp of the FIRST input event per entry
 * (initiation) and submit time; the caller computes initiation/typing ms.
 * Every entry is tagged with its input method ('tap' | 'key').
 */
export class Keypad {
    /**
     * @param {HTMLElement} host
     * @param {{ onSubmit: (entry) => void, maxLen?: number }} opts
     *   entry: { value: string, firstInputAt: number, submitAt: number,
     *            input: 'tap'|'key' }
     */
    constructor(host, opts) {
        this.host = host;
        this.opts = { maxLen: 3, ...opts };
        this.enabled = true;
        this.reset();
        this.render();
        this.keyHandler = (e) => this.onKey(e);
        window.addEventListener('keydown', this.keyHandler);
    }

    reset() {
        this.value = '';
        this.firstInputAt = null;
        this.inputMethod = null;
        if (this.display) this.display.textContent = '';
    }

    destroy() {
        window.removeEventListener('keydown', this.keyHandler);
        this.host.innerHTML = '';
    }

    render() {
        this.host.innerHTML = `
            <div class="kp-display" aria-live="polite"></div>
            <div class="kp-grid">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
                    `<button class="kp-btn" data-k="${n}">${n}</button>`).join('')}
                <button class="kp-btn kp-back" data-k="back">⌫</button>
                <button class="kp-btn" data-k="0">0</button>
                <button class="kp-btn kp-go" data-k="go">✓</button>
            </div>`;
        this.display = this.host.querySelector('.kp-display');
        this.host.querySelector('.kp-grid').addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.kp-btn');
            if (!btn || !this.enabled) return;
            e.preventDefault();
            this.press(btn.dataset.k, 'tap');
        });
    }

    onKey(e) {
        if (!this.enabled) return;
        if (/^[0-9]$/.test(e.key)) this.press(e.key, 'key');
        else if (e.key === 'Backspace') this.press('back', 'key');
        else if (e.key === 'Enter') this.press('go', 'key');
        else return;
        e.preventDefault();
    }

    press(k, method) {
        this.flash(k);
        const now = performance.now();
        if (k === 'go') {
            if (!this.value) return;
            const entry = {
                value: this.value,
                firstInputAt: this.firstInputAt,
                submitAt: now,
                input: this.inputMethod || method,
            };
            this.reset();
            this.opts.onSubmit(entry);
            return;
        }
        if (this.firstInputAt === null) {
            this.firstInputAt = now;
            this.inputMethod = method;
        }
        if (k === 'back') this.value = this.value.slice(0, -1);
        else if (this.value.length < this.opts.maxLen) this.value += k;
        this.display.textContent = this.value;
    }

    flash(k) {
        const btn = this.host.querySelector(`[data-k="${k}"]`);
        if (!btn) return;
        btn.classList.add('kp-active');
        setTimeout(() => btn.classList.remove('kp-active'), 120);
    }

    setEnabled(on) { this.enabled = on; }
}
