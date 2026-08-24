
// The store stubs, plus a chat-settings endpoint a test can drive. Register
// this to exercise the real chat-runtime store against hydration.
import { resolve as resolveBundler } from "./bundler-resolver.mjs";

const STUBS = new Map([
  ["@/features/auth", "./helpers/store-stubs/settings-http.ts"],
  ["@/features/hub", "./helpers/store-stubs/hub.ts"],
  ["@/features/model-picker", "./helpers/store-stubs/model-picker.ts"],
  ["@/config/env", "./helpers/store-stubs/env.ts"],
  ["@/lib/toast", "./helpers/store-stubs/toast.ts"],
]);

export function resolve(specifier, context, next) {
  const stub = STUBS.get(specifier);
  if (stub) {
    return next(new URL(stub, import.meta.url).href, context);
  }
  return resolveBundler(specifier, context, next);
}
