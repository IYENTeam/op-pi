# Builtin compaction extension changes

## Post-compact restoration tracker

- Added `restoration-tracker.ts` as a builtin-extension module so file and skill context can be restored without modifying core session flow.
- Added compaction extension hooks for `tool_call`, accepted `session_compact`, and one-shot `before_agent_start` injection.
- Added optional restoration settings to `CompactionSettings` and state storage for the tracker.
- Extension system is sufficient because the feature only needs tool-call observation, compaction lifecycle events, and custom-message injection.

Expected upstream conflict zones: `builtin/compaction/index.ts`, `builtin/compaction/state.ts`, and `core/compaction/compaction.ts` if upstream changes compaction settings or extension hook wiring.
