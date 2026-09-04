/**
 * Sparta Agent – GGUF Variant Expander Component
 *
 * Componente que gestiona y visualiza variantes de cuantización para repositorios GGUF:
 * - Listado y normalización de variantes locales y remotas de Hugging Face.
 * - Soporte para agrupación por arquitecturas H3 (keyframe, reference partitions).
 * - Cálculo de ajuste de memoria VRAM (OOM / TIGHT) y footprints de descarga.
 * - Acciones de actualización y eliminación de variantes individuales con confirmación.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon } from "@hugeicons/core-free-icons";
import {
  listGgufVariants,
  type CachedGgufRepo,
  type GgufVariantDetail,
} from "@/features/chat";
import { useChatRuntimeStore } from "@/features/chat";
import {
  invalidateGgufVariantsCache,
  listGgufVariants as listGgufVariantsCached,
  useGgufVariantsCacheVersions,
} from "@/features/hub";
import { ModelLoadSettingsAction } from "./model-load-settings-action";
import { ModelRowMenu } from "./model-row-menu";
import { formatBytes, SizeText } from "./model-badges-and-chips";
import {
  GgufDownloadFootprint,
  GgufDownloadFootprintExplanation,
} from "./pickers";
import {
  makeModelOptionKey,
  makeModelOptionChildrenId,
  useRovingModelList,
} from "./use-roving-model-list";
import {
  type SoleQuantEntry,
  type SoleQuantTarget,
  createSoleQuantReader,
  partitionSoleQuants,
  soleQuantFingerprint,
  soleQuantKey,
  takeDriftedRepos,
} from "./sole-quant-cache";
import type {
  ModelDownloadFootprintResolver,
  ModelSelectorChangeMeta,
} from "./types";
import { describeVariantListingError } from "./variant-listing-error";
import {
  ggufVariantPickerLabel,
  groupGgufVariantsForPicker,
  h3PickerHasOnlyPrunedBuilds,
  preferredGgufVariantByGroup,
} from "./variant-presentation";
import {
  visibleGgufVariants,
} from "./variant-visibility";
import {
  pinKey,
  usePinnedModelsStore,
} from "./pinned-models";
// ── GGUF Variant Expander ────────────────────────────────────

export function isValidGgufVariant(variant: unknown): variant is GgufVariantDetail {
  if (!variant || typeof variant !== "object") return false;
  const candidate = variant as Partial<GgufVariantDetail>;
  return (
    typeof candidate.filename === "string" &&
    candidate.filename.length > 0 &&
    typeof candidate.quant === "string" &&
    candidate.quant.length > 0 &&
    typeof candidate.size_bytes === "number" &&
    Number.isFinite(candidate.size_bytes) &&
    candidate.size_bytes >= 0 &&
    (candidate.downloaded === undefined ||
      typeof candidate.downloaded === "boolean") &&
    // Carried through so each row can look up its own dependency group's
    // footprint. Absent or null on an older backend, which groups the repo as
    // one, so it must never reject the row.
    (candidate.dependency_key === undefined ||
      candidate.dependency_key === null ||
      typeof candidate.dependency_key === "string")
  );
}

export function normalizeGgufVariantsResponse(
  res:
    | {
        variants?: unknown;
        default_variant?: unknown;
        has_vision?: unknown;
        context_length?: unknown;
        resolved_locally?: unknown;
      }
    | null
    | undefined,
): {
  variants: GgufVariantDetail[];
  defaultVariant: string | null;
  hasVision: boolean;
  contextLength: number | null;
  resolvedLocally: boolean;
} {
  const contextLength = res?.context_length;
  return {
    variants: (Array.isArray(res?.variants) ? res.variants : []).filter(
      isValidGgufVariant,
    ),
    defaultVariant:
      typeof res?.default_variant === "string" && res.default_variant.length > 0
        ? res.default_variant
        : null,
    hasVision: res?.has_vision === true,
    contextLength:
      typeof contextLength === "number" &&
      Number.isFinite(contextLength) &&
      contextLength >= 0
        ? contextLength
        : null,
    // The backend's own verdict, which resolves existence-first: a marker-less relative name
    // that exists on disk is a local model even though no path prefix says so. A server that
    // predates the field omits it, leaving the prefix test to answer alone as before.
    resolvedLocally: res?.resolved_locally === true,
  };
}

export function ggufVariantExpectedBytes(variant: GgufVariantDetail): number {
  const downloadBytes = variant.download_size_bytes;
  return typeof downloadBytes === "number" &&
    Number.isFinite(downloadBytes) &&
    downloadBytes > 0
    ? downloadBytes
    : variant.size_bytes;
}

/** The one quant a repo holds, plus the vision flag read with it. The
 *  collapsed row never mounts the expander, so this is its only source. */
export interface SoleDownloadedQuant {
  variant: GgufVariantDetail;
  hasVision: boolean;
}

/** The repo's one complete quant, or null when it holds none, holds several,
 *  or could not be read. Disk-only and client-cached: no remote listing. */
export async function readSoleQuant(
  target: SoleQuantTarget,
  hfToken?: string,
): Promise<SoleDownloadedQuant | null> {
  try {
    const res = await listGgufVariantsCached(target.repoId, hfToken, {
      preferLocalCache: true,
      localPath: target.localSource,
    });
    const normalized = normalizeGgufVariantsResponse(res);
    const local = normalized.variants;
    // One file on disk and nothing torn beside it. A partial quant keeps the
    // expander, where it can be resumed.
    if (local.length !== 1 || local[0].downloaded !== true) return null;
    return { variant: local[0], hasVision: normalized.hasVision };
  } catch {
    return null;
  }
}

export const EMPTY_SOLE_QUANT_ENTRIES: ReadonlyMap<
  string,
  SoleQuantEntry<SoleDownloadedQuant>
> = new Map();
// Reads run a few at a time, so a large cache doesn't fire one request per
// repo. A worker pool, not fixed batches: one slow repo holds up only itself.
export const SOLE_QUANT_WORKERS = 6;

/** On Device repos holding exactly one quant on disk, keyed by repo id. With
 *  "Show all quantizations" off there is nothing else to pick, so those repos
 *  collapse into one pinned-style row. Results are kept per repo, so one
 *  repo's download or delete leaves every other row as it was. */
export function useSoleDownloadedQuants(
  repos: readonly CachedGgufRepo[],
  { enabled, hfToken }: { enabled: boolean; hfToken?: string },
): {
  quants: ReadonlyMap<string, SoleDownloadedQuant>;
  pending: ReadonlySet<string>;
} {
  const repoIds = useMemo(() => repos.map((repo) => repo.repo_id), [repos]);
  // A download or delete invalidates one repo, so watch each repo's version.
  const variantsVersion = useGgufVariantsCacheVersions(repoIds);
  const targets = useMemo(() => {
    const versions = variantsVersion.split(",");
    return repos.map((repo, index) => {
      const localSource = repo.load_id || repo.cache_path || null;
      const fingerprint = soleQuantFingerprint(repo);
      return {
        repoId: repo.repo_id,
        localSource,
        fingerprint,
        key: soleQuantKey(versions[index], localSource, fingerprint),
      };
    });
  }, [repos, variantsVersion]);

  const [entries, setEntries] = useState<
    ReadonlyMap<string, SoleQuantEntry<SoleDownloadedQuant>>
  >(EMPTY_SOLE_QUANT_ENTRIES);
  const { quants, pending, stale } = useMemo(
    () => partitionSoleQuants(targets, entries, { enabled }),
    [targets, entries, enabled],
  );

  // A change outside this tab, another window or the CLI, moves the row's
  // bytes without touching this instance's variants cache. Drop that repo's
  // cached listing so the read, and every other reader, sees disk again.
  const fingerprintsRef = useRef(new Map<string, string>());
  useEffect(() => {
    for (const repoId of takeDriftedRepos(targets, fingerprintsRef.current)) {
      invalidateGgufVariantsCache(repoId);
    }
  }, [targets]);

  // Reads outlive a render, so they run outside it. The token is read at call
  // time, so a change to it does not strand the reader.
  const hfTokenRef = useRef(hfToken);
  hfTokenRef.current = hfToken;
  const mountedRef = useRef(true);
  useEffect(() => {
    // Set on setup, not just cleared on teardown: StrictMode replays effects,
    // and a ref left false would discard every later read.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const readerRef = useRef<ReturnType<
    typeof createSoleQuantReader<SoleDownloadedQuant>
  > | null>(null);
  if (readerRef.current === null) {
    readerRef.current = createSoleQuantReader<SoleDownloadedQuant>({
      workers: SOLE_QUANT_WORKERS,
      read: (target) => readSoleQuant(target, hfTokenRef.current),
      commit: (target, quant) => {
        if (!mountedRef.current) return;
        setEntries((prev) => {
          const next = new Map(prev);
          next.set(target.repoId, { key: target.key, quant });
          return next;
        });
      },
    });
  }

  useEffect(() => {
    if (stale.length > 0) readerRef.current?.start(stale);
  }, [stale]);

  return { quants, pending };
}

export function GgufVariantExpander({
  repoId,
  pipelineTag,
  loadId,
  cachePath,
  onSelect,
  resolveDownloadFootprint,
  gpuGb,
  systemRamGb,
  budgetKnown = false,
  hfToken,
  parentOptionKey,
  onNavigatePastStart,
  onNavigatePastEnd,
  onConfigure,
  sourceOverride,
  variantActions,
  onDevice = false,
  allowPin = false,
  onHasVision,
}: {
  repoId: string;
  pipelineTag?: string | null;
  /** Snapshot the cached listing pinned this repo to, if any. */
  loadId?: string | null;
  /** Cache directory this downloaded row represents, if any. */
  cachePath?: string | null;
  onSelect: (id: string, meta: ModelSelectorChangeMeta) => void;
  resolveDownloadFootprint?: ModelDownloadFootprintResolver;
  gpuGb?: number;
  systemRamGb?: number;
  budgetKnown?: boolean;
  /** HF token threaded into the variant fetch so private/gated repos resolve
   *  their GGUF variants (and update badges). */
  hfToken?: string;
  parentOptionKey?: string;
  onNavigatePastStart?: () => void;
  onNavigatePastEnd?: () => void;
  onConfigure?: (id: string, meta: ModelSelectorChangeMeta) => void;
  sourceOverride?: ModelSelectorChangeMeta["source"];
  /** Update/delete actions for cached variant rows. Omitted by browse-only
   *  expanders (Recommended, etc.) that don't manage on-disk variants. */
  variantActions?: {
    onUpdate?: (quant: string, expectedBytes: number) => Promise<void> | void;
    updateTitle?: string;
    renderUpdateDescription?: (quant: string) => ReactNode;
    getUpdateSuccessMessage?: (quant: string) => string;
    updateDisabled?: boolean;
    onDelete?: (quant: string) => Promise<void> | void;
    deleteTitle?: string;
    renderDeleteDescription?: (quant: string) => ReactNode;
    getDeleteSuccessMessage?: (quant: string) => string;
    deleteDisabled?: boolean;
  };
  /** On Device rows honor the Show all quantizations setting; Recommended and
   *  other browse lists always show every quant. */
  onDevice?: boolean;
  /** Only managed cached-Hub rows can surface quant pins in the Pinned
   *  section. Local-path expanders deliberately leave this false. */
  allowPin?: boolean;
  /** Report GGUF vision support up so the parent row can badge it. */
  onHasVision?: (hasVision: boolean) => void;
}) {
  const pinnedKeys = usePinnedModelsStore((s) => s.pinned);
  const togglePinnedQuant = usePinnedModelsStore((s) => s.togglePinned);
  const onUpdateVariant = variantActions?.onUpdate;
  const updateVariantTitle =
    variantActions?.updateTitle ?? "Update cached model?";
  const renderUpdateVariantDescription =
    variantActions?.renderUpdateDescription;
  const updateDisabled = variantActions?.updateDisabled ?? false;
  const onDeleteVariant = variantActions?.onDelete;
  const deleteVariantTitle =
    variantActions?.deleteTitle ?? "Delete cached model?";
  const renderDeleteVariantDescription =
    variantActions?.renderDeleteDescription;
  const getDeleteVariantSuccessMessage =
    variantActions?.getDeleteSuccessMessage;
  const deleteDisabled = variantActions?.deleteDisabled ?? false;
  const [variants, setVariants] = useState<GgufVariantDetail[] | null>(null);
  const [defaultVariant, setDefaultVariant] = useState<string | null>(null);
  const [hasVision, setHasVision] = useState(false);
  // Native max context (GGUF metadata); only set once a variant is downloaded.
  const [nativeContext, setNativeContext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Whether the LISTING resolved this identifier off disk. Not derivable from loadId/cachePath,
  // which a downloaded hub model also carries.
  const [resolvedLocally, setResolvedLocally] = useState(false);
  const localSource = loadId || cachePath || null;

  useEffect(() => {
    let canceled = false;
    // Collapsing the row drops the request: a stalled one otherwise holds a
    // per-host connection, and enough of them stall download and load too.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (canceled) return;
      setLoading(true);
      setError(null);
      // Belongs to the identifier being listed: carrying it over would apply the previous
      // row's locality to this one's footprint arithmetic.
      setResolvedLocally(false);
    });

    // The row's own directory, so disk contents count against that cache, not the active one. No
    // preferLocalCache: it answers from disk alone and drops the undownloaded.
    listGgufVariants(repoId, hfToken, {
      ...(localSource ? { localPath: localSource } : {}),
      signal: controller.signal,
    })
      .then((res) => {
        if (canceled) return;
        const normalized = normalizeGgufVariantsResponse(res);
        setVariants(normalized.variants);
        setDefaultVariant(normalized.defaultVariant);
        setHasVision(normalized.hasVision);
        onHasVision?.(normalized.hasVision);
        setNativeContext(normalized.contextLength);
        setResolvedLocally(normalized.resolvedLocally);
      })
      .catch((err) => {
        if (canceled) return;
        setError(describeVariantListingError(err));
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [repoId, localSource, refreshKey, hfToken]);

  // Covers Unix absolute (/), Windows drive (C:\, D:/), UNC (\\server), relative (./, ../), tilde (~/)
  const isLocalPath = /^(\/|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/]|\\\\)/.test(
    repoId,
  );
  // The prefix test cannot see a marker-less relative directory like "models/my-image-model",
  // which the backend loads off disk. Whether the checkpoint is on disk decides the footprint
  // arithmetic, so that question is asked of the listing, not of the spelling.
  const checkpointIsLocal = isLocalPath || resolvedLocally;

  const handleVariantClick = useCallback(
    // ``filename`` is required, not decorative: the diffusion pages load a quant with {kind: "gguf", filename} and gate that branch on meta.ggufFilename, so a quant label alone made every Images/Video GGUF pick a dead click.
    (
      quant: string,
      filename: string,
      downloaded?: boolean,
      sizeBytes?: number,
    ) => {
      const isAvailable = isLocalPath || downloaded === true;
      onSelect(repoId, {
        source: sourceOverride ?? (isLocalPath ? "local" : "hub"),
        isLora: false,
        // Only for a quant already in the pinned snapshot: a new download lands elsewhere.
        loadId: downloaded === true ? loadId : undefined,
        ggufVariant: quant,
        ggufFilename: filename,
        isDownloaded: isLocalPath ? true : downloaded,
        expectedBytes: sizeBytes,
        contextLength: isAvailable ? nativeContext : undefined,
        isGguf: true,
        pipelineTag,
      });
    },
    [
      repoId,
      loadId,
      isLocalPath,
      onSelect,
      sourceOverride,
      nativeContext,
      pipelineTag,
    ],
  );

  // GGUF fit classification matching llama-server's _select_gpus logic:
  //   fits  = model <= 0.7 * total GPU memory
  //   tight = model > 0.7 * GPU but <= 0.7 * GPU + 0.7 * system RAM (--fit uses CPU offload)
  //   oom   = model > 0.7 * GPU + 0.7 * system RAM
  const gpuBudgetGb = (gpuGb ?? 0) * 0.7;
  const totalBudgetGb = gpuBudgetGb + (systemRamGb ?? 0) * 0.7;

  const getGgufFit = useCallback(
    (sizeBytes: number): "fits" | "tight" | "oom" => {
      // Preserve permissive behavior only when no budget was measured. A known
      // zero Vulkan budget means every non-empty variant is OOM.
      if (totalBudgetGb <= 0) return budgetKnown ? "oom" : "fits";
      const gb = sizeBytes / 1024 ** 3;
      if (gb <= 0 || gb <= gpuBudgetGb) return "fits";
      // No-GPU / unified-memory hosts (Mac) have only the RAM budget, so the tier
      // collapses to fit-or-oom against system RAM.
      if (gpuBudgetGb <= 0) return gb <= totalBudgetGb ? "fits" : "oom";
      if (gb <= totalBudgetGb) return "tight";
      return "oom";
    },
    [budgetKnown, gpuBudgetGb, totalBudgetGb],
  );

  const variantGroups = useMemo(
    () => groupGgufVariantsForPicker(variants ?? []),
    [variants],
  );
  const preferredByGroup = useMemo(
    () => preferredGgufVariantByGroup(variantGroups, defaultVariant),
    [variantGroups, defaultVariant],
  );

  // Each workflow gets its own recommendation. If its preferred variant is
  // OOM, use the largest one that can run; if all are OOM, use the smallest.
  const effectiveRecommendedByGroup = useMemo(() => {
    const recommended = new Map<string, string>();
    for (const group of variantGroups) {
      const preferred = preferredByGroup.get(group.key) ?? null;
      if (totalBudgetGb <= 0 && !budgetKnown) {
        if (preferred) recommended.set(group.key, preferred.quant);
        continue;
      }
      if (preferred && getGgufFit(preferred.size_bytes) !== "oom") {
        recommended.set(group.key, preferred.quant);
        continue;
      }
      const fitting = group.variants
        .filter((variant) => getGgufFit(variant.size_bytes) !== "oom")
        .sort((left, right) => right.size_bytes - left.size_bytes);
      if (fitting[0]) {
        recommended.set(group.key, fitting[0].quant);
        continue;
      }
      const smallest = [...group.variants].sort(
        (left, right) => left.size_bytes - right.size_bytes,
      )[0];
      if (smallest) recommended.set(group.key, smallest.quant);
    }
    return recommended;
  }, [variantGroups, preferredByGroup, totalBudgetGb, budgetKnown, getGgufFit]);
  // The same recommendations, reachable from a row. `effectiveRecommendedByGroup`
  // is keyed by PRESENTATION group ("quantizations", "text-frames",
  // "reference-media"); the footprint pass below buckets by the backend's
  // dependency_key ("flux.2-klein:<digest>"). Those are different key spaces,
  // so that pass has to ask through the variant itself, which is the object
  // the presentation grouping already placed.
  const recommendedQuantForVariant = useMemo(() => {
    const byVariant = new Map<GgufVariantDetail, string>();
    for (const group of variantGroups) {
      const recommended = effectiveRecommendedByGroup.get(group.key);
      if (recommended === undefined) continue;
      for (const variant of group.variants) byVariant.set(variant, recommended);
    }
    return byVariant;
  }, [variantGroups, effectiveRecommendedByGroup]);

  const sortedVariants = useMemo(() => {
    if (!variants) return variants;
    // Tier: 0 = downloaded+fits, 1 = downloaded+tight, 2 = fits, 3 = tight, 4 = OOM
    const tierOf = (v: GgufVariantDetail) => {
      const f = getGgufFit(v.size_bytes);
      if (f === "oom") return 4;
      const base = f === "fits" ? 0 : 1;
      return v.downloaded ? base : base + 2;
    };
    return variantGroups.flatMap((group) => {
      const recommended = effectiveRecommendedByGroup.get(group.key);
      return [...group.variants].sort((a, b) => {
        const aTier = tierOf(a);
        const bTier = tierOf(b);
        if (aTier !== bTier) return aTier - bTier;

        // Within the same tier, the workflow's recommendation goes first.
        const aIsRec = a.quant === recommended;
        const bIsRec = b.quant === recommended;
        if (aIsRec !== bIsRec) return aIsRec ? -1 : 1;

        // fits: largest first (best quality that fits in GPU)
        // tight/OOM: smallest first (closest to fitting, fastest to run)
        const fitsInGpu = aTier === 0 || aTier === 2;
        return fitsInGpu
          ? b.size_bytes - a.size_bytes
          : a.size_bytes - b.size_bytes;
      });
    });
  }, [variants, variantGroups, effectiveRecommendedByGroup, getGgufFit]);

  // On Device only: when Show all quantizations is off, list quants already on
  // disk, torn ones included. Browse lists always show every quant.
  const showAllQuantizations = useChatRuntimeStore(
    (s) => s.showAllQuantizations,
  );
  const displayVariants = useMemo(() => {
    if (!sortedVariants) return sortedVariants;
    return visibleGgufVariants(sortedVariants, {
      onDevice,
      showAll: showAllQuantizations,
    });
  }, [sortedVariants, showAllQuantizations, onDevice]);
  const displayVariantGroups = useMemo(
    () => groupGgufVariantsForPicker(displayVariants ?? []),
    [displayVariants],
  );
  const hideH3PrunedBuild = useMemo(
    () => h3PickerHasOnlyPrunedBuilds(displayVariants ?? []),
    [displayVariants],
  );

  // A diffusion GGUF is not self-contained: the loader also needs a text
  // encoder, VAE, tokenizer and configs. That companion set is NOT
  // repository-wide, so one representative's footprint cannot speak for the
  // whole listing: a neutral repo can hold GGUFs of different families with
  // different base repos, and FLUX.2-klein picks a different text encoder for
  // its 9B checkpoints than for its 4B ones. Both are folded into the
  // backend's dependency_key, so grouping by it is what keeps a non
  // representative row from advertising a GB-wrong total. One request per
  // distinct key: the ordinary repo has exactly one, which is the cost this
  // representative scheme exists to protect.
  const footprintVariants = useMemo(() => {
    const byKey = new Map<string, GgufVariantDetail>();
    for (const variant of displayVariants ?? []) {
      // An unkeyed repo (older backend, or no family resolved) collapses to one
      // group, which is exactly the previous repo-wide behavior.
      const key = variant.dependency_key ?? "";
      const current = byKey.get(key);
      if (current === undefined) {
        byKey.set(key, variant);
        continue;
      }
      // The recommended quant is the representative of its own group when it
      // has one; otherwise the group's first row stands. Asked per variant, not
      // of a flattened set: two families in one neutral repo can share quant
      // names, so global membership would let the other group's pick stand in
      // here and resolve companions against the wrong base repo.
      const recommended = recommendedQuantForVariant.get(variant);
      if (
        recommended !== undefined &&
        current.quant !== recommended &&
        variant.quant === recommended
      ) {
        byKey.set(key, variant);
      }
    }
    return Array.from(byKey.values());
  }, [displayVariants, recommendedQuantForVariant]);
  const [companionBytesByKey, setCompanionBytesByKey] = useState<
    Map<string, number>
  >(() => new Map());
  useEffect(() => {
    let cancelled = false;
    setCompanionBytesByKey(new Map());
    // A local path is resolved too: only the CHECKPOINT is on disk. Its text encoder, VAE,
    // tokenizer and configs still come from the remote base, which is the larger half of the
    // footprint, so suppressing the request understated a local row by many gigabytes.
    if (!resolveDownloadFootprint) {
      return () => {
        cancelled = true;
      };
    }
    for (const footprintVariant of footprintVariants) {
      const dependencyKey = footprintVariant.dependency_key ?? "";
      const expectedBytes = ggufVariantExpectedBytes(footprintVariant);
      void resolveDownloadFootprint(repoId, {
        // Same source the row itself reports, so the plan describes the pick that would run.
        source: sourceOverride ?? (isLocalPath ? "local" : "hub"),
        isLora: false,
        ggufVariant: footprintVariant.quant,
        ggufFilename: footprintVariant.filename,
        isDownloaded: footprintVariant.downloaded,
        expectedBytes,
        isGguf: true,
      })
        .then((footprint) => {
          if (cancelled || !footprint) return;
          // A checkpoint already on disk is not part of required_bytes at all, so nothing may
          // be subtracted for it: the whole figure IS the remote companion set. Subtracting
          // anyway drove the total to zero and hid a multi-GB companion set behind the
          // checkpoint size. Only a hub pick carries its checkpoint inside the total, and
          // expectedBytes stands in when the planner could not size it.
          const checkpoint = checkpointIsLocal
            ? 0
            : footprint.checkpointBytes > 0
              ? footprint.checkpointBytes
              : expectedBytes;
          const companion = footprint.requiredBytes - checkpoint;
          if (Number.isFinite(companion) && companion > 0) {
            // A fresh Map per resolution: React compares state by identity, and
            // the groups resolve independently, so a mutation would drop the
            // rows whose request landed first.
            setCompanionBytesByKey((previous) => {
              const next = new Map(previous);
              next.set(dependencyKey, companion);
              return next;
            });
          }
        })
        .catch(() => {
          // The checkpoint size remains useful when an older backend or a Hub
          // metadata failure cannot provide the companion footprint.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    checkpointIsLocal,
    footprintVariants,
    isLocalPath,
    repoId,
    resolveDownloadFootprint,
    sourceOverride,
  ]);

  const variantOptionKeys = useMemo(
    () =>
      (displayVariants ?? []).map((variant) =>
        makeModelOptionKey("gguf-variant", `${repoId}:${variant.filename}`),
      ),
    [repoId, displayVariants],
  );
  const variantList = useRovingModelList({
    label: `${repoId} quantizations`,
    optionKeys: variantOptionKeys,
    onNavigatePastStart,
    onNavigatePastEnd,
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-2">
        <Spinner className="size-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading variants…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-5 py-2 text-xs text-destructive">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="rounded-full border border-destructive/40 px-2 py-0.5 font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!displayVariants || displayVariants.length === 0) {
    return (
      <div className="px-5 py-2 text-xs text-muted-foreground">
        No GGUF variants found.
      </div>
    );
  }

  return (
    <div
      {...variantList.listboxProps}
      id={
        parentOptionKey
          ? makeModelOptionChildrenId(parentOptionKey)
          : variantList.listboxProps.id
      }
      className="pl-4 border-l-2 border-accent/50 ml-3 my-1"
    >
      {/* On Device shows the model name above, so the Quantizations heading is
          redundant; its Vision badge is relayed to the name instead. */}
      {!onDevice && !displayVariantGroups.some((group) => group.title) && (
        <div className="px-2 py-1 flex items-center gap-1.5">
          <span className="text-ui-10 font-semibold uppercase tracking-wider text-muted-foreground">
            Quantizations
          </span>
          {hasVision && (
            <span className="flex items-center gap-0.5 text-ui-9 font-medium text-indigo-700 dark:text-indigo-300">
              <HugeiconsIcon
                icon={ViewIcon}
                className="size-3"
                strokeWidth={1.8}
              />
              Vision
            </span>
          )}
        </div>
      )}
      {!onDevice &&
        hasVision &&
        displayVariantGroups.some((group) => group.title) && (
          <div className="px-2 pt-1">
            <span className="flex items-center gap-0.5 text-ui-9 font-medium text-indigo-700 dark:text-indigo-300">
              <HugeiconsIcon
                icon={ViewIcon}
                className="size-3"
                strokeWidth={1.8}
              />
              Vision
            </span>
          </div>
        )}
      {displayVariants.map((v) => {
        const group = displayVariantGroups.find((candidate) =>
          candidate.variants.some((variant) => variant.filename === v.filename),
        );
        const showGroupHeading =
          group?.title != null && group.variants[0]?.filename === v.filename;
        // Its own group's pick. Matching on the quant alone happens to work only
        // because an H3 key is unique per file, which is the backend's rule.
        const isRecommended =
          group != null &&
          effectiveRecommendedByGroup.get(group.key) === v.quant;
        const fit = getGgufFit(v.size_bytes);
        const oom = fit === "oom";
        const tight = fit === "tight";
        const expectedBytes = ggufVariantExpectedBytes(v);
        // This row's own dependency group, never the listing's: see the
        // footprintVariants comment above.
        const companionBytes =
          companionBytesByKey.get(v.dependency_key ?? "") ?? null;
        // A folder has no download to resume; a quant short a shard has no files to load.
        const unusableLocal = isLocalPath && v.partial === true;
        const keyBase = `${repoId}:${v.filename}`;
        const variantOptionKey = makeModelOptionKey("gguf-variant", keyBase);
        const rowButton = (
          <button
            type="button"
            {...variantList.getOptionProps(variantOptionKey, false)}
            disabled={unusableLocal}
            onClick={() =>
              handleVariantClick(
                v.quant,
                v.filename,
                v.downloaded,
                expectedBytes,
              )
            }
            className={cn(
              "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full py-1 pl-2 pr-1.5 text-left text-sm transition-colors hover:bg-[#ececec] focus-visible:bg-[#ececec] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-[var(--sidebar-accent)] dark:focus-visible:bg-[var(--sidebar-accent)]",
              unusableLocal &&
                "cursor-default opacity-50 hover:bg-transparent dark:hover:bg-transparent",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              <span className={cn(oom && "!text-gray-500 dark:!text-gray-400")}>
                {ggufVariantPickerLabel(v, {
                  h3Grouped: group?.title != null,
                  hideH3PrunedBuild,
                })}
              </span>
              {unusableLocal ? (
                <span className="ml-1.5 text-ui-9 font-sans font-medium text-amber-700 dark:text-amber-300">
                  incomplete
                </span>
              ) : v.downloaded ? (
                <>
                  <span className="ml-1.5 text-ui-9 font-sans font-medium text-green-600/90 dark:text-green-400/80">
                    downloaded
                  </span>
                  {v.update_available ? (
                    <span className="ml-1.5 text-ui-9 font-sans font-medium text-amber-700 dark:text-amber-300">
                      update available
                    </span>
                  ) : null}
                </>
              ) : isRecommended ? (
                <span className="ml-1.5 text-ui-9 font-sans font-medium text-primary/70">
                  recommended
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {oom && (
                <span className="text-ui-9 font-medium !text-red-700 !bg-red-50 dark:!text-red-300 dark:!bg-red-500/15 px-1.5 py-0.5 rounded">
                  OOM
                </span>
              )}
              {tight && (
                <span className="text-ui-9 font-medium !text-amber-400">
                  TIGHT
                </span>
              )}
              <span className="font-mono text-ui-10 text-muted-foreground tabular-nums">
                {companionBytes === null ? (
                  <SizeText value={formatBytes(v.size_bytes)} />
                ) : (
                  <GgufDownloadFootprint
                    checkpointBytes={v.size_bytes}
                    companionBytes={companionBytes}
                  />
                )}
              </span>
            </span>
          </button>
        );
        return [
          showGroupHeading && group?.title ? (
            <div key={`${v.filename}:group`} className="px-2 pb-1 pt-2">
              <div className="text-xs font-semibold text-foreground">
                {group.title}
              </div>
              {group.description && (
                <div className="mt-0.5 text-ui-10 leading-snug text-muted-foreground">
                  {group.description}
                </div>
              )}
            </div>
          ) : null,
          <div key={v.filename} className="flex items-center">
            {/* The explanation rides the row button; nested button triggers are not accessible. */}
            {companionBytes === null ? (
              rowButton
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild={true}>{rowButton}</TooltipTrigger>
                <TooltipContent side="top" className="tooltip-compact">
                  <GgufDownloadFootprintExplanation
                    checkpointBytes={v.size_bytes}
                    companionBytes={companionBytes}
                  />
                </TooltipContent>
              </Tooltip>
            )}
            {v.downloaded && onConfigure && (
              <ModelLoadSettingsAction
                ariaLabel={`Inference settings for ${repoId} ${v.quant}`}
                className="relative left-0.5"
                onConfigure={() =>
                  onConfigure(repoId, {
                    source: sourceOverride ?? (isLocalPath ? "local" : "hub"),
                    isLora: false,
                    loadId,
                    ggufVariant: v.quant,
                    isDownloaded: true,
                    expectedBytes,
                    contextLength: nativeContext,
                    isGguf: true,
                  })
                }
              />
            )}
            {v.downloaded &&
              (allowPin ||
                (v.update_available && onUpdateVariant) ||
                onDeleteVariant ||
                !isLocalPath) && (
                <ModelRowMenu
                  ariaLabel={`More options for ${repoId} ${v.quant}`}
                  iconClassName="size-3"
                  cachePath={
                    isLocalPath ? undefined : { repoId, variant: v.quant }
                  }
                  pin={
                    allowPin
                      ? {
                          pinned: pinnedKeys.includes(pinKey(repoId, v.quant)),
                          pinLabel: "Pin to top",
                          unpinLabel: "Unpin",
                          onToggle: () => togglePinnedQuant(repoId, v.quant),
                        }
                      : undefined
                  }
                  update={
                    v.update_available && onUpdateVariant
                      ? {
                          title: updateVariantTitle,
                          description: renderUpdateVariantDescription?.(
                            v.quant,
                          ) ?? (
                            <>
                              This will update{" "}
                              <span className="font-medium text-foreground">
                                {repoId} ({v.quant})
                              </span>
                              {"."}
                            </>
                          ),
                          repoId,
                          variant: v.quant,
                          disabled: updateDisabled,
                          onConfirm: () =>
                            onUpdateVariant(v.quant, expectedBytes),
                          onUpdated: () => setRefreshKey((key) => key + 1),
                        }
                      : undefined
                  }
                  del={
                    onDeleteVariant
                      ? {
                          title: deleteVariantTitle,
                          impact: { repoId, variant: v.quant },
                          description: renderDeleteVariantDescription?.(
                            v.quant,
                          ) ?? (
                            <>
                              This will remove{" "}
                              <span className="font-medium text-foreground">
                                {repoId} ({v.quant})
                              </span>{" "}
                              from disk. You can re-download it later.
                            </>
                          ),
                          successMessage:
                            getDeleteVariantSuccessMessage?.(v.quant) ??
                            `Deleted ${repoId} ${v.quant}`,
                          disabled: deleteDisabled,
                          onConfirm: async () => {
                            await onDeleteVariant(v.quant);
                            // Drop the pin too: a pinned row for a deleted file
                            // would try to load something that no longer exists.
                            if (pinnedKeys.includes(pinKey(repoId, v.quant))) {
                              togglePinnedQuant(repoId, v.quant);
                            }
                            // Re-fetch this expander's variants so the deleted
                            // quant stops showing as downloaded (and clickable to
                            // reload) while the repo still has other cached quants.
                            setRefreshKey((key) => key + 1);
                          },
                        }
                      : undefined
                  }
                />
              )}
          </div>,
        ];
      })}
    </div>
  );
}
