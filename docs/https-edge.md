# Same-Origin HTTPS Edge

The browser-facing gateway is now implemented and tested locally with real
Caddy 2.11.7, the built frontend, Fastify, WebSockets and disposable PostgreSQL.
This is not a deployed event server, a public certificate or judge readiness.
No real runtime secret, database, cloud resource or system service was changed.

## How It Connects

```text
Browser -> HTTPS Caddy -> built public frontend
                     -> /api/* -> loopback Fastify -> competition PostgreSQL
                     -> /api/v1/live/socket -> the same Fastify live service
```

Caddy is the front desk: it accepts the public connection and passes API calls
to the application through a local-only door. Participants use one HTTPS origin,
not separate frontend/backend URLs. Their browser handles the secure cookies;
the proxy does not create identities, issue commands or make scoring decisions.
The judge remains a separate private, mutually authenticated connection made by
the app worker. No judge or database port is exposed by this configuration.

## Files and Required Settings

- `infra/app-edge/Caddyfile`: public HTTPS site, without a local admin API or
  persisted configuration copy.
- `global.caddy`: five-second headers, fifteen-second incoming upload deadline,
  sixteen-KiB headers, sixty-second idle timeout, strict TLS host matching and
  HTTP/1.1 plus HTTP/2. HTTP/3/UDP is not enabled in this initial template.
- `site.caddy`: static assets, protected API/live proxy, response policy and
  bounded generic errors. No proxy retries or reusable upstream connections.

The operator supplies these **non-secret** settings through the future protected
service launcher, not a checked-in `.env`:

| Setting | Required value |
| --- | --- |
| `INGENIUM_HOST` | Approved event DNS hostname only, without scheme or path |
| `INGENIUM_WEB_ROOT` | Absolute path to the reviewed `apps/web/dist` release copy |
| `INGENIUM_API_PORT` | The loopback API port; defaults to `3000` |

Keep the release directory read-only to the gateway and app service accounts.
Copy only the reviewed build's regular files, never a repository, uploads,
private runtime files, symlinks or a writable directory. Caddy's file server
is not a filesystem sandbox. Certificate/key storage belongs to the gateway
service only; its cloud identity does not need the competition or judge secrets.

The API's private entry runtime must select `production` and exactly the same
`https://hostname` origin. Its normal server entry point then requires the fixed
same-host proxy header. Development loopback mode remains unchanged.
Do not put a CDN, another proxy or a load balancer in front without reviewing
the address boundary; their forwarded headers are intentionally not trusted.
Keep the API bound to loopback. Separate container bridges do not magically
share `127.0.0.1`; the eventual host/service deployment must preserve this layout.

When protected entry is enabled, startup additionally checks the connected
PostgreSQL identity before creating the clock/entry runtime. It must be the
restricted API role, not an owner, superuser or judging-worker member, and must
not have direct writes to credentials, awards, wallets, official submissions or
frozen results. Connection URLs require loopback/password credentials without
query/fragment overrides. The server refuses startup rather than downgrading to
an insecure event mode. This is a role preflight, not installation, credential
rotation or proof that the host itself is trusted.

For a future authorised Linux installation, validate before starting the service:

```sh
caddy validate --config /opt/ingenium/release/infra/app-edge/Caddyfile --adapter caddyfile
```

This is an operator step after the service environment, release and certificate
storage are provisioned. Nothing in this batch installs, reloads or starts a
production Caddy service, opens a firewall or requests a public certificate.

## Security and Delivery Rules

- API requests retain their original path, method, body, Origin and cookies.
  Existing JSON byte limits, Origin/CSRF, authority and quotas still apply.
  Incoming compressed API requests are refused. The absolute edge body ceiling
  is sixteen MiB; this does not enlarge any application's route limit.
- Caddy overwrites `X-Ingenium-Client-IP` with the TCP peer's address and strips
  client-supplied `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host` and
  `X-Forwarded-Proto` headers. Both HTTP quotas/code verification
  and WebSocket handshake/authentication use the same checked helper. Proxy mode
  accepts one valid unscoped IP from an exact loopback peer only, never a chain,
  private subnet, forwarded host or browser-selected value. A trusted local
  process can reach this door; untrusted programs must never run on the app VM.
- Production cookies retain `__Host-`, Secure, HttpOnly, SameSite=Strict and no
  Domain. The TLS proxy does not weaken the existing cookie or CSRF rules.
- Entry HTML, all API responses, errors and missing assets use `no-store`.
  Only existing hash-named public build assets receive one-year immutable cache
  headers. A missing JavaScript file returns 404, never HTML or a cached fallback.
  The current application has one root page, so unknown paths are 404 rather
  than an unneeded catch-all SPA rewrite.
- The document policy permits same-origin scripts, connections and editor
  workers, not runtime CDNs or `unsafe-eval`; framing is denied. Inline styles
  remain allowed for the existing UI/editor. The API retains its stricter policy.
- Public `/ready`, `/health`, `/metrics`, admin paths, dotfiles and arbitrary
  source paths are not served. Caddy's admin listener is off. Private API routes
  still require their own authority; a path name is not an access control.
- HTTP upload deadlines do not terminate established WebSockets. Normal Socket.IO
  heartbeats and original reconnect/replay rules remain separate.
- A lost upstream POST yields a generic non-cacheable gateway failure and is not
  replayed. The client retains the original key and recovers through its existing
  outcome GET; a gateway error does not prove that a command never committed.
- Raw request/access/proxy logs are disabled, including potentially private URLs
  and headers. Source-free transport monitoring, alerts and the approved seven-day
  log lifecycle still need production wiring; disabling logs is not monitoring.

The configuration follows the official [proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[server options](https://caddyserver.com/docs/caddyfile/options),
[body limit](https://caddyserver.com/docs/caddyfile/directives/request_body) and
[static file](https://caddyserver.com/docs/caddyfile/directives/file_server)
documentation. Public DNS/certificate/redirect renewal must still be rehearsed
on the actual host; local fixture certificates do not establish that gate.

## Repeat the Local Test

First build the application, then supply an explicitly verified Caddy 2.11.7
executable. The harness never downloads a binary, reads `.env`, trusts a public
certificate, modifies the OS trust store or contacts a production database.
Its Caddy/Fastify listeners and PostgreSQL port are disposable loopback services.

```powershell
npm run build
$env:INGENIUM_TEST_CADDY='ABSOLUTE_PATH_TO_VERIFIED_CADDY_EXECUTABLE'
$env:INGENIUM_TEST_SUITE='https'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
Remove-Item Env:INGENIUM_TEST_CADDY
```

The test uses the actual shared edge configuration, production assets and
production cookie names. Node verifies a fresh local certificate chain and
hostname. Chromium ignores only that disposable CA's trust failure; no trust is
installed. The editor test exercises its configured self-hosted worker factory,
since rendering C++ alone need not start a language worker. It checks real
WebSocket updates, private draft persistence, CSP violations and desktop/mobile
screenshots. A separate socket-loss fixture checks that a POST reaches the
upstream once; it is not a route in the real application.

The first Windows test artifact was the official release archive
`caddy_2.11.7_windows_amd64.zip`, SHA256
`0a1edc0b799512051c57071ce0e798d3f2cf67dc98171366f1d2b326072e3b06`,
verified against the official release metadata before extraction. Production
Linux binaries/images still need their own provenance/security review and pins.

Verified: seven focused TLS/database/browser checks, 281 unit/client tests,
twenty existing live-state checks and the four-check full both-round/staff browser
regression. Builds/typechecks, the bundle boundary check and new-code formatting
pass; the desktop/mobile screenshots were inspected. The full global matrix and
actual Linux/public-host installation were not run.

## Still Required Before Public Use

Actual Linux service accounts/clock ownership, pinned Compose/systemd releases,
public DNS/TLS renewal, private database/worker/judge networking, full proxy/host
connection ceilings, resource and slow-client/load tests, monitoring/alerts,
off-host encrypted backup/restore, real judge installation/retirement and the
remaining event gates are unfinished. There is no DDoS or 100-team capacity
claim. Automatic HTTPS does not make an unfinished host ready for competition.
