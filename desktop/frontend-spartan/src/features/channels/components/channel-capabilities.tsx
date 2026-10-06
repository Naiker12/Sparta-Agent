import { useT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { ChannelInventory } from "../types";

export function ChannelCapabilities({
  inventory,
}: {
  inventory: ChannelInventory;
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
          <dl className="flex flex-col gap-4">
            {(
              [
                "help",
                "status",
                "provider",
                "tools",
                "skills",
                "mcp",
                "reset",
              ] as const
            ).map((command) => (
              <div key={command} className="flex items-start gap-4 text-sm">
                <dt className="bg-muted w-24 shrink-0 rounded-md px-2 py-1 font-mono">
                  /{command}
                </dt>
                <dd className="text-muted-foreground py-1">
                  {t(`channels.command.${command}`)}
                </dd>
              </div>
            ))}
          </dl>
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
              [t("channels.textChat"), t("channels.available")],
              [t("channels.conversationContext"), t("channels.available")],
              [
                t("channels.inventory"),
                `${inventory.skills.length} skills · ${inventory.mcp.length} MCP`,
              ],
              [t("channels.audioDocuments"), t("channels.pending")],
              [t("channels.webTools"), t("channels.pending")],
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
          <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
            {t("channels.contextHelp")}
          </p>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {t("channels.capabilityNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
