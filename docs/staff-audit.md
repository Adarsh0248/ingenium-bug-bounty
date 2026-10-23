# Staff Audit History

The Owner/Super Admin control room has an Audit tab. It browses existing
immutable command receipts and access records; it does not create a second
event ledger or infer actions from live notifications. It works for the selected
historical/current arena and for global authoring/registration records.

## Included Records

Seventeen fixed categories cover round controls (including recovery and
cancellation commands), arena setup, discipline, member replacements, team/code
management, registration imports, content changes/private reads, validation
preparation/snapshot reads/run requests/report reads, publication reviews,
restricted submission reviews, validation diagnostics, timing clearances and
normal staff management. Account-management records are Super-Admin-only.
Owners and Super Admins can browse the other categories; Organisers and
participants cannot use this general private history endpoint.

Routine sign-in/keepalive telemetry and operator-only bootstrap/recovery files
are not moved into the normal panel. The latter retain their separate operator
authority. This view does not add announcements or any new command that has not
yet been implemented. Existing per-feature private views remain responsible for
deliberate source/diagnostic access and original-command receipt recovery.

Each item includes the original record ID, actor ID/current display name,
recorded decision time, action/outcome/refusal category, bounded reason or review
notes, target ID and applicable arena/round IDs. Original IDs survive revocation;
display names describe the current identity, not a fabricated historical name.
Read records without a stored reason are labelled Not required, not given an
invented investigation purpose.

No raw code/credential/verifier, request key, delivery ciphertext, CSV rows,
source, hint/test text, private diagnostic output, provider evidence or arbitrary
before/after JSON is projected. Operator recovery tables receive no new grant.
Staff-written names/reasons remain untrusted text and render without HTML.

## Reads and Paging

`GET /api/v1/staff/audit?family=ROUND&arena_id=UUID&after=UUID` uses the existing
protected staff cookie, normal-session authority, clock guard and shared read
quota. `family` is a fixed allowlist. `arena_id` is optional for the arena-bound
families (round controls/setup, discipline, replacements and submission reviews)
and invalid for global categories. Omitting it means all arenas, not only the
currently active one. Unknown arenas, malformed/extra/duplicate query fields,
cross-category/arena cursors and unavailable authority are refused.

Pages contain at most 40 records, ordered by descending `(recorded_at, id)`.
The next cursor is the last returned original UUID and must exist inside the
same authorised category/arena scope. Newer inserts do not shift subsequent
pages or require offset scans. Refresh returns to the first page. Selected-arena
scope follows the control room's historical instance selection.

The UI polls metadata every five seconds without overlapping requests, offers
previous/next/refresh controls and a full-record dialog, and discards an old
response after scope/category/access changes. A response with a different scope
is not displayed. Read failure clears the rows/dialog; restored access fetches
fresh data instead of reopening an old dialog. No private data is stored in
browser storage. Long reasons are compact in the table and wrap in the dialog.

Reads never renew staff idle/absolute expiry, mutate receipts or clocks, expire
validations, release held execution, change scores/wallets or replay a command.
The shared security guard rechecks current authority in the read transaction.
Responses are bounded/no-store; HEAD and write routes are not enabled.

## Database and Verification

`0066_staff_audit_navigation.sql` is an index-only migration. It adds ordered
paging indexes to the existing source tables, with participant receipts excluded
from the round-control index. It rewrites no canonical rows and adds no database
privileges. Review/apply it through the normal deliberate migration process;
only disposable synthetic databases have been migrated by the assistant.

Focused tests use real PostgreSQL/HTTP/React/Chromium and synthetic competition
fixtures. They exercise all projections, exact field privacy, issued-code
exclusion, role denials, identical-timestamp paging, late inserts, historical
arena scope, participant-receipt exclusion, immutable read state, clock refusal,
strict queries, stale/wrong-scope responses, hostile reason text, revocation and
desktop/mobile rendering. Index availability is checked, not claimed as an
event-sized performance benchmark. Real hosting, complete global regression,
retention/archive, backup restore and realistic load remain launch gates.
