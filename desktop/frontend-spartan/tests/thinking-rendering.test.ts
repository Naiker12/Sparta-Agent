import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const MESSAGE_VIEW = readFileSync(
	new URL(
		"../src/components/assistant-ui/thread/assistant-message-view.tsx",
		import.meta.url,
	),
	"utf8",
);
const REASONING_VIEW = readFileSync(
	new URL("../src/components/assistant-ui/reasoning.tsx", import.meta.url),
	"utf8",
);

test("streamed reasoning is rendered instead of being discarded", () => {
	assert.match(MESSAGE_VIEW, /Reasoning,\s+ReasoningGroup,/);
	assert.doesNotMatch(MESSAGE_VIEW, /Reasoning:\s*\(\)\s*=>\s*null/);
	assert.doesNotMatch(MESSAGE_VIEW, /ReasoningGroup:\s*\(\)\s*=>\s*null/);
});

test("an active reasoning panel includes a reduced-motion-safe animation", () => {
	assert.match(REASONING_VIEW, /function ThinkingDots\(\)/);
	assert.match(REASONING_VIEW, /animate-bounce/);
	assert.match(REASONING_VIEW, /motion-reduce:animate-none/);
});
