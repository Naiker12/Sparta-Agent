import {
  AudioWave01Icon,
  Csv02Icon,
  Doc02Icon,
  File02Icon,
  FileCodeIcon,
  FileUnknownIcon,
  FileVideoIcon,
  FileZipIcon,
  Image02Icon,
  Pdf02Icon,
  Ppt02Icon,
  Xls02Icon,
} from "@hugeicons/core-free-icons";

export type AttachmentFileKind =
  | "pdf"
  | "word"
  | "excel"
  | "csv"
  | "powerpoint"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "archive"
  | "text"
  | "unknown";

const EXTENSION_MAP: Record<string, AttachmentFileKind> = {
  // PDF
  pdf: "pdf",

  // Word / Documentos
  doc: "word",
  docx: "word",
  odt: "word",
  rtf: "word",

  // Excel / Hojas de cálculo
  xls: "excel",
  xlsx: "excel",
  ods: "excel",
  xlsm: "excel",
  xlsb: "excel",

  // CSV / Datos tabulares
  csv: "csv",
  tsv: "csv",

  // PowerPoint / Presentaciones
  ppt: "powerpoint",
  pptx: "powerpoint",
  odp: "powerpoint",

  // Imágenes
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  tiff: "image",
  tif: "image",
  avif: "image",

  // Video
  mp4: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  wmv: "video",
  flv: "video",
  m4v: "video",

  // Audio
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  oga: "audio",
  flac: "audio",
  aac: "audio",
  wma: "audio",
  opus: "audio",

  // Código / Configuración estructurada
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  rs: "code",
  go: "code",
  java: "code",
  c: "code",
  cpp: "code",
  cc: "code",
  cxx: "code",
  h: "code",
  hpp: "code",
  cs: "code",
  php: "code",
  rb: "code",
  sh: "code",
  bash: "code",
  zsh: "code",
  bat: "code",
  ps1: "code",
  sql: "code",
  html: "code",
  htm: "code",
  css: "code",
  scss: "code",
  sass: "code",
  less: "code",
  json: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  xml: "code",
  vue: "code",
  svelte: "code",
  graphql: "code",
  gql: "code",

  // Archivos comprimidos
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",
  tgz: "archive",

  // Texto plano
  txt: "text",
  md: "text",
  markdown: "text",
  log: "text",
  ini: "text",
  env: "text",
};

/**
 * Determina el tipo de archivo (AttachmentFileKind) a partir del nombre y/o tipo MIME.
 * Da prioridad a la extensión en el nombre por confiabilidad, con fallback a contentType.
 */
export function getAttachmentFileKind(
  name?: string | null,
  contentType?: string | null,
): AttachmentFileKind {
  if (name) {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex !== -1 && dotIndex < name.length - 1) {
      const ext = name.slice(dotIndex + 1).toLowerCase();
      const kind = EXTENSION_MAP[ext];
      if (kind) return kind;
    }
  }

  if (contentType) {
    const mime = contentType.toLowerCase().trim();

    if (mime.includes("pdf")) return "pdf";
    if (
      mime.includes("word") ||
      mime.includes("officedocument.wordprocessingml") ||
      mime.includes("opendocument.text")
    ) {
      return "word";
    }
    if (
      mime.includes("excel") ||
      mime.includes("officedocument.spreadsheetml") ||
      mime.includes("opendocument.spreadsheet")
    ) {
      return "excel";
    }
    if (mime === "text/csv" || mime === "text/tab-separated-values") {
      return "csv";
    }
    if (
      mime.includes("powerpoint") ||
      mime.includes("officedocument.presentationml") ||
      mime.includes("opendocument.presentation")
    ) {
      return "powerpoint";
    }
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (
      mime.includes("zip") ||
      mime.includes("compressed") ||
      mime.includes("tar") ||
      mime.includes("7z")
    ) {
      return "archive";
    }
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("xml") ||
      mime.includes("yaml")
    ) {
      return "text";
    }
  }

  return "unknown";
}

export const KIND_ICON_MAP = {
  pdf: Pdf02Icon,
  word: Doc02Icon,
  excel: Xls02Icon,
  csv: Csv02Icon,
  powerpoint: Ppt02Icon,
  image: Image02Icon,
  video: FileVideoIcon,
  audio: AudioWave01Icon,
  code: FileCodeIcon,
  archive: FileZipIcon,
  text: File02Icon,
  unknown: FileUnknownIcon,
} as const;

export function getAttachmentIcon(
  kindOrName?: AttachmentFileKind | string | null,
  contentType?: string | null,
) {
  if (!kindOrName) return File02Icon;

  // Si ya es uno de los AttachmentFileKind conocidos:
  if (kindOrName in KIND_ICON_MAP) {
    return KIND_ICON_MAP[kindOrName as AttachmentFileKind];
  }

  // De lo contrario se asume que es el nombre del archivo
  const kind = getAttachmentFileKind(kindOrName, contentType);
  return KIND_ICON_MAP[kind];
}
