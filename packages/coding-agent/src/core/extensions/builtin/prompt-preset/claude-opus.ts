import { type BuildDynamicSystemPromptOptions, buildDynamicSystemPrompt } from "../../../dynamic-prompt/build.js";

function buildClaudeOpusTuning(): string {
	return `## Model Notes (Claude Opus)

This model interprets prompts more literally than prior generations. When an instruction names a scope like "every", "all", or "for each", apply it to the full set rather than the first item.`;
}

export function buildClaudeOpusPrompt(options: BuildDynamicSystemPromptOptions): string {
	return buildDynamicSystemPrompt({ ...options, tuningSection: buildClaudeOpusTuning() });
}
