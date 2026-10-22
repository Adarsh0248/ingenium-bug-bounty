import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

export async function createTestTls(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "ingenium-test-tls-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.match(basename(directory), /^ingenium-test-tls-/);
    await rm(directory, { recursive: true, force: true });
  });
  // Disposable test credentials, never installed on a real judge or reused by the event.
  const openssl = process.platform === "win32" ? join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "usr", "bin", "openssl.exe") : "openssl";
  const run = (args: string[]) => promisify(execFile)(openssl, args, { cwd: directory, timeout: 10000, maxBuffer: 16384 });
  await run(["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes", "-days", "1", "-subj", "/CN=Ingenium Disposable Test CA", "-keyout", "ca.key", "-out", "ca.pem"]);
  for (const role of ["server", "client", "other"]) {
    await run(["req", "-new", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes", "-subj", `/CN=${role === "server" ? "judge.test" : "worker.test"}`, "-keyout", `${role}.key`, "-out", `${role}.csr`]);
    await writeFile(join(directory, `${role}.ext`), `basicConstraints=CA:FALSE\nextendedKeyUsage=${role === "server" ? "serverAuth" : "clientAuth"}\n${role === "server" ? "subjectAltName=DNS:judge.test\n" : ""}`);
    await run(["x509", "-req", "-in", `${role}.csr`, "-CA", "ca.pem", "-CAkey", "ca.key", "-set_serial", role === "server" ? "2" : role === "client" ? "3" : "4", "-days", "1", "-extfile", `${role}.ext`, "-out", `${role}.pem`]);
  }
  return { directory, ca: await readFile(join(directory, "ca.pem")), cert: await readFile(join(directory, "server.pem")), key: await readFile(join(directory, "server.key")),
    clientCert: await readFile(join(directory, "client.pem")), clientKey: await readFile(join(directory, "client.key")) };
}
