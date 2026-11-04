# Documentation

The event is complete. Start with [the project overview](../README.md), [status and known limits](project-status.md), [architecture](../architecture.md), [local setup](../LOCAL-APP-GUIDE.md) and [testing](testing.md). Historical deployment notes do not establish current service health or authorize restarting an event.

## Application and rules

- [Competition engine](competition-engine.md), [arena setup](arena-setup.md), [Round 2 items](round-2-items.md), [cancellation](round-cancellation.md), [results/export](results-export.md).
- [Participant UI](participant-ui.md), [workbench](workbench.md), [history](participant-history.md), [judging](participant-judging.md), [session controls](participant-session-controls.md), [replacement](participant-replacement.md).
- [Live delivery](realtime.md), [performance and reconnects](performance-and-reconnection.md), [announcements](announcements.md).
- [Staff console](staff-console.md), [access UI](staff-access-ui.md), [access operations](staff-access-operations.md), [audit](staff-audit.md), [discipline](staff-discipline.md), [judging](staff-judging.md), [submission review](submission-review.md), [question reports](question-reports.md), [team registration](team-registration.md), [operator recovery](staff-operator-recovery.md).
- [Live Round 2 additions](live-round-two-question-release.md): local-only append feature and its content restrictions.

## Content and visual design

- [Authoring](content-authoring.md), [authoring UI](content-authoring-ui.md), [validation](content-validation.md), [validation UI](content-validation-ui.md), [validation runs](validation-runs.md), [diagnostics](validation-diagnostics.md).
- [Event library](event-question-library.md), [pack review](question-pack-review.md), [Round 1 design](round-1-question-design.md), [Round 2 design](round-2-question-design.md).
- [Round 1 pack](../content/round-1/README.md), [Round 2 pack](../content/round-2/README.md), [additional 20](../content/round-2/additional-20/README.md), [original draft archive](../content/round-2/archive/README.md).
- [Arena movement](bug-movement.md), [inspection](bug-inspection.md), [neon art](neon-art-direction.md), [coin art](bounty-coins.md), [weapons](regional-weapons.md), [Round 2 arena](round-2-arena-design.md), [Ember](ember-foundry.md), [Verdant](verdant-nexus.md), [Zero-Day](zero-day-core.md).
- [Media archive](media/README.md) and [event marketing brief](event-marketing-handoff.md), which retains its original date/context.

## Infrastructure and operations

- [Deployment boundaries](production-deployment.md), [pre-deployment checks](pre-deployment-readiness.md), [HTTPS](https-edge.md), [separate judging coordinator](judging-runtime.md).
- [Judge gateway/protocol](judge-protocol.md), [executor](judge-executor.md), [supervisor](judge-supervisor.md), [host verification](judge-host-verification.md), [case batching](judge-batching-handover.md).
- [Backup/restore](backup-restore.md), [restore quarantine](restore-quarantine.md), [retention](data-retention.md), [maintenance](event-maintenance.md), [operations observer](operations-observation.md), [clock recovery](clock-recovery-ui.md).
- [Local preview](local-preview.md), [load harness](local-load.md), [historical cloud rehearsal](manual-cloud-rehearsal.md), [historical allocation](cloud-running-cost.md).
- Runtime-specific instructions live beside [app host](../infra/app-host/README.md), [clock](../infra/clock-agent/README.md), [current judge](../infra/judge-gateway/README.md) and [historical Judge0 spike](../infra/judge-spike/README.md).

## History and release

- [Engineering retrospective](history/event-retrospective.md), [release verification](release-verification.md) and [changelog](../CHANGELOG.md).
- [Original design](history/architecture-original.md), [chronological implementation log](history/implementation-log.md) and [build-status snapshots](build-status.md).
- [Round 1 publication](round1-publication-handover.md), [Round 1 incident summary](round1-infra-audit-20261030.md), [Round 2 handoff](round2-preparation-handover.md), [judging record](production-judging-20261030.md) and [earlier feasibility research](judge-feasibility.md).

The public records explain methods and aggregate results. Credentials, participant identities/programs, individual adjudication, raw backups and server-specific operational originals are not published.
