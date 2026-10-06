import { useMemoryT as useUiT } from "./memory-i18n";
import { useState } from "react";
import { authFetch } from "@/features/auth";
import { useExternalProvidersStore } from "@/features/chat";

type Proposal = { type: string; label: string; content: string; quote: string };
type Result = {
  nodes: Proposal[];
  relations: {
    source: number;
    target: number;
    relation: string;
    quote: string;
  }[];
};

export function ExtractionReview({
  nodeId,
  onSaved,
}: { nodeId: string; onSaved: () => Promise<void> }) {
  const uiT = useUiT();

  const providers = useExternalProvidersStore((s) => s.providers).filter(
    (p) => p.authKind !== "chatgpt_oauth" && p.providerType !== "openai_codex",
  );
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const provider = providers.find((p) => p.id === providerId);
  const control = "h-9 w-full rounded-lg border bg-background px-2 text-xs";
  async function request(save: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(
        `/api/memory/nodes/${encodeURIComponent(nodeId)}/${save ? "accept-extraction" : "extract"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            save
              ? {
                  extraction: {
                    nodes: result?.nodes,
                    relations: result?.relations,
                  },
                  selectedIndices: chosen,
                }
              : { providerId, model },
          ),
        },
      );
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(
          typeof failure?.detail === "string"
            ? failure.detail
            : "No se pudo completar la operación",
        );
      }
      if (save) {
        setResult(null);
        setChosen([]);
        await onSaved();
      } else {
        setResult(await response.json());
        setChosen([]);
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Error de extracción",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-3 border-t pt-4 text-xs">
      <h4 className="font-medium">{uiT("ui.extract_knowledge")}</h4>
      <p className="text-muted-foreground">
        {uiT(
          "ui.this_message_will_be_sent_to_the_chosen_provider_it_may_consume_a",
        )}
      </p>
      <select
        aria-label={uiT("ui.extraction_provider")}
        className={control}
        value={providerId}
        disabled={busy}
        onChange={(e) => {
          setProviderId(e.target.value);
          setModel("");
          setResult(null);
        }}
      >
        <option value="">{uiT("ui.choose_api_provider")}</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label={uiT("ui.extraction_model")}
        className={control}
        value={model}
        disabled={busy || !provider}
        onChange={(e) => {
          setModel(e.target.value);
          setResult(null);
        }}
      >
        <option value="">{uiT("ui.choose_model")}</option>
        {provider?.models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={control}
        disabled={busy || !model || !providerId}
        onClick={() => void request(false)}
      >
        {busy ? uiT("ui.processing") : uiT("ui.send_message_and_get_proposals")}
      </button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="text-muted-foreground">
            {uiT("ui.unverified_proposals_select_only_what_you_want_to_keep")}
          </p>
          {result.nodes.length === 0 && (
            <p>{uiT("ui.no_useful_claims_were_extracted")}</p>
          )}
          {result.nodes.map((node, index) => (
            <label
              key={index}
              className="flex items-start gap-2 rounded-lg border p-3"
            >
              <input
                type="checkbox"
                disabled={busy}
                checked={chosen.includes(index)}
                onChange={(e) =>
                  setChosen((old) =>
                    e.target.checked
                      ? [...old, index]
                      : old.filter((i) => i !== index),
                  )
                }
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{node.label}</span>
                <span>{node.content}</span>
                <span className="text-muted-foreground">
                  {uiT("ui.source")}
                  {node.quote}»
                </span>
              </span>
            </label>
          ))}
          {result.relations.map((edge, index) => (
            <p key={index} className="text-muted-foreground">
              {result.nodes[edge.source]?.label} → {edge.relation} →{" "}
              {result.nodes[edge.target]?.label}
              <br />
              {uiT("ui.source")}
              {edge.quote}»
            </p>
          ))}
          <button
            type="button"
            className={control}
            disabled={busy || chosen.length === 0}
            onClick={() => void request(true)}
          >
            {uiT("ui.save_selected_items_and_their_connections")}
          </button>
        </>
      )}
    </section>
  );
}
