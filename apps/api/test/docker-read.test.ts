import assert from "node:assert/strict";
import { test } from "node:test";
import { dockerHttpBody, dockerReadRequest } from "../src/judge/docker-read.js";

const response = (body: string, headers = "", status = "200 OK") => Buffer.from(`HTTP/1.0 ${status}\r\nContent-Type: application/json\r\n${headers}\r\n${body}`);
test("authenticated Docker HTTP observations accept complete bounded JSON framing", () => {
  assert.equal(dockerHttpBody(response("{}", "Content-Length: 2\r\n")).toString(), "{}");
  assert.equal(dockerHttpBody(response("{}" )).toString(), "{}");
  for (const bytes of [response("{}", "Content-Length: 3\r\n"), response("{}", "Content-Length: 2\r\ncontent-length: 2\r\n"),
    response("{}", "Transfer-Encoding: chunked\r\n"), response("{}", "Content-Encoding: gzip\r\n"), response("{}", "", "302 Found"),
    response("{}", "", "503 Unavailable"), response("{}", "X-Long: " + "a".repeat(16384) + "\r\n"),
    Buffer.alloc(2097153), Buffer.from("HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\n{}")]) assert.throws(() => dockerHttpBody(bytes));
});
test("fixed reads preserve CLI result shapes and filter the fresh complete container snapshot", () => {
  const id = "a".repeat(64), other = "b".repeat(64), body = Buffer.from(JSON.stringify([{ Id: id, Names: ["/first"] }, { Id: other, Names: ["/second"] }]));
  const list = (...tail: string[]) => dockerReadRequest(["container", "ls", "--all", "--no-trunc", ...tail])!;
  assert.equal(list("--format", "{{.ID}} {{.Names}}").output(body).toString(), `${id} first\n${other} second\n`);
  assert.equal(list("--filter", "name=^/second$", "--format", "{{.ID}}").output(body).toString(), `${other}\n`);
  assert.equal(list("--filter", `id=${id}`, "--format", "{{.ID}}").output(body).toString(), `${id}\n`);
  assert.equal(list("--format", "{{.ID}}").output(Buffer.from("[]")).length, 0);
  assert.equal(dockerReadRequest(["info", "--format", "{{json .}}"])!.path, "/info");
  assert.equal(dockerReadRequest(["image", "inspect", "--format", "{{json .}}", `sha256:${id}`])!.path, `/images/sha256:${id}/json`);
  assert.deepEqual(JSON.parse(dockerReadRequest(["inspect", "--type", "container", id])!.output(Buffer.from('{"Id":"value"}')).toString()), [{ Id: "value" }]);
  assert.deepEqual(JSON.parse(dockerReadRequest(["inspect", "--type", "container", "--format", "{{json .}}", id])!.output(Buffer.from('{"Id":"value"}')).toString()), { Id: "value" });
  for (const invalid of [Buffer.from("{}"), Buffer.from('[{"Id":"short","Names":["/first"]}]'), Buffer.from([255]),
    Buffer.from(JSON.stringify([{ Id: id, Names: ["/first"] }, { Id: id, Names: ["/alias"] }])),
    Buffer.from(JSON.stringify([{ Id: id, Names: ["/first", "/alias"] }]))]) assert.throws(() => list("--format", "{{.ID}}").output(invalid));
});
test("mutations, foreign endpoints, formats and injection never enter the read-only shortcut", () => {
  for (const args of [["create"], ["start", "a".repeat(64)], ["rm", "a".repeat(64)], ["info", "--host=other"],
    ["info", "--format", "{{json .}}", "extra"], ["image", "inspect", "--format", "{{json .}}", "latest"],
    ["inspect", "--type", "container", "../../info"], ["container", "ls", "--all", "--no-trunc", "--filter", "name=.*", "--format", "{{.ID}}"]])
    assert.equal(dockerReadRequest(args), null);
});
