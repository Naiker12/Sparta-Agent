import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import {
  Delete02Icon,
  Edit03Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshCwIcon, UploadIcon } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "@/lib/toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  type McpCatalogTemplate,
  type McpServerConfig,
  createMcpServer,
  deleteMcpServer,
  importMcpServers,
  listMcpCatalog,
  listMcpServers,
  refreshMcpServerTools,
  testMcpServer,
  updateMcpServer,
} from "./api/mcp-servers-api";
type HeaderRow = { id: string; key: string; value: string };

type FormState = {
  displayName: string;
  url: string;
  headers: HeaderRow[];
  useOauth: boolean;
};

const EMPTY_FORM: FormState = {
  displayName: "",
  url: "",
  headers: [],
  useOauth: false,
};

function newRowId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

function headersFromObject(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([k, v]) => ({
    id: newRowId(),
    key: k,
    value: v,
  }));
}

function headersToObject(
  rows: HeaderRow[],
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) {
      continue;
    }
    out[key] = row.value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// A non-HTTP address is a local stdio command. Case-insensitive to match the
// backend's is_stdio(), so all layers split http-vs-command identically.
function isHttpAddress(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

function isValidAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (isHttpAddress(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
  // Otherwise it's a local command (stdio); the backend gates whether those
  // are allowed. Reject only when the command itself is a URL; "://" is fine
  // inside an argument (e.g. a DB connection string passed to the server).
  return !trimmed.split(/\s+/)[0].includes("://");
}

function HeadersEditor({
  rows,
  onChange,
  stdio,
}: {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  // stdio servers reuse this editor for environment variables instead of headers.
  stdio: boolean;
}) {
  const uiT = useUiT();

  const update = (id: string, patch: Partial<HeaderRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const add = () => onChange([...rows, { id: newRowId(), key: "", value: "" }]);
  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id));

  const copy = stdio
    ? {
        get label() { return uiTranslate("ui.environment_variables"); },
        add: "Add variable",
        keyPlaceholder: "Variable name",
        valuePlaceholder: "Variable value",
        remove: "Remove variable",
      }
    : {
        get label() { return uiTranslate("ui.custom_headers"); },
        add: "Add header",
        keyPlaceholder: "Header name",
        valuePlaceholder: "Header value",
        remove: "Remove header",
      };

  return (
    <>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{copy.label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
          {copy.add}
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          {stdio ? (
            uiT("ui.optional_environment_variables_passed_to_the_server_process")
          ) : (
            <>
              {uiT("ui.optional_add_an")}{" "}<code>Authorization</code> {" "}{uiT("ui.header_here_for_servers_that_require_auth")}</>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.key}
                placeholder={copy.keyPlaceholder}
                onChange={(e) => update(row.id, { key: e.target.value })}
              />
              <Input
                value={row.value}
                placeholder={copy.valuePlaceholder}
                onChange={(e) => update(row.id, { value: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(row.id)}
                aria-label={copy.remove}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export interface ChatMcpServersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View =
  | { kind: "list" }
  | { kind: "catalog" }
  | { kind: "create" }
  | { kind: "edit"; id: string };

export function ChatMcpServersDialog({
  open,
  onOpenChange,
}: ChatMcpServersDialogProps) {
  const uiT = useUiT();

  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [catalog, setCatalog] = useState<McpCatalogTemplate[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] =
    useState<McpServerConfig | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMcpServers();
      setServers(rows);
    } catch (err) {
      toast.error(uiTranslate("ui.failed_to_load_mcp_servers"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    refresh();
    // Reset to the list on each open, else a stale create/edit view persists.
    setView({ kind: "list" });
    setForm(EMPTY_FORM);
  }, [open, refresh]);

  function startCreate() {
    setView({ kind: "create" });
    setForm(EMPTY_FORM);
  }

  async function openCatalog() {
    setView({ kind: "catalog" });
    if (catalog.length > 0) {
      return;
    }
    setCatalogLoading(true);
    try {
      setCatalog(await listMcpCatalog());
    } catch (err) {
      toast.error(uiTranslate("ui.failed_to_load_mcp_catalog"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCatalogLoading(false);
    }
  }

  function applyCatalogTemplate(template: McpCatalogTemplate) {
    const address =
      template.url ??
      [template.command, ...template.args].filter(Boolean).join(" ");
    setForm({
      displayName: template.name,
      url: address,
      headers: [],
      useOauth: template.auth_type === "oauth2",
    });
    setView({ kind: "create" });
  }

  function startEdit(server: McpServerConfig) {
    setView({ kind: "edit", id: server.id });
    setForm({
      displayName: server.display_name,
      url: server.url,
      headers: headersFromObject(server.headers ?? {}),
      useOauth: server.use_oauth ?? false,
    });
  }

  function cancelForm() {
    setView({ kind: "list" });
    setForm(EMPTY_FORM);
  }

  async function testConnection() {
    const trimmedUrl = form.url.trim();
    if (!isValidAddress(trimmedUrl)) {
      toast.error(uiTranslate("ui.enter_an_http_s_url_or_a_local_command_first"));
      return;
    }
    setTesting(true);
    try {
      const result = await testMcpServer({
        url: trimmedUrl,
        headers: headersToObject(form.headers),
        useOauth: form.useOauth,
      });
      if (result.ok) {
        toast.success(
          `Connected (${result.tool_count} tool${result.tool_count === 1 ? "" : "s"})`,
        );
      } else {
        toast.error(uiTranslate("ui.connection_failed"), {
          description: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      toast.error(uiTranslate("ui.connection_test_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }

  async function submitForm() {
    const trimmedName = form.displayName.trim();
    const trimmedUrl = form.url.trim();
    if (!trimmedName) {
      toast.error(uiTranslate("ui.display_name_is_required"));
      return;
    }
    if (!trimmedUrl) {
      toast.error(uiTranslate("ui.url_or_command_is_required"));
      return;
    }
    if (!isValidAddress(trimmedUrl)) {
      toast.error(uiTranslate("ui.enter_an_http_s_url_or_a_local_command"));
      return;
    }
    setSaving(true);
    try {
      const headers = headersToObject(form.headers);
      if (view.kind === "edit") {
        await updateMcpServer(view.id, {
          displayName: trimmedName,
          url: trimmedUrl,
          headers: headers ?? null,
          useOauth: form.useOauth,
        });
        toast.success(uiTranslate("ui.mcp_server_updated"));
      } else {
        await createMcpServer({
          displayName: trimmedName,
          url: trimmedUrl,
          headers: headers,
          useOauth: form.useOauth,
        });
        toast.success(uiTranslate("ui.mcp_server_added"));
      }
      cancelForm();
      await refresh();
    } catch (err) {
      toast.error(uiTranslate("ui.save_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file later
    if (!file) {
      return;
    }
    let config: unknown;
    try {
      config = JSON.parse(await file.text());
    } catch {
      toast.error(uiTranslate("ui.invalid_json_file"));
      return;
    }
    setImporting(true);
    try {
      const result = await importMcpServers(config);
      const parts = [`${result.created.length} added`];
      if (result.skipped.length > 0) {
        parts.push(`${result.skipped.length} skipped`);
      }
      if (result.errors.length > 0) {
        parts.push(
          `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`,
        );
      }
      const summary = parts.join(", ");
      if (result.errors.length > 0) {
        toast.warning(summary, {
          description: (
            <div className="whitespace-pre-line">
              {result.errors.slice(0, 5).join("\n")}
            </div>
          ),
        });
      } else {
        toast.success(summary);
      }
      await refresh();
    } catch (err) {
      toast.error(uiTranslate("ui.import_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setImporting(false);
    }
  }

  async function removeServer(server: McpServerConfig) {
    try {
      await deleteMcpServer(server.id);
      await refresh();
    } catch (err) {
      toast.error(uiTranslate("ui.delete_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function toggleEnabled(server: McpServerConfig, next: boolean) {
    // Optimistic update so the switch doesn't snap back during the round-trip.
    setServers((rows) =>
      rows.map((row) =>
        row.id === server.id ? { ...row, is_enabled: next } : row,
      ),
    );
    try {
      await updateMcpServer(server.id, { isEnabled: next });
    } catch (err) {
      setServers((rows) =>
        rows.map((row) =>
          row.id === server.id ? { ...row, is_enabled: !next } : row,
        ),
      );
      toast.error(uiTranslate("update.screen.updateFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function refreshTools(server: McpServerConfig) {
    setRefreshingId(server.id);
    try {
      const result = await refreshMcpServerTools(server.id);
      if (result.ok) {
        toast.success(
          `Refreshed "${server.display_name}" (${result.tool_count} tool${result.tool_count === 1 ? "" : "s"})`,
        );
      } else {
        toast.error(`Refresh failed for "${server.display_name}"`, {
          description: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      toast.error(uiTranslate("ui.refresh_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRefreshingId(null);
    }
  }

  const showForm = view.kind === "create" || view.kind === "edit";
  // A local stdio command uses env vars, not headers or OAuth.
  const addressIsCommand = form.url.trim() !== "" && !isHttpAddress(form.url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{uiT("ui.mcp_servers")}</DialogTitle>
          <DialogDescription>
            {uiT("ui.register_remote_http_or_local_stdio_command_mcp_servers")}</DialogDescription>
        </DialogHeader>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
        />

        {view.kind === "catalog" ? (
          <div className="flex max-h-[60dvh] flex-col gap-3 overflow-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {uiT("ui.choose_a_template_then_review_credentials_and_confirm_before_conn")}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelForm}
              >
                {uiT("tour.back")}</Button>
            </div>
            {catalogLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : catalog.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                {uiT("ui.no_mcp_templates_are_available")}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {catalog.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge variant="outline">{template.category}</Badge>
                        <Badge variant="outline">{template.transport}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      {template.auth_type !== "none" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {uiT("ui.requires")}{" "}
                          {template.auth_type === "oauth2"
                            ? uiT("ui.oauth_sign_in")
                            : [
                                ...template.env_required,
                                ...template.headers_required,
                              ].join(", ") || uiT("ui.an_api_key")}
                          .
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyCatalogTemplate(template)}
                    >
                      {uiT("ui.use_template")}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showForm ? (
          <div className="flex flex-col gap-4">
            {view.kind === "create" && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {uiT("ui.import_servers_from_a_config_file")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  title={uiT("ui.import_servers_from_a_mcpservers_json_config_claude_desktop_curso")}
                >
                  {importing ? <Spinner /> : <UploadIcon size={14} />}
                  {uiT("ui.import_config")}</Button>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="mcp-display-name">{uiT("settings.profile.displayName")}</Label>
              <Input
                id="mcp-display-name"
                value={form.displayName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder={uiT("ui.e_g_github_mcp")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mcp-url">{uiT("ui.url_or_command")}</Label>
              <Input
                id="mcp-url"
                value={form.url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder={uiT("ui.https_example_com_mcp_or_npx_y_modelcontextprotocol_server_filesy")}
              />
              <span className="text-xs text-muted-foreground">
                {uiT("ui.an_http_s_url_for_a_remote_server_or_a_local_command_to_run_an_st")}</span>
            </div>

            {!addressIsCommand && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-sm" htmlFor="mcp-oauth">
                    {uiT("ui.use_oauth_sign_in")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {uiT("ui.for_servers_that_require_browser_based_authentication_github_line")}</span>
                </div>
                <Switch
                  id="mcp-oauth"
                  checked={form.useOauth}
                  onCheckedChange={(useOauth) =>
                    setForm((prev) => ({ ...prev, useOauth }))
                  }
                />
              </div>
            )}

            <HeadersEditor
              rows={form.headers}
              onChange={(headers) => setForm((prev) => ({ ...prev, headers }))}
              stdio={addressIsCommand}
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing || saving || !form.url.trim()}
              >
                {testing ? <Spinner /> : null}
                {uiT("chat.providersDialog.testConnection")}</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={cancelForm} disabled={saving}>
                  {uiT("chat.workspace.cancel")}</Button>
                <Button onClick={submitForm} disabled={saving}>
                  {saving ? <Spinner /> : null}
                  {view.kind === "edit" ? uiT("ui.save_changes") : uiT("ui.add_server")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={openCatalog}>
                {uiT("ui.browse_catalog")}</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title={uiT("ui.import_servers_from_a_mcpservers_json_config_claude_desktop_curso")}
              >
                {importing ? <Spinner /> : <UploadIcon size={14} />}
                {uiT("ui.import_config")}</Button>
              <Button size="sm" onClick={startCreate}>
                <HugeiconsIcon icon={PlusSignIcon} size={14} />
                {uiT("ui.add_server")}</Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : servers.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                {uiT("ui.no_mcp_servers_configured_yet")}</div>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {servers.map((server) => (
                  <li
                    key={server.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {server.display_name}
                        </span>
                        <Badge
                          variant={server.is_enabled ? "secondary" : "outline"}
                        >
                          {server.is_enabled ? uiT("ui.enabled") : uiT("ui.disabled_")}
                        </Badge>
                        <Badge variant="outline">
                          {server.url.startsWith("http") ? "HTTP" : "stdio"}
                        </Badge>
                        {server.use_oauth ? (
                          <Badge variant="outline">OAuth</Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {server.tool_count === null
                          ? uiT("ui.tools_not_discovered_yet")
                          : `${server.tool_count} tool${server.tool_count === 1 ? "" : "s"}`}{" "}
                        · {server.url}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={server.is_enabled}
                        onCheckedChange={(next) => toggleEnabled(server, next)}
                        aria-label={uiT("ui.enable_server")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => refreshTools(server)}
                        aria-label={uiT("ui.refresh_tools")}
                        title={uiT("ui.refresh_tools_from_this_server")}
                        disabled={refreshingId === server.id}
                      >
                        {refreshingId === server.id ? (
                          <Spinner />
                        ) : (
                          <RefreshCwIcon size={14} />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(server)}
                        aria-label={uiT("ui.edit_server")}
                      >
                        <HugeiconsIcon icon={Edit03Icon} size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmingDelete(server)}
                        aria-label={uiT("ui.delete_server")}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
      <AlertDialog
        open={confirmingDelete !== null}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiT("ui.delete_mcp_server")}</AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("chat.menu.delete")}{" "}
              <span className="font-medium text-foreground">
                &quot;{confirmingDelete?.display_name}&quot;
              </span>
              {uiT("ui.its_tools_stop_being_available_to_chats_this_cannot_be_undone")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const server = confirmingDelete;
                setConfirmingDelete(null);
                if (server) {
                  void removeServer(server);
                }
              }}
            >
              {uiT("chat.menu.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
