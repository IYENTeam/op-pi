import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePatch } from "./parser.js";
import { replaceChunks } from "./patch-replace.js";
import { normalizePatchText } from "./text.js";
import type { ParsedPatch } from "./types.js";
import { assertWorkspacePath, resolveWorkspacePath } from "./workspace.js";

async function applyParsedPatch(cwd: string, hunks: ParsedPatch[]): Promise<string[]> {
	const summaries: string[] = [];
	for (const hunk of hunks) {
		const absolutePath = await resolveWorkspacePath(cwd, hunk.filePath);
		if (hunk.type === "add") {
			await mkdir(path.dirname(absolutePath), { recursive: true });
			await assertWorkspacePath(cwd, absolutePath);
			await writeFile(absolutePath, hunk.content, "utf-8");
			summaries.push(`add: ${hunk.filePath}`);
			continue;
		}

		if (hunk.type === "delete") {
			await stat(absolutePath);
			await assertWorkspacePath(cwd, absolutePath);
			await rm(absolutePath);
			summaries.push(`delete: ${hunk.filePath}`);
			continue;
		}

		const currentContent = await readFile(absolutePath, "utf-8");
		const nextContent =
			hunk.chunks.length === 0 ? currentContent : replaceChunks(currentContent, hunk.filePath, hunk.chunks);
		if (hunk.movePath) {
			const absoluteMovePath = await resolveWorkspacePath(cwd, hunk.movePath);
			await mkdir(path.dirname(absoluteMovePath), { recursive: true });
			await assertWorkspacePath(cwd, absoluteMovePath);
			await writeFile(absoluteMovePath, nextContent, "utf-8");
			if (absoluteMovePath !== absolutePath) await rm(absolutePath);
			summaries.push(`move: ${hunk.filePath} -> ${hunk.movePath}`);
			continue;
		}

		await assertWorkspacePath(cwd, absolutePath);
		await writeFile(absolutePath, nextContent, "utf-8");
		summaries.push(`update: ${hunk.filePath}`);
	}
	return summaries;
}

export async function applyPatch(cwd: string, patchText: string): Promise<string[]> {
	const hunks = parsePatch(patchText);
	if (hunks.length === 0) {
		const normalized = normalizePatchText(patchText).trim();
		if (normalized === "*** Begin Patch\n*** End Patch") throw new Error("patch rejected: empty patch");
		throw new Error("apply_patch verification failed: no hunks found");
	}
	return applyParsedPatch(cwd, hunks);
}
