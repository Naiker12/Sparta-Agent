import type { ChatModelAdapter } from "@assistant-ui/react";

/** Preserve streamed content and expose failures through the message status. */
export function withRunErrorStatus(adapter: ChatModelAdapter): ChatModelAdapter {
  return {
    ...adapter,
    async *run(options) {
      try {
        const result = adapter.run(options);
        if (!result) return;
        if (typeof result === "object" && Symbol.asyncIterator in result) {
          yield* result;
        } else {
          yield await result;
        }
      } catch (error) {
        if (options.abortSignal.aborted) return;
        yield {
          status: {
            type: "incomplete",
            reason: "error",
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };
}
