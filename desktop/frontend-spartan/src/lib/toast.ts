
// Re-export of sonner. Swipe blocking lives on the Toaster via
// `swipeDirections={[]}`, so no per-toast dismissible override.

import { Spinner } from "@/components/ui/spinner";
import { getLocale } from "@/i18n";
import { createElement } from "react";
import { toast as sonnerToast } from "sonner";
import type { ExternalToast } from "sonner";

const SPANISH_TOASTS: Record<string, string> = {
  "Export failed.": "No se pudo exportar.",
  "Failed to rename project": "No se pudo renombrar el proyecto",
  "Failed to delete project": "No se pudo eliminar el proyecto",
  "Failed to rename chat": "No se pudo renombrar el chat",
  "Failed to delete chat": "No se pudo eliminar el chat",
  "Failed to archive chat": "No se pudo archivar el chat",
  "Failed to move chat": "No se pudo mover el chat",
  "Could not save file.": "No se pudo guardar el archivo.",
  "Could not save image.": "No se pudo guardar la imagen.",
  "Could not save audio.": "No se pudo guardar el audio.",
  "Could not copy the text.": "No se pudo copiar el texto.",
  "Text copied": "Texto copiado",
  "Transcript copied": "Transcripción copiada",
  "Could not copy the transcript.": "No se pudo copiar la transcripción.",
  "Could not access the microphone.": "No se pudo acceder al micrófono.",
  "Could not download the clip.": "No se pudo descargar el audio.",
  "Enter a preset name": "Introduce un nombre para el ajuste predefinido",
  "Connection failed": "Falló la conexión",
  "Connection test failed": "Falló la prueba de conexión",
  "Save failed": "No se pudo guardar",
  "Import failed": "No se pudo importar",
  "Delete failed": "No se pudo eliminar",
  "Update failed": "No se pudo actualizar",
  "Refresh failed": "No se pudo actualizar",
  "Invalid JSON file": "El archivo JSON no es válido",
  "No content to save.": "No hay contenido para guardar.",
  "No exportable content.": "No hay contenido para exportar.",
  "No conversations to export.": "No hay conversaciones para exportar.",
  "No prompts to export": "No hay prompts para exportar",
  "No prompt lists to export": "No hay listas de prompts para exportar",
  "A model is loading": "Se está cargando un modelo",
  "Another model is already loading": "Ya se está cargando otro modelo",
  "Stopped loading model": "Se detuvo la carga del modelo",
  "Prompt queue complete": "La cola de prompts finalizó",
  "Prompt queue stopped": "La cola de prompts se detuvo",
  "Compare complete": "Comparación completada",
  "Compare failed": "La comparación falló",
  "Chat not found": "No se encontró el chat",
  "Connections disabled": "Las conexiones están desactivadas",
};

function localizeToast(message: string | React.ReactNode): string | React.ReactNode {
  if (typeof message !== "string" || getLocale() !== "es") return message;
  return SPANISH_TOASTS[message] ?? message;
}

function localizeOptions(options?: ExternalToast): ExternalToast | undefined {
  if (!options || typeof options.description !== "string") return options;
  return { ...options, description: localizeToast(options.description) };
}

const rawSuccess = sonnerToast.success.bind(sonnerToast);
const rawError = sonnerToast.error.bind(sonnerToast);
const rawWarning = sonnerToast.warning.bind(sonnerToast);
const rawInfo = sonnerToast.info.bind(sonnerToast);
const rawMessage = sonnerToast.message.bind(sonnerToast);
const rawLoading = sonnerToast.loading.bind(sonnerToast);
const rawDismiss = sonnerToast.dismiss.bind(sonnerToast);
const rawCustom = sonnerToast.custom.bind(sonnerToast);

const baseToast = (message: string | React.ReactNode, data?: ExternalToast) =>
  sonnerToast(localizeToast(message), localizeOptions(data));

export const toast = Object.assign(baseToast, {
  ...sonnerToast,
  success: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawSuccess(localizeToast(message), localizeOptions(options)),
  error: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawError(localizeToast(message), localizeOptions(options)),
  warning: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawWarning(localizeToast(message), localizeOptions(options)),
  info: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawInfo(localizeToast(message), localizeOptions(options)),
  message: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawMessage(localizeToast(message), localizeOptions(options)),
  loading: (message: string | React.ReactNode, options?: ExternalToast) =>
    rawLoading(localizeToast(message), localizeOptions(options)),
  dismiss: rawDismiss,
  custom: rawCustom,
  promise: sonnerToast.promise.bind(sonnerToast),
  getHistory: sonnerToast.getHistory ? sonnerToast.getHistory.bind(sonnerToast) : () => [],
});

function createLoadingToastIcon() {
  return createElement(Spinner, {
    className: "size-4 text-muted-foreground",
  });
}

export type { ExternalToast } from "sonner";
export { createLoadingToastIcon };
