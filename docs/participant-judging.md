# Participant Judging Backend

This batch connects participant admission, durable per-case execution, the existing
private judge transport, backend checking and competition settlement. It is a
backend implementation, not an installed judge or finished participant workbench.
Normal startup still has no synthetic runner or default readiness bypass.

## Data Flow

1. Run and Submit accept editor-at-click source only. The backend resolves the
   authenticated member, locked language, selected published snapshot and runtime.
   Source is preserved exactly, subject to the existing valid UTF-8/128 KiB check.
2. Official admission creates its immutable competition receipt and entire case
   plan in one transaction. Sample admission has a separate receipt and sample-only
   plan. Queue/health/cooldown refusal rolls back admission and returns a bounded
   retry indication, not a wrong attempt or receipt priority.
3. `participant_judging` freezes parent/source/configuration identity; its version-1
   policy resolves the approved recovery constants. `participant_jobs` contains
   every required frozen case. `participant_attempts` retains each original host,
   payload digest, once-only send, observation and independent physical release.
4. A worker claims the existing 30-second database ownership generation. A dispatch
   commits its physical slot and `SEND_STARTED` before its one POST. A lost reply,
   invalid observation or replacement worker uses GET for that same attempt. It
   cannot repeat the POST or infer drain from a timeout or absent provider record.
5. Checked byte-preserving observations pass through the existing evidence decoder
   and pinned token/exact-text checker. Expected answers never enter the execution
   request. Reliable cases are sealed once; official completion requires every
   required case, then calls the existing atomic assessment/award/penalty path.

The historical TypeScript names `AuthoringPayload`/`TrustedAuthoringDriver` and wire
namespace remain for compatibility. The request now has explicit digest-bound
`OFFICIAL` and `SAMPLE` provenance in addition to `REFERENCE`/`STARTER`; participant
work is never disguised as a reference solution. Participant requests cannot use
the authoring compilation-only mode. Deployments require the additive private
gateway migration `005_participant_payloads.sql`, not an older gateway's readiness
response. Historical authoring payload digests and bytes do not change.

## Scheduling And Recovery

- Two unfinished sample Runs per durable member across tabs/sessions; the teammate
  has independent allowances. Official work retains the one-unfinished-team/bounty
  guard, allowing other bounties concurrently. New Run/Submit cooldowns are separate
  three-/five-second lanes; known matching intents do not allocate again.
- Reserve complete suites: at most 4,096 unfinished official case jobs and 256
  sample case jobs globally, and 20,000 parents in each lane per arena instance.
- Dispatch three official case turns then one sample turn when both are eligible,
  with cyclic team rotation. Empty lanes borrow capacity. Within a team/lane, use
  durable admission order then frozen case order; this queue sequence is not the
  official competition receipt or a new tie-breaker.
- Use the existing two physical development slots, shared with authoring. A parent
  has at most one potentially live execution and a registered team at most two,
  including unresolved historical work. This does not claim eight event slots or
  calibrated throughput. Authoring cannot overlap unfinished participant work.
- Official recovery allows three automatic dispatches total, only following sealed
  infrastructure failure and positive physical release, with two-/five-second
  delays. Five minutes means attention, never expiry or a wrong verdict. An Owner
  or Super Admin may confirm one additional safe dispatch for a selected unresolved
  job with their own code/reason. The permission/receipt is durable and once-only;
  reliable results, unresolved physical work and samples cannot use this exception.
- Samples allow two dispatches total and retain the original 120-second whole-Run
  lifetime, including waiting/recovery/pauses. Equality is expired. Expiry completes
  only the logical Run as `INFRA_ERROR`; it does not cancel a possibly running job,
  release its physical slot, delay official finalisation or create a penalty.
  Later observations cannot replace the fixed sample summary or add late feedback.
- New Run admission respects global/team/member pauses, committed claims and closing.
  Admitted work continues through ordinary pauses/claims/closing under its original
  policy. Only global pause defers official competition effects.

## Access And HTTP

All routes reuse protected cookies, quotas, strict schemas, Origin/CSRF checks and
trusted clock transactions. There is no public verdict/result-injection endpoint.

| Route | Purpose |
| --- | --- |
| `POST /api/v1/competition/rounds/:round_id/bounties/:bounty_id/runs` | Separate penalty-free sample admission |
| `POST /api/v1/competition/rounds/:round_id/bounties/:bounty_id/submissions` | Existing official admission plus atomic full-suite plan |
| `GET /api/v1/competition/rounds/:round_id/judging/:parent_id` | Own-member sample feedback or team-readable official source/progress/summary |
| `GET /api/v1/competition/rounds/:round_id/outcomes/:request_key` | Original actor's exact processed outcome |
| `GET /api/v1/staff/competition/rounds/:round_id/judging?after=...` | Bounded pending/physically-held queue metadata, 40 parents/page |
| `POST /api/v1/staff/competition/rounds/:round_id/jobs/:job_id/retry` | Confirmed, audited, safety-checked extra official dispatch |

Samples expose numbered public-sample results, bounded Base64 diagnostics and
explicit truncation labels only to the original durable member. Official reads
exclude case IDs/positions/counts, all raw output/diagnostics, provider tokens and
private execution evidence. Opponents cannot read either kind of source/result.
Queue monitoring exposes progress/physical-hold metadata, not source or diagnostics;
Organisers can monitor but cannot authorise recovery dispatches.

## Verification And Launch Gates

New migrations 0033-0038 are tested only in disposable databases. The API cannot
write execution tables or call preparation/result functions directly. The separate
non-login competition worker role has narrow functions and the row-lock/read
permissions needed by the existing trusted clock transaction. Migrations do not
issue a worker password or install a worker service.

Tests use real PostgreSQL and real protected HTTP handlers with explicitly synthetic
driver observations. They do not execute participant code. Coverage includes frozen
source/configuration, both member capacities, cooldown/idempotency, fair turns/team
rotation, all five language bindings, lost replies, malformed evidence, stale
ownership, safe backoff/manual recovery, logical-versus-physical release, sample
deadline equality, pause/claim/closing continuation, privacy and both competition
rounds. Private-gateway SQL also checks the new provenance for all five languages.

Current verification: 205 unit/transport checks, 194 complete integration checks,
typecheck and build pass. Schema generation reports no pending changes; no test
was skipped in those suites. Existing Linux sandbox/cloud experiments were not
rerun or modified by this backend batch.

Parent reservations bound participant evidence to 192 MiB per TeamRound and
29 GiB for this family. Unfinished parents reserve the complete worst-case
dispatch allowance; completed parents retain actual bounded evidence plus parent
overhead, while unknown attempts still reserve their full future evidence bundle.
This is not the approved complete shared 32 GiB application budget: aggregate
source/outcome/outbox/staging reservations, cross-family retention, reserved staff
headroom and load calibration
still require the cross-application resource/operations batch before launch.

Also still required: production full-host retirement/installation authority, real
five-language host verification, reviewed gateway/runtime installation, an installed
orchestration/deadline/heartbeat loop, normal startup wiring, exceptional whole-round
cancellation/discipline integration, live delivery/replay, UI and full load/recovery
rehearsal. No test result or logical completion certifies a drained production
sandbox. No cloud lab, existing database, secrets, architecture or Git history is
changed by this batch.
