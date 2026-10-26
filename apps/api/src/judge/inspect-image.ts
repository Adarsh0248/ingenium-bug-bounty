import { uuid } from "../access/credentials.js";
import type { DockerCommand } from "./docker-capsule.js";
import { checkedImageTree } from "./image-stream.js";

const fail = (): never => { throw new Error("Original image inspection uncertain; preserve its intent and container."); };
export async function observeDockerImage(command: DockerCommand, exportTree: (id: string, signal: AbortSignal) => Promise<Buffer>,
  image: string, nonce: string, expected: string, signal: AbortSignal) {
  uuid(nonce);
  if (!/^sha256:[0-9a-f]{64}$/.test(image) || !/^[0-9a-f]{64}$/.test(expected)) return fail();
  const name = `ingenium-image-observation-${nonce}`;
  const call = (args: string[]) => { signal.throwIfAborted(); return command(args, Buffer.alloc(0), signal); };
  const id = (await call(["create", "--pull=never", "--name", name, "--label", `ingenium.image-observation=${nonce}`,
    "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true", "--restart", "no",
    "--memory", "33554432", "--memory-swap", "33554432", "--cpus", "0.1", "--pids-limit", "4", "--log-driver", "none",
    "--entrypoint", "/ingenium-inspection-never-start", image])).toString("ascii").trim();
  if (!/^[0-9a-f]{64}$/.test(id)) return fail();
  const verify = async () => {
    const raw = await call(["inspect", "--type", "container", "--format", "{{json .}}", id]);
    let row;
    try { row = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { return fail(); }
    if (row?.Id !== id || row.Name !== `/${name}` || row.Image !== image || row.Config?.Image !== image
      || row.Config.Labels?.["ingenium.image-observation"] !== nonce || JSON.stringify(row.Config.Entrypoint) !== '["/ingenium-inspection-never-start"]'
      || row.State?.Status !== "created" || row.State.Running !== false || row.State.Pid !== 0 || row.State.StartedAt !== "0001-01-01T00:00:00Z"
      || row.RestartCount !== 0 || row.HostConfig?.RestartPolicy?.Name !== "no" || row.HostConfig.NetworkMode !== "none"
      || row.HostConfig.ReadonlyRootfs !== true || row.HostConfig.Privileged !== false || JSON.stringify(row.Mounts) !== "[]") return fail();
  };
  await verify();
  const proof = checkedImageTree(await exportTree(id, signal), expected);
  await verify();
  // A source image is never started, even on failure; unknown or altered containers are left for inspection.
  if ((await call(["rm", id])).toString("ascii").trim() !== id) return fail();
  const remaining = await call(["container", "ls", "--all", "--no-trunc", "--filter", `id=${id}`, "--format", "{{.ID}}"]);
  if (remaining.toString("ascii").trim()) return fail();
  return proof;
}
