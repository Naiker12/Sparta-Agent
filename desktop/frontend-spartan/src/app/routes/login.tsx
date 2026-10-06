import { translate as uiTranslate } from "@/i18n";
import { createRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { requireGuest } from "../auth-guards";
import { Route as rootRoute } from "./__root";

const LoginPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.LoginPage })),
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  staticData: { get title() { return uiTranslate("ui.login"); }, isAuthFlow: true },
  beforeLoad: () => requireGuest(),
  component: LoginPage,
});
