# OTC — Our Team Challenge

A team fitness & discipline challenge app. An **owner** creates a challenge, shares an **invite link**, and team-mates sign in with a one-tap **email magic link** to log workouts, clean-eating/fasting days, and water — competing on a live **leaderboard** for the pot.

Built with **Next.js (App Router)** + **Supabase** (Postgres, Auth, Storage). Deploys free on Vercel.

## Scoring (owner-configurable)

| Action | Default points |
| --- | --- |
| Workout (45 min+, photo) | **5 each — unlimited**, extras are bonus |
| Clean-eating day | **3** |
| Full-day fast | **5** (instead of the clean 3) |
| Water | **1 per litre** |

Owners can change every value, cap bonus workouts, and post a weekly bonus challenge.

---

## Setup (about 15 minutes)

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**. Note your project's **URL** and **anon public key** (Project Settings → API).
2. Open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates all tables, security rules, the auto-profile trigger, and the proof-photo storage bucket.

### 2. Turn on email magic links
In Supabase → **Authentication → Providers → Email**: make sure **Email** is enabled. Magic links work out of the box on the built-in mailer for testing (low volume). For real use, add an SMTP provider under **Authentication → Emails → SMTP**.

Under **Authentication → URL Configuration**, set:
- **Site URL**: your deployed URL (e.g. `https://otc.vercel.app`) — or `http://localhost:3000` for local dev.
- **Redirect URLs**: add `http://localhost:3000/**` and your production `https://your-app.vercel.app/**`.

### 3. Configure the app
```bash
cp .env.local.example .env.local
```
Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...          # from Supabase API settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # from Supabase API settings
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # your app URL
```

### 4. Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000, sign in with your email, and create a challenge — you become the owner. Head to the **Owner** tab to grab your invite link.

---

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. On [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Add the three environment variables from your `.env.local` (set `NEXT_PUBLIC_SITE_URL` to the Vercel URL, e.g. `https://otc.vercel.app`).
4. Deploy. Then update Supabase **Site URL** and **Redirect URLs** to the Vercel domain.

---

## How it works

- **Owner** creates a challenge → automatically joins as `owner`, gets a unique `invite_token`.
- **Invite link** `/join/<token>` shows the challenge; new people sign in (magic link) and are added as `member`.
- **Check-in** writes one `entries` row per action with pre-computed points; the leaderboard is a live `SUM(points)` per member.
- **Row-Level Security** ensures people only see and edit data for challenges they belong to; only owners can change settings, manage the roster, or post bonuses.

## Roadmap / not yet built
- Proof-photo **upload UI** (storage bucket + policies are ready; the workout entry currently stores an optional photo URL).
- Awarding **weekly bonus** points to members (owner can post them; a per-member "claim/award" step is the next piece).
- Verify / flag suspicious entries.
- Push/WhatsApp reminders.

## Structure
```
app/
  login/                 magic-link sign-in
  auth/callback/         session exchange
  dashboard/             list + create challenges
  join/[token]/          invite acceptance
  c/[id]/                a challenge
    page.tsx             leaderboard
    checkin/             daily logging (client + server actions)
    progress/            personal stats + points-by-week
    owner/               invite, roster, settings, weekly bonus
lib/
  supabase/              browser / server / middleware clients
  scoring.ts             week math + point aggregation
  types.ts               shared types
supabase/schema.sql      run this in Supabase
```
