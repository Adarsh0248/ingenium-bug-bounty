# Arena Setup Backend

This batch adds reserved arena creation and editable Round 1 duration/roster
configuration. It does not start a competition or certify its readiness.

## Flow

1. Any current normal staff member (Organiser, Owner or Super Admin) reads the
   current arena-control revision and can create or configure an arena. Restricted clock-recovery sessions and
   participant grants have no configuration authority.
2. Creation reserves the singleton immediately, with one `SETUP` instance and one
   Round 1 `DRAFT`. Supply a positive whole-millisecond duration no greater than
   18,000,000 and zero to 100 distinct registered teams. Empty selection is valid
   unfinished setup, not readiness. Every selected team must have both members.
3. Save duration/team changes against that round's configuration revision. Each
   changed save increments it and invalidates `READY` back to `DRAFT`. An unchanged
   save does not invalidate readiness or renew the acting staff session.
4. Immutable, actor-owned receipts recover a lost response across retries or a
   service restart. Team selection is a set: reordered IDs have the same intent.
   A changed payload under the same key conflicts. Stale/occupied/incomplete-team
   rejections remain rejected; reads never retry their effects.

Draft selection lives in `round_draft_teams`, not frozen `team_rounds` or
`member_rounds`. No member language, grant, competition time, wallet or score is
created by setup. Names remain registration labels until the later launch freeze.

## HTTP

All routes are under `/api/v1` and require the normal staff audience. Writes use
the existing protected browser, same-origin/CSRF checks and 16 KiB body bound.
Ordinary draft edits require the current role, not sensitive-action code re-entry.
The later launch/discard/publication commands will require their approved extra
confirmation. No own-code field is accepted by these draft commands.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/staff/arenas/current` | Current reservation and Round 1 draft, revision, selected teams/names |
| GET | `/staff/arena-teams?after=<team UUID>` | Stable UUID pagination, at most 50 registration rows with member positions |
| POST | `/staff/arenas` | Reserve/create against `control_revision` |
| POST | `/staff/arenas/rounds/:round_id/configuration` | Save against `configuration_revision` |
| GET | `/staff/outcomes/arena-setup/:action/:target/:request_key` | Own original receipt; `CREATE/arena` or `CONFIGURE/<round UUID>` |

Both writes take exactly `request_key`, `expected_revision`, `duration_ms`,
`team_ids` and a bounded `reason`. Rejected business receipts return HTTP 409;
invalid structure/limits return 400, absent scope 404, missing authority 401 or
403, and shared quotas 429. An uncertain 503 must be reconciled by the original
key, not blindly resubmitted with a new one. Receipt reads do not expose raw
codes, verifier hashes, session secrets or another actor's commands.

## Storage And Verification

Migrations `0016` through `0018` add the configuration revision, three typed setup tables,
immutable sources and deferred exact-effect/reservation consistency checks.
The API cannot directly change the singleton pointer, instance lifecycle, duration
or draft roster. Narrow security-definer functions lock the security/arena anchors
and apply a validated source under the round gate; they have a pinned search path
and no PUBLIC execution grant. Creation and configuration are atomic. Existing
owner-created test fixtures now reserve their synthetic instance in one statement,
rather than momentarily committing an inconsistent pointer.

The disposable PostgreSQL suite covers duration/roster bounds, roles, concurrency,
retry/restart recovery, immutable payloads, readiness invalidation, the full
100-team/200-member draft, locked-state refusal, HTTP CSRF and secret filtering.
The full-size fixture is not a 200-participant performance or browser load test.

Still required: challenge selection/validation/publication, launch readiness and
freeze, complete lifecycle/discard/history controls, registration provisioning,
live outbox/delivery and the admin UI. The setup response explicitly reports
`can_start: false`; there is no start endpoint or fake READY transition. Default
startup remains health/readiness-only unless the reviewed private runtime is
explicitly supplied. No existing development/cloud database or event credential
was changed for these tests.
