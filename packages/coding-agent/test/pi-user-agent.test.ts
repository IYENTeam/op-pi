import { describe, expect, it } from "vitest";
import { getPiUserAgent } from "../src/utils/pi-user-agent.js";

describe("getPiUserAgent", () => {
	it("formats the user agent with the runtime app name", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userAgent = getPiUserAgent("1.2.3");

		expect(userAgent).toBe(`op-pi/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^op-pi\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
