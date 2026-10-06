import { translate as uiTranslate } from "@/i18n";
import { createRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { requirePasswordChangeFlow } from "../auth-guards";
import { Route as rootRoute } from "./__root";

const ChangePasswordPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/change-password",
  staticData: { get title() { return uiTranslate("ui.change_password"); }, isAuthFlow: true },
  beforeLoad: () => requirePasswordChangeFlow(),
  component: ChangePasswordPage,
});
