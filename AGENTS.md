Set up TanStack Intent for this repository.

Run `npx @tanstack/intent@latest install` and follow the printed instructions.

Use `AGENTS.md` as the target unless this repo already has a preferred agent config file.
Check for an existing `<!-- intent-skills:start --> ... <!-- intent-skills:end -->` block first.
Run `npx @tanstack/intent@latest list`.
Inspect the repo structure and package.json.
Propose 3–5 task-to-skill mappings using task names I would naturally ask for.
Then write or update the mappings block, preserving everything outside the tagged block.

For future tasks, when a mapping matches, load the linked `node_modules/.../SKILL.md` before planning or editing code.

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "add or fix Shopify webhook handlers, embedded bootstrap, or widget API routes"
  load: "node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md"
- task: "fix embedded app auth, install redirects, or merchant access guards"
  load: "node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
- task: "change route loaders, preloading, or Convex-backed app page data"
  load: "node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
- task: "work on App Bridge bootstrapping, client-server boundaries, or env wiring"
  load: "node_modules/@tanstack/start-client-core/skills/start-core/execution-model/SKILL.md"
- task: "adjust Cloudflare deployment, SSR behavior, or Shopify runtime config"
load: "node_modules/@tanstack/start-client-core/skills/start-core/deployment/SKILL.md"
<!-- intent-skills:end -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
