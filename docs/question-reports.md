# Question reports and final score corrections

Each question's workbench has **Report question**. A participant describes the
problem and selects one of their team's official submissions, or reports a
statement/UI problem without an answer. Submitted code is attached by its exact
submission identity and hash; later editor changes cannot replace it. Both
members share one ticket per question, and can see its status and decision note.
Sample runs and other teams' answers cannot be attached.

Owners and Super Admins use **Reports** in the control room. They can inspect
the report, open its submitted answer through the existing audited private-review
screen, and **Uphold report** or **Dismiss report** with their own code and a
required note. A report decision does not automatically alter a verdict or score.
Open reports keep their attached source available past normal payload retention
until a decision is recorded. Source and private judge output remain restricted
to the existing private-review permissions.

After a round is finalised (`CLOSED`), **Monitor → Final standings → Score
corrections → Adjust points** accepts a signed whole-number delta: `+175` adds
175 points, `-100` deducts 100. Each correction requires the operator's current
code and a reason visible in results. An upheld ticket can be linked optionally.
Corrections can be made without a ticket, as requested by the organiser.

Every correction is append-only, records the operator and time, and recalculates
rank using the existing time/difficulty tie-breaks. Negative totals are allowed.
Undo mistakes with an opposite correction and another note. Corrections do not
edit wallets, solve times, awards or the judge's verdict. In Round 2 they cannot
take another team's already claimed bug. They are refused while a round is
running, paused, closing or cancelled.

The frozen automatic result stays intact. Live standings, participant history and
downloaded final CSV/JSON use the corrected score and rank; export result version
and digest change with corrections. The separate paginated correction history
shows each note in the staff control room and participant **Results & history →
Standings**. Staff Audit includes report decisions and final-score corrections.

Round 1 corrections made before qualification affect qualification. Once the
roster has been locked, later corrections update displayed standings but do not
rewrite that roster or Round 2 wallet carryovers.

Report, decision and adjustment writes use one request key. If a response is
lost, **Check original …** retrieves its original receipt without posting the
command again. A final correction also carries the revision loaded when its form
opens, so a competing correction must be reviewed before submitting another one.

The feature adds migration `0077_question_reports`. Development verification uses
only disposable databases; the actual development/event database has not been
migrated. Restart `npm.cmd run preview:app` to create a fresh local demo with the
new tables and backend routes. Restarting resets preview accounts and data.

Verification commands from the repository root:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:INGENIUM_TEST_SUITE = 'reports'
npm.cmd run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

The dedicated full-preview browser test also covers attachment, private source
review, ticket decision, positive and negative corrections, and recovery from
lost report/decision/correction responses without duplicate POSTs.
