import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export async function backupDocker(args: string[], timeout = 30000) {
  return (
    await exec("docker", args, {
      timeout,
      maxBuffer: 1048576,
      windowsHide: true,
    })
  ).stdout.trim();
}

export async function backupFixture() {
  const tag = process.env.INGENIUM_TEST_BACKUP_IMAGE;
  assert.match(
    tag ?? "",
    /^sha256:[0-9a-f]{64}$/,
    "Supply the immutable ID of the reviewed backup test image; the harness never builds or pulls it.",
  );
  const image = JSON.parse(
    await backupDocker(["image", "inspect", tag!, "--format", "{{json .}}"]),
  ) as {
    Id: string;
    Architecture: string;
    Os: string;
    Config: { Labels: Record<string, string> };
  };
  assert.equal(image.Id, tag);
  assert.equal(image.Os, "linux");
  assert.equal(image.Architecture, "amd64");
  assert.equal(image.Config.Labels["org.ingenium.backup.postgres"], "17.11");
  assert.equal(image.Config.Labels["org.ingenium.backup.pgbackrest"], "2.59.3");
  const nonce = randomUUID(),
    volume = `ingenium-backup-test-${nonce}`,
    directory = await mkdtemp(join(tmpdir(), "ingenium-backup-test-"));
  let created = false;
  const config = (key: string) => `[global]
repo1-type=posix
repo1-path=/backup-repository
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${key}
repo1-retention-full-type=time
repo1-retention-full=14
repo1-retention-history=0
expire-auto=n
archive-async=n
archive-check=y
archive-copy=y
start-fast=y
process-max=2
log-level-console=off
log-level-stderr=error
log-level-file=off
lock-path=/tmp/pgbackrest

[ingenium]
pg1-path=/var/lib/postgresql/data
pg1-socket-path=/var/run/postgresql
pg1-user=ingenium_schema_owner
`;
  const close = async () => {
    if (created) {
      const label = await backupDocker([
        "volume",
        "inspect",
        volume,
        "--format",
        '{{index .Labels "ingenium.backup-test"}}',
      ]);
      assert.equal(label, nonce);
      await backupDocker(["volume", "rm", volume]);
      created = false;
    }
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^ingenium-backup-test-/);
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await writeFile(
      join(directory, "pgbackrest.conf"),
      config(randomBytes(32).toString("hex")),
      { mode: 0o600 },
    );
    await writeFile(
      join(directory, "wrong-key.conf"),
      config(randomBytes(32).toString("hex")),
      { mode: 0o600 },
    );
    await backupDocker([
      "volume",
      "create",
      "--label",
      `ingenium.backup-test=${nonce}`,
      volume,
    ]);
    created = true;
    await backupDocker([
      "run",
      "--rm",
      "--pull=never",
      "--network=none",
      "--user",
      "0:0",
      "--cap-drop=ALL",
      "--cap-add=CHOWN",
      "--security-opt=no-new-privileges:true",
      "--memory=64m",
      "--memory-swap=64m",
      "--cpus=0.5",
      "--pids-limit=16",
      "--read-only",
      "--mount",
      `type=volume,src=${volume},dst=/backup-repository`,
      "--entrypoint",
      "sh",
      image.Id,
      "-ec",
      "chmod 0700 /backup-repository; chown 999:999 /backup-repository",
    ]);
  } catch (error) {
    await close();
    throw error;
  }
  return {
    image: image.Id,
    nonce,
    volume,
    directory,
    close,
    mounts(readonly = false) {
      return [
        "--mount",
        `type=volume,src=${volume},dst=/backup-repository${readonly ? ",readonly" : ""}`,
        "--mount",
        `type=bind,src=${join(directory, "pgbackrest.conf")},dst=/etc/pgbackrest/pgbackrest.conf,readonly`,
        "--mount",
        `type=bind,src=${join(directory, "wrong-key.conf")},dst=/etc/pgbackrest/wrong-key.conf,readonly`,
      ];
    },
  };
}
export type BackupFixture = Awaited<ReturnType<typeof backupFixture>>;
