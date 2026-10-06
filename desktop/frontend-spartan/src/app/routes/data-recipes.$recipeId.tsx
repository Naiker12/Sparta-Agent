import { translate as uiTranslate } from "@/i18n";
import { EditRecipePage } from "@/features/data-recipes/pages/edit-recipe-page";
import { createRoute, useParams } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

function EditRecipeRouteComponent() {
  const { recipeId } = useParams({ from: "/data-recipes/$recipeId" });
  return <EditRecipePage recipeId={recipeId} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data-recipes/$recipeId",
  staticData: { get title() { return uiTranslate("ui.edit_recipe"); } },
  beforeLoad: () => requireAuth(),
  component: EditRecipeRouteComponent,
});
