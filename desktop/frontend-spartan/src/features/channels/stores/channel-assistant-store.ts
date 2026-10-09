import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useChannelAssistantStore = create<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}>()(
  persist(
    (set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }),
    { name: "sparta-channel-assistant" },
  ),
);
