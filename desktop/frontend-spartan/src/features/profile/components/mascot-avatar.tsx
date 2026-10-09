import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { profileAssetUrl, type MascotCharacter } from "../mascot-catalog";
import { mascotSheet } from "../mascot-assets";

const InteractiveMascot = lazy(() =>
  import("page-mascot").then(({ Mascot }) => ({ default: Mascot })),
);

function LocalizedMascot({
  character,
  size,
  className,
}: {
  character: MascotCharacter;
  size: number;
  className?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const label = t("settings.profile.mascots.interact", {
    name: t(`settings.profile.mascots.names.${character}`),
  });
  useEffect(() => {
    // The upstream component prefixes its label in English. Localize the actual button.
    ref.current?.querySelector("button")?.setAttribute("aria-label", label);
  }, [label]);
  return (
    <span ref={ref}>
      <InteractiveMascot
        directions={mascotSheet(character, "directions")}
        reactions={mascotSheet(character, "reactions")}
        size={size}
        label={label}
        className={className}
      />
    </span>
  );
}

export function MascotAvatar({
  character,
  className,
  interactive = false,
  size = 152,
}: {
  character: MascotCharacter;
  className?: string;
  interactive?: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (!interactive) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, [interactive]);
  const directions = mascotSheet(character, "directions");
  const preview = (
    <span
      aria-hidden="true"
      data-mascot={character}
      className={cn(
        "relative block aspect-square size-full overflow-hidden",
        className,
      )}
    >
      <img
        src={
          failed === directions
            ? profileAssetUrl("spartan-logo.svg", import.meta.env.BASE_URL, window.location.href)
            : directions
        }
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(directions)}
        className={
          failed === directions
            ? "size-full object-contain"
            : "absolute top-[-100%] left-[-100%] max-w-none size-[300%]"
        }
      />
    </span>
  );
  if (!interactive || reducedMotion) return preview;
  return (
    <span
      data-mascot={character}
      className={cn("block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Suspense fallback={preview}>
        <LocalizedMascot
          key={character}
          character={character}
          size={size}
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        />
      </Suspense>
    </span>
  );
}
