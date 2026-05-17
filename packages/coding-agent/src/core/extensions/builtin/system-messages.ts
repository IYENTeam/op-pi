import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { CustomMessage } from "../../messages.js";
import type { ExtensionAPI } from "../types.js";

export const OP_PI_SYSTEM_PREFIX = "[system:op-pi]";
export const OP_PI_CONVERSATION_EVENT = "op-pi:conversation";

export type BuiltinSystemMessageRoute = "todotools.continuation";
export type OpPiConversationAction = "injected" | "failed";

export interface OpPiConversationEvent {
	version: 1;
	source: "builtin";
	action: OpPiConversationAction;
	route: BuiltinSystemMessageRoute;
	sessionId?: string;
	timestamp: number;
	conversation: {
		prefix: typeof OP_PI_SYSTEM_PREFIX;
		kind: "custom_message" | "user_message";
		customType?: string;
		deliverAs?: "steer" | "followUp";
		triggerTurn?: boolean;
	};
	text: string;
	errorMessage?: string;
}

type BuiltinUserMessageOptions = {
	deliverAs?: "steer" | "followUp";
	sessionId?: string;
};

type BuiltinCustomMessageOptions = {
	triggerTurn?: boolean;
	deliverAs?: "steer" | "followUp" | "nextTurn";
	sessionId?: string;
};

function prefixText(text: string): string {
	return text.startsWith(OP_PI_SYSTEM_PREFIX) ? text : `${OP_PI_SYSTEM_PREFIX}\n${text}`;
}

function prefixContent(content: string | (TextContent | ImageContent)[]): string | (TextContent | ImageContent)[] {
	if (typeof content === "string") {
		return prefixText(content);
	}

	const firstTextIndex = content.findIndex((part) => part.type === "text");
	if (firstTextIndex === -1) {
		return [{ type: "text", text: OP_PI_SYSTEM_PREFIX }, ...content];
	}

	return content.map((part, index) => {
		if (part.type !== "text" || index !== firstTextIndex) {
			return part;
		}

		return {
			...part,
			text: prefixText(part.text),
		};
	});
}

function extractText(content: string | (TextContent | ImageContent)[]): string {
	if (typeof content === "string") {
		return content;
	}

	return content
		.filter((part): part is TextContent => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function emitOpPiConversationEvent(pi: ExtensionAPI, event: OpPiConversationEvent): void {
	pi.events.emit(OP_PI_CONVERSATION_EVENT, event);
}

function createBaseEvent(args: {
	action: OpPiConversationAction;
	route: BuiltinSystemMessageRoute;
	sessionId?: string;
	kind: "custom_message" | "user_message";
	customType?: string;
	deliverAs?: "steer" | "followUp";
	triggerTurn?: boolean;
	text: string;
	errorMessage?: string;
}): OpPiConversationEvent {
	return {
		version: 1,
		source: "builtin",
		action: args.action,
		route: args.route,
		sessionId: args.sessionId,
		timestamp: Date.now(),
		conversation: {
			prefix: OP_PI_SYSTEM_PREFIX,
			kind: args.kind,
			customType: args.customType,
			deliverAs: args.deliverAs,
			triggerTurn: args.triggerTurn,
		},
		text: args.text,
		errorMessage: args.errorMessage,
	};
}

function hasUserMessageOptions(
	options: BuiltinUserMessageOptions | undefined,
): options is BuiltinUserMessageOptions & { deliverAs: "steer" | "followUp" } {
	return options?.deliverAs !== undefined;
}

function hasCustomMessageOptions(
	options: BuiltinCustomMessageOptions | undefined,
): options is BuiltinCustomMessageOptions & { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" } {
	return options?.triggerTurn === true || options?.deliverAs !== undefined;
}

export function sendBuiltinUserMessage(
	pi: ExtensionAPI,
	route: BuiltinSystemMessageRoute,
	content: string | (TextContent | ImageContent)[],
	options?: BuiltinUserMessageOptions,
): void {
	const prefixedContent = prefixContent(content);

	emitOpPiConversationEvent(
		pi,
		createBaseEvent({
			action: "injected",
			route,
			sessionId: options?.sessionId,
			kind: "user_message",
			text: extractText(prefixedContent),
			deliverAs: options?.deliverAs,
		}),
	);

	if (hasUserMessageOptions(options)) {
		pi.sendUserMessage(prefixedContent, { deliverAs: options.deliverAs });
		return;
	}

	pi.sendUserMessage(prefixedContent);
}

export function sendBuiltinCustomMessage<TDetails>(
	pi: ExtensionAPI,
	route: BuiltinSystemMessageRoute,
	message: Pick<CustomMessage<TDetails>, "content" | "customType" | "details" | "display">,
	options?: BuiltinCustomMessageOptions,
): void {
	const prefixedContent = prefixContent(message.content);
	const deliverAs = options?.deliverAs === "nextTurn" ? undefined : options?.deliverAs;

	emitOpPiConversationEvent(
		pi,
		createBaseEvent({
			action: "injected",
			route,
			sessionId: options?.sessionId,
			kind: "custom_message",
			customType: message.customType,
			text: extractText(prefixedContent),
			deliverAs,
			triggerTurn: options?.triggerTurn,
		}),
	);

	const prefixedMessage = {
		...message,
		content: prefixedContent,
	};

	if (hasCustomMessageOptions(options)) {
		pi.sendMessage(prefixedMessage, {
			triggerTurn: options.triggerTurn,
			deliverAs: options.deliverAs,
		});
		return;
	}

	pi.sendMessage(prefixedMessage);
}

export function emitBuiltinSystemMessageFailure(
	pi: ExtensionAPI,
	args: {
		route: BuiltinSystemMessageRoute;
		sessionId?: string;
		kind: "custom_message" | "user_message";
		content: string | (TextContent | ImageContent)[];
		customType?: string;
		deliverAs?: "steer" | "followUp";
		triggerTurn?: boolean;
		errorMessage: string;
	},
): void {
	const prefixedContent = prefixContent(args.content);

	emitOpPiConversationEvent(
		pi,
		createBaseEvent({
			action: "failed",
			route: args.route,
			sessionId: args.sessionId,
			kind: args.kind,
			customType: args.customType,
			text: extractText(prefixedContent),
			deliverAs: args.deliverAs,
			triggerTurn: args.triggerTurn,
			errorMessage: args.errorMessage,
		}),
	);
}
