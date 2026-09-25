import { createRoute, redirect } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/export",
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: "/chat" });
  },
  component: () => null,
});
