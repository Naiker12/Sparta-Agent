import type { ToolCall } from '../types'

/**
 * Extracts the file path from a ToolCall's input.
 * Handles both `path` and `file_path` keys used by different tools.
 */
export function toolCallFilePath(tc: ToolCall): string | undefined {
  const input = tc.input as Record<string, unknown> | undefined
  if (!input) return undefined
  
  const path = (input?.path ?? input?.file_path) as string | undefined
  return path
}

/**
 * Checks if a ToolCall is a file-editing operation (write/patch/delete).
 */
export function isFileEditTool(tc: ToolCall): boolean {
  const name = tc.toolName.toLowerCase()
  return name.includes('write') || name.includes('patch') || name.includes('delete') || name.includes('edit')
}