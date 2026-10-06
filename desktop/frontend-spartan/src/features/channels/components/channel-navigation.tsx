import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

import { platforms, type ChannelPlatform } from "../platforms";

export function ChannelNavigation({
  selected,
  onSelect,
  connected,
}: {
  selected: ChannelPlatform;
  onSelect: (platform: ChannelPlatform) => void;
  connected: number;
}) {
  const t = useT();
  return (
    <nav
      aria-label={t("channels.platforms")}
      className="flex flex-col gap-5 md:sticky md:top-6"
    >
      <div className="flex items-center gap-2 px-3">
        <HugeiconsIcon icon={BubbleChatIcon} size={18} />
        <h2 className="text-sm font-semibold">{t("channels.platforms")}</h2>
      </div>
      {[true, false].map((available) => (
        <div key={String(available)} className="flex flex-col gap-1">
          <p className="text-muted-foreground mb-1 px-3 text-xs font-medium">
            {t(
              available
                ? "channels.readyChannels"
                : "channels.upcomingChannels",
            )}
          </p>
          {platforms
            .filter((p) => p.available === available)
            .map((platform) => (
              <Button
                key={platform.id}
                variant={selected === platform.id ? "secondary" : "ghost"}
                aria-current={selected === platform.id ? "page" : undefined}
                className={cn(
                  "h-auto min-h-12 justify-start gap-3 rounded-xl px-3 py-3",
                  selected === platform.id && "ring-border ring-1",
                )}
                onClick={() => onSelect(platform.id)}
              >
                <HugeiconsIcon icon={platform.icon} size={20} />
                <span className="flex-1 text-left">{platform.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {platform.available
                    ? connected
                      ? String(connected)
                      : t("channels.ready")
                    : t("channels.soon")}
                </Badge>
              </Button>
            ))}
        </div>
      ))}
      <p className="text-muted-foreground px-3 text-xs leading-relaxed">
        {t("channels.navigationHelp")}
      </p>
    </nav>
  );
}
