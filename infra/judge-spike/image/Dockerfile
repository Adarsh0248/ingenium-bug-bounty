# Isolated synthetic feasibility only; upstream runtime dependencies remain old.
FROM judge0/judge0:1.13.1@sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082 AS patched-startup

WORKDIR /api
COPY --chown=0:0 --chmod=0555 entrypoint.sh /api/docker-entrypoint.sh
COPY --chown=0:0 --chmod=0555 server.sh /api/scripts/server
COPY --chown=0:0 --chmod=0555 workers.sh /api/scripts/workers
COPY --chown=0:0 --chmod=0444 LICENSE.judge0 /api/INGENIUM-STARTUP-LICENSE

USER judge0
ENTRYPOINT ["/bin/bash", "/api/docker-entrypoint.sh"]
CMD ["/api/scripts/server"]

FROM patched-startup AS worker-prep
USER 0:0
RUN chown 0:0 /var/local /var/local/lib /var/local/lib/isolate \
    && chmod 00755 /var/local /var/local/lib /var/local/lib/isolate \
    && for directory in / /var /var/local /var/local/lib /var/local/lib/isolate; do \
         printf 'Checking root:root mode 755: %s\n' "$directory"; \
         stat -c '%u:%g:%a %n' "$directory" || exit 1; \
         test ! -L "$directory" \
         && test "$(stat -c '%u:%g:%a' "$directory")" = '0:0:755' || exit 1; \
       done \
    && stat -c '%u:%g:%a %n' /usr/local/bin/isolate \
    && test "$(stat -c '%u:%g:%a' /usr/local/bin/isolate)" = '0:0:4755' \
    && printf '%s\n' 'c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3  /usr/local/bin/isolate' | sha256sum -c -
USER judge0
CMD ["/api/scripts/workers"]

# Keep the API/startup image as the default build target.
FROM patched-startup AS startup
