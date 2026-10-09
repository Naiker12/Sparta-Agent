import { isProfilePhoto, mascotCharacter } from "../mascot-catalog";
import { useUserProfileStore } from "../stores/user-profile-store";
import { MascotAvatar } from "./mascot-avatar";
import { UserAvatar } from "./user-avatar";

/** One subscribed value drives the greeting and the generation indicator. */
export function ProfileChatAvatar({
  interactive = false,
  size = 152,
  className,
}: {
  interactive?: boolean;
  size?: number;
  className?: string;
}) {
  const avatar = useUserProfileStore((state) => state.avatarDataUrl);
  const name = useUserProfileStore((state) => state.displayName);
  return (
    <span
      className={className}
      style={{ display: "block", width: size, height: size }}
    >
      {isProfilePhoto(avatar) ? (
        <UserAvatar
          name={name}
          imageUrl={avatar}
          size="lg"
          className="size-full"
        />
      ) : (
        <MascotAvatar
          character={mascotCharacter(avatar)}
          interactive={interactive}
          size={size}
        />
      )}
    </span>
  );
}
