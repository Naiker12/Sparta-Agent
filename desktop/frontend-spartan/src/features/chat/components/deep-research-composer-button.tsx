import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronDownStandardIcon } from "@/lib/chevron-icons";
import { cn } from "@/lib/utils";
import { Telescope02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { XIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import {
  DEFAULT_RESEARCH_MODEL_TIMEOUT_SECONDS,
  useChatRuntimeStore,
} from "../stores/chat-runtime-store";
import type { ResearchWebsitePolicy } from "../types/research";
import { MAX_RESEARCH_MODEL_TIMEOUT_SECONDS } from "../utils/mirrored-chat-settings";

// The field is in minutes; its ceiling is the seconds cap the backend enforces.
const MAX_RESEARCH_MODEL_TIMEOUT_MINUTES = Math.floor(
  MAX_RESEARCH_MODEL_TIMEOUT_SECONDS / 60,
);

function normalizeDomain(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[\\\s]/.test(value)) {
    return null;
  }
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
  } catch {
    return null;
  }
}

function DomainList({
  label,
  description,
  values,
  onChange,
}: {
  label: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const uiT = useUiT();

  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const addDraft = () => {
    if (!draft.trim()) {
      return;
    }
    const domain = normalizeDomain(draft);
    if (!domain) {
      setError(uiTranslate("ui.enter_a_domain_without_a_port_such_as_arxiv_org"));
      return;
    }
    if (values.length >= 100 && !values.includes(domain)) {
      setError(uiTranslate("ui.you_can_add_up_to_100_domains_to_each_list"));
      return;
    }
    if (!values.includes(domain)) {
      onChange([...values, domain]);
    }
    setDraft("");
    setError("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addDraft();
    } else if (event.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-2xl border border-input bg-input/20 p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          error && "border-destructive/70",
        )}
      >
        {values.map((domain) => (
          <span
            key={domain}
            className="flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium"
          >
            {domain}
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={uiT("ui.remove_value0", { value0: String(domain) })}
              onClick={() =>
                onChange(values.filter((value) => value !== domain))
              }
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onBlur={addDraft}
          onKeyDown={handleKeyDown}
          placeholder={values.length > 0 ? uiT("ui.add_another_domain") : "example.com"}
          aria-invalid={Boolean(error)}
          className="h-7 min-w-36 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function DeepResearchComposerButton({
  onConfigure,
}: {
  onConfigure: () => void;
}) {
  const uiT = useUiT();

  const enabled = useChatRuntimeStore((state) => state.deepResearchEnabled);
  const setEnabled = useChatRuntimeStore(
    (state) => state.setDeepResearchEnabled,
  );

  if (!enabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onConfigure}
      className="composer-pill-btn"
      data-pill-label="Deep research"
      data-active="true"
      aria-label={uiT("ui.configure_deep_research_website_access")}
      title={uiT("ui.configure_website_access")}
    >
      <span
        role="button"
        aria-label={uiT("ui.disable_deep_research")}
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setEnabled(false);
        }}
        className="composer-pill-glyph cursor-pointer"
      >
        <HugeiconsIcon icon={Telescope02Icon} className="size-[15px]" />
        <XIcon className="composer-pill-x" />
      </span>
      <span>{uiT("chat.composer.deepResearch")}</span>
      {/* Same caret as the other composer pills, so the arrows match. */}
      <HugeiconsIcon
        icon={ChevronDownStandardIcon}
        strokeWidth={1.5}
        className="composer-pill-caret size-[15px] text-primary/70"
      />
    </button>
  );
}

export function DeepResearchWebsiteAccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const policy = useChatRuntimeStore((state) => state.researchWebsitePolicy);
  const setPolicy = useChatRuntimeStore(
    (state) => state.setResearchWebsitePolicy,
  );
  const modelTimeoutSeconds = useChatRuntimeStore(
    (state) => state.researchModelTimeoutSeconds,
  );
  const setModelTimeoutSeconds = useChatRuntimeStore(
    (state) => state.setResearchModelTimeoutSeconds,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DeepResearchWebsiteAccessContent
          policy={policy}
          setPolicy={setPolicy}
          modelTimeoutSeconds={modelTimeoutSeconds}
          setModelTimeoutSeconds={setModelTimeoutSeconds}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function DeepResearchWebsiteAccessContent({
  policy,
  setPolicy,
  modelTimeoutSeconds,
  setModelTimeoutSeconds,
  onClose,
}: {
  policy: ResearchWebsitePolicy;
  setPolicy: (policy: ResearchWebsitePolicy) => void;
  modelTimeoutSeconds: number;
  setModelTimeoutSeconds: (seconds: number) => void;
  onClose: () => void;
}) {
  const uiT = useUiT();

  const [draft, setDraft] = useState<ResearchWebsitePolicy>(policy);
  const [unlimited, setUnlimited] = useState(modelTimeoutSeconds === 0);
  // Unlimited has no minutes of its own, so turning the limit back on offers the default.
  const [timeoutMinutes, setTimeoutMinutes] = useState(
    String(
      Math.ceil(
        (modelTimeoutSeconds || DEFAULT_RESEARCH_MODEL_TIMEOUT_SECONDS) / 60,
      ),
    ),
  );
  // The API accepts second-level values the minutes field cannot spell, so saving an
  // untouched control must replay the stored seconds rather than the rounded minutes.
  const [timeoutEdited, setTimeoutEdited] = useState(false);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{uiT("chat.composer.deepResearch")}</DialogTitle>
        <DialogDescription>
          {uiT("ui.control_website_access_and_model_request_time_for_the_next_deep_r")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-6">
        <div className="space-y-2">
          <div>
            {/* A run makes many model requests, so this bounds each one, not the run. */}
            <div className="text-sm font-medium">{uiT("ui.time_per_model_request")}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {unlimited
                ? uiT("ui.no_limit_on_a_single_model_request_slow_models_can_continue_while")
                : uiT("ui.maximum_time_for_each_model_request_so_a_run_of_many_requests_can")}
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              max={MAX_RESEARCH_MODEL_TIMEOUT_MINUTES}
              step="1"
              value={timeoutMinutes}
              disabled={unlimited}
              onChange={(event) => {
                setTimeoutEdited(true);
                setTimeoutMinutes(event.target.value);
              }}
              aria-label={uiT("ui.deep_research_time_per_model_request_in_minutes")}
              className="w-28"
            />
            <span className="self-center text-sm text-muted-foreground">
              {uiT("ui.minutes")}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTimeoutEdited(true);
                setUnlimited((value) => !value);
              }}
            >
              {unlimited ? uiT("ui.use_a_limit") : uiT("ui.no_limit")}
            </Button>
          </div>
        </div>
        <DomainList
          label={uiT("ui.allow_only")}
          description={uiT("ui.when_set_research_can_access_only_these_domains_and_their_subdoma")}
          values={draft.allowedDomains}
          onChange={(allowedDomains) => setDraft({ ...draft, allowedDomains })}
        />
        <DomainList
          label={uiT("ui.always_block")}
          description={uiT("ui.these_domains_and_their_subdomains_stay_blocked_blocking_takes_pr")}
          values={draft.blockedDomains}
          onChange={(blockedDomains) => setDraft({ ...draft, blockedDomains })}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {uiT("chat.workspace.cancel")}</Button>
        <Button
          onClick={() => {
            setPolicy(draft);
            const minutes = Number(timeoutMinutes);
            // The max attribute does not stop a typed value reaching here, and falling
            // through to the default would hand someone asking for a long run a short one.
            setModelTimeoutSeconds(
              unlimited
                ? 0
                : timeoutEdited
                  ? Number.isSafeInteger(minutes) && minutes >= 1
                    ? Math.min(minutes, MAX_RESEARCH_MODEL_TIMEOUT_MINUTES) * 60
                    : DEFAULT_RESEARCH_MODEL_TIMEOUT_SECONDS
                  : modelTimeoutSeconds,
            );
            onClose();
          }}
        >
          {uiT("ui.save_limits")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
