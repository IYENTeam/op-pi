# builtin/compaction

Builtin extension #23 (last). Owns senpi's compaction pipeline: speculative compaction running in parallel with the next turn, blocking compaction at the hard context limit, proactive compaction near the soft limit, degradation monitoring, circuit breaker, per-turn cap, todo bridging, checkpoint state, restoration tracker, and tool-result truncation. Policy-rich; touch with policy tests in lock-step. See `changes.md` for the restoration tracker rationale.

## FILES

```
compaction/
├── index.ts                  # Extension entry — wires every sub-policy into the event bus
├── state.ts                  # In-memory compaction state + persistence shape
├── policy.ts                 # Adaptive threshold + decision matrix
├── speculative.ts            # Parallel speculative compaction during next turn
├── overflow-detection.ts     # Detects provider "prompt too long" errors → triggers blocking compaction
├── circuit-breaker.ts        # N consecutive failures → halt automatic compaction
├── per-turn-cap.ts           # Max compactions per turn rate-limiter
├── degradation-monitor.ts    # Detects post-compact assistant degradation (all-tool, no-text turns)
├── tool-truncation.ts        # Truncates oversized bash/read results before they hit context
├── checkpoint-state.ts       # Snapshots agent state (model, thinking, todos) at compact boundaries
├── todo-bridge.ts            # Carries todos through compaction so the summary preserves them
├── restoration-tracker.ts    # Post-compact: re-injects skill + file context (fork-introduced)
├── prompts.ts                # Compaction summarization prompt + system message
└── changes.md                # Fork tracker (restoration tracker, extension hook wiring)
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Adjust when proactive compaction fires | `policy.ts` (thresholds) |
| Tune circuit breaker count | `circuit-breaker.ts` |
| Add a new degradation signal | `degradation-monitor.ts` |
| Change tool-result truncation policy | `tool-truncation.ts` |
| Add a new piece of state that should survive compaction | `checkpoint-state.ts` + `restoration-tracker.ts` |
| Modify the summarization prompt | `prompts.ts` |

## PIPELINE (one turn)

1. **Pre-turn**: `policy.ts` checks thresholds; if proactive, fire `speculative.ts` in parallel.
2. **Mid-turn**: `tool-truncation.ts` shrinks oversized results before they land in context.
3. **Provider call**: if `overflow-detection.ts` sees a "prompt too long" error → cancel turn, run blocking compaction, retry.
4. **Post-turn**: `circuit-breaker.ts` + `per-turn-cap.ts` gate any further auto-compaction; `degradation-monitor.ts` watches for post-compact quality drop.
5. **Compact event**: `checkpoint-state.ts` snapshots, `todo-bridge.ts` injects todos, `restoration-tracker.ts` queues re-injections for the first post-compact turn.

## CONVENTIONS

- **Each sub-policy is a pure module** with explicit state passed through. Don't add singletons.
- **The 12 per-feature compaction fixtures** under `packages/coding-agent/test/fixtures/compaction/` map 1:1 onto these sub-policies — when you change a policy, update its fixture (and add a new one if you split a behavior).
- **Restoration tracker is opt-in via `CompactionSettings`** — don't make it unconditional; tests rely on the on/off path.
- **`session_compact` is the canonical event**; everything else (degradation, restoration) hangs off it.

## ANTI-PATTERNS

- Wiring compaction logic into `core/agent-session.ts` — that's the seam this extension was built to remove. See upstream `core/compaction/` for the bare policy constants.
- Changing the `prompts.ts` summarization template without regenerating the relevant goldens.
- Bypassing `tool-truncation.ts` for "small" tool results — the policy uses a global token budget; even small additions matter.
- Mutating `restoration-tracker.ts` queue from a non-compaction hook.

## NOTES

- The fork's compaction differs significantly from upstream pi (speculative + restoration + degradation are all senpi additions). Upstream has a much simpler `core/compaction/` policy.
- The 12 per-feature fixtures (under `test/fixtures/compaction/`) are documented in their own `README.md` — each isolates one subsystem to avoid spooky-action regressions.
- `restoration-tracker.ts` is the marquee feature: post-compact, the agent re-reads its prior file/skill context so summarization doesn't lose tool grounding.
