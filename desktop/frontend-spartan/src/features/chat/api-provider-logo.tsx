
import { cn } from "@/lib/utils";
import { DashboardSquare01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { isCustomProviderType } from "./external-providers";

/**
 * Registry logos at `public/provider-logos/{provider_type}.{ext}`; key matches
 * `PROVIDER_REGISTRY` (lowercase). Extension varies per asset (svg preferred).
 */
const PROVIDER_LOGO_EXT: Record<string, "svg" | "png" | "jpg"> = {
  openai: "svg",
  mistral: "svg",
  gemini: "svg",
  anthropic: "svg",
  deepseek: "svg",
  huggingface: "svg",
  kimi: "jpg",
  qwen: "png",
  openrouter: "svg",
  vllm: "svg",
  ollama: "svg",
  llama_cpp: "svg",
};

export function apiProviderLogoSrc(
  providerType: string | undefined | null,
): string | undefined {
  if (!providerType) return undefined;
  const logoProviderType = providerType === "openai_codex" ? "openai" : providerType;
  const ext = PROVIDER_LOGO_EXT[logoProviderType];
  if (!ext) return undefined;
  return `${import.meta.env.BASE_URL}provider-logos/${logoProviderType}.${ext}`;
}

interface ApiProviderLogoProps {
  providerType: string | undefined | null;
  className?: string;
  title?: string;
}

const DARK_INVERT_LOGOS = new Set(["openai", "openai_codex", "ollama", "openrouter"]);

/** Provider logo from `public/provider-logos/`; monochrome ones invert in dark mode. */
export function ApiProviderLogo({ providerType, className, title }: ApiProviderLogoProps) {
  const src = apiProviderLogoSrc(providerType);
  const [failed, setFailed] = useState(false);
  if ((!src && isCustomProviderType(providerType)) || failed) {
    return (
      <span
        title={title}
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground",
          className,
        )}
      >
        <HugeiconsIcon icon={DashboardSquare01Icon} className="size-3.5" />
      </span>
    );
  }

  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      title={title}
      aria-hidden
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 object-contain",
        providerType && DARK_INVERT_LOGOS.has(providerType) && "dark:invert",
        className,
      )}
    />
  );
}
