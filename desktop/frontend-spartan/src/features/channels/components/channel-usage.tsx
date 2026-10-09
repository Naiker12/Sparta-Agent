import { Link } from "@tanstack/react-router";
import { useLocale, useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type { ChannelAccount } from "../types";

export function ChannelUsage({ accounts }: { accounts: ChannelAccount[] }) {
  const t = useT();
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  if (!accounts.length) return null;
  return (
    <Card className="gap-3 rounded-xl border-border/60 shadow-none">
      <CardHeader>
        <CardTitle>{t("channels.usage.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {accounts.map((account) => {
          const value = account.usage;
          return (
            <section
              key={account.id}
              className="flex flex-col gap-3"
              aria-label={account.name}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{account.name}</p>
                <Badge variant="outline">
                  {value
                    ? t("channels.usage.period")
                    : t("channels.usage.unavailable")}
                </Badge>
              </div>
              {value && (
                <>
                  <dl className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        [
                          t("channels.usage.input"),
                          value.prompt_tokens,
                          value.input_reports,
                        ],
                        [
                          t("channels.usage.output"),
                          value.completion_tokens,
                          value.output_reports,
                        ],
                        [
                          t("channels.usage.total"),
                          value.total_tokens,
                          value.reported_requests,
                        ],
                      ] as const
                    ).map(([label, count, reports]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground text-xs">
                          {label}
                        </dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {reports ? number.format(count) : "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <details className="text-muted-foreground text-xs">
                    <summary className="cursor-pointer">
                      {t("channels.compact.usageDetails")}
                      {value.complete_requests < value.requests
                        ? ` · ${t("channels.compact.partial")}`
                        : ""}
                    </summary>
                    <p className="mt-2">
                      {t("channels.usage.coverage")} {value.complete_requests}/
                      {value.requests} · {t("channels.usage.remaining")}{" "}
                      {value.hourly_requests_remaining}/
                      {value.hourly_request_limit}
                    </p>
                    {value.complete_requests < value.requests && (
                      <p className="text-muted-foreground text-xs">
                        {t("channels.usage.partial")}
                      </p>
                    )}
                    {!value.reported_requests && (
                      <p className="text-muted-foreground text-xs">
                        {t("channels.usage.noReports")}
                      </p>
                    )}
                    <p className="mt-2">{t("channels.usage.balance")}</p>
                  </details>
                </>
              )}
            </section>
          );
        })}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link to="/tasks">{t("channels.work.open")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
