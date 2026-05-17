#!/usr/bin/env node
import assert from "node:assert/strict";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createRootOpPiWrapper, shouldWriteGlobalShim } from "./create-root-op-pi-wrapper.mjs";

describe("create-root-op-pi-wrapper", () => {
	it("writes a launch-only wrapper when the root is a gitless snapshot", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "op-pi-wrapper-snapshot-"));
		const globalPrefix = mkdtempSync(join(tmpdir(), "op-pi-wrapper-global-"));

		// When
		const result = createRootOpPiWrapper({ root, globalPrefix });
		const wrapper = readFileSync(result.wrapperPath, "utf8");

		// Then
		assert.equal(shouldWriteGlobalShim(root, {}), false);
		assert.equal(result.globalShimWritten, false);
		assert.equal(wrapper.includes("packages/coding-agent/dist/op-pi"), true);
		assert.equal(wrapper.includes("scripts/build-all.mjs"), false);
		assert.equal(wrapper.includes("packages/ai/src"), false);
		assert.equal(wrapper.includes(".op-pi-build-head"), false);
		assert.equal(wrapper.includes("linkedBuildIsStale"), false);
	});

	it("does NOT write a global shim by default in a git checkout (opt-in only)", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "op-pi-wrapper-git-default-"));
		mkdirSync(join(root, ".git"));

		// When
		const defaultDecision = shouldWriteGlobalShim(root, {});
		const ciDecision = shouldWriteGlobalShim(root, { CI: "true", OP_PI_WRITE_GLOBAL_SHIM: "1" });

		// Then
		assert.equal(defaultDecision, false);
		assert.equal(ciDecision, false);
	});

	it("writes a global shim only when OP_PI_WRITE_GLOBAL_SHIM=1 in a non-CI git checkout", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "op-pi-wrapper-git-optin-"));
		mkdirSync(join(root, ".git"));

		// When
		const optInDecision = shouldWriteGlobalShim(root, { OP_PI_WRITE_GLOBAL_SHIM: "1" });

		// Then
		assert.equal(optInDecision, true);
	});

	it("replaces an existing global symlink instead of following it", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "op-pi-wrapper-root-"));
		const globalPrefix = mkdtempSync(join(tmpdir(), "op-pi-wrapper-global-"));
		const globalBin = join(globalPrefix, "bin");
		const linkedTarget = join(root, "linked-cli.js");
		mkdirSync(join(root, ".git"));
		mkdirSync(globalBin);
		writeFileSync(linkedTarget, "original", "utf8");
		symlinkSync(linkedTarget, join(globalBin, "op-pi"));

		// When
		const result = createRootOpPiWrapper({ root, globalPrefix, writeGlobalShim: true });

		// Then
		assert.equal(readFileSync(linkedTarget, "utf8"), "original");
		assert.equal(lstatSync(result.globalShimPath).isSymbolicLink(), false);
		assert.equal(readFileSync(result.globalShimPath, "utf8").includes(result.wrapperPath), true);
	});
});
