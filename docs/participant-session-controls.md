# Participant Session Controls

These opt-in backend routes are exercised through Fastify injection and real
disposable PostgreSQL. They are not a deployed participant UI. Default local
startup still exposes health/readiness only until the protected Linux clock and
private runtime dependencies are explicitly configured and rehearsed.

## Security Time Versus Contest Time

The session has a fixed eight-hour absolute deadline and a two-hour idle
deadline. The earlier one wins; equality means expired. The safe session response
includes `expires_at`, `absolute_expires_at` and `warning_at`, five minutes before
the earlier deadline. A browser warning does not grant grace when delayed.

Only an explicit valid keep-signed-in command currently records fresh participant
activity. Polling, bootstrap, reads, response-loss recovery and duplicate command
receipts never do. Other approved gameplay/draft activity will be connected when
those features are built. Contest pauses do not extend security deadlines, and
keep-alive never changes the shared arena closing time or permits paused play.

## Commands and Receipts

Both writes require same-origin JSON, the protected participant/browser cookies,
the participant-bound CSRF token and exactly this body:

```json
{"session_id":"<the current session UUID>","request_key":"<one new UUIDv4 per deliberate action>"}
```

- `POST /api/v1/participant/keep-alive`: records a valid deliberate renewal and
  returns the current safe session plus the immutable receipt.
- `POST /api/v1/participant/logout`: revokes only the targeted grant and returns
  `signed_out: true` with its receipt. Clears participant/entry cookies, not staff
  or teammate credentials. It preserves the stable member, language and history.
- `GET /api/v1/participant/session-outcomes/:session_id/:request_key`: scoped
  original-cookie lookup returning `OBSERVED` and the receipt, or
  `NOT_OBSERVED` with `null`. Absence is not proof a separate in-flight command
  failed; reconcile/retry the same intent rather than inventing another one.

A receipt contains the exact session, request key, `KEEP_ALIVE` or `LOGOUT`,
trusted decision time and resulting security expiry. It contains no raw token,
code or encrypted capsule. Reusing a key for the other action is a conflict.
Ordinary encoded command bodies are bounded to 16 KiB with exact decoded schema
validation. Commands share the member-round 60/minute, burst-six allowance across
tabs/restarts; response reads have their separate member-read allowance.

## Lost Replies and Re-entry

Reuse the original request key after an uncertain response. A keep-alive retry
does not move its recorded activity time; outcome reads never renew authority.
The browser should warn before deliberate logout that same-round re-entry needs
staff approval. Code/name selection still cannot reset enrolment or language.

If the logout response was lost, its still-held original cookie may reconcile
only that same logout receipt while its original idle/absolute lifetime and
code/access checks remain valid. The revoked cookie cannot bootstrap a session,
renew activity, retrieve other outcomes or start another logout intent. Once the
browser receives cookie clearing it no longer holds that proof. No expired grant
is revived, and delayed requests cannot revoke a different, later session.

Staff-approved browser replacement and its fixed ten-minute approval/activation
flow are now implemented in the backend; see `participant-replacement.md`. The
deliberate first Round 2 entry exception remains separate from same-round
recovery. Real browser screens, private live-room
revocation, cleanup jobs and event load/recovery rehearsals are still required.
