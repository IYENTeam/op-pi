import { type BuildDynamicSystemPromptOptions, buildDynamicSystemPrompt } from "../../../dynamic-prompt/build.js";

function buildKimiK26Tuning(): string {
	return `## Model Notes (Kimi K2)

This model was post-trained with Toggle RL for token efficiency and a Generative Reward Model that rewards strict instruction following and aggressive intent inference. Trust that prior: avoid restating the user's request, do not re-derive facts you already established this turn, and skip filler verification language ("let me confirm again", "to be sure", "just to double-check").

The intent gate routing line is exempt from token economy: it is required every turn. On confirmation turns where the user already chose an option in plain words, the routing line should acknowledge that choice and execute, not re-litigate alternatives the user already eliminated.`;
}

export function buildKimiK26Prompt(options: BuildDynamicSystemPromptOptions): string {
	return buildDynamicSystemPrompt({ ...options, tuningSection: buildKimiK26Tuning() });
}
