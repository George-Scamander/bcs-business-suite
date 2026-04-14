# BCS Indonesia Business Suite (MVP)

Bosch Car Service (Indonesia) internal business web app for:

- BD lead tracking
- customer onboarding workflow
- project execution handover and delivery control

This repository is designed for **low-ops deployment**:

- frontend hosted on Vercel / Netlify / Cloudflare Pages
- backend capabilities provided by Supabase (Auth + Postgres + Storage + RLS)
- no self-hosted server required

---

## 1. What is included

### Core business chain

- `Lead -> Signed -> Onboarding -> Project -> Completion`

### Modules

- Auth + RBAC (Super Admin / BD User / Project Manager)
- Lead management
  - lead CRUD
  - follow-up timeline
  - status machine
  - assignment and pool operation
  - CSV bulk import
- Onboarding management
  - signed-customer onboarding case creation
  - document submission + review decision
  - onboarding state machine with logs
  - SLA due visibility
- Project management
  - project list/detail/progress/tasks/members/risks/closure
  - delayed marking and progress refresh
  - PM update publishing to BD
- Admin controls
  - user-role management
  - lead pool
  - onboarding review center
  - project overview
  - report export center
  - system dictionary config
- Shared capabilities
  - notification center
  - private file center
  - operation logs
  - profile settings

### Database and security

- Supabase PostgreSQL schema + SQL functions
- Row-Level Security (RLS) policies
- audit logging via RPC functions
- private storage bucket with policy control

---

## 2. Architecture (low-ops default)

- **Frontend**: React + TypeScript + Vite + Ant Design + Tailwind
- **Backend mode**: Supabase BaaS
  - DB: Postgres
  - Auth: Supabase Auth
  - Storage: private bucket
  - access control: RLS + SQL helper functions
- **Deployment**: Vercel / Netlify / Cloudflare Pages

### Responsibility split

- Frontend:
  - rendering, forms, route guards, dashboard views
  - client-side workflow orchestration
- Supabase:
  - identity/auth sessions
  - data persistence
  - permission enforcement (RLS)
  - audit functions (`record_login`, `record_operation_log`)
  - business state transitions via RPC (`change_lead_status`, `change_onboarding_status`, `change_project_status`)
- Optional Serverless extensions (future):
  - email reminders
  - scheduled digest jobs
  - heavy async exports

This is suitable for teams without Linux server operation experience.

---

## 3. Environment variables

Create `.env` from `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_APP_NAME` | No | App display name |
| `VITE_DEFAULT_LOCALE` | No | `en` / `zh-CN` / `id-ID` |

---

## 4. Supabase initialization

In Supabase SQL Editor, run in order:

1. `supabase/migrations/202604140001_phase1_foundation.sql`
2. `supabase/migrations/202604140002_business_modules.sql`
3. `supabase/migrations/202604140003_profile_read_collaboration.sql`

Create demo auth users:

- `admin@bcs-demo.id`
- `bd@bcs-demo.id`
- `pm@bcs-demo.id`

Then run seeds:

1. `supabase/seeds/seed_demo_accounts.sql`
2. `supabase/seeds/seed_demo_business_data.sql` (optional but recommended for walkthrough)

---

## 5. Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Quality checks:

```bash
npm run lint
npm run test
npm run build
```

---

## 6. Deploy (Git push -> auto online)

### Option A: Vercel

1. Push repo to GitHub.
2. Import repo in Vercel.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Configure env vars from `.env.example`.
6. Deploy.

`vercel.json` already contains SPA rewrite.

### Option B: Netlify

1. Push repo to GitHub.
2. Import repo in Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Configure env vars from `.env.example`.
6. Deploy.

`netlify.toml` already contains SPA redirect.

### Option C: Cloudflare Pages

1. Connect GitHub repo.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Configure env vars.
5. Deploy.

---

## 7. Route map (main)

Public:

- `/login`
- `/forgot-password`
- `/reset-password`

Admin:

- `/app/admin/dashboard`
- `/app/admin/users-roles`
- `/app/admin/leads/pool`
- `/app/admin/onboarding/review-center`
- `/app/admin/projects/overview`
- `/app/admin/reports/export`
- `/app/admin/system-config`
- `/app/admin/logs`

BD:

- `/app/bd/dashboard`
- `/app/bd/leads`
- `/app/bd/leads/new`
- `/app/bd/leads/:leadId`
- `/app/bd/leads/:leadId/edit`
- `/app/bd/leads/:leadId/followups`
- `/app/bd/leads/:leadId/status`
- `/app/bd/leads/:leadId/sign`
- `/app/bd/leads/:leadId/onboarding`
- `/app/bd/onboarding`
- `/app/bd/onboarding/:caseId`
- `/app/bd/projects`
- `/app/bd/projects/:projectId`

PM:

- `/app/pm/dashboard`
- `/app/pm/projects`
- `/app/pm/projects/:projectId`
- `/app/pm/projects/:projectId/progress`
- `/app/pm/projects/:projectId/tasks`
- `/app/pm/projects/:projectId/members`
- `/app/pm/projects/:projectId/risks`
- `/app/pm/projects/:projectId/closure`

Shared:

- `/app/files`
- `/app/settings/profile`
- `/app/notifications`

---

## 8. Demo account role expectations

- `admin@bcs-demo.id`: full global view and configuration
- `bd@bcs-demo.id`: lead/onboarding operation + linked project visibility
- `pm@bcs-demo.id`: project execution and task/member/risk/closure control

---

## 9. Advanced Self-hosted Option (not default)

For larger enterprise extension, you can move to self-hosted backend (for example NestJS + self-managed PostgreSQL + queue workers).  
This is not the current recommended MVP path.

---

## 10. Notes

- This MVP prioritizes deployability, maintainability, and operation simplicity.
- Security is enforced at DB layer (RLS), not frontend-only checks.
- Email reminders are intentionally left as configurable serverless extension point.
