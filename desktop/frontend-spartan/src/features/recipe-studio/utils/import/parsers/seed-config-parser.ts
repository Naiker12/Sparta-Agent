import type {
  SeedConfig,
  SeedSamplingStrategy,
  SeedSelectionType,
  SeedSourceType,
} from "../../../types";
import { isRecord, readNumberString, readString } from "../helpers";

function normalizeSampling(value: unknown): SeedSamplingStrategy {
  const raw = readString(value);
  if (raw === "shuffle") {
    return "shuffle";
  }
  return "ordered";
}

function makeDefaultSeedConfig(id: string): SeedConfig {
  return {
    id,
    kind: "seed",
    name: "seed",
    drop: false,
    seed_drop_columns: [],
    seed_source_type: "hf",
    hf_repo_id: "",
    hf_subset: "",
    hf_split: "",
    hf_path: "",
    hf_token: "",
    hf_endpoint: "https://huggingface.co",
    local_file_name: "",
    unstructured_file_ids: [],
    unstructured_file_names: [],
    unstructured_file_sizes: [],
    seed_preview_rows: [],
    unstructured_chunk_size: "1200",
    unstructured_chunk_overlap: "200",
    seed_splits: [],
    seed_globs_by_split: {},
    seed_columns: [],
    sampling_strategy: "ordered",
    selection_type: "none",
    selection_start: "0",
    selection_end: "10",
    selection_index: "0",
    selection_num_partitions: "1",
  };
}

function inferRepoIdFromSeedPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length >= 3 && parts[0] === "datasets") {
    return `${parts[1]}/${parts[2]}`;
  }
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return "";
}

function parseSeedSettings(seedConfigRaw: unknown): Partial<SeedConfig> {
  if (!isRecord(seedConfigRaw)) {
    return {};
  }

  const samplingStrategy = normalizeSampling(seedConfigRaw.sampling_strategy);

  let seedSourceType: SeedSourceType = "hf";
  let hfPath = "";
  let hfToken = "";
  let hfEndpoint = "https://huggingface.co";
  let hfRepoId = "";
  let localFileName = "";
  let unstructuredFileIds: string[] = [];
  let unstructuredFileNames: string[] = [];
  const unstructuredFileSizes: number[] = [];
  let resolvedPaths: string[] = [];
  let unstructuredChunkSize = "1200";
  let unstructuredChunkOverlap = "200";
  let githubRepoSlug = "";
  let githubToken = "";
  let githubLimit = "100";
  let githubItemTypes: ("issues" | "pulls" | "commits")[] = ["issues", "pulls"];
  let githubIncludeComments = true;
  let githubMaxCommentsPerItem = "30";
  const sourceRaw = seedConfigRaw.source;
  if (isRecord(sourceRaw)) {
    const seedType = readString(sourceRaw.seed_type);
    const sourcePath = readString(sourceRaw.path) ?? "";
    if (seedType === "hf") {
      seedSourceType = "hf";
      hfPath = sourcePath;
      hfToken = readString(sourceRaw.token) ?? "";
      hfEndpoint = readString(sourceRaw.endpoint) ?? hfEndpoint;
      hfRepoId = inferRepoIdFromSeedPath(hfPath);
    } else if (seedType === "local") {
      seedSourceType = "local";
      hfPath = sourcePath;
      localFileName = sourcePath.split("/").pop() ?? sourcePath;
    } else if (seedType === "unstructured") {
      seedSourceType = "unstructured";
      const paths = Array.isArray(sourceRaw.paths) ? sourceRaw.paths : [];
      const stringPaths = paths.filter(
        (p): p is string => typeof p === "string",
      );
      if (stringPaths.length === 0 && sourcePath) {
        stringPaths.push(sourcePath);
      }
      hfPath = stringPaths[0] ?? sourcePath;
      resolvedPaths = stringPaths;
      unstructuredFileIds = [];
      unstructuredFileNames = [];
      unstructuredChunkSize = readNumberString(sourceRaw.chunk_size) || "1200";
      unstructuredChunkOverlap =
        readNumberString(sourceRaw.chunk_overlap) || "200";
    } else if (seedType === "github_repo") {
      seedSourceType = "github_repo";
      const rawRepos = Array.isArray(sourceRaw.repos) ? sourceRaw.repos : [];
      const repos = rawRepos.filter((r): r is string => typeof r === "string");
      githubRepoSlug = repos.join("\n");
      githubToken = readString(sourceRaw.token) ?? "";
      githubLimit = readNumberString(sourceRaw.limit) || "100";
      const rawItems = Array.isArray(sourceRaw.item_types)
        ? sourceRaw.item_types
        : [];
      const validItems = rawItems.filter(
        (t): t is "issues" | "pulls" | "commits" =>
          t === "issues" || t === "pulls" || t === "commits",
      );
      if (validItems.length > 0) {
        githubItemTypes = validItems;
      }
      if (typeof sourceRaw.include_comments === "boolean") {
        githubIncludeComments = sourceRaw.include_comments;
      }
      githubMaxCommentsPerItem =
        readNumberString(sourceRaw.max_comments_per_item) || "30";
    }
  }

  let selectionType: SeedSelectionType = "none";
  let selectionStart = "0";
  let selectionEnd = "10";
  let selectionIndex = "0";
  let selectionNumPartitions = "1";
  const selectionRaw = seedConfigRaw.selection_strategy;
  if (isRecord(selectionRaw)) {
    if (
      typeof selectionRaw.start === "number" &&
      typeof selectionRaw.end === "number"
    ) {
      selectionType = "index_range";
      selectionStart = String(selectionRaw.start);
      selectionEnd = String(selectionRaw.end);
    } else if (
      typeof selectionRaw.index === "number" &&
      typeof selectionRaw.num_partitions === "number"
    ) {
      selectionType = "partition_block";
      selectionIndex = String(selectionRaw.index);
      selectionNumPartitions = String(selectionRaw.num_partitions);
    }
  }

  return {
    seed_source_type: seedSourceType,
    hf_repo_id: hfRepoId,
    hf_path: hfPath,
    hf_token: hfToken,
    hf_endpoint: hfEndpoint,
    local_file_name: localFileName,
    unstructured_file_ids: unstructuredFileIds,
    unstructured_file_names: unstructuredFileNames,
    unstructured_file_sizes: unstructuredFileSizes,
    resolved_paths: resolvedPaths,
    unstructured_chunk_size: unstructuredChunkSize,
    unstructured_chunk_overlap: unstructuredChunkOverlap,
    github_repo_slug: githubRepoSlug,
    github_token: githubToken,
    github_limit: githubLimit,
    github_item_types: githubItemTypes,
    github_include_comments: githubIncludeComments,
    github_max_comments_per_item: githubMaxCommentsPerItem,
    sampling_strategy: samplingStrategy,
    selection_type: selectionType,
    selection_start: selectionStart,
    selection_end: selectionEnd,
    selection_index: selectionIndex,
    selection_num_partitions: selectionNumPartitions,
  };
}

export function parseSeedConfig(
  seedConfigRaw: unknown,
  id: string,
  options?: {
    preferredSourceType?: SeedSourceType;
    drop?: boolean;
    seed_columns?: string[];
    seed_drop_columns?: string[];
    seed_preview_rows?: Record<string, unknown>[];
    local_file_name?: string;
    unstructuredUploadUid?: string;
    unstructuredFileIds?: string[];
    unstructuredFileNames?: string[];
    unstructuredFileSizes?: number[];
    unstructured_chunk_size?: string;
    unstructured_chunk_overlap?: string;
    preserveUnstructuredUploads?: boolean;
  },
): SeedConfig | null {
  if (!seedConfigRaw) {
    return null;
  }
  const parsed = { ...parseSeedSettings(seedConfigRaw) };
  if (
    parsed.seed_source_type === "unstructured" &&
    options?.preserveUnstructuredUploads !== true
  ) {
    parsed.hf_path = "";
    parsed.resolved_paths = [];
  }
  let sourceType: SeedSourceType = "hf";
  if (parsed.seed_source_type === "hf") {
    sourceType = "hf";
  } else if (options?.preferredSourceType) {
    sourceType = options.preferredSourceType;
  } else if (parsed.seed_source_type) {
    sourceType = parsed.seed_source_type;
  }
  return {
    ...makeDefaultSeedConfig(id),
    ...parsed, // payload-only fields override ui defaults
    seed_source_type: sourceType,
    ...(options?.drop !== undefined ? { drop: options.drop } : {}),
    ...(options?.seed_columns ? { seed_columns: options.seed_columns } : {}),
    ...(options?.seed_drop_columns
      ? { seed_drop_columns: options.seed_drop_columns }
      : {}),
    ...(options?.seed_preview_rows
      ? { seed_preview_rows: options.seed_preview_rows }
      : {}),
    ...(options?.local_file_name !== undefined
      ? { local_file_name: options.local_file_name }
      : {}),
    ...(options?.unstructuredUploadUid
      ? { unstructured_upload_uid: options.unstructuredUploadUid }
      : {}),
    ...(options?.unstructuredFileIds !== undefined
      ? { unstructured_file_ids: options.unstructuredFileIds }
      : {}),
    ...(options?.unstructuredFileNames !== undefined
      ? { unstructured_file_names: options.unstructuredFileNames }
      : {}),
    ...(options?.unstructuredFileSizes !== undefined
      ? { unstructured_file_sizes: options.unstructuredFileSizes }
      : {}),
    ...(options?.unstructured_chunk_size !== undefined
      ? { unstructured_chunk_size: options.unstructured_chunk_size }
      : {}),
    ...(options?.unstructured_chunk_overlap !== undefined
      ? { unstructured_chunk_overlap: options.unstructured_chunk_overlap }
      : {}),
  };
}
