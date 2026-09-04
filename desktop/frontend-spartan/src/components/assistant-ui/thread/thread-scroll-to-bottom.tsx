/**
 * Sparta Agent - Botón de Desplazamiento Inferior (ThreadScrollToBottom)
 * Botón flotante animado para volver al final de la conversación cuando el usuario
 * se desplaza hacia arriba en el historial.
 */

import { type FC } from "react";
import { ArrowDownIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  useIsThreadAtBottom,
  useScrollThreadToBottom,
} from "@/components/assistant-ui/use-intent-aware-autoscroll";
import { cn } from "@/lib/utils";

export const ThreadScrollToBottom: FC = () => {
  const isAtBottom = useIsThreadAtBottom();
  const scrollToBottom = useScrollThreadToBottom();

  return (
    <TooltipIconButton
      tooltip="Scroll to bottom"
      variant="outline"
      onClick={() => scrollToBottom("auto")}
      className={cn(
        "aui-thread-scroll-to-bottom pointer-events-auto rounded-full p-4 bg-background hover:bg-accent dark:bg-background dark:hover:bg-accent",
        isAtBottom && "invisible pointer-events-none",
      )}
    >
      <ArrowDownIcon strokeWidth={1.75} className="size-icon" />
    </TooltipIconButton>
  );
};
