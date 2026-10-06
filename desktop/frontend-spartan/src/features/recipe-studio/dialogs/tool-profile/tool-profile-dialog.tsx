import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toastError } from "@/shared/toast";
import {
  ArrowRight01Icon,
  Delete02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { listMcpTools } from "../../api";
import { ChipInput } from "../../components/chip-input";
import type {
  LlmMcpProviderConfig,
  McpEnvVar,
  ToolProfileConfig,
} from "../../types";
import { CollapsibleSectionTriggerButton } from "../shared/collapsible-section-trigger";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";
import {
  addUnique,
  collectToolSuggestions,
  createMcpProviderId,
  isProviderReadyForToolFetch,
  toApiProvider,
} from "./helpers";

type ToolProfileDialogProps = {
  config: ToolProfileConfig;
  onUpdate: (patch: Partial<ToolProfileConfig>) => void;
};

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function isProviderConfigured(provider: LlmMcpProviderConfig): boolean {
  const hasName = provider.name.trim().length > 0;
  if (!hasName) {
    return false;
  }
  if (provider.provider_type === "stdio") {
    return (provider.command?.trim().length ?? 0) > 0;
  }
  return (provider.endpoint?.trim().length ?? 0) > 0;
}

function McpServerCard({
  provider,
  index,
  toolsCount,
  error,
  open,
  onOpenChange,
  onUpdateProviderAt,
  onRemoveProvider,
  onAddProviderArg,
  onUpdateProviderArg,
  onRemoveProviderArg,
  onAddProviderEnv,
  onUpdateProviderEnv,
  onRemoveProviderEnv,
}: {
  provider: LlmMcpProviderConfig;
  index: number;
  toolsCount?: number;
  error?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateProviderAt: (
    index: number,
    patch: Partial<LlmMcpProviderConfig>,
  ) => void;
  onRemoveProvider: (index: number) => void;
  onAddProviderArg: (index: number) => void;
  onUpdateProviderArg: (index: number, argIndex: number, value: string) => void;
  onRemoveProviderArg: (index: number, argIndex: number) => void;
  onAddProviderEnv: (index: number) => void;
  onUpdateProviderEnv: (
    index: number,
    envIndex: number,
    patch: Partial<McpEnvVar>,
  ) => void;
  onRemoveProviderEnv: (index: number, envIndex: number) => void;
}): ReactElement {
  const uiT = useUiT();

  const args = provider.args && provider.args.length > 0 ? provider.args : [""];
  const envVars =
    provider.env && provider.env.length > 0
      ? provider.env
      : [{ key: "", value: "" }];
  const summaryTitle = provider.name.trim() || `Tool server ${index + 1}`;
  const transportLabel =
    provider.provider_type === "stdio" ? "Local command" : "HTTP";
  const toolsLabel =
    typeof toolsCount === "number" ? `${toolsCount} tools` : null;
  const description =
    provider.provider_type === "stdio"
      ? "Runs a local tool server."
      : "Calls a remote tool server.";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="rounded-2xl border border-border/60 bg-background/80">
        <div className="flex items-start gap-2 px-4 py-4">
          <CollapsibleTrigger asChild={true}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {summaryTitle}
                  </p>
                  <Badge
                    variant="outline"
                    className="rounded-full text-ui-10 uppercase"
                  >
                    {transportLabel}
                  </Badge>
                  {toolsLabel ? (
                    <Badge
                      variant="secondary"
                      className="rounded-full text-ui-10"
                    >
                      {toolsLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onRemoveProvider(index)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </Button>
        </div>

        <CollapsibleContent className="space-y-4 border-t border-border/50 px-4 pt-4 pb-4">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("ui.server_name")}
              hint="Name shown in this tool access setup."
            />
            <Input
              className="nodrag"
              value={provider.name}
              placeholder="context7"
              onChange={(event) =>
                onUpdateProviderAt(index, { name: event.target.value })
              }
            />
          </div>

          <Tabs
            value={provider.provider_type}
            onValueChange={(value) =>
              onUpdateProviderAt(index, {
                // biome-ignore lint/style/useNamingConvention: ui schema
                provider_type: value === "stdio" ? "stdio" : "streamable_http",
              })
            }
          >
            <TabsList className="w-full">
              <TabsTrigger value="stdio">{uiT("ui.local_command")}</TabsTrigger>
              <TabsTrigger value="streamable_http">{uiT("ui.http_endpoint")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {provider.provider_type === "stdio" ? (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("ui.command_")}
                  hint="Command used to start the tool server."
                />
                <Input
                  className="nodrag"
                  value={provider.command ?? ""}
                  placeholder="npx"
                  onChange={(event) =>
                    onUpdateProviderAt(index, { command: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel
                    label={uiT("ui.arguments")}
                    hint="Optional command arguments."
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onAddProviderArg(index)}
                  >
                    <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                    {uiT("ui.add_arg")}</Button>
                </div>
                {args.map((arg, argIndex) => (
                  <div
                    key={`${provider.id}-arg-${argIndex}`}
                    className="flex gap-2"
                  >
                    <Input
                      className="nodrag"
                      value={arg}
                      placeholder={argIndex === 0 ? "-y" : uiT("ui.argument")}
                      onChange={(event) =>
                        onUpdateProviderArg(index, argIndex, event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemoveProviderArg(index, argIndex)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel
                    label={uiT("ui.environment_variables")}
                    hint="Optional values passed to the tool server."
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onAddProviderEnv(index)}
                  >
                    <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                    {uiT("ui.add_env")}</Button>
                </div>
                {envVars.map((item, envIndex) => (
                  <div
                    key={`${provider.id}-env-${envIndex}`}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2"
                  >
                    <Input
                      className="nodrag"
                      value={item.key}
                      placeholder="KEY"
                      onChange={(event) =>
                        onUpdateProviderEnv(index, envIndex, {
                          key: event.target.value,
                        })
                      }
                    />
                    <Input
                      className="nodrag"
                      value={item.value}
                      placeholder={uiT("ui.value_")}
                      onChange={(event) =>
                        onUpdateProviderEnv(index, envIndex, {
                          value: event.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemoveProviderEnv(index, envIndex)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <FieldLabel label={uiT("ui.endpoint")} hint="URL for the tool server." />
                <Input
                  className="nodrag"
                  value={provider.endpoint ?? ""}
                  placeholder="https://example.com/mcp"
                  onChange={(event) =>
                    onUpdateProviderAt(index, { endpoint: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <FieldLabel
                    label={uiT("ui.api_key_environment_variable")}
                    hint="Optional environment variable that stores the API key."
                  />
                  <Input
                    className="nodrag"
                    value={provider.api_key_env ?? ""}
                    placeholder="TOOL_SERVER_API_KEY"
                    onChange={(event) =>
                      onUpdateProviderAt(index, {
                        // biome-ignore lint/style/useNamingConvention: api schema
                        api_key_env: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel label={uiT("chat.providersDialog.apiKey")} hint="Optional API key." />
                  <Input
                    className="nodrag"
                    value={provider.api_key ?? ""}
                    placeholder="token"
                    onChange={(event) =>
                      onUpdateProviderAt(index, {
                        // biome-ignore lint/style/useNamingConvention: api schema
                        api_key: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ToolProfileDialog({
  config,
  onUpdate,
}: ToolProfileDialogProps): ReactElement {
  const uiT = useUiT();

  const providers = config.mcp_providers;
  const [activeTab, setActiveTab] = useState<"profile" | "servers">(
    providers.length > 0 ? "profile" : "servers",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolsByProvider, setToolsByProvider] = useState<
    Record<string, string[]>
  >(config.fetched_tools_by_provider ?? {});
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>(
    {},
  );
  const [duplicateTools, setDuplicateTools] = useState<
    Record<string, string[]>
  >({});
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>(
    {},
  );
  const previousProviderSignatureRef = useRef<string | null>(null);

  const providerSignature = useMemo(
    () =>
      JSON.stringify(
        providers.map((provider) => ({
          name: provider.name,
          // biome-ignore lint/style/useNamingConvention: ui schema
          provider_type: provider.provider_type,
          command: provider.command,
          args: provider.args,
          env: provider.env,
          endpoint: provider.endpoint,
          // biome-ignore lint/style/useNamingConvention: api schema
          api_key: provider.api_key,
          // biome-ignore lint/style/useNamingConvention: api schema
          api_key_env: provider.api_key_env,
        })),
      ),
    [providers],
  );

  useEffect(() => {
    const previousSignature = previousProviderSignatureRef.current;
    previousProviderSignatureRef.current = providerSignature;
    if (previousSignature === null) {
      setToolsByProvider(config.fetched_tools_by_provider ?? {});
      return;
    }
    if (previousSignature === providerSignature) {
      return;
    }
    setToolsByProvider({});
    setProviderErrors({});
    setDuplicateTools({});
    if (Object.keys(config.fetched_tools_by_provider ?? {}).length > 0) {
      onUpdate({
        // biome-ignore lint/style/useNamingConvention: ui schema
        fetched_tools_by_provider: {},
      });
    }
  }, [config.fetched_tools_by_provider, onUpdate, providerSignature]);

  useEffect(() => {
    const tools = config.fetched_tools_by_provider ?? {};
    setToolsByProvider(tools);
  }, [config.fetched_tools_by_provider]);

  useEffect(() => {
    setOpenProviders((current) => {
      const next: Record<string, boolean> = {};
      for (const provider of providers) {
        next[provider.id] =
          current[provider.id] ?? !isProviderConfigured(provider);
      }
      return next;
    });
  }, [providers]);

  function updateProviders(nextProviders: LlmMcpProviderConfig[]): void {
    onUpdate({
      // biome-ignore lint/style/useNamingConvention: ui schema
      mcp_providers: nextProviders,
    });
  }

  function updateProviderAt(
    index: number,
    patch: Partial<LlmMcpProviderConfig>,
  ): void {
    updateProviders(
      providers.map((provider, currentIndex) =>
        currentIndex === index ? { ...provider, ...patch } : provider,
      ),
    );
  }

  function mutateProviderAt(
    index: number,
    mapProvider: (
      provider: LlmMcpProviderConfig,
    ) => Partial<LlmMcpProviderConfig>,
  ): void {
    const provider = providers[index];
    if (!provider) {
      return;
    }
    updateProviderAt(index, mapProvider(provider));
  }

  function removeProvider(index: number): void {
    updateProviders(
      providers.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function addProvider(): void {
    updateProviders([
      ...providers,
      {
        id: createMcpProviderId(config.id, providers.length),
        name: "",
        // biome-ignore lint/style/useNamingConvention: ui schema
        provider_type: "stdio",
        command: "",
        args: [],
        env: [],
        endpoint: "",
        // biome-ignore lint/style/useNamingConvention: api schema
        api_key: "",
        // biome-ignore lint/style/useNamingConvention: api schema
        api_key_env: "",
      },
    ]);
  }

  function addProviderArg(providerIndex: number): void {
    mutateProviderAt(providerIndex, (provider) => ({
      args: [...(provider.args ?? []), ""],
    }));
  }

  function updateProviderArg(
    providerIndex: number,
    argIndex: number,
    value: string,
  ): void {
    mutateProviderAt(providerIndex, (provider) => {
      const nextArgs =
        provider.args && provider.args.length > 0 ? [...provider.args] : [""];
      nextArgs[argIndex] = value;
      return { args: nextArgs };
    });
  }

  function removeProviderArg(providerIndex: number, argIndex: number): void {
    mutateProviderAt(providerIndex, (provider) => ({
      args: (provider.args ?? []).filter(
        (_, currentIndex) => currentIndex !== argIndex,
      ),
    }));
  }

  function addProviderEnv(providerIndex: number): void {
    mutateProviderAt(providerIndex, (provider) => ({
      env: [...(provider.env ?? []), { key: "", value: "" }],
    }));
  }

  function updateProviderEnv(
    providerIndex: number,
    envIndex: number,
    patch: Partial<McpEnvVar>,
  ): void {
    mutateProviderAt(providerIndex, (provider) => ({
      env: (provider.env && provider.env.length > 0
        ? provider.env
        : [{ key: "", value: "" }]
      ).map((item, currentIndex) =>
        currentIndex === envIndex ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeProviderEnv(providerIndex: number, envIndex: number): void {
    mutateProviderAt(providerIndex, (provider) => ({
      env: (provider.env ?? []).filter(
        (_, currentIndex) => currentIndex !== envIndex,
      ),
    }));
  }

  async function loadTools(): Promise<void> {
    const readyProviders = providers.filter(isProviderReadyForToolFetch);
    if (readyProviders.length === 0) {
      toastError(
        uiTranslate("ui.no_tool_servers_are_ready"),
        "Add a server name plus a command or endpoint first.",
      );
      return;
    }

    setLoadingTools(true);
    try {
      const timeoutRaw = config.timeout_sec?.trim();
      const timeoutSec =
        timeoutRaw && Number.isFinite(Number(timeoutRaw))
          ? Number(timeoutRaw)
          : 15;
      const response = await listMcpTools({
        // biome-ignore lint/style/useNamingConvention: api schema
        mcp_providers: readyProviders.map(toApiProvider),
        // biome-ignore lint/style/useNamingConvention: api schema
        timeout_sec: timeoutSec,
      });
      const nextToolsByProvider = Object.fromEntries(
        response.providers
          .filter((provider) => provider.name.trim())
          .map((provider) => [provider.name.trim(), provider.tools]),
      );
      setToolsByProvider(nextToolsByProvider);
      onUpdate({
        // biome-ignore lint/style/useNamingConvention: ui schema
        fetched_tools_by_provider: nextToolsByProvider,
      });
      setProviderErrors(
        Object.fromEntries(
          response.providers
            .filter((provider) => provider.name.trim() && provider.error)
            .map((provider) => [
              provider.name.trim(),
              provider.error ?? "Failed to load tools.",
            ]),
        ),
      );
      setDuplicateTools(response.duplicate_tools ?? {});
    } catch (error) {
      toastError(
        uiTranslate("ui.couldn_t_load_tools"),
        error instanceof Error
          ? error.message
          : "We couldn't load the tools for these servers.",
      );
    } finally {
      setLoadingTools(false);
    }
  }

  const providerNames = useMemo(
    () =>
      Array.from(
        new Set(
          providers.map((provider) => provider.name.trim()).filter(Boolean),
        ),
      ),
    [providers],
  );
  const availableTools = useMemo(
    () => collectToolSuggestions(providerNames, toolsByProvider),
    [providerNames, toolsByProvider],
  );
  const hasProviders = providers.length > 0;

  useEffect(() => {
    if (!hasProviders && activeTab === "profile") {
      setActiveTab("servers");
    }
  }, [activeTab, hasProviders]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        setActiveTab(value === "servers" ? "servers" : "profile")
      }
      className="w-full"
    >
      <TabsList className="w-full">
        <TabsTrigger value="servers">{uiT("ui.1_add_servers")}</TabsTrigger>
        <TabsTrigger value="profile">{uiT("ui.2_choose_tools")}</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4 pt-3">
        <NameField
          label={uiT("ui.tool_access_name")}
          value={config.name}
          onChange={(value) => onUpdate({ name: value })}
        />

        {hasProviders ? (
          <>
            <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {uiT("ui.pick_which_tools_this_setup_may_use")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {uiT("ui.1_load_tool_names_from_your_servers_2_leave_the_list_empty_to_all")}</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {uiT("ui.available_tools")}</p>
                  <p className="text-xs text-muted-foreground">
                    {uiT("ui.load_tool_names_so_you_can_pick_from_a_list_instead_of_guessing")}</p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={loadingTools}
                  onClick={() => {
                    void loadTools();
                  }}
                >
                  {loadingTools ? uiT("studio.history.loading") : uiT("ui.load_tools")}
                </Button>
              </div>

              {Object.keys(toolsByProvider).length === 0 &&
                Object.keys(providerErrors).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {uiT("ui.load_tools_to_browse_what_s_available")}</p>
                )}

              {Object.entries(toolsByProvider).map(
                ([providerName, toolNames]) => (
                  <div key={providerName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {providerName}
                      </p>
                      <Badge
                        variant="outline"
                        className="rounded-full text-ui-10"
                      >
                        {toolNames.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {toolNames.map((toolName) => (
                        <Badge
                          key={`${providerName}-${toolName}`}
                          variant="secondary"
                        >
                          {toolName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ),
              )}

              {Object.entries(duplicateTools).length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {uiT("ui.some_tool_names_appear_on_more_than_one_server")}{" "}
                  {Object.entries(duplicateTools)
                    .map(
                      ([toolName, providerList]) =>
                        `${toolName} (${providerList.join(", ")})`,
                    )
                    .join("; ")}
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <FieldLabel
                label={uiT("ui.tools_this_setup_may_use")}
                hint="Leave this empty to allow every tool from these servers."
              />
              <ChipInput
                values={config.allow_tools ?? []}
                suggestions={availableTools}
                onAdd={(value) =>
                  onUpdate({
                    // biome-ignore lint/style/useNamingConvention: api schema
                    allow_tools: addUnique(config.allow_tools ?? [], value),
                  })
                }
                onRemove={(toolIndex) =>
                  onUpdate({
                    // biome-ignore lint/style/useNamingConvention: api schema
                    allow_tools: (config.allow_tools ?? []).filter(
                      (_, currentIndex) => currentIndex !== toolIndex,
                    ),
                  })
                }
                placeholder={uiT("ui.type_tool_name_and_press_enter")}
              />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild={true}>
                <CollapsibleSectionTriggerButton
                  label={uiT("ui.tool_call_limits")}
                  open={advancedOpen}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <FieldLabel
                      label={uiT("ui.max_tool_use_turns")}
                      hint="How many back-and-forth tool calls an AI step can make."
                    />
                    <Input
                      className="nodrag"
                      value={config.max_tool_call_turns ?? ""}
                      onChange={(event) =>
                        onUpdate({
                          // biome-ignore lint/style/useNamingConvention: api schema
                          max_tool_call_turns: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <FieldLabel
                      label={uiT("ui.timeout_seconds")}
                      hint="How long to wait when loading or calling tools."
                    />
                    <Input
                      className="nodrag"
                      value={config.timeout_sec ?? ""}
                      onChange={(event) =>
                        onUpdate({
                          // biome-ignore lint/style/useNamingConvention: api schema
                          timeout_sec: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        ) : (
          <div className="space-y-3">
            <EmptyState
              title={uiT("ui.add_a_server_to_start_choosing_tools")}
              description={uiT("ui.set_up_a_server_first_then_come_back_here_to_choose_which_tools_t")}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("servers")}
            >
              {uiT("ui.add_servers_first")}</Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="servers" className="space-y-4 pt-3">
        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            {uiT("ui.add_one_or_more_tool_servers")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {uiT("ui.after_your_servers_are_ready_switch_to_choose_tools_to_load_names")}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel
            label={uiT("ui.tool_servers")}
            hint="These servers belong to this tool access setup and can be reused by linked AI steps."
          />
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={addProvider}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {uiT("ui.add_server")}</Button>
        </div>

        {hasProviders ? (
          <div className="space-y-3">
            {providers.map((provider, index) => (
              <McpServerCard
                key={provider.id}
                provider={provider}
                index={index}
                toolsCount={
                  provider.name.trim()
                    ? (toolsByProvider[provider.name.trim()] ?? []).length
                    : undefined
                }
                error={
                  provider.name.trim()
                    ? providerErrors[provider.name.trim()]
                    : undefined
                }
                open={
                  openProviders[provider.id] ?? !isProviderConfigured(provider)
                }
                onOpenChange={(open) =>
                  setOpenProviders((current) => ({
                    ...current,
                    [provider.id]: open,
                  }))
                }
                onUpdateProviderAt={updateProviderAt}
                onRemoveProvider={removeProvider}
                onAddProviderArg={addProviderArg}
                onUpdateProviderArg={updateProviderArg}
                onRemoveProviderArg={removeProviderArg}
                onAddProviderEnv={addProviderEnv}
                onUpdateProviderEnv={updateProviderEnv}
                onRemoveProviderEnv={removeProviderEnv}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={uiT("ui.no_tool_servers_yet")}
            description={uiT("ui.add_one_or_more_servers_here_then_go_back_to_access_to_load_and_c")}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
