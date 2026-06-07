# ADR-0002: RabbitMQ over Kafka (and over MassTransit)

- **Status:** Accepted (M3.10, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`components.md`](../components.md), [`data-flow.md`](../data-flow.md), [`events.md`](../events.md)

## Context

M3.8 + M3.10 mandate **at least one event-driven flow** with a message broker. We have low-throughput, semantic events (`payment.submitted`, `payment.confirmed`, `payment.rejected`, `payment.created`) where each event triggers a small number of side effects (email, OCR job, SignalR push). Volume target at MVP: tens of events per minute, not millions per second.

## Decision

Use **RabbitMQ 3 with a single topic exchange** (`myproperty.events`). Producers (handlers) publish via `RabbitMQ.Client 7` directly. Consumers are .NET `IHostedService` instances that subclass `IntegrationEventConsumerBase` (declare → bind → consume → ack). Five queues bound to four routing keys — see [`events.md`](../events.md) for the full topology.

**No MassTransit.** Direct `RabbitMQ.Client` use keeps the wire-level surface visible in code; the library overhead doesn't earn its keep at our event count.

## Consequences

### Positive

- **AMQP topic routing maps cleanly to domain semantics.** Routing key `{aggregate}.{verb}` (auto-derived from the event class name) means the binding logic reads like the domain model.
- **Fan-out is one extra binding, not a code change.** `PaymentSubmittedEvent` already fans out to two queues (SignalR + OCR) with independent ack semantics — neither consumer waits on the other.
- **Operationally minimal.** One container, one management UI (`:15672`), one named volume.
- **RabbitMQ's management UI is a free debugging tool** for ops sessions — message rates, queue depth, consumer status visible without writing dashboards.
- **`RabbitMQ.Client` is the canonical library** for .NET → AMQP. No abstraction layer to learn, no inflexible message contracts.

### Negative

- **No message replay.** If a consumer is broken and we lose messages from the queue (consumer ack + crash), there's no way to "rewind" the way Kafka allows.
- **No partitioning / sharding semantics.** Fine at MVP scale; would matter at hundreds of thousands of events per second.
- **Single broker is a SPOF.** A clustered RabbitMQ deployment (3 nodes + quorum queues) would be the prod-hardening path; not yet implemented.

### Mitigations

- Consumers are **idempotent** (Hangfire dedupes by job ID; SignalR pushes are signals → invalidate cache).
- Publishers publish **after** the DB commit, so a broker-publish failure doesn't lose user-visible state — only the side effect.
- **Outbox pattern is the next step** if exactly-once semantics ever become a requirement.

## Alternatives considered

### Apache Kafka — rejected

- Operational overhead: Zookeeper (or KRaft) + brokers + topics + partitions + consumer groups. For our event count this is overkill.
- Designed for high-throughput streaming + replay; we use neither.
- Storage cost of log retention (default 7 d) for events we don't need to replay.
- Schemas typically require Confluent Schema Registry — another service.
- Heavier client libraries (Confluent.Kafka, MassTransit.Kafka).

### MassTransit (on top of RabbitMQ) — rejected

- Adds sagas, scheduling, consumer pipelines, message versioning, retry policies — features we don't need at five consumers.
- Hides the AMQP wire from developers; harder to debug routing/binding issues.
- Extra abstraction layer + DI registration ceremony.

### Direct in-process events (no broker) — rejected

- Couples publishers to consumers in the same process. We'd lose:
  - Independent ack semantics for OCR vs SignalR fan-out.
  - Replay-able side effects (RabbitMQ retries failed deliveries automatically).
  - The ability to move OCR or email out of the API process later without code changes.
