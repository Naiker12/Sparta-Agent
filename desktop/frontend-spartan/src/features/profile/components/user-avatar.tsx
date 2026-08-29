
import { useState } from "react";
import fallbackMascot from "@/assets/mascot-fallback.webp?inline";
import { GeneratedAvatar } from "@/components/ui/blobatar-avatar";
import { cn } from "@/lib/utils";
import {
  useUserProfileStore,
  type AvatarShape,
} from "../stores/user-profile-store";
import { blobatarSeedFromValue } from "../blobatar-avatars";

type UserAvatarProps = {
  name: string;
  imageUrl: string | null;
  size: "sm" | "md" | "lg";
  className?: string;
  /** Override the stored shape preference (defaults to the user's setting). */
  shape?: AvatarShape;
};

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  /** ~10% larger than `size-24` / `text-2xl` for the edit-profile dialog. */
  lg: "size-[106px] text-[calc(1.65rem*var(--ui-font-scale,1))]",
};

// Percentage radius keeps the rounded-rectangle proportional across sizes.
const SHAPE: Record<AvatarShape, string> = {
  circle: "rounded-full",
  rounded: "rounded-[22%]",
};

export function UserAvatar({
  name,
  imageUrl,
  size,
  className,
  shape,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const storedShape = useUserProfileStore((s) => s.avatarShape);
  const shapeClass = SHAPE[shape ?? storedShape];
  const selectedSeed = blobatarSeedFromValue(imageUrl);

  if (imageUrl && !selectedSeed) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden bg-transparent",
          shapeClass,
          SIZE[size],
          className,
        )}
      >
        <img
          src={imageFailed ? fallbackMascot : imageUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <GeneratedAvatar
      name={selectedSeed ?? (name.trim() || "sparta-user")}
      className={cn("inline-block shrink-0", shapeClass, SIZE[size], className)}
      fallback={<span className={cn("inline-block shrink-0 bg-muted", shapeClass, SIZE[size], className)} />}
    />
  );
}
