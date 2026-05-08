import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, it } from "vitest";
import { createApplyPatchTool } from "../../src/core/extensions/builtin/gpt-apply-patch/index.js";
import type { ToolRenderContext } from "../../src/core/extensions/types.js";
import { initTheme, theme } from "../../src/modes/interactive/theme/theme.js";
import type { Harness } from "./harness.js";
import { createHarness } from "./harness.js";

type ApplyPatchTool = ReturnType<typeof createApplyPatchTool>;
type ApplyPatchArgs = { input: string };
type ApplyPatchState = Record<string, unknown>;

function createRenderContext(cwd: string, args: ApplyPatchArgs, overrides: Partial<ToolRenderContext> = {}) {
	return {
		args,
		toolCallId: "call-streaming-preview",
		invalidate: () => {},
		lastComponent: undefined,
		state: {},
		cwd,
		executionStarted: false,
		argsComplete: false,
		isPartial: true,
		expanded: false,
		showImages: true,
		isError: false,
		...overrides,
	} satisfies ToolRenderContext<ApplyPatchState, ApplyPatchArgs>;
}

describe("gpt apply_patch rich TUI rendering", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("renders streamed arguments as a rich patch preview before execution starts", async () => {
		initTheme("dark");
		const harness = await createHarness();
		harnesses.push(harness);
		const args = {
			input: `*** Begin Patch
*** Update File: sample.txt
@@
-before
+after
*** Add File: created.txt
+created
`,
		};
		const tool = createApplyPatchTool();

		const component = tool.renderCall?.(args, theme, createRenderContext(harness.tempDir, args));
		const rendered = stripAnsi(component?.render(120).join("\n") ?? "");

		expect(rendered).toContain("Streaming patch");
		expect(rendered).toContain("sample.txt");
		expect(rendered).toContain("- before");
		expect(rendered).toContain("+ after");
		expect(rendered).toContain("created.txt");
	});

	it("keeps the real diff visible after apply_patch finishes", async () => {
		initTheme("dark");
		const harness = await createHarness();
		harnesses.push(harness);
		await writeFile(path.join(harness.tempDir, "sample.txt"), "before\n", "utf-8");
		const args = {
			input: `*** Begin Patch
*** Update File: sample.txt
@@
-before
+after
*** End Patch`,
		};
		const tool = createApplyPatchTool();

		const result = await tool.execute("call-rich-result", args, undefined, undefined, {
			cwd: harness.tempDir,
		} as Parameters<ApplyPatchTool["execute"]>[4]);
		const component = tool.renderResult?.(
			result,
			{ expanded: false, isPartial: false },
			theme,
			createRenderContext(harness.tempDir, args, { executionStarted: true, argsComplete: true, isPartial: false }),
		);
		const rendered = stripAnsi(component?.render(120).join("\n") ?? "");

		expect(await readFile(path.join(harness.tempDir, "sample.txt"), "utf-8")).toBe("after\n");
		expect(result.details?.preview).toBeDefined();
		expect(rendered).toContain("Applied patch");
		expect(rendered).toContain("sample.txt (+1 -1)");
		expect(rendered).toContain("-1 before");
		expect(rendered).toContain("+1 after");
	});
});
