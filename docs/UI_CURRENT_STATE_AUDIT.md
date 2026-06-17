# UI Current State Audit

> Branch: `ui-unification` | Commit: `aa3aa4b` | Date: 2026-06-17
> Read-only analysis — no files were modified to produce this document.

---

## 1. Global Design Token Inventory

### 1.1 Ant Design ConfigProvider Tokens
**File:** `src/app/providers/AppProviders.tsx`

| Token | Value | Status |
|-------|-------|--------|
| `colorPrimary` | `#c10e0e` | ✅ Defined |
| `colorInfo` | `#c10e0e` | ✅ Defined (duplicates primary) |
| `borderRadius` | `10` | ✅ Defined |
| `fontFamily` | `"IBM Plex Sans", "Segoe UI", sans-serif` | ✅ Defined |
| `colorSuccess` | — | ❌ Missing (falls back to Ant Design default green) |
| `colorWarning` | — | ❌ Missing (falls back to Ant Design default amber) |
| `colorError` | — | ❌ Missing (falls back to Ant Design default red — conflicts with brand red) |
| `colorTextBase` | — | ❌ Missing |
| `colorBgBase` | — | ❌ Missing |
| `colorBorder` | — | ❌ Missing |
| `borderRadiusLG` | — | ❌ Missing (Ant Design derives from `borderRadius`) |
| `borderRadiusSM` | — | ❌ Missing |
| `lineHeight` | — | ❌ Missing |
| `fontSize` | — | ❌ Missing |
| Component Tokens | — | ❌ None set (all components use derived defaults) |

**Algorithm:**
- Light: `theme.defaultAlgorithm`
- Dark: `theme.darkAlgorithm`
- No compact algorithm used

**Critical gap:** `colorError` defaults to red in Ant Design, which visually conflicts with the brand primary red (`#c10e0e`). Error states and brand-coloured elements will look identical.

---

### 1.2 CSS Custom Properties
**File:** `src/index.css`

#### Brand / Primary colours

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--bcs-primary` | `#c10e0e` | (unchanged) | ✅ Defined |
| `--bcs-primary-soft` | `#fee2e2` | (unchanged) | ✅ Defined |

#### Surface colours

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--bcs-surface` | `#ffffff` | `#111827` | ✅ Defined |
| `--app-surface` | `#ffffff` | `#0f172a` | ⚠️ Duplicates `--bcs-surface` with slightly different dark value |
| `--app-surface-muted` | `#f3f4f6` | `#0b1220` | ✅ Defined |

#### Text colours

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--bcs-text-muted` | `#64748b` | `#9ca3af` | ⚠️ Duplicate of `--app-text-soft` |
| `--app-text` | `#0f172a` | `#e5e7eb` | ✅ Defined |
| `--app-text-soft` | `#64748b` | `#9ca3af` | ✅ Defined |

#### Border colours

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--bcs-border` | `#d1d5db` | `#1f2937` | ⚠️ Duplicate of `--app-border` |
| `--app-border` | `#d1d5db` | `#1f2937` | ✅ Defined |

#### Background

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--app-body-bg` | Radial gradient (3 layers) | Radial gradient (3 layers) | ✅ Defined, complex |

#### Navigation colours

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--app-nav-bg` | `rgba(255,255,255,0.95)` | `rgba(15,23,42,0.96)` | ✅ Defined |
| `--app-nav-border` | `#e2e8f0` | `#1e293b` | ✅ Defined |
| `--app-nav-text` | `#64748b` | `#cbd5e1` | ✅ Defined |
| `--app-nav-active-bg` | `#fef2f2` | `rgba(193,14,14,0.2)` | ✅ Defined |
| `--app-nav-active-text` | `#c10e0e` | `#fecaca` | ✅ Defined |

#### Card styles

| Variable | Light value | Dark value | Status |
|----------|-------------|------------|--------|
| `--app-card-border` | `#e2e8f0` | `#1f2937` | ✅ Defined |
| `--app-card-shadow` | `0 1px 3px rgba(15,23,42,0.05)` | `0 1px 3px rgba(0,0,0,0.4)` | ✅ Defined |

#### Mobile glass variables (mobile only, `@media (max-width: 767px)`)

| Variable | Light value | Dark value |
|----------|-------------|------------|
| `--mobile-glass-bg` | Radial + linear gradient | Radial + linear gradient |
| `--mobile-glass-surface` | `rgba(255,255,255,0.34)` | `rgba(15,23,42,0.52)` |
| `--mobile-glass-surface-strong` | `rgba(255,255,255,0.46)` | `rgba(15,23,42,0.68)` |
| `--mobile-glass-border` | `rgba(255,255,255,0.66)` | `rgba(148,163,184,0.26)` |
| `--mobile-glass-shadow` | 3-layer box-shadow | 2-layer box-shadow |

#### Missing semantic tokens (no variable defined)

| Missing | Current approach | Risk |
|---------|-----------------|------|
| Success colour | Ant Design default | Inconsistent with brand |
| Warning colour | Ant Design default | No control |
| Error colour | Ant Design default (conflicts with brand red) | **Critical** |
| Spacing scale | Arbitrary values throughout | Hard to maintain consistency |
| Border radius scale | Only `borderRadius: 10` in ConfigProvider | Mixing Tailwind `rounded-*` and manual values |
| Shadow scale | Only `--app-card-shadow` | Rest are hardcoded inline |
| Font size scale | Not defined as tokens | Tailwind defaults + some overrides |

---

### 1.3 Tailwind Config
**File:** `tailwind.config.js`

```js
colors: {
  bcs: {
    primary: '#c10e0e',   // = --bcs-primary
    slate:   '#1f2937',   // = app dark border
    muted:   '#64748b',   // = --app-text-soft
  }
}
```

**Status:** Minimal extension — 3 custom colours only.  
**Gap:** Tailwind's default `slate-*` palette is used extensively in component code (e.g. `bg-slate-50`, `text-slate-500`) but is NOT wired to CSS variables. These colours do not respond to dark mode without manual `dark:` prefixes, which are also **not configured** (Tailwind dark mode strategy is not set in config → defaults to `media` strategy, but most dark mode in this project is driven by `data-theme='dark'` attribute, creating a **mismatch**).

---

## 2. Ant Design Token Inventory

### 2.1 Currently Set

| Category | Token | Value |
|----------|-------|-------|
| Global | `colorPrimary` | `#c10e0e` |
| Global | `colorInfo` | `#c10e0e` |
| Global | `borderRadius` | `10` |
| Global | `fontFamily` | IBM Plex Sans, Segoe UI, sans-serif |
| Algorithm | Light | `theme.defaultAlgorithm` |
| Algorithm | Dark | `theme.darkAlgorithm` |

### 2.2 Not Set (Recommended Additions)

| Token | Recommended value | Reason |
|-------|------------------|--------|
| `colorError` | `#dc2626` (distinct red, not brand red) | Currently defaults to Ant Design red, identical to brand primary |
| `colorSuccess` | `#16a34a` | Explicit control |
| `colorWarning` | `#d97706` | Explicit control |
| `colorTextBase` | `#0f172a` | Align with `--app-text` |
| `colorBgBase` | `#ffffff` | Align with `--app-surface` |
| `colorBorder` | `#d1d5db` | Align with `--app-border` |
| `borderRadiusSM` | `6` | Currently uncontrolled |
| `borderRadiusLG` | `14` | Currently uncontrolled |
| `fontSize` | `14` | Currently uncontrolled |
| `lineHeight` | `1.5` | Currently uncontrolled |
| Component: `Card.borderRadius` | `12` | Standard card radius |
| Component: `Button.borderRadius` | `10` | Matches global |
| Component: `Table.headerBg` | Aligned with surface | Currently uses Ant Design default |
| Component: `Modal.borderRadius` | `14` | Slightly larger for modal hierarchy |

---

## 3. CSS Global Override Inventory

**File:** `src/index.css` (697 lines)

### 3.1 Structure

| Section | Line range | Purpose |
|---------|-----------|---------|
| `@tailwind` directives | 1–3 | Tailwind layers |
| `:root` CSS variables | 5–38 | Light theme tokens |
| `:root[data-theme='dark']` | 40–63 | Dark theme tokens |
| Global reset | 65–85 | box-sizing, html/body, background |
| Semantic utility classes | 92–110 | `.app-surface`, `.app-text`, etc. |
| Login page styles | 112–121 | `.login-page-shell` |
| Dark mode Tailwind overrides | 123–160 | `bg-white`, `text-slate-*` dark fixes |
| Mobile bottom nav | 162–208 | Fixed bottom navigation |
| Mobile action scroll | 210–222 | `.mobile-action-scroll` |
| Table overrides | 224–316 | `.adaptive-table-*`, `.compact-data-table` |
| Responsive media query (`≥768px`) | 308–316 | Table overflow |
| Mobile media query (`≤767px`) | 318–697 | Full mobile override block |
| — Mobile Ant Design overrides | 319–355 | `.ant-select`, `.ant-input`, etc. |
| — Mobile touch overrides | 357–364 | touch-action manipulation |
| — Mobile modal | 366–376 | max-width, border-radius |
| — Mobile date picker | 381–430 | Full date picker mobile fix |
| — Mobile glass tokens | 431–456 | `--mobile-glass-*` variables |
| — Mobile glass body/layout | 458–474 | html, body, #root, .ant-layout |
| — Mobile glass header | 480–494 | Header glassmorphism |
| — Mobile glass cards/tables | 540–568 | Card, table glassmorphism |
| — Mobile glass buttons | 569–605 | Button glassmorphism |
| — Mobile glass inputs | 606–620 | Input glassmorphism |
| — Mobile glass drawers/modals | 621–696 | Drawer, modal glassmorphism |

### 3.2 `!important` Usage

The mobile section uses **extensive `!important` overrides** to force glassmorphism styles over Ant Design defaults. Count: **38+ `!important` declarations** in the mobile block alone.

**Risk:** Future Ant Design upgrades may break these overrides unpredictably.

### 3.3 Conflicts and Issues

| Issue | Location | Description |
|-------|----------|-------------|
| Duplicate surface tokens | Lines 18–19, 44–45 | `--bcs-surface` and `--app-surface` both define white/dark surface with slightly different dark values |
| Duplicate muted text tokens | Lines 22, 27 | `--bcs-text-muted` and `--app-text-soft` are identical |
| Duplicate border tokens | Lines 21, 26 | `--bcs-border` and `--app-border` are identical |
| Tailwind dark mode mismatch | Lines 123–160 | Uses `[data-theme='dark']` but Tailwind config has no `darkMode: 'class'` or `selector` setting |
| Glass overrides disable `app-surface-muted` | Line 500 | `.app-surface-muted { background: transparent !important; }` breaks the utility class in mobile |
| Mobile `pb-28` in Content | AppLayout.tsx:406 | 7rem bottom padding hardcoded — not a CSS-var value |

---

## 4. Common Components Inventory

### 4.1 `AdaptiveTable` (`src/components/common/AdaptiveTable.tsx`)

| Attribute | Value |
|-----------|-------|
| Usage scope | All list/table pages across all roles |
| Responsive behaviour | Desktop: Ant Design Table; Mobile (md breakpoint): Card list |
| Hardcoded styles | `bg-slate-50`, `text-slate-500`, `text-slate-800`, `text-xs`, `text-sm`, `text-[11px]`, `px-3 py-2`, `rounded-lg` — none use CSS variables |
| Dark mode support | ❌ None — mobile card fields will show light `bg-slate-50` in dark mode |
| Needs refactor | Yes — replace hardcoded Tailwind slate colours with `var(--app-*)` tokens |
| Modification risk | **Medium** — used by ~20+ pages; visual only, no logic risk |

### 4.2 `MetricCard` (`src/components/common/MetricCard.tsx`)

| Attribute | Value |
|-----------|-------|
| Usage scope | Dashboard pages (BdDashboard, AdminDashboard, PmDashboard) |
| Component | Ant Design `Card` + `Statistic` |
| Hardcoded styles | None visible — inherits from Ant Design tokens |
| Dark mode support | ✅ Via Ant Design dark algorithm |
| Needs refactor | Low priority — already token-driven |
| Modification risk | **Low** |

### 4.3 `PageTitleBar` (`src/components/common/PageTitleBar.tsx`)

| Attribute | Value |
|-----------|-------|
| Usage scope | Nearly all pages as the primary page header |
| Hardcoded styles | `border-slate-200 bg-white` — hardcoded, does NOT use CSS vars |
| Dark mode support | ❌ None — `bg-white` will stay white in dark mode |
| Responsive | ✅ Mobile/desktop layout switch |
| Needs refactor | **Yes — highest priority among common components** |
| Modification risk | **Medium-High** — used on every page; visual change will be global |

### 4.4 `StatusTag` (`src/components/common/StatusTag.tsx`)

| Attribute | Value |
|-----------|-------|
| Usage scope | Lead, onboarding, project, task status displays |
| Component | Ant Design `Tag` with semantic color mapping |
| Hardcoded values | Ant Design semantic color names (`gold`, `blue`, `error`, `success`, etc.) — not arbitrary hex |
| Dark mode support | ✅ Ant Design handles Tag colours in dark mode |
| Needs refactor | Low priority — already uses semantic tokens |
| Modification risk | **Low** |

### 4.5 `src/components/form/` and `src/components/charts/`

Both directories are **empty** — no shared form or chart components exist.  
**Gap:** Each page builds its own form and chart layouts independently, leading to inconsistency.

---

## 5. AppLayout Inventory

**File:** `src/app/layouts/AppLayout.tsx`

### 5.1 Desktop Sidebar

| Attribute | Value | Issue |
|-----------|-------|-------|
| Width (expanded) | `248px` | Hardcoded `width` prop — not a token |
| Width (collapsed) | `80px` | Hardcoded |
| Background | `app-surface` via className | ✅ Uses CSS var |
| Border | `app-border` via className | ✅ Uses CSS var |
| Logo/title area | `px-5 py-5` / `px-3 py-5` | Hardcoded padding |
| Active item | Ant Design Menu built-in | ✅ OK |
| Collapse trigger | Custom Button | Manually managed state |

### 5.2 Desktop Header

| Attribute | Value | Issue |
|-----------|-------|-------|
| Height | `min-h-[64px]` | Hardcoded |
| Background | `app-surface` | ✅ OK |
| Border | `app-border` | ✅ OK |
| Padding | `px-3 py-2 sm:px-4 md:px-6` | Responsive, Tailwind |
| Theme toggle | ❌ Not present | Dark mode is switchable via `ThemeProvider` but there is no visible UI toggle in the header |
| User avatar | `<Avatar icon={<UserOutlined />} />` | Static — no initials or photo |
| Locale select | `style={{ width: 150 }}` | Hardcoded inline style |

### 5.3 Mobile Header

| Attribute | Value | Issue |
|-----------|-------|-------|
| Layout | Two-row (nav row + info row) | Compact but dense |
| Back button | `ArrowLeftOutlined`, shown on non-home paths | ✅ Logic correct |
| Locale select | `style={{ width: 128 }}` | Hardcoded inline style |
| Role tag | `color="red"` | Hardcoded Ant Design colour name — inconsistent with token |
| Padding | Inside `min-h-[64px]` header | May overlap with iOS safe area |

### 5.4 Mobile Drawer (Navigation)

| Attribute | Value | Issue |
|-----------|-------|-------|
| Width | `72vw` | Hardcoded |
| `bodyStyle` | `{ padding: 0 }` | Deprecated prop in Ant Design v6 (should be `styles.body`) |
| Bosch logo | `<img src="/brands/bosch-logo.png" ... />` | Static asset |

### 5.5 Mobile Bottom Navigation

| Attribute | Value | Issue |
|-----------|-------|-------|
| Items | 4 items (role-specific) | ✅ Role-aware |
| Position | Fixed, bottom | ✅ CSS class |
| Active state | `.active` className | ✅ CSS var driven |
| Glassmorphism | Applied via CSS | ⚠️ Heavy `!important` usage |

### 5.6 Content Container

| Attribute | Value | Issue |
|-----------|-------|-------|
| Desktop padding | `p-3 sm:p-4 md:p-6` | Responsive Tailwind |
| Mobile padding | `p-3 pb-28` | `pb-28` = 7rem hardcoded, not a variable |
| Background | `app-surface-muted` | ✅ CSS var — but overridden to `transparent` on mobile |
| Max-width | None set | Content stretches to full width on large screens — no max-width constraint |

### 5.7 Breakpoints

| Name | Value | Usage |
|------|-------|-------|
| Mobile threshold | `md === false` (< 768px) | Global across all layouts and components |
| Tailwind `sm` | 640px | Used in header padding |
| Tailwind `md` | 768px | Main mobile/desktop switch |
| Tailwind `lg`+ | Not used | No layout differences above 768px |

---

## 6. Page Pattern Inventory

All 50+ routes categorized by layout pattern:

### Dashboard
- `AdminDashboardPage` — metrics grid, charts, lead stats
- `BdDashboardPage` — personal lead/sales metrics
- `PmDashboardPage` — project overview
- `BdKpiDashboardPage` — KPI report with charts
- **Representative:** `BdDashboardPage`, `AdminDashboardPage`

### List / Table
- `AdminLeadPoolPage` (multiple sub-routes: overview, today-new, bcs, non-bcs, high-intent, signed, bcs-signed)
- `BdLeadsListPage`, `BdDepartmentLeadsPage`
- `PmProjectsListPage`
- `BdOnboardingListPage`, `OnboardMerchantManagementPage`
- `RecentlyDeletedPage`, `OperationLogsPage`
- **Representative:** `BdLeadsListPage`, `AdminLeadPoolPage`

### Form
- `LeadFormPage` (create/edit)
- `BdSalesCreatePage` (multi-item order form with inline table)
- `PmProjectCreatePage`
- `LeadSignContractPage`, `LeadInitiateOnboardingPage`
- **Representative:** `LeadFormPage`, `BdSalesCreatePage`

### Detail / Profile
- `LeadDetailPage`
- `BdOnboardingDetailPage`, `OnboardMerchantDetailPage`
- `BdProjectDetailPage`, `PmProjectDetailPage`
- `PmProjectProgressPage`, `PmProjectTasksPage`, `PmProjectMembersPage`, `PmProjectClosurePage`
- `ProfileSettingsPage`
- `LeadFollowupTimelinePage`
- **Representative:** `LeadDetailPage`, `PmProjectDetailPage`

### Settings / Config
- `AdminSystemConfigPage`
- `UserRoleManagementPage`
- `ProfileSettingsPage`
- **Representative:** `AdminSystemConfigPage`

### Authentication
- `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`
- **Representative:** `LoginPage`

### Report / Chart
- `AdminReportExportPage`
- `BdKpiInsightsPage`
- `AdminLeadRegionDistributionPage` (map-based)
- **Representative:** `AdminReportExportPage`

### Modal-heavy
- `SalesSupervisionPage` (create + edit via Modal, inline table editors)
- `AdminOnboardingReviewCenterPage`
- `AdminProjectOverviewPage`
- **Representative:** `SalesSupervisionPage`

### Special
- `AdminAiDataAssistantPage` — chat/assistant UI
- `FileCenterPage` — file uploads
- `PmLeadImportPage` — CSV import
- `NotificationsPage` — notification list

---

## 7. Inconsistency Issue List

### 🔴 Critical

| # | Issue | Files / Components | User Impact | Fix Level |
|---|-------|-------------------|-------------|-----------|
| C1 | `colorError` (Ant Design default red `#ff4d4f`) is visually identical to brand primary (`#c10e0e`) | `AppProviders.tsx`, all error states | Users cannot distinguish error messages from brand-coloured buttons | Token |
| C2 | `PageTitleBar` uses `bg-white border-slate-200` — invisible in dark mode | `PageTitleBar.tsx`, all pages using it | Page headers invisible on dark background | Common component |
| C3 | Tailwind dark mode strategy mismatch: project uses `data-theme='dark'` but Tailwind config has no `darkMode` selector set | `tailwind.config.js`, `src/index.css`, multiple pages | Tailwind `dark:` classes don't work; workaround `[data-theme='dark']` selectors in `index.css` are brittle | Token / Config |
| C4 | `deprecated bodyStyle prop` on Drawer (`AppLayout.tsx:274`) | `AppLayout.tsx` | Will break in future Ant Design minor update | Layout |

### 🟠 High

| # | Issue | Files / Components | User Impact | Fix Level |
|---|-------|-------------------|-------------|-----------|
| H1 | `AdaptiveTable` mobile cards hardcode `bg-slate-50 text-slate-500 text-slate-800` — no dark mode support | `AdaptiveTable.tsx` | Mobile card field rows are light grey in dark mode, unreadable | Common component |
| H2 | Two parallel surface token namespaces (`--bcs-*` and `--app-*`) with identical values and slight dark-mode divergence | `src/index.css` | Maintenance confusion; possible future drift between the two systems | Token |
| H3 | No max-width on desktop content area | `AppLayout.tsx` | On large monitors (≥1440px), content stretches to full width — poor readability | Layout |
| H4 | Mobile `pb-28` content padding is hardcoded | `AppLayout.tsx` | Cannot adjust without touching JSX; not adaptable if bottom nav height changes | Layout |
| H5 | 38+ `!important` declarations in mobile CSS | `src/index.css`, mobile section | Maintenance risk; future Ant Design updates may conflict | CSS |
| H6 | Role `<Tag color="red">` hardcoded in mobile header | `AppLayout.tsx` | Inconsistent — other UI uses semantic tokens; this bypasses the system | Layout |

### 🟡 Medium

| # | Issue | Files / Components | User Impact | Fix Level |
|---|-------|-------------------|-------------|-----------|
| M1 | `style={{ width: 128 }}` and `style={{ width: 150 }}` inline on locale Select | `AppLayout.tsx` | Not token-driven; won't adapt to locale label length | Layout |
| M2 | No shared form components — each page builds forms independently | All form pages | Inconsistent label alignment, spacing, error display across pages | Common component |
| M3 | No shared chart components — each page imports recharts directly | Dashboard, KPI pages | Chart style inconsistency across roles | Common component |
| M4 | `compact-data-table` class (10/12px cell padding) applied inconsistently | `src/index.css`, some pages | Some tables are compact, others use default padding | CSS |
| M5 | Desktop sidebar width (`248px`) hardcoded as JSX prop | `AppLayout.tsx` | Not configurable; would require code change to adjust | Layout |
| M6 | `app-surface-muted` overridden to `transparent !important` on mobile | `src/index.css` line 500 | Breaks the utility class in mobile context — cannot use it for mobile backgrounds | CSS |
| M7 | No visible dark mode toggle in the UI | `AppLayout.tsx` | Users have no in-app way to switch themes (ThemeProvider exists but no button) | Layout |

### 🟢 Low

| # | Issue | Files / Components | User Impact | Fix Level |
|---|-------|-------------------|-------------|-----------|
| L1 | `Avatar` in desktop header uses only generic icon, no initials or photo | `AppLayout.tsx` | Generic appearance; no personalisation | Layout |
| L2 | `text-[11px]` arbitrary font size in `AdaptiveTable` mobile | `AdaptiveTable.tsx` | Outside the type scale | Common component |
| L3 | `MetricCard` uses `hover:shadow-md` — not using `--app-card-shadow` token | `MetricCard.tsx` | Minor shadow inconsistency on hover | Common component |
| L4 | `BdKpiDashboardPage` and KPI pages not listed in sidebar for some roles | `AppLayout.tsx` constants | Navigation discoverability depends on role config | Layout |

---

## 8. Recommended Design Baseline

The following recommendations define target values to be implemented progressively. None are implemented yet.

### Colour System

| Semantic role | Recommended value | Notes |
|---------------|------------------|-------|
| Brand primary | `#c10e0e` | Keep existing |
| Brand primary soft | `#fee2e2` | Keep existing |
| Error | `#dc2626` | Distinct from brand red |
| Success | `#16a34a` | |
| Warning | `#d97706` | |
| Info | `#0284c7` | Currently using brand red for info — incorrect |
| Surface | `#ffffff` / `#0f172a` (dark) | Consolidate `--bcs-surface` and `--app-surface` |
| Surface muted | `#f8fafc` / `#0b1220` (dark) | |
| Text primary | `#0f172a` / `#e5e7eb` (dark) | |
| Text secondary | `#64748b` / `#94a3b8` (dark) | |
| Border | `#e2e8f0` / `#1e293b` (dark) | |

### Typography Scale

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| H1 | 24px / 1.5rem | 700 | Page title (desktop) |
| H2 | 20px / 1.25rem | 700 | Page title (mobile), section header |
| H3 | 16px / 1rem | 600 | Card title, modal title |
| Body | 14px / 0.875rem | 400 | Default text |
| Small | 12px / 0.75rem | 400 | Table cell secondary, labels |
| XSmall | 11px / 0.6875rem | 400 | Mobile field labels only — use sparingly |

### Spacing System (8px base grid)

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Tight internal gaps |
| `space-2` | 8px | Standard gap between elements |
| `space-3` | 12px | Card padding (compact) |
| `space-4` | 16px | Card padding (standard) |
| `space-5` | 20px | Section gap |
| `space-6` | 24px | Page section gap |
| `space-8` | 32px | Page top/bottom padding (desktop) |

### Border Radius Scale

| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 6px | Tags, badges, small elements |
| `radius-md` | 10px | Buttons, inputs (current default) |
| `radius-lg` | 14px | Cards, modals |
| `radius-xl` | 20px | Drawers, large surfaces |

### Shadow Scale

| Level | Value | Use |
|-------|-------|-----|
| Shadow-xs | `0 1px 2px rgba(15,23,42,0.04)` | Subtle table row |
| Shadow-sm | `0 1px 3px rgba(15,23,42,0.08)` | Card default |
| Shadow-md | `0 4px 12px rgba(15,23,42,0.12)` | Hover state, dropdown |
| Shadow-lg | `0 8px 24px rgba(15,23,42,0.16)` | Modal, drawer |

### Control Heights

| Size | Height | Use |
|------|--------|-----|
| Small | 28px | Compact table actions |
| Default | 36px | Standard buttons and inputs |
| Large | 44px | Mobile touch targets (minimum) |

### Component Standards

| Component | Standard |
|-----------|----------|
| Card | `radius-lg` (14px), `shadow-sm`, `surface` background |
| Table | Compact padding (10/12px), `surface` background, `border` on header |
| Form label | Right-aligned on desktop, top-aligned on mobile |
| Form field | Standard height (36px), `radius-md`, `border` colour |
| Modal | `radius-lg`, max-width 600px (desktop), full-screen on mobile |
| Page title | `PageTitleBar` component always — no custom title containers |
| Desktop content max-width | 1440px — prevent over-stretching on large monitors |
| Mobile content padding | `p-4 pb-24` (16px + 96px bottom for nav) |

### Dark Mode Principles

1. Never hardcode `bg-white` or `text-gray-900` — always use `var(--app-surface)` and `var(--app-text)`.
2. Ant Design dark algorithm handles component internals — do not fight it with `!important`.
3. Mobile glass effect: reduce opacity values slightly in dark mode rather than maintaining separate full-glass layers.
4. Avoid `backdrop-filter: blur()` on elements that contain interactive inputs — can cause performance issues on mobile.
