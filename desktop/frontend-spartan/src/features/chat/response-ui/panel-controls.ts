import { createContext } from "react";
import type { FormBlock, FormValues } from "./panels";
export type PanelControls = {
  draftScope?: string;
  disabled: boolean;
  submitted: ReadonlySet<string>;
  submittedValues: ReadonlyMap<string, FormValues>;
  onSubmit: (form: FormBlock, values: FormValues) => Promise<void>;
};
export const PanelControlsContext = createContext<PanelControls | null>(null);
