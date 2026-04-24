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

● Task 4 — M3 readiness gaps

1. Landlord auth — Status: missing (tenant-only scaffolding present)                         
   - lib/auth/keycloak.ts: interface DecodedPayload (lines 15-19) only has sub, email, tenantAccountStatus — no role discriminator.
   - isDecodedPayload (lines 21-30) validates tenantAccountStatus ∈ {Active, ReadOnly} only — will reject any landlord/admin JWT.
   - FAKE_JWT (line 11) hardcodes tenantAccountStatus: "Active" — single-role fixture.                                                 
   - initKeycloak (lines 50-63) unconditionally calls useTenantStore.getState().setAuth(...) — coupled to tenant store; landlord login
   would still write to tenant slice.                                                                                                    
   - Needed for M3: add a role (or Keycloak realm-role) claim to the decoded payload; split DecodedPayload into a discriminated union  
   (TenantPayload | LandlordPayload | AdminPayload); route setAuth to the correct store (tenant vs landlord); generalize or rename       
   initKeycloak/isDecodedPayload (currently fail-closed for non-tenant); provide per-role fake JWTs for dev.
2. Landlord store — Status: missing                                                                                                   
   - lib/store/landlord/ directory does not exist. Only lib/store/tenant/ (authSlice, uiSlice, notificationSlice) and                  
   useTenantStore.ts.                                                                                                                    
   - Needed for M3:
  - landlord/authSlice.ts — userId, email, landlordId, accountStatus (likely Active/Suspended, not the tenant's Active/ReadOnly);
    no isReadOnly derivation.
  - landlord/uiSlice.ts — sidebar collapsed state (currently local state in LandlordLayout.tsx:403), pagination state for
    upcoming-payments table (currently local in LandlordDashboard.tsx:244), tenants-page filters, invite creation modal state,            
    confirm/reject payment modal state.
  - landlord/notificationSlice.ts — can mirror tenant's implementation verbatim.
  - useLandlordStore.ts — combined store with devtools middleware, no persist.
  - Differences vs tenant: no isReadOnly, more modal types, persistent table pagination/filters.
3. Landlord endpoints — Status: missing                                                                                               
   - lib/api/endpoints.ts has only /tenant/* and /invites/:token[/accept].                                                             
   - Needed for M3 (grouped per portals.md):
  - Dashboard stats: GET /landlord/dashboard/stats (totalProperties, totalActiveTenants).
  - Dashboard tables: GET /landlord/payments/overdue, GET /landlord/leases/expiring?withinDays=30, GET                              
    /landlord/payments/recent?limit=5, GET /landlord/payments/upcoming?page&pageSize (paginated).
  - Tenants page: GET /landlord/tenants (list), GET /landlord/invites?status=Pending,Rejected,Expired (for the Invitation Log).
  - Tenant Detail: GET /landlord/tenants/:id (summary + lastPaymentDate), GET /landlord/tenants/:id/payments?status&page&pageSize   
    (filterable history).
  - Invite management: POST /landlord/invites (create), POST /landlord/invites/:id/resend, POST /landlord/invites/:id/cancel.
  - Payment confirmation: POST /landlord/payments/:id/confirm, POST /landlord/payments/:id/reject (with reason body).
4. Landlord types — Status: missing                                                                                                   
   - lib/types/ covers tenant-side only (enums, lease, payment, tenant).                                                               
   - Needed for M3 (new Zod schemas + inferred types):
  - property.ts — Property (id, name, address, unitCount, landlordId).
  - invite.ts — Invite (id, tenantEmail, propertyId, status, expiresAt, createdAt), InviteStatus enum                               
    (Pending|Accepted|Rejected|Expired).
  - landlordDashboard.ts — OverduePayment, ExpiringLease, RecentPayment, UpcomingPayment, DashboardStats.
  - landlordTenant.ts — LandlordTenant (list row), LandlordTenantDetail (summary + lastPaymentDate).
  - landlordAccount.ts — LandlordAccount + LandlordAccountStatus enum.
  - paymentAction.ts — PaymentConfirmInput, PaymentRejectInput (with rejectionReason).
  - Update index.ts barrel; potentially split into lib/types/landlord/ vs lib/types/tenant/ to match the Landlord/Tenant separation
    rule in CLAUDE.md.
5. Landlord MSW handlers/fixtures — Status: missing                                                                                   
   - mocks/fixtures/ has only tenantAccount, lease, currentPayment, paymentHistory. handlers.ts has only 6 tenant handlers.            
   - Needed for M3 (fixtures): landlordAccount, properties, overduePayments, expiringLeases, recentPayments, upcomingPayments (≥15     
   entries to exercise pagination), landlordTenants, invites (mix of Pending/Rejected/Expired/Accepted to verify filter),                
   landlordTenantDetail.                                                                                                                 
   - Needed for M3 (handlers): GET handler per endpoint listed in Task 4 item 3, plus mutation handlers for POST /landlord/invites,    
   /invites/:id/resend, /invites/:id/cancel, /payments/:id/confirm, /payments/:id/reject that update the tenant-side currentPaymentState
   in handlers.ts:13 so landlord actions visibly transition the tenant UI.
6. Payment confirmation flow — Status: missing                                                                                        
   - No endpoint (no confirmPayment/rejectPayment in endpoints.ts), no hook (lib/hooks/ has no useConfirmPayment/useRejectPayment), no
   mutation handler in mocks/handlers.ts.                                                                                                
   - Current MSW can only transition Outstanding → Pending (handlers.ts:45-67) — there is no path to Confirmed or Rejected.
   - Needed for M3: POST /landlord/payments/:id/confirm and .../reject endpoints; useConfirmPayment and useRejectPayment mutations that
   invalidate queryKeys.tenant.payment.all() (cross-portal cache key); matching MSW handlers that mutate shared currentPaymentState so  
   the tenant's polling useCurrentPayment observes the transition.
7. File upload backend contract — Status: partial (naïve mock)                                                                        
   - Current handler (mocks/handlers.ts:45-55): await request.formData() (result discarded), sets status: "Pending", method:           
   "ReceiptUpload", submittedAt: now. Does not persist the file. Does not set receiptFileName or receiptFileUrl on the fixture even      
   though paymentSchema (lib/types/payment.ts:23-24) has those fields.                                                                   
   - Client (lib/hooks/useSubmitReceipt.ts:17-19) manually sets "Content-Type": "multipart/form-data" on axios — this strips the       
   auto-generated multipart boundary; real servers will 400 on this. Latent bug.                                                         
   - Assumptions that will change:
  - Transport: multipart-to-API vs presigned-URL-to-blob-storage (Azure Blob/S3) with a separate "confirm upload" POST. If the    
    backend goes presigned, useSubmitReceipt becomes two calls (request URL, upload, notify) and the signature changes.
  - Response shape: mock returns updated Payment; hook is typed <void, Error, FormData> (line 15), so a non-void response is
    silently dropped. Real backend may return an ID, a job reference, or just 204.
  - File size: client caps at 5 MB (lib/types/payment.ts:37); backend limit will need to match or be enforced server-side with a
    surfaced 413 error path (not currently handled).
  - MIME whitelist: client accepts jpeg/png/pdf (line 39); backend MIME sniffing may differ — server rejections need user-facing
    messaging.
  - Auth: MSW doesn't check Authorization; production path depends on lib/api/client.ts attaching the Bearer (not verified in this
    read).
8. Payment state coverage in MSW — Status: partial (1 of 4 states reachable initially; 1 more via mutation)
   - mocks/fixtures/currentPayment.ts hardcodes status: "Outstanding" only.                                                            
   - In-memory currentPaymentState in handlers.ts:13 can reach Pending via either POST handler. Confirmed and Rejected are unreachable
   (no handler transitions into them — see item 6).                                                                                      
   - No dev switch exists for starting state: no query-param branch in handlers, no env var in MockProvider, no toggle UI. A developer
   can only see Confirmed/Rejected by editing currentPayment.ts and reloading.                                                           
   - Needed for M3: a state-selector mechanism (e.g., NEXT_PUBLIC_MOCK_PAYMENT_STATE read in MockProvider.tsx, or a ?mockState= query
   param parsed in handlers.ts) plus four labeled fixture variants (currentPaymentOutstanding, currentPaymentPending,                    
   currentPaymentConfirmed, currentPaymentRejected).

Task 5 — Type safety leaks

jest.polyfills.ts

- L8 — (globalThis as any).TextEncoder = TextEncoder;                                                                                 
  L7:   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
  L8:   (globalThis as any).TextEncoder = TextEncoder;                                                                                  
  L9: }
- L12 — (globalThis as any).TextDecoder = TextDecoder;                                                                                
  L11:   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
  L12:   (globalThis as any).TextDecoder = TextDecoder;                                                                                 
  L13: }

jest.setup.ts

- L26 — (globalThis as any).IntersectionObserver = NoopObserver;                                                                      
  L25: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
  L26: (globalThis as any).IntersectionObserver = NoopObserver;                                                                         
  L27: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
- L28 — (globalThis as any).ResizeObserver = NoopObserver;                                                                            
  L27: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge                                       
  L28: (globalThis as any).ResizeObserver = NoopObserver;                                                                               
  L29:

app/(tenant)/_components/__tests__/LeaseSummaryCard.test.tsx

- L38 — } as unknown as ReturnType<typeof useLease>);                                                                                 
  L37:     isError: value.isError ?? false,
  L38:   } as unknown as ReturnType<typeof useLease>);                                                                                  
  L39: }

app/(tenant)/_components/__tests__/PaymentHistoryTable.test.tsx

- L56 — } as unknown as ReturnType<typeof usePaymentHistory>);                                                                        
  L55:     isFetching: value.isFetching ?? false,
  L56:   } as unknown as ReturnType<typeof usePaymentHistory>);                                                                         
  L57: }

app/(tenant)/_components/__tests__/PaymentSection.test.tsx

- L47 — } as unknown as ReturnType<typeof useCurrentPayment>);                                                                        
  L46:     // The component only reads these three fields; cast keeps the signature happy.
  L47:   } as unknown as ReturnType<typeof useCurrentPayment>);                                                                         
  L48: }

__tests__/middleware.test.ts

- L36 — (nextUrl as unknown as { clone: () => URL }).clone = () => new URL(nextUrl.toString());                                       
  L35:   // NextRequest has a clone() that returns a URL-like object; jsdom's URL works.
  L36:   (nextUrl as unknown as { clone: () => URL }).clone = () => new URL(nextUrl.toString());                                        
  L37:   return {
- L42 — } as unknown as import("next/server").NextRequest;                                                                            
  L41:     },                                                                                                                           
  L42:   } as unknown as import("next/server").NextRequest;
  L43: }

No // @ts-ignore or // @ts-expect-error occurrences found. All other any/as unknown hits were in comments                             
(lib/store/tenant/uiSlice.ts:2, app/(tenant)/_components/PaymentSubmissionModal.tsx:3) and excluded per task spec.

Task 7 — Stale fixtures, dead code, untested paths

1. Fixtures not referenced by handlers

None found. handlers.ts imports tenantAccountFixture, leaseFixture, currentPaymentFixture, buildPaymentHistoryResponse — all four     
fixture files are reachable.

2. Components in app/(tenant)/_components/ (excluding ui/) not imported

None found. All 10 (KeycloakInit, LeaseSummaryCard, LeaseSummarySection, ManualRequestForm, PageTransition, PaymentHistoryTable,      
PaymentSection, PaymentSubmissionModal, ReadOnlyBanner, ReceiptUploadForm) are imported in production code.

3. Components in app/(tenant)/_components/ui/ not imported

- app/(tenant)/_components/ui/Input.tsx — only referenced by its own test (ui/__tests__/Input.test.tsx). No production consumers; the
  two Input imports in the codebase (AcceptStep.tsx:4, AccountStep.tsx:4) both pull from @/components/ui/Input, not the tenant copy.

4. Components in components/ui/ not imported

- components/ui/DataTable.tsx — only its own test imports it (components/ui/__tests__/DataTable.test.tsx). Production tenant code     
  imports app/(tenant)/_components/ui/DataTable.
- components/ui/Modal.tsx — only its own test. Production code imports app/(tenant)/_components/ui/Modal.
- components/ui/Navbar.tsx — only its own test. No production consumers anywhere.

5. Hooks in lib/hooks/ not imported anywhere outside own __tests__/

- useTenantAccount — only the barrel re-export in lib/hooks/index.ts:1 references it. No component, no layout, no provider imports it.
  Effectively dead code.

6. Test files whose corresponding source no longer exists

- lib/hooks/__tests__/useQueries.test.tsx — no lib/hooks/useQueries.(ts|tsx) source; it is a collective integration test spanning all
  6 query hooks. Not a missing-source leak, but the file naming implies a source that doesn't exist.
- __tests__/smoke.test.ts — no corresponding source (it's a generic smoke test against barrel exports). Same caveat as above.

No orphaned-source test files found otherwise — every per-component/per-hook/per-schema test maps to an existing source file.

7. Type schemas in lib/types/ not imported outside own __tests__/

Zod schemas with no production consumers:
- paymentMethodSchema
- leaseStatusSchema
- tenantAccountStatusSchema
- leaseSummarySchema
- paymentSchema
- paymentHistoryEntrySchema
- paymentHistoryResponseSchema
- tenantAccountSchema

(paymentStatusSchema is used in __tests__/smoke.test.ts:14; receiptUploadFormSchema and manualRequestFormSchema are used in the       
forms.)

Inferred types with no production consumers outside lib/types/:
- PaymentMethod — declared but never imported by any component, hook, store, or fixture.

All other inferred types (PaymentStatus, LeaseStatus, TenantAccountStatus, LeaseSummary, Payment, ReceiptUploadFormValues,
ManualRequestFormValues, PaymentHistoryEntry, PaymentHistoryResponse, TenantAccount) are consumed by components/hooks/fixtures.

Task 8 — Progress log accuracy

April 15, 2026

- [✓] Next.js upgrade to 16.2.3 — package.json has "next": "^16.2.3".
- [✓] Migrated to next/font — app/layout.tsx imports DM_Sans, Playfair_Display from next/font/google.
- [✓] All listed deps installed — verified in package.json (zod, zustand, @tanstack/react-query, devtools, react-hook-form,           
  @hookform/resolvers, framer-motion).
- [✓] globals.css tokens/fonts/dark mode — tokens, Playfair/DM Sans vars, and prefers-color-scheme block all present.
- [✓] Zod schemas in lib/types/ — enums.ts, lease.ts, payment.ts, tenant.ts, index.ts all exist with the declared exports.

April 16, 2026

- [✓] Zustand slices — tenant/authSlice.ts (userId, email, tenantAccountStatus, isReadOnly derived, setAuth, clearAuth), uiSlice.ts,  
  notificationSlice.ts all present and match the described shape.
- [✓] useTenantStore.ts — combined store with devtools middleware, no persist.
- [✓] lib/auth/keycloak.ts — mock adapter with getToken() and initKeycloak().
- [✓] lib/api/client.ts and endpoints.ts present.
- [✓] lib/hooks/queryKeys.ts — centralized factory (domain → resource → scoping).
- [✓] useTenantAccount, useLease, useCurrentPayment (30 s refetchInterval), usePaymentHistory (paginated with keepPreviousData),      
  useSubmitReceipt (multipart), useSubmitManualRequest (JSON) — all six hooks exist as described.
- [✓] lib/hooks/index.ts barrel exports all six plus queryKeys.
- [✓] app/(tenant)/_components/KeycloakInit.tsx present.
- [✓] app/(tenant)/layout.tsx present.

April 17, 2026

- [✓] LeaseSummaryCard.tsx, LeaseSummarySection.tsx — present; wrapper fetches via useLease.
- [✓] PaymentSection.tsx — present; handles four PaymentStatus branches via toneFor().
- [✓] PaymentSubmissionModal.tsx — present; wired to uiSlice.activeModal.
- [✓] ReceiptUploadForm.tsx — React Hook Form + Zod via receiptUploadFormSchema.
- [✓] ManualRequestForm.tsx — cash form via manualRequestFormSchema.
- [✓] PaymentHistoryTable.tsx — filterable, paginated; uses usePaymentHistory.
- [✓] ReadOnlyBanner.tsx present.
- [✓] PageTransition.tsx present.
- [partial] ui/ — Badge, Button, Card, DataTable, Input, Modal, Notification, Spinner, Textarea all exist, but Input.tsx has no       
  production consumers (see Task 7 item 3); the log implies all nine were put into use on the Tenant Portal.
- [✓] app/(tenant)/tenant/dashboard/page.tsx, loading.tsx, error.tsx — all present.
- [✓] Dark mode fix — @media (prefers-color-scheme: dark) { :root { ... } } block present in globals.css.
- [✓] Card.tsx uses CSS variables — bg-[var(--color-surface)], border-[var(--color-border)] in app/(tenant)/_components/ui/Card.tsx.
- [✓] MSW v2 — mocks/fixtures/, mocks/handlers.ts, mocks/browser.ts, mocks/MockProvider.tsx all present; (tenant)/layout.tsx wraps    
  children with <MockProvider>.
- [partial] "typed fixture data for all 4 endpoints" — fixtures exist for all 4, but only the Outstanding payment state is covered;   
  Pending/Confirmed/Rejected are not representable without editing source (see Task 4 item 8).
- [✓] 11-entry payment history — mocks/fixtures/paymentHistory.ts has exactly 11 entries.
- [✓] @next/bundle-analyzer + cross-env in devDeps; next.config.ts wires withBundleAnalyzer behind process.env.ANALYZE === "true".
- [✓] npm run analyze script uses next build --webpack.
- [✓] components/WebVitalsReporter.tsx present; mounted in app/layout.tsx.
- [✓] app/dashboard/page.tsx uses next/dynamic for LandlordDashboard with loading skeleton.
- [✓] docs/performance/ contains lighthouse-home, lighthouse-dashboard (html+json), bundle-client/nodejs/edge html, and README.md.

Undocumented work

- app/dashboard/LandlordDashboard.tsx — 365-line landlord dashboard with inline mock data (overdue, expiring, recent, upcoming),      
  custom Badge/StatCard/Table/Tr/Td/Pagination primitives, and inline hex colors. April 17 entry only mentions the dynamic-import
  wrapper in page.tsx; the actual dashboard implementation is not logged.
- app/dashboard/LandlordLayout.tsx — 435-line sidebar + topbar + user-menu chrome with inline styled SVG icons. Not mentioned in any
  progress entry. Uses hardcoded "John Doe" / "Landlord" — landlord auth is not wired up (see Task 4 item 1). Violates CLAUDE.md: hex   
  colors (#b91c1c, #92400e — red/orange — in both files), no Tailwind, no CSS tokens.
- app/dashboard/error.tsx, loading.tsx, layout.tsx — exist, not logged.
- app/invite/[token]/ — full invite-acceptance wizard (InviteWizard, AcceptStep, AccountStep, ReviewStep, StepIndicator, SuccessStep,
  _lib/invite.ts, _lib/schema.ts, _lib/useAcceptInvite.ts). Merged as M2.4 per commit ec1aa0d but absent from the April 15/16/17        
  progress log entries.
- components/ui/ — second Button, Card, DataTable, Input, Modal, Navbar primitive library parallel to app/(tenant)/_components/ui/.   
  DataTable, Modal, Navbar have zero production consumers (see Task 7 item 4). Not mentioned in the log.
- middleware.ts and __tests__/middleware.test.ts — not mentioned in any entry.
- app/components/LandingPage.tsx, app/page.tsx, app/not-found.tsx, app/loading.tsx, app/error.tsx — landing page and root-level       
  boilerplate not logged.
- Invite endpoints — ENDPOINTS.inviteByToken / ENDPOINTS.acceptInvite in lib/api/endpoints.ts shipped, not mentioned in the April 16  
  endpoints enumeration.

Audit complete. Flagged deviations between docs and code but treated the code as ground truth per your instructions. 