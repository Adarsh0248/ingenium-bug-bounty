#!/usr/bin/env bash
set -euo pipefail
test "$(hostname)" = ingenium-judge-spike-01
cd -- "$(dirname -- "$0")/../../.."
root="$(pwd -P)"
test -f apps/api/dist/maintenance/operations-cli.js
test -f infra/postgres/01-api-role.sql
nonce="$(cat /proc/sys/kernel/random/uuid)"
pg="ingenium-ops-pg-$nonce"
node="ingenium-ops-node-$nonce"
pg_image='postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
node_image='node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df'
timeout 180 sudo docker pull "$pg_image"
timeout 180 sudo docker pull "$node_image"
password="$(openssl rand -hex 24)"
api_password="$(openssl rand -hex 24)"
export POSTGRES_PASSWORD="$password" POSTGRES_API_PASSWORD="$api_password"
sudo --preserve-env=POSTGRES_PASSWORD,POSTGRES_API_PASSWORD docker create --name "$pg" --label "ingenium.operations-rehearsal=$nonce" \
  --restart no --network none --read-only --user 999:999 --cap-drop ALL --security-opt no-new-privileges=true \
  --memory 768m --memory-swap 768m --cpus 1 --pids-limit 128 \
  --env POSTGRES_USER=ingenium_schema_owner --env POSTGRES_DB=ingenium_ops_rehearsal --env POSTGRES_PASSWORD --env POSTGRES_API_PASSWORD \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700 \
  --mount "type=bind,src=$root/infra/postgres/01-api-role.sql,dst=/docker-entrypoint-initdb.d/01-api-role.sql,readonly" \
  --log-opt max-size=1m --log-opt max-file=1 "$pg_image" postgres -c listen_addresses=127.0.0.1
sudo docker start "$pg"
ready=false
for attempt in {1..60}; do
  if sudo docker exec "$pg" pg_isready -h 127.0.0.1 -U ingenium_schema_owner -d ingenium_ops_rehearsal >/dev/null; then ready=true; break; fi
  sleep 1
done
test "$ready" = true
sudo docker create --interactive --name "$node" --label "ingenium.operations-rehearsal=$nonce" \
  --restart no --network "container:$pg" --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID \
  --security-opt no-new-privileges=true --memory 384m --memory-swap 384m --cpus 0.75 --pids-limit 48 \
  --tmpfs /run:rw,nosuid,nodev,noexec,size=4m,mode=0755 \
  --mount "type=bind,src=$root/apps/api,dst=/workspace/apps/api,readonly" \
  --mount "type=bind,src=$root/node_modules,dst=/workspace/node_modules,readonly" \
  --mount "type=bind,src=$root/infra/maintenance/test/operations-linux.mjs,dst=/fixture/test.mjs,readonly" \
  --log-opt max-size=1m --log-opt max-file=1 --entrypoint /usr/local/bin/node "$node_image" /fixture/test.mjs
printf '{"owner":"postgresql://ingenium_schema_owner:%s@127.0.0.1:5432/ingenium_ops_rehearsal","api":"postgresql://ingenium_api:%s@127.0.0.1:5432/ingenium_ops_rehearsal"}' "$password" "$api_password" \
  | timeout 150 sudo docker start --attach --interactive "$node"
unset password api_password POSTGRES_PASSWORD POSTGRES_API_PASSWORD
test "$(sudo docker inspect "$node" --format '{{.State.ExitCode}}')" = 0
for container in "$node" "$pg"; do
  test "$(sudo docker inspect "$container" --format '{{index .Config.Labels "ingenium.operations-rehearsal"}}')" = "$nonce"
  sudo docker stop --time 5 "$container" >/dev/null
  sudo docker rm "$container" >/dev/null
done
printf '%s\n' 'PASS: isolated cloud CLI rehearsal completed; only its labelled temporary containers removed; original lab untouched.'
