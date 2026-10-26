import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { checkedHostContext, createHostContextObserver,readHostContext } from "../src/judge/host-context.js";

// Decoder fixtures only. This data is never a real host observation or a cleanup certificate.
function fixture() {
  const nonce = randomUUID(), settings = { bootId: randomUUID(), kernelRelease: "6.8.0-1070-gcp", observerSha256: "a".repeat(64) };
  const result = { protocol: "ingenium-host-context-v1", request_id: nonce, boot_id: settings.bootId, kernel_release: settings.kernelRelease,
    proc_mount_id: "23", cap_eff: "000001ffffffffff", user_namespace: "user:[4026531837]", pid_namespace: "pid:[4026531836]",
    cgroup_namespace: "cgroup:[4026531835]", ipc_namespace: "ipc:[4026531839]", uts_namespace: "uts:[4026531838]", time_namespace: "time:[4026531834]",
    mnt_namespace: "mnt:[4026531841]", net_namespace: "net:[4026531840]" };
  return { nonce, settings, result };
}
test("host observation decoding binds its fresh challenge, actual boot and reviewed kernel contract", () => {
  const f = fixture(); assert.deepEqual(checkedHostContext(f.result, f.nonce, f.settings), f.result);
  for (const patch of [{ request_id: randomUUID() }, { boot_id: randomUUID() }, { kernel_release: "6.6.0" }, { protocol: "other" },
    { cap_eff: "00000000a80425fb" }, { proc_mount_id: "0" }, { proc_mount_id: 23 }, { extra: true }])
    assert.throws(() => checkedHostContext({ ...f.result, ...patch }, f.nonce, f.settings));
  assert.throws(() => checkedHostContext(f.result, f.nonce, { ...f.settings, kernelRelease: "6.9.0" }));
});

test("the native observer's exact single-line JSON is decoded without dropping duplicates or changing the judge wire protocol",()=>{
  const f=fixture(),text=JSON.stringify(f.result)+"\n";
  assert.deepEqual(readHostContext(Buffer.from(text),f.nonce,f.settings),f.result);
  for(const invalid of [text+"\n",text.trimEnd(),text.replace("\n","\r\n"),JSON.stringify(f.result,null,2)+"\n",
    text.replace('{"protocol":','{"protocol":"duplicate","protocol":'),text.replace("ingenium-host-context-v1","ingenium-host-context-v2"),"x".repeat(4097)])
    assert.throws(()=>readHostContext(Buffer.from(invalid),f.nonce,f.settings));
  assert.throws(()=>readHostContext(Buffer.concat([Buffer.from(text),Buffer.from([255])]),f.nonce,f.settings));
  assert.throws(()=>readHostContext(Buffer.concat([Buffer.from([239,187,191]),Buffer.from(text)]),f.nonce,f.settings));
});
test("matching namespace labels in a container cannot replace reserved initial-namespace identities", () => {
  const f = fixture();
  for (const name of ["user", "pid", "cgroup", "ipc", "uts", "time", "mnt", "net"]) {
    for (const value of [`${name}:[0]`, `${name}:[1]\n`, "other:[4026531837]"]) assert.throws(() => checkedHostContext({ ...f.result, [`${name}_namespace`]: value }, f.nonce, f.settings));
    if (!["mnt", "net"].includes(name)) assert.throws(() => checkedHostContext({ ...f.result, [`${name}_namespace`]: `${name}:[4000000000]` }, f.nonce, f.settings));
  }
});
test("a local or invalid caller cannot construct a production host observer", () => {
  const f = fixture(); assert.throws(() => createHostContextObserver({ ...f.settings, observerSha256: "invalid" }));
});
