# session-email worker

Emails the parent when a child **finishes a maths session** — i.e. they played
today, then went quiet for 20 minutes. Runs on a 5-minute cron, reads the live
answer log from the shared `SCORES` KV namespace, and sends one email per
session via [Resend](https://resend.com).

Separate from the Pages site because Pages Functions can't run on a cron. It
binds the *same* KV namespace, so it sees exactly what the app writes.

## What the email looks like

```
Subject: Eliza finished a maths session

Eliza finished a maths session.

  When:    Mon, 20 Jul, 16:15 – 16:25
  Rounds:  6
  Answers: 63 (59 right, 94%)

Full picture: https://rewardmaths.com/admin.html
```

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

then wait for the 5-minute cron (or trigger it from the Cloudflare dashboard →
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
