import { createBrowserHistory, createHashHistory } from "@tanstack/react-router";
import { usesFileRouting } from "./app-location";

export function createAppHistory() {
  if (typeof window === "undefined") return undefined;
  return usesFileRouting(window.location) ? createHashHistory() : createBrowserHistory();
}
