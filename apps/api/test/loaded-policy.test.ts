import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedLoadedProfile, observeLoadedAppArmor } from "../src/judge/loaded-policy.js";
import { CAPSULE_APPARMOR } from "../src/judge/docker-capsule.js";

test("loaded profile decoding binds the exact enforced name and compiled raw policy hash", () => {
  const hash = "a".repeat(64), link = "../../raw_data/17/sha256", name = `${CAPSULE_APPARMOR}\n`;
  assert.deepEqual(checkedLoadedProfile(name, "enforce\n", link, `${hash}\n`, hash), { profile: CAPSULE_APPARMOR, revision: "17", raw_sha256: hash });
  for (const [n, mode, target, raw, expected] of [
    ["other\n", "enforce\n", link, `${hash}\n`, hash], [name, "complain\n", link, `${hash}\n`, hash],
    [name, "enforce\n", link, `${"b".repeat(64)}\n`, hash], [name, "enforce\n", link, hash, hash],
    [name, "enforce\n", "../../../etc/sha256", `${hash}\n`, hash], [name, "enforce\n", "../../raw_data/../sha256", `${hash}\n`, hash],
    [name, "enforce\n", "../../raw_data/017/sha256", `${hash}\n`, hash], [name, "enforce\n", `${link}\n`, `${hash}\n`, hash],
    [name, "enforce\n", link, `${hash}\n`, "not-a-digest"],
  ]) assert.throws(() => checkedLoadedProfile(n!, mode!, target!, raw!, expected!));
});

test("policy observation refuses invalid context or cancellation without reading arbitrary paths", async () => {
  await assert.rejects(observeLoadedAppArmor("invalid", new AbortController().signal));
  await assert.rejects(observeLoadedAppArmor("a".repeat(64), AbortSignal.abort()));
});
