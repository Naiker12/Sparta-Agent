
import { createRoute, useParams } from "@tanstack/react-router";
import { EditRecipePage } from "@/features/data-recipes/pages/edit-recipe-page";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

function EditRecipeRouteComponent() {
  const { recipeId } = useParams({ from: "/data-recipes/$recipeId" });
  return <EditRecipePage recipeId={recipeId} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data-recipes/$recipeId",
  staticData: { title: "Edit Recipe" },
  beforeLoad: () => requireAuth(),
  component: EditRecipeRouteComponent,
});
