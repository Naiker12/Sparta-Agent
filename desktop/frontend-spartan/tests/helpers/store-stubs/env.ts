
/** Minimal settable platform store. */
let deviceType: string | null = null;

export const usePlatformStore = {
  getState: () => ({ deviceType }),
  setState: (next: { deviceType: string | null }) => {
    deviceType = next.deviceType;
  },
};
