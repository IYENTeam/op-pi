import { describe, expect, test, vi } from "vitest";
import { printHelp } from "../src/cli/args.js";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR } from "../src/config.js";

describe("op-pi branding", () => {
	test("uses op-pi as the runtime app identity", () => {
		// given

		// when
		const branding = {
			appName: APP_NAME,
			configDirName: CONFIG_DIR_NAME,
			envAgentDir: ENV_AGENT_DIR,
		};

		// then
		expect(branding).toEqual({
			appName: "op-pi",
			configDirName: ".op-pi",
			envAgentDir: "OP_PI_CODING_AGENT_DIR",
		});
	});

	test("prints op-pi in the top-level help output", () => {
		// given
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			// when
			printHelp();
			const output = logSpy.mock.calls.map(([message]) => String(message)).join("\n");

			// then
			expect(output).toContain("op-pi - AI coding assistant");
			expect(output).toContain("op-pi [options] [@files...] [messages...]");
			expect(output).toContain("op-pi install <source> [-l]");
			expect(output).toContain("~/.op-pi/agent");
		} finally {
			logSpy.mockRestore();
		}
	});
});
