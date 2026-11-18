# Apps (Phase 1)

- `apps/web`: Next.js interface (PWA, phone first), translation files for am-ET, ti-ET, ti-ER, om-ET
- `apps/api`: HTTP API (Hono on Node.js): sign-in, workspaces, files, billing, admin
- `apps/worker`: task orchestrator using `capability-sdk` and `ai-gateway`

Not started: these need package installs (Next.js, Hono, Drizzle, pg-boss), which are unavailable in the current workspace.
