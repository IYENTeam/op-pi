import { afterEach, describe, expect, it } from "vitest";
import {
	ANTHROPIC_CODE_EXECUTION_SECTION,
	addAnthropicCodeExecutionToPayload,
	isCodeExecutionEnabled,
} from "../../src/core/extensions/builtin/anthropic-code-execution/index.js";

const CODE_EXECUTION_ENV = "PI_ANTHROPIC_CODE_EXECUTION";

afterEach(() => {
	delete process.env[CODE_EXECUTION_ENV];
});

describe("anthropic-code-execution builtin extension", () => {
	it("is a no-op when env var is unset, even on anthropic-messages", () => {
		const payload = {
			tools: [{ name: "some_tool", description: "function tool" }],
		};

		const result = addAnthropicCodeExecutionToPayload("anthropic-messages", payload);

		expect(result).toBe(payload);
	});

	it("is a no-op for explicitly disabled env values", () => {
		const payload = {
			tools: [{ name: "some_tool", description: "function tool" }],
		};

		process.env[CODE_EXECUTION_ENV] = "0";
		expect(addAnthropicCodeExecutionToPayload("anthropic-messages", payload)).toBe(payload);

		process.env[CODE_EXECUTION_ENV] = "false";
		expect(addAnthropicCodeExecutionToPayload("anthropic-messages", payload)).toBe(payload);

		process.env[CODE_EXECUTION_ENV] = "off";
		expect(addAnthropicCodeExecutionToPayload("anthropic-messages", payload)).toBe(payload);
	});

	it("is a no-op for empty or garbage env values", () => {
		const payload = {
			tools: [{ name: "some_tool", description: "function tool" }],
		};

		process.env[CODE_EXECUTION_ENV] = "";
		expect(addAnthropicCodeExecutionToPayload("anthropic-messages", payload)).toBe(payload);

		process.env[CODE_EXECUTION_ENV] = "garbage";
		expect(addAnthropicCodeExecutionToPayload("anthropic-messages", payload)).toBe(payload);
	});

	it("is a no-op when api is not anthropic-messages, even with env enabled", () => {
		process.env[CODE_EXECUTION_ENV] = "on";
		const payload = {
			tools: [{ name: "code_execution", description: "function variant" }],
		};

		const result = addAnthropicCodeExecutionToPayload("openai-responses", payload);

		expect(result).toBe(payload);
	});

	it("injects native code_execution_20250825 when enabled and no native tool exists", () => {
		process.env[CODE_EXECUTION_ENV] = "true";

		const result = addAnthropicCodeExecutionToPayload("anthropic-messages", {
			tools: [{ name: "other_tool" }],
		}) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).toContainEqual({
			type: "code_execution_20250825",
			name: "code_execution",
		});
	});

	it("preserves caller-supplied native code_execution variant without duplication", () => {
		process.env[CODE_EXECUTION_ENV] = "yes";
		const payload = {
			tools: [{ type: "code_execution_20260120", name: "code_execution", extra: "preserve" }],
		};

		const result = addAnthropicCodeExecutionToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const codeExecutionTools = result.tools.filter((tool) => tool.name === "code_execution");
		expect(codeExecutionTools).toHaveLength(1);
		expect(codeExecutionTools[0]).toEqual({
			type: "code_execution_20260120",
			name: "code_execution",
			extra: "preserve",
		});
	});

	it("strips function-tool code_execution variant when enabled on anthropic-messages", () => {
		process.env[CODE_EXECUTION_ENV] = "1";
		const payload = {
			tools: [{ name: "code_execution", description: "function variant" }, { name: "other_tool" }],
		};

		const result = addAnthropicCodeExecutionToPayload("anthropic-messages", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const codeExecutionTools = result.tools.filter((tool) => tool.name === "code_execution");
		expect(codeExecutionTools).toHaveLength(1);
		expect(codeExecutionTools[0]).toEqual({
			type: "code_execution_20250825",
			name: "code_execution",
		});
	});

	it("does not strip function-tool code_execution variant when api is non-anthropic", () => {
		process.env[CODE_EXECUTION_ENV] = "on";
		const payload = {
			tools: [{ name: "code_execution", description: "function variant" }],
		};

		const result = addAnthropicCodeExecutionToPayload("openai-completions", payload);

		expect(result).toBe(payload);
	});

	it("does not strip function-tool code_execution variant when env var is disabled", () => {
		process.env[CODE_EXECUTION_ENV] = "off";
		const payload = {
			tools: [{ name: "code_execution", description: "function variant" }],
		};

		const result = addAnthropicCodeExecutionToPayload("anthropic-messages", payload);

		expect(result).toBe(payload);
	});
});

describe("isCodeExecutionEnabled", () => {
	it.each(["1", "true", "yes", "on", "TRUE", "Yes", "ON", "  on  "])("returns true for truthy value %s", (value) => {
		process.env[CODE_EXECUTION_ENV] = value;
		expect(isCodeExecutionEnabled()).toBe(true);
	});

	it.each([undefined, "", "0", "false", "no", "off", "garbage", "enable", "enabled"])(
		"returns false for non-truthy value %s",
		(value) => {
			if (value === undefined) {
				delete process.env[CODE_EXECUTION_ENV];
			} else {
				process.env[CODE_EXECUTION_ENV] = value;
			}
			expect(isCodeExecutionEnabled()).toBe(false);
		},
	);
});

describe("ANTHROPIC_CODE_EXECUTION_SECTION", () => {
	it("is non-empty and mentions code execution availability", () => {
		expect(ANTHROPIC_CODE_EXECUTION_SECTION.trim().length).toBeGreaterThan(0);
		expect(ANTHROPIC_CODE_EXECUTION_SECTION.toLowerCase()).toContain("code_execution");
		expect(ANTHROPIC_CODE_EXECUTION_SECTION.toLowerCase()).toContain("available");
	});
});
