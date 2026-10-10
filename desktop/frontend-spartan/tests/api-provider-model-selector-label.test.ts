import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs, stubJsxRuntime, type StubElement } from "./helpers/module-stubs.ts";
import { registerBundlerResolver } from "./helpers/kit.ts";

registerBundlerResolver();
const { externalModelLabel } = await import("../src/features/chat/lib/external-model-label.ts");

type Provider = { id: string; name: string; providerType: string; models: string[]; availableModels?: string[] };

function render(value: string, providers: Provider[] = []): StubElement {
  const state = { providers, connectionsEnabled: true };
  const components = (names: string[]) => Object.fromEntries(names.map(name => [name, name]));
  const { ApiProviderModelSelector } = loadWithStubs<{
    ApiProviderModelSelector: (props: { models: unknown[]; value: string; onValueChange: () => void; onConfigureProviders: () => void }) => StubElement;
  }>(new URL("../src/features/chat/components/api-provider-model-selector.tsx", import.meta.url), {
    "react/jsx-runtime": stubJsxRuntime(),
    react: { useMemo: (compute: () => unknown) => compute(), useState: (initial: unknown) => [initial, () => {}] },
    "@/i18n": { translate: (key: string) => key, useT: () => (key: string) => key },
    "@/components/ui/button": components(["Button"]),
    "@/components/ui/command": components(["Command", "CommandEmpty", "CommandGroup", "CommandInput", "CommandItem", "CommandList"]),
    "@/components/ui/popover": components(["Popover", "PopoverContent", "PopoverTrigger"]),
    "../api-provider-logo": components(["ApiProviderLogo"]),
    "../api/providers-api": {},
    "../catalog-reasoning": {},
    "../external-providers": { buildExternalModelId: (id: string, name: string) => `external::${id}::${encodeURIComponent(name)}` },
    "../lib/external-model-label": { externalModelLabel },
    "../stores/external-providers-store": { useExternalProvidersStore: (select: (current: typeof state) => unknown) => select(state) },
    "@/lib/utils": { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") },
    "@/lib/toast": { toast: {} },
    "lucide-react": components(["Check", "ChevronDown", "RefreshCw", "Settings2"]),
  });
  return ApiProviderModelSelector({ models: [], value, onValueChange: () => {}, onConfigureProviders: () => {} });
}

function find(node: unknown, type: string): StubElement | undefined {
  if (Array.isArray(node)) return node.map(child => find(child, type)).find(Boolean);
  if (!node || typeof node !== "object") return undefined;
  const element = node as StubElement;
  return element.type === type ? element : find(element.props?.children, type);
}

test("a model removed from the catalog keeps its saved name in the trigger", () => {
  const tree = render("external::connection::kimi-k2.5", [{ id: "connection", name: "API", providerType: "custom", models: ["other"] }]);
  const trigger = find(tree, "PopoverTrigger");
  assert.ok(trigger);
  assert.equal(find(trigger, "span")?.props.children, "kimi-k2.5");
  assert.equal(find(trigger, "Button")?.props.title, "kimi-k2.5");
});

test("a removed connection does not hide the saved model or its configuration action", () => {
  const tree = render("external::connection::org%2Fmodel");
  assert.equal(tree.type, "Popover");
  assert.equal(find(find(tree, "PopoverTrigger"), "span")?.props.children, "model");
  assert.equal(find(find(tree, "PopoverTrigger"), "Button")?.props.title, "org/model");
  assert.ok(find(tree, "PopoverContent"));
});

test("a fresh chat without a connection still offers the provider setup button", () => {
  const tree = render("");
  assert.equal(tree.type, "Button");
  assert.equal(tree.props.children, "ui.choose_provider");
  assert.equal(tree.props.disabled, false);
});
