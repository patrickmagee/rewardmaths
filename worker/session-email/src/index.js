/**
 * Cloudflare Worker: emails the parent when a child finishes a maths session
 * (played today, then went quiet for IDLE_MINUTES). Separate from the Pages
 * project because Pages Functions can't run on a cron; this Worker binds the
 * SAME KV namespace (SCORES) and runs on a schedule.
 *
 * Bindings / vars (wrangler.toml + one secret):
 *   SCORES           KV namespace (shared with the site)
 *   NOTIFY_TO        recipient email (you)
 *   MAIL_FROM        sender, e.g. "RewardMaths <onboarding@resend.dev>"
 *   IDLE_MINUTES     idle gap that closes a session (default 20)
 *   DASHBOARD_URL    link put in the email
 *   RESEND_API_KEY   secret: `wrangler secret put RESEND_API_KEY`
 *
 * The cron path sends for real. The HTTP path is DRY-RUN ONLY (reports what it
 * would send, never sends), so the public workers.dev URL can't be used to
 * send mail.
 */
import { sweep, renderEmail } from './sweep.js';

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(run(env, { dryRun: false }));
    },

    async fetch(request, env) {
        const out = await run(env, { dryRun: true }); // never sends
        return new Response(JSON.stringify(out, null, 2), {
            headers: { 'content-type': 'application/json' },
        });
    },
};

async function run(env, { dryRun }) {
    const idleMs = (Number(env.IDLE_MINUTES) || 20) * 60 * 1000;
    const result = await sweep(env.SCORES, { idleMs, dryRun });

    const sent = [];
    for (const r of result.results) {
        if (r.action !== 'notified') continue;
        const email = renderEmail({ name: r.name }, r.session, {
            dashboardUrl: env.DASHBOARD_URL,
        });
        if (!dryRun) await send(env, r.name, email);
        sent.push({ user: r.user, would: dryRun });
    }
    return { ...result, sent };
}

async function send(env, name, text) {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: env.MAIL_FROM || 'RewardMaths <onboarding@resend.dev>',
            to: [env.NOTIFY_TO],
            subject: `${name} finished a maths session`,
            text,
        }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
