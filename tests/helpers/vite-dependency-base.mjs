/** Follow the running server's optimizer cache instead of hardcoding its path. */
export async function viteDependencyBase(origin = "http://127.0.0.1:5173") {
  const response = await fetch(`${origin}/desktop/frontend-spartan/src/main.tsx`);
  if (!response.ok) throw new Error("Could not read Vite's transformed frontend entry");
  const source = await response.text();
  const match = source.match(/from ["']([^"']*\/\.vite\/[^"']*deps)\/[^"']+["']/);
  if (!match) throw new Error("Could not resolve the current Vite dependency cache");
  return match[1];
}
