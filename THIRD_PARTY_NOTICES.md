# Third-party notices

The root MIT license covers original project code, challenge content and documentation. Existing third-party notices and licenses take precedence for their respective components. Event names and logos do not imply endorsement of a derivative event.

| Component | Location / source | License and handling |
| --- | --- | --- |
| Silkscreen font | `apps/web/public/fonts/Silkscreen-Regular.ttf` | SIL Open Font License 1.1; full notice retained alongside the font in `OFL-Silkscreen.txt`. |
| Judge0 1.13.1 startup adaptations | `infra/judge-spike/image/entrypoint.sh`, `server.sh`, `workers.sh`; [upstream](https://github.com/judge0/judge0/tree/v1.13.1) | GPL-3.0; full text retained at `infra/judge-spike/image/LICENSE.judge0`. These files are not relicensed under MIT. The spike is historical research, not the current judge service. |
| Judge0 association-schema translation | `infra/judge-gateway/provider-schema.sql`; [upstream schema](https://github.com/judge0/judge0/blob/v1.13.1/db/schema.rb) | Retain the upstream GPL-3.0 attribution and the referenced full license when distributing this translation. |
| Application dependencies | `package.json`, workspace manifests and `package-lock.json` | Dependencies keep their own licenses; installation and redistribution must preserve their notices. Dependencies are not vendored or relicensed here. |
| Container images and compiler toolchains | Digest-pinned definitions under `infra/` | Images, PostgreSQL, Redis, Node, Java, GCC and other tools remain separately licensed. No third-party image or compiler binaries are included in this source release. |

The archived promotional video and participant PDFs document the finished event. They are not evidence of current hosting, prizes, runtime safety or benchmark performance. Font licensing remains applicable to embedded fonts. Check branding and audio rights before reusing event media in a new campaign.
