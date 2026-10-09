import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { HugeiconsIcon } from "@hugeicons/react";
import { TelegramIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChannelApiError, channelsApi } from "../api";
import type { PairingLink } from "../types";

export function PairTelegram({
  accountId,
  initialSession,
  onClose,
  onDone,
  purpose = "self",
}: {
  accountId: string;
  initialSession: PairingLink;
  onClose: () => void;
  onDone: () => void;
  purpose?: "self" | "guest";
}) {
  const t = useT();
  const [session, setSession] = useState(initialSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await channelsApi.pairing(
          accountId,
          session.id,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        );
        if (controller.signal.aborted) return;
        setSession((current) => ({ ...current, ...result }));
        setError(false);
        if (result.status === "waiting" || result.status === "review")
          timer = setTimeout(() => void poll(), 2000);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    timer = setTimeout(() => void poll(), 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [accountId, session.id, retry]);

  async function action(kind: "approve" | "cancel" | "renew") {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      if (kind === "renew")
        setSession(await channelsApi.startPairing(accountId));
      else if (kind === "approve") {
        await channelsApi.approvePairing(accountId, session.id, purpose);
        onDone();
      } else {
        if (session.status === "waiting" || session.status === "review")
          await channelsApi
            .cancelPairing(accountId, session.id)
            .catch((cause) => {
              if (
                !(
                  cause instanceof ChannelApiError &&
                  cause.code === "pairing_not_found"
                )
              )
                throw cause;
            });
        onClose();
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const waiting = session.status === "waiting";
  const review = session.status === "review";
  const approved = session.status === "approved";
  const transportError =
    session.transport_status &&
    [
      "credentials_error",
      "consumer_conflict",
      "transport_error",
      "rate_limited",
    ].includes(session.transport_status);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) void action("cancel");
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-5 right-5"
          aria-label={t("channels.cancel")}
          disabled={busy}
          onClick={() => void action("cancel")}
        >
          <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
        </Button>
        <DialogHeader>
          <DialogTitle>
            {t(
              purpose === "self"
                ? "channels.pairing.title"
                : "channels.pairing.guestTitle",
            )}
          </DialogTitle>
          <DialogDescription>
            {t("channels.pairing.description")}
          </DialogDescription>
        </DialogHeader>
        {waiting && (
          <>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-xl bg-white p-4">
                <QRCode
                  value={session.url}
                  size={144}
                  title={t("channels.pairing.qr")}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <p className="text-sm leading-relaxed">
                  {t("channels.pairing.openHelp")}
                </p>
                <Button asChild>
                  <a
                    href={session.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <HugeiconsIcon
                      icon={TelegramIcon}
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    {t("channels.pairing.open")}
                  </a>
                </Button>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("channels.pairing.expiry")}
                </p>
              </div>
            </div>
            {!error && !transportError && (
              <p
                role="status"
                className="text-muted-foreground flex items-center gap-2 text-sm"
              >
                <Spinner label={t("channels.pairing.waiting")} />
                {t("channels.pairing.waiting")}
              </p>
            )}
          </>
        )}
        {review && (
          <>
            <Badge variant="secondary">{t("channels.pairing.detected")}</Badge>
            <div className="flex flex-col gap-2">
              <p className="break-words font-medium">
                {session.name || session.user_id}
              </p>
              {session.username && (
                <p className="text-muted-foreground text-sm">
                  @{session.username}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {t("channels.pairing.accountId")} {session.user_id}
              </p>
            </div>
            <Alert>
              <AlertDescription>
                <p>{t("channels.pairing.confirmHelp")}</p>
                <p className="font-mono text-lg tracking-widest">
                  {session.confirmation}
                </p>
              </AlertDescription>
            </Alert>
            <p className="text-muted-foreground text-sm">
              {t(
                purpose === "self"
                  ? "channels.pairing.selfHelp"
                  : "channels.pairing.guestHelp",
              )}
            </p>
          </>
        )}
        {approved && (
          <Alert>
            <AlertDescription>
              {t("channels.pairing.approved")}
            </AlertDescription>
          </Alert>
        )}
        {!waiting && !review && !approved && (
          <Alert>
            <AlertDescription>{t("channels.pairing.expired")}</AlertDescription>
          </Alert>
        )}
        {transportError && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("channels.pairing.listenerError")}
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{t("channels.retryHelp")}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setRetry((value) => value + 1)}
              >
                {t("channels.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void action("cancel")}
          >
            {t("channels.cancel")}
          </Button>
          {approved ? (
            <Button onClick={onDone}>{t("channels.pairing.done")}</Button>
          ) : review ? (
            <Button
              disabled={busy || error}
              onClick={() => void action("approve")}
            >
              {busy && <Spinner label={t("channels.working")} />}
              {t(
                purpose === "self"
                  ? "channels.pairing.selfApprove"
                  : "channels.pairing.guestApprove",
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void action("renew")}
            >
              {busy && <Spinner label={t("channels.loading")} />}
              {t("channels.pairing.renew")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
