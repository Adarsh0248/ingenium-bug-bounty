import { isAbsolute } from "node:path";

export interface Config {
  host: "127.0.0.1" | "::1";
  port: number;
  databaseUrl: string;
  entryRuntimeFile?: string;
  competitionRuntimeFile?: string;
}

export function loadConfig(environment: NodeJS.ProcessEnv): Config {
  const host = environment.API_HOST ?? "127.0.0.1";
  const portText = environment.API_PORT ?? "3000";
  const databaseUrl = environment.DATABASE_URL;

  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error(
      "API_HOST must be a loopback address for this local foundation.",
    );
  }

  const port = Number(portText);
  if (
    !/^[1-9]\d{0,4}$/.test(portText) ||
    !Number.isInteger(port) ||
    port > 65535
  ) {
    throw new Error("API_PORT must be a whole number between 1 and 65535.");
  }

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Run npm run setup:env from the project root.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.pathname.length <= 1
  ) {
    throw new Error(
      "DATABASE_URL must specify a PostgreSQL host, user and database.",
    );
  }

  const entryRuntimeFile = environment.ENTRY_RUNTIME_FILE;
  if (
    entryRuntimeFile !== undefined &&
    (!entryRuntimeFile ||
      !isAbsolute(entryRuntimeFile) ||
      !["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname) ||
      !parsed.password ||
      parsed.search ||
      parsed.hash)
  )
    throw new Error(
      "ENTRY_RUNTIME_FILE requires an absolute private path and primary-host loopback PostgreSQL without URL overrides.",
    );
  const competitionRuntimeFile = environment.COMPETITION_RUNTIME_FILE;
  if (
    competitionRuntimeFile !== undefined &&
    (!entryRuntimeFile ||
      !competitionRuntimeFile ||
      !isAbsolute(competitionRuntimeFile))
  )
    throw new Error(
      "COMPETITION_RUNTIME_FILE requires protected entry and an absolute private path.",
    );
  return {
    host,
    port,
    databaseUrl,
    ...(entryRuntimeFile !== undefined ? { entryRuntimeFile } : {}),
    ...(competitionRuntimeFile !== undefined ? { competitionRuntimeFile } : {}),
  };
}
