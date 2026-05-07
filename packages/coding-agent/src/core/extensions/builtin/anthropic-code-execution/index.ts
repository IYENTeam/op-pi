import type { Api } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "../../types.js";

type ToolDefinition = Record<string, unknown>;

const CODE_EXECUTION_ENV = "PI_ANTHROPIC_CODE_EXECUTION";
const CODE_EXECUTION_TOOL = {
	type: "code_execution_20250825",
	name: "code_execution",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isCodeExecutionType(value: unknown): value is string {
	return typeof value === "string" && value.startsWith("code_execution_");
}

function sanitizeTools(tools: unknown[]): ToolDefinition[] {
	const sanitizedTools: ToolDefinition[] = [];
	for (const tool of tools) {
		if (!isRecord(tool)) {
			continue;
		}

		const shouldStripFunctionVariant = tool.name === "code_execution" && !isCodeExecutionType(tool.type);
		if (!shouldStripFunctionVariant) {
			sanitizedTools.push(tool);
		}
	}
	return sanitizedTools;
}

export function isCodeExecutionEnabled(): boolean {
	const value = process.env[CODE_EXECUTION_ENV];
	if (!value) {
		return false;
	}

	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function addAnthropicCodeExecutionToPayload(api: Api | undefined, payload: unknown): unknown {
	if (api !== "anthropic-messages") {
		return payload;
	}

	if (!isCodeExecutionEnabled()) {
		return payload;
	}

	if (!isRecord(payload)) {
		return payload;
	}

	const tools = Array.isArray(payload.tools) ? payload.tools : [];
	const sanitizedTools = sanitizeTools(tools);
	const hasNativeCodeExecution = sanitizedTools.some((tool) => isCodeExecutionType(tool.type));
	if (!hasNativeCodeExecution) {
		sanitizedTools.push(CODE_EXECUTION_TOOL);
	}

	return {
		...payload,
		tools: sanitizedTools,
	};
}

export const ANTHROPIC_CODE_EXECUTION_SECTION = `
## Code Execution

The native code_execution tool is available in this session. The model
runs Python (and shell commands via the bash subtool) inside an
Anthropic-managed sandbox container. Prefer code_execution for
numerical work, file analysis, and one-off computations when explicit
results are needed.
`;

export default function anthropicCodeExecutionExtension(pi: ExtensionAPI): void {
	pi.on("before_provider_request", (event, ctx) => {
		return addAnthropicCodeExecutionToPayload(ctx.model?.api, event.payload);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (ctx.model?.api !== "anthropic-messages") {
			return undefined;
		}

		if (!isCodeExecutionEnabled()) {
			return undefined;
		}

		return {
			systemPrompt: `${event.systemPrompt}\n${ANTHROPIC_CODE_EXECUTION_SECTION}`,
		};
	});
}
