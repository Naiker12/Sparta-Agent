
// `shiki` with one change: every highlighter it hands out counts the source it
// is asked to tokenize. The explicit `createHighlighter` below shadows the one
// the star export would provide.
export * from "shiki";
import { createHighlighter as createRealHighlighter } from "shiki";

export const tokenized = { characters: 0, calls: 0 };

export const createHighlighter = async (
  ...args: Parameters<typeof createRealHighlighter>
) => {
  const highlighter = await createRealHighlighter(...args);
  const codeToTokens = highlighter.codeToTokens.bind(highlighter);
  highlighter.codeToTokens = (code, options) => {
    tokenized.characters += code.length;
    tokenized.calls += 1;
    // This fixture measures character work and exact tokens, not Shiki's wall-clock fallback.
    // A descheduled worker can exhaust the default 500ms line budget under concurrent CI load.
    return codeToTokens(code, { ...options, tokenizeTimeLimit: 0 });
  };
  return highlighter;
};
