import type { Settings, SettingsManager } from "../../../settings-manager.js";

export type PromptPresetName = "auto" | "claude-opus" | "kimi-k2-6" | "gpt-5" | "gpt-5.4" | "gpt-5.5";

export interface PromptPresetSettings {
	promptPreset: PromptPresetName;
}

type SettingsWithPromptPreset = Settings & { promptPreset?: string };

function parsePromptPreset(value: string | undefined): PromptPresetName | undefined {
	if (
		value === "auto" ||
		value === "claude-opus" ||
		value === "kimi-k2-6" ||
		value === "gpt-5" ||
		value === "gpt-5.4" ||
		value === "gpt-5.5"
	) {
		return value;
	}
	return undefined;
}

export function loadPromptPresetSettings(settingsManager: SettingsManager): PromptPresetSettings {
	const globalSettings = settingsManager.getGlobalSettings() as SettingsWithPromptPreset;
	const projectSettings = settingsManager.getProjectSettings() as SettingsWithPromptPreset;

	return {
		promptPreset:
			parsePromptPreset(projectSettings.promptPreset) ?? parsePromptPreset(globalSettings.promptPreset) ?? "auto",
	};
}
