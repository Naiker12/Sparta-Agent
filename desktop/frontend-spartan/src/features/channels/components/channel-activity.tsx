import { useLocale, useT } from "@/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { ChannelOverview } from "../types";

export function ChannelActivity({ data }: { data: ChannelOverview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("channels.activity")}</CardTitle>
        <CardDescription>{t("channels.activityDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.events.length ? (
          <ol className="divide-border divide-y">
            {data.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {data.accounts.find((a) => a.id === event.account_id)?.name}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {t(
                      event.code === "reply_sent"
                        ? "channels.replySent"
                        : event.code === "reply_failed"
                          ? "channels.replyFailed"
                          : "channels.connectionError",
                    )}
                  </p>
                </div>
                <time
                  className="text-muted-foreground text-xs"
                  dateTime={new Date(event.created_at * 1000).toISOString()}
                >
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(event.created_at * 1000)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("channels.noActivity")}</EmptyTitle>
              <EmptyDescription>
                {t("channels.noActivityDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
