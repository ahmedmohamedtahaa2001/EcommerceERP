import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://ops_hub:ops_hub@localhost:5432/ops_hub",
  },
  strict: true,
  verbose: true,
});
