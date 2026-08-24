
// Stands in for src/features/auth/index.ts. The real barrel re-exports
// login-page.tsx, and node --experimental-strip-types cannot parse JSX, so a
// settings API unit test would pull in the whole React tree. Same cut as
// export-api-stub.mjs. Forwards to globalThis.fetch, which the test replaces.

export async function authFetch(input, init) {
  return globalThis.fetch(input, init);
}
