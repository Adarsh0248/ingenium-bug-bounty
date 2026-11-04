# Security

This source release is a completed event project, not a managed or continuously certified code-execution service. A future deployment needs fresh host qualification, new credentials, current dependency review and its own capacity/recovery checks. Historical receipts do not establish current readiness.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** form when available. If private reporting is unavailable, open an issue asking for a private reporting channel, without exploit details, keys, participant data or source. Do not test against any former event address or third-party infrastructure.

Include affected commit/version, a minimal local reproduction using synthetic inputs, expected/observed behavior and impact. For execution-boundary problems, include the relevant kernel/runtime assumptions without publishing live configuration. There is no guaranteed response window or paid vulnerability bounty.

## Configuration and data

Environment examples intentionally use placeholders. Generate separate application, migration-owner, maintenance and judge credentials. Private TLS material, worker descriptors, service-account files, entry codes, exports, backups and runtime directories must stay outside Git. The local previews use simulated judging and are not production defaults.

The web/API and judge are separate trust domains. Do not expose judge ingress publicly, grant the API schema-owner privileges, disable host proofs, reset consumed launch permits, skip physical cleanup checks or convert unknown outcomes into accepted verdicts.

Review [the architecture](architecture.md), [host verification](docs/judge-host-verification.md), [backup/restore](docs/backup-restore.md) and [retention](docs/data-retention.md) before operating a fork.
