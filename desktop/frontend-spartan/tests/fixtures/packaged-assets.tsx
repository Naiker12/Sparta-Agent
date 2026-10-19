import { createRoot } from "react-dom/client";
import { ApiProviderLogo } from "../../src/features/chat/api-provider-logo";
import { createAppHistory } from "../../src/lib/app-history";
import { reloadAppAt, getAppLocation } from "../../src/lib/app-location";
import { openLink } from "../../src/lib/open-link";

declare const PROVIDERS: string[];
const history = createAppHistory()!;
Object.assign(window, {
  assetProbe: {
    bootId: crypto.randomUUID(),
    navigate: (href: string) => history.push(href),
    back: () => history.back(),
    read: () => { const route = getAppLocation(); return route.pathname + route.search + route.hash; },
    auth: () => reloadAppAt("/login"),
    anchor: () => openLink("#details"),
  },
});
createRoot(document.getElementById("root")!).render(
  <main><h1>Provider assets</h1>{PROVIDERS.map(provider =>
    <div key={provider} data-provider={provider}><ApiProviderLogo providerType={provider} /><span>{provider}</span></div>,
  )}<div id="details">Details</div></main>,
);
