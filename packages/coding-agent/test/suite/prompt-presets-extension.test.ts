import type { Api, Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { buildDynamicSystemPrompt } from "../../src/core/dynamic-prompt/build.js";
import { type PromptPresetSettings, resolvePreset } from "../../src/core/extensions/builtin/prompt-preset/presets.js";

function createModel(id: string, provider: string, api: Api = "openai-responses"): Model<Api> {
	return {
		id,
		name: id,
		api,
		provider,
		baseUrl: "https://example.com/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
	};
}

function fallbackPrompt(): string {
	return buildDynamicSystemPrompt({
		cwd: "/repo",
		selectedTools: ["read", "bash", "edit", "write"],
		toolSnippets: {
			read: "Read file contents",
			bash: "Execute shell commands",
			edit: "Edit existing files",
			write: "Write files",
		},
		promptGuidelines: ["Use read before edit."],
		contextFiles: [{ path: "/repo/AGENTS.md", content: "Follow project conventions." }],
		skills: [],
	});
}

describe("prompt preset resolver", () => {
	it.each([
		{
			id: "gpt-5.4",
			provider: "openai",
			api: "openai-responses" as const,
			expectedName: "gpt-5.4" as const,
		},
		{
			id: "gpt-5.5",
			provider: "openai-codex",
			api: "openai-codex-responses" as const,
			expectedName: "gpt-5.5" as const,
		},
		{
			id: "gpt-5.5-pro",
			provider: "openai",
			api: "openai-responses" as const,
			expectedName: "gpt-5.5" as const,
		},
	])("returns $expectedName preset for $provider/$id", ({ id, provider, api, expectedName }) => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel(id, provider, api);

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe(expectedName);
		expect(preset?.prompt).toContain("You are senpi");
		expect(preset?.prompt).toContain("## Model Notes (GPT-5)");
		expect(preset?.prompt).toContain("outcome-first");
		expect(preset?.prompt).toContain("## Intent Gate");
		expect(preset?.prompt).toContain("I read this as");
		expect(preset?.prompt.length).toBeGreaterThan(2_000);
	});

	it.each([
		{ id: "claude-opus-4-7", provider: "anthropic", api: "anthropic-messages" as const },
		{ id: "claude-opus-4-6", provider: "anthropic", api: "anthropic-messages" as const },
		{ id: "us.anthropic.claude-opus-4-6-v1", provider: "amazon-bedrock", api: "bedrock-converse-stream" as const },
	])("returns claude-opus preset for $provider/$id", ({ id, provider, api }) => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel(id, provider, api);

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("claude-opus");
		expect(preset?.prompt).toContain("You are senpi");
		expect(preset?.prompt).toContain("## Model Notes (Claude Opus)");
		expect(preset?.prompt).toContain("more literally");
		expect(preset?.prompt).toContain("## Intent Gate");
		expect(preset?.prompt).toContain("I read this as");
		expect(preset?.prompt.length).toBeGreaterThan(2_000);
	});

	it("returns kimi-k2-6 preset for kimi/moonshotai/kimi-k2.6", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel("moonshotai/kimi-k2.6", "kimi", "openai-completions");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("kimi-k2-6");
		expect(preset?.prompt).toContain("You are senpi");
		expect(preset?.prompt).toContain("## Model Notes (Kimi K2)");
		expect(preset?.prompt).toContain("Toggle RL");
		expect(preset?.prompt).toContain("intent gate routing line is exempt");
		expect(preset?.prompt).toContain("## Intent Gate");
	});

	it.each([
		{ id: "gpt-5.6", provider: "openai" },
		{ id: "claude-sonnet-4-5", provider: "anthropic", api: "anthropic-messages" as const },
	])("returns undefined so senpi-current remains unchanged for $provider/$id", ({ id, provider, api }) => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel(id, provider, api ?? "openai-responses");
		const currentPrompt = fallbackPrompt();

		// when
		const preset = resolvePreset(model, settings);
		const activePrompt = preset?.prompt ?? currentPrompt;

		// then
		expect(preset).toBeUndefined();
		expect(activePrompt).toBe(currentPrompt);
		expect(activePrompt.length).toBe(currentPrompt.length);
		expect(activePrompt).toContain("## Available Tools");
		expect(activePrompt).toContain("Current working directory: /repo");
	});

	it("allows settings.json to force claude-opus regardless of model id", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "claude-opus" };
		const model = createModel("gpt-5.5", "openai-codex", "openai-codex-responses");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("claude-opus");
		expect(preset?.prompt).toContain("## Model Notes (Claude Opus)");
	});

	it("allows settings.json to force gpt-5 regardless of model id", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "gpt-5" };
		const model = createModel("claude-opus-4-7", "anthropic", "anthropic-messages");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("gpt-5");
		expect(preset?.prompt).toContain("## Model Notes (GPT-5)");
	});

	it("allows settings.json to force kimi-k2-6 regardless of model id", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "kimi-k2-6" };
		const model = createModel("gpt-5.5", "openai-codex", "openai-codex-responses");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("kimi-k2-6");
		expect(preset?.prompt).toContain("## Model Notes (Kimi K2)");
		expect(preset?.prompt).toContain("Toggle RL");
	});

	it("does not include Kimi tuning in claude-opus preset", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel("claude-opus-4-7", "anthropic", "anthropic-messages");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("claude-opus");
		expect(preset?.prompt).not.toContain("Toggle RL");
		expect(preset?.prompt).not.toContain("Model Notes (Kimi K2)");
		expect(preset?.prompt).not.toContain("Model Notes (GPT-5)");
	});

	it("does not include Kimi tuning in gpt-5 preset", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "auto" };
		const model = createModel("gpt-5.5", "openai-codex", "openai-codex-responses");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("gpt-5.5");
		expect(preset?.prompt).not.toContain("Toggle RL");
		expect(preset?.prompt).not.toContain("Model Notes (Kimi K2)");
		expect(preset?.prompt).not.toContain("Model Notes (Claude Opus)");
	});

	it("allows settings.json to force gpt-5.4 regardless of model id", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "gpt-5.4" };
		const model = createModel("claude-opus-4-7", "anthropic", "anthropic-messages");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("gpt-5.4");
		expect(preset?.prompt).toContain("## Model Notes (GPT-5)");
	});

	it("allows settings.json to force gpt-5.5 regardless of model id", () => {
		// given
		const settings: PromptPresetSettings = { promptPreset: "gpt-5.5" };
		const model = createModel("claude-opus-4-7", "anthropic", "anthropic-messages");

		// when
		const preset = resolvePreset(model, settings);

		// then
		expect(preset?.name).toBe("gpt-5.5");
		expect(preset?.prompt).toContain("## Model Notes (GPT-5)");
	});
});
