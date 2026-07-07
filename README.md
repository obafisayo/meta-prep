# Meta PE Prep Tracker

A 62-day tracker (7 Jul → 6 Sep 2026) for Meta Production Engineer interview prep, with:

- Server-persisted progress (Postgres via Neon/Vercel Postgres)
- Browser push notifications (Web Push)
- A daily email digest (Resend) summarizing today's tasks, streak, and progress

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values described below
npm run dev
```

## One-time setup

1. **Database** — In the Vercel dashboard: Storage → Create → Postgres (Neon). Linking it to
   this project sets `DATABASE_URL` automatically. Tables are created on first request
   (see `lib/db.js`).

2. **Resend** — Sign up at [resend.com](https://resend.com), create an API key, and either:
   - use the shared test sender `onboarding@resend.dev` (only delivers to your own
     verified Resend account email), or
   - verify your own domain and set `RESEND_FROM` to an address on it.

   Set `RESEND_API_KEY` and `DIGEST_EMAIL_TO` as Vercel env vars.

3. **Web Push (VAPID keys)** — generate a keypair once:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as Vercel env vars.

4. **Cron auth** — set a random `CRON_SECRET` env var. Vercel Cron automatically sends it
   as a Bearer token to `/api/cron/daily`, so no extra config is needed beyond `vercel.json`.

5. **App URL** — set `NEXT_PUBLIC_APP_URL` to your production URL (e.g.
   `https://meta-prep.vercel.app`) once you know it.

The daily cron (`vercel.json`) hits `/api/cron/daily` at 08:00 UTC and sends both the push
notification and the email digest. Adjust the schedule/timezone in `vercel.json` if needed.

## Enabling push notifications

Open the deployed app and click "enable push notifications" — this registers the service
worker (`public/sw.js`) and stores your subscription in Postgres so the cron job can reach you.
