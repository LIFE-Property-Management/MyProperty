# Refactor LandingPage.tsx — Split, Re-style, Expand

## Context

`frontend/app/components/LandingPage.tsx` is a 527-line monolith that bundles three views (landing, login, signup) into one client component switched by `useState<View>`. It uses **inline styles with hardcoded hex colors**, **no form library**, **no design tokens**, **no real auth wiring**, and **does not use the existing shared UI primitives** in `frontend/components/ui/` (Button, Input, Card, Spinner, etc.).

The goal of this refactor is to:

1. **Split it into proper Next.js App Router routes** with separate, focused components.
2. **Align with `frontend/CLAUDE.md`** — Tailwind classes only, design tokens only, no inline styles, React Hook Form + Zod, mobile-first responsive.
3. **Reuse the existing `frontend/components/ui/` primitives** instead of duplicating them.
4. **Wire forms structurally but leave submit handlers as stubs with explicit TODOs** — backend landlord registration / Keycloak login routing is still in flux per the user.
5. **Expand the landing page** with substantive content (features, how-it-works, dashboard mockup, stats, final CTA) so it stops looking like a marketing placeholder.
6. **Add tests** for the new schemas, forms, and key landing composition — following the existing Jest + React Testing Library conventions in this repo.

The current visual style (centered hero, brand-green CTAs, Playfair headings + DM Sans body, soft surfaces) is good and should be preserved — only the implementation changes.

---

## Architecture Overview

### New route structure (Next.js App Router)

```
frontend/app/
├── page.tsx                              [REPLACE — landing inlined here]
├── (auth)/                               [NEW route group]
│   ├── layout.tsx                        [NEW — centered Logo + back-link chrome]
│   ├── login/page.tsx                    [NEW]
│   ├── signup/page.tsx                   [NEW]
│   └── forgot-password/page.tsx          [NEW — stub "coming soon"]
├── _components/landing/                  [NEW — landing-only subcomponents]
│   ├── LandingNav.tsx
│   ├── HeroSection.tsx
│   ├── FeaturesGrid.tsx
│   ├── HowItWorks.tsx
│   ├── DashboardPreview.tsx
│   ├── StatsStrip.tsx
│   ├── FinalCTA.tsx
│   └── LandingFooter.tsx
├── components/LandingPage.tsx            [DELETE]
└── components/                           [keep folder; only this one file is removed]
```

### Shared additions

```
frontend/components/ui/
└── Logo.tsx                              [NEW — promoted to shared, used in nav + auth layout]

frontend/lib/schemas/
└── auth/
    ├── login.ts                          [NEW — loginSchema + LoginFormValues]
    └── signup.ts                         [NEW — signupSchema + SignupFormValues]

frontend/lib/hooks/auth/
├── useLoginMutation.ts                   [NEW — TanStack Query useMutation stub with TODO]
└── useSignupMutation.ts                  [NEW — same, stub with TODO]
```

`lib/schemas/auth/` is the centralized home (not co-located) so that future TanStack Query mutation hooks in `lib/hooks/auth/` can import schemas without `lib/` reaching upward into `app/`. This matches the dependency direction `app/ → lib/`.

---

## Files to create

### `frontend/components/ui/Logo.tsx`

Promoted from the inline `Logo` function in `LandingPage.tsx`. Props: `{ size?: number }` (default 22). Rendered with Tailwind only — green square `bg-primary` with house SVG inside, brand text `font-heading` with `text-primary-text`. No inline styles. Default export + named export, matching `Button.tsx` / `Card.tsx` convention.

### `frontend/lib/schemas/auth/login.ts`

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
```

### `frontend/lib/schemas/auth/signup.ts`

Align with the backend `User` entity (`backend/MyProperty.Domain/Entities/User.cs`):

- `firstName: required, trimmed`
- `lastName: required, trimmed`
- `email: required, valid email`
- `phone: optional` (matches `string? Phone` in the entity — do NOT make it required, even though the original form did)
- `password: required, min 8`
- `confirm: required, must match password` (use `.refine()` on the object)

Export `signupSchema` and `SignupFormValues`.

### `frontend/lib/hooks/auth/useLoginMutation.ts`

Stub `useMutation` from TanStack Query. Returns the same shape as a real mutation. Inside `mutationFn`:

```ts
// TODO(auth): wire to Keycloak login or backend /api/v1/auth/login.
// Currently no public endpoint exists. When ready:
//   - Call the backend, exchange for Keycloak token, or redirect to Keycloak.
//   - Decode JWT and call useAuthStore.getState().setAuth(payload).
//   - Redirect to /dashboard (landlord) or /tenant/dashboard (tenant) based on role.
await new Promise((r) => setTimeout(r, 1200));
throw new Error("Authentication is not yet implemented.");
```

Return `useMutation<void, Error, LoginFormValues>(...)`. The form catches the error via `mutation.error` and renders it.

### `frontend/lib/hooks/auth/useSignupMutation.ts`

Same shape, with a more detailed TODO:

```ts
// TODO(auth): landlord registration path is not yet decided.
// Backend has no public registration endpoint (CLAUDE.md: "Tenants cannot
// self-register"; landlord path TBD). Two likely options:
//   1. Add POST /api/v1/auth/register-landlord that provisions a Keycloak user
//      via the admin client + creates the User entity + assigns the Landlord role.
//   2. Redirect to Keycloak's own registration page and rely on a post-login
//      sync hook to create the User entity on first /me call.
// Tenants are NEVER allowed here — that flow lives in /invite/[token].
```

### `frontend/app/(auth)/layout.tsx`

Server component. Renders centered chrome shared by `/login`, `/signup`, `/forgot-password`:

- Full-screen flex column, `bg-background`, `min-h-screen`.
- Centered `<Logo size={22} />` with `mb-8`.
- `{children}` (each page renders its own `<Card>`).
- `← Back to home` link below the card, using `next/link`, `text-muted-text text-sm`.

Replaces the duplicated outer wrappers in the old `LoginView` and `SignupView`.

### `frontend/app/(auth)/login/page.tsx`

Client component. Form skeleton:

- `useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })`
- `useLoginMutation()` from the new hook
- `<Card padding="lg" className="w-full max-w-md">` wrapping:
    - Heading "Welcome back" (h2, `font-heading text-2xl`)
    - Subtitle "Log in to your landlord account" (`text-muted-text text-sm`)
    - `<Input label="Email address" type="email" {...register("email")} error={errors.email?.message} />`
    - Password `<Input>` same pattern
    - "Forgot password?" `<Link href="/forgot-password">` on the right (`text-sm text-primary`)
    - `<Button type="submit" fullWidth isLoading={mutation.isPending}>Log in</Button>`
    - If `mutation.isError`: `<p className="text-danger text-sm mt-3">{mutation.error.message}</p>`
    - "Don't have an account? `<Link href="/signup">Sign up</Link>`"

### `frontend/app/(auth)/signup/page.tsx`

Same pattern as login but with:

- Heading "Create your account" / subtitle "Sign up as a landlord — free to get started"
- Inputs in this order: First name, Last name (side-by-side on `md:`), Email, Phone (with hint "Optional"), Password (hint "At least 8 characters"), Confirm password
- "Already have an account? `<Link href="/login">Log in</Link>`"
- Small note at the bottom: "Are you a tenant? You'll receive an invite from your landlord by email — there's no self-signup for tenants." (`text-xs text-muted-text mt-4 text-center`)

### `frontend/app/(auth)/forgot-password/page.tsx`

Stub page. `<Card>` with heading "Reset your password", text "Password reset is coming soon. Please contact your landlord or support if you've lost access.", and a link back to `/login`. Inside, leave a TODO comment block explaining the future implementation.

### `frontend/app/_components/landing/*` — Landing subcomponents

All are server components (no client interactivity needed except `LandingNav`'s links, which use `next/link` and work in server components). Tailwind-only.

**`LandingNav.tsx`** — Top nav: `<Logo />` on left, `<Link href="/login">` (secondary button) and `<Link href="/signup">` (primary button) on right. Use `<Button>` styling — wrap `<Link>` children inside `<Button>` is not possible without `asChild`, so render `<Link>` directly with the same Tailwind class strings as the Button primitive. Acceptable duplication for now; revisit if a second consumer needs link-as-button.

**`HeroSection.tsx`** — Existing hero content (badge, h1, paragraph, two CTA buttons, feature pills). Reuse `<Button>` for the CTAs (wrapping `<Link>`s the same way as the nav). Mobile-first: `text-4xl md:text-5xl lg:text-6xl` for the h1; existing `clamp()` becomes Tailwind responsive classes.

**`FeaturesGrid.tsx`** — Section "Everything you need to manage your properties." Three columns on `md:`, single column on mobile. Each card uses the shared `<Card>` primitive. Three features:

1. **Lease management** (icon: document) — "Track lease start/end dates, terms, and renewals from one dashboard."
2. **Automated rent collection** (icon: dollar) — "Tenants pay online; you get notified the moment money arrives."
3. **Tenant portal** (icon: users) — "Tenants see their payment history, lease, and reach out to you — no more lost emails."

Icons: inline SVGs (24px, `text-primary`). Keep them simple.

**`HowItWorks.tsx`** — Three-step numbered strip. Section heading "Get started in minutes." Each step: a circled number (`w-10 h-10 rounded-full bg-primary-light text-primary font-heading`), short title, one-line description.

1. **Add your property** — "Tell us about the unit: address, rent, lease terms."
2. **Invite your tenant by email** — "We'll send them a secure invite link. No signup needed on their end."
3. **Track rent automatically** — "Tenants pay; you confirm. Receipts, history, reminders — all handled."

**`DashboardPreview.tsx`** — A stylized HTML/Tailwind mockup of the dashboard (no real screenshot). Approach:

- Outer wrapper: `<Card>` with subtle shadow (`shadow-lg`), browser-chrome top bar (three colored dots), then inside a faux dashboard layout — a sidebar with 3 menu items, a top stat row (3 numbers in faux cards), and a faux properties table with 3 rows.
- All elements use design tokens (`bg-surface`, `bg-background`, `border-border`, `text-muted-text`). The data is placeholder strings like "Maple Street 12", "John Smith", "$1,200".
- Mobile: hide the sidebar (`hidden md:block`), shrink the table to 1-2 columns.
- This is purely decorative — no interactivity. Wrap in a div with `pointer-events-none select-none` to prevent users trying to click the fake table.

**`StatsStrip.tsx`** — Three big numbers in a horizontal strip (stacked on mobile). Use `font-heading text-4xl md:text-5xl text-primary` for the numbers; `text-sm text-muted-text` for the labels.

```
$0 collected · 0 properties managed · 0 landlords onboarded
```

Mark each value with a `data-todo="real-stats"` attribute and a comment:

```tsx
{/* TODO(landing): wire to /api/v1/stats/public once that endpoint exists.
    See backend M4+ planning. Until then placeholder zeros (deliberately
    honest — do not put fake inflated numbers). */}
```

**`FinalCTA.tsx`** — Full-width section before the footer. Background: `bg-primary-light` (the tinted variant). Centered:

- Heading `font-heading text-3xl md:text-4xl text-primary-text`: "Ready to simplify property management?"
- Subtext `text-muted-text`: "Get started today. No credit card required."
- Single big primary `<Button size="lg">` wrapped in `<Link href="/signup">`: "Get started — it's free"

**`LandingFooter.tsx`** — Existing footer copy: `© 2026 MyProperty. Built for landlords, by landlords.` Keep it minimal. Mobile-first: `py-6 md:py-8`.

### `frontend/app/page.tsx` (rewrite)

Replace the current re-export with a server component that composes the landing in order:

```tsx
import LandingNav from "./_components/landing/LandingNav";
import HeroSection from "./_components/landing/HeroSection";
import FeaturesGrid from "./_components/landing/FeaturesGrid";
import HowItWorks from "./_components/landing/HowItWorks";
import DashboardPreview from "./_components/landing/DashboardPreview";
import StatsStrip from "./_components/landing/StatsStrip";
import FinalCTA from "./_components/landing/FinalCTA";
import LandingFooter from "./_components/landing/LandingFooter";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main id="main-content" className="flex-1">
        <HeroSection />
        <DashboardPreview />
        <FeaturesGrid />
        <HowItWorks />
        <StatsStrip />
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
```

Note: `app/layout.tsx` already sets `body` to `min-h-full flex flex-col`, so this just slots into the column. The skip-link in `layout.tsx` points to `#main-content` — preserve that id.

---

## Files to modify / delete

- **DELETE** `frontend/app/components/LandingPage.tsx` (whole file).
- **REWRITE** `frontend/app/page.tsx` as above (was a single-line re-export).
- Leave `frontend/app/components/` folder in place — other components live there.

---

## Styling rules (applied consistently across all new files)

Per `frontend/CLAUDE.md`:

- **No inline `style={{}}` objects.** Tailwind classes only.
- **Mobile-first.** Use base classes for mobile; `md:` (≥768px) and `lg:` (≥1024px) for larger. **Do not use `sm:`, `xl:`, or `2xl:`** — three breakpoints only.
- **Design tokens only.** Never hex colors. Use `bg-primary`, `text-primary`, `bg-primary-light`, `hover:bg-primary-dark`, `text-muted-text`, `text-primary-text`, `bg-surface`, `bg-background`, `border-border`, `text-danger`, etc. The replaced hex map: `#275D2C` → `primary`; `#e8f0e9` → `primary-light`; `#1a3d1d` → `primary-dark`; `#fbfbff` → `background`; `#1a1a1a` → `primary-text`; `#6b7280` → `muted-text`; `#e5e7eb` → `border`; `#b91c1c` → `danger`.
- **Hover on primary actions only.** Use `hover:bg-primary-dark` on primary CTAs. Secondary/chrome buttons use `hover:bg-neutral-light` (NOT `hover:bg-primary-light`, even though the old code did — CLAUDE.md is specific about this).
- **Focus rings:** `focus-visible:` not `focus:`.
- **No motion library.** Only `transition-colors duration-150` is allowed.
- **Headings auto-use `font-heading`** via `globals.css`. Do not add `font-heading` to `<h1>`–`<h6>`. **DO add `font-heading`** to `<span>` brand text in the Logo (already the pattern).
- **Dark mode is automatic** via `prefers-color-scheme` in `globals.css`. Do not add `dark:` variants; tokens already flip.

---

## Tests

Per `frontend/CLAUDE.md`:
- Jest + React Testing Library
- Use `fireEvent`, NOT `userEvent`
- Tests import the component-under-test via **relative** path; shared utilities and types via `@/`
- Mirror existing mock patterns (Batch L1 / L2 tests — executor: grep `frontend/` for these to find the canonical pattern)
- `jest.config.mjs` already wires `@/` via `moduleNameMapper`

A few project-specific gotchas (per stored memory):
- **jsdom can't reliably observe `disabled` button state during a click.** Assert `isLoading` indirectly via the rendered loading text/spinner or `aria-busy`, not by clicking and asserting the disabled flag flipped.
- **Test files that contain JSX must be `.tsx`.**
- **`QueryClientProvider` must be rendered as JSX** in a wrapper, not constructed imperatively.

### Test helper to add

`frontend/test-utils/renderWithQueryClient.tsx` (new, if it doesn't already exist — first grep for any existing helper):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

export function renderWithQueryClient(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options);
}
```

If a helper with this shape already exists in the repo, **use that one** — do not introduce a parallel helper.

### Test files to create

#### 1. `frontend/components/ui/__tests__/Logo.test.tsx`
- Renders the brand text "MyProperty".
- Accepts a `size` prop and applies it (assert the `<span>` font-size or the wrapper width — whichever is observable).
- Smoke test only; this is a static component.

#### 2. `frontend/lib/schemas/auth/__tests__/login.test.ts`
- `loginSchema.parse({ email: "", password: "" })` → throws with `"Email is required"` and `"Password is required"`.
- `loginSchema.parse({ email: "not-an-email", password: "x" })` → throws with `"Enter a valid email"`.
- `loginSchema.parse({ email: "a@b.co", password: "x" })` → succeeds.

#### 3. `frontend/lib/schemas/auth/__tests__/signup.test.ts`
- Empty object → fails with all required-field messages (firstName, lastName, email, password, confirm); phone is NOT in the error set.
- Invalid email → "Enter a valid email".
- Password < 8 chars → length error.
- `password === "abcdefgh"` and `confirm === "different"` → "Passwords do not match".
- `phone === undefined` and `phone === ""` are both accepted.
- Whitespace-only `firstName`/`lastName` is rejected (the `.trim()` then min(1) pair).
- Valid full object succeeds.

#### 4. `frontend/app/(auth)/login/__tests__/page.test.tsx`
- Render via `renderWithQueryClient`.
- **Empty submit shows both errors.** `fireEvent.click(submit)`; assert "Email is required" and "Password is required" appear.
- **Bad email shows email error.** Use `fireEvent.change` to type into the email field; click submit; assert "Enter a valid email".
- **Valid submit triggers the stub error.** Fill email + password; click submit; `await findByText("Authentication is not yet implemented.")`.
- **"Sign up" link points to `/signup`.** Assert the anchor's `href`.
- **"Forgot password?" link points to `/forgot-password`.**
- Note: do NOT assert `disabled` state on the submit button mid-flight (jsdom limitation). Instead, look for the loading indicator inside the button.

#### 5. `frontend/app/(auth)/signup/__tests__/page.test.tsx`
Same overall pattern as login, plus:
- **Phone field is optional**: leaving it empty does not produce an error.
- **Password mismatch produces the confirm error.** Fill mismatching values; click submit; assert "Passwords do not match".
- **Tenant note is rendered** with the exact substring "no self-signup for tenants".
- **"Log in" link points to `/login`.**

#### 6. `frontend/app/(auth)/forgot-password/__tests__/page.test.tsx`
- Renders the "Reset your password" heading and the "coming soon" copy.
- Link back to `/login` is present.

#### 7. `frontend/app/_components/landing/__tests__/LandingNav.test.tsx`
- Renders the Logo (assert brand text presence).
- Renders a link to `/login` and a link to `/signup` (assert hrefs).

#### 8. `frontend/app/_components/landing/__tests__/HeroSection.test.tsx`
- Renders the main heading "Manage your properties" (assert substring match).
- Both CTA buttons exist; primary CTA links to `/signup`; secondary CTA links to `/login`.

#### 9. `frontend/app/_components/landing/__tests__/FeaturesGrid.test.tsx`
- All three feature titles render ("Lease management", "Automated rent collection", "Tenant portal").

#### 10. `frontend/app/_components/landing/__tests__/HowItWorks.test.tsx`
- All three step titles render.
- Numbers "1", "2", "3" are present.

#### 11. `frontend/app/_components/landing/__tests__/StatsStrip.test.tsx`
- Renders three placeholder values.
- Each value has `data-todo="real-stats"` (assert via `getAllByTestId` or `querySelectorAll`).

#### 12. `frontend/app/_components/landing/__tests__/FinalCTA.test.tsx`
- Heading "Ready to simplify property management?" renders.
- The CTA link points to `/signup`.

#### 13. `frontend/app/__tests__/page.test.tsx` (landing composition)
Smoke test the assembled page:
- All key section landmarks render (Hero heading, Features heading, How-it-works heading, Stats values, Final CTA heading, Footer copyright).
- No assertion on order beyond "all present" — keep this test resilient to section reordering.

### What we are NOT testing (and why)

- **`DashboardPreview.tsx`**: it's decorative content with no logic; visual regression should be checked manually. A snapshot test would add brittleness without value.
- **`useLoginMutation` / `useSignupMutation`**: they're explicitly stubs that always throw the same error. Test them indirectly via the form integration tests in (4) and (5).
- **`(auth)/layout.tsx`**: covered indirectly by the page tests (each auth page test will render through the layout when using `app/` test-route rendering — though Jest doesn't run Next.js routing, so this is implicit, not explicit). Don't add a separate test for it.
- **`Logo` deep visual properties** (exact SVG paths, exact hex values): we'd be testing Tailwind, not our code.

### Running the tests

From `frontend/`:

```bash
npm test                           # full suite
npm test -- --watch                # watch mode during dev
npm test -- login/page.test        # filter to a single test
```

All new tests must pass. Existing tests must continue to pass (the refactor shouldn't touch them).

---

## Phase-by-phase execution order

The executor should do these in order — earlier phases unblock later phases:

1. **Create `Logo.tsx` in `components/ui/`** + its test. Confirms the shared primitive works.
2. **Create the two Zod schemas** in `lib/schemas/auth/` + their tests. Pure files, easy to verify.
3. **Create the two stub mutation hooks** in `lib/hooks/auth/`. No tests yet (covered via form tests).
4. **Create or locate `renderWithQueryClient` helper** (grep first for any existing one).
5. **Create `(auth)/layout.tsx` and the three pages** + their tests. At this point `/login` and `/signup` should both be reachable and the forms should validate client-side and show "Authentication is not yet implemented." on submit. Tests should pass.
6. **Create the 8 landing subcomponents** + their tests. Build them one at a time, starting with the simplest (`LandingFooter`, `LandingNav`).
7. **Rewrite `app/page.tsx`** to compose them + landing composition test.
8. **Delete `app/components/LandingPage.tsx`.**
9. **Run typecheck + lint + the full test suite** (see Verification).

---

## Reuse — explicit list

Do not reimplement these. Use them as-is:

- `Button` from `@/components/ui/Button` — variants `primary` / `secondary` / `ghost` / `danger`; sizes `sm` / `md` / `lg`; props `isLoading`, `fullWidth`, `leftIcon`, `rightIcon`. Already has `focus-visible` rings and `transition-colors`.
- `Input` from `@/components/ui/Input` — forwards ref so `{...register("field")}` works. Props: `label`, `hint`, `error`, `leftAddon`, `rightAddon`. Renders error state via `border-danger` automatically.
- `Card` from `@/components/ui/Card` — `padding="sm"|"md"|"lg"`, `as="section"|"article"|"div"`. Default `bg-surface border border-border rounded-xl`.
- `Spinner` from `@/components/ui/Spinner` — already wired into `Button isLoading`.
- `Link` from `next/link` — for all internal nav.

Form pattern (mirror the tenant forms in `app/(tenant)/_components/`):

```tsx
const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
});
const mutation = useLoginMutation();
const onSubmit = handleSubmit((data) => mutation.mutate(data));

<form onSubmit={onSubmit} noValidate>
  <Input label="Email address" type="email" {...register("email")} error={errors.email?.message} />
  ...
  <Button type="submit" fullWidth isLoading={mutation.isPending}>Log in</Button>
</form>
```

---

## TODOs left for follow-up PRs

These are deliberate stubs. The executor should leave the comments exactly as specified above so they're greppable:

- `TODO(auth):` in both mutation hooks — backend wiring.
- `TODO(landing):` in `StatsStrip.tsx` — replace placeholder zeros with real stats endpoint.
- The `forgot-password` page stub.
- The tenant note in `signup` page is **not** a TODO — that's permanent copy reflecting the invite-only tenant policy.

---

## Verification

1. **Typecheck.** From `frontend/`: `npm run typecheck` (or `pnpm typecheck` — check `package.json` `scripts` for the exact name). Must pass with zero errors. Strict mode is on; no `any`.
2. **Lint.** `npm run lint`. Must pass.
3. **Test suite.** `npm test`. All new tests pass; no existing tests broken.
4. **Grep for stale references.** Before deletion: `rg "LandingPage" frontend/` — only the file itself and `app/page.tsx` should match. After deletion: no matches.
5. **Manual run.** `npm run dev`. Visit:
    - `/` — landing page renders all sections; both CTA buttons navigate (to `/signup` and `/login`); responsive at mobile width (`< 768px`), `md` (`768px+`), and `lg` (`1024px+`); dark mode flips correctly when OS-level dark mode is toggled.
    - `/login` — form validates (empty email shows error; bad email format shows error; empty password shows error); submit triggers loading spinner then shows "Authentication is not yet implemented."; "Sign up" link goes to `/signup`; "Forgot password?" goes to `/forgot-password`; "Back to home" returns to `/`.
    - `/signup` — same validation behavior; first/last name are side-by-side on `md+`, stacked on mobile; phone is optional (empty submit doesn't error on phone); password mismatch shows the confirm error; tenant note is visible at the bottom.
    - `/forgot-password` — placeholder card renders; "Back to login" link works.
6. **Visual regression check.** Compare the landing hero before/after side-by-side — the badge, h1, two CTAs, and pills should look essentially identical. If they don't, fix the Tailwind classes (not the design tokens).
7. **Accessibility smoke.** Tab through the landing page — focus rings should be visible (`focus-visible:ring-primary`). The skip-link in `layout.tsx` still works (Tab once on page load).

---

## Non-goals (out of scope for this PR)

- Wiring real Keycloak/backend auth.
- Implementing forgot-password.
- Real stats data.
- Adding the FAQ, trust strip, or product screenshots (deferred per landing-section selection).
- Touching the tenant invite flow at `/invite/[token]`.
- Modifying `app/layout.tsx`, `Providers`, or any other existing component.
- E2E tests (Playwright/Cypress) — out of scope; relying on the unit/integration tests + manual smoke.
