export type MessageRenderState =
  | { kind: 'thinking_pending'; reasoningText?: undefined }
  | { kind: 'thinking_live'; reasoningText: string }
  | { kind: 'generating'; content: string; reasoningText?: undefined }
  | { kind: 'responding'; content: string; reasoningText?: string }
  | { kind: 'done'; content: string; reasoningText?: string }
  | { kind: 'empty_error' }

export function getMessageRenderState(
  content: string,
  reasoningText: string | undefined,
  isStreaming: boolean,
): MessageRenderState {
  if (!isStreaming) {
    if (!content.trim() && !reasoningText?.trim()) {
      return { kind: 'empty_error' }
    }
    return {
      kind: 'done',
      content: content || '',
      reasoningText: reasoningText || undefined,
    }
  }
  if (reasoningText && !content) {
    return {
      kind: 'thinking_live',
      reasoningText,
    }
  }
  if (reasoningText && content) {
    return {
      kind: 'responding',
      content,
      reasoningText,
    }
  }
  if (content) {
    return {
      kind: 'generating',
      content,
    }
  }
  return { kind: 'thinking_pending' }
}
