import { Box, Container, Spacer, Text } from "@earendil-works/pi-tui";
import type { AgentToolResult, ToolRenderContext } from "../../types.js";
import { defineTool } from "../../types.js";
import { applyPatch } from "./apply.js";
import { APPLY_PATCH_FREEFORM_DESCRIPTION, APPLY_PATCH_LARK_GRAMMAR, APPLY_PATCH_PARAMS } from "./constants.js";
import { normalizeApplyPatchArguments } from "./params.js";
import { createPendingPatchUpdate } from "./preview.js";
import { renderPatchPreview } from "./preview-format.js";
import { renderStreamingPatchCall } from "./streaming-render.js";
import type {
	ApplyPatchRenderState,
	ApplyPatchTheme,
	ApplyPatchToolDefinition,
	ApplyPatchToolDetails,
	FreeformToolFormat,
} from "./types.js";

function renderTitle(theme: ApplyPatchTheme): Text {
	return new Text(theme.fg("toolTitle", theme.bold("apply_patch")), 0, 0);
}

function renderPreviewBox(
	title: string,
	details: ApplyPatchToolDetails,
	isPartial: boolean,
	theme: ApplyPatchTheme,
): Container {
	const component = new Container();
	if (!details.preview) return component;
	const bgName = isPartial ? "toolPendingBg" : "toolSuccessBg";
	const box = new Box(1, 1, (text: string) => theme.bg(bgName, text));
	box.addChild(new Text(theme.fg("toolTitle", theme.bold(title)), 0, 0));
	box.addChild(new Spacer(1));
	box.addChild(new Text(renderPatchPreview(details.preview, theme), 0, 0));
	component.addChild(box);
	return component;
}

function renderTextResult(
	result: AgentToolResult<ApplyPatchToolDetails | undefined>,
	theme: ApplyPatchTheme,
): Container {
	const component = new Container();
	const text = result.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.filter((value) => typeof value === "string" && value.length > 0)
		.join("\n");
	if (text) component.addChild(new Text(theme.fg("toolOutput", text), 0, 0));
	return component;
}

export function createApplyPatchTool(): ApplyPatchToolDefinition {
	const tool = defineTool<typeof APPLY_PATCH_PARAMS, ApplyPatchToolDetails | undefined, ApplyPatchRenderState>({
		name: "apply_patch",
		label: "ApplyPatch",
		description: APPLY_PATCH_FREEFORM_DESCRIPTION,
		parameters: APPLY_PATCH_PARAMS,
		prepareArguments: normalizeApplyPatchArguments,
		promptSnippet: "Apply Codex-format file patches with apply_patch",
		promptGuidelines: [
			"Use apply_patch for file edits instead of mutating files through bash, Python scripts, heredocs, or shell redirection.",
			"After apply_patch succeeds, do not re-read the edited files just to confirm the patch applied.",
		],
		async execute(
			_toolCallId,
			params,
			_signal,
			onUpdate,
			ctx,
		): Promise<AgentToolResult<ApplyPatchToolDetails | undefined>> {
			const normalizedParams = normalizeApplyPatchArguments(params);
			if (!normalizedParams.input) throw new Error("input is required");
			const pendingUpdate = await createPendingPatchUpdate(ctx.cwd, normalizedParams.input);
			onUpdate?.({ content: [{ type: "text", text: pendingUpdate.text }], details: pendingUpdate.details });
			const summaries = await applyPatch(ctx.cwd, normalizedParams.input);
			return { content: [{ type: "text", text: summaries.join("\n") }], details: pendingUpdate.details };
		},
		renderCall(args, theme, context: ToolRenderContext<ApplyPatchRenderState, { input: string }>) {
			if (!context.executionStarted) {
				const streaming = renderStreamingPatchCall(normalizeApplyPatchArguments(args), theme, context.state);
				if (streaming) return streaming;
			}
			return renderTitle(theme);
		},
		renderResult(result, options, theme) {
			if (result.details?.preview) {
				return renderPreviewBox(
					options.isPartial ? "Applying patch" : "Applied patch",
					result.details,
					options.isPartial,
					theme,
				);
			}
			return renderTextResult(result, theme);
		},
	});

	return Object.assign(tool, {
		freeform: { type: "grammar", syntax: "lark", definition: APPLY_PATCH_LARK_GRAMMAR } satisfies FreeformToolFormat,
	});
}
