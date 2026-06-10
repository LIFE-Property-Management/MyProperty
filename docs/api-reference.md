# API Reference — MyProperty REST API (v1)

The committed, version-controlled reference for the `MyProperty.Api` REST surface. It is
hand-derived from the v1 controllers (`backend/MyProperty.Api/Controllers/V1/`) and kept in lockstep
with them.

> **Live spec:** the runtime source of truth is **Swagger / OpenAPI at `/swagger`** (enabled in
> Development and Staging), generated from the same controllers + XML doc comments. To commit the raw
> OpenAPI document, export it with the Swashbuckle CLI:
> ```bash
> dotnet tool install -g Swashbuckle.AspNetCore.Cli
> dotnet swagger tofile --output docs/openapi.v1.json \
>   backend/MyProperty.Api/bin/Release/net10.0/MyProperty.Api.dll v1
> ```
> This markdown reference is what to read; `/swagger` is what to call.

---

## Conventions

| Concern | Detail |
|---|---|
| **Base path** | All endpoints are under `/api/v{version}` — currently `/api/v1`. URL-based versioning via `Asp.Versioning`. |
| **Transport** | HTTPS only at the edge (TLS terminated by Nginx in dev / ingress-nginx in prod). |
| **Auth** | Bearer JWT issued by Keycloak: `Authorization: Bearer <access_token>`. Validated locally against Keycloak's JWKS (no per-request IdP call). Endpoints marked **Anonymous** take no token. |
| **Roles → policies** | Keycloak realm roles `Tenant` / `Landlord` / `Admin` map to the `RequireTenant` / `RequireLandlord` / `RequireAdmin` authorization policies. The default fallback policy requires authentication, so an unmarked endpoint is authenticated-only. |
| **Resource ownership** | Beyond the role gate, write/read handlers enforce ownership (a landlord may only touch their own leases/payments/properties; a tenant only their own lease/payments). Violations return **403**. |
| **Errors** | RFC 7807 `ProblemDetails`. Validation failures → **400** `ValidationProblemDetails`. Domain exceptions map centrally: `NotFoundException` → **404**, `ForbiddenException` → **403**, `ConflictException` → **409**. `type` URIs live under `https://myproperty.app/errors/`. |
| **Rate limiting** | Two policies (429 on exceed): **`anon-invite`** = 30 req/min per client IP (public auth + invite endpoints); **`authenticated`** = 120 req/min per user (`sub` claim, IP fallback). |
| **Pagination** | List endpoints accept `?page` (1-based) and `?pageSize`. Response envelope `PagedResult<T>`: `{ items, page, pageSize, totalCount, totalPages }`. |
| **Content types** | JSON in/out, except `POST /payments/{id}/submit` which is `multipart/form-data`, and `GET /payments/{id}/receipt` which streams the stored file inline. |
| **Cancellation** | Every action honours request cancellation; long reads are server-cached where noted. |

---

## Auth — `/api/v1/auth`  *(anonymous)*

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register-landlord` | Anonymous · `anon-invite` | `{ email, firstName, lastName, phone?, password }` | **201** `{ keycloakUserId, loginUrl }` | 400, 409 (email exists), 429 |

- **Landlords self-register; tenants do not.** This provisions a Keycloak user with the `Landlord`
  realm role server-side (the browser never assigns its own role). It does **not** log the user in
  and does **not** write a DB row — the application `User` row is created lazily on the first
  authenticated `/me` call. Redirect to the hosted login (`loginUrl`) after a 201.

## Current user — `/api/v1/me`  *(authenticated)*

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/me` | Any authenticated · `authenticated` | — | **200** `MeDto` `{ id, keycloakSubId, email, firstName, lastName, phone?, accountStatus?, roles[] }` | 401 |
| GET | `/me/tenant-only` | `RequireTenant` | — | **200** `MeDto` | 401, 403 |
| GET | `/me/lease` | `RequireTenant` | — | **200** `TenantLeaseDto` · **204** if no active lease | 401, 403 |

- `GET /me` **lazily upserts** the caller's `User` row from JWT claims — it is the first authenticated
  call a new Keycloak identity makes, and the point at which their domain row is created.

## Invites — `/api/v1/invites`

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/invites` | `RequireLandlord` · `authenticated` | `CreateInviteCommand` (tenant email, names, property, proposed lease terms) | **200** `InviteCreatedDto` | 400, 401, 403, 404, 429 |
| GET | `/invites/by-token/{token}` | **Anonymous** · `anon-invite` | — | **200** `InvitePreviewDto` | 400, **404** (non-Pending / expired), 429 |
| POST | `/invites/{token}/accept` | **Anonymous** · `anon-invite` | `{ firstName, lastName, phone?, password }` | **200** `InviteAcceptedDto` `{ inviteId, leaseId }` | 400, **404**, **409** (email already has an account), 429 |
| POST | `/invites/{token}/reject` | **Anonymous** · `anon-invite` | — | **204** | 400, 404, 429 |

- **The token is the credential** for preview/accept/reject — no JWT. The token is a 32-byte secret
  in the email link; the DB stores only its SHA-256 hash. Accept/reject require `Pending` + not
  expired, else **404** (there is deliberately no 410 Gone).
- **Accept provisions the account.** It creates the Keycloak user (with the submitted password and
  the `Tenant` role), the `User` row, and the `Lease` (from the invite's proposed terms) in one
  transaction, then marks the invite `Accepted`. The invitee email comes from the invite (not user
  input), so it can't be redirected. See [`architecture/process-flows.md`](./architecture/process-flows.md) Flow 7
  and the [invite state machine](./architecture/diagrams/state-invite.svg).

## Properties — `/api/v1/properties`  *(all `RequireLandlord` · `authenticated`)*

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| POST | `/properties` | `{ name, address, unitNumber?, propertyType }` | **201** `PropertyCreatedDto` | 400, 401, 403 |
| GET | `/properties` | `?page&pageSize` (default 1 / 10) | **200** `PagedResult<PropertyDto>` | 401, 403 |
| GET | `/properties/{id}` | — | **200** `PropertyDetailDto` (tenants + leases) | 404 |
| PUT | `/properties/{id}` | `{ name, address, unitNumber?, propertyType }` | **204** | 400, 403, 404 |
| DELETE | `/properties/{id}` | — | **204** (soft delete) | 403, 404 |

- `propertyType` ∈ `{ House, Apartment, Commercial, Other }`.

## Leases — `/api/v1/leases`  *(all `RequireLandlord` · `authenticated`)*

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/leases` | `?page&pageSize` (default 1 / 20) | **200** `PagedResult<LeaseDto>` | 401, 403 |
| GET | `/leases/expiring-soon` | `?daysThreshold` (default 30) | **200** `ExpiringLeaseDto[]` (EndDate asc) | 401, 403 |
| PATCH | `/leases/{id}/terminate` | — | **204** | 400, 401, 403, 404, 409 |

- Terminate is the one genuine entity-level state method (`Lease.Terminate()`); `LeaseStatus` ∈
  `{ Active, Expired, Terminated }`.

## Payments — `/api/v1/payments`

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/payments` | `RequireLandlord` · `authenticated` | `{ leaseId, amount, currency, dueDate }` | **200** `PaymentCreatedDto` | 400, 401, 403, 404, 429 |
| POST | `/payments/{id}/submit` | `RequireTenant` · `authenticated` · `multipart/form-data` | form: `method`, `notes?`, `file?` | **200** `PaymentSubmittedDto` | 400, 401, 403, 404, **409**, **413** (>6 MB), 429 |
| POST | `/payments/{id}/confirm` | `RequireLandlord` · `authenticated` | — | **200** `PaymentConfirmedDto` | 400, 401, 403, 404, **409**, 429 |
| POST | `/payments/{id}/reject` | `RequireLandlord` · `authenticated` | `{ reason }` | **200** `PaymentRejectedDto` | 400, 401, 403, 404, **409**, 429 |
| GET | `/payments/{id}/receipt` | Authenticated (tenant on lease **or** owning landlord) | — | **200** file (`Content-Disposition: inline`) | 401, 403, **404** (no payment / no receipt), 429 |

- **State machine** (`PaymentStatus` ∈ `{ Outstanding, Pending, Confirmed, Rejected }`), enforced in
  the handlers — illegal transitions return **409**:
  - `submit` requires `Outstanding` **or** `Rejected` (resubmit); `method` ∈ `{ ReceiptUpload, ManualRequest }`.
    `ReceiptUpload` requires a `file`; `ManualRequest` forbids one.
  - `confirm` / `reject` require `Pending`.
  - See [`architecture/process-flows.md`](./architecture/process-flows.md) Flows 5–6 and the
    [payment state machine](./architecture/diagrams/state-payment.svg).
- **Upload limits:** 6 MB hard cap (Kestrel → **413**) and a 5 MB business cap + MIME allowlist
  (`image/jpeg`, `image/png`, `application/pdf`) via the validator → **400**.

## Landlord portal — `/api/v1/landlord`  *(all `RequireLandlord` · `authenticated`)*

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/landlord/dashboard` | — | **200** `LandlordDashboardDto` (counters) | 401, 403 |
| GET | `/landlord/payments/upcoming` | `?page&pageSize` (default 1 / 10) | **200** `PagedResult<UpcomingPaymentDto>` | 401, 403 |
| GET | `/landlord/tenants` | `?page&pageSize` (default 1 / 20) | **200** `PagedResult<LandlordTenantDto>` | 401, 403 |
| GET | `/landlord/tenants/{id}` | — | **200** `TenantDetailDto` (lease + payment history) | 401, 403, **404** (not your tenant) |

- `/landlord/dashboard` is **cache-aside on Redis (60 s TTL)**, invalidated on payment writes and
  invite accept.

## Admin / stakeholder — `/api/v1/admin`  *(all `RequireAdmin` · `authenticated`)*

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/admin/dashboard` | — | **200** `StakeholderDashboardDto` (system-wide KPIs + 12-month trends) | 401, 403 |

- Data is **global**, not scoped to the caller (intentional — it's the stakeholder/product view).
  Cache-aside on Redis (**5 min TTL**).

---

## Operational endpoints  *(not versioned controllers)*

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/health/live` | Anonymous | Liveness — 200 if the process responds (K8s `livenessProbe`). |
| GET | `/api/v1/health/ready` | Anonymous | Readiness — checks **Postgres only**; 503 if down (K8s `readinessProbe` + CD gate). |
| GET | `/api/v1/health/diagnostics` | Anonymous | All dependency checks (Postgres, Redis, RabbitMQ, Keycloak JWKS); 200/503 + per-check body. |
| GET | `/metrics` | Anonymous (cluster-internal) | Prometheus exposition (`prometheus-net`). |
| — | `/hangfire` | `RequireAdmin` | Hangfire dashboard (job/queue inspection). |
| WS | `/hubs/notifications` | JWT via `?access_token=` | SignalR hub (server-push; browser client not yet wired). |

---

## Schemas

DTO field shapes follow the entity model. For column types, keys, enums, and indexes see the
[database schema review](./database/README.md). Request commands/queries and response DTOs live
beside their handlers in `backend/MyProperty.Application/<Feature>/`. The state-bearing enums:

- `PaymentStatus` = `Outstanding | Pending | Confirmed | Rejected`
- `InviteStatus` = `Pending | Accepted | Rejected | Expired`
- `LeaseStatus` = `Active | Expired | Terminated`
- `PaymentMethod` = `ReceiptUpload | ManualRequest`
- `PropertyType` = `House | Apartment | Commercial | Other`
- `TenantAccountStatus` = `Active | ReadOnly`
