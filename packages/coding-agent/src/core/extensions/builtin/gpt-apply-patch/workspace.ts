import { realpath } from "node:fs/promises";
import path from "node:path";

function isInsideWorkspace(absoluteCwd: string, absolutePath: string): boolean {
	const relativePath = path.relative(absoluteCwd, absolutePath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath))
	);
}

export async function assertWorkspacePath(cwd: string, absolutePath: string): Promise<void> {
	const absoluteCwd = await realpath(cwd);
	let pathToCheck = absolutePath;
	while (true) {
		try {
			const realPath = await realpath(pathToCheck);
			if (!isInsideWorkspace(absoluteCwd, realPath)) {
				throw new Error("File references must stay within the current workspace.");
			}
			return;
		} catch (error) {
			if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
				const parent = path.dirname(pathToCheck);
				if (parent === pathToCheck) throw error;
				pathToCheck = parent;
				continue;
			}
			throw error;
		}
	}
}

export async function resolveWorkspacePath(cwd: string, filePath: string): Promise<string> {
	const absoluteCwd = path.resolve(cwd);
	const absolutePath = path.resolve(absoluteCwd, filePath);
	if (!isInsideWorkspace(absoluteCwd, absolutePath)) {
		throw new Error("File references must stay within the current workspace.");
	}
	await assertWorkspacePath(cwd, absolutePath);
	return absolutePath;
}
