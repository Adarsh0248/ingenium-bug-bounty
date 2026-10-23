import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAddress } from "../src/access/client-address.js";

function request(peer: string, address?: string | string[]) {
  return {
    socket: { remoteAddress: peer },
    headers: {
      "x-forwarded-for": "198.51.100.99",
      forwarded: "for=198.51.100.99",
      ...(address === undefined ? {} : { "x-ingenium-client-ip": address }),
    },
  };
}

test("direct development requests ignore every claimed proxy address", () => {
  assert.equal(
    clientAddress(request("127.0.0.1", "198.51.100.2")),
    "127.0.0.1",
  );
  assert.equal(
    clientAddress(request("198.51.100.1", "198.51.100.2")),
    "198.51.100.1",
  );
});

test("the fixed same-host edge supplies one real IPv4 or IPv6 address", () => {
  for (const peer of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    for (const address of ["198.51.100.2", "2001:db8::1", "::ffff:192.0.2.1"]) {
      assert.equal(clientAddress(request(peer, address), "loopback"), address);
    }
  }
});

test("proxy mode refuses missing, duplicate, chained or malformed addresses and non-loopback senders", () => {
  for (const address of [
    undefined,
    "",
    " 198.51.100.2",
    "198.51.100.2, 198.51.100.3",
    ["198.51.100.2"],
    "https://host",
    "2001:db8::1%eth0",
    "a".repeat(46),
  ]) {
    assert.throws(
      () => clientAddress(request("127.0.0.1", address), "loopback"),
      /INVALID_HEADERS/,
    );
  }
  for (const peer of ["198.51.100.1", "10.42.0.2", "127.0.0.2", "unknown"]) {
    assert.throws(
      () => clientAddress(request(peer, "198.51.100.2"), "loopback"),
      /INVALID_HEADERS/,
    );
  }
});
