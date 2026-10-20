# Challenge Draft Authoring

This backend batch stores editable challenge drafts. It runs no participant or
reference code, publishes nothing and does not make an arena launchable.

## Model

- A `bug_definition` is the reusable identity and Round 1/2 category. Each new
  version has a separate UUID and a unique increasing version number.
- `bug_versions` own the title, statement, difficulty, derived reward
  (`10 * difficulty`), full-program format and versioned output checker.
- Five language variants own exact starter/reference sources, the private defect
  description and optional registered runtime/limit selection. Missing runtime
  configuration and empty working source are allowed unfinished draft data,
  never successful validation.
- Cases are shared across languages. Their UUIDs survive draft edits and
  reordering; witnesses reference those IDs, not positions. A removed draft case
  is retired rather than deleted because earlier receipts still reference it.
  Clear any witness which uses a case before removing that case.
- Hints have stable UUIDs and one row per version/level (1, 2, 3). Draft hints may
  be incomplete. No price, purchased flag, wallet or score is stored on a hint.

Every applied draft command locks the catalogue/version, checks its expected
revision and advances the content revision once. Immutable actor-owned receipts
recover lost responses without repeating effects or overwriting newer content.
Unchanged text/order creates an unchanged receipt, not a revision/activity bump.
Private bytes are not copied into ordinary receipts: they retain a payload digest,
typed targets, actor/session/code version, reason, time and result references.

## Text And Limits

Accepted source and case I/O retain exact UTF-8 bytes, including BOM, CRLF, empty
I/O and NUL. They use byte-backed columns; internal Base64 is transport only.
Malformed Unicode and oversized values are rejected, never repaired/truncated.
Prose rejects NUL and keeps its approved UTF-8 byte bounds.

The checks enforce 128 KiB per source; 1 MiB per case input/expected answer;
three samples, 20 active cases and 16 MiB combined active I/O per version;
three witnesses per variant; 160-byte titles, 64 KiB statements and 16 KiB
hints/defect descriptions. Missing samples/hidden cases/languages/witnesses or
blank reference sources still mean an incomplete draft, not an implied pass.

The catalogue guard enforces 250 definitions/1,000 versions and at most 3 GiB
of accounted version content with conservative row overhead. Retired case data
still counts. Whole-app reservations, validation snapshots/retention and physical
disk sizing are separate required work; this counter is not the complete
approved global resource-budget subsystem.

Registered runtime manifests are immutable, hashed, language-bound records.
There is no browser installation endpoint or real runtime registration in this
batch. A record's existence is not evidence of compatible, safe execution.
Selected run limits stay within the approved language ceilings; actual profile
verification and calibration remain mandatory before validation/publication.

`ingenium-text-v1` implements the agreed comparator: TOKENS splits only on the
six ASCII separators with no numeric/case/Unicode coercion; EXACT_TEXT preserves
all whitespace/newlines. Complete invalid UTF-8 stdout cannot match. Only a
future execution adapter with reliable successful execution and complete capture
may call it; matching a clipped prefix or stderr is never acceptance.

## Protected API

All paths below have prefix `/api/v1`. Only current normal Owner/Super Admin
sessions can author or inspect private pool data. Organisers, participant cookies
and restricted clock-recovery grants cannot. Writes need the existing protected
browser, exact origin and staff-bound CSRF proof, plus trusted clock health.
Ordinary draft edits do not request sensitive publication/start authority.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/staff/content/versions?after=<UUID>` | Up to 50 safe version summaries and catalogue revision |
| GET | `/staff/content/versions/:version_id` | Metadata/counts/byte lengths; no private source, case bytes or hint text |
| POST | `/staff/content/definitions` | Create definition and draft version 1 |
| POST | `/staff/content/definitions/:definition_id/versions` | Allocate another separate draft version |
| POST | `/staff/content/versions/:version_id/:operation` | Draft edit against content revision |
| GET | `/staff/content/versions/:version_id/variants/:language` | One private variant, with a typed access audit |
| GET | `/staff/content/versions/:version_id/cases/:case_id` | One active private case, with a typed access audit |
| GET | `/staff/content/versions/:version_id/hints` or `/witnesses` | Version-owned private text/declarations, with an access audit |
| GET | `/staff/outcomes/content/:action/:target/:request_key` | Own immutable receipt; CREATE uses target `catalogue`, other actions their definition/version UUID |

Writes take exactly `request_key`, `expected_revision`, `reason` and `payload`.
Operations are `METADATA`, `VARIANT`, `CASE`, `DELETE_CASE`, `WITNESSES`, `HINT`
and `REORDER_CASES`; payload fields/bounds are enforced by `content/policy.ts`.
For creation, use the catalogue revision; new versions use the definition
revision; edits use the content revision. Edit keys are version-wide, so switching
operation cannot recycle a key. JSON field order/escaping does not change intent;
actual source/newline changes do. Case reordering requires every active case ID
exactly once. No browser-provided bounty, publication status, checker version,
judge language ID, command line, validation result or timestamp is accepted.

Staff authority is checked before parsing large content requests. At most two
large content operations are in flight, including private source/case reads.
Creation metadata has a 512 KiB encoded body bound; edit bodies allow 16 MiB
to accommodate JSON escaping of one bounded input/answer pair. Decoded field and
aggregate limits remain independent. Business refusals return immutable 409
receipts; invalid/over-limit content returns 400 without a partial write; capacity
returns 503. Recover an uncertain response by its original key.

## Verification And Remaining Gates

The subsequent [validation preparation stage](content-validation.md) freezes exact
draft revisions and plans the complete five-language checks, but still runs no
code and does not enable publication. Its snapshots also count toward the shared
3 GiB catalogue guard; version-only accounting below describes this draft batch.

Migrations `0019` through `0023` add typed content/read-audit records, narrow
locking/effect functions, same-version witness/runtime FKs, stable hint identities,
source/revision guards and deferred byte/suite checks. The API cannot directly
edit these tables or forge publication; no publish/mark-ready path is enabled.
The PostgreSQL suite tests roles, concurrency, retries, private reads, exact bytes,
case retirement/reordering, suite rollback, runtime references and body capacity.
All fixtures are synthetic, not competition questions or verified toolchains.

Still required: actual frozen validation snapshots/jobs/results, reliable private
judge integration, organiser coverage/fairness/hint review, own-code-confirmed
publication, challenge selection and arena start revalidation, whole-app resource
reservations/cleanup, the authoring UI and real-browser/deployment/load tests.
Responses explicitly report `can_publish: false`. No existing database, private
environment, cloud lab, real credential or Git history was changed for this batch.
