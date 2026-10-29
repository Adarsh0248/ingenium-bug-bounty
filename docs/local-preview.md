# Local admin and contestant preview

For short network interruptions, keep the tab open. See
[performance and reconnection](performance-and-reconnection.md) for retained
questions, offline edits, recovery and production caching limits.

For the separate **Round 2 Black Market preview**, run `npm.cmd run preview:round2`
and open **http://127.0.0.1:5176**. Use the team code
`AAAAAAAA`, choose a member/language and click **Black Market**.
It starts with 35,000 demo coins and all seven approved items. See the
[shop preview guide](round-2-items.md#review-the-local-shop) for controls and limitations.
This mode needs no Docker and does not modify another preview or database.

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

Round 1 starts with two synthetic teams and all **50 Protocol Rebellion missions**:
13 Neon District, 13 Silicon Hive, 12 Verdant Nexus and 12 Zero-Day Core. Each has
C, C++, Java and Python starters, real statements, two samples and three tailored
hints. JavaScript is not offered for new enrolments. Round 2 event content has not
been authored. The older four-question setup survives only in isolated regression tests.
The Super Admin can review Teams, Staff, Bug Library, Access and other control-room
views. Admin writes use the actual API, permissions, confirmations and database
rules. They are visible to contestants using this same preview on port 5175.

Question workbenches include **Report question**. Staff use **Reports** to review
the attached answer, and **Monitor → Final standings → Score corrections** after
finalising a round to add or deduct points with a note. See the
[report and correction guide](question-reports.md).

This is a **UI preview**. Its permanent preview banner identifies the synthetic
teams and disabled code execution. Its clock/readiness are simulated. Run,
Submit and authoring validation use a simulated driver, not a compiler. The
setup reads the pack's reference outputs to exercise publication and selection;
that is not evidence of production-judge validation. Put `PREVIEW_WRONG` in
submitted text to simulate a wrong answer. Arbitrary participant fixes are not
executed or checked for correctness in this preview. The normal quotas, cooldowns,
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
at port 5174, with its existing `AAAAAAAA` team code.
It uses a separate in-memory preview, so admin changes on 5175 do not affect it.
It also loads the 50 real missions by default; its judging is simulated and its
default wallet/standings are synthetic UI data. Restart either preview after
changing the server-side question pack. Never serve `content/round-1` as static
assets: it contains private references, hidden cases and unpurchased hints.
