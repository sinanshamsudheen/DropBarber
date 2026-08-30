import { defineConfig } from "kubb";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginFetch } from "@kubb/plugin-fetch";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginZod } from "@kubb/plugin-zod";

// Generates a typed fetch client + React Query hooks + zod schemas from the
// running FastAPI backend's own OpenAPI schema (`uv run uvicorn app.main:app`
// from server/, default port 8000). Re-run `bun run generate:api` after
// backend route changes — this file is never hand-edited.
export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: {
    path: "./src/lib/api/generated",
    clean: true,
  },
  plugins: [
    pluginTs(),
    pluginZod(),
    pluginFetch({
      // No `/api/v1` suffix: every generated function's own `url` field
      // already carries the full path straight from the OpenAPI spec
      // (routes are mounted under /api/v1 in the backend) — appending it
      // here too would double it (`/api/v1/api/v1/...`). api-client.ts's
      // runtime client.setConfig() overrides this default the same way.
      baseURL: "${import.meta.env.VITE_API_BASE_URL}",
    }),
    pluginReactQuery(),
  ],
});
