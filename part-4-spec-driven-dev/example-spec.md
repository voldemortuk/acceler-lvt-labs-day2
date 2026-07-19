# Example Spec — Per-Request Audit Logging (for reference only)

> This is a worked example for a *different* feature than today's running build. It exists to show you what a good spec looks like without spoiling the webhook-retries lab.

## 1. Context

We need a per-request audit log of all admin-API actions for compliance. PRD: [link]. No existing tech spec.

## 2. Scope

- A new `audit_log` table records every admin-API mutation.
- Logging happens transparently via Express middleware on `/admin/*` routes.
- The admin UI gains a read-only "Audit log" page (paginated, filterable by actor and date).

## 3. Acceptance criteria

- [ ] AC1 — Every `POST`, `PATCH`, `PUT`, `DELETE` to `/admin/*` produces exactly one `audit_log` row.
- [ ] AC2 — Each row contains: `actor_id`, `actor_email`, `method`, `path`, `status_code`, `request_id`, `created_at`.
- [ ] AC3 — Request bodies are stored with secret fields (any key matching `/password|token|secret|key/i`) replaced with `"[redacted]"`.
- [ ] AC4 — A failed request (non-2xx) still produces a row, with the response status recorded.
- [ ] AC5 — `GET /admin/audit-log` returns paginated rows, default 50/page, max 200/page, sorted by `created_at` desc.

## 4. Constraints

- Logging must not block the response: failures to write the audit row are logged and swallowed, not surfaced to the caller.
- The `audit_log` table is append-only; no updates or deletes from application code.
- Migration must be online-safe (no table lock beyond `CREATE TABLE`).

## 5. Non-goals

- Logging `GET` requests.
- Logging non-admin API traffic.
- Tamper-evident logging (hash chains, signing) — separate feature.
- Export / download of audit logs — separate feature.

## 6. Definition of done

- AC1–AC5 covered by integration tests in `src/api/admin/__tests__/audit-log.test.ts`.
- Lint and type-check clean.
- Structured log line emitted on every audit write (`event: "audit_write"`).
- `README.md` updated under "Compliance" section.
- Migration committed and applied to the test database.
