/** Match folder groups without changing the path sent to native filesystem APIs. */
export function workspacePathKey(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  // Windows drive and UNC paths are case-insensitive; POSIX paths are not.
  return /^(?:[a-z]:\/|\/\/)/i.test(normalized)
    ? normalized.toLowerCase()
    : normalized;
}
