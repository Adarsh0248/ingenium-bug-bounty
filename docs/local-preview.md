# Local admin and contestant preview

Start Docker Desktop with Linux containers, then run from PowerShell:

```powershell
cd "D:\College\Ingenium\Bug bounty"
npm.cmd run preview:app
```

Open **http://127.0.0.1:5175**. The terminal prints a fresh **Super Admin code**
and two **team codes**. Enter the Super Admin code in the normal **Team or staff
code** form to open the admin control room. Keep that code for the confirmation
fields on sensitive admin actions.

For contestants, open the same URL in an incognito window or another browser
profile, enter a printed team code, select a member and language, and enter the
arena. Use separate profiles for admin and contestants because tabs in one
profile share login cookies. A third profile can represent the second teammate.
The ordinary two-member/session and language-lock rules still apply.

Round 1 starts with two teams and two published demo bugs. Round 2 demo bugs are
also published, so the normal close/finalise/qualify/setup flow can be reviewed.
The Super Admin can review Teams, Staff, Bug Library, Access and other control-room
views. Admin writes use the actual API, permissions, confirmations and database
rules. They are visible to contestants using this same preview on port 5175.

Question workbenches include **Report question**. Staff use **Reports** to review
the attached answer, and **Monitor → Final standings → Score corrections** after
finalising a round to add or deduct points with a note. See the
[report and correction guide](question-reports.md).

This is a **UI preview**. Its permanent preview banner identifies the synthetic
teams and disabled code execution. Its clock/readiness are simulated. Run,
Submit and authoring validation use canned addition-example feedback, not a
compiler. Put `PREVIEW_WRONG` anywhere in submitted text to see a wrong answer;
otherwise participant output is simulated as `12` plus a newline. It does not
check whether your program is actually correct. The normal quotas, cooldowns,
hint costs, scoring and live updates remain enabled after setup.

The preview creates its own labelled, memory-backed PostgreSQL container with
random passwords and applies migrations only there. It does not load `.env`,
modify the development database, contact the cloud judge or use real accounts.
The source lives under `apps/api/test/` and is excluded from production builds.

Keep the terminal open. **Ctrl+C** stops the server and worker and removes only
that preview's database container. Starting again creates fresh demo codes and
data; preview changes are not saved between runs. If port 5175 is occupied,
stop the existing preview in its own terminal rather than killing another app.

Changes to the React frontend appear through Vite's normal live reload. Restart
the preview for changes to its backend/setup code; that also resets its demo data.

The dedicated browser check is
`node --import tsx --test test/integration/local-preview.test.ts` from `apps/api`.
It exercises normal staff/team code entry, admin-to-contestant live pause/resume,
simulated submission feedback, role separation and removal of its own database.

The lighter `npm.cmd run preview:participant` remains available independently
at port 5174, with its existing `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` team code.
It uses a separate in-memory preview, so admin changes on 5175 do not affect it.
