import { useT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { ChannelInventory, ChannelVoiceStatus } from "../types";

export function ChannelCapabilities({
  inventory,
  voiceStatus,
}: {
  inventory: ChannelInventory;
  voiceStatus?: ChannelVoiceStatus;
}) {
  const t = useT();
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("channels.commands")}</CardTitle>
          <CardDescription>{t("channels.commandsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("channels.naturalInteraction")}
          </p>
          <details>
            <summary className="cursor-pointer text-sm">
              {t("channels.compact.showCommands")}
            </summary>
            <dl className="mt-4 flex flex-col gap-3">
              {(["help", "usage", "projects", "cancel", "reset"] as const).map(
                (command) => (
                  <div key={command} className="flex items-start gap-4 text-sm">
                    <dt className="bg-muted w-24 shrink-0 rounded-md px-2 py-1 font-mono">
                      /{command}
                    </dt>
                    <dd className="text-muted-foreground py-1">
                      {t(`channels.command.${command}`)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </details>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("channels.availableNow")}</CardTitle>
          <CardDescription>
            {t("channels.capabilitiesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4 text-sm">
            {[
              ...(
                [
                  "textChat",
                  "conversationContext",
                  "projectContext",
                  "typingCancellation",
                  "documents",
                  "publicWebSearch",
                  "publicPageRead",
                  "referenceImages",
                  "webTools",
                ] as const
              ).flatMap((id) => {
                const capability = inventory.capabilities?.find(
                  (item) => item.id === id,
                );
                if (inventory.capabilities && !capability) return [];
                return [
                  [
                    t(`channels.${id}`),
                    t(
                      capability?.status === "pending" ||
                        (!capability && id === "webTools")
                        ? "channels.pending"
                        : "channels.available",
                    ),
                  ],
                ];
              }),
              [
                t("channels.inventory"),
                `${inventory.skills.length} skills · ${inventory.mcp.length} MCP`,
              ],
              [
                t("channels.voice.title"),
                t(
                  voiceStatus?.ready
                    ? voiceStatus.engine === "remote"
                      ? "channels.voice.configurationReady"
                      : "channels.voice.ready"
                    : "channels.voice.needsPreparation",
                ),
              ],
            ].map(([name, status]) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3"
                key={name}
              >
                <dt>{name}</dt>
                <dd>
                  <Badge variant="secondary">{status}</Badge>
                </dd>
              </div>
            ))}
          </dl>
          <details className="text-muted-foreground mt-5 text-xs">
            <summary className="cursor-pointer">
              {t("channels.compact.limits")}
            </summary>
            <p className="mt-3 leading-relaxed">
              {t("channels.documentsHelp")}
            </p>
            <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
              {t("channels.webSearchHelp")}
            </p>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              {t("channels.contextHelp")}
            </p>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              {t("channels.capabilityNote")}
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
