import { useT as useUiT } from "@/i18n";
import type { ReactElement } from "react";
import type { NodeConfig } from "../../types";
import { getConfigErrors } from "../../utils";

export function ValidationBanner({
  config,
}: {
  config: NodeConfig | null;
}): ReactElement | null {
  const uiT = useUiT();

  const errors = getConfigErrors(config);
  if (errors.length === 0) {
    return null;
  }
  return (
    <p className="text-xs text-amber-600">
      <span className="font-semibold">{uiT("ui.needs_attention")}{" "}</span>
      {errors.join(". ")}.
    </p>
  );
}
