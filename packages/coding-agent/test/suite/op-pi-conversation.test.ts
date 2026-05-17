import { describe, expect, it, vi } from "vitest";
import {
	emitBuiltinSystemMessageFailure,
	OP_PI_CONVERSATION_EVENT,
	OP_PI_SYSTEM_PREFIX,
	sendBuiltinCustomMessage,
	sendBuiltinUserMessage,
} from "../../src/core/extensions/builtin/system-messages.js";
import { OP_PI_SYSTEM_PREFIX as TODO_SYSTEM_PREFIX } from "../../src/core/extensions/builtin/todotools/system-messages.js";

function createMockPi() {
	return {
		sendUserMessage: vi.fn(),
		sendMessage: vi.fn(),
		events: {
			emit: vi.fn(),
		},
	};
}

describe("op-pi conversation helpers", () => {
	it("uses the op-pi marker for injected system prefixes", () => {
		expect(OP_PI_SYSTEM_PREFIX).toBe("[system:op-pi]");
		expect(TODO_SYSTEM_PREFIX).toBe("[system:op-pi]");
	});

	it("emits a unified injected event and prefixes builtin user messages", () => {
		const pi = createMockPi();

		sendBuiltinUserMessage(pi as never, "todotools.continuation", "Continue the task", {
			sessionId: "session-1",
		});

		expect(pi.sendUserMessage).toHaveBeenCalledWith(`${OP_PI_SYSTEM_PREFIX}\nContinue the task`);
		expect(pi.events.emit).toHaveBeenCalledWith(
			OP_PI_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "injected",
				route: "todotools.continuation",
				sessionId: "session-1",
				conversation: expect.objectContaining({
					kind: "user_message",
					prefix: OP_PI_SYSTEM_PREFIX,
				}),
				text: `${OP_PI_SYSTEM_PREFIX}\nContinue the task`,
			}),
		);
	});

	it("emits a unified injected event and prefixes builtin custom messages", () => {
		const pi = createMockPi();

		sendBuiltinCustomMessage(
			pi as never,
			"todotools.continuation",
			{
				customType: "op-pi.test",
				display: true,
				content: [{ type: "text", text: "<system-reminder>\nDone\n</system-reminder>" }],
			},
			{ triggerTurn: true, deliverAs: "followUp", sessionId: "session-2" },
		);

		expect(pi.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				customType: "op-pi.test",
				content: [
					expect.objectContaining({
						type: "text",
						text: `${OP_PI_SYSTEM_PREFIX}\n<system-reminder>\nDone\n</system-reminder>`,
					}),
				],
			}),
			{ triggerTurn: true, deliverAs: "followUp" },
		);
		expect(pi.events.emit).toHaveBeenCalledWith(
			OP_PI_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "injected",
				route: "todotools.continuation",
				sessionId: "session-2",
				conversation: expect.objectContaining({
					kind: "custom_message",
					customType: "op-pi.test",
					prefix: OP_PI_SYSTEM_PREFIX,
					triggerTurn: true,
					deliverAs: "followUp",
				}),
			}),
		);
	});

	it("emits a unified failed event for op-pi conversation injection failures", () => {
		const pi = createMockPi();

		emitBuiltinSystemMessageFailure(pi as never, {
			route: "todotools.continuation",
			sessionId: "session-3",
			kind: "user_message",
			content: "Continue after failure",
			errorMessage: "dispatch failed",
		});

		expect(pi.events.emit).toHaveBeenCalledWith(
			OP_PI_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "failed",
				route: "todotools.continuation",
				sessionId: "session-3",
				conversation: expect.objectContaining({
					kind: "user_message",
					prefix: OP_PI_SYSTEM_PREFIX,
				}),
				text: `${OP_PI_SYSTEM_PREFIX}\nContinue after failure`,
				errorMessage: "dispatch failed",
			}),
		);
	});
});
