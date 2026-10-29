# Event question library

The agreed private Protocol Rebellion packs contain 50 Round 1 questions and
100 Round 2 questions. Every question includes its statement, buggy starter and
private reference in C, C++, Java and Python, sample/hidden cases, three hints,
and a hidden failure witness per language. Round 1 retains its five-times bounty
multiplier; Round 2 retains its existing rewards.

In the staff console, open **Questions → Round 1** or **Questions → Round 2**.
The tabs show separate question counts and reset pagination when switching.
Manual creation defaults to the chosen round. When opened from an arena, the
library defaults to that arena's round. The arena question picker continues to
accept only published questions matching its round; it never mixes the packs.

## Private import

`scripts/import-event-questions.mjs` loads the two reviewed local packs through
the authenticated, CSRF-protected production content API. It accepts `--origin`,
`--code-file` (an absolute private staff-code file) and `--receipt` (an absolute
private progress file). It does not put pack contents into the public frontend,
retain login cookies, print credentials or use the schema-owner account.

Each question imports atomically through the existing authoring guards. The
stable source question ID and content digest identify its committed receipt;
repeating the same import does not create another question, even from another
staff account. Reusing a source ID for different content is rejected. Existing
questions, registrations, credentials and arena selections are not overwritten.

Progress records the pending question before sending. A lost response is
reconciled against its original receipt before continuing; no automatic write
retry follows an uncertain result. Explicit rate-limit refusals wait and retry
the same intent. Keep a failed import's progress file for reconciliation.

Importing signs into the supplied staff account and replaces its previous
browser session under the existing single-session policy. The tool signs out
when finished; staff can then sign in normally with their existing code.

## Publication boundary

The import creates complete **drafts**, with runtime configuration left unset.
It does not fabricate a runtime manifest, validation verdict, snapshot approval
or publication. Wire the actual production judge and four runtime profiles,
then validate and publish through the existing protected workflow. Drafts are
visible to staff for review but cannot be selected as runnable arena questions.

Round 2 also retains its separately authored Probe/Hex Scanner data in the
private source pack. Its 400 paid-clue bindings must be installed against the
actual immutable validation snapshots using the existing shop-intel process
after runtime configuration/preparation; draft import is not that publication.

The disposable `event-import` suite checks all 150 actual missions, their 600
variants, 450 hints and 600 witnesses, complete rollback after a late import
failure, duplicate/conflicting imports, private HTTP responses/CSRF, and browser
round separation across both Round 2 pages. It does not qualify production
judging or event capacity.
