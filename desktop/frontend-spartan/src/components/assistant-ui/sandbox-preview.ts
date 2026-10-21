/** Resolve only files inside the session root, never a host path or URL. */
export function resolvePreviewPath(reference: string, owner: string): string | null {
  const ref = reference.trim();
  if (!ref || ref.startsWith("#") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref)) return null;
  const path = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
  if (path.includes("\\") || [...path].some(char => char.charCodeAt(0) < 32)) throw new Error("Invalid preview resource path");
  const parts = path.startsWith("/") ? [] : owner.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error("Preview resource escapes the file directory");
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const MAX_PREVIEW_FILES = 100;

/** Bundle local static dependencies without executing or exposing an API token. */
export async function buildSandboxPreview(
  filename: string,
  load: (path: string) => Promise<Blob>,
): Promise<string> {
  let bytes = 0;
  const cache = new Map<string, Promise<Blob>>();
  const read = (path: string): Promise<Blob> => {
    let pending = cache.get(path);
    if (!pending) {
      if (cache.size >= MAX_PREVIEW_FILES) throw new Error("Too many preview resources");
      pending = load(path).then((blob) => {
        bytes += blob.size;
        if (bytes > MAX_PREVIEW_BYTES) throw new Error("Preview exceeds 25 MB");
        return blob;
      });
      cache.set(path, pending);
    }
    return pending;
  };
  const dataUrl = async (path: string): Promise<string> => {
    const blob = await read(path);
    // The download endpoint deliberately returns octet-stream for non-images.
    const extension = path.split(".").pop()?.toLowerCase();
    const mime = ({ svg: "image/svg+xml", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf" } as Record<string, string>)[extension ?? ""] ?? blob.type;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Cannot read ${path}`));
      reader.readAsDataURL(new Blob([blob], { type: mime }));
    });
  };
  const css = async (text: string, owner: string, ancestors: string[] = []): Promise<string> => {
    // Inline imports before url() so imported resources retain their own base.
    const imports = [...text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi)];
    for (const match of imports) {
      const path = resolvePreviewPath(match[1], owner);
      if (!path) continue;
      if (ancestors.includes(path)) throw new Error(`Circular CSS import: ${path}`);
      const body = await css(await (await read(path)).text(), path, [...ancestors, path]);
      text = text.replace(match[0], match[2].trim() ? `@media ${match[2]} {${body}}` : body);
    }
    const urls = [...text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)];
    for (const match of urls) {
      const path = resolvePreviewPath(match[2], owner);
      if (path) text = text.replace(match[0], `url("${await dataUrl(path)}")`);
    }
    return text;
  };
  const document = new DOMParser().parseFromString(await (await read(filename)).text(), "text/html");
  // The bundle's base is the session directory, never the app/API origin.
  document.querySelectorAll("base").forEach((node) => node.remove());
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')) {
    const path = resolvePreviewPath(link.getAttribute("href")!, filename);
    if (!path) continue;
    const style = document.createElement("style");
    if (link.media) style.media = link.media;
    style.textContent = (await css(await (await read(path)).text(), path, [path])).replace(/<\/style/gi, "<\\/style");
    link.replaceWith(style);
  }
  for (const style of document.querySelectorAll("style")) {
    style.textContent = (await css(style.textContent ?? "", filename)).replace(/<\/style/gi, "<\\/style");
  }
  for (const script of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
    const path = resolvePreviewPath(script.getAttribute("src")!, filename);
    if (!path) continue;
    if (script.type === "module") throw new Error("Local JavaScript modules require a project preview server");
    script.textContent = (await (await read(path)).text()).replace(/<\/script/gi, "<\\/script");
    script.removeAttribute("src");
    script.removeAttribute("integrity");
    if (script.defer && !script.async) document.body.append(script);
  }
  for (const element of document.querySelectorAll<HTMLElement>("[style]")) {
    element.setAttribute("style", await css(element.getAttribute("style")!, filename));
  }
  for (const element of document.querySelectorAll("img[src], source[src], video[poster]")) {
    const attribute = element.hasAttribute("poster") ? "poster" : "src";
    const path = resolvePreviewPath(element.getAttribute(attribute)!, filename);
    if (path) element.setAttribute(attribute, await dataUrl(path));
  }
  // srcset can override the bundled src. Fail explicitly rather than contacting
  // the API origin or silently showing a broken responsive image.
  for (const element of document.querySelectorAll("[srcset]")) {
    const value = element.getAttribute("srcset")!;
    if (value.split(",").some((candidate) => resolvePreviewPath(candidate.trim().split(/\s+/)[0], filename))) {
      throw new Error("Local responsive image sources require a project preview server");
    }
  }
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}
