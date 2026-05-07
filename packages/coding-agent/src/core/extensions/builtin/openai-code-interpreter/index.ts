import type { Api } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "../../types.js";

type ToolDefinition = Record<string, unknown>;

const OPENAI_RESPONSES_APIS: ReadonlySet<Api> = new Set(["openai-responses", "azure-openai-responses"]);
const CODE_INTERPRETER_ENV = "PI_OPENAI_CODE_INTERPRETER";
const CODE_INTERPRETER_CONTAINER_ENV = "PI_OPENAI_CODE_INTERPRETER_CONTAINER";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isOpenAiResponsesApi(api: Api | undefined): api is "openai-responses" | "azure-openai-responses" {
	return api !== undefined && OPENAI_RESPONSES_APIS.has(api);
}

function isCodeInterpreterTool(tool: ToolDefinition): boolean {
	return tool.type === "code_interpreter";
}

function isCodeInterpreterFunctionVariant(tool: ToolDefinition): boolean {
	return tool.type === "function" && tool.name === "code_interpreter";
}

function sanitizeTools(tools: unknown[]): ToolDefinition[] {
	const sanitizedTools: ToolDefinition[] = [];
	for (const tool of tools) {
		if (!isRecord(tool)) {
			continue;
		}

		if (!isCodeInterpreterFunctionVariant(tool)) {
			sanitizedTools.push(tool);
		}
	}
	return sanitizedTools;
}

export function isCodeInterpreterEnabled(): boolean {
	const value = process.env[CODE_INTERPRETER_ENV];
	if (!value) {
		return false;
	}

	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getCodeInterpreterContainer(): string | { type: "auto" } {
	const value = process.env[CODE_INTERPRETER_CONTAINER_ENV];
	if (!value) {
		return { type: "auto" };
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return { type: "auto" };
	}

	return trimmed;
}

export function addOpenaiCodeInterpreterToPayload(api: Api | undefined, payload: unknown): unknown {
	if (!isOpenAiResponsesApi(api)) {
		return payload;
	}

	if (!isCodeInterpreterEnabled()) {
		return payload;
	}

	if (!isRecord(payload)) {
		return payload;
	}

	const tools = Array.isArray(payload.tools) ? payload.tools : [];
	const sanitizedTools = sanitizeTools(tools);
	const hasNativeCodeInterpreter = sanitizedTools.some((tool) => isCodeInterpreterTool(tool));
	if (!hasNativeCodeInterpreter) {
		sanitizedTools.push({
			type: "code_interpreter",
			container: getCodeInterpreterContainer(),
		});
	}

	return {
		...payload,
		tools: sanitizedTools,
	};
}

export const OPENAI_CODE_INTERPRETER_SECTION = `
## Code Interpreter

The native code_interpreter tool is available in this session. The model
runs Python in an OpenAI-managed sandbox container. Use code_interpreter
for numerical work, file analysis, and one-off computations when explicit
results are needed.
`;

export default function openaiCodeInterpreterExtension(pi: ExtensionAPI): void {
	pi.on("before_provider_request", (event, ctx) => {
		return addOpenaiCodeInterpreterToPayload(ctx.model?.api, event.payload);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!isOpenAiResponsesApi(ctx.model?.api)) {
			return undefined;
		}

		if (!isCodeInterpreterEnabled()) {
			return undefined;
		}

		return {
			systemPrompt: `${event.systemPrompt}\n${OPENAI_CODE_INTERPRETER_SECTION}`,
		};
	});
}
