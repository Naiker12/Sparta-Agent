/**
 * Sparta Agent – Compare Handles
 *
 * Contratos de tipo e infraestructura de contexto para el modo
 * de comparación de modelos (compare panes).
 *
 * Responsabilidad única (SRP): gestión del registro de handles
 * por pane y provisión del contexto React.
 */

import { useAui } from "@assistant-ui/react";
import {
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
} from "react";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type CompareMessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "audio"; audio: string; name: string };

export interface CompareHandle {
  append: (content: CompareMessagePart[]) => void;
  /** Agrega un mensaje de usuario sin disparar la generación. */
  appendMessage: (content: CompareMessagePart[]) => void;
  /** Inicia la generación sobre el hilo actual (usar tras appendMessage). */
  startRun: () => void;
  cancel: () => void;
  isRunning: () => boolean;
  /** Promesa que resuelve cuando termina la ejecución actual o la siguiente. */
  waitForRunEnd: () => Promise<void>;
}

export type CompareHandles = MutableRefObject<Record<string, CompareHandle>>;

// ---------------------------------------------------------------------------
// Contexto interno
// ---------------------------------------------------------------------------

export const CompareHandlesContext = createContext<CompareHandles | null>(null);

// ---------------------------------------------------------------------------
// CompareHandlesProvider
// ---------------------------------------------------------------------------

/**
 * Provee el mapa de handles a todos los componentes hijos en modo compare.
 * Normalmente envuelve el layout de dos panes.
 */
export function CompareHandlesProvider({
  handlesRef,
  children,
}: {
  handlesRef: CompareHandles;
  children: ReactNode;
}): ReactElement {
  return (
    <CompareHandlesContext.Provider value={handlesRef}>
      {children}
    </CompareHandlesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// RegisterCompareHandle
// ---------------------------------------------------------------------------

/**
 * Registra automáticamente el handle de un pane de comparación al montarse
 * y lo elimina al desmontarse.
 *
 * Cada pane de comparación renderiza este componente con un `name` único
 * ("model1" | "model2") para que el compositor compartido pueda enviar
 * mensajes a ambos lados de forma simétrica.
 */
export function RegisterCompareHandle({
  name,
}: {
  name: string;
}): ReactElement | null {
  const handlesRef = useContext(CompareHandlesContext);
  const aui = useAui();

  useEffect(() => {
    if (!handlesRef) {
      return;
    }
    const currentHandles = handlesRef.current;
    currentHandles[name] = {
      // Orden estable en recargas: fuerza la fecha al momento del envío.
      append: (content) =>
        aui
          .thread()
          .append({ role: "user", content, createdAt: new Date() } as never),
      appendMessage: (content) =>
        aui
          .thread()
          .append({
            role: "user",
            content,
            createdAt: new Date(),
            startRun: false,
          } as never),
      startRun: () => {
        const msgs = aui.thread().getState().messages;
        const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
        aui.thread().startRun({ parentId: lastId });
      },
      cancel: () => aui.thread().cancelRun(),
      isRunning: () => aui.thread().getState().isRunning,
      waitForRunEnd: () =>
        new Promise<void>((resolve, reject) => {
          const runtime =
            aui.threads().__internal_getAssistantRuntime?.();
          const itemState = aui.threadListItem().getState();
          const threadIds = Array.from(
            new Set(
              [itemState.id, itemState.remoteId].filter(
                (id): id is string => Boolean(id),
              ),
            ),
          );
          let thread = null;
          for (const threadId of threadIds) {
            try {
              thread = runtime?.threads.getById(threadId) ?? null;
              if (thread) break;
            } catch {
              // El alias puede estar retirado; intentar el siguiente.
            }
          }
          if (!thread) {
            reject(new Error("Comparison thread is unavailable"));
            return;
          }
          let wasRunning = thread.getState().isRunning;
          let unsubscribe = () => {};
          unsubscribe = thread.subscribe(() => {
            const isRunning = thread.getState().isRunning;
            if (isRunning) wasRunning = true;
            if (wasRunning && !isRunning) {
              unsubscribe();
              resolve();
            }
          });
        }),
    };
    return () => {
      delete currentHandles[name];
    };
  }, [handlesRef, name, aui]);

  return null;
}
