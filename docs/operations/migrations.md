# Database migrations — operations guide

Audience: DevOps engineers wiring Helm charts and K8s manifests for MyProperty.

This document covers how schema migrations are applied to the MyProperty Postgres database in any deployed environment. Local development is out of scope — see "Local development" below.

---

## 1. Overview

MyProperty uses EF Core migrations. Schema changes are authored as C# migration classes under `backend/MyProperty.Infrastructure/Persistence/Migrations/`. In deployed environments, migrations are applied by a **migration bundle** — a self-contained executable that knows how to bring a Postgres database from any prior schema version to the latest one.

The bundle is shipped as a Docker image, separate from the API image. It runs once per deploy, before any new API pods serve traffic.

**Why not call `Database.Migrate()` from `Program.cs`?** In a rolling K8s deploy, multiple new API pods start in parallel. Each would race for the migration lock; losers time out, and any pod that begins serving traffic before migrations finish hits queries against a partially-migrated schema. Out-of-band migration via a one-shot Job eliminates the race entirely.

---

## 2. Image reference

```
ghcr.io/<repo-owner>/myproperty-migrations:<tag>
```

`<repo-owner>` is the GitHub organisation or user hosting the `MyProperty` repo. The image is published to GitHub Container Registry by `.github/workflows/backend-ci.yml`.

### Tagging scheme

Every push to `develop` or `main` produces two tags pointing at the same image:

| Tag | Mutability | Use case |
|---|---|---|
| `<short-git-sha>` (e.g. `a1b2c3d`) | Immutable | **What Helm references.** Pinning to SHA guarantees a deploy applies the exact migration set that was tested. |
| `<branch-name>` (e.g. `develop`, `main`) | Mutable — moves to latest build | Human inspection only. Never reference from Helm. |

Pull requests **do not** produce images. Only merged commits on `develop` / `main` publish.

---

## 3. Required environment variables

| Variable | Required | Description |
|---|---|---|
| `ConnectionStrings__Postgres` | **Yes** | Full Npgsql connection string. Must include host, port, database, username, password. Pool tuning params (`MaxPoolSize`, `MinPoolSize`, `CommandTimeout`) are valid but generally irrelevant for migrations — set them anyway for consistency with the API connection string. |

If `ConnectionStrings__Postgres` is missing, the bundle silently falls back to a local development connection string baked into `AppDbContextFactory.cs`. In any deployed environment, this fallback will fail with a connection error. DevOps must inject `ConnectionStrings__Postgres` explicitly via a K8s Secret — see §7 example.

---

## 4. Optional environment variables

None as of M4. Reserved for future use.

---

## 5. Exit-code contract

| Exit code | Meaning | Helm behaviour |
|---|---|---|
| `0` | All pending migrations applied successfully (or none were pending). | Proceed with API rollout. |
| Non-zero (any) | Something failed. Bundle did not complete. | **Abort the rollout.** Do not start new API pods. |

The bundle does not use distinct non-zero codes to signal categories of failure. Treat any non-zero as fatal.

---

## 6. Idempotency

Running the bundle against a fully-migrated database is a **successful no-op**. EF Core's `__EFMigrationsHistory` table records every applied migration; the bundle compares its embedded migration list against this table and applies only the missing ones.

This means Helm's retry behaviour on a pre-upgrade hook is safe — re-running the migration Job will not double-apply migrations.

---

## 7. Run order relative to API deployment

The bundle must run **before** new API pods start, and must complete successfully before the rollout proceeds. In Helm terms:

1. `pre-upgrade` / `pre-install` hook → migration `Job`.
2. Wait for `Job` completion (Helm hook semantics handle this automatically when the Job is annotated correctly).
3. API `Deployment` rolls out new pods.

Example Helm Job manifest (DevOps to adapt for the chart):

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myproperty-migrations-{{ .Release.Revision }}
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 600   # see §8
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: ghcr.io/<repo-owner>/myproperty-migrations:{{ .Values.image.migrationsTag }}
          env:
            - name: ConnectionStrings__Postgres
              valueFrom:
                secretKeyRef:
                  name: myproperty-db
                  key: connection-string
```

The `helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded` annotation removes successful Job pods on the next release while preserving failed ones for debugging.

---

## 8. Job-timeout behaviour

The default `activeDeadlineSeconds: 600` (10 minutes) covers all current migrations comfortably. The longest current migration is `AddOverduePaymentsPartialIndex`, which creates a partial index on the `Payments` table — fast on the data volumes M4 will run against.

If a future migration is expected to take longer (e.g. backfilling a column on a large table, building a non-partial index on a multi-million-row table), bump both:

- `activeDeadlineSeconds` on the Job manifest.
- Helm's hook timeout via `--timeout 30m` on `helm upgrade`.

If the Job exceeds `activeDeadlineSeconds`, K8s kills the pod and Helm aborts the upgrade. The migration **may have partially completed** depending on which statement was executing — see §9.

---

## 9. Failure-mid-migration semantics

EF Core wraps each migration in a Postgres transaction by default. A migration that fails mid-execution rolls back to the prior known-good state, and `__EFMigrationsHistory` is not updated. Re-running the bundle resumes from that point.

**Exception:** any migration containing `CREATE INDEX CONCURRENTLY` runs outside a transaction (Postgres does not permit this DDL inside one). The current migration set has not been audited for this. If a future migration uses `CREATE INDEX CONCURRENTLY`, partial-completion semantics differ: the index may exist in an invalid state after a failure, and the next run will fail with a duplicate-name error. Manual cleanup procedure is documented in Postgres's index documentation.

---

## 10. Rollback

Migrations are **forward-only by design**. There is no automated rollback path from CI or Helm.

To undo a deployed migration, the correct procedure is:

1. Write a new EF migration that reverses the change (`dotnet ef migrations add Revert<Name>`).
2. Commit, merge, deploy. The new migration applies as normal.

### Break-glass: manual revert against prod

⚠️ **Avoid unless production is broken and the forward-fix is not viable.**

A previous migration can be rolled back manually using `dotnet ef database update <PreviousMigrationName>` against the production database, run from a developer machine with prod credentials. This requires the .NET SDK and the source tree at the matching commit. The bundle does not expose `down` migrations.

This procedure has no audit trail in the cluster and bypasses the normal review path. Document any use in the incident log.

---

## 11. Local verification recipe

To exercise the bundle against a throwaway Postgres without involving K8s:

```bash
# 1. Build the local image
./backend/scripts/build-migration-bundle.sh

# 2. Bring up a fresh Postgres
docker run --rm -d --name mig-test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=myproperty \
  -p 55432:5432 \
  postgres:16

# Give Postgres a few seconds to start
sleep 3

# 3. Run the bundle against it — expect exit 0
docker run --rm --network host \
  -e ConnectionStrings__Postgres="Host=localhost;Port=55432;Database=myproperty;Username=postgres;Password=test" \
  myproperty-migrations:local

# 4. Inspect __EFMigrationsHistory to confirm all migrations applied
docker exec mig-test psql -U postgres -d myproperty \
  -c 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1;'

# 5. Re-run the bundle — expect exit 0 and zero schema changes (idempotency)
docker run --rm --network host \
  -e ConnectionStrings__Postgres="Host=localhost;Port=55432;Database=myproperty;Username=postgres;Password=test" \
  myproperty-migrations:local

# 6. Run with a bogus connection string — expect non-zero exit and stderr message
docker run --rm \
  -e ConnectionStrings__Postgres="Host=nowhere.invalid;Port=5432;Database=x;Username=x;Password=x" \
  myproperty-migrations:local
echo "exit code: $?"   # expect non-zero

# 7. Tear down
docker rm -f mig-test
```

---

## 12. CI build path

`.github/workflows/backend-ci.yml` defines a `migration-bundle` job that runs after `build-and-test` on every push to `develop` or `main`. The job invokes `backend/scripts/build-migration-bundle.sh` with `PUSH=true` and the required env vars, producing two tags (SHA + branch) per build.

GHCR retention is DevOps-managed; no retention policy is enforced from this repo.

---

## 13. Not in this document

The following are deliberately out of scope:

- The Helm chart structure that consumes this image (DevOps).
- Connection-pool sizing for the migration run (audit item D3, separate).
- Migration bundles for non-Linux runtimes (not supported; cluster is Linux).
- Local development workflows. Developers continue to use:
  ```
  dotnet ef database update \
    -p backend/MyProperty.Infrastructure \
    -s backend/MyProperty.Api
  ```
  The bundle path is for CI/CD and K8s only. Do not wire it into `docker-compose.yml`.

---

## Change log

- **2026-05-17** — initial draft. Plan 5 of the M4 unblock sprint.
