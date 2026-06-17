# UI Refactoring Plan

> Branch: `ui-unification` | Base commit: `aa3aa4b`
> Each phase requires explicit user approval before execution.
> No code is modified when creating this document.

---

## Overview

The goal is to progressively unify the application's visual layer without breaking any existing functionality. Each phase is:
- Independently committable
- Verifiable by build + test + lint + manual browser check
- Reversible via `git revert` of the phase commit

Estimated total: **14–18 independent commits** across 10 phases.

---

## Phase 0 — Baseline and Protection ✅

**Status:** Complete (this is the current state)

**What was done:**
- Feature branch `integration/sales-product-autocomplete-v132` created and merged
- `CLAUDE.md` protection rules written
- `UI_CURRENT_STATE_AUDIT.md` produced
- `UI_REFACTORING_PLAN.md` (this document) produced
- Branch `ui-unification` created from the integrated state

**Baseline confirmed:**
- `npm run test`: 14/14 ✅
- `npm run build`: ✅ success
- `npm run lint`: 13 pre-existing errors ✅

**Files created (not modified):**
- `CLAUDE.md`
- `docs/UI_CURRENT_STATE_AUDIT.md`
- `docs/UI_REFACTORING_PLAN.md`

**Risk level:** None  
**Independent commit:** Yes (`docs: add UI unification baseline, audit, and plan`)

---

## Phase 1 — Ant Design Global Tokens

**Objective:** Establish correct semantic colour tokens in the ConfigProvider so that error/success/warning states are visually distinct from the brand primary red, and all components use a consistent type scale.

**Why first:** Token changes cascade to every component automatically with zero JSX changes. The highest return for the smallest footprint.

**Files to modify:**
- `src/app/providers/AppProviders.tsx` only

**Changes planned:**

| Token | Current | New |
|-------|---------|-----|
| `colorError` | (default Ant Design red — same as primary) | `#dc2626` |
| `colorSuccess` | (default green) | `#16a34a` |
| `colorWarning` | (default amber) | `#d97706` |
| `colorInfo` | `#c10e0e` (wrong — same as primary) | `#0284c7` |
| `colorTextBase` | — | `#0f172a` |
| `colorBgBase` | — | `#ffffff` |
| `colorBorder` | — | `#d1d5db` |
| `borderRadiusLG` | — | `14` |
| `borderRadiusSM` | — | `6` |
| `fontSize` | — | `14` |

**What does NOT change:**
- All JSX/TSX files
- All CSS files
- All routes, forms, data logic

**Risk level:** Low — token changes only; visually all Alert, Badge, Tag "error/success" colours will shift slightly  
**Verification:** `npm run build` + `npm run test` + manual check of: any error message, any success notification, any warning state  
**Pages to verify manually:** Login (error state), any lead status Tag, any form with validation error  
**Rollback:** `git revert <commit>`  
**Independent commit:** Yes (`style(tokens): add semantic colour and type tokens to ConfigProvider`)

---

## Phase 2 — CSS Semantic Variable Cleanup

**Objective:** Eliminate the duplicate token namespaces (`--bcs-*` vs `--app-*`), consolidate into a single consistent set of CSS variables, and fix the Tailwind dark mode strategy mismatch.

**Files to modify:**
- `src/index.css` — Design Tokens section only (lines 1–90 approximately)
- `tailwind.config.js` — add `darkMode: ['selector', '[data-theme="dark"]']`

**Changes planned:**
1. Remove duplicate `--bcs-surface` (keep `--app-surface`)
2. Remove duplicate `--bcs-border` (keep `--app-border`)
3. Remove duplicate `--bcs-text-muted` (keep `--app-text-soft`)
4. Add missing semantic variables: `--app-success`, `--app-warning`, `--app-error`
5. Add `--app-radius-sm`, `--app-radius-md`, `--app-radius-lg`
6. Add `--app-shadow-sm`, `--app-shadow-md`, `--app-shadow-lg`
7. Set `darkMode: ['selector', '[data-theme="dark"]']` in Tailwind config

**What does NOT change:**
- All JSX/TSX files
- Mobile glass section of `index.css`
- Ant Design override section of `index.css`
- All routes, forms, data logic

**Risk level:** Low-Medium — removing CSS variables that may still be referenced in some pages; must audit usages before deleting  
**Pre-change audit required:** `grep -r "bcs-surface\|bcs-border\|bcs-text-muted" src/` to find all usages  
**Verification:** `npm run build` + `npm run test` + visual check of light/dark mode on desktop  
**Pages to verify manually:** Any dashboard page in light and dark mode  
**Rollback:** `git revert <commit>`  
**Independent commit:** Yes (`style(tokens): consolidate CSS variable namespaces and fix Tailwind dark mode`)

---

## Phase 3 — Common Components

**Objective:** Fix the two highest-impact common component issues: `PageTitleBar` dark mode failure and `AdaptiveTable` mobile dark mode failure.

Process each component in a **separate sub-commit**.

### Phase 3a — `PageTitleBar`

**Files:** `src/components/common/PageTitleBar.tsx`

**Change:** Replace `border-slate-200 bg-white` with `app-border app-surface` (CSS variable-driven classes)

**Risk:** Medium-High — affects every page using `PageTitleBar`. Visual change only; no logic.  
**Pages to verify:** At least one page per role in both light and dark mode  
**Independent commit:** Yes

### Phase 3b — `AdaptiveTable` mobile cards

**Files:** `src/components/common/AdaptiveTable.tsx`

**Change:** Replace `bg-slate-50 text-slate-500 text-slate-800 text-[11px]` with CSS variable-driven equivalents  

**Risk:** Medium — affects all mobile list pages. Visual change only.  
**Pages to verify:** Any list page on mobile viewport in dark mode  
**Independent commit:** Yes

### Phase 3c — `MetricCard` hover shadow

**Files:** `src/components/common/MetricCard.tsx`

**Change:** Replace `hover:shadow-md` with `hover:shadow` using `--app-shadow-md` token  

**Risk:** Low  
**Independent commit:** Yes (or combine with 3b)

**What does NOT change in Phase 3:**
- Component props, event handlers, data flow
- All other components
- All page files

---

## Phase 4 — AppLayout and Navigation

**Objective:** Fix the six known issues in `AppLayout.tsx` without changing any navigation logic, route, or auth behaviour.

Process in **two sub-commits**: desktop header/sidebar, then mobile.

### Phase 4a — Desktop layout

**Files:** `src/app/layouts/AppLayout.tsx`

**Changes:**
1. Replace `bodyStyle={{ padding: 0 }}` → `styles={{ body: { padding: 0 } }}` (fix deprecated prop)
2. Replace `color="red"` on Role `<Tag>` → use `color="error"` or styled via CSS variable
3. Replace `style={{ width: 150 }}` and `style={{ width: 128 }}` on locale Select → remove inline widths, use className
4. Add max-width to desktop content container
5. Add dark mode toggle button to desktop header

**Risk:** Medium — changes to the shared layout shell visible on all pages  
**What does NOT change:** `selectedKey` logic, `navigate()` calls, auth, locale handling  
**Pages to verify:** Desktop layout in light/dark, sidebar collapse, locale switching  
**Independent commit:** Yes

### Phase 4b — Mobile layout

**Files:** `src/app/layouts/AppLayout.tsx`, `src/index.css` (mobile section only)

**Changes:**
1. Replace hardcoded `pb-28` with CSS variable `--mobile-nav-height`
2. Review and reduce `!important` count in mobile overrides (without breaking glass effect)
3. Fix `app-surface-muted` being overridden to `transparent` in mobile context

**Risk:** Medium — mobile layout touches glass effect CSS  
**Pages to verify:** Mobile home, navigation drawer, back button, bottom nav  
**Independent commit:** Yes

---

## Phase 5 — Representative Pilot Pages

**Objective:** Validate the token system and common components on 2–3 carefully selected representative pages before batch migration.

**Pilot pages selected:**

| Page | Pattern | Why |
|------|---------|-----|
| `BdDashboardPage` | Dashboard | High visibility, metrics + charts, BD role entry point |
| `BdLeadsListPage` | List/Table | Most complex table, filters, pagination, AdaptiveTable |
| `LeadFormPage` | Form | Standard form with validation, multi-field |

**Changes:**
- Align page-specific padding to the spacing system (8px grid)
- Replace any remaining `bg-white`, `text-gray-*`, `border-gray-*` with CSS variable classes
- Ensure loading, empty, and error states use correct semantic colours

**What does NOT change:** All data fetching, filtering, form submission, validation, route logic  
**Risk level:** Medium per page — isolated to each file  
**Pages to verify:** All 3 pilot pages in desktop + mobile, light + dark  
**Independent commit:** Yes — one commit per pilot page

---

## Phase 6 — Batch Page Migration

**Objective:** Apply the validated approach from Phase 5 to all remaining pages.

**Approach:** Group pages by pattern, process one group at a time.

| Group | Pages | Estimated commits |
|-------|-------|-------------------|
| Dashboard pages | AdminDashboard, PmDashboard, BdKpiDashboard, BdKpiInsights | 2 |
| Lead pages | LeadDetail, LeadFollowup, LeadSign, LeadInitiateOnboarding, BdDepartment | 2 |
| Onboarding pages | BdOnboardingList, BdOnboardingDetail, OnboardMerchant* | 2 |
| Project pages | BdProject, PmProjectsList, PmProjectDetail, PmProjectProgress, PmProjectTasks, PmProjectMembers, PmProjectClosure | 2 |
| Sales pages | BdSalesCreate, SalesSupervision | 1 |
| Admin pages | AdminLeadPool, AdminOnboardingReview, AdminProjectOverview, AdminReportExport, AdminSystemConfig, UserRoleManagement, AdminLeadRegionDistribution, AdminAiDataAssistant | 3 |
| Auth pages | LoginPage, ForgotPassword, ResetPassword | 1 |
| Shared pages | Notifications, FileCentre, OperationLogs, RecentlyDeleted, ProfileSettings | 1 |

**Risk level:** Low per individual file — patterns established in Phase 5  
**Verification per group:** Build + test + lint (must stay at ≤13 lint errors) + spot-check one page  
**Independent commit per group:** Yes

---

## Phase 7 — Mobile Optimisation

**Objective:** Improve the mobile experience without changing functionality.

**Changes:**
1. Reduce glassmorphism opacity for better readability (currently very high blur/opacity)
2. Replace arbitrary pixel values in mobile CSS with CSS variables
3. Review mobile bottom navigation item sizing (current 54px min-height)
4. Improve mobile table card layout spacing
5. Ensure all touch targets meet 44px minimum (WCAG 2.5.5)

**Files to modify:**
- `src/index.css` — mobile and glass sections only
- `src/app/layouts/AppLayout.tsx` — mobile header spacing

**What does NOT change:** Navigation logic, route behaviour, auth  
**Risk level:** Medium — glass effect is visually prominent; changes will be immediately visible  
**Pages to verify:** Mobile home screen, mobile navigation drawer, mobile lead list, mobile form entry  
**Independent commit:** Yes

---

## Phase 8 — Dark Mode

**Objective:** Ensure complete and consistent dark mode support across all pages after Phase 3–7 changes.

**Changes:**
1. Audit all pages modified in Phase 6 for any remaining hardcoded light colours
2. Fix any dark mode issues in charts (recharts defaults to light colours)
3. Verify `PageTitleBar`, `AdaptiveTable`, `MetricCard` in dark mode
4. Test the glass effect in dark mode on mobile

**Files to modify:**
- `src/index.css` — dark mode section if needed
- Any page still using `bg-white`, `text-black`, `border-gray-200` directly

**Risk level:** Low (all hardcoded colours should already be replaced by Phase 6)  
**Pages to verify:** Every page pattern in dark mode — minimum 1 representative per pattern  
**Independent commit:** Yes (if changes needed)

---

## Phase 9 — Accessibility and Visual QA

**Objective:** Ensure the visual changes maintain or improve accessibility standards.

**Checks:**
1. Colour contrast ratios: text on background must meet WCAG AA (4.5:1 for body text, 3:1 for large text)
2. Focus indicators: keyboard navigation visible in both themes
3. Touch target sizes: minimum 44×44px on mobile
4. Reduced motion: no decorative animations that would violate `prefers-reduced-motion`
5. Semantic HTML: verify no semantic elements replaced by divs in Phase 3–8

**No code changes expected** (issues found will be fixed in targeted patches)  
**Tools:** Browser DevTools accessibility panel, manual keyboard navigation test  
**Risk level:** Low  
**Independent commit:** Only if fixes needed

---

## Phase 10 — Final Regression and Release

**Objective:** Confirm baseline is maintained and the branch is ready to merge.

**Steps:**
1. `npm run build` — must pass ✅
2. `npm run test` — all 14 tests must pass ✅
3. `npm run lint` — must not exceed 13 errors (same as baseline)
4. Full manual regression: test each role (super_admin, bd_user, project_manager)
5. Test core user flows: login → lead → onboarding → sales → report → logout
6. Confirm dark mode on desktop
7. Confirm mobile layout on 375px and 414px viewport
8. Confirm no data was changed (check by inspecting network requests for unexpected calls)

**If all checks pass:**
- Create PR or merge to `main` (pending user decision)
- Archive or delete `feature/sales-product-autocomplete` original branch

**Independent commit:** No — this is a verification-only phase

---

## Recommended Priorities

### Start Here: First Pilot Change

**Recommended first actual code change:** Phase 1 — Ant Design tokens in `AppProviders.tsx`

**Why:**
- Single file, ~10 lines changed
- Zero JSX changes
- Immediately fixes the brand-red = error-red confusion
- Can be verified in 5 minutes by looking at any error message
- Easiest to rollback

### First Tokens to Add

```ts
colorError: '#dc2626',
colorSuccess: '#16a34a',
colorWarning: '#d97706',
colorInfo: '#0284c7',
```

### First Common Component to Fix

`PageTitleBar` — because it appears on every single page and its `bg-white` failure in dark mode is immediately obvious to all users.

### What NOT to Touch Yet

| Item | Reason |
|------|--------|
| `src/index.css` mobile glass section | High complexity, many `!important` interactions; do this in Phase 7 after simpler wins |
| `src/app/App.tsx` | Contains only routes and imports; no UI to change |
| Any page's data fetching or form logic | Out of scope for this project entirely |
| `tailwind.config.js` | Hold until Phase 2 — wait for token audit confirmation first |
| Charts (recharts) | Complex; leave for Phase 8 |

---

## Summary: Commit Count Estimate

| Phase | Commits |
|-------|---------|
| Phase 0 (baseline docs) | 1 |
| Phase 1 (global tokens) | 1 |
| Phase 2 (CSS variable cleanup) | 1 |
| Phase 3 (common components) | 3 |
| Phase 4 (AppLayout) | 2 |
| Phase 5 (pilot pages) | 3 |
| Phase 6 (batch pages) | 14 |
| Phase 7 (mobile) | 1 |
| Phase 8 (dark mode audit) | 1 |
| Phase 9 (accessibility fixes) | 0–2 |
| Phase 10 (regression) | 0 |
| **Total** | **27–29** |

All commits should be small, named clearly (e.g. `style(layout): fix PageTitleBar dark mode`), and independently revertable.
