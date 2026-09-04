/**
 * Sparta Agent – Shared Composer UI Helpers
 *
 * Componentes y constantes de utilidad para el compositor compartido:
 * - Constantes de adjuntos de imagen
 * - Icono inline ArrowDown (sin dependencia de paquete externo)
 * - Tipo PendingImage y miniatura PendingImageThumb
 * - PillGlyph para píldoras de herramientas con overlay de cierre
 * - Helpers de IME: isNativeComposing, IME_STUCK_TIMEOUT_MS
 * - fileToBase64DataURL para conversión de archivos de imagen
 *
 * Responsabilidad única (SRP): componentes visuales genéricos reutilizables
 * dentro del compositor compartido, sin lógica de negocio.
 */

import { XIcon } from "lucide-react";
import {
  type FC,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Constantes de adjuntos
// ---------------------------------------------------------------------------

/** Tipos MIME aceptados para imágenes en el compositor compartido. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** Tamaño máximo permitido para adjuntos de imagen (20 MB). */
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// IME helpers
// ---------------------------------------------------------------------------

/**
 * Detecta si un evento DOM proviene de una composición IME activa.
 * Usado para evitar envíos accidentales en idiomas con composición (CJK).
 */
export function isNativeComposing(event: Event): boolean {
  return "isComposing" in event && (event as InputEvent).isComposing === true;
}

/**
 * Tiempo máximo de espera (ms) antes de forzar el reseteo de un estado IME
 * atascado. Chrome en Windows-over-WSL a veces no dispara `compositionend`
 * tras el commit, por lo que el flag quedaría `true` para siempre.
 */
export const IME_STUCK_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// Icono inline (sin dependencia de icon-pack)
// ---------------------------------------------------------------------------

/**
 * Flecha hacia abajo SVG interna, sincronizada visualmente con el compositor
 * principal de chat. Se evita así añadir una dependencia de paquete de iconos.
 */
export const ArrowDownStandardIcon: FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={true}
  >
    <path d="M5.99977 9.00005L11.9998 15L17.9998 9" />
  </svg>
);

// ---------------------------------------------------------------------------
// fileToBase64DataURL
// ---------------------------------------------------------------------------

/**
 * Convierte un archivo de imagen a una data-URL base64.
 * Usado antes de enviar el contenido al handle de comparación.
 */
export function fileToBase64DataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// PendingImage type + thumbnail
// ---------------------------------------------------------------------------

/** Imagen adjunta pendiente de envío en el compositor compartido. */
export type PendingImage = { id: string; file: File };

/**
 * Miniatura de una imagen pendiente con botón de eliminación.
 * Gestiona el ciclo de vida de la object-URL del blob.
 */
export function PendingImageThumb({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}): ReactElement {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src)
    return <div className="size-14 animate-pulse rounded-[14px] bg-muted" />;
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-[14px] border border-foreground/20 bg-muted">
      <img src={src} alt={file.name} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
        aria-label="Remove attachment"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PillGlyph
// ---------------------------------------------------------------------------

/**
 * Wrapper de icono para píldoras de herramientas activas.
 * Superpone una "X" de cierre que aparece en hover mediante CSS.
 */
export function PillGlyph({ children }: { children: ReactNode }) {
  return (
    <span className="composer-pill-glyph">
      {children}
      <XIcon className="composer-pill-x" />
    </span>
  );
}
