import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Link01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { useLocale, useT } from "@/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  activityCounts,
  activityPage,
  activityType,
  filterActivity,
  type ActivityFilter,
} from "../activity-model";
import type { ChannelOverview } from "../types";
import { ChannelUsage } from "./channel-usage";
const icons = {
  responses: CheckmarkCircle01Icon,
  errors: AlertCircleIcon,
  connections: Link01Icon,
  other: Clock01Icon,
};
export function ChannelActivity({ data }: { data: ChannelOverview }) {
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<ActivityFilter>("all");
  const [account, setAccount] = useState("all");
  const [requestedPage, setPage] = useState(0);
  const selected = data.accounts.some((item) => item.id === account)
    ? account
    : "all";
  const counts = activityCounts(filterActivity(data.events, selected, "all"));
  const filtered = filterActivity(data.events, selected, category);
  const { page, pages, events } = activityPage(filtered, requestedPage);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  return (
    <div className="flex flex-col gap-5">
      <ChannelUsage
        accounts={data.accounts.filter(
          (item) => selected === "all" || item.id === selected,
        )}
      />
      <dl className="grid grid-cols-3 gap-3">
        {(["responses", "errors", "connections"] as const).map((kind) => (
          <div
            key={kind}
            className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/60 bg-card px-3 py-3 sm:px-4"
          >
            <dt className="truncate text-ui-11 font-medium uppercase tracking-wider text-muted-foreground">
              {t(`channels.activityView.${kind}`)}
            </dt>
            <dd className="text-ui-22 font-semibold leading-tight tabular-nums tracking-[-0.02em]">
              {counts[kind].toLocaleString(locale)}
            </dd>
          </div>
        ))}
      </dl>
      <Card className="gap-3 rounded-xl border-border/60 shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("channels.activityView.recent")}</CardTitle>
            <Badge variant="outline">{t("channels.activityView.window")}</Badge>
          </div>
          <CardDescription>{t("channels.activityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={category}
              aria-label={t("channels.activityView.filter")}
              onValueChange={(value) => {
                if (value) {
                  setCategory(value as ActivityFilter);
                  setPage(0);
                }
              }}
            >
              {(["all", "responses", "errors", "connections"] as const).map(
                (kind) => (
                  <ToggleGroupItem key={kind} value={kind}>
                    {t(`channels.activityView.${kind}`)}
                  </ToggleGroupItem>
                ),
              )}
            </ToggleGroup>
            {data.accounts.length > 1 && (
              <Select
                value={selected}
                onValueChange={(value) => {
                  setAccount(value);
                  setPage(0);
                }}
              >
                <SelectTrigger aria-label={t("channels.activityView.bot")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      {t("channels.activityView.allBots")}
                    </SelectItem>
                    {data.accounts.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
          {events.length ? (
            <ol className="max-h-[560px] overflow-y-auto flex flex-col gap-1">
              {events.map((event, index) => {
                const [kind, label] = activityType(event.code);
                const instant = new Date(event.created_at * 1000);
                const day = date.format(instant);
                const heading =
                  index === 0 ||
                  day !== date.format(events[index - 1].created_at * 1000);
                const bot = data.accounts.find(
                  (item) => item.id === event.account_id,
                );
                return (
                  <li key={event.id}>
                    {heading && (
                      <p className="text-muted-foreground py-3 text-xs font-medium">
                        {day}
                      </p>
                    )}
                    <div className="flex items-start gap-3 rounded-xl px-2 py-2">
                      <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                        <HugeiconsIcon
                          icon={icons[kind]}
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {t(`channels.activityView.event.${label}`)}
                          </p>
                          {kind === "errors" && (
                            <Badge variant="destructive">
                              {t("channels.activityView.needsAttention")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {bot?.name ?? t("channels.activityView.unknownBot")}
                          {bot?.bot_username ? ` · @${bot.bot_username}` : ""}
                        </p>
                        {kind === "errors" && (
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            {t(
                              `channels.activityView.help.${label === "credentialsError" || label === "consumerConflict" || label === "rateLimited" ? label : "general"}`,
                            )}
                          </p>
                        )}
                      </div>
                      <time
                        className="text-muted-foreground shrink-0 text-xs"
                        dateTime={instant.toISOString()}
                        title={instant.toLocaleString(locale)}
                      >
                        {time.format(instant)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {t(
                    data.events.length
                      ? "channels.activityView.noMatches"
                      : "channels.noActivity",
                  )}
                </EmptyTitle>
                <EmptyDescription>
                  {t(
                    data.events.length
                      ? "channels.activityView.noMatchesHelp"
                      : "channels.noActivityDescription",
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {filtered.length > 0 && (
            <nav
              aria-label={t("channels.compact.pagination")}
              className="flex items-center justify-between gap-3 border-t pt-3"
            >
              <span
                className="text-muted-foreground text-xs"
                aria-live="polite"
              >
                {page + 1} / {pages} · {filtered.length}{" "}
                {t("channels.compact.events")}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  {t("channels.compact.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  {t("channels.compact.next")}
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
