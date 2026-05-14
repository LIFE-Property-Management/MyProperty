Codebase Audit Part 1 — Structural

Task 1 — Duplicate UI primitives

Same-named components (both directories)

Component: Button                                                             
Root exists: ✓                                                              
Tenant exists: ✓                                                              
Identical?: No                                                                
Differences (1 line): Root uses design tokens (bg-primary, text-primary-text),

    2 sizes, no motion; Tenant hardcodes hex arbitrary values (bg-[#275D2C]     
    dark:bg-[#3fb950]), 3 sizes, framer-motion, isLoading/icons/fullWidth       
Root import count: 5                                                          
Tenant import count: 5
────────────────────────────────────────                                      
Component: Card                                                               
Root exists: ✓
Tenant exists: ✓                                                              
Identical?: No  
Differences (1 line): Root uses tokens (bg-surface border-border); Tenant uses

    bg-[var(--color-surface)], 4 padding variants, framer-motion mount animation
Root import count: 1
Tenant import count: 3
────────────────────────────────────────
Component: DataTable                                                          
Root exists: ✓
Tenant exists: ✓                                                              
Identical?: No  
Differences (1 line): Root uses tokens (bg-surface, bg-primary-light,
text-muted-text); Tenant hardcodes hex pairs (#e5e7eb dark:#30363d, #111111
dark:#f0f6fc), adds isLoading/onRowClick/keyboard nav
Root import count: 0
Tenant import count: 1
────────────────────────────────────────
Component: Input                                                              
Root exists: ✓
Tenant exists: ✓                                                              
Identical?: No  
Differences (1 line): Root uses tokens (bg-surface, text-primary-text,
border-border, text-muted-text); Tenant hardcodes hex arbitrary values,
introduces off-token grey #6b7280 for placeholder/helper (tokens define
#4b5563), adds left/right addon slots
Root import count: 2
Tenant import count: 0
────────────────────────────────────────
Component: Modal                                                              
Root exists: ✓
Tenant exists: ✓                                                              
Identical?: No  
Differences (1 line): Root is minimal (Escape + scroll-lock, inline JSX);
Tenant uses createPortal, framer-motion AnimatePresence, focus trap,
configurable dismissOnBackdrop/dismissOnEsc, initialFocusRef; Tenant
hardcodes hex instead of tokens
Root import count: 0
Tenant import count: 1

Per CLAUDE.md ("Use exact color tokens above"): root versions are more        
compliant (they consume token classes from globals.css rather than re-inlining
hex). The tenant versions are more feature-complete but bypass tokens with   
arbitrary-value Tailwind classes, and the tenant Input/Textarea introduce
#6b7280 which is not defined in globals.css.

Single-directory components

┌──────────────┬──────────┬───────────┬──────────────────────────────────┐    
│  Component   │ Location │  Import   │            Importers             │
│              │          │   count   │                                  │
├──────────────┼──────────┼───────────┼──────────────────────────────────┤
│ Badge        │ Tenant   │ 2         │ PaymentSection.tsx,              │
│              │ only     │           │ PaymentHistoryTable.tsx          │    
├──────────────┼──────────┼───────────┼──────────────────────────────────┤
│ Notification │ Tenant   │ 1         │ app/(tenant)/layout.tsx          │    
│              │ only     │           │                                  │
├──────────────┼──────────┼───────────┼──────────────────────────────────┤
│              │          │ 2         │ LeaseSummaryCard.tsx,            │
│ Spinner      │ Tenant   │ external  │ PaymentSection.tsx (external);   │    
│              │ only     │ + 2       │ Button.tsx, DataTable.tsx within │
│              │          │ internal  │  _components/ui/                 │    
├──────────────┼──────────┼───────────┼──────────────────────────────────┤
│ Textarea     │ Tenant   │ 2         │ ManualRequestForm.tsx,           │
│              │ only     │           │ ReceiptUploadForm.tsx            │    
├──────────────┼──────────┼───────────┼──────────────────────────────────┤
│ Navbar       │ Root     │ 0         │ (none)                           │    
│              │ only     │           │                                  │
└──────────────┴──────────┴───────────┴──────────────────────────────────┘

Task 2 — CLAUDE.md compliance audit on landlord code

app/dashboard/LandlordDashboard.tsx

- L6–L17 — inline color constants (PRIMARY, PRIMARY_LIGHT, BG, TEXT,          
  TEXT_MUTED, BORDER, ERROR, ERROR_LIGHT, …). Violates "Use exact color tokens
  above" — colors should come from globals.css CSS variables (bg-primary,       
  text-muted-text, etc.).
- L9 — TEXT = "#1a1a1a" is not a defined token (spec token is #111111).
  Violates "Do not invent new dark mode colors".
- L13 — ERROR = "#b91c1c" is not the danger token (#931F1D). Invented color.
- L57–L65, L81–L90, L100–L111, L108–L109, L117–L123, L131–L175, L178–L203,    
  L207–L239 — extensive style={{…}} inline styling. Violates "Tailwind CSS      
  throughout (Mobile-first responsive design, dark mode)".
- L61, L109, L119, L122, L146, L157, L165, L183, L213, L228 — inline          
  fontFamily: "'DM Sans' …" / "'Playfair Display' …" strings. Violates          
  font-token usage (should be font-sans / font-heading from the @theme block).
- Whole file — zero dark: variants, zero prefers-color-scheme handling.       
  Hardcoded #fff surfaces and #fbfbff background will not switch in dark mode.  
  Violates "Dark mode via prefers-color-scheme media query — use Tailwind dark:
  variant".
- Whole file — zero responsive breakpoints (md: / lg:). Violates
  "Mobile-first. Three breakpoints only: base (mobile), md, lg".
- No any, no raw fetch, no useEffect-based fetching — compliant on those
  rules.
- L270, L296, L322, L349 — tenant names are rendered via <TenantLink> which
  uses next/link. Compliant with "Tenant names are always a <Link>".

app/dashboard/LandlordLayout.tsx

- L7–L13 — inline color constants (PRIMARY, PRIMARY_LIGHT, PRIMARY_DARK, BG,  
  TEXT, TEXT_MUTED, BORDER). Violates "Use exact color tokens above".
- L11 — TEXT = "#1a1a1a" — not a defined token (spec is #111111).
- L260 — item.danger ? "#b91c1c" — invented danger color (token is #931F1D).
- L21–L24, L32, L40–L41, L49, L57, L64–L65 — inline fill/stroke color         
  attributes on SVGs pulled from the inline color constants. Violates token rule
  (acceptable if refactored to currentColor + Tailwind class).
- L74–L101, L129–L168, L178–L276, L293–L364, L372–L398, L408–L432 — entire    
  layout is built with style={{…}} inline. Violates "Tailwind CSS throughout".
- L87, L109, L119, L122, L157, L183, L213, L220–L222, L257–L259, L386–L395 —
  inline fontFamily strings instead of font tokens.
- Whole file — zero dark: classes and zero prefers-color-scheme handling.
  Violates dark-mode rule.
- Whole file — layout responsiveness is driven by a React collapsed state, not
  CSS breakpoints; no md:/lg: Tailwind classes exist. Violates "Mobile-first" —
  on narrow screens the sidebar still occupies a fixed 60–240 px and main
  content uses a fixed 28px padding + maxWidth: 1200.
- No any, no fetch, no useEffect-based fetching.

app/dashboard/page.tsx

No issues found. Uses border-border, border-t-primary token classes; no inline
styles; no any; no fetching; no disallowed breakpoints.

app/dashboard/layout.tsx

No issues found. Passthrough layout, no styling.

Task 3 — Invite flow review

Three invite cases (portals.md §Auth / Invite Flow)

Only case 1 (new user) is handled. InviteWizard.tsx unconditionally renders   
three steps ending in AccountStep (password + confirmPassword) — there is no
branch for:

- Existing user not logged in (should surface a sign-in path instead of       
  password creation) — InviteWizard.tsx:82–85.
- Existing user already logged in (should skip AccountStep entirely) — no     
  detection of current auth session anywhere in page.tsx or _lib/.

Finding: violates portals.md "Three cases the invite flow must handle".

Lease acceptance before account creation

Compliant. InviteWizard.tsx:80–85: step 0 = ReviewStep, step 1 = AcceptStep   
(signature + ID), step 2 = AccountStep (password). Lease acknowledgement
(acknowledgedLease checkbox) sits in step 0 and blocks advancement via        
STEP_FIELDS[0] = ["acknowledgedLease"] (_lib/schema.ts:43).

Invite statuses (Pending / Accepted / Rejected / Expired)

None handled. _lib/invite.ts:1–16 (InvitePreview) has no status field.        
page.tsx:8–23 renders the wizard unconditionally for any token. No switch,
guard, or error view exists for Accepted/Rejected/Expired tokens. Violates    
portals.md "Invite statuses: Pending · Accepted · Rejected · Expired".

Tailwind classes resolving to defined tokens

All color-related classes used in page.tsx, InviteWizard.tsx, ReviewStep.tsx,
AcceptStep.tsx, AccountStep.tsx, StepIndicator.tsx, SuccessStep.tsx resolve to
tokens defined in globals.css:

bg-background, bg-surface, bg-primary, bg-primary-light,                      
hover:bg-primary-dark, text-primary-text, text-muted-text, text-primary,
text-danger, text-white, border-border, divide-border, ring-primary-light,    
ring-primary, fill-none, stroke-primary, font-heading.

No undefined tokens used. Compliant.

CLAUDE.md compliance (same checks as Task 2)

- page.tsx — compliant: tokens only, no inline styles, no any, no fetching,   
  md: only.
- InviteWizard.tsx:61–67 — try/catch around mutateAsync is fine; no           
  violations. Tokens only, form element used correctly.
- AcceptStep.tsx:59–63 — multi-line Tailwind class string, uses tokens
  (bg-primary, hover:file:bg-primary-dark, text-primary-text,                   
  focus-visible:ring-primary). Compliant.
- AcceptStep.tsx:42 — field.value as File | undefined — a type assertion, not
  any. Acceptable (RHF field value typing).
- AccountStep.tsx — compliant, all tokens.
- ReviewStep.tsx — compliant, all tokens.
- StepIndicator.tsx — compliant.
- SuccessStep.tsx — compliant.
- No dark: variants anywhere in the invite flow — but tokens auto-switch via
  the @media (prefers-color-scheme: dark) override in globals.css:23–33, so dark
  mode is honored at the token level. Not a violation.
- No sm:/xl:/2xl: usage. No useEffect-based fetching. No raw fetch.

M2 data-layer pattern compliance

Per milestones.md (Apr 15–16): Zod schemas live in lib/types/, hooks live in  
lib/hooks/, API client at lib/api/client.ts.

- useAcceptInvite.ts — lives at app/invite/[token]/_lib/useAcceptInvite.ts    
  instead of lib/hooks/. Bypasses the M2 hook location convention. (Does
  correctly consume @/lib/api/client and @/lib/api/endpoints.)
- schema.ts — lives at app/invite/[token]/_lib/schema.ts instead of
  lib/types/. Bypasses the M2 schema location convention. Also not re-exported  
  through lib/types/index.ts.
- invite.ts — defines InvitePreview as a hand-written TypeScript interface (no
  Zod schema at all) and returns hardcoded mock data via mockInvitePreview()   
  (_lib/invite.ts:20–37) instead of being fetched through a TanStack Query hook
  with Zod validation. Bypasses both the Zod-validated-response and TanStack    
  Query conventions.
- apiClient.post(... , { headers: { "Content-Type": "multipart/form-data" } })
  — InviteWizard.tsx→useAcceptInvite.ts:14–17. No raw fetch. Compliant with    
  "All data fetching via TanStack Query" for the mutation, but the read side
  (mockInvitePreview) does not use TanStack Query at all.

Task 6 — Cross-portal import violations

No issues found.

- app/dashboard/** → no imports from app/(tenant)/.
- app/(tenant)/** → no imports from app/dashboard/.
- lib/** → no imports from either portal.
- app/invite/** → no imports from either portal.

(Note for context, not a violation: app/(tenant)/error.tsx:4 imports          
@/components/ui/Button — the shared root components/ui/, not a portal.)

✻ Cooked for 3m 17s

※ recap: Auditing the MyProperty frontend for structural issues; finished Part 1
covering duplicate UI primitives, landlord CLAUDE.md compliance, invite flow
gaps, and cross-portal imports. Next: await your direction on Part 2 or fixes.
(disable recaps in /config)

────────────────────────────────────────────────────────────────────────────────
❯  
────────────────────────────────────────────────────────────────────────────────
- No sm:/xl:/2xl: usage. No useEffect-based fetching. No raw fetch.

M2 data-layer pattern compliance

Per milestones.md (Apr 15–16): Zod schemas live in lib/types/, hooks live in lib/hooks/, API client at lib/api/client.ts.

- useAcceptInvite.ts — lives at app/invite/[token]/_lib/useAcceptInvite.ts instead of lib/hooks/. Bypasses the M2 hook location
  convention. (Does correctly consume @/lib/api/client and @/lib/api/endpoints.)
- schema.ts — lives at app/invite/[token]/_lib/schema.ts instead of lib/types/. Bypasses the M2 schema location convention. Also not
  re-exported through lib/types/index.ts.
- invite.ts — defines InvitePreview as a hand-written TypeScript interface (no Zod schema at all) and returns hardcoded mock data via
  mockInvitePreview() (_lib/invite.ts:20–37) instead of being fetched through a TanStack Query hook with Zod validation. Bypasses both the
  Zod-validated-response and TanStack Query conventions.
- apiClient.post(... , { headers: { "Content-Type": "multipart/form-data" } }) — InviteWizard.tsx→useAcceptInvite.ts:14–17. No raw fetch.
  Compliant with "All data fetching via TanStack Query" for the mutation, but the read side (mockInvitePreview) does not use TanStack
  Query at all.

Task 6 — Cross-portal import violations

No issues found.

- app/dashboard/** → no imports from app/(tenant)/.
- app/(tenant)/** → no imports from app/dashboard/.
- lib/** → no imports from either portal.
- app/invite/** → no imports from either portal.

(Note for context, not a violation: app/(tenant)/error.tsx:4 imports @/components/ui/Button — the shared root components/ui/, not a
portal.)

✻ Cooked for 3m 17s

※ recap: Auditing the MyProperty frontend for structural issues; finished Part 1 covering duplicate UI primitives, landlord CLAUDE.md
compliance, invite flow gaps, and cross-portal imports. Next: await your direction on Part 2 or fixes. (disable recaps in /config)

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯  
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
? for shortcuts

text-danger, text-white, border-border, divide-border, ring-primary-light, ring-primary, fill-none, stroke-primary, font-heading.

No undefined tokens used. Compliant.

CLAUDE.md compliance (same checks as Task 2)

- page.tsx — compliant: tokens only, no inline styles, no any, no fetching, md: only.
- InviteWizard.tsx:61–67 — try/catch around mutateAsync is fine; no violations. Tokens only, form element used correctly.
- AcceptStep.tsx:59–63 — multi-line Tailwind class string, uses tokens (bg-primary, hover:file:bg-primary-dark, text-primary-text,
  focus-visible:ring-primary). Compliant.
- AcceptStep.tsx:42 — field.value as File | undefined — a type assertion, not any. Acceptable (RHF field value typing).
- AccountStep.tsx — compliant, all tokens.
- ReviewStep.tsx — compliant, all tokens.
- StepIndicator.tsx — compliant.
- SuccessStep.tsx — compliant.
- No dark: variants anywhere in the invite flow — but tokens auto-switch via the @media (prefers-color-scheme: dark) override in
  globals.css:23–33, so dark mode is honored at the token level. Not a violation.
- No sm:/xl:/2xl: usage. No useEffect-based fetching. No raw fetch.

M2 data-layer pattern compliance

Per milestones.md (Apr 15–16): Zod schemas live in lib/types/, hooks live in lib/hooks/, API client at lib/api/client.ts.

- useAcceptInvite.ts — lives at app/invite/[token]/_lib/useAcceptInvite.ts instead of lib/hooks/. Bypasses the M2 hook location
  convention. (Does correctly consume @/lib/api/client and @/lib/api/endpoints.)
- schema.ts — lives at app/invite/[token]/_lib/schema.ts instead of lib/types/. Bypasses the M2 schema location convention. Also not
  re-exported through lib/types/index.ts.
- invite.ts — defines InvitePreview as a hand-written TypeScript interface (no Zod schema at all) and returns hardcoded mock data via
  mockInvitePreview() (_lib/invite.ts:20–37) instead of being fetched through a TanStack Query hook with Zod validation. Bypasses both
  the Zod-validated-response and TanStack Query conventions.
- apiClient.post(... , { headers: { "Content-Type": "multipart/form-data" } }) — InviteWizard.tsx→useAcceptInvite.ts:14–17. No raw
  fetch. Compliant with "All data fetching via TanStack Query" for the mutation, but the read side (mockInvitePreview) does not use
  TanStack Query at all.

Task 6 — Cross-portal import violations

No issues found.

- app/dashboard/** → no imports from app/(tenant)/.
- app/(tenant)/** → no imports from app/dashboard/.
- lib/** → no imports from either portal.
- app/invite/** → no imports from either portal.

(Note for context, not a violation: app/(tenant)/error.tsx:4 imports @/components/ui/Button — the shared root components/ui/, not a
portal.)

✻ Cooked for 3m 17s

※ recap: Auditing the MyProperty frontend for structural issues; finished Part 1 covering duplicate UI primitives, landlord CLAUDE.md
compliance, invite flow gaps, and cross-portal imports. Next: await your direction on Part 2 or fixes. (disable recaps in /config)