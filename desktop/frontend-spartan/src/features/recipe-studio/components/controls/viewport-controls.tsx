import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Panel, useReactFlow } from "@xyflow/react";
import {
  Focus,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import { type ReactElement, useCallback } from "react";
import { buildFitViewOptions } from "../../utils/graph/fit-view";
import { RECIPE_FLOATING_ICON_BUTTON_CLASS } from "../recipe-floating-icon-button-class";

type ViewportControlsProps = {
  interactive: boolean;
  lockDisabled?: boolean;
  onToggleInteractive: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
};

export function ViewportControls({
  interactive,
  lockDisabled = false,
  onToggleInteractive,
  maximized,
  onToggleMaximize,
}: ViewportControlsProps): ReactElement {
  const uiT = useUiT();

  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 150 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 150 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView(buildFitViewOptions(getNodes()));
  }, [fitView, getNodes]);

  return (
    <Panel position="bottom-left" className="m-3 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={RECIPE_FLOATING_ICON_BUTTON_CLASS}
        onClick={handleZoomIn}
        aria-label={uiT("chat.preview.zoomIn")}
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={RECIPE_FLOATING_ICON_BUTTON_CLASS}
        onClick={handleZoomOut}
        aria-label={uiT("chat.preview.zoomOut")}
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={RECIPE_FLOATING_ICON_BUTTON_CLASS}
        onClick={handleFitView}
        aria-label={uiT("ui.center_view")}
      >
        <Focus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={RECIPE_FLOATING_ICON_BUTTON_CLASS}
        onClick={onToggleMaximize}
        aria-label={maximized ? uiT("ui.exit_full_view") : uiT("ui.expand_to_full_view")}
      >
        {maximized ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={RECIPE_FLOATING_ICON_BUTTON_CLASS}
        disabled={lockDisabled}
        onClick={onToggleInteractive}
        aria-label={interactive ? uiT("ui.lock_interaction") : uiT("ui.unlock_interaction")}
      >
        {interactive ? (
          <LockOpen className="size-4" />
        ) : (
          <Lock className="size-4" />
        )}
      </Button>
    </Panel>
  );
}
