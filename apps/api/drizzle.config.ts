import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/access-schema.ts", "./src/db/clock-schema.ts", "./src/db/staff-schema.ts", "./src/db/staff-management-schema.ts", "./src/db/team-management-schema.ts", "./src/db/registration-import-schema.ts", "./src/db/discipline-schema.ts", "./src/db/cancellation-schema.ts", "./src/db/replacement-schema.ts", "./src/db/arena-schema.ts", "./src/db/content-schema.ts", "./src/db/validation-schema.ts", "./src/db/judge-schema.ts", "./src/db/competition-schema.ts", "./src/db/participant-judge-schema.ts", "./src/db/live-schema.ts", "./src/db/workbench-schema.ts", "./src/db/announcement-schema.ts", "./src/db/retention-schema.ts", "./src/db/restore-schema.ts"],
  out: "./drizzle",
  strict: true,
  verbose: true,
});
