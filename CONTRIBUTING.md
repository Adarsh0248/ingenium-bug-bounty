# Contributing

Read the [project overview](README.md), [architecture](architecture.md) and [documentation index](docs/README.md) first. This is a completed competition project; contribution work happens locally or in disposable test infrastructure, not against the former event deployment.

## Development

Use the Node version in `.node-version` and the npm version declared in `package.json`. Run `npm ci`, then `npm run preview:participant` for a database-free UI preview. See [the local app guide](LOCAL-APP-GUIDE.md) for the full local preview and protected-runtime differences. On PowerShell use `npm.cmd` if script execution policy blocks `npm.ps1`.

Create a branch from `main`. Keep changes focused and reuse the existing API, database command and UI patterns. Include a regression check for changes to authorization, receipt recovery, money, timing, judging, migrations or nontrivial logic.

```sh
npm run typecheck
npm test
npm run content:programs:test
npm run build
```

For database changes, run the relevant disposable suite, for example:

```powershell
$env:INGENIUM_TEST_SUITE='competition'
npm.cmd run test:db:schema
```

The suite requires Docker with Linux containers and its pinned PostgreSQL image. [Testing](docs/testing.md) describes browser and Linux judge checks. Passing a mocked protocol test does not certify actual sandbox isolation or speed.

## Boundaries to preserve

- Never send participant code to the web server process for execution. The judge has its own service, users, credentials and private transport.
- Preserve immutable source, receipt and verdict identity. Uncertain transport must recover the original request rather than replaying a program or creating a new permit.
- Financial effects must remain transactionally linked and idempotent. Never directly update a score or wallet to make a test pass.
- Add migrations; do not rewrite already-applied SQL or its journal entry. Test upgrades with existing records and the restricted database roles.
- Keep authoring packs, solutions and hidden cases out of the browser build. The repository is now public: use new unpublished questions for a future competitive event.
- Do not commit `.env` files, credentials, participant exports/source, actual deployment descriptors, backups or runtime evidence. Use synthetic fixtures and placeholder examples.

## Pull requests

Explain the concrete behavior change, why it is needed, which checks passed and any remaining limitations. Update the relevant guide and changelog when behavior changes. Screenshots help with visible changes; use synthetic data.

Contributions to original project material are accepted under the root MIT license. Preserve third-party license headers and exceptions in [the notices](THIRD_PARTY_NOTICES.md). Report security issues privately using [SECURITY.md](SECURITY.md).
