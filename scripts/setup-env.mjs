import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function serialize(settings) {
  return Object.entries(settings)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n") + "\n";
}

async function setup() {
  const apiPath = new URL("../.env", import.meta.url);
  const databasePath = new URL("../.env.database", import.meta.url);
  const apiExists = await exists(apiPath);
  const databaseExists = await exists(databasePath);

  if (apiExists && databaseExists) {
    console.log("Existing environment files left unchanged.");
    return;
  }
  if (apiExists || databaseExists) {
    throw new Error("Only one environment file exists. Review the matching pair before setup; nothing was overwritten.");
  }

  const api = parseEnv(await readFile(new URL("../.env.example", import.meta.url), "utf8"));
  const database = parseEnv(await readFile(new URL("../.env.database.example", import.meta.url), "utf8"));
  const apiPassword = randomBytes(24).toString("hex");
  const url = new URL(api.DATABASE_URL);
  url.password = apiPassword;
  api.DATABASE_URL = url.href;
  database.POSTGRES_API_PASSWORD = apiPassword;
  database.POSTGRES_PASSWORD = randomBytes(24).toString("hex");

  await writeFile(apiPath, serialize(api), { flag: "wx", mode: 0o600 });
  await writeFile(databasePath, serialize(database), { flag: "wx", mode: 0o600 });
  console.log("Created ignored API/database environment files with separate random local passwords.");
}

setup().catch((error) => {
  console.error(error.code ? "Environment setup failed; check permissions and whether a partial pair exists." : error.message);
  process.exitCode = 1;
});
