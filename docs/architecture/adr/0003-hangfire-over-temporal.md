# ADR-0003: Hangfire over Temporal / Quartz

- **Status:** Accepted (M3.7, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`components.md`](../components.md), [`data-flow.md`](../data-flow.md)

## Context

M3.7 mandates background jobs with retry + dead-letter queue. We need: retryable email send (5 attempts, exponential backoff, DLQ on terminal failure), receipt OCR job (long-running, single attempt with idempotent execution), and the capability to schedule recurring scans (overdue payments, orphan invite cleanup, expired-invite marking, lease-expiring scan — these are M3 follow-ups, planned but not yet scheduled). We do **not** need: workflow orchestration with branching, multi-day human-in-the-loop steps, fan-out/fan-in coordination.

## Decision

Adopt **Hangfire 1.8** with **PostgreSQL storage** (`Hangfire.PostgreSql`). The Hangfire server is hosted **in the same .NET process** as the API. Web dashboard mounted at `/hangfire`, gated by the `RequireAdmin` ASP.NET Core policy.

Job classes live in `MyProperty.Infrastructure/Jobs/` as scoped services with a single `ExecuteAsync(args, ct)` method. Two ad-hoc jobs are wired today: `SendEmailJob` and `ReceiptOcrJob`. The recurring scans named in the Context section are M3 follow-ups; Hangfire's `RecurringJob.AddOrUpdate` API will register them at startup once the corresponding handlers exist.

The `SendEmailJob` uses Hangfire's `IElectStateFilter` to translate a final `FailedState` transition into a `FailedEmails` table row — our domain DLQ.

## Consequences

### Positive

- **Zero new infrastructure**: Hangfire writes to the same PostgreSQL instance that already backs the application schema. No new container, no new credential.
- **Web dashboard for free**: visible job state, retry history, recurring schedule editor, manual re-trigger, manual delete. Saves an hour of writing custom admin tooling.
- **Same-process execution**: jobs share `IServiceScope`, `AppDbContext`, `IFileStorage`, `INotificationDispatcher`, `IEmailSender`. No serialization-only contract surface — jobs are just C# methods.
- **Cooperates with the API's CorrelationId middleware**: job arguments propagate the trace ID so logs in Grafana Explore stitch back to the originating request.
- **MIT license** — no licensing surprises like MediatR.

### Negative

- **Co-located workers and API** share CPU/memory. A heavy OCR job can pressure request-serving threads. Acceptable at MVP — the API is sized for two workloads.
- **Single-process means one replica.** Scaling to multiple backend replicas requires either (a) Hangfire's server tag config to ensure each job runs once or (b) splitting the worker into a separate Deployment. Currently we're at `replicas: 1` for unrelated reasons (the ReadWriteOnce PVC for receipt storage), so this constraint is moot until the M5 Spaces swap.
- **Job dashboard at `/hangfire` exposed via Ingress** — the `Admin` policy is the only thing in front of it. Acceptable because the policy validates a JWT role claim, but a misconfiguration would expose it.

### Mitigations

- The `Admin` policy is **tested explicitly** in the integration suite — adding/removing the role flips access immediately.
- **Hangfire queues** (`"emails"`, `"default"`) let us throttle one job type without affecting the other. If OCR ever pressures email throughput, we can dedicate a worker.
- **Pre-upgrade Helm Hook for EF Core migrations** means the Hangfire schema migrations happen safely outside the request path.

## Alternatives considered

### Temporal — rejected

- Heavyweight: separate Temporal Server (Cassandra/Postgres + Elasticsearch for visibility), Worker SDK, namespace setup.
- Designed for workflows (multi-step, long-running, branching, fan-out/fan-in) — we have *jobs*, not workflows.
- Operational story for a 1-developer demo is unproven; the Temporal Operator added complexity we don't budget for.

### Quartz.NET — rejected

- Older library, less idiomatic in .NET Core (still works, but the integration patterns lag).
- **No web dashboard built in.** Adding one means another container (Quartzmin / similar) or a hand-rolled UI.
- DLQ pattern requires custom job listeners; less elegant than Hangfire's `IElectStateFilter`.

### IHostedService-only (no library) — rejected

- We'd be re-implementing: persistence, retry-with-backoff, DLQ, recurring scheduler, dashboard, dedup by job ID, distributed locking.
- This was attempted in spirit at M3 spike-time; the prototype was ~600 lines and incomplete. Hangfire's surface area is the price of not writing those 600 lines.

### Azure Functions / AWS Lambda — rejected

- Cloud-vendor lock-in.
- Cold-start latency on recurring jobs that fire daily.
- Tight integration with `IHttpContextAccessor` + EF Core in-process is impractical from a separate runtime.
