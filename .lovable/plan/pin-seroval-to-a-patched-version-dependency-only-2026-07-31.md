# Pin seroval to a patched version (dependency-only)

## Confirmed current state

- `seroval` resolves to a single hoisted copy at version **1.5.1** (`node_modules/seroval/package.json`), pulled in transitively by the TanStack packages. It is not a direct dependency in `package.json`.
- The lockfile is the binary `bun.lockb` (no `bun.lock` present).
- `package.json` currently has no `overrides` / `resolutions` block.

## Change

1. Add to `package.json` only:

```json
"overrides": {
  "seroval": "^1.6.0"
}
```

2. Run `bun install` so the existing `bun.lockb` is updated in place with the new seroval resolution. No `--save-text-lockfile`, no lockfile format change.

3. Verify:
   - `node_modules/seroval/package.json` reports >= 1.6.0
   - TanStack package versions in `package.json` and the lockfile are unchanged
   - `git status` shows only `package.json` and `bun.lockb` as modified — nothing else

## Explicitly not touched

- `src/routeTree.gen.ts` is never regenerated. No command that regenerates it will be run, and the dev server will not be restarted for the purpose of route generation.
- No `.ts` / `.tsx` file, route, component, search-param definition, or type is edited.
- No other package version is upgraded.

## Stop condition

If `bun install` mutates `src/routeTree.gen.ts`, any `.tsx`/`.ts` file, or converts the lockfile format, the change is reverted and reported back instead of being kept.
