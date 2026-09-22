import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { Link, createRouter, useRouterState } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as apiMonitorRoute } from "./routes/api";
import { Route as audioRoute } from "./routes/audio";
import { Route as changePasswordRoute } from "./routes/change-password";
import { Route as chatRoute } from "./routes/chat";
import { Route as dataRecipesRoute } from "./routes/data-recipes";
import { Route as editRecipeRoute } from "./routes/data-recipes.$recipeId";
import { Route as exportRoute } from "./routes/export";
import { Route as indexRoute } from "./routes/index";
import { Route as loginRoute } from "./routes/login";
import { Route as memoryRoute } from "./routes/memory";
import { Route as projectsRoute } from "./routes/projects";
import { Route as settingsRoute } from "./routes/settings";
import { Route as tasksRoute } from "./routes/tasks";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  changePasswordRoute,
  settingsRoute,
  chatRoute,
  projectsRoute,
  dataRecipesRoute,
  editRecipeRoute,
  exportRoute,
  audioRoute,
  apiMonitorRoute,
  memoryRoute,
  tasksRoute,
]);

function DefaultNotFound() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <img
        src={`${import.meta.env.BASE_URL}spartan-logo.svg`}
        alt="Sparta Agent"
        className="size-20 object-contain"
      />
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">
          {t("shell.notFound.title")}
        </h1>
        <p className="text-muted-foreground text-sm break-all">
          {t("shell.notFound.description", { path: pathname })}
        </p>
      </div>
      <Button asChild={true}>
        <Link to="/chat">{t("shell.notFound.backToChat")}</Link>
      </Button>
    </div>
  );
}

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: DefaultNotFound,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
