
/** Model-family default resolved by the backend from the template + model id. */
export function preserveThinkingDefaultFromLoad(resp: {
  supports_preserve_thinking?: boolean | null;
  preserve_thinking_default?: boolean | null;
}): boolean {
  return Boolean(
    resp.supports_preserve_thinking && resp.preserve_thinking_default,
  );
}
