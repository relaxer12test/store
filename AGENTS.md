Set up TanStack Intent for this repository.

Run `npx @tanstack/intent@latest install` and follow the printed instructions.

Use `AGENTS.md` as the target unless this repo already has a preferred agent config file.
Check for an existing `<!-- intent-skills:start --> ... <!-- intent-skills:end -->` block first.
Run `npx @tanstack/intent@latest list`.
Inspect the repo structure and package.json.
Propose 3–5 task-to-skill mappings using task names I would naturally ask for.
Then write or update the mappings block, preserving everything outside the tagged block.

For future tasks, when a mapping matches, load the linked `node_modules/.../SKILL.md` before planning or editing code.
