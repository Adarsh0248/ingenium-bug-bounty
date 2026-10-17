# Ingenium Bug Bounty

A gamified bug-fixing competition platform for Ingenium, the college technical festival module.

## Status

Planning and repository setup. The application and cloud deployment are not implemented yet.

## Initial Competition Scope

- Coding languages: C, C++, Java, Python, and console JavaScript.
- Submissions: complete programs using the specified standard input/output format.
- Run: published samples only, no penalties/rewards, and up to two queued/running Runs per member.
- Official Submit: one queued/running submission per team per bug; different bugs may be submitted without waiting.
- Judging queue: 3:1 official/sample dispatch when both have work, with fair turns between teams; worker limits need load testing.
- Function-only submissions are a planned future extension, not initial support.
- HTML/CSS/React challenges are excluded; React remains the planned platform frontend.

## Planned Stack

- Frontend: React, TypeScript, and Vite.
- Interactive arena: Three.js through React Three Fiber.
- Backend: Node.js, Fastify, and Socket.IO.
- Application database: PostgreSQL.
- Code judging: self-hosted Judge0 on a separate, isolated server.

Architecture decisions will be documented in `architecture.md` as the project develops.

## Sensitive Data

Keep credentials, real team access codes, and private event data out of Git. Use local environment files or the ignored `secrets/` and `runtime-data/` directories instead.
