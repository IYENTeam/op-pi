# builtin/gpt-apply-patch

Builtin extension #4. When the active model is OpenAI GPT, swaps `write` / `edit` for a freeform Codex-style `apply_patch` tool with a Lark-style grammar. Applies multi-file patches (add / update / delete / move). Falls back to standard edit tools for non-GPT models. Largest single builtin (18 files).

## FILES

```
gpt-apply-patch/
├── index.ts            # Extension entry — model detection + tool registration
├── extension.ts        # ExtensionAPI wiring (on model_select, on session_start)
├── tool.ts             # `apply_patch` tool definition (TypeBox schema + execute)
├── params.ts           # Argument parsing + validation
├── parser.ts           # Codex apply_patch grammar parser
├── streaming-parser.ts # Streaming variant for partial-arg rendering during stream
├── streaming-render.ts # TUI render for partial patches
├── patch-diff.ts       # Diff/hunk math (shared with `core/tools/edit-diff.ts`)
├── patch-replace.ts    # Replace algorithms (anchor matching, seek fallback)
├── seek-sequence.ts    # Strict context-line seek with N-line tolerance
├── apply.ts            # Apply parsed patch to workspace
├── workspace.ts        # File I/O + path normalization for patches
├── preview.ts          # Preview before apply (used by permission-system parser)
├── preview-format.ts   # Render preview as TUI nodes (opencode-style diff)
├── text.ts             # Text utilities (line splitting, trailing newline handling)
├── constants.ts        # Sentinel tokens (`*** Begin Patch`, `*** End Patch`, etc.)
├── errors.ts           # Typed parse + apply errors
└── types.ts            # Patch AST shape (FileOp union, Hunk, Replace)
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Fix a parse error from a real GPT output | `parser.ts` — add a fixture under `test/goldens/apply-patch/` |
| Improve strict-seek tolerance | `seek-sequence.ts` |
| Change render | `preview-format.ts` + `streaming-render.ts` |
| Add a new file op (e.g. `*** Rename File:`) | `types.ts` + `parser.ts` + `apply.ts` |
| Adjust which models opt in | `index.ts` — model id pattern matching |

## CONVENTIONS

- **GPT only**: this extension is dormant unless the active model is GPT-family. Other models keep `write`/`edit`. Selection happens on `model_select`.
- **Strict context lines**: `seek-sequence.ts` requires exact context-line match (with bounded fuzz). Bypassing strict mode masks real grammar bugs.
- **Mirror upstream Codex grammar** in `parser.ts` — the canonical reference is `openai/codex` `apply_patch` source. Tests pull goldens from there via `scripts/extract-codex-apply-patch-golden.mjs`.
- **Permission-system integration**: `parsers.ts` in `permission-system/` extracts file paths from patch bodies for per-file approval (see `permission-system/changes.md` 2026-04-13).
- **Render diffs like opencode** (recent commit f1d24c2f): the preview UI mirrors opencode's diff formatting.

## ANTI-PATTERNS

- Falling back to non-strict seek for "convenience" — masks model output bugs and produces wrong patches.
- Hardcoding model IDs in `index.ts` — use pattern-matching against `model.id` so new GPT releases auto-opt-in.
- Duplicating diff math here vs. `core/tools/edit-diff.ts` — `patch-diff.ts` should call into the shared module.
- Changing patch sentinels (`*** Begin Patch`, etc.) — must match Codex exactly.

## NOTES

- The `apply_patch` tool exposes `promptSnippet` + `promptGuidelines` that the dynamic prompt picks up; prompt-preset's `file-operations.ts` reinforces "use apply_patch, not python heredoc" for GPT presets.
- Goldens live under `packages/coding-agent/test/goldens/apply-patch/`. Re-extract from upstream via `npm run extract-codex-apply-patch-golden`.
- `streaming-parser.ts` powers partial render during model streaming — keep it tolerant of incomplete blocks.
