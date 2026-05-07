import { afterEach, describe, expect, it } from "vitest";
import anthropicWebFetchExtension, {
	addAnthropicWebFetchToPayload,
	isAnthropicWebFetchEnabled,
} from "../../src/core/extensions/builtin/anthropic-web-fetch/index.js";
import type { ExtensionAPI } from "../../src/core/extensions/types.js";

const ENABLE_ENV = "PI_ANTHROPIC_WEB_FETCH";
const MAX_USES_ENV = "PI_ANTHROPIC_WEB_FETCH_MAX_USES";

afterEach(() => {
	delete process.env[ENABLE_ENV];
	delete process.env[MAX_USES_ENV];
});

describe("anthropic-web-fetch builtin extension", () => {
	it("is a no-op when model api is not anthropic-messages", () => {
		const payload = {
			tools: [{ name: "webfetch", description: "function tool" }],
		};

		const result = addAnthropicWebFetchToPayload("openai-responses", payload);

		expect(result).toBe(payload);
	});

	it("injects the native Anthropic web_fetch tool when missing", () => {
		const payload = {
			model: "claude-sonnet-4-5",
			tools: [{ name: "other_tool" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload) as {
			tools: unknown[];
		};

		expect(result.tools).toContainEqual({
			type: "web_fetch_20260309",
			name: "web_fetch",
		});
	});

	it("preserves caller-supplied native web_fetch version without duplication", () => {
		const payload = {
			tools: [{ type: "web_fetch_20250910", name: "web_fetch" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const webFetchTools = result.tools.filter((tool) => tool.name === "web_fetch");
		expect(webFetchTools).toHaveLength(1);
		expect(webFetchTools[0]).toEqual({ type: "web_fetch_20250910", name: "web_fetch" });
	});

	it("strips function-tool webfetch and replaces it with Anthropic native tool", () => {
		const payload = {
			tools: [{ name: "webfetch", description: "senpi webfetch function" }, { name: "other_tool" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const webFetchFunctionTools = result.tools.filter((tool) => tool.name === "webfetch");
		const webFetchNativeTools = result.tools.filter((tool) => tool.name === "web_fetch");

		expect(webFetchFunctionTools).toHaveLength(0);
		expect(webFetchNativeTools).toHaveLength(1);
		expect(webFetchNativeTools[0]).toEqual({ type: "web_fetch_20260309", name: "web_fetch" });
	});

	it("strips function-tool web_fetch with no type field", () => {
		const payload = {
			tools: [{ name: "web_fetch", description: "alternative function tool" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const webFetchTools = result.tools.filter((tool) => tool.name === "web_fetch");
		expect(webFetchTools).toHaveLength(1);
		expect(webFetchTools[0]).toEqual({ type: "web_fetch_20260309", name: "web_fetch" });
	});

	it("does not strip function-tool webfetch when api is non-anthropic", () => {
		const payload = {
			tools: [{ name: "webfetch", description: "senpi webfetch function" }],
		};

		const result = addAnthropicWebFetchToPayload("openai-completions", payload);

		expect(result).toBe(payload);
	});

	it("uses env override for max_uses and omits max_uses without env var", () => {
		const payloadWithoutEnv = { tools: [{ name: "other_tool" }] };
		const resultWithoutEnv = addAnthropicWebFetchToPayload("anthropic-messages", payloadWithoutEnv) as {
			tools: Array<Record<string, unknown>>;
		};
		const withoutEnvTool = resultWithoutEnv.tools.find((tool) => tool.name === "web_fetch");

		expect(withoutEnvTool).toEqual({ type: "web_fetch_20260309", name: "web_fetch" });
		expect(withoutEnvTool).not.toHaveProperty("max_uses");

		process.env[MAX_USES_ENV] = "20";
		const payloadWithEnv = { tools: [{ name: "other_tool" }] };
		const resultWithEnv = addAnthropicWebFetchToPayload("anthropic-messages", payloadWithEnv) as {
			tools: Array<Record<string, unknown>>;
		};
		const withEnvTool = resultWithEnv.tools.find((tool) => tool.name === "web_fetch");

		expect(withEnvTool).toEqual({ type: "web_fetch_20260309", name: "web_fetch", max_uses: 20 });
	});

	it("returns original payload reference when explicitly disabled", () => {
		process.env[ENABLE_ENV] = "0";
		const payload = {
			tools: [{ name: "webfetch", description: "function tool" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload);

		expect(result).toBe(payload);
	});

	it("still behaves as default-on when enable env is unset", () => {
		const payload = {
			tools: [{ name: "other_tool" }],
		};

		const result = addAnthropicWebFetchToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};
		const webFetchTool = result.tools.find((tool) => tool.name === "web_fetch");

		expect(webFetchTool).toEqual({ type: "web_fetch_20260309", name: "web_fetch" });
	});
});

describe("isAnthropicWebFetchEnabled", () => {
	it("returns true when env is unset", () => {
		expect(isAnthropicWebFetchEnabled()).toBe(true);
	});

	it.each(["1", "true", "yes", "on", "TRUE", "YES", "  on  "])("returns true for truthy value %s", (value) => {
		process.env[ENABLE_ENV] = value;
		expect(isAnthropicWebFetchEnabled()).toBe(true);
	});

	it.each(["0", "false", "no", "off", "OFF", "  no  "])("returns false for falsy value %s", (value) => {
		process.env[ENABLE_ENV] = value;
		expect(isAnthropicWebFetchEnabled()).toBe(false);
	});

	it.each(["garbage", "enable", "enabled"])("returns true for unknown value %s", (value) => {
		process.env[ENABLE_ENV] = value;
		expect(isAnthropicWebFetchEnabled()).toBe(true);
	});
});

describe("anthropic-web-fetch before_agent_start", () => {
	it("does not append system prompt when explicitly disabled", async () => {
		process.env[ENABLE_ENV] = "off";

		type BeforeAgentStartHandler = (
			event: { systemPrompt: string },
			ctx: { model?: { api?: string } },
		) => Promise<{ systemPrompt: string } | undefined>;

		let beforeAgentStartHandler: BeforeAgentStartHandler | undefined;
		const pi = {
			on(eventName: string, handler: unknown) {
				if (eventName === "before_agent_start") {
					beforeAgentStartHandler = handler as BeforeAgentStartHandler;
				}
			},
		} satisfies Pick<ExtensionAPI, "on">;

		anthropicWebFetchExtension(pi as ExtensionAPI);
		expect(beforeAgentStartHandler).toBeDefined();

		const result = await beforeAgentStartHandler?.(
			{ systemPrompt: "system" },
			{ model: { api: "anthropic-messages" } },
		);

		expect(result).toBeUndefined();
	});
});
