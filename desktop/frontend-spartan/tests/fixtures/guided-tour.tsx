import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GuidedTour, TOUR_OPEN_EVENT, useGuidedTourController } from "../../src/features/tour";
import { CHAT_TOUR_AUTO_KEY } from "../../src/features/tour/lib/tour-history";
import { buildChatTourSteps } from "../../src/features/chat/tour";
import { setLocale, useT } from "../../src/i18n";
import "../../src/index.css";

await setLocale("es");
function Fixture() {
  const t = useT();
  const steps = useMemo(() => buildChatTourSteps({t}), [t]);
  const tour = useGuidedTourController({id: "chat", steps, autoKey: CHAT_TOUR_AUTO_KEY, autoWhen: true});
  return <main data-testid="tour-ready" data-open={tour.open} style={{padding: 24}}>
    <button onClick={() => window.dispatchEvent(new CustomEvent(TOUR_OPEN_EVENT, {detail: {id: "chat"}}))}>Recorrido guiado</button>
    <div data-tour="chat-model-selector" hidden>Hidden duplicate</div>
    <div style={{display: "flex", flexWrap: "wrap", gap: 12, marginTop: 60}}>
      {[...new Set(steps.map(step => step.target))].map(target => <div key={target} data-tour={target} style={{padding: 20, border: "1px solid gray"}}>{target}</div>)}
    </div>
    <GuidedTour {...tour.tourProps} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
