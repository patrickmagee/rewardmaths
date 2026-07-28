# session-email worker

Emails the parent when a child **finishes a maths session** — i.e. they played
today, then went quiet for `IDLE_MINUTES`. Runs on a 10-minute cron, reads the
live answer log from the shared `SCORES` KV namespace, and sends one email per
session via [Resend](https://resend.com).

Separate from the Pages site because Pages Functions can't run on a cron. It
binds the *same* KV namespace, so it sees exactly what the app writes.

## KV free-tier budget (why the cron is shaped like this)

The KV free tier caps **list** operations at 1000/day account-wide; reads are
100k/day. The original */5 cron did 1 profile list + 1 answers list *per child*
per run ≈ 1150 lists/day → Cloudflare's "limit exceeded" alert (2026-07-22;
lists 429 until midnight UTC, which broke the admin dashboard but not the game —
gameplay syncs never list). Now each sweep does exactly **one** list (profiles)
and computes the answer day-keys (yesterday/today/tomorrow, Europe/London)
directly as gets: */10 × 1 = 144 lists/day, leaving the rest for the site. If
you re-tune the cron, keep runs × lists-per-run well under 1000.

## What the email looks like

```
Subject: Eliza finished a maths session

Eliza finished a maths session.

  When:    Tue, 28 Jul, 16:21 to 16:29
  Rounds:  6
  Answers: 57 (50 right, 88%)
  Missed:  7 (5 answered wrong, 2 ran out of time)

4 of those 57 were second goes: a missed fact comes
straight back once in the same round, so a round can log more than 10.

Full picture: https://rewardmaths.com/admin.html
```

### Why `Answers` is not rounds × 10

`Answers` counts **records**, and the round plan is not the record count:

- a **timeout** is a record (`correct:false`, `given:null`) — a miss, not an
  unanswered question, so it is inside both halves of the accuracy figure. The
  `Missed:` line splits it out, added 2026-07-28 after the number looked wrong
  from outside;
- every missed fact **comes back once** in the same round (`requeued`), pushing a
  round above 10 — hence the second-goes note, printed only when there were any;
- a **sprint** round is 60 s of whatever fits, not 10 items (one 40 s timeout can
  leave it at 3).

So 6 rounds → 53 planned items (5×10 + a 3-item sprint) + 4 retries = 57.

## One-time setup

1. **Resend account (free):** sign up at resend.com, create an API key. You can
   send to your own address from the built-in `onboarding@resend.dev` with no
   domain setup — which is why `MAIL_FROM` defaults to it. (Later, verify a
   domain if you want it to come from `rewardmaths.com`.)
2. **Recipient / from:** edit `wrangler.toml` `[vars]` — `NOTIFY_TO` is the
   address that gets the email; `IDLE_MINUTES` and `DASHBOARD_URL` are there too.
3. **Enable Workers on the account (one time):** open the Workers & Pages
   section of the Cloudflare dashboard once. This auto-creates the account's
   `workers.dev` subdomain, which Cloudflare requires before it will register a
   cron schedule — even for a cron-only worker with no public URL.
4. **Store the key as a secret** (never in the repo):
   ```
   cd worker/session-email
   npx wrangler secret put RESEND_API_KEY
   ```
5. **Deploy:**
   ```
   npx wrangler deploy
   ```
   (Uses the Cloudflare token in the repo-root `.cloudflare.env`, same as the
   site.) The cron trigger registers automatically once step 3 is done.

## Check it without waiting for a kid

`workers_dev = false` — this is a cron-only worker with no public URL, so the
scheduled sweep can't be poked over HTTP. To watch it:

```
npx wrangler tail rewardmaths-session-email
```

then wait for the 10-minute cron (or trigger it from the Cloudflare dashboard →
the Worker → Triggers). The `fetch` handler is dry-run only, so if you ever set
`workers_dev = true` to expose a URL, hitting it reports what it *would* send
and never sends.

## Local logic test (no Cloudflare, no email)

```
node worker/session-email/test.mjs
```

Runs the real session logic against the logs in `../../tmp-logs/` with a fake
KV: fires after idle, stays quiet while a child is still active, never emails
the same session twice. `src/sweep.js` is deliberately free of Cloudflare
globals so this works.

## Who gets emailed

- `NOTIFY_TO` — every child's session email goes here (Tom, Eliza, test).
- `NO_DASHBOARD_TO` — comma-separated addresses that get the session summary
  but **not** the dashboard link (currently `siobhan80@hotmail.co.uk`, owner
  decision 2026-07-28). Being told a child played is a different decision from
  being handed their fact map, struggle flags and per-child settings, and the
  link is only as private as the dashboard password. The body is rendered
  per-recipient, so the suppressed copy contains no URL and no dangling mention
  of a dashboard — matching is case-insensitive. `test.mjs` asserts against the
  shipped value that exactly this address loses the link and the others keep it.
- `EXTRA_TO` — JSON map of *additional* per-child recipients. Currently
  Eliza → `motel71lundy89@gmail.com`, Tom → `siobhan80@hotmail.co.uk`. The
  lookup is by exact user key, so an extra only ever sees that one child's
  sessions. Each address is emailed separately, so a blocked extra never stops
  the main email. `test.mjs` asserts the shipped map's isolation.

**Extra addresses need a verified domain.** Resend's free `onboarding@resend.dev`
sender only delivers to the account owner (`NOTIFY_TO`). To reach any other
address (like the gmail above): verify `rewardmaths.com` at resend.com/domains
(add the DNS records to Cloudflare — you control both), then set `MAIL_FROM` to
an address on that domain, e.g. `RewardMaths <notify@rewardmaths.com>`. No code
change — the extras start delivering on the next cron.

## Turn it off / tune it

- Pause: comment out `[triggers]` in `wrangler.toml` and redeploy, or delete the
  Worker in the Cloudflare dashboard.
- Change the idle window: `IDLE_MINUTES` var.
- The per-child "already emailed" watermark lives in KV as `notify:<user>`;
  deleting it lets the current session email again (useful when testing).
