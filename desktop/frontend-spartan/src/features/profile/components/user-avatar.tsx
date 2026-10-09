import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  isProfilePhoto,
  mascotCharacter,
  normalizeAvatarValue,
} from "../mascot-catalog";
import { MascotAvatar } from "./mascot-avatar";
import {
  type AvatarShape,
  useUserProfileStore,
} from "../stores/user-profile-store";

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
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const storedShape = useUserProfileStore((s) => s.avatarShape);
  const shapeClass = SHAPE[shape ?? storedShape];
  const value = normalizeAvatarValue(imageUrl);

  if (isProfilePhoto(value)) {
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
          src={
            failedImage === value ? `${import.meta.env.BASE_URL}spartan-logo.svg` : value
          }
          alt=""
          className="size-full object-cover"
          onError={() => setFailedImage(value)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-block shrink-0", shapeClass, SIZE[size], className)}
      title={name}
    >
      <MascotAvatar character={mascotCharacter(value)} />
    </span>
  );
}
