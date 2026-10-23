FROM postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest=2.59.3-1.pgdg12+1 \
    && test "$(pgbackrest version)" = 'pgBackRest 2.59.3' \
    && postgres --version | grep -F 'PostgreSQL) 17.11 ' \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -m 0755 -o 0 -g 0 /etc/ingenium-backup

COPY --chown=0:0 --chmod=0444 postgresql.conf /etc/ingenium-backup/postgresql.conf
LABEL org.ingenium.backup.postgres="17.11" org.ingenium.backup.pgbackrest="2.59.3"
