# PR Description: PostgreSQL Connection Pooling Tuning for Concurrent Load

## Issue

**Issue #988** — [BACKEND] PostgreSQL connection pooling tuning for concurrent load

## Summary

Audit and tune the Prisma/PostgreSQL connection pool configuration to prevent cascading failures under load of 1000+ concurrent trades. PostgreSQL has a hard connection limit (default 100), and Prisma's default pool size (`num_physical_cpus * 2 + 1`) with 4-8 replicas × 20 connections each can exhaust the database.

## Problem Statement

- PostgreSQL has a hard connection limit (default 100)
- Prisma's default pool size is `num_physical_cpus * 2 + 1` which with 4-8 replicas × 20 connections each can exhaust the DB
- No tuning has been done for the target load of 1000+ concurrent trades
- No connection pool metrics, query timeout enforcement, or pool saturation alerts exist

## Proposed Solution (Implemented)

### 1. Connection Pool Metrics

Added four Prometheus metrics per instance:

| Metric | Type | Description |
|---|---|---|
| `pg_pool_active_connections` | Gauge | Number of active PostgreSQL connections in the pool |
| `pg_pool_idle_connections` | Gauge | Number of idle PostgreSQL connections in the pool |
| `pg_pool_waiting_queries` | Gauge | Number of queries waiting for a connection from the pool |
| `pg_pool_timeout_total` | Counter | Total number of connections that waited too long for a pool connection |

### 2. Prisma Middleware for Query Duration

Added Prisma middleware in `backend/src/lib/db.ts` that records query duration per model and operation. This enables tracking of slow queries that may indicate pool saturation.

### 3. PgBouncer in Docker Compose Staging Profile

Added PgBouncer (v1.21-alpine) to the `staging` profile in `docker-compose.yml` configured in **transaction mode**:

- `pool_mode = transaction` — reuses connections across transactions
- `default_pool_size = 15` — max server connections per database
- `reserve_pool_size = 5` — extra connections for burst traffic
- `reserve_pool_timeout = 10` — seconds to wait for reserve pool
- `server_idle_timeout = 600` — close idle server connections after 10 min
- `server_lifetime = 3600` — recycle server connections after 1 hour
- `max_client_conn = 100` — max client connections to PgBouncer

### 4. Pool Saturation Alert

Added `pg_pool_saturation` alert type with `warning` severity:

- Fires when `pg_pool_active_connections` exceeds 80% of max pool size for 5 minutes
- Configurable via `POOL_SATURATION_WARN_THRESHOLD` (default 80) and `POOL_SATURATION_WARN_DURATION_MS` (default 300000)
- Dispatched via `ALERT_WEBHOOK_URL` with HMAC signature (`ALERT_WEBHOOK_SECRET`)
- New `dispatchPoolSaturation()` convenience method on `AlertService`

### 5. Connection String Tuning

Connection string parameters added for pool tuning:

```
postgresql://user:pass@host:5432/db?connection_limit=15&pool_timeout=10
```

### 6. k6 Load Test for Pool Saturation

Updated `k6/load-test.js` with a `selectOneBenchmark()` function that hits the `/health` endpoint (which runs `SELECT 1`) and tracks pool saturation errors and query duration via `pool_saturation_errors` rate and `select_one_duration_ms` counter metrics.

### 7. Environment Variables

Added pool tuning environment variables to `backend/src/config/env.ts` and `.env.staging.example`:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_POOL_SIZE` | `15` | Max connections per Prisma client instance |
| `DATABASE_POOL_TIMEOUT` | `10` | Seconds a query waits for a connection |
| `DATABASE_MAX_OVERFLOW` | `5` | Additional connections beyond pool size |
| `DATABASE_IDLE_INACTIVE_SESSION_TIMEOUT` | `300000` | Close inactive sessions after 5 min |
| `DATABASE_CONNECTION_QUERY_TIMEOUT` | `5000` | Query timeout in ms |
| `PGBOUNCER_ENABLED` | `false` | Enable PgBouncer connection pooling |
| `PGBOUNCER_POOL_MODE` | `transaction` | Pooling mode |
| `PGBOUNCER_DEFAULT_POOL_SIZE` | `15` | Max server connections per database |
| `PGBOUNCER_RESERVE_POOL_SIZE` | `5` | Extra connections for burst traffic |
| `PGBOUNCER_RESERVE_POOL_TIMEOUT` | `10` | Seconds to wait for reserve pool |
| `PGBOUNCER_SERVER_IDLE_TIMEOUT` | `600` | Close idle server connections after 10 min |
| `PGBOUNCER_SERVER_LIFETIME` | `3600` | Recycle server connections after 1 hour |
| `POOL_SATURATION_WARN_THRESHOLD` | `80` | Percent of pool that triggers saturation warning |
| `POOL_SATURATION_WARN_DURATION_MS` | `300000` | Duration threshold for saturation alert (ms) |

### 8. Documentation

Added comprehensive PostgreSQL connection pool tuning section to `docs/backend.md` covering:

- Connection string tuning parameters
- PgBouncer transaction mode configuration
- Connection pool metrics reference
- Query timeout enforcement
- Pool saturation alert configuration
- Benchmarking with k6
- Tuning guidance for staging vs production
- Supabase pooler alternative
- Full environment variable reference

## Impact Area

- Backend
- Infrastructure
- Performance

## Priority

P1 - High

## Implementation Complexity

Moderate

## Files Changed

1. `k6/load-test.js` — Added SELECT 1 pool saturation benchmark
2. `docker-compose.yml` — Added PgBouncer staging profile (transaction mode)
3. `backend/src/lib/metrics.ts` — Added pool metrics (Gauge, Counter) and `recordPoolMetrics()` / `recordPoolTimeout()` functions
4. `backend/src/lib/db.ts` — Added Prisma middleware for query duration recording per model/operation
5. `backend/src/services/metrics.service.ts` — Added pool metrics recording methods
6. `backend/src/routes/metrics.routes.ts` — Added pool metrics to `/metrics-info` endpoint
7. `backend/src/services/alert.service.ts` — Added `pg_pool_saturation` alert type, `AlertSeverity` type, severity parameter to `dispatch()`, and `dispatchPoolSaturation()` convenience method
8. `backend/src/config/env.ts` — Added pool tuning and PgBouncer environment variables
9. `.env.staging.example` — Added pool tuning and PgBouncer environment variables
10. `docs/backend.md` — Added PostgreSQL connection pool tuning documentation section

## Alternates Considered

- **Serverless (Supabase pooler)** — already using Supabase; documented pooler config in docs/backend.md
- **No pooling** — each connection ties up a Postgres backend process; not scalable for 1000+ concurrent trades

## Verification

- All 10 files modified with 409 insertions and 21 deletions
- Branch: `feature/issue-988-postgres-pool-tuning`
- PR: #1013

closes #988