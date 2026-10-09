import { useState } from "react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { channelsApi } from "../api";
import type { ChannelAccount } from "../types";

export function ChannelProjects({
  account,
  onError,
  onChanged,
}: {
  account: ChannelAccount;
  onError: () => void;
  onChanged?: () => void;
}) {
  const t = useT();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof channelsApi.projects>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      setData(await channelsApi.projects(account.id));
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  async function toggle(user: string, project: string, checked: boolean) {
    if (!data || busy) return;
    const current = data.grants[user] ?? [];
    const ids = checked
      ? [...current, project]
      : current.filter((id) => id !== project);
    setBusy(true);
    try {
      await channelsApi.grantProjects(account.id, user, ids);
      setData({ ...data, grants: { ...data.grants, [user]: ids } });
      onChanged?.();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  async function setMode(user: string, mode: "all" | "selected") {
    if (!data || busy) return;
    setBusy(true);
    try {
      await channelsApi.grantProjects(
        account.id,
        user,
        data.grants[user] ?? [],
        mode,
      );
      setData({ ...data, access: { ...data.access, [user]: mode } });
      onChanged?.();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  async function setContext(user: string, context: boolean) {
    if (!data || busy) return;
    setBusy(true);
    try {
      await channelsApi.grantProjects(
        account.id,
        user,
        data.grants[user] ?? [],
        data.access?.[user] ?? "selected",
        context,
      );
      setData({ ...data, context: { ...data.context, [user]: context } });
      onChanged?.();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  return (
    <FieldSet className="mt-6">
      <FieldLegend>{t("channels.projects.title")}</FieldLegend>
      <FieldDescription>{t("channels.projects.help")}</FieldDescription>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy && <Spinner label={t("channels.loading")} />}
        {t("channels.projects.manage")}
      </Button>
      {data && (
        <FieldGroup>
          {data.projects.length === 0 && (
            <FieldDescription>{t("channels.projects.empty")}</FieldDescription>
          )}
          {account.allowed_user_ids.map((user) => (
            <FieldSet key={user}>
              <FieldLegend>
                {t("channels.projects.user")} {user}
              </FieldLegend>
              <Field orientation="horizontal">
                <Checkbox
                  id={`project-context-${account.id}-${user}`}
                  disabled={busy}
                  checked={
                    data.context?.[user] ?? account.owner_user_id === user
                  }
                  onCheckedChange={(value) =>
                    void setContext(user, value === true)
                  }
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <FieldLabel htmlFor={`project-context-${account.id}-${user}`}>
                    {t("channels.projects.readContext")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("channels.projects.contextHelp")}
                  </FieldDescription>
                </div>
              </Field>
              {account.owner_user_id === user && (
                <Field>
                  <FieldLabel htmlFor={`project-mode-${account.id}-${user}`}>
                    {t("channels.projects.accessMode")}
                  </FieldLabel>
                  <Select
                    value={data.access?.[user] ?? "selected"}
                    disabled={busy}
                    onValueChange={(value) =>
                      void setMode(user, value as "all" | "selected")
                    }
                  >
                    <SelectTrigger id={`project-mode-${account.id}-${user}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">
                          {t("channels.projects.all")}
                        </SelectItem>
                        <SelectItem value="selected">
                          {t("channels.projects.selected")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {data.access?.[user] === "all" &&
              account.owner_user_id === user ? (
                <FieldDescription>
                  {t("channels.projects.allHelp")}
                </FieldDescription>
              ) : (
                data.projects.map((project) => (
                  <Field orientation="horizontal" key={project.id}>
                    <Checkbox
                      id={`project-${account.id}-${user}-${project.id}`}
                      disabled={busy}
                      checked={(data.grants[user] ?? []).includes(project.id)}
                      onCheckedChange={(value) =>
                        void toggle(user, project.id, value === true)
                      }
                    />
                    <FieldLabel
                      htmlFor={`project-${account.id}-${user}-${project.id}`}
                    >
                      {project.name}
                    </FieldLabel>
                  </Field>
                ))
              )}
            </FieldSet>
          ))}
        </FieldGroup>
      )}
    </FieldSet>
  );
}
