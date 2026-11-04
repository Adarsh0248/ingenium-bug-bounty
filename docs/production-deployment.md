# Deployment guide and historical boundary

The competition has finished. This public guide omits actual host addresses, account/project identifiers, access-code delivery locations and root-only receipts. Historical operational originals are retained privately. Do not use former event endpoints or replay prior installation controllers.

## Components

Deploy the HTTPS edge, web build and restricted API separately from the private judge gateway/supervisor. Application PostgreSQL must not expose owner credentials to the API. Judge PostgreSQL/Redis, frozen runtime images, protected filesystems, private TLS and physical slot limits belong to the judge trust domain.

Use [app-host definitions](../infra/app-host/README.md), [HTTPS edge](https-edge.md), [clock agent](../infra/clock-agent/README.md), [gateway](../infra/judge-gateway/README.md), [host verification](judge-host-verification.md), [backup/restore](backup-restore.md) and [retention](data-retention.md). Example files contain placeholders only. Generate new credentials, certificate identities and host proofs for a fork.

## Before admitting programs

1. Build from a reviewed commit/lockfile; verify the release inventory and separate service/database users.
2. Apply application and native database migrations to their respective databases with the correct owner. Back up and test upgrades; never reset existing execution or scoring history.
3. Install and qualify the actual Linux storage, namespaces, cgroups, AppArmor and frozen toolchain manifests. A mock/TLS pass alone is insufficient.
4. Configure trusted time and private pinned mutual TLS. Untrusted clocks, stale leases or unavailable physical cleanup must refuse new admission.
5. Validate/publish the exact question snapshots, check browser-content boundaries, and perform capacity, disconnect and recovery checks using isolated synthetic teams.
6. Install private backups/monitoring and rehearse a restore into quarantine. Verify staff/participant flows without starting a competition unintentionally.

`npm run build:release` creates an offline candidate; it does not install credentials, qualify a judge, publish content or deploy. Historical event receipts apply only to their captured release/host identity. The latest repository also contains local-only migration 0094; read [project status](project-status.md) before assuming deployment parity.
