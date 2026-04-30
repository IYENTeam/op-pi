import type { Api, Model } from "@mariozechner/pi-ai";
import type { BuildDynamicSystemPromptOptions } from "../../../dynamic-prompt/build.js";
import { buildClaudeOpusPrompt } from "./claude-opus.js";
import { buildGpt5Prompt } from "./gpt-5.js";
import { buildKimiK26Prompt } from "./kimi-k2-6.js";
import type { PromptPresetName, PromptPresetSettings } from "./settings.js";

export type { PromptPresetSettings } from "./settings.js";

type ResolvedPresetName = Exclude<PromptPresetName, "auto">;

export interface ResolvedPromptPreset {
	name: ResolvedPresetName;
	prompt: string;
}

function normalizeModelId(modelId: string): string {
	return modelId.toLowerCase();
}

function isGpt5FamilyModel(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	return normalized.includes("gpt-5.4") || normalized.includes("gpt-5.5");
}

function isKimiK26Model(modelId: string): boolean {
	return normalizeModelId(modelId).includes("kimi-k2.6");
}

function isClaudeOpusModel(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	return normalized.includes("opus-4-7") || normalized.includes("opus-4-6");
}

export function resolvePresetName(
	model: Pick<Model<Api>, "id" | "provider">,
	settings: PromptPresetSettings,
): ResolvedPresetName | undefined {
	if (
		settings.promptPreset === "claude-opus" ||
		settings.promptPreset === "kimi-k2-6" ||
		settings.promptPreset === "gpt-5"
	) {
		return settings.promptPreset;
	}

	if (isGpt5FamilyModel(model.id)) {
		return "gpt-5";
	}
	if (isKimiK26Model(model.id)) {
		return "kimi-k2-6";
	}
	if (isClaudeOpusModel(model.id)) {
		return "claude-opus";
	}
	return undefined;
}

function buildPreset(name: ResolvedPresetName, options: BuildDynamicSystemPromptOptions): ResolvedPromptPreset {
	if (name === "gpt-5") {
		return { name, prompt: buildGpt5Prompt(options) };
	}
	if (name === "kimi-k2-6") {
		return { name, prompt: buildKimiK26Prompt(options) };
	}
	return { name, prompt: buildClaudeOpusPrompt(options) };
}

function withDefaults(options: Partial<BuildDynamicSystemPromptOptions> = {}): BuildDynamicSystemPromptOptions {
	return {
		cwd: options.cwd ?? "",
		selectedTools: options.selectedTools ?? [],
		toolSnippets: options.toolSnippets ?? {},
		promptGuidelines: options.promptGuidelines ?? [],
		contextFiles: options.contextFiles ?? [],
		skills: options.skills ?? [],
	};
}

export function resolvePreset(
	model: Pick<Model<Api>, "id" | "provider">,
	settings: PromptPresetSettings,
	options?: Partial<BuildDynamicSystemPromptOptions>,
): ResolvedPromptPreset | undefined {
	const name = resolvePresetName(model, settings);
	if (!name) {
		return undefined;
	}
	return buildPreset(name, withDefaults(options));
}
