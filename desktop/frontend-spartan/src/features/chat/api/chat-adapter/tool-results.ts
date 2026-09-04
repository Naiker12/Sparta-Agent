import {
  SANDBOX_FILE_TOOLS,
  isSandboxToolResult,
} from "@/components/assistant-ui/sandbox-files";

export interface McpImageToolResult {
  text: string;
  images: { data: string; mimeType: string }[];
}

export function isMcpImageToolResult(val: unknown): val is McpImageToolResult {
  if (typeof val !== "object" || val === null) {
    return false;
  }
  const v = val as { text?: unknown; images?: unknown; sessionId?: unknown };
  return (
    typeof v.text === "string" &&
    v.sessionId === undefined &&
    Array.isArray(v.images) &&
    v.images.length > 0 &&
    v.images.every(
      (img: unknown) =>
        typeof img === "object" &&
        img !== null &&
        typeof (img as { data?: unknown }).data === "string" &&
        typeof (img as { mimeType?: unknown }).mimeType === "string",
    )
  );
}

export function isSandboxWrapper(
  result: unknown,
  toolName?: string,
): result is { text: string; sessionId: string } {
  if (toolName !== undefined && !SANDBOX_FILE_TOOLS.has(toolName)) return false;
  return isSandboxToolResult(result);
}

export function isWrappedWithText(
  result: unknown,
  toolName?: string,
): result is { text: string } {
  return isMcpImageToolResult(result) || isSandboxWrapper(result, toolName);
}

export function toolResultModelText(
  result: unknown,
  toolName?: string,
): unknown {
  if (isWrappedWithText(result, toolName)) {
    return result.text;
  }
  return result;
}

