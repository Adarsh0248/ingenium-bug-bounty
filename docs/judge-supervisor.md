# Continuous Judge Supervisor

The separate supervisor connects the existing protected launcher, durable judge
registry and private Redis queue. `npm run start:judge-supervisor` runs only this
service; ordinary app/API startup cannot execute source. No installer or migration
is run at startup. This service has not been installed on the event judge host.

`npm run start:judge-gateway` separately starts the existing mutually
authenticated HTTPS ingress under an unprivileged OS account. It reads
`JUDGE_GATEWAY_RUNTIME_FILE` through the restricted private-file loader, verifies
the actual Linux boot and restricted gateway database role, and binds only the
configured private address and unprivileged port. Its
[example](../infra/judge-gateway/gateway-runtime.example.json) also contains invalid
placeholders. Only the configured worker address and pinned client certificate
are admitted. The gateway cannot renew readiness, claim execution or seal results;
an unavailable supervisor leaves admission blocked.

## Verification And Work

1. Load one bounded, root-owned private runtime file from
   `JUDGE_SUPERVISOR_RUNTIME_FILE`. The
   [example](../infra/judge-gateway/supervisor-runtime.example.json) contains
   invalid placeholders, never working credentials. It binds the actual epoch,
   Linux boot, all five frozen runtimes, fixed launcher hash, separate restricted
   supervisor/publisher logins and private queue. Secrets never enter logs.
   Actual credentials belong in the protected host file outside the checkout;
   never replace the repository's example placeholders with live secrets.
2. Hold an exclusive database session lock for this epoch. Refuse another
   supervisor and withdraw an old readiness lease before checking this process.
   The dedicated session is never pooled/reconnected while ownership is held.
3. Challenge the fixed, verified open launcher inode and validate its exact
   nonce, epoch, boot, runtime set and proof digest. Only that response supplies
   the readiness heartbeat. Observe within five seconds and renew independently
   every five seconds, including while execution workers are busy.
4. Publish/reconcile the durable outbox and run eight independent execution
   workers, each with its own queue connection and protected executor client.
   Empty queues do not repeatedly launch an expensive host preflight. The
   reviewed `007_eight_slots.sql` database ceiling of eight undrained permits
   remains authoritative. Nine distinct queue clients and a separate readiness
   executor are required; the two-worker form remains only for retained test
   fixtures. Do not enable extra permits in a retained lab to make a test pass.
   Execution/recovery host processes use Linux nice level 10 so fresh readiness
   observations retain scheduling priority. A failure to set that priority
   refuses the operation; no file, kernel, peer or deadline check is skipped.
   Full-host retirement inspections run under an exclusive PostgreSQL session
   lock. This orders the expensive scans while eight code executions remain
   independent. Each scan retains its five-second bound and every task, FD,
   mount, namespace and cgroup check. The original connection is destroyed on
   completion/failure; a lost session aborts the inspection and cannot supply a
   cleanup proof. The lock neither changes a permit nor supplies drain authority.
   The host retains the exact capsule pid/mount/network/IPC namespace handles,
   verified against native namespace inodes, storage and close-on-exec flags.
   The capsule waits for their durable, attempt-bound acknowledgement before
   exiting. This prevents Linux reusing its temporary-filesystem device IDs
   while retirement is pending. The full census exempts only these four verified
   handles in their owning host process; all other references still block it.
   The authority closes the handles before issuing any cleanup proof. A crashed
   host does not transfer them or authorise another launch.
   Proc metadata syscalls run directly in this isolated CLI, with explicit
   cancellation yields every 64 descriptors and 16 tasks. The observer still
   inspects every task's namespaces, mounts, memberships and descriptors, with
   the same byte/count limits. It never runs in the
   public API event loop.
   Only that bounded reference observation temporarily uses normal scheduling
   priority. Its previous priority is restored and verified on both success and
   failure; inability to set or restore it refuses the operation. The five-second
   inspection/readiness bounds and eighty-second host-command deadline remain
   unchanged. A ten-second inspection experiment did not fix the larger load
   failure and was reverted.
5. Inspect the bounded source-free inventory of consumed undrained attempts.
   Restart recovery only requests RECOVER with the original owner/token; it
   never POSTs again, transfers a permit, starts old source or invents cleanup.
   Currently active jobs are skipped and unresolved reads are spaced apart.
6. A readiness, queue, database or worker fault stops every new dispatch.
   Shutdown withdraws readiness on the original locked session, aborts transport
   and waits for the loops before closing owned connections. Killing transport
   does not release a physical slot. If the lock session is lost, the service
   cannot reconnect to withdraw its replacement's lease; its old lease expires.

Migration `006_supervisor_service.sql` belongs only to the separate general judge
database after `001` through `005`. It provides narrow session-bound heartbeat /
withdrawal and source-free held-attempt functions. Gateway and publisher roles
cannot call them. It neither resets permits nor edits results, proof history or
the application's Drizzle schema. It must not be applied to historical lab data.

## Evidence And Remaining Gates

The fixed connection pools are four for the supervisor (including its locked
session), two for the gateway and one for the publisher. Eight execution
processes and one readiness process can each use their own connection. This
keeps sixteen service/launcher connections within the twenty-connection test
server, with PostgreSQL's three reserved slots and one further slot. The pool
limits do not reduce the eight physical execution permits. A failed readiness
test exposed the earlier pool over-allocation; original failed records remain
held. Rehearsals use these same production pool limits.

The application's separate Drizzle schema defaults to two development slots.
Migrations 0075/0076 permit the qualified eight-slot event roster without
weakening physical-hold accounting. The schema owner's
`infra/app-host/event-capacity.sql` adds only missing slots; it never resets
an attempt or revision. The deferred checks reject partial rosters and a ninth
slot. The 100-team compiler rehearsal exposed the old two-slot-only guard;
the original failed runs and admitted receipts remain preserved.

Protected-process failures retain at most 4 KiB of private diagnostic bytes in
the internal error cause, while the public error message remains generic. Root
failure output contains only the generic refusal and bounded internal stack
locations, without participant input or output. The private rehearsal controller
can retain these locations to distinguish inspection, process and protocol
failures; they are not a participant API response or an execution result.

Disposable PostgreSQL/Redis tests exercise singleton exclusion, role refusal,
lost-session replacement safety, automatic publication, two concurrent workers,
readiness renewal during busy work and read-only restart recovery. Execution
responses and host proofs in these orchestration tests are explicitly synthetic.
Separate Linux tests check private-file ownership, non-root/startup refusal and
the real fixed-launcher pipe with a hardcoded protocol fixture.

The production full-host verifier/retirement composition, loaded-policy observer
and image verifier are now implemented; see the
[clean-host verification plan](judge-host-verification.md). The private clean
verification VM now passes actual five-language executions, kernel/daemon/policy
checks and normal physical retirement. The user prioritised the remaining checks,
so the two-worker endurance run stopped after 52 complete batches / 312 jobs /
82.6 minutes with all accepted records drained; it is not a five-hour PASS.
The subsequent real two-round application flow and installed active-crash /
explicit-retirement test pass. The uncertain crash result remains held without
an invented verdict, while its original physical resources were removed.
The user deferred the 100-team compiler test on 26 October after its failures.
That is a waiver of this further test, not evidence of reliable maximum capacity:
the sustained-load worker fault remains unresolved. Keep the two-slot development
default; the eight-slot configuration script does not certify safe event load.
Full five-hour endurance also remains unverified.
The event services are not deployed. This scheduler cannot substitute
for the remaining evidence. Do not supply
a test proof, point it at an old lab controller or manually heartbeat a host to
make the event available.
