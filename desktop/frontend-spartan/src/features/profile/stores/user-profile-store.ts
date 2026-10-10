import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeAvatarValue } from "../mascot-catalog";

export type AvatarShape = "circle" | "rounded";
export const PROFILE_TEXT_MAX_LENGTH = 200;

export interface UserProfileState {
  displayName: string;
  nickname: string;
  avatarDataUrl: string | null;
  avatarSyncPending: boolean;
  avatarShape: AvatarShape;
  showGreetingSloth: boolean;
  setDisplayName: (displayName: string) => void;
  setNickname: (nickname: string) => void;
  setAvatarDataUrl: (avatarDataUrl: string | null) => void;
  setAvatarShape: (avatarShape: AvatarShape) => void;
  setShowGreetingSloth: (showGreetingSloth: boolean) => void;
}

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    (set) => ({
      displayName: "",
      nickname: "",
      avatarDataUrl: null,
      avatarSyncPending: false,
      avatarShape: "circle",
      showGreetingSloth: true,
      setDisplayName: (displayName) => set({ displayName }),
      setNickname: (nickname) => set({ nickname }),
      setAvatarDataUrl: (avatarDataUrl) =>
        set({
          avatarDataUrl: normalizeAvatarValue(avatarDataUrl),
          avatarSyncPending: true,
        }),
      setAvatarShape: (avatarShape) => set({ avatarShape }),
      setShowGreetingSloth: (showGreetingSloth) => set({ showGreetingSloth }),
    }),
    {
      // the product name saved as the person's visible name.
      name: "sparta_user_profile",
      merge: (persisted, current) => {
        const saved =
          persisted && typeof persisted === "object"
            ? (persisted as Partial<UserProfileState>)
            : {};
        return {
          ...current,
          ...saved,
          avatarDataUrl: normalizeAvatarValue(saved.avatarDataUrl ?? null),
          avatarSyncPending: saved.avatarSyncPending === true,
        };
      },
    },
  ),
);
