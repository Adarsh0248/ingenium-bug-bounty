import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../image/Dockerfile', import.meta.url), 'utf8');
const [startup, worker] = dockerfile.split('FROM patched-startup AS worker-prep');

test('worker preparation reuses the pinned startup stage and leaves it as the default', () => {
  assert.deepEqual(dockerfile.match(/^FROM .+$/gm), [
    'FROM judge0/judge0:1.13.1@sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082 AS patched-startup',
    'FROM patched-startup AS worker-prep',
    'FROM patched-startup AS startup',
  ]);
  assert.doesNotMatch(startup, /^RUN /m);
  assert.match(startup, /CMD \["\/api\/scripts\/server"\]/);
  assert.ok(dockerfile.trimEnd().endsWith('FROM patched-startup AS startup'));
});

test('only the worker stage hardens the three fixed sandbox ancestors', () => {
  assert.match(worker, /^USER 0:0\nRUN chown 0:0 \/var\/local \/var\/local\/lib \/var\/local\/lib\/isolate \\/m);
  assert.match(worker, /&& chmod 00755 \/var\/local \/var\/local\/lib \/var\/local\/lib\/isolate \\/);
  assert.doesNotMatch(worker, /(?:chown|chmod)\s+-R|apt-get|curl|wget|privileged/);
  assert.match(worker, /USER judge0\nCMD \["\/api\/scripts\/workers"\]/);
});

test('the build checks root ownership, modes, symlinks and the observed helper fingerprint', () => {
  assert.ok(worker.includes('for directory in / /var /var/local /var/local/lib /var/local/lib/isolate; do'));
  assert.ok(worker.includes('test ! -L "$directory"'));
  assert.ok(worker.includes("stat -c '%u:%g:%a %n' \"$directory\" || exit 1;"));
  assert.ok(worker.includes('test "$(stat -c \'%u:%g:%a\' "$directory")" = \'0:0:755\' || exit 1;'));
  assert.ok(worker.includes('test "$(stat -c \'%u:%g:%a\' /usr/local/bin/isolate)" = \'0:0:4755\''));
  assert.ok(worker.includes('c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3  /usr/local/bin/isolate'));
  assert.ok(worker.includes('| sha256sum -c -'));
  assert.doesNotMatch(worker, /--init|--run|resque/);
});
