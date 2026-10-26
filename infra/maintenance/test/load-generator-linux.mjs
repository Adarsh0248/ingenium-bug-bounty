import assert from "node:assert/strict";
import { serveLiveDriver } from "/workspace/test/integration/live-load-bridge.js";
let input = "";
for await (const chunk of process.stdin) { input += chunk; assert.ok(Buffer.byteLength(input) <= 512); }
const settings = JSON.parse(input); assert.deepEqual(Object.keys(settings).sort(), settings.soak === true ? ["name", "soak"] : ["name"]);
await serveLiveDriver(settings.name);
setTimeout(() => process.exit(1), settings.soak === true ? 4200000 : 500000).unref();
