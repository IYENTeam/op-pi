import { extractPatchedPaths } from "./text.js";
import type { ApplyPatchOperation, ApplyPatchPreview, ApplyPatchPreviewFile, ApplyPatchTheme } from "./types.js";

function formatLineCountSummary(added: number, removed: number): string {
	return `(+${added} -${removed})`;
}

function formatPatchFilePath(file: ApplyPatchPreviewFile): string {
	return file.movePath ? `${file.filePath} → ${file.movePath}` : file.filePath;
}

function formatPatchOperation(operation: ApplyPatchOperation): string {
	if (operation === "add") return "Added";
	if (operation === "delete") return "Deleted";
	return "Edited";
}

export function formatPatchPreview(preview: ApplyPatchPreview): string {
	const lines: string[] = [];
	if (preview.files.length === 1) {
		const file = preview.files[0];
		if (file) {
			lines.push(
				`• ${formatPatchOperation(file.operation)} ${formatPatchFilePath(file)} ${formatLineCountSummary(file.added, file.removed)}`,
			);
			if (file.diff) lines.push(...file.diff.split("\n").map((line) => `  ${line}`));
		}
		return lines.join("\n");
	}

	const noun = preview.files.length === 1 ? "file" : "files";
	lines.push(`• Edited ${preview.files.length} ${noun} ${formatLineCountSummary(preview.added, preview.removed)}`);
	for (const file of preview.files) {
		lines.push(`  └ ${formatPatchFilePath(file)} ${formatLineCountSummary(file.added, file.removed)}`);
		if (file.diff) lines.push(...file.diff.split("\n").map((line) => `    ${line}`));
	}
	return lines.join("\n");
}

export function renderPatchPreview(preview: ApplyPatchPreview, theme: ApplyPatchTheme): string {
	return formatPatchPreview(preview)
		.split("\n")
		.map((line) => renderPatchLine(line, theme))
		.join("\n");
}

export function formatPendingPatchPaths(patchText: string): string {
	const paths = extractPatchedPaths(patchText);
	if (paths.length === 0) return "Applying patch...";
	return `Applying patch...\n${paths.map((filePath) => `• ${filePath}`).join("\n")}`;
}

export function renderPatchLine(line: string, theme: ApplyPatchTheme): string {
	const trimmed = line.trimStart();
	if (trimmed.startsWith("+")) return theme.fg("toolDiffAdded", line);
	if (trimmed.startsWith("-")) return theme.fg("toolDiffRemoved", line);
	if (trimmed.startsWith("•")) return theme.fg("toolTitle", theme.bold(line));
	if (trimmed.startsWith("└")) return theme.fg("accent", line);
	return theme.fg("toolDiffContext", line);
}
