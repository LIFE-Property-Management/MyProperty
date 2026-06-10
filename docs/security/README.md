# Security Audit — M5.5

Full report: **[`audit-m5.5.md`](./audit-m5.5.md)**. Four pillars, all scanned for real on
2026-06-05 against the repo (working tree + full git history) and the locally-running compose
stack. Every report in this folder is checked in as an artefact and reproducible via the
commands in [Appendix A](./audit-m5.5.md#a-reproduction).

> **Security model:** [`threat-model.md`](./threat-model.md) — trust boundaries, authN/authZ, data
> classification, a STRIDE summary, and the residual-risk register. This folder is the *evidence*
> (scan outputs); the threat model is the *posture* that explains them.

## Headline

| Pillar | Tool | Result |
|---|---|---|
| git-secrets scan | AWS Labs git-secrets | ✅ **0 findings** (tree + 243-commit history) |
| Secrets exposure | gitleaks 8.30.1 + trufflehog 3.95.5 | ✅ **0 verified secrets**, 0 real secrets committed (all matches triaged false positives) |
| DAST | OWASP ZAP baseline (passive) | 🟡 **0 High**; 2 Medium + 6 Low — missing security response headers + `X-Powered-By` disclosure (**P1**) |
| Lighthouse | Lighthouse 13.3.0 | ✅ **Best Practices 100/100**; HTTPS/console/deprecations/inspector all pass |

The one substantive finding is the missing **security-response-header policy** (CSP, anti-clickjacking,
`X-Content-Type-Options`, `Permissions-Policy`, …) — see [§3](./audit-m5.5.md#3-owasp-zap--dast-baseline).

## What shipped (live gates)

- [`.github/workflows/security-ci.yml`](../../.github/workflows/security-ci.yml) — `secret-scan`
  (gitleaks + git-secrets, blocking, SARIF → Security tab), `lighthouse-ci`, `zap-baseline` (scheduled).
- [`.gitleaks.toml`](../../.gitleaks.toml) — triaged secret-scan allowlist + triage policy.
- [`frontend/lighthouserc.json`](../../frontend/lighthouserc.json) — Lighthouse CI assertions.

## Artifacts

| File | Scan |
|---|---|
| `git-secrets-scan.txt` | git-secrets (tree + history) |
| `gitleaks-report.json` | gitleaks post-allowlist (clean) |
| `gitleaks-pre-allowlist-history.json` | gitleaks raw history findings (triaged false positives) |
| `trufflehog-report.jsonl` | trufflehog (0 verified / 19 unverified dev connection strings) |
| `zap-frontend-report.{html,json,md}` | OWASP ZAP passive baseline |
| `lighthouse-security-home.report.{html,json}` | Lighthouse 13.3.0 |

Container-image CVE scanning (Trivy) and runtime secret management (ESO) are **M4.8** — see
[`../operations/security-hardening.md`](../operations/security-hardening.md).
