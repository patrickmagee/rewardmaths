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
3. **Store the key as a secret** (never in the repo):
   ```
   cd worker/session-email
   npx wrangler secret put RESEND_API_KEY
   ```
4. **Deploy:**
   ```
   npx wrangler deploy
   ```
   (Uses the Cloudflare token in the repo-root `.cloudflare.env`, same as the
   site.) The cron trigger is registered automatically.

## Check it without waiting for a kid

The Worker's HTTP URL is **dry-run only** — it reports what it *would* send and
never sends. After deploy:

```
curl https://rewardmaths-session-email.<your-subdomain>.workers.dev/
```

You'll get JSON listing each child and whether a session is open, finished, or
already emailed.

## Local logic test (no Cloudflare, no email)

```
node worker/session-email/test.mjs
```

Runs the real session logic against the logs in `../../tmp-logs/` with a fake
KV: fires after idle, stays quiet while a child is still active, never emails
the same session twice. `src/sweep.js` is deliberately free of Cloudflare
globals so this works.

## Turn it off / tune it

- Pause: comment out `[triggers]` in `wrangler.toml` and redeploy, or delete the
  Worker in the Cloudflare dashboard.
- Change the idle window: `IDLE_MINUTES` var.
- The per-child "already emailed" watermark lives in KV as `notify:<user>`;
  deleting it lets the current session email again (useful when testing).
