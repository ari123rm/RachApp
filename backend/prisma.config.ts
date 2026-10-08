import { defineConfig, env } from "prisma/config";
import { DATABASE_URL } from "./src/config/env.js";

export default defineConfig({
  schema: "./prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: DATABASE_URL,
  },
});
