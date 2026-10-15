# Ingenium Bug Bounty

A gamified bug-fixing competition platform for Ingenium, the college technical festival module.

## Status

Planning and repository setup. The application and cloud deployment are not implemented yet.

## Planned Stack

- Frontend: React, TypeScript, and Vite.
- Interactive arena: Three.js through React Three Fiber.
- Backend: Node.js, Fastify, and Socket.IO.
- Application database: PostgreSQL.
- Code judging: self-hosted Judge0 on a separate, isolated server.

Architecture decisions will be documented in `architecture.md` as the project develops.

## Sensitive Data

Keep credentials, real team access codes, and private event data out of Git. Use local environment files or the ignored `secrets/` and `runtime-data/` directories instead.
