# Ingenium Bug Bounty

A gamified debugging competition built for Tecnoesis / Ingenium. Teams repair supplied buggy programs, earn coins, buy hints and compete on a live arena map. This is a programming contest, not a penetration-testing or paid vulnerability-bounty service.

**The competition has finished.** This repository preserves the application, question packs, infrastructure tooling and engineering lessons as an open-source project. It does not provide a hosted competition or certify a new deployment.

## What is included

- Two-member teams, per-round language selection, staff roles and a control room.
- Round 1 independent team progress and Round 2 shared question races.
- A code editor, autosaved drafts, sample runs, official judging and durable results.
- Team wallets, progressive paid hints, seven Round 2 items and protected claims.
- Live updates, reconnect recovery, announcements, reports and CSV/JSON results.
- A separate Linux judge with private TLS, frozen execution inputs, compile-once case batches and physical cleanup accounting.
- 50 Round 1 missions and 100 easier Round 2 missions in C, C++, Java and Python. Original harder drafts and a separate 20-question selection are preserved for study.

The original event challenge answers, hints and hidden tests are now public in `content/`. Prepare fresh unpublished content before reusing the application for a competitive event.

## Try it locally

Use **Node 24.22.0** and **npm 11.19.1**, as declared by the repository. After cloning:

```sh
git clone https://github.com/Adarsh0248/ingenium-bug-bounty.git
cd ingenium-bug-bounty
npm ci
npm run preview:participant
```

Open **http://127.0.0.1:5174**, enter the synthetic team code **AAAAAAAA**, then choose a member and language. This preview runs without Docker and simulates judging; it does not compile entered programs.

For admin and participants sharing the real API rules in a disposable local database, start Docker with Linux containers and run:

```sh
npm run preview:app
```

Open the printed URL, normally **http://127.0.0.1:5175**. The terminal prints fresh synthetic staff/team codes. Use separate browser profiles for staff and participants. Stop with Ctrl+C and allow cleanup to finish.

On Windows PowerShell, use `npm.cmd` when `npm.ps1` is blocked. The [local app guide](LOCAL-APP-GUIDE.md) covers development databases, migrations, startup and troubleshooting. Neither preview installs a real judge.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web/` | React/Vite UI, editor, arenas, staff console and browser tests |
| `apps/api/` | Fastify API, access rules, live delivery, competition logic, judge/coordinator code and tests |
| `apps/api/drizzle/` | Ordered application database migrations; never rewrite applied history |
| `content/` | Organiser-authored tasks, private-at-runtime answers/hints, generators and local checks |
| `infra/` | PostgreSQL roles, HTTPS edge, clock, backup, current judge and historical spike tools |
| `scripts/` | Local setup, release packaging and explicit import/publication tools |
| `docs/` | Guides, design, testing, event retrospective and historical records |
| `docs/media/`, `output/pdf/` | Archived event media and participant guides |

Local credentials, participant records, backups and runtime evidence are excluded from Git. Generated output belongs in ignored `build/` or `test-results/` directories.

## Understand and verify

Start with the [architecture](architecture.md), [documentation index](docs/README.md), [project status](docs/project-status.md) and [testing guide](docs/testing.md).

```sh
npm run typecheck
npm test
npm run content:programs:test
npm run build
npm run test:bundle --workspace @ingenium/web
npm run docs:check
```

Database/browser and protected Linux judge suites require additional infrastructure. Source checks and simulated execution results are distinct from actual kernel/compiler qualification. See [the testing matrix](docs/testing.md).

## Event results and limits

The final recorded 15-team compiler benchmark with 16 execution slots measured **15.683 s median** and **22.254 s peak** for official eight-case jobs; sample judging took **12.920 s**. The under-10-second peak target was not achieved. These were real compiler/kernel runs with synthetic fixture clock/publication and in-process admission, not a campus-network latency guarantee. See the [event retrospective](docs/history/event-retrospective.md).

The optional append-only live Round 2 release feature was built and checked locally, with 20 additions per release and a total of 120. The separate archived selection has difficulty 25–50; it was not published by this work. [Project status](docs/project-status.md) distinguishes event deployment, local-only work and remaining limits.

## Contribute and operate responsibly

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the [deployment guide](docs/production-deployment.md). Code execution requires a separately qualified Linux host, new credentials, reviewed boundaries and fresh reliability checks. Do not reuse former event endpoints or deployment receipts.

Original project material is available under [MIT](LICENSE), with [third-party license exceptions](THIRD_PARTY_NOTICES.md). Event branding does not imply endorsement of a fork.
