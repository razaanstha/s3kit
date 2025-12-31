# AGENTS

This file defines local instructions for coding agents working in this repo.

## Scope
- Applies to the entire repository unless a subdirectory contains its own AGENTS.md.
- Prefer minimal, targeted changes; avoid unrelated cleanups.

## Tools
- Use `rg` for searches.
- Use `bunx` for tooling invocations.
- Prefer `apply_patch` for single-file edits.

## Commands
- Lint: `bun run oxlint`
- Format: `bun run oxfmt`
- Typecheck: `bun run typecheck`
- Build: `bun run build`
- Tests: `bun run test`

## Frontend
- Keep React components modular and composable.
- Shared UI atoms live in `src/react/components/`.
- Reusable logic lives in `src/react/utils/` and `src/react/theme/`.
- Export public React types from `src/react/types/`.

## Backend/Core
- Keep core logic in `src/core/` framework-agnostic.
- HTTP handlers stay in `src/http/` and adapters in `src/adapters/`.
- Client-facing logic lives in `src/client/`.

## Style
- Use ASCII-only in new content unless the file already uses Unicode.
- Avoid changing semantics while refactoring; keep behavior stable.
- Add short comments only when needed for clarity.
