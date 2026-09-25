import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AvatarShape = "circle" | "rounded";
export const PROFILE_TEXT_MAX_LENGTH = 200;

export interface UserProfileState {
  displayName: string;
  nickname: string;
  avatarDataUrl: string | null;
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
      avatarShape: "circle",
      showGreetingSloth: true,
      setDisplayName: (displayName) => set({ displayName }),
      setNickname: (nickname) => set({ nickname }),
      setAvatarDataUrl: (avatarDataUrl) => set({ avatarDataUrl }),
      setAvatarShape: (avatarShape) => set({ avatarShape }),
      setShowGreetingSloth: (showGreetingSloth) => set({ showGreetingSloth }),
    }),
    {
      // Do not import the legacy Unsloth profile: old installations may have
      // the product name saved as the person's visible name.
      name: "sparta_user_profile",
    },
  ),
);
