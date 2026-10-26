# Staff Access and Browser Replacement Screens

For interactive local review with demo staff and teams, follow the
[local preview guide](local-preview.md). The full preview runs on port 5175;
the separate participant-only preview remains on port 5174.

This slice extends the normal authenticated control room. It does not provision
real people, migrate the development database, install a production runtime or
change the approved architecture.

## Staff View

Only a current normal Super Admin can open Staff. The paginated list shows safe
identity, role, enabled-state and code-version metadata. Super Admin rows have no
browser management controls; first/additional Super Admin provisioning and
exceptional recovery remain protected operator work.

- Add an Owner or Organiser using the observed security revision.
- Edit a name, Owner/Organiser role or enabled state using the identity's observed
  revision. Changes revoke that identity's existing grants and entry proofs.
  Re-enabling allows fresh code entry, never revival of an old browser session.
- Rotate a code deliberately using a new reviewed command. Historical identities
  are retained rather than deleted.
- Every management command requires an audit reason and the acting Super Admin's
  own current code. A failed confirmation is a specific 403 refusal, not a 401
  session-expiry response. Actual invalid/revoked sessions still clear the UI.

Newly issued codes appear once in a masked modal. Reveal and explicit Copy are
available; clipboard denial leaves the code available for manual private copying.
Closing clears the modal. Codes are not written to URLs, browser storage or logs.
If the response containing a code is lost, receipt recovery confirms the identity
without reissuing the secret. A deliberate reviewed rotation is then available;
recovery never repeats the create/rotate POST.

## Access View

All current normal staff roles can review browser-replacement requests. Entries
show the team/member, exact request reference, fixed deadline, state and observed
slot revision. The requesting participant also sees that reference and deadline.
Staff should verify the person and exact reference before approving.

Approve/Reject uses an audit reason and target confirmation, without an extra
own-code requirement for this routine support action. Approval revokes the old
member session and reserves only the requesting browser's handoff. It does not
extend the original ten-minute window or change the member's language, progress,
pauses or judging allowances. Rejection leaves the old session unchanged.

The queue has bounded cursor pagination, manual refresh and a fifteen-second
refresh while visible. Expired rows cannot be operated by the browser; the server
rechecks the actual deadline and authority. Live staff-session checks still gate
commands. Full replacement/security event delivery remains separate work.

## Shared Safety

Unsent edits keep the revision they were opened against. Concurrent changes are
rejected rather than silently rebased; cancel/discard and reopen to review a new
revision. Pending/uncertain commands, unsent edits and a displayed one-time code
block control-room navigation/sign-out. The page warns before unloading them.

An uncertain command retains its original receipt reference and permits GET-only
recovery. Routine replacement receipts use their existing `receipt` envelope;
competition/staff management retain their `outcome` envelopes. No write replay,
new permission endpoint, database migration or dependency was introduced.

Cold browser session discovery now rejects a missing audience cookie before
calling optional services. Bootstrap ingress throttling still runs, but it does
not require an uninstalled recovery service merely to discover that no recovery
credential exists. Actual recovery authority still requires its own guard; this
is not a recovery bypass or a healthy-clock replacement.

## Verification and Remaining Work

`npm.cmd run test:browser:db` extends the real React/Fastify/Socket.IO/disposable
PostgreSQL workflow with cold browser entry, failed own-code confirmation,
one-time code handling and denied clipboard, normal sign-in using an issued code,
role/deactivation revocation, re-enable, stale edits and lost-code recovery. It
also checks Organiser replacement approval with a lost response, once-only receipt
recovery, actual participant restoration with the original locked language, and
rejection preserving the old member grant. No actual registration or live staff
credentials are used. Screenshots exclude one-time code modals.

The completed batch passed 232 API plus ten web client tests, all 225 backend
integration checks, all twelve participant browser scenarios and the four-check
real-backend browser suite above. Type checks, both builds and the production
bundle boundary check passed. Desktop/mobile staff screenshots were inspected;
large lazy editor/3D chunk warnings remain and this is not capacity certification.

The participant preview remains synthetic and does not expose a staff backend.
Normal server startup still needs reviewed runtime wiring. Registration/import,
team code management, blocks/discipline, bug authoring/review, complete security
audit/recovery UI, scheduled retention, real judge installation, deployment and
event load/backup/restore rehearsal remain required. This is not event readiness.
