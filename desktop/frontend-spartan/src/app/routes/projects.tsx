import { translate as uiTranslate } from "@/i18n";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

const ProjectsPage = lazyRouteComponent(
  () => import("@/features/chat/projects-page"),
  "ProjectsPage",
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  staticData: { get title() { return uiTranslate("chat.composer.projects"); } },
  beforeLoad: () => requireAuth(),
  component: ProjectsPage,
});
