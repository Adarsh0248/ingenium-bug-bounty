# Performance and brief connection losses

Keep the current tab open during an outage. Loaded code remains in memory and
eligible questions remain editable. The last eight opened briefs, fetched samples
and purchased hints can be reopened, up to 4 MiB total. The existing eight-dirty-
draft/1 MiB buffer limit and 128 KiB per-draft save limit remain unchanged.

The save indicator says **offline**, rather than claiming the draft is saved.
New Run, Submit, hint and shop actions wait for a verified connection. Browser
network restoration starts a fresh live sync immediately. Current access and
draft revisions are checked before saving edits; competing revisions still need
review. Unknown actions retain their original receipt identity: reconnect never
creates another submission, purchase or score award. Revocation and session
expiry clear the private workspace.

This is temporary tab memory, with no localStorage, sessionStorage, IndexedDB or
private service-worker cache. Closing, refreshing or crashing the tab while
offline loses unsaved memory. Unopened or evicted questions need a connection.
Timers, claims and official receipt priority still follow the server; offline
editing cannot backdate a submission. Organisers can pause the round for a
prolonged campus outage using the existing controls.

## Downloads and rendering

- The production build writes Brotli and gzip copies of public JavaScript, CSS,
  HTML and SVG files. Caddy chooses the browser-supported format. Compression
  happens once at build time, rather than on each participant request.
- Hashed public assets keep their one-year immutable cache. The coin SVG gets a
  one-day cache and normal ETag revalidation. HTML, API responses, errors,
  credentials, private source and question responses remain `no-store`.
- The edge still rejects compressed request bodies and never retries a POST.
- Entry scenery no longer loads the 3D arena. Round 2 waits for its verified
  round before choosing its renderer, avoiding an unused Round 1 download.
- Round 1 creates its WebGL context on the first region visit. Visited creature
  models retain limb/wing phases as well as position; inactive districts are
  hidden and paused. The world overview pauses the renderer. Pixel ratio is
  capped at one and the drawing buffer is not retained.
- A text editor works immediately while the enhanced editor downloads. Starting
  to type keeps that editor selected, preserving focus and code.
- Opened immutable statements and fetched samples are reused from tab memory.
  Access, hint ownership and draft metadata refresh after reconnect.

## Validation and practical limits

Run `npm.cmd run build`, `npm.cmd test` and the web `test:bundle` command. Bundle
checks decompress both formats and compare exact bytes. The HTTPS integration
suite checks real Caddy negotiation and cache policy. `resilience.spec.ts` covers
offline editing/reopening, samples/hints, draft recovery without repeated actions,
revocation, slow editor loading, focus retention and renderer avoidance.

The initial production measurement was 4.82 MB of public text, transferring about
1.14 MB with Brotli (roughly 76% less). These include optional chunks that are not
all downloaded at entry. Development/Vite previews do not use the production
edge's compression settings. Actual older laptops and the campus LAN still need
a rehearsal; emulated outages do not certify that hardware.

One local Chromium run against the real built app and Caddy transferred about
160 KB of public startup assets for entry and the Round 2 arena. A normal reload
transferred zero additional bytes for its twelve cached public assets. HTML and
authorised API traffic still went to the server. The actual enhanced editor and
its worker also loaded successfully under the production content-security policy.

References: [Caddy precompressed files](https://caddyserver.com/docs/caddyfile/directives/file_server)
and [HTTP cache controls](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).


## 29 October emulated-device rehearsal

At 1280×720 with 4× CPU throttling, warmed Round 1 districts measured about
21–30 FPS (the slowest frame-time p95 was about 84 ms); Round 2 measured about
58 FPS with a p95 around 17 ms. The network profile used 150-ms latency,
128-KB/s downloads and 32-KB/s uploads after the page loaded, then a full outage.
Both rounds retained edited drafts and recovered without replaying Run/Submit.
The browser reports are `readiness-device-regions-20261029.json` and
`readiness-device-r2-20261029.json` under `apps/api/test-results/`.

This is Chromium emulation on the development computer, not a measurement of a
four-GB laptop, integrated GPU or the campus network. Round 1 has not demonstrated
a steady 30 FPS in every district under this profile. Shader startup is excluded
from the warmed sampling window; it must not be described as a sustained-rate
improvement. The real hardware/network rehearsal remains open.
