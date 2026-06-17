# CLAUDE.md — BD System Development Guidelines

## Project Objective

Unify and optimize the application's UI, UX, responsive design, and dark mode **while preserving all existing functionality, data flows, permissions, forms, APIs, routes, and business logic**.

The project continues to use:

- React 19
- TypeScript
- Vite
- Ant Design v6
- Tailwind CSS v3
- Existing CSS Variables
- IBM Plex Sans / IBM Plex Mono

**Do NOT introduce another major UI component library**, including:

- shadcn/ui
- Material UI
- Bootstrap
- Chakra UI

---

## Baseline

Pre-modification baseline (branch: `ui-unification`, commit: `aa3aa4b`):

| Check | Result |
|-------|--------|
| `npm run test` | 14 tests passed (4 files) |
| `npm run build` | ✅ Success |
| `npm run lint` | ❌ 13 pre-existing errors, 0 warnings |

UI modifications **must not introduce new build, test, or lint problems**.

---

## Protected Files and Areas

The following files must **not be modified without explicit per-change approval**:

```
src/lib/permissions.ts
src/lib/business-constants.ts
src/lib/constants.ts
src/lib/env.ts
src/lib/i18n.ts
src/lib/uuid.ts
src/lib/user-display.ts
src/lib/supabase/**/*
src/types/**/*
src/modules/*/api/**/*
src/modules/auth/auth-context.tsx
src/modules/auth/ProtectedRoute.tsx
src/modules/auth/RoleGuard.tsx
src/modules/shared/release-announcement.ts
supabase/**/*
package.json
package-lock.json
vite.config.*
tailwind.config.*
tsconfig.*
.env*
```

---

## Behaviour That Must Remain Unchanged

Do **not** modify:

- API endpoints
- Supabase queries
- Request payloads
- Response handling
- Database schema
- Authentication
- Authorization / RBAC
- Route paths
- Redirect behaviour
- State management logic
- Form field names
- Form validation rules
- Submit handlers
- Click handlers
- Search / filter / pagination logic
- Import / export logic
- Calculation logic
- Business statuses
- User roles
- Translation keys
- Analytics events
- Any existing user-facing functionality

---

## Allowed UI Changes

After explicit approval per change, only the following may be modified:

- Ant Design theme tokens
- CSS variables
- Typography (size, weight, line-height)
- Colors (via tokens/variables only)
- Spacing
- Borders
- Border radius
- Shadows
- Background and surface hierarchy
- Icons
- Page visual hierarchy
- Responsive layout
- Component presentation
- Accessibility presentation
- Loading / empty / error state presentation

---

## Component Policy

- **Ant Design is the primary component library.** Tailwind is used primarily for layout, spacing, and responsive arrangement.
- Do **not** rebuild existing Ant Design components with `<div>` elements.
- Prefer components in `src/components/common` as the global standard.
- Do **not** create local page-level duplicates of Button, Card, Table, Tag, or PageTitleBar.
- **Preserve all** `props`, event handlers, `ref`s, `id`s, `name`s, `value`s, `data-*` attributes, and ARIA attributes.
- Do **not** replace semantic HTML elements with non-semantic `<div>`.
- Do **not** use arbitrary Hex colors or arbitrary pixel values where a semantic design token already exists.
- Do **not** create a second theme system.

---

## High-Risk Files

The following files require extra caution — make **one clearly-scoped change at a time**:

| File | Risk |
|------|------|
| `src/index.css` | Global styles; changes affect all pages and both themes |
| `src/app/providers/AppProviders.tsx` | Ant Design token root; changes affect every component |
| `src/app/layouts/AppLayout.tsx` | All navigation, header, sidebar, and mobile layout |
| `src/app/App.tsx` | All routes and guards |

### `src/index.css` must be edited in sections — never rewritten as a whole:

1. Design Tokens (CSS variables)
2. Desktop global styles
3. Ant Design overrides
4. Dark-mode styles
5. Mobile styles
6. Mobile glass effects

---

## Modification Procedure

### Before every change:

1. List the files to be modified.
2. State the visual goal.
3. State the functional risk.
4. Show the expected scope (number of lines, which sections).
5. **Wait for explicit user approval.**

### After every change:

1. Run `npm run build` — report pass/fail.
2. Run `npm run test` — report pass/fail.
3. Run `npm run lint` — compare against the 13-error baseline; report if any new errors appear.
4. List all modified files.
5. Provide a `git diff` summary.
6. State which pages require manual browser verification.
7. **Do not commit unless the user explicitly approves.**

---

## Design Direction

| Principle | Description |
|-----------|-------------|
| Tone | Professional, clean, information-dense |
| Domain | Automotive aftermarket B2B management system |
| Information density | High density but readable; no cramped layouts |
| Role consistency | Unified experience across `super_admin`, `bd_user`, `project_manager` |
| Reference | Apple Human Interface Guidelines (hierarchy, spacing, clarity, feedback) — not a macOS/iOS copy |
| Brand | Retain Bosch deep-red (`#c10e0e`) brand identity |
| Themes | Both light and dark mode must work |
| Devices | Both desktop and mobile must work |
| Avoid | Excessive glassmorphism, excessive blur, oversized border radius, decorative animations, sacrificing information density |

---

## Communication Rules

Assume the user does **not** have a software development background.

All reports must:

- Use clear, non-technical Chinese
- State whether a change affects only appearance or also behaviour
- Clearly identify any risk to functionality
- Not ask for approval of unexplained commands
- Not expand the modification scope without prior discussion
