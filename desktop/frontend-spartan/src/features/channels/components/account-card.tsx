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
import { useSettingsDialogStore } from "@/features/settings";
import { PairTelegram } from "./pair-telegram";

export function AccountCard({
  account,
  onChanged,
  onError,
  settings = false,
}: {
  account: ChannelAccount;
  onChanged: () => void;
  onError: () => void;
  settings?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pairingLink, setPairingLink] = useState<PairingLink | null>(null);
  const [pairingPurpose, setPairingPurpose] = useState<"self" | "guest">(
    "self",
  );
  async function link(purpose: "self" | "guest" = "self") {
    if (busy) return;
    setBusy(true);
    try {
      setPairingPurpose(purpose);
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
      <Card size="sm" className="gap-3 rounded-xl border-border/60 shadow-none">
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
          <dl className="grid min-w-0 gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {t("channels.provider")}
              </dt>
              <dd className="mt-1 break-words font-medium">
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
          </dl>
          {!settings && (
            <p className="text-muted-foreground mt-3 text-sm">
              {t(
                account.profile_user_id &&
                  account.allowed_user_ids.includes(account.profile_user_id)
                  ? "channels.settings.linkedProfile"
                  : "channels.settings.unlinkedProfile",
              )}
            </p>
          )}
          {account.owner_user_id &&
            account.project_access?.[account.owner_user_id] === "all" && (
              <p className="text-muted-foreground mt-3 text-sm">
                {t("channels.projects.all")}
              </p>
            )}
          {(settings || !account.allowed_user_ids.length) &&
            !account.owner_user_id && (
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
            )}
          {settings && (
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void link("guest")}
            >
              {t("channels.pairing.guestTitle")}
            </Button>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2 border-border/60 border-t pt-3">
          {settings ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              {t("channels.remove")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                useSettingsDialogStore
                  .getState()
                  .openDialog("channels-permissions", {
                    channelAccountId: account.id,
                  })
              }
            >
              {t("channels.settings.configure")}
            </Button>
          )}
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
          purpose={pairingPurpose}
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
