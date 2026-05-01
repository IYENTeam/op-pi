import type { ExtensionAPI } from "../../types.js";

import { renderWebfetchCall, renderWebfetchResult } from "./renderers.js";
import { type WebfetchDetails, webfetch } from "./tool.js";

interface ResultLike<TDetails> {
	content: ReadonlyArray<{ type: string; text?: string }>;
	details?: TDetails;
}

/**
 * pi-webfetch — URL retrieval for the pi coding agent.
 *
 * Registers one LLM-callable tool:
 *   - webfetch — fetch URL content as markdown, text, or html.
 */
export default function (pi: ExtensionAPI): void {
	pi.registerTool({
		...webfetch,
		renderCall: (args, theme) => renderWebfetchCall(args as never, theme),
		renderResult: (result, options, theme) =>
			renderWebfetchResult(result as ResultLike<WebfetchDetails>, options, theme),
	});
}
