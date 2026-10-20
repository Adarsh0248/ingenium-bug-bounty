import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/access-schema.ts", "./src/db/clock-schema.ts", "./src/db/staff-schema.ts", "./src/db/staff-management-schema.ts", "./src/db/replacement-schema.ts", "./src/db/arena-schema.ts", "./src/db/content-schema.ts", "./src/db/validation-schema.ts", "./src/db/judge-schema.ts"],
  out: "./drizzle",
  strict: true,
  verbose: true,
});
