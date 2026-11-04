# Add questions to a running Round 2

Local feature only. Nothing has been deployed or added to the live event.

In **Round questions**, normal staff can select up to 20 additional, validated and published Round 2 questions. **Review and release** shows the titles, difficulty and bounty before confirmation. The total is capped at 120.

Questions are appended in the selection order. The original question IDs/numbers, submissions, claims, hints, wallet entries and awards are retained. The round start, duration and end time do not change. Existing selected questions cannot be removed or replaced.

The release uses one database transaction, a round revision check and a durable receipt. Concurrent releases cannot overwrite each other; a stale selection must be reviewed again. Recovering a lost reply returns the original question IDs instead of adding duplicates. The existing round-wide live update makes additions visible to all teams, including clients reconnecting after the release.

## Content preparation

This feature releases approved content; it does not create the extra 20 questions. Unpublished drafts, other-round questions, questions already on the board, and multiple versions of the same question are refused together without a partial release.

The existing guard against authoring validation during an active competition remains in place. Extra questions must already have completed validation and publication. If the extra content exists only as drafts, preparing it during the current event needs a separately reviewed workflow; this feature does not bypass that restriction.

## Local verification

Completed: typecheck/build passed, 402 API and 93 web unit tests passed, and the isolated PostgreSQL/browser suite passed (3/3 tests). The upgrade from 94 to 95 migrations preserved an already-running 100-question round and its original financial records/outcomes.

- `npm run typecheck`
- `npm run build`
- `npm test`
- PowerShell: `$env:INGENIUM_TEST_SUITE='live-questions-browser'; npm run test:db:schema`

The integration suite creates its own local PostgreSQL container and uses synthetic execution observations. It checks the staff review/confirmation flow, 100-to-120 release, concurrent commands, retry identity, invalid selections, unchanged timer/original records, team live notifications, ordinary judging/awards for original and added questions, finalisation and repeat migration. It is not a production deployment or a judge-speed benchmark.

Deployment would require migration `0094_live_round_two_questions`, the matching API/web build and a separately approved live rollout. No deployment is authorised by the current request.
