import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const dependencies = fileURLToPath(new URL('../dependencies.compose.yaml', import.meta.url));
const api = fileURLToPath(new URL('../api.compose.yaml', import.meta.url));
const parse = (files) => JSON.parse(execFileSync('docker', [
  'compose', ...files.flatMap(file => ['-f', file]),
  'config', '--no-env-resolution', '--no-path-resolution', '--format', 'json',
], { encoding: 'utf8' }));
const original = parse([dependencies]);
const merged = parse([dependencies, api]);
const service = merged.services.api;

test('adding the API preserves both dependencies and defines no worker', () => {
  assert.deepEqual(Object.keys(merged.services).sort(), ['api', 'db', 'redis']);
  assert.deepEqual(merged.services.db, original.services.db);
  assert.deepEqual(merged.services.redis, original.services.redis);
  assert.deepEqual(merged.networks, original.networks);
  assert.deepEqual(merged.volumes, original.volumes);
});

test('the API uses only the inspected local image and publishes no host port', () => {
  assert.equal(service.image, 'sha256:1e91aa8647a728487bcc7259bc87762b06306193ba13d90fa6881b13462b8a54');
  assert.equal(service.pull_policy, 'never');
  assert.equal(service.platform, 'linux/amd64');
  assert.deepEqual(service.command, ['/api/scripts/server']);
  assert.equal(service.ports, undefined);
  for (const dependency of ['db', 'redis']) assert.equal(service.depends_on[dependency].condition, 'service_healthy');
});

test('API permissions and writable paths do not permit privileged execution', () => {
  assert.equal(service.user, '1000:999');
  assert.equal(service.read_only, true);
  assert.equal(service.privileged, undefined);
  assert.deepEqual(service.cap_drop, ['ALL']);
  assert.ok(service.security_opt.includes('no-new-privileges:true'));
  assert.equal(service.environment, undefined);
  assert.equal(service.volumes.length, 1);
  assert.equal(service.volumes[0].source, '/opt/ingenium-judge-spike/judge0.conf');
  assert.equal(service.volumes[0].target, '/api/judge0.conf');
  assert.equal(service.volumes[0].read_only, true);
  assert.equal(service.volumes[0].bind.create_host_path, false);
  assert.equal(service.tmpfs.length, 2);
  for (const mount of service.tmpfs) assert.match(mount, /noexec.*uid=1000,gid=999/);
  assert.equal(service.restart, 'no');
  assert.equal(service.mem_limit, '805306368');
  assert.equal(Number(service.cpus), 0.75);
  assert.equal(service.pids_limit, 128);
  assert.deepEqual(Object.keys(service.networks), ['judge_private']);
  assert.match(service.healthcheck.test.at(-1), /TCPSocket.new\('127.0.0.1', 2358\)/);
});
