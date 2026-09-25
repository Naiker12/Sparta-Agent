import { createRoute, redirect } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/audio",
  // Kept temporarily so old deep links and stale picker code remain type-safe;
  // beforeLoad redirects every request to the API-only chat surface.
  validateSearch: (
    search: Record<string, unknown>,
  ): { model?: string; quant?: string; ggufQuant?: string; task?: string } => ({
    ...(typeof search.model === "string" ? { model: search.model } : {}),
    ...(typeof search.quant === "string" ? { quant: search.quant } : {}),
    ...(typeof search.ggufQuant === "string"
      ? { ggufQuant: search.ggufQuant }
      : {}),
    ...(typeof search.task === "string" ? { task: search.task } : {}),
  }),
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: "/chat" });
  },
  component: () => null,
});
