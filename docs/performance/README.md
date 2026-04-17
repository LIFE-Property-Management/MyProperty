# Performance Baseline — M2.8

Baseline captured against Next.js 16.2.3 production build on 2026-04-17.
All reports in this folder are checked in as artefacts and reproducible via the commands below.

## Lighthouse (mobile emulation, headless Chrome)

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` (landing) | 97 | 98 | 100 | 100 |
| `/dashboard` | 97 | 89 | 96 | 100 |

### Core Web Vitals (lab)

| Metric | `/` | `/dashboard` |
|---|---|---|
| First Contentful Paint | 0.8 s | 0.8 s |
| Largest Contentful Paint | 2.7 s | 2.7 s |
| Cumulative Layout Shift | 0 | 0 |
| Total Blocking Time | 40 ms | 20 ms |
| Speed Index | 0.8 s | 0.8 s |

Full reports: `lighthouse-home.report.html`, `lighthouse-dashboard.report.html` (+ JSON siblings).

### Notes on the dashboard a11y drop (89)
The dashboard renders tables and stat cards whose inline colour tokens do not all meet WCAG AA contrast. This is tracked against M2.7 (accessibility audit) — the baseline is captured here so the improvement is measurable after M2.7 lands.

## Bundle analysis

Client, Node, and Edge reports are checked in as `bundle-{client,nodejs,edge}.html` (webpack-bundle-analyzer output).

### Client chunk sizes (raw, pre-gzip)

| Chunk | Size |
|---|---|
| `static/chunks/794-*.js` (app vendor) | 221 KB |
| `static/chunks/4bd1b696-*.js` (React + framework vendor) | 200 KB |
| `static/chunks/framework-*.js` | 190 KB |
| `static/chunks/main-*.js` | 131 KB |
| `static/chunks/polyfills-*.js` | 113 KB |
| `static/chunks/583-*.js` (dashboard route) | 33 KB |
| `static/chunks/221-*.js` (dynamic: LandlordDashboard) | 10 KB |

The dashboard's `LandlordDashboard` is dynamically imported (`next/dynamic` in `app/dashboard/page.tsx`), so it ships as a separate on-demand chunk instead of going into the route's initial payload.

## Web Vitals runtime reporting

`components/WebVitalsReporter.tsx` registers `useReportWebVitals` at the root layout:

- **Development:** logs every metric to the browser console (`[web-vitals] LCP 1230 …`).
- **Production:** POSTs to `process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT` via `navigator.sendBeacon` (falls back to `fetch` with `keepalive`). No-op if the env var is unset, so forgetting to configure it is safe.

## How to reproduce

From `frontend/`:

```bash
# Bundle analyzer (writes HTML to .next/analyze/*)
npm run analyze

# Production build + server (for Lighthouse)
npm run build
npx next start -p 3100
```

From repo root, in a second terminal:

```bash
npx lighthouse@13 http://localhost:3100/ \
  --output=html --output=json \
  --output-path=./docs/performance/lighthouse-home \
  --chrome-flags="--headless=new --no-sandbox"

npx lighthouse@13 http://localhost:3100/dashboard \
  --output=html --output=json \
  --output-path=./docs/performance/lighthouse-dashboard \
  --chrome-flags="--headless=new --no-sandbox"
```

Copy the latest `.next/analyze/*.html` files into this folder, renaming with a `bundle-` prefix.

## Known caveats

- `@next/bundle-analyzer` is not compatible with Turbopack (Next 16 default), so `npm run analyze` uses `next build --webpack` explicitly. This makes the analyze build slower than the regular Turbopack build, but is the only path that produces the HTML reports today.
- Lighthouse on Windows may emit a harmless `EPERM` at the very end while cleaning up its Chrome temp profile. The HTML/JSON reports are written before the cleanup step, so the error does not corrupt output.
