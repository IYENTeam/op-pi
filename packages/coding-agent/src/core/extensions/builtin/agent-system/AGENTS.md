# builtin/agent-system

Builtin extension #2. Defines named agent profiles (default, editor, architect, plus user-defined) with per-agent tool whitelists. **NOT a permission system** — it decides which tools an agent is *allowed to use* at all; `permission-system` decides whether each tool *call* is approved. See `changes.md` (T15) for the split.

## FILES

```
agent-system/
├── index.ts            # Extension factory — registers AGENT_TYPE handler, narrows toolset on session_start
├── types.ts            # AgentDefinition, AgentConfig
├── registry.ts         # In-memory registry; lookup by agent type
├── loader.ts           # Loads from settings.json + ~/.senpi/agent/agents/ + .senpi/agents/
├── agent-types.ts      # Built-in agent type constants
├── builtin-agents.ts   # Default agent definitions (default, editor, architect)
├── wildcard.ts         # Pattern matcher for tool allowlists (e.g. `anthropic-*`)
├── permission.ts       # canUseToolWithAgentType() — agent-level allowlist check
└── changes.md          # Fork tracker (T15: permission split)
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add a built-in agent profile | `builtin-agents.ts` + register in `agent-types.ts` |
| Change agent-level tool filtering | `permission.ts` `canUseToolWithAgentType()` |
| Adjust wildcard semantics (`*`, `?`, `[abc]`) | `wildcard.ts` |
| Wire a new env var or loader source | `loader.ts` |

## AGENT DEFINITION SHAPE

```typescript
{
   id: "<agent-name>",
   description: "<one-line>",
   tools: ["read", "grep", "anthropic-*", …],   // wildcards allowed
   model?: string,
   thinkingLevel?: "off" | "low" | "medium" | "high",
   systemPromptFragment?: string,
}
```

## CONVENTIONS

- **Loaded via `AGENT_TYPE` env var** set by `background-task` extension when spawning subagents. There is no `--agent` CLI flag; it's runtime.
- **Tool allowlist is wildcard-only** — match via `wildcard.ts`. Exact-name and glob coexist.
- **Agent-level filter is static** (set on session_start). Per-call approval lives in `permission-system`. Both can deny, neither overrides the other.
- **System prompt fragments** are appended to the dynamic prompt — they do NOT replace it. Use `extensions/builtin/prompt-preset/` if you need to swap the whole prompt.

## ANTI-PATTERNS

- Reintroducing the deleted `tool_call` permission handler — it was lifted to `permission-system` (T15, 2026-04). Doing both = double-prompting users.
- Hardcoding agent definitions in `core/` — they belong here in `builtin-agents.ts` or under user dirs.
- Sharing the `sessionAllowed` Set with `permission-system` — that pattern was deliberately removed.

## NOTES

- Built-in agents are minimal: `default` (everything), `editor` (read/edit/write/bash), `architect` (read/grep/find/ls + no mutations).
- User agents live in `~/.senpi/agent/agents/<name>.{md,yml,json}` or project `.senpi/agents/`.
- The split between agent-system and permission-system is the canonical pi/senpi separation-of-concerns; see `changes.md` T15.
