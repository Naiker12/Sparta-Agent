import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectTelegram } from "./components/connect-telegram";
import { ChannelNavigation } from "./components/channel-navigation";
import { platforms, type ChannelPlatform } from "./platforms";
import { TelegramConnections } from "./components/telegram-connections";
import { ChannelCapabilities } from "./components/channel-capabilities";
import { ChannelActivity } from "./components/channel-activity";
import { useChannels } from "./use-channels";

export function ChannelsPage() {
  const t = useT();
  const { data, error, loading, refresh } = useChannels();
  const [selected, setSelected] = useState<ChannelPlatform>("telegram");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState(false);
  const platform = platforms.find((p) => p.id === selected)!;
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-7 md:px-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("channels.title")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("channels.pageDescription")}
        </p>
      </header>
      <div className="grid items-start gap-7 md:grid-cols-[210px_minmax(0,1fr)]">
        <ChannelNavigation
          selected={selected}
          onSelect={setSelected}
          connected={
            data?.accounts.filter((a) => a.status === "connected").length ?? 0
          }
        />
        <section
          className="flex min-w-0 flex-col gap-5"
          aria-label={platform.name}
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <HugeiconsIcon icon={platform.icon} size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{platform.name}</h2>
                  <Badge variant={platform.available ? "secondary" : "outline"}>
                    {t(platform.available ? "channels.ready" : "channels.soon")}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t(
                    platform.available
                      ? "channels.telegramDescription"
                      : "channels.plannedDescription",
                  )}
                </p>
              </div>
            </div>
            {platform.available && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("channels.refresh")}
                disabled={loading}
                onClick={() => void refresh()}
              >
                {loading ? (
                  <Spinner label={t("channels.loading")} />
                ) : (
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    size={17}
                    aria-hidden="true"
                  />
                )}
              </Button>
            )}
          </header>
          {platform.available ? (
            <>
              {(error || actionError) && (
                <Alert variant="destructive">
                  <AlertTitle>{t("channels.requestFailed")}</AlertTitle>
                  <AlertDescription>
                    <p>{t("channels.retryHelp")}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => {
                        setActionError(false);
                        void refresh();
                      }}
                    >
                      {t("channels.retry")}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {!data ? (
                loading ? (
                  <div
                    role="status"
                    aria-label={t("channels.loading")}
                    aria-busy="true"
                    className="flex flex-col gap-5"
                  >
                    <p className="text-muted-foreground text-sm">
                      {t("channels.loading")}
                    </p>
                    <Skeleton className="h-9 w-72 rounded-full" />
                    <Skeleton className="h-72 rounded-2xl" />
                  </div>
                ) : null
              ) : (
                <Tabs defaultValue="connections">
                  <TabsList
                    aria-label={t("channels.sections")}
                    className="mb-5"
                  >
                    <TabsTrigger value="connections">
                      {t("channels.connections")}
                    </TabsTrigger>
                    <TabsTrigger value="capabilities">
                      {t("channels.capabilities")}
                    </TabsTrigger>
                    <TabsTrigger value="activity">
                      {t("channels.activity")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="connections">
                    <TelegramConnections
                      accounts={data.accounts}
                      onAdd={() => setAdding(true)}
                      onChanged={() => {
                        setActionError(false);
                        void refresh();
                      }}
                      onError={() => setActionError(true)}
                    />
                  </TabsContent>
                  <TabsContent value="capabilities">
                    <ChannelCapabilities inventory={data.inventory} />
                  </TabsContent>
                  <TabsContent value="activity">
                    <ChannelActivity data={data} />
                  </TabsContent>
                </Tabs>
              )}
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("channels.plannedTitle")}</CardTitle>
                <CardDescription>
                  {t(
                    selected === "discord"
                      ? "channels.discordDescription"
                      : "channels.otherPlannedDescription",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("channels.plannedHelp")}
                </p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => setSelected("telegram")}
                >
                  {t("channels.goToTelegram")}
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
      {data && (
        <ConnectTelegram
          open={adding}
          onOpenChange={setAdding}
          inventory={data.inventory}
          onSaved={() => void refresh()}
        />
      )}
    </main>
  );
}
