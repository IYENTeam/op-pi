import { describe, expect, test } from "vitest";
import { formatKeyText } from "../src/modes/interactive/components/keybinding-hints.js";
import { formatWorkingElapsedSeconds, formatWorkingStatusMessage } from "../src/modes/interactive/interactive-mode.js";

describe("formatKeyText", () => {
	test("uses compact escape labels for status hints", () => {
		expect(formatKeyText("escape")).toBe("esc");
		expect(formatKeyText("escape", { capitalize: true })).toBe("Esc");
	});
});

describe("formatWorkingElapsedSeconds", () => {
	test("formats elapsed working time with padded larger units", () => {
		expect(formatWorkingElapsedSeconds(-1)).toBe("0s");
		expect(formatWorkingElapsedSeconds(7.9)).toBe("7s");
		expect(formatWorkingElapsedSeconds(59)).toBe("59s");
		expect(formatWorkingElapsedSeconds(60)).toBe("1m 00s");
		expect(formatWorkingElapsedSeconds(427)).toBe("7m 07s");
		expect(formatWorkingElapsedSeconds(3600)).toBe("1h 00m 00s");
		expect(formatWorkingElapsedSeconds(3667)).toBe("1h 01m 07s");
	});
});

describe("formatWorkingStatusMessage", () => {
	test("combines message, elapsed time, and interrupt hint", () => {
		expect(formatWorkingStatusMessage("Working", 427, "esc")).toBe("Working (7m 07s • esc to interrupt)");
	});
});
