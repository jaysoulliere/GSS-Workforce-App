# GSS Workforce — Internal Manager Web App

Internal tool for Global Security Solutions (Michigan) supervisors. Replaces the
Claude `gss-workforce` plugin with a multi-user web app.

## What it does

- **Document generators** — onboarding letter + Humanity credentials, attendance
  write-ups, corrective action / warnings / CAPs, termination notice / separation
  letter / UIA summary. Every generated document is logged to Supabase.
- **Employee forms** — time off, supervisor visit log, job applications. Saved to
  Supabase so multiple managers see the same data.
- **Humanity admin** — real REST calls (via server-side proxy) to list time clocks,
  create shifts, and provision users.
- **AI assistant** — chat with Claude, routed through a Vercel serverless function
  using your server-side Anthropic key.

## Architecture

```
Browser  ──►  /public/index.html           static
              /public/login.html            static
                  │
                  ├─►  Supabase  (Postgres + Auth)        — submissions, generated docs
                  ├─►  /api/anthropic   (Vercel function) — Claude proxy
                  └─►  /api/humanity    (Vercel function) — Humanity REST proxy
```

The frontend never sees your Anthropic or Humanity keys — both are server-side env
vars on Vercel. Supabase RLS restricts data to authenticated users.

## Repo layout

```
gss-workforce-app/
├── api/
│   ├── _auth.js          shared Supabase JWT verifier
│   ├── anthropic.js      Claude proxy
│   └── humanity.js       Humanity REST proxy
├── public/
│   ├── config.js         frontend Supabase URL + anon key (edit this!)
│   ├── index.html        main app
│   └── login.html        sign-in screen
├── supabase/
│   └── schema.sql        tables + RLS — run this in Supabase SQL editor
├── package.json
├── vercel.json
├── .env.example          server-side env vars (copy values to Vercel)
└── v0-standalone-prototype.html   the single-file prototype from step 1
```

---

## Deploy (one-time setup)

You'll need accounts at: **Supabase** (free), **Vercel** (free hobby), and
**GitHub** (free). Plus an **Anthropic API key** and a **Humanity API token**.

### 1. Supabase

1. Go to https://supabase.com → New Project.
2. Name it `gss-workforce`, pick a region near you, generate a database password.
3. After it spins up, go to **SQL Editor** → New query → paste the contents of
   `supabase/schema.sql` → Run.
4. Go to **Authentication → Users → Add user** → enter your email + a strong
   password. (This is your sign-in for the app.)
5. Go to **Settings → API**. Copy:
   - **Project URL**            → `SUPABASE_URL`
   - **anon / public key**      → `SUPABASE_ANON_KEY`

   Paste these two into `public/config.js`. They are safe to expose — Row Level
   Security in the schema is what actually protects the data.

### 2. Push the code to GitHub

```bash
cd "Documents/GSS/gss-workforce-app"
git init
git add .
git commit -m "Initial GSS Workforce app"
# create a new private repo on github.com, then:
git remote add origin git@github.com:YOUR_USER/gss-workforce-app.git
git push -u origin main
```

### 3. Vercel

1. Go to https://vercel.com → Add New → Project → import the GitHub repo.
2. Framework Preset: **Other**. Root directory: leave blank. Build: leave blank
   (Vercel reads `vercel.json`).
3. Before deploying, click **Environment Variables** and add:

   | Name                  | Value                                            |
   | --------------------- | ------------------------------------------------ |
   | `SUPABASE_URL`        | from Supabase → Settings → API                   |
   | `SUPABASE_ANON_KEY`   | from Supabase → Settings → API                   |
   | `ANTHROPIC_API_KEY`   | from console.anthropic.com                       |
   | `ANTHROPIC_MODEL`     | `claude-sonnet-4-5-20250929` (optional)          |
   | `HUMANITY_API_TOKEN`  | from Humanity → Settings → API                   |
   | `HUMANITY_BASE`       | `https://www.humanity.com/api/v2` (default)      |

4. Click **Deploy**. You'll get a `https://gss-workforce-app-xxxx.vercel.app`
   URL — that's your app.

### 4. Sign in

Open the Vercel URL → you'll land on `/login.html` → sign in with the email +
password you created in Supabase step 4.

---

## Adding more managers later

In Supabase → Authentication → Users → Add user. They can sign in immediately
with no app changes. All data they read or write goes through RLS.

## Wiring the real Humanity API

`api/humanity.js` calls `https://www.humanity.com/api/v2/...` with the
`HUMANITY_API_TOKEN` env var. The supported actions are:

- `list_timeclocks { start_date, end_date, location_id? }`
- `list_employees { search? }`
- `create_shift   { employee_id, location_id, schedule_id, start_time, end_time, notes? }`
- `create_user    { first_name, last_name, email, username, password, hourly_rate, position_assignment, employment_type? }`

If your Humanity tenant uses a different endpoint shape, edit the URL templates
in `api/humanity.js`. The shifts-queue UI in the app prompts for the numeric
Humanity IDs at push time — list employees/locations/schedules in Humanity to
find them.

## Local development

```bash
npm install
npm run dev      # uses Vercel CLI (vercel dev) to run functions + static
```

You'll need a `.env.local` with the same variables as listed in `.env.example`.

## Security notes

- **Frontend keys** (in `public/config.js`) are the Supabase **anon** key. It's
  intentionally public. RLS is the gate.
- **Backend keys** (Anthropic, Humanity, Supabase service role if you ever add
  one) live only in Vercel env vars. They never reach the browser.
- The single-admin model uses one Supabase user. To audit who did what, add an
  email column to `generated_docs` and capture `auth.uid()` server-side.

## Troubleshooting

- **"Frontend not configured"** on first load → edit `public/config.js` with
  your Supabase URL + anon key, redeploy.
- **Time clocks page is empty** → your Humanity token doesn't have permission,
  or the date range is empty. Check Vercel function logs.
- **AI chat returns 401** → Supabase session expired; sign out and back in.
- **AI chat returns Anthropic error** → check `ANTHROPIC_API_KEY` in Vercel env.

## What's intentionally NOT in v0.2

- Multi-tenant separation (every authenticated user shares one workspace).
- An audit log of who clicked what.
- Email notifications.
- A public-facing employee careers form (the schema allows anon inserts to
  `applications` — wiring a public page is a small lift).
- An admin UI for managing Humanity employee/location/schedule IDs (currently
  you paste them at push time).

Ping me to add any of these.
