
// Real logic, re-exported: only the barrel it normally comes from needs stubbing.
export { normalizeModelIdentity } from "../../../src/features/hub/lib/model-identity.ts";

/** Minimal HF-token store. */
let token = "";

export function getHfToken(): string {
  return token;
}

export function hubTokenHeader(): Record<string, string> {
  return {};
}

export function mirrorHfTokenInto(): void {
  // Token state is local to this stub.
}

export const useHfTokenStore = {
  getState: () => ({
    setToken: (next: string) => {
      token = next;
    },
  }),
};
