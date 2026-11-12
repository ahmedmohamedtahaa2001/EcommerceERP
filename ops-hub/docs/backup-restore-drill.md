# Backup / restore drill (X-03)

Target per `ROADMAP.md` Section 8, X-03: restore the latest backup to a
fresh database and run the smoke suite, before P1 pilot and then monthly.

## Procedure

1. `pg_dump` the live dev database (`ops_hub`) from inside the running
   `ops-hub-postgres-1` container, custom format (`-Fc`).
2. Create a fresh, empty database (`ops_hub_restore_drill`) in the same
   Postgres instance.
3. `pg_restore` the dump into the fresh database.
4. Point `DATABASE_URL` at the restored database and run the full test
   suite (`RUN_DB_TESTS=1 pnpm test`) against it — this is the project's
   closest equivalent to a "smoke suite" since there's no separate
   lighter-weight smoke script.
5. Drop the drill database and the dump file; no drill artifact is left
   mounted or running.

## Results — 2026-11-12

| Step                           | Result                                                 |
| ------------------------------ | ------------------------------------------------------ |
| Dump (`pg_dump -Fc`)           | 944,882 bytes, ~0.19s                                  |
| Restore (`pg_restore`)         | ~1.13s                                                 |
| Row counts after restore       | `tenants`: 8, `orders`: 55 (matches pre-restore state) |
| Test suite against restored DB | 374/374 passing                                        |

No errors during dump or restore. The restored database passed the same
test suite that runs against the primary dev database, confirming schema,
constraints, RLS policies and data all survived the round trip intact.

## Caveats

- This drill ran against the dev-stack database (`ops_hub`), not a
  production backup — there is no production environment yet. The
  procedure itself (dump → fresh DB → restore → test) is what's being
  verified, and it transfers directly once a production backup exists.
- No cross-host restore was tested (dump and restore both ran inside the
  same container) — a real monthly drill should restore onto a separate
  host to also catch host-level assumptions (paths, extensions, locale).
- This was a single point-in-time drill, not yet the recurring monthly
  cadence X-03 asks for — that cadence needs to be set up (e.g. a scheduled
  job) separately; this entry only closes the "before P1 pilot" requirement.
