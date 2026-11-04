# Open-source release verification — 4 November 2026

This handoff packages the completed event project. It does not deploy software, query former event databases, stop cloud resources, start a round or alter scores.

## Preservation and publication boundary

The previous Git refs and staged/working-tree patches were backed up locally before organization. Original operational notes and participant review records remain outside the public tree. Private environment files, runtime credentials/descriptors, raw execution evidence, backups and temporary output stay ignored. The original large design and chronological implementation notes are preserved under `docs/history/`; media and participant PDFs are archived with their context.

MIT covers original project material. Existing Judge0 GPL and font OFL exceptions are retained in [third-party notices](../THIRD_PARTY_NOTICES.md). No dependency or third-party binary is silently relicensed.

## Security review

The original reachable Git history was scanned with Gitleaks 8.30.1 in redacted mode. Five matches were manually verified as synthetic test identifiers, a local lab address or published artifact SHA-256 values. Exact historical fingerprints are documented in `.gitleaksignore`; no directory-wide test/documentation exclusion was added. The reviewed history scan passes.

The proposed public files are also reviewed for private keys, service-account material, credentialed URLs, participant exports, deployment files and oversized artifacts. The remote had no deployment hooks/workflows before source-check CI was added. CI has read-only repository permissions and no deployment or infrastructure step.

## Check scope

Completed local source checks:

| Check | Result |
| --- | --- |
| Typecheck and build | Passed |
| API unit tests | 402 passed |
| Web/client unit tests | 93 passed |
| Content structure/program-renderer tests | 7 passed |
| Public frontend bundle/privacy and compression checks | 2 passed |
| Documentation checker regression | 1 passed |
| Local Markdown links | 109 files, 419 links, zero missing targets |
| npm dependency audit | Zero reported vulnerabilities |
| Indexed public-file Gitleaks scan | Passed, zero findings after exact reviewed fixture annotations |
| Staged whitespace check | Passed |

A disposable participant-batch database rerun was attempted but could not create its container because the local Docker Linux engine was unavailable. No database tests executed in that attempt. Earlier event and local-upgrade/browser results are historical evidence with their original scope. No privileged Linux qualification, live benchmark or former event database was contacted for this handoff.

The GitHub source-check workflow repeats typecheck, unit/content checks, build, bundle and documentation checks on pushes and pull requests. It does not deploy.

The 53 legacy/seven batch kernel qualifications and 15-team speed figures are historical evidence, not fresh certification. Protected Linux kernel/compiler/capsule qualification, live device/network testing and fresh cloud load/restore drills are outside this documentation handoff.

The additional twenty-question pack remains `RECHECK_REQUIRED`: its prior Windows sanitizer run lacked the UBSan linker runtime. No pass or production publication is claimed. The current event packs and immutable earlier draft archive remain distinct.
