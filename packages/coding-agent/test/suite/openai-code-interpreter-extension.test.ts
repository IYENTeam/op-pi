import { afterEach, describe, expect, it } from "vitest";
import openaiCodeInterpreterExtension, {
	addOpenaiCodeInterpreterToPayload,
	getCodeInterpreterContainer,
	isCodeInterpreterEnabled,
	OPENAI_CODE_INTERPRETER_SECTION,
} from "../../src/core/extensions/builtin/openai-code-interpreter/index.js";
import type { ExtensionAPI } from "../../src/core/extensions/types.js";

const CODE_INTERPRETER_ENV = "PI_OPENAI_CODE_INTERPRETER";
const CODE_INTERPRETER_CONTAINER_ENV = "PI_OPENAI_CODE_INTERPRETER_CONTAINER";

afterEach(() => {
	delete process.env[CODE_INTERPRETER_ENV];
	delete process.env[CODE_INTERPRETER_CONTAINER_ENV];
});

describe("openai-code-interpreter builtin extension", () => {
	it("is a no-op when env var is unset, even on openai-responses", () => {
		const payload = {
			tools: [{ name: "some_tool", description: "function tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload);

		expect(result).toBe(payload);
	});

	it.each(["0", "false", "no", "off", "", "garbage"])("is a no-op for disabled env value %s", (value) => {
		process.env[CODE_INTERPRETER_ENV] = value;
		const payload = {
			tools: [{ name: "some_tool", description: "function tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload);

		expect(result).toBe(payload);
	});

	it("is a no-op when api is openai-completions even with env enabled", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const payload = {
			tools: [{ name: "code_interpreter", description: "function variant" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-completions", payload);

		expect(result).toBe(payload);
	});

	it("is a no-op when api is anthropic-messages even with env enabled", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const payload = {
			tools: [{ name: "code_interpreter", description: "function variant" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("anthropic-messages", payload);

		expect(result).toBe(payload);
	});

	it("is a no-op when api is google-generative-language even with env enabled", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const payload = {
			tools: [{ name: "code_interpreter", description: "function variant" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("google-generative-language", payload);

		expect(result).toBe(payload);
	});

	it("injects native code_interpreter with auto container on openai-responses", () => {
		process.env[CODE_INTERPRETER_ENV] = "true";
		const payload = {
			tools: [{ name: "other_tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).toContainEqual({
			type: "code_interpreter",
			container: { type: "auto" },
		});
	});

	it("injects native code_interpreter with auto container on azure-openai-responses", () => {
		process.env[CODE_INTERPRETER_ENV] = "true";
		const payload = {
			tools: [{ name: "other_tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("azure-openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).toContainEqual({
			type: "code_interpreter",
			container: { type: "auto" },
		});
	});

	it("preserves caller-supplied native tool with string container and does not duplicate", () => {
		process.env[CODE_INTERPRETER_ENV] = "yes";
		const payload = {
			tools: [{ type: "code_interpreter", container: "cntr_xyz", extra: "preserve" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const codeInterpreterTools = result.tools.filter((tool) => tool.type === "code_interpreter");
		expect(codeInterpreterTools).toHaveLength(1);
		expect(codeInterpreterTools[0]).toEqual({ type: "code_interpreter", container: "cntr_xyz", extra: "preserve" });
	});

	it("preserves caller-supplied native tool with object container and does not duplicate", () => {
		process.env[CODE_INTERPRETER_ENV] = "yes";
		const payload = {
			tools: [{ type: "code_interpreter", container: { type: "auto", memory_limit: "4g" }, extra: "preserve" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		const codeInterpreterTools = result.tools.filter((tool) => tool.type === "code_interpreter");
		expect(codeInterpreterTools).toHaveLength(1);
		expect(codeInterpreterTools[0]).toEqual({
			type: "code_interpreter",
			container: { type: "auto", memory_limit: "4g" },
			extra: "preserve",
		});
	});

	it("strips function-tool code_interpreter variant when enabled on matching api", () => {
		process.env[CODE_INTERPRETER_ENV] = "1";
		const payload = {
			tools: [{ type: "function", name: "code_interpreter" }, { name: "other_tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).not.toContainEqual({ type: "function", name: "code_interpreter" });
		expect(result.tools).toContainEqual({ type: "code_interpreter", container: { type: "auto" } });
	});

	it("does not strip function-tool code_interpreter when env disabled", () => {
		process.env[CODE_INTERPRETER_ENV] = "off";
		const payload = {
			tools: [{ type: "function", name: "code_interpreter" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload);

		expect(result).toBe(payload);
	});

	it("does not strip function-tool code_interpreter when api does not match", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const payload = {
			tools: [{ type: "function", name: "code_interpreter" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-completions", payload);

		expect(result).toBe(payload);
	});

	it("does not strip function-tool with different name", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const payload = {
			tools: [{ type: "function", name: "python_run" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).toContainEqual({ type: "function", name: "python_run" });
	});

	it("uses container override during injection when env is set", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		process.env[CODE_INTERPRETER_CONTAINER_ENV] = "  cntr_abc123  ";
		const payload = {
			tools: [{ name: "other_tool" }],
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result.tools).toContainEqual({ type: "code_interpreter", container: "cntr_abc123" });
	});

	it("returns new object and keeps original tools unchanged when injecting", () => {
		process.env[CODE_INTERPRETER_ENV] = "on";
		const originalTools = [{ name: "other_tool" }];
		const payload = {
			tools: originalTools,
		};

		const result = addOpenaiCodeInterpreterToPayload("openai-responses", payload) as {
			tools: Array<Record<string, unknown>>;
		};

		expect(result).not.toBe(payload);
		expect(payload.tools).toEqual([{ name: "other_tool" }]);
		expect(result.tools).toContainEqual({ type: "code_interpreter", container: { type: "auto" } });
	});
});

describe("isCodeInterpreterEnabled", () => {
	it.each(["1", "true", "yes", "on", "TRUE", "Yes", "ON", "  on  "])("returns true for truthy value %s", (value) => {
		process.env[CODE_INTERPRETER_ENV] = value;
		expect(isCodeInterpreterEnabled()).toBe(true);
	});

	it.each([undefined, "", "0", "false", "no", "off", "garbage"])("returns false for non-truthy value %s", (value) => {
		if (value === undefined) {
			delete process.env[CODE_INTERPRETER_ENV];
		} else {
			process.env[CODE_INTERPRETER_ENV] = value;
		}

		expect(isCodeInterpreterEnabled()).toBe(false);
	});
});

describe("getCodeInterpreterContainer", () => {
	it("returns auto when container env is unset", () => {
		expect(getCodeInterpreterContainer()).toEqual({ type: "auto" });
	});

	it("returns auto when container env is empty", () => {
		process.env[CODE_INTERPRETER_CONTAINER_ENV] = "";
		expect(getCodeInterpreterContainer()).toEqual({ type: "auto" });
	});

	it("returns trimmed container id when env is set", () => {
		process.env[CODE_INTERPRETER_CONTAINER_ENV] = "  cntr_abc123  ";
		expect(getCodeInterpreterContainer()).toBe("cntr_abc123");
	});

	it("falls back to auto for whitespace-only env", () => {
		process.env[CODE_INTERPRETER_CONTAINER_ENV] = "   ";
		expect(getCodeInterpreterContainer()).toEqual({ type: "auto" });
	});
});

describe("OPENAI_CODE_INTERPRETER_SECTION", () => {
	it("is non-empty and mentions code interpreter", () => {
		expect(OPENAI_CODE_INTERPRETER_SECTION.trim().length).toBeGreaterThan(0);
		expect(OPENAI_CODE_INTERPRETER_SECTION.toLowerCase()).toContain("code_interpreter");
	});
});

describe("openai-code-interpreter before_agent_start", () => {
	it("does not append system prompt when api does not match", async () => {
		process.env[CODE_INTERPRETER_ENV] = "on";

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
		} as unknown as ExtensionAPI;

		openaiCodeInterpreterExtension(pi);
		const result = await beforeAgentStartHandler?.(
			{ systemPrompt: "base" },
			{ model: { api: "openai-completions" } },
		);

		expect(result).toBeUndefined();
	});

	it("appends system prompt when enabled on openai-responses", async () => {
		process.env[CODE_INTERPRETER_ENV] = "on";

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
		} as unknown as ExtensionAPI;

		openaiCodeInterpreterExtension(pi);
		const result = await beforeAgentStartHandler?.({ systemPrompt: "base" }, { model: { api: "openai-responses" } });

		expect(result?.systemPrompt).toContain("base");
		expect(result?.systemPrompt).toContain("Code Interpreter");
	});
});
