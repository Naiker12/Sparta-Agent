// Re-export of sonner. Swipe blocking lives on the Toaster via
// `swipeDirections={[]}`, so no per-toast dismissible override.

import { Spinner } from "@/components/ui/spinner";
import { localizeUiMessage } from "@/i18n/localize-message";
import { type ReactNode, createElement } from "react";
import { toast as sonnerToast } from "sonner";
import type { ExternalToast } from "sonner";

const localizeToast = localizeUiMessage;

function localizeOptions(options?: ExternalToast): ExternalToast | undefined {
  if (!options || typeof options.description !== "string") {
    return options;
  }
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

const baseToast = (message: string | ReactNode, data?: ExternalToast) =>
  sonnerToast(localizeToast(message), localizeOptions(data));

export const toast = Object.assign(baseToast, {
  ...sonnerToast,
  success: (message: string | ReactNode, options?: ExternalToast) =>
    rawSuccess(localizeToast(message), localizeOptions(options)),
  error: (message: string | ReactNode, options?: ExternalToast) =>
    rawError(localizeToast(message), localizeOptions(options)),
  warning: (message: string | ReactNode, options?: ExternalToast) =>
    rawWarning(localizeToast(message), localizeOptions(options)),
  info: (message: string | ReactNode, options?: ExternalToast) =>
    rawInfo(localizeToast(message), localizeOptions(options)),
  message: (message: string | ReactNode, options?: ExternalToast) =>
    rawMessage(localizeToast(message), localizeOptions(options)),
  loading: (message: string | ReactNode, options?: ExternalToast) =>
    rawLoading(localizeToast(message), localizeOptions(options)),
  dismiss: rawDismiss,
  custom: rawCustom,
  promise: sonnerToast.promise.bind(sonnerToast),
  getHistory: sonnerToast.getHistory
    ? sonnerToast.getHistory.bind(sonnerToast)
    : () => [],
});

function createLoadingToastIcon() {
  return createElement(Spinner, {
    className: "size-4 text-muted-foreground",
  });
}

export type { ExternalToast } from "sonner";
export { createLoadingToastIcon };
