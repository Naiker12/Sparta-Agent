import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Shield01Icon,
  TelegramIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AccountCard } from "./account-card";
import type { ChannelAccount } from "../types";

export function TelegramConnections({
  accounts,
  onAdd,
  onChanged,
  onError,
}: {
  accounts: ChannelAccount[];
  onAdd: () => void;
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      {accounts.length ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">{t("channels.yourConnections")}</h3>
            <Button variant="outline" size="sm" onClick={onAdd}>
              <HugeiconsIcon
                icon={Add01Icon}
                size={16}
                data-icon="inline-start"
              />
              {t("channels.add")}
            </Button>
          </div>
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-2xl">
              <HugeiconsIcon icon={TelegramIcon} size={26} />
            </div>
            <CardTitle>{t("channels.firstConnection")}</CardTitle>
            <CardDescription>
              {t("channels.firstConnectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ol className="grid gap-5 lg:grid-cols-3">
              {(["bot", "model", "access"] as const).map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {t(`channels.guide.${step}.title`)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {t(`channels.guide.${step}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <Button onClick={onAdd}>
                {t("channels.startSetup")}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={16}
                  data-icon="inline-end"
                />
              </Button>
              <p className="text-muted-foreground mt-3 text-xs">
                {t("channels.setupTime")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("channels.whatYouCanDo")}</CardTitle>
            <CardDescription>
              {t("channels.whatYouCanDoDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["/help", "/provider", "/skills", "/mcp"].map((command) => (
                <code
                  key={command}
                  className="bg-muted rounded-md px-2 py-1 text-xs"
                >
                  {command}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Shield01Icon} size={17} />
              {t("channels.accessUnderControl")}
            </CardTitle>
            <CardDescription>{t("channels.simpleSafety")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("channels.desktopRequired")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
