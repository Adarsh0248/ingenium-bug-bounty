# Bug Library and Draft Editor

The normal Owner/Super Admin control room now includes **Library**. Organisers
cannot open this view or read the private content API. Restricted recovery grants
do not gain normal authoring authority.

## Connected Flow

1. Open Library and choose an existing version or New bug. Creation chooses its
   round, title, statement, difficulty and checker. The server derives the bounty;
   the browser never supplies one.
2. Details edits metadata. Languages edits each of C, C++, Java, Python and console
   JavaScript: starter, reference, private defect description and optional runtime
   settings. A runtime key must already be registered for that language; this
   screen cannot install a runtime or assert that it is safe/ready.
3. Test cases supports sample/hidden input and expected output, position, movement
   and retirement. Stable case IDs remain the targets of starter declarations.
   The backend refuses retirement of a referenced case. The editor keeps that
   rejection visible instead of removing declarations automatically.
4. Starter failures edits up to three declarations per language, with case/result
   selections and compiled-language-only compilation failures. Duplicate targets
   are refused locally and independently by the backend. Empty draft declarations
   are allowed but cannot satisfy preparation.
5. Hints edits each of the three private hint texts independently. Purchasing,
   hint prices and participant visibility remain owned by the existing economy.
6. Validation shows saved counts and can prepare an exact immutable snapshot.
   Missing-content issues identify languages, cases and hint levels. Successful
   preparation exposes the exact fingerprint, revision and frozen check plan.
   **Preparation does not execute code, pass validation or publish a bug.**

New version allocates a separate version with metadata, not a clone of private
sources/cases/hints. Published versions are locked; existing private sections can
be inspected, not saved over. A new draft is required for changes.

## Saves and Private Bytes

The flow is React editor -> existing protected staff HTTP -> PostgreSQL draft
command/receipt. A save carries its observed revision and an audit reason. The
server remains authoritative for content bounds, case references, roles and
immutable outcomes; no new backend write route, schema or permission was added.

Only one section is edited at once. Unsent edits, pending imports, loading private
content and uncertain writes block parent navigation; unsaved edits require an
explicit discard and browser unload warns. Stale saves retain the original local
text/revision. Cancel and reopen to deliberately read the current server version.
No automatic refresh merges or overwrites an open edit.

Every submitted command has one request key. A lost reply blocks further commands
and offers GET-only Check original receipt. Recovery does not resubmit private
bytes. This in-memory guard warns before unload; forcing a reload can still discard
the local editor and pending recovery identity. Private payloads are not put in
browser storage, URLs, ordinary receipts or application logs.

Source and case fields have bounded UTF-8 file imports and byte-exact downloads.
Imports preserve BOM, CRLF, empty data and allowed NUL bytes; invalid UTF-8 and
oversized files are refused without replacing the existing field. Prose rejects
NUL. Ordinary typing/pasting uses the browser's text editing behavior, including
its newline normalization; import files when exact original bytes matter. Loading
and saving an unchanged imported field does not normalize its retained payload.
While a file is being read, confirmation cannot race ahead of the imported data.

Two maximum-size case fields can expand beyond 8 MiB when JSON escapes control
characters. The browser allows at most 16 MiB only for the exact private staff case
GET route; all other reads and command replies retain their existing 8 MiB bound.
Decoded server-side case/suite limits are unchanged.

## Verification

The disposable real React/Fastify/Socket.IO/PostgreSQL browser flow creates a draft,
recovers one lost creation response with a counted single POST, rejects a stale
metadata save while retaining local text, edits all five variants, checks exact
file bytes/downloads and invalid imports, reorders cases, refuses referenced-case
retirement, saves starter declarations/hints and prepares a fifteen-check snapshot.
It also checks blank new-version children, published read-only inspection,
Organiser exclusion and desktop/mobile layout. Synthetic runtime records are test
fixtures, not installed compiler certification. Existing participant and staff
browser flows remain part of this test run.

Pure client tests cover malformed Unicode, byte limits, exact UTF-8 file decoding
and the narrowly increased case-read bound. Normal API startup remains
health/readiness-only until reviewed protected runtime wiring is installed.
The participant preview is still a synthetic participant-only server, not a staff
backend or a deployable judge.

This batch passed 245 unit/client tests, 225 backend checks, twelve participant
browser scenarios, the four-check real-backend browser suite, type checks, both
production builds and the production bundle boundary check. Desktop/mobile
screenshots were inspected. Tests cleaned up their disposable services and left
the existing participant preview unchanged.

## Next Gates

The subsequent [validation and review view](content-validation-ui.md) now connects
run admission/progress/history and own-code-confirmed publication. Preparation
summaries still explicitly deny execution/publication authority; preparation alone
does not replace those gates. Detailed diagnostic evidence/audit navigation and real runtime
installation, genuine judge readiness, worker/maintenance wiring, whole-app
resource/retention controls, HTTPS deployment, backup restore and event-load tests
also remain required. No architecture, development data, cloud lab, secrets or
Git history were modified.
