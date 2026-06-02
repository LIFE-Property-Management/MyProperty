# Performance Audit Report (M5.4)

| | |
|---|---|
| **Deliverable** | M5.4 — Performance audit report |
| **Owner** | DevOps Lead |
| **Date** | 2026-06-02 |
| **Scope** | Full-stack: Lighthouse (frontend), HTTP caching headers, Redis impact, image optimization. CDN is **out of scope** (see [§5](#5-cdn-out-of-scope)). |
| **Method** | Synthesis of existing measurement artifacts (M2.8 Lighthouse baseline, M3.4 SQL optimization) plus one **new measured benchmark** (M3.5 Redis cache-aside, run for this audit). Report only — no production code or config was changed. |

This audit consolidates the project's performance evidence into a single full-stack view and runs the one outstanding measurement (the Redis cache-aside benchmark, whose harness existed but had never been executed). Where an area is unmeasured or unconfigured, the finding and a recommendation are recorded — fixes are **not** implemented in this deliverable.

---

## Executive summary

| # | Area | Status | Headline | Priority |
|---|---|---|---|---|
| 1 | Lighthouse (frontend) | ✅ Strong | Performance **97/100** on both audited pages; LCP (2.7 s mobile) is the one watch-item | — |
| 2 | HTTP caching headers | 🟡 Partial | Next.js framework default caches `/_next/static/` immutably; **no explicit policy** at app/proxy layer; API sends none | **P1** (make explicit + verify) |
| 3 | Redis cache impact | ✅ Effective | Landlord dashboard **11.4× faster** on a cache hit (5.18 ms → 0.45 ms median), measured | P2 (finish invalidation wiring) |
| 4 | Image optimization | 🟡 N/A today | App renders **no raster images** (5 static SVGs only); `next/image` unused, no `images` config | P3 (configure before adding raster/user images) |
| 5 | CDN | ⚪ Out of scope | ingress-nginx is the edge; external CDN is a future infra decision | — |

**Cross-cutting gaps:** no performance regression gate in CI (no Lighthouse CI, no bundle-size budget, no query-time check) and no field/RUM data (all numbers are lab/bench). See [§6](#6-recommendations-summary).

---

## 1. Lighthouse — Frontend

Source: `docs/performance/README.md` (M2.8 baseline, captured 2026-04-17) and the raw reports `docs/performance/lighthouse-home.report.json` / `lighthouse-dashboard.report.json`. Lighthouse v13.1.0, mobile emulation (moto g power, slow-4G throttle), production build (`next build` + `next start`).

### 1.1 Category scores

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| `/` (landing) | **97** | 98 | 100 | 100 |
| `/dashboard` (landlord) | **97** | 89 | 96 | 100 |

### 1.2 Core Web Vitals (lab)

| Metric | `/` | `/dashboard` | Good threshold |
|---|---:|---:|---|
| First Contentful Paint | 0.8 s | 0.8 s | < 1.8 s ✅ |
| Largest Contentful Paint | **2.7 s** | **2.7 s** | < 2.5 s ⚠️ (score 86) |
| Total Blocking Time | 40 ms | 20 ms | < 200 ms ✅ |
| Cumulative Layout Shift | 0 | 0 | < 0.1 ✅ |
| Speed Index | 0.8 s | 0.8 s | < 3.4 s ✅ |
| Time to Interactive | 2.7 s | 2.9 s | — |

The dashboard report carries a Lighthouse run-warning: *"The page loaded too slowly to finish within the time limit. Results may be incomplete."* — consistent with the dashboard being the heavier, data-driven page.

### 1.3 Bundle analysis

Raw (pre-gzip) client chunk sizes from the M2.8 baseline (`npm run analyze`):

| Chunk | Raw size |
|---|---:|
| app vendor | ~221 KB |
| React + framework vendor | ~200 KB |
| framework | ~190 KB |
| main | ~131 KB |

These are pre-gzip; over the wire (gzip/brotli) they are materially smaller. The production image uses `output: "standalone"` (`frontend/next.config.ts`), which trims the runtime `node_modules` by ~90%. One known dead-weight item is documented in `next.config.ts`: MSW (~10 MB) is traced into the standalone output but is runtime-dead in production (M4.2 follow-up).

### 1.4 Findings & recommendations

- **LCP is the single metric outside the "good" band** (2.7 s vs < 2.5 s target; Lighthouse metric score 86 while overall Performance is 97). It is identical on both pages, which points at a shared above-the-fold element (web-font swap for Playfair Display / DM Sans, or the hero/first paint block) rather than page-specific data. **Recommendation:** identify the LCP element from the report's "Largest Contentful Paint element" audit and, if it's a web font, preload it / confirm `font-display: swap`. Low effort, directly moves the one lagging metric.
- **Everything else is already strong** — FCP/SI 0.8 s, CLS 0, TBT ≤ 40 ms. No action.
- **No trend or field data.** This is a single lab snapshot. `components/WebVitalsReporter.tsx` already emits Web Vitals to `NEXT_PUBLIC_WEB_VITALS_ENDPOINT`; wiring that endpoint to a sink would convert it into real-user monitoring (RUM). Backlog.

---

## 2. HTTP Caching Headers

### 2.1 Current state

Audited `infrastructure/nginx/nginx.conf` + `templates/myproperty.conf.template`, `frontend/next.config.ts`, and `backend/MyProperty.Api/Program.cs`.

| Layer | Cache-related config | Finding |
|---|---|---|
| **Next.js framework default** | (implicit) | `next start` serves `/_next/static/*` with `Cache-Control: public, max-age=31536000, immutable` automatically — content-hashed filenames make this safe. This covers the highest-value case **for free**. SSR pages default to `no-store`/`no-cache` (correct — they are user-specific). |
| **Next.js explicit config** | none | No `headers()` block and no `images`/cache config in `next.config.ts` — only `output: "standalone"` + bundle analyzer. |
| **nginx** | gzip + HTTP/2 only | `gzip_vary on`, HTTP/2, OCSP stapling, TLS tuning — but **no** `add_header Cache-Control`, `expires`, `proxy_cache`, or ETag handling. Note: this standalone nginx layer is **superseded** on the cluster by ingress-nginx + cert-manager (`docs/operations/nginx-ssl.md`). |
| **Backend API** | app-level only | `IDistributedCache` cache-aside on the dashboard (see §3). **No HTTP-level caching** — no `[ResponseCache]`, no `AddOutputCache()`, no `Cache-Control`/`ETag` on API responses. |

**Net:** the most important static-asset caching is handled by Next.js framework defaults. What is *missing* is (a) an **explicit, documented** caching policy, (b) confirmation that the framework headers survive the ingress hop to the browser, and (c) any cache directives on API responses.

### 2.2 Recommendations

| Target | Recommended directive | Rationale |
|---|---|---|
| `/_next/static/*` (hashed assets) | `Cache-Control: public, max-age=31536000, immutable` | Already the Next.js default — make it explicit/verified at the edge so an ingress rewrite can't silently weaken it. |
| SSR pages (`/dashboard`, `/tenant/*`) | `Cache-Control: no-store` (or `private, no-cache`) | User-specific, auth-gated — must not be shared-cached. |
| API responses (`/api/v1/*`) | `Cache-Control: no-store` | All current endpoints are private and user-scoped; an explicit `no-store` documents intent and prevents accidental intermediary caching. |
| `public/*.svg` static files | `Cache-Control: public, max-age=86400` | Low churn; safe to cache for a day. |

**Verification not performed (report-only):** confirming the live response headers requires `curl -I` against a running frontend+ingress, which was out of scope here. Recommended as the first step when this is actioned.

---

## 3. Redis Cache Impact

### 3.1 Endpoint

`GET /api/v1/landlord/dashboard` — the landlord portal home page. It aggregates five index-backed counts (properties, active leases, distinct active tenants, pending payments, outstanding-overdue payments) into one DTO. High read frequency, read-mostly, cheaply invalidated per-landlord. Cache key `landlord:{landlordId}:dashboard`, TTL 60 s. Design rationale: `docs/performance/m3-redis-caching/README.md`.

### 3.2 Methodology

The standalone harness (`docs/performance/m3-redis-caching/bench/`) builds a slim DI graph (`AppDbContext`, `IDistributedCache`, repository, cache, handler) and times the handler directly — no HTTP/JWT layer — so it isolates exactly what cache-aside changes: handler latency.

- **3 + 3 warm-up** iterations (stabilize JIT, EF query-plan cache, PG buffers, Redis pool), then **20 + 20 measured**.
- **Miss** = cache invalidated before each call ⇒ 5 sequential DB round-trips + JSON serialize + Redis `SET`.
- **Hit** = cache left populated ⇒ single Redis `GET` + deserialize.
- **Median** is the headline (resistant to one-off GC/JIT pauses); p95 is the tail signal.

**Environment (this run, 2026-06-02):** PostgreSQL 16-alpine + Redis 7-alpine (compose services). Dataset = the M3.4 volumes (2,100 users / 1,000 properties / 4,000 leases / 200,000 payments); landlord `kc-landlord-1` owns 10 properties / 30 active leases. Release build.

> **Note on how it was run.** The harness was executed inside a `mcr.microsoft.com/dotnet/sdk:10.0` container joined to the compose network, reaching Postgres and Redis by service name — because a Windows **Application Control** policy on the host blocked the locally-built `.dll` from loading (`0x800711C7`). Consequence: both the miss and hit paths include a container→container network hop to Redis/Postgres, rather than the README's assumed host-collocated Redis (~0.1 ms RTT). This *raises both* absolute numbers slightly but does not distort the relative comparison (both paths pay the same Redis/PG network cost; the miss additionally pays 5 sequential PG round-trips + EF overhead).

### 3.3 Results (measured)

| Phase | min | **median** | p95 | max | mean |
|---|---:|---:|---:|---:|---:|
| **Miss** (DB ×5 → serialize → Redis `SET`) | 4.387 ms | **5.181 ms** | 12.259 ms | 12.259 ms | 5.570 ms |
| **Hit** (Redis `GET` → deserialize) | 0.370 ms | **0.454 ms** | 0.631 ms | 0.631 ms | 0.464 ms |
| **Speedup** (median miss ÷ median hit) | | **11.4×** | | | |

These are the real numbers for the `_TBD_` placeholders in `docs/performance/m3-redis-caching/README.md` — that file was left unchanged here (report-only scope) and can be backfilled from this table.

### 3.4 Analysis

- **11.4× median speedup** lands inside the 10–30× range predicted from the M3.4 query analysis, and validates the cache-aside choice for this endpoint. The win is structural — it collapses five sequential round-trips into one Redis read — not the elimination of one slow query.
- The **miss path (5.18 ms)** is consistent with the M3.4 SQL-optimization results (`docs/performance/m3-sql-optimization/`): each of the five counts is index-backed and sub-millisecond warm (Q1, the dashboard's upcoming-payments shape, measured 0.739 ms warm at 22× speedup), so the aggregate cost is EF/round-trip overhead, exactly what caching removes.
- **Tail (p95 12.3 ms miss vs 0.63 ms hit)** shows the cache also tightens latency variance, not just the median — relevant under load.
- **Outstanding work (correctness, not speed):** only `AcceptInviteHandler` currently invalidates the dashboard cache. `SubmitPaymentHandler`, `ConfirmPaymentHandler`, and `RejectPaymentHandler` are marked **⏳ to-wire** in the M3.5 doc. Until then, a landlord's payment actions are reflected only after the 60 s TTL lapses. The `ILandlordDashboardCache.InvalidateAsync` hook already exists; each handler needs one call. **Recommendation (P2):** finish this wiring.

---

## 4. Image Optimization

### 4.1 Current state

- **No `next/image` usage** in application code (grep across `frontend/` for `next/image` / `<Image` returns only the generated `next-env.d.ts` and `proxy.ts`).
- **No `images` block** in `frontend/next.config.ts` (no domains, formats, sizes, loader, or CDN/loader config).
- **`frontend/public/` contains 5 SVGs** — `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (Next.js starter assets). No raster images (PNG/JPG/WebP) ship with the app.

### 4.2 Findings

There is **nothing to optimize today**: the UI is icon/SVG-based and renders no raster images. Receipt uploads are stored and downloaded as files (`Content-Disposition: inline`), not rendered through `<img>`/`next/image` in a page, so they don't flow through the image pipeline. The absence of `next/image` config is therefore **not currently a gap**.

### 4.3 Recommendation

Configure `next/image` **before** the first feature that displays raster or user-uploaded images (e.g. property photos, rendered receipt thumbnails). At that point set an `images` policy — allowed `remotePatterns`/domains, `formats: ['image/avif','image/webp']`, and device sizes — and use `<Image>` for automatic resizing/lazy-loading. Tracked as P3 (do-when-needed); the 5 starter SVGs in `public/` can also be pruned.

---

## 5. CDN (out of scope)

The current architecture has no external CDN: the Kubernetes **ingress-nginx** controller is the edge, serving the Next.js standalone server and the API directly. An external CDN (e.g. Cloudflare or DigitalOcean Spaces CDN fronting static assets) is a future infrastructure decision and is **explicitly out of scope** for this audit per the agreed M5.4 framing. Noted here only for completeness; no analysis performed.

---

## 6. Recommendations summary

| Priority | Area | Action | Effort |
|---|---|---|---|
| **P1** | Caching | Make the static-asset `Cache-Control` policy explicit and verify it survives the ingress hop (`curl -I` against a running instance); set `no-store` on API + SSR pages | S |
| **P2** | Redis | Wire `InvalidateAsync` into `SubmitPaymentHandler` / `ConfirmPaymentHandler` / `RejectPaymentHandler` (freshness on landlord writes) | S |
| **P2** | Lighthouse | Identify the LCP element on `/` and `/dashboard`; preload the web font / confirm `font-display: swap` to pull LCP under 2.5 s | S |
| **P3** | Images | Configure `next/image` (`images` policy + `<Image>`) before shipping any raster/user images; prune starter SVGs | S |
| **P3** | Fixtures | Refresh the stale benchmark fixtures (see appendix) so the proof is re-runnable without scratch patches | S |
| Backlog | Observability | Add a CI performance gate (Lighthouse CI + bundle-size budget) and a RUM sink for `WebVitalsReporter` | M |

---

## Appendix

### A. Reproducing the Redis benchmark

```bash
docker compose up -d postgres redis
# create + migrate a bench DB
docker exec myproperty-postgres psql -U postgres -c "CREATE DATABASE myproperty_bench;"
dotnet ef migrations script --idempotent \
  --project backend/MyProperty.Infrastructure --startup-project backend/MyProperty.Api \
  --output schema.sql
docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench < schema.sql
docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench < docs/performance/m3-sql-optimization/seed.sql
cd docs/performance/m3-redis-caching/bench && dotnet run -c Release -- kc-landlord-1
```

### B. Benchmark fixtures are stale (P3 follow-up)

Running the M3.5 benchmark for this audit surfaced bit-rot in the M3.4/M3.5 fixtures relative to the current schema and handler. They were worked around with throwaway scratch files for this run; the committed fixtures were left unchanged and should be refreshed:

- **`docs/performance/m3-sql-optimization/seed.sql`** — (1) the `leases` INSERT omits `LandlordId` (added after the seed was written; now `NOT NULL` ⇒ FK violation on the all-zeros default); (2) the `invites` INSERT uses the old `Token` column (renamed to `TokenHash`); (3) `leases.Status = 'Ended'` is not a valid `LeaseStatus` (`Active`/`Expired`/`Terminated`).
- **`docs/performance/m3-redis-caching/bench/Program.cs`** — the DI graph does not register `IValidator<GetLandlordDashboardQuery>`, which `GetLandlordDashboardHandler` gained at M3.12; the handler can't be constructed without it.

### C. Cross-references

- M2.8 Lighthouse baseline: `docs/performance/README.md`
- M3.4 SQL optimization (indexes, EXPLAIN ANALYZE): `docs/performance/m3-sql-optimization/`
- M3.5 Redis cache-aside design: `docs/performance/m3-redis-caching/README.md`
- Caching/proxy layer: `docs/operations/nginx-ssl.md`
