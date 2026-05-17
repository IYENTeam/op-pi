import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TodoSettingsPair {
	globalSettings: Record<string, unknown>;
	projectSettings: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonObject(path: string): Record<string, unknown> {
	if (!existsSync(path)) {
		return {};
	}

	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function mergeSettings(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const current = merged[key];
		if (isRecord(current) && isRecord(value)) {
			merged[key] = mergeSettings(current, value);
			continue;
		}
		merged[key] = value;
	}
	return merged;
}

function unique(paths: string[]): string[] {
	return [...new Set(paths)];
}

function getGlobalSettingsPaths(): string[] {
	const paths: string[] = [];
	const piAgentDir = process.env.PI_CODING_AGENT_DIR;
	const opPiAgentDir = process.env.OP_PI_CODING_AGENT_DIR;
	if (piAgentDir) paths.push(join(piAgentDir, "settings.json"));
	if (opPiAgentDir) paths.push(join(opPiAgentDir, "settings.json"));
	paths.push(join(homedir(), ".pi", "agent", "settings.json"));
	paths.push(join(homedir(), ".op-pi", "agent", "settings.json"));
	return unique(paths);
}

function getProjectSettingsPaths(cwd: string): string[] {
	return [join(cwd, ".pi", "settings.json"), join(cwd, ".op-pi", "settings.json")];
}

function readMergedSettings(paths: string[]): Record<string, unknown> {
	return paths.reduce<Record<string, unknown>>((settings, path) => mergeSettings(settings, readJsonObject(path)), {});
}

export function readTodoSettings(cwd: string): TodoSettingsPair {
	return {
		globalSettings: readMergedSettings(getGlobalSettingsPaths()),
		projectSettings: readMergedSettings(getProjectSettingsPaths(cwd)),
	};
}
