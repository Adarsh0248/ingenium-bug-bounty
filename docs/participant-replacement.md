# Staff-Approved Browser Replacement

This is the protected backend flow, not a finished participant/staff interface
or public deployment. It uses the existing cookie, CSRF, clock, PostgreSQL and
encrypted-delivery components, with no new dependency or application Redis.

## One Fixed Window

After private team-code verification, select the already-enrolled registered
member and create a replacement request. Code/name selection alone never grants
that member's access. A still-valid current member-round cookie resumes first.

The request gets a separate random proof in a protected `replacement` cookie.
Its displayed UUID is only a reference. Only a verifier and a purpose-bound
encrypted redelivery capsule are stored, never a raw proof/session secret.
The ten-minute deadline starts at this request's committed creation. Approval,
polling, retries, backend restart and contest pauses never restart it.

Creation does not revoke the old browser. Staff verify the person and specific
request before approving or rejecting. Normal Organiser, Owner and Super Admin
sessions may perform this routine action; an entry proof, participant cookie or
restricted clock-recovery session cannot. A nonblank reason up to 1 KiB UTF-8 is
required, but routine replacement does not need a second own-code prompt.

## HTTP Sequence

Use the existing common code-entry flow and `ENTRY` bootstrap/CSRF context first.
All writes require same-origin JSON, their exact cookie/audience-bound CSRF token
and strict bodies. Ordinary encoded commands are bounded to 16 KiB.

| Route | Purpose |
| --- | --- |
| `POST /api/v1/entry/replacement` | `member_id`, `request_key`; creates a browser-bound request, or resumes that valid current member-round cookie. |
| `GET /api/v1/bootstrap?audience=REPLACEMENT` | Limited own request reference/state/deadline and the matching CSRF token; no roster, code, arena content or other team's state. |
| `GET /api/v1/staff/replacements` | Current normal staff queue, at most 50 rows; optional UUID `after` cursor. Shows the required team/member labels and observed slot revision, never secrets. |
| `POST /api/v1/staff/replacements/:request_id/decision` | `request_key`, `action` (`APPROVE`/`REJECT`), exact `expected_revision` from the queue, and `reason`. |
| `POST /api/v1/entry/replacement/activate` | `request_key`; redeems only the requesting browser's approved proof. There is no language field to change. |
| `POST /api/v1/entry/replacement/recover` | Empty JSON body; reconciles the same already-committed activation through the original proof. |
| `GET /api/v1/staff/outcomes/replacements/:request_key` | Current normal actor's own immutable decision receipt, or `NOT_OBSERVED`. |

The frontend must try a valid participant session first. Creating a request
returns `REQUESTED` and its limited reference, or `RESUME` with the safe current
session. A missing/lost creation response is retried using the same original
entry proof, member and request key; the same encrypted request proof is
redelivered, not regenerated. Losing both usable proofs requires fresh verified
entry/recovery, not takeover by a displayed reference.

## Approval and Activation

Approval rechecks the actor, current team credential/access, round, original
request and expected member-slot association under security/round/member locks.
It atomically records its source, revokes the observed old grant, purges its
delivery, retires competing stale requests and reserves this exact handoff.
Rejection records its source and invalidates this proof without changing the old
grant. A late/stale/blocked approval is a durable non-applying receipt.

Activation requires the unexpired approved proof and exact reservation. It
creates one new opaque session for the existing member-round and locked language,
records the activation and encrypted delivery, then consumes the reservation.
It does not change team progress, arena clocks, pauses, blocks or admitted work.
The new security session has its normal eight-hour absolute/two-hour idle limits;
these are not extra contest time.

Same-intent activation retries/redelivery return exactly the same still-current
cookie, original creation time and security deadlines. New keys do not create a
second session. Different request/activation/staff purposes cannot decrypt or
redeem each other's capsules. Reads, duplicate receipts and response recovery do
not count as participant activity. Delayed responses can still overwrite a
browser cookie; backend current-slot checks never restore that old authority.

Expiry before approval leaves the old session unchanged. Expiry after approval
does not restore it or permit activation. A fresh code-verified request can retire
an expired held reservation, but needs fresh staff approval. Logout, superseding
replacement and first Round 2 entry retire stale handoffs. First Round 2 enrolment
still permits its own new language without same-round takeover permission.

## Limits and Remaining Work

At most two unexpired outstanding requests and one approved reservation per
stable member are allowed. Replacement flows share the 1,000-live total and
eight-per-credential bounds, with their own 50,000-row retained flow family.
Session/processed-outcome ceilings remain shared; staff decision sources join
the 100,000 retained staff-outcome ceiling. Member-round commands and member/staff
reads use the existing shared quotas rather than per-process allowances.

Request/outcome identities and source associations are permanent; secret capsules
can only be purged, not replaced. Revocation/rejection/supersession purges affected
capsules in these flows. Fixed expiry denies redemption immediately even before
physical cleanup. Scheduled bounded expiry/ciphertext/quota cleanup is still
required; do not delete/reset histories, permits or database guards to clear a
request. Fresh-request retirement is not a complete cleanup worker.

Participant/staff screens, authorised live notifications, full outbox/audit
delivery, other app features, real browser/host operation and event-capacity /
recovery rehearsals remain unimplemented or unverified. Default local startup
still exposes health/readiness only without explicit protected Linux runtime
wiring. These tests do not create real event access or prove launch readiness.
