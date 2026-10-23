# Arena Announcements

The protected staff console now has an **Announcements** tab for the selected
arena. Organisers, Owners and Super Admins can send plain-text messages to the
whole event, one round, or one selected team. A normal current staff session is
required; this routine action does not ask for the staff code again.

## Sending and Reading

1. Select the arena, open Announcements, and choose the audience.
2. For a round or private team message, select the exact target.
3. Enter the message and a separate staff reason, then review the audience/text
   and confirm the send. The staff reason is never included in participant views.
4. Participants receive a new-message marker beside the bell without refreshing.
   Opening it shows the inbox; selecting a message opens a focused reader. The
   code editor stays mounted and its private buffer is not discarded.

The inbox loads at most 40 metadata records per page. Text is read separately by
message ID, rendered as text, and never interpreted as HTML. Messages are limited
to 4 KiB of UTF-8 and staff reasons to 1 KiB, including multibyte characters.
Live updates and normal snapshots contain no message text or staff reason.

Communication remains available during a technical pause. Only the current
nonterminal arena accepts new messages. Completed/discarded arenas are read-only;
their authorised staff history remains accessible. A draft can still be discarded
if the arena becomes read-only while the composer is open.

## Privacy and Delivery

- Participant scope is derived from the current member session, not a supplied
  team, member, arena or round ID. Event messages belong to that arena instance;
  round messages belong only to the session's round; private messages belong
  only to its team. Round two retains event/own-team messages, not round-one-only
  messages. Another arena's messages cannot become visible through a new session.
- Committed sends create source-linked live effects in the same transaction.
  Private notices go only to that team's streams plus the staff operations stream;
  they do not advance another team's stream heads or notification revision.
- A bounded visible-message count is the snapshot's notification revision. It
  also changes for messages sharing an identical timestamp. It is not a read
  receipt, an unseen-message count, or a message-body delivery channel.
- Live projection updates invalidate the open inbox; non-overlapping five-second
  reads provide a fallback. Every read rechecks the current session and grants.
  Reads/background delivery do not renew participant or staff activity. Only a
  fresh applied send counts as staff activity.

## Uncertain Sends and Audit

A send keeps one original intent key. If its response is lost, **Check original
send** reads that key's actor-bound receipt using GET. It never reposts the
message. An unknown send blocks further sends/navigation; a definitely unprocessed
request can be corrected and deliberately sent again. Reusing an observed key
with changed text/audience/reason is refused.

Messages and send receipts are immutable. The general Owner/Super Admin Audit
tab adds an Announcements category with actor, audience/target, staff reason and
outcome, but no message body. The existing shared staff-history cap and ordinary
live-delivery budget apply. Capacity refusal rolls back the message and its
delivery together; it cannot consume the reserved technical-control budget.

Migration `0067_announcements` adds storage, authority/lifecycle guards, source
binding and atomic scoped deliveries. It has only been applied to disposable
synthetic test databases, not the project/event database.

## Verification

From the repository root, the focused disposable database/browser suite is:

```powershell
$env:INGENIUM_TEST_SUITE = 'announcements-browser'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

It covers current staff roles, once-only sends, GET recovery, conflicting intents,
team-private bodies/metadata/cursors/heads, equal-time notifications, strict HTTP
scope/CSRF/transport bounds, immutable records, capacity rollback, paused
communication, no read activity renewal, revocation, round-two visibility and
closed-arena refusal. Real Chromium checks verify private live notification,
open-inbox updates, loss of a committed POST response, hostile plain text,
desktop/mobile layout and preservation of the participant's editor.

These checks do not establish production delivery latency, event-load capacity,
installed-host readiness, retention/archive completion or deployment readiness.
