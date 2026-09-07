import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards"; import { Route as rootRoute } from "./__root";
export const Route = createRoute({ getParentRoute: () => rootRoute, path: "/memory", beforeLoad: () => requireAuth(), component: lazyRouteComponent(() => import("@/features/memory/memory-page"), "MemoryPage") });
