import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { createClient } from "@redis/client";

const IMAGE = "redis:7.2.16-bookworm@sha256:6510e071eecd994fb187c15f126d424a293006669f590da800ca4a06564ae7d0";
const exec = promisify(execFile);
async function docker(args: string[]) { return (await exec("docker", args, { timeout: 30000, maxBuffer: 32768, windowsHide: true })).stdout.trim(); }

export async function createTestRedis() {
  const nonce = randomUUID(), directory = await mkdtemp(join(tmpdir(), "ingenium-test-redis-"));
  const password = randomBytes(32).toString("hex"); let container: string | undefined;
  const clients: { isOpen: boolean; destroy(): void }[] = [];
  async function close() {
    for (const client of clients) if (client.isOpen) client.destroy();
    if (container) {
      const identity = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
      assert.equal(identity.Image, IMAGE); assert.equal(identity.Labels["ingenium.redis-test"], nonce);
      await docker(["stop", "--time", "5", container]); await docker(["rm", container]); container = undefined;
    }
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.match(basename(directory), /^ingenium-test-redis-/);
    await rm(directory, { recursive: true, force: true });
  }
  try {
    // Disposable credentials and volatile storage; never connect this helper to an existing Redis.
    const config = join(directory, "redis.conf");
    await writeFile(config, `bind 0.0.0.0\nprotected-mode yes\nrequirepass ${password}\nsave ""\nappendonly no\nmaxmemory 32mb\nmaxmemory-policy noeviction\nmaxclients 32\nloglevel warning\n`);
    container = await docker(["create", "--pull=never", "--name", `ingenium-redis-test-${nonce}`, "--label", `ingenium.redis-test=${nonce}`,
      "--restart", "no", "--read-only", "--user", "999:999", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
      "--memory", "96m", "--memory-swap", "96m", "--cpus", "0.5", "--pids-limit", "32", "--publish", "127.0.0.1::6379",
      "--mount", `type=bind,src=${config},dst=/run/redis.conf,readonly`, "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
      "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", IMAGE, "redis-server", "/run/redis.conf"]);
    assert.match(container, /^[a-f0-9]{64}$/); await docker(["start", container]);
    const portText = await docker(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "6379/tcp") 0).HostPort}}', container]);
    assert.match(portText, /^[1-9]\d{0,4}$/); let port = Number(portText);
    const settings = { address: "127.0.0.1", port, password };
    async function connect() {
      const client = createClient({ RESP: 2, password, socket: { host: "127.0.0.1", port, reconnectStrategy: false, connectTimeout: 500 }, disableClientInfo: true, maintNotifications: "disabled" });
      client.on("error", () => {}); clients.push(client); await client.connect(); return client;
    }
    async function ready() {
      for (let i = 0; i < 30; i++) { try { return await connect(); } catch { await setTimeout(100); } }
      throw new Error("Disposable Redis did not start.");
    }
    return { settings, control: await ready(), close,
      async restart() {
        for (const client of clients) if (client.isOpen) client.destroy();
        await docker(["restart", "--time", "5", container!]);
        const current = await docker(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "6379/tcp") 0).HostPort}}', container!]);
        assert.match(current, /^[1-9]\d{0,4}$/); settings.port = port = Number(current);
        this.control = await ready();
      } };
  } catch (error) { await close(); throw error; }
}
