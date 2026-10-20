import {
  Component,
  createContext,
  lazy,
  Suspense,
  useContext,
  type ReactNode,
} from "react";
import { useChatPreferencesStore } from "../stores/chat-preferences-store";
import type { ReferenceImage } from "./contracts";
import type { ResponsePanel } from "./panels";

function loadRenderer() {
  // react-lang 0.4.1 auto-mounts a CDN inspector in development. This pinned
  // bootstrap guard keeps dev sessions local too. Review on package upgrade.
  (globalThis as Record<symbol, unknown>)[
    Symbol.for("openui.devtools.autoMount")
  ] = true;
  return import("./rich-renderer");
}
const RichTable = lazy(() =>
  loadRenderer().then((m) => ({ default: m.RichTable })),
);
const Gallery = lazy(() =>
  loadRenderer().then((m) => ({ default: m.ReferenceGallery })),
);
const Panel = lazy(() => loadRenderer().then((m) => ({ default: m.CustomPanel })));
export const ResponseUiEnabledContext = createContext(false);

export function ResponsePanelDisplay({ panel, children }: { panel: ResponsePanel; children: ReactNode }) {
  return <PresentationBoundary key={JSON.stringify(panel)} fallback={children}><Suspense fallback={children}><Panel panel={panel} fallback={children} /></Suspense></PresentationBoundary>;
}

class PresentationBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ResponseTable({
  markdown,
  incomplete,
  children,
}: { markdown: string; incomplete?: boolean; children: ReactNode }) {
  const enabled = useContext(ResponseUiEnabledContext);
  // No OpenUI download for prose, code, streaming tails, or disabled clients.
  if (
    !enabled ||
    incomplete ||
    markdown.length > 40_000 ||
    !/^\s*\|?.+\|.*\r?\n\s*\|?\s*:?-{3}/.test(markdown)
  )
    return children;
  return (
    <PresentationBoundary key={markdown} fallback={children}>
      <Suspense fallback={children}>
        <RichTable markdown={markdown} fallback={children} />
      </Suspense>
    </PresentationBoundary>
  );
}

export function ResponseImageGallery({
  images,
  children,
}: { images: ReferenceImage[]; children: ReactNode }) {
  const enabled = useChatPreferencesStore((s) => s.visualResponses);
  if (!enabled || !images.length) return children;
  return (
    <PresentationBoundary key={JSON.stringify(images)} fallback={children}>
      <Suspense fallback={children}>
        <Gallery images={images} fallback={children} />
      </Suspense>
    </PresentationBoundary>
  );
}
