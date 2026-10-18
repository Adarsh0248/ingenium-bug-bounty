import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const file = fileURLToPath(new URL('../dependencies.compose.yaml', import.meta.url));
const config = JSON.parse(execFileSync('docker', [
  'compose', '-f', file, 'config', '--no-env-resolution', '--no-path-resolution', '--format', 'json',
], { encoding: 'utf8' }));

test('dependencies contain no judge, worker or published service', () => {
  assert.deepEqual(Object.keys(config.services).sort(), ['db', 'redis']);
  assert.equal(config.name, 'ingenium-judge-spike');
  assert.equal(config.networks.judge_private.internal, true);
  for (const service of Object.values(config.services)) {
    assert.equal(service.ports, undefined);
    assert.equal(service.privileged, undefined);
    assert.equal(service.network_mode, undefined);
    assert.deepEqual(Object.keys(service.networks), ['judge_private']);
  }
});

test('exact amd64 images and bounded non-root services are selected', () => {
  assert.equal(config.services.db.image, 'postgres:16.15-bookworm@sha256:ec9f656f17c8b4dfebf49e58cf5c46d493d4846d4ea6d8b85d0637f68ee33bfc');
  assert.equal(config.services.redis.image, 'redis:7.2.16-bookworm@sha256:6510e071eecd994fb187c15f126d424a293006669f590da800ca4a06564ae7d0');
  for (const service of Object.values(config.services)) {
    assert.equal(service.platform, 'linux/amd64');
    assert.equal(service.user, '999:999');
    assert.equal(service.read_only, true);
    assert.deepEqual(service.cap_drop, ['ALL']);
    assert.ok(service.security_opt.includes('no-new-privileges:true'));
    assert.equal(service.restart, 'no');
    assert.ok(Number(service.cpus) > 0 && Number(service.cpus) <= 0.5);
    assert.equal(service.mem_limit, '536870912');
    assert.ok(service.pids_limit > 0 && service.pids_limit <= 128);
    assert.equal(service.logging.options['max-file'], '2');
  }
});

test('only private script mounts and separate persistent data volumes are used', () => {
  for (const service of Object.values(config.services)) {
    for (const volume of service.volumes) {
      if (volume.type === 'bind') {
        assert.ok(volume.source.startsWith('/opt/ingenium-judge-spike/dependencies/'));
        assert.equal(volume.read_only, true);
        assert.equal(volume.bind.create_host_path, false);
      } else {
        assert.equal(volume.type, 'volume');
        assert.ok(['postgres_data', 'redis_data'].includes(volume.source));
      }
    }
    for (const mount of service.tmpfs) assert.match(mount, /noexec.*uid=999,gid=999/);
  }
});

test('passwords use files and each service receives only its own secrets', () => {
  const database = config.services.db;
  assert.equal(database.environment.POSTGRES_USER, 'postgres');
  assert.equal(database.environment.POSTGRES_PASSWORD, undefined);
  assert.equal(database.environment.POSTGRES_PASSWORD_FILE, '/run/secrets/postgres_bootstrap_password');
  assert.equal(database.environment.POSTGRES_HOST_AUTH_METHOD, 'scram-sha-256');
  assert.deepEqual(database.secrets.map(item => item.source).sort(), ['postgres_bootstrap_password', 'postgres_password']);
  assert.deepEqual(config.services.redis.secrets.map(item => item.source), ['redis_password']);
  for (const secret of Object.values(config.secrets)) assert.ok(secret.file.startsWith('/opt/ingenium-judge-spike/dependencies/'));
});

test('health checks require authenticated responses', () => {
  const database = config.services.db.healthcheck.test.join(' ');
  const redis = config.services.redis.healthcheck.test.join(' ');
  assert.match(database, /PGPASSWORD=.*postgres_password/);
  assert.match(database, /-U judge0 -d judge0/);
  assert.match(database, /grep -qx 1/);
  assert.match(redis, /REDISCLI_AUTH=.*redis_password/);
  assert.match(redis, /grep -qx PONG/);
});
