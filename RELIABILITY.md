# RELIABILITY.md

> Uptime, retry, error handling standards.

## Targets

- **API response time:** p95 < 500ms (excludes WhatsApp delivery, which is async)
- **WhatsApp send success rate:** ≥ 95% (failures are logged and flagged for review)
- **Worker job success rate:** ≥ 99% (jobs that succeed within their retry budget)

## Database

- **Connection pool size:** 10
- **Statement timeout:** 5s
- **All financial writes** wrapped in Prisma `$transaction`
- **Migrations** are forward-only; no destructive migrations in production without a plan

## WhatsApp Delivery

- **Retries:** 3 attempts with exponential backoff (2s → 4s → 8s)
- **Logging:** every attempt recorded in `whatsapp_logs` with `evolution_response` (the raw API response)
- **Final failure:** flagged with `status = 'failed'` in `whatsapp_logs`. Admin dashboard surfaces these (Week 7–8).
- **Alerting (Phase 2):** if failure rate > 5% over a rolling 1h window, alert super admin

## Error Handling

All errors funnel through `src/middleware/errorHandler.ts`:

- `AppError` (and subclasses `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) carry `httpCode` + `code` + `message`
- Anything else is treated as a 500, logged with stack, and the response is a generic message
- All responses follow: `{success: false, error: {code, message}}` (errors) or `{success: true, data: ...}` (success)

## Logging

- **pino** in production (JSON), pino-pretty in dev
- Every request gets a `requestId` (uuid v4) attached via middleware
- Every log line includes `requestId` for correlation
- The `requestId` is returned in the `X-Request-Id` response header

## Health Checks

- `GET /health` returns 200 with:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "services": {
        "db": "ok",
        "redis": "ok",
        "s3": "ok"
      }
    }
  }
  ```
- Returns 503 if any service is down
- `GET /ready` is the same but only checks DB

## Graceful Shutdown

- The server traps `SIGTERM` and `SIGINT`
- On signal: stop accepting new connections, drain in-flight requests, close Prisma and Redis, exit

## What to Do When Something Goes Wrong

1. Check the logs (`pino` JSON, filter by `requestId` from a user report)
2. Check `whatsapp_logs` for any delivery issues
3. Check the worker queue length in Redis (`redis-cli LLEN bull:notifications:waiting`)
4. Check the Prisma Studio for data anomalies
5. Escalate to super admin if the issue spans tenants
