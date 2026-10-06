import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { channelsApi } from "../api";
import type { ChannelAccount, PairingLink } from "../types";
import { PairTelegram } from "./pair-telegram";

export function AccountCard({
  account,
  onChanged,
  onError,
}: {
  account: ChannelAccount;
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pairingLink, setPairingLink] = useState<PairingLink | null>(null);
  async function link() {
    if (busy) return;
    setBusy(true);
    try {
      setPairingLink(await channelsApi.startPairing(account.id));
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  async function act(remove = false) {
    setBusy(true);
    try {
      if (remove) await channelsApi.remove(account.id);
      else await channelsApi.setEnabled(account.id, !account.enabled);
      setConfirm(false);
      onChanged();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  const connected = account.status === "connected";
  const statusKey =
    account.status === "paused"
      ? "channels.paused"
      : connected
        ? "channels.connected"
        : account.status === "connecting"
          ? "channels.connecting"
          : "channels.connectionError";
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{account.name}</CardTitle>
            <Badge variant={connected ? "default" : "secondary"}>
              {account.status === "connecting" && (
                <Spinner label={t("channels.connecting")} />
              )}
              {t(statusKey)}
            </Badge>
          </div>
          <CardDescription>Telegram · @{account.bot_username}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {t("channels.provider")}
              </dt>
              <dd className="mt-1 font-medium">
                {account.provider_name}{" "}
                <span className="text-muted-foreground font-normal">
                  / {account.model}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("channels.access")}</dt>
              <dd className="mt-1">
                {t("channels.privateAccess")} ·{" "}
                {account.allowed_user_ids.length} {t("channels.users")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("channels.authorizedUsers")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {account.allowed_user_ids.join(", ") ||
                  t("channels.pairing.noUsers")}
              </dd>
            </div>
          </dl>
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void link()}
          >
            {busy && <Spinner label={t("channels.loading")} />}
            {t("channels.pairing.title")}
          </Button>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            {t("channels.remove")}
          </Button>
          <Button
            variant={account.enabled ? "outline" : "default"}
            size="sm"
            disabled={
              busy || (!account.enabled && !account.allowed_user_ids.length)
            }
            onClick={() => void act()}
          >
            {busy && <Spinner label={t("channels.working")} />}
            {t(
              busy
                ? "channels.working"
                : account.enabled
                  ? "channels.pause"
                  : "channels.connect",
            )}
          </Button>
        </CardFooter>
      </Card>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("channels.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("channels.removeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("channels.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void act(true)}
            >
              {busy && <Spinner label={t("channels.working")} />}
              {t("channels.remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {pairingLink && (
        <PairTelegram
          accountId={account.id}
          initialSession={pairingLink}
          onClose={() => {
            setPairingLink(null);
            onChanged();
          }}
          onDone={() => {
            setPairingLink(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
