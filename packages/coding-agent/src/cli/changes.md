# changes

## op-pi package command wording (2026-05-02)

### What changed

- `args.ts`: Top-level help now documents `op-pi update` as updating op-pi instead of pi.

### Why

- The forked CLI should not tell users that self-update targets upstream pi.

### Why extension system couldn't handle this

- The built-in help text is emitted before extension-registered flags are appended.

### Expected merge conflict zones on next upstream sync

- LOW: package-command rows in `printHelp()`.
