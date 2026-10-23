import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { AccessError } from "./transaction.js";

export function clientAddress(
  request: Pick<IncomingMessage, "headers"> & {
    socket: Pick<IncomingMessage["socket"], "remoteAddress">;
  },
  proxy?: "loopback",
): string {
  const peer = request.socket.remoteAddress ?? "unknown";
  if (!proxy) return peer;
  // Only the same-host edge can supply this single overwritten header, including on upgrades.
  const address = request.headers["x-ingenium-client-ip"];
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) ||
    typeof address !== "string" ||
    address.length > 45 ||
    address.includes("%") ||
    !isIP(address)
  ) {
    throw new AccessError("INVALID_HEADERS");
  }
  return address;
}
