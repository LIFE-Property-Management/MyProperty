# ADR-0005: Anthropic Claude over OpenAI / Google Vertex (and substituting OCR for RAG)

- **Status:** Accepted (M3.10, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`context.md`](../context.md), [`containers.md`](../containers.md), [`components.md`](../components.md), [`data-flow.md`](../data-flow.md), [`observability.md`](../observability.md)

> **Note (M5):** the AIOps notification target later moved from **Slack to Discord** — the webhook now posts native Discord embeds via `httpx` (no `slack-sdk`), and a feature-flag kill-switch ([ADR-0010](./0010-unleash-for-feature-flags.md)) now gates the receipt-OCR path. The "Slack" references below are the original M3.10 / M4.11 context; the decision recorded here (Anthropic over OpenAI/Vertex, OCR over RAG) is unchanged. Current behaviour: [`observability.md`](../observability.md).

## Context

M3.10 mandates **at least one AI-powered feature using OpenAI / Anthropic API**. M4.11 mandates **AIOps pipeline (Webhook → LLM → Slack auto-triage)**. The original BE-17 / M3.10 requirement listed **RAG + pgvector + semantic search**.

We have two AI surfaces:

1. **Receipt OCR.** When a tenant uploads a receipt, parse `{amount, date, merchant}` so the payment form pre-fills or the landlord can spot-check. Quality matters — wrong amount = wrong payment record. Latency tolerance is high (Hangfire-backed, ~10–30 s acceptable).
2. **AIOps alert triage.** When Alertmanager fires, prompt an LLM to suggest a likely cause + remediation, post to Slack. Quality requirement is *lower* (it's a hint, not a decision). Latency requirement is low-ish (~5 s) and cost matters — alerts can be chatty.

We also need to choose whether to ship RAG or substitute receipt OCR.

## Decision

### Substitute receipt OCR for RAG (BE-17 swap)

We have **no domain use case for vector search**. Properties, leases, tenants, payments — none of these benefit from semantic similarity. RAG would be ceremony without payoff. Receipt OCR, by contrast, is *both* an AI feature *and* a real improvement to the payment-submission UX.

The substitution is allowed by the milestones doc; the substitution itself is the deliverable.

### Use Anthropic Claude — both tiers, single SDK

- **Receipt OCR:** `claude-sonnet-4-5-20250929` (Anthropic SDK, vision input). Configured via `Anthropic:Model` / `Anthropic:TimeoutSeconds` (default 30 s) — see [`appsettings.json`](../../../backend/MyProperty.Api/appsettings.json).
- **AIOps triage:** `claude-haiku-4-5-20251001` (Python `anthropic` SDK). Configured via `AIOPS_ANTHROPIC_MODEL` — see [`aiops-webhook`](../../../infrastructure/aiops-webhook/).

**One vendor, one API key surface** (one for each environment, but the same vendor account). The receipt-OCR wrapper (`AnthropicReceiptOcrService`) and the AIOps webhook each implement their own retry + timeout — graceful degradation differs by surface (the AIOps webhook falls back to raw labels in Slack; receipt OCR falls back to "no OCR result" and the user fills the form manually).

## Consequences

### Positive

- **Sonnet's vision quality on structured documents (receipts) is high** in our sample tests; the JSON output it returns parses cleanly.
- **Haiku's cost-per-token is low enough to triage chatty alerts** without budget concern. The AIOps webhook calls Haiku once per *firing* alert (Alertmanager's `repeat_interval: 12h` caps re-prompting), so a noisy day is ~50 calls, not 50 000.
- **One SDK per language** (.NET — `Anthropic.SDK`; Python — `anthropic`) — single auth model, single billing dashboard.
- **`claude-sonnet-4-5` and `claude-haiku-4-5-20251001` are both currently available** as of 2026-05.

### Negative

- **Vendor concentration risk.** If Anthropic has an outage, both receipt OCR and AIOps triage degrade simultaneously.
- **No structured output guarantee** like OpenAI's function calling — we rely on prompt + JSON schema description + best-effort parsing. Malformed responses → empty result + manual fill.
- **PII enters Anthropic's API** (receipt images may contain names, addresses, payment data). This is acceptable for a demo but would need a data-residency review in a real product.

### Mitigations

- `IReceiptOcrService` abstraction means swapping providers is a single-file change (new impl, registered in `Infrastructure/DependencyInjection.cs`). Tests use a fake.
- AIOps webhook has **graceful degradation** if `ANTHROPIC_API_KEY` is empty — raw alert labels + annotations posted to Slack with a "Triage disabled" header. Demo and incident response continue to function without the AI hop.

## Alternatives considered

### OpenAI (GPT-4 Vision + GPT-4o-mini) — rejected

- GPT-4 Vision quality on receipts is comparable but **costs are higher per receipt** (token count for vision-prompt + JSON output) than Sonnet at the time of decision.
- GPT-4o-mini for triage would be the equivalent cheap tier — comparable to Haiku in cost, but at the time of the decision Anthropic's free-tier development credits favoured staying on a single vendor.
- Function calling would give us structured output guarantees — a real positive, but not enough to outweigh the cost split.

### Google Vertex (Gemini) — rejected

- Comparable vision quality on receipts.
- Authentication requires a Service Account JSON, which is more friction than an API key for the demo (and one more secret to manage in External Secrets).
- The .NET SDK is less mature than Anthropic's official `Anthropic.SDK` or OpenAI's official SDK.

### pgvector + RAG (original BE-17) — rejected (substituted)

- **No domain use case.** We have entities (Property, Lease, Tenant, Payment) with relational queries that are well-served by SQL. Semantic similarity over "all properties matching this vibe" is not an actual user need.
- Receipt OCR is a real UX improvement (form pre-fill); RAG would be ceremony for the grading rubric.
- The milestones doc explicitly allows substitution; this is one.
